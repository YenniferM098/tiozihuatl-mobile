import { Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonSpinner, IonTitle, IonToolbar } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { getDocument, GlobalWorkerOptions, PDFDocumentProxy, PDFDocumentLoadingTask, PDFPageProxy, RenderTask } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { ReadingProgressStore } from '../../data/storage/reading-progress.storage';
import { libraryError } from '../../core/services/library.service';
import { PDF_READER_SOURCE } from '../../core/services/pdf-reader-source';
import { LibraryStateComponent } from './library-state.component';
import { layoutPdfPages, pageAtOffset, PdfPageSlot, visiblePdfWindow } from './pdf-layout';

@Component({
  selector: 'app-book-reader',
  templateUrl: './book-reader.page.html',
  styleUrls: ['./book-reader.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonButton, IonSpinner, LibraryStateComponent],
})
export class BookReaderPage implements OnDestroy {
  @ViewChild('container', { static: true }) private container!: ElementRef<HTMLDivElement>;
  @ViewChild(IonContent, { static: true }) private content!: IonContent;
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(PDF_READER_SOURCE);
  private readonly progress = inject(ReadingProgressStore);
  private request?: Subscription;
  private document?: PDFDocumentProxy;
  private loadingTask?: PDFDocumentLoadingTask;
  private observer?: ResizeObserver;
  private scrollElement?: HTMLElement;
  private activeView = false;
  private enterVersion = 0;
  private frame = 0;
  private pendingScrollTop: number | null = null;
  private bookId = 0;
  private resumeTimer?: ReturnType<typeof setTimeout>;
  private loadVersion = 0;
  private renderVersion = 0;
  private width = 0;
  private ratios: number[] = [];
  private readonly jobs = new Map<number, symbol>();
  private readonly tasks = new Map<number, RenderTask>();
  readonly title = signal('Lector digital');
  readonly loading = signal(true);
  readonly loadingMessage = signal('Cargando archivo…');
  readonly error = signal('');
  readonly page = signal(1);
  readonly totalPages = signal(0);
  readonly resumeMessage = signal('');
  readonly slots = signal<PdfPageSlot[]>([]);
  readonly activePages = signal<Set<number>>(new Set());
  readonly readyPages = signal<Set<number>>(new Set());
  readonly pageErrors = signal<Map<number, string>>(new Map());
  get detailUrl(): string { return `${this.service.detailPath ?? '/biblioteca'}/${this.route.snapshot.paramMap.get('id')}`; }

  async ionViewDidEnter(): Promise<void> {
    this.activeView = true;
    const enterVersion = ++this.enterVersion;
    const scrollElement = await this.content.getScrollElement();
    if (!this.activeView || enterVersion !== this.enterVersion) return;
    this.scrollElement = scrollElement;
    this.width = this.container.nativeElement.clientWidth;
    this.observer?.disconnect();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(this.container.nativeElement);
    this.load();
  }
  load(): void {
    this.release();
    const version = this.loadVersion;
    this.page.set(1);
    this.totalPages.set(0);
    this.title.set('Lector digital');
    this.error.set('');
    this.loadingMessage.set('Cargando archivo…');
    this.loading.set(true);
    if (this.scrollElement) this.scrollElement.scrollTop = 0;
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isSafeInteger(id) || id <= 0) { this.loading.set(false); this.error.set('El archivo no está disponible.'); return; }
    this.bookId = id;
    GlobalWorkerOptions.workerSrc = new URL('assets/pdfjs/pdf.worker.min.mjs', document.baseURI).href;
    this.request = this.service.pdf(id).subscribe({
      next: ({ data, titulo }) => { void this.prepareDocument(data, titulo, version); },
      error: error => { if (version === this.loadVersion) { this.loading.set(false); this.error.set(libraryError(error, true)); } },
    });
  }
  private async prepareDocument(data: ArrayBuffer, title: string, version: number): Promise<void> {
    if (version !== this.loadVersion) return;
    this.title.set(title || 'Lector digital');
    try {
      const task = getDocument({
        data: new Uint8Array(data),
        cMapUrl: new URL('assets/pdfjs/cmaps/', document.baseURI).href,
        cMapPacked: true,
        standardFontDataUrl: new URL('assets/pdfjs/standard_fonts/', document.baseURI).href,
        isEvalSupported: false,
      });
      this.loadingTask = task;
      const pdf = await task.promise;
      if (version !== this.loadVersion) { await pdf.destroy(); return; }
      this.document = pdf;
      this.totalPages.set(pdf.numPages);
      // Solo se consulta geometría; no se renderizan todas las páginas ni se guardan sus canvas.
      const ratios: number[] = [];
      for (let number = 1; number <= pdf.numPages; number++) {
        if (version !== this.loadVersion) return;
        this.loadingMessage.set(`Preparando documento… ${number} / ${pdf.numPages}`);
        const page = await pdf.getPage(number);
        if (version !== this.loadVersion) return;
        const natural = page.getViewport({ scale: 1 });
        ratios.push(natural.height / natural.width);
        page.cleanup();
      }
      this.ratios = ratios;
      this.width = this.container.nativeElement.clientWidth;
      const slots = layoutPdfPages(ratios, this.width);
      this.slots.set(slots);
      this.loading.set(false);
      this.resume(slots);
      this.onScroll();
    } catch {
      if (version !== this.loadVersion) return;
      this.loading.set(false);
      this.error.set('No fue posible preparar el PDF. El documento o el lector no están disponibles. Intenta nuevamente.');
    }
  }

  /** Abre el libro en la última página leída y lo avisa unos segundos. */
  private resume(slots: PdfPageSlot[]): void {
    const saved = this.progress.lastPage(this.bookId);
    if (saved <= 1 || !slots[saved - 1]) return;
    this.pendingScrollTop = this.container.nativeElement.offsetTop + slots[saved - 1].top;
    this.resumeMessage.set(`Continuando en la página ${saved}`);
    this.resumeTimer = setTimeout(() => this.resumeMessage.set(''), 4000);
  }

  /** Usa el scroll interno de Ionic, no window.scroll, con un trabajo por frame. */
  onScroll(): void {
    if (this.frame || this.loading() || !this.document) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (this.pendingScrollTop !== null && this.scrollElement) {
        this.scrollElement.scrollTop = this.pendingScrollTop;
        this.pendingScrollTop = null;
      }
      this.updateWindow();
    });
  }
  private updateWindow(): void {
    if (!this.scrollElement || !this.slots().length || !this.width) return;
    const top = Math.max(0, this.scrollElement.scrollTop - this.container.nativeElement.offsetTop);
    const window = visiblePdfWindow(this.slots(), top, this.scrollElement.clientHeight);
    if (window.current !== this.page()) this.progress.save(this.bookId, window.current);
    this.page.set(window.current);
    const active = new Set(window.pages);
    this.activePages.set(active);
    for (const [number, task] of this.tasks) if (!active.has(number)) task.cancel();
    const ready = new Set(this.readyPages());
    for (const number of ready) if (!active.has(number)) {
      this.removeCanvas(this.slotElement(number));
      ready.delete(number);
    }
    this.readyPages.set(ready);
    this.pump();
  }
  private removeCanvas(slot: HTMLElement | null): void {
    const canvas = slot?.querySelector('canvas');
    if (canvas) { canvas.width = 0; canvas.height = 0; canvas.remove(); }
  }
  private slotElement(number: number): HTMLElement | null {
    return this.container.nativeElement.querySelector(`[data-page="${number}"]`);
  }
  /** Dos renders como máximo; el resto espera y las páginas lejanas se liberan. */
  private pump(): void {
    if (!this.document || this.loading() || this.error()) return;
    const candidates = [...this.activePages()].sort((a, b) => Math.abs(a - this.page()) - Math.abs(b - this.page()));
    for (const number of candidates) {
      if (this.jobs.size >= 2) break;
      if (this.readyPages().has(number) || this.jobs.has(number) || this.pageErrors().has(number) || !this.slotElement(number)) continue;
      const job = Symbol();
      this.jobs.set(number, job);
      void this.renderPage(number, this.renderVersion).finally(() => {
        if (this.jobs.get(number) !== job) return;
        this.jobs.delete(number);
        this.pump();
      });
    }
  }
  private async renderPage(number: number, version: number): Promise<void> {
    const pdf = this.document;
    if (!pdf) return;
    let task: RenderTask | undefined;
    let pdfPage: PDFPageProxy | undefined;
    try {
      pdfPage = await pdf.getPage(number);
      if (version !== this.renderVersion || !this.activePages().has(number)) return;
      const natural = pdfPage.getViewport({ scale: 1 });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = pdfPage.getViewport({ scale: this.width / natural.width * ratio });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas no disponible');
      task = pdfPage.render({ canvasContext: context, viewport });
      this.tasks.set(number, task);
      await task.promise;
      if (version !== this.renderVersion || !this.activePages().has(number)) return;
      const slot = this.slotElement(number);
      if (!slot) return;
      this.removeCanvas(slot);
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `Página ${number} de ${this.totalPages()} del documento ${this.title()}`);
      canvas.style.display = 'block';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      slot.appendChild(canvas);
      this.readyPages.update(ready => new Set([...ready, number]));
    } catch (error) {
      if (version !== this.renderVersion || !this.activePages().has(number)) return;
      if ((error as { name?: string })?.name === 'RenderingCancelledException') return;
      this.pageErrors.update(errors => new Map(errors).set(number, 'No fue posible visualizar esta página.'));
    } finally {
      if (this.tasks.get(number) === task) this.tasks.delete(number);
      pdfPage?.cleanup();
    }
  }
  retryPage(number: number): void {
    this.pageErrors.update(errors => { const next = new Map(errors); next.delete(number); return next; });
    this.pump();
  }
  private resize(): void {
    const width = this.container.nativeElement.clientWidth;
    if (width <= 0 || width === this.width) return;
    const oldSlots = this.slots();
    const top = Math.max(0, (this.scrollElement?.scrollTop ?? 0) - this.container.nativeElement.offsetTop);
    const index = pageAtOffset(oldSlots, top);
    const fraction = oldSlots[index] ? (top - oldSlots[index].top) / oldSlots[index].height : 0;
    this.width = width;
    if (!this.document || this.loading()) return;
    this.cancelRenders();
    const slots = layoutPdfPages(this.ratios, width);
    this.slots.set(slots);
    // La rotación conserva la misma página y la posición relativa dentro de ella.
    if (this.scrollElement && slots[index]) this.pendingScrollTop = this.container.nativeElement.offsetTop + slots[index].top + slots[index].height * fraction;
    this.onScroll();
  }
  private cancelRenders(): void {
    this.renderVersion++;
    this.tasks.forEach(task => task.cancel());
    this.tasks.clear();
    this.jobs.clear();
    this.container.nativeElement.querySelectorAll('canvas').forEach(canvas => { canvas.width = 0; canvas.height = 0; canvas.remove(); });
    this.readyPages.set(new Set());
    this.pageErrors.set(new Map());
  }
  private release(): void {
    this.loadVersion++;
    this.request?.unsubscribe();
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.pendingScrollTop = null;
    clearTimeout(this.resumeTimer);
    this.resumeMessage.set('');
    this.cancelRenders();
    void this.loadingTask?.destroy().catch(() => undefined);
    this.loadingTask = undefined;
    this.document = undefined;
    this.ratios = [];
    this.slots.set([]);
    this.activePages.set(new Set());
  }
  ionViewWillLeave(): void {
    this.activeView = false;
    this.enterVersion++;
    this.observer?.disconnect(); this.observer = undefined;
    this.release();
    this.scrollElement = undefined;
  }
  ngOnDestroy(): void { this.ionViewWillLeave(); }
}
