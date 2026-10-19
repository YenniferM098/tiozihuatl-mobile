import { HttpErrorResponse } from '@angular/common/http';
import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { LibraryService } from '../../core/services/library.service';
import { PDF_READER_SOURCE } from '../../core/services/pdf-reader-source';
import { BookReaderPage } from './book-reader.page';
import { layoutPdfPages, visiblePdfWindow } from './pdf-layout';

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({ getDocument: vi.fn(), GlobalWorkerOptions: {} }));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
interface ReaderInternals {
  container: ElementRef<HTMLDivElement>;
  content: { scrollToPoint: ReturnType<typeof vi.fn> };
  scrollElement: HTMLElement;
  document: unknown;
  width: number;
  ratios: number[];
  pendingScrollTop: number | null;
  jobs: Map<number, symbol>;
  renderPage(number: number, version: number): Promise<void>;
  prepareDocument(data: ArrayBuffer, title: string, version: number): Promise<void>;
  updateWindow(): void;
  pump(): void;
  resize(): void;
}
function pdfPage(promise = Promise.resolve()) {
  return {
    getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 900 * scale }),
    render: vi.fn(() => ({ promise, cancel: vi.fn() })),
    cleanup: vi.fn(),
  };
}

describe('Lector continuo: scroll, carga progresiva y recursos', () => {
  let reader: BookReaderPage;
  let internal: ReaderInternals;
  let container: HTMLDivElement;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '52' } } } },
      { provide: LibraryService, useValue: {} },
    ] });
    reader = TestBed.runInInjectionContext(() => new BookReaderPage());
    internal = reader as unknown as ReaderInternals;
    container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 320, configurable: true });
    for (let number = 1; number <= 10; number++) {
      const slot = document.createElement('section'); slot.dataset['page'] = String(number); container.appendChild(slot);
    }
    internal.container = new ElementRef(container);
    internal.content = { scrollToPoint: vi.fn() };
    internal.scrollElement = document.createElement('div');
    Object.defineProperty(internal.scrollElement, 'clientHeight', { value: 500 });
    internal.width = 320;
    internal.ratios = Array(10).fill(1.5);
    reader.slots.set(layoutPdfPages(internal.ratios, 320));
    reader.totalPages.set(10);
    reader.loading.set(false);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as CanvasRenderingContext2D);
  });
  afterEach(() => { reader.ngOnDestroy(); vi.restoreAllMocks(); });

  it('reserva alturas exactas y deja el mismo scroll al renderizar, sin páginas duplicadas', async () => {
    internal.document = { getPage: async () => pdfPage() };
    reader.activePages.set(new Set([1]));
    internal.scrollElement.scrollTop = 180;
    const slots = reader.slots();
    await internal.renderPage(1, 0);
    await internal.renderPage(1, 0);
    expect(container.querySelectorAll('canvas').length).toBe(1);
    expect(container.querySelector('canvas')?.width).toBe(320);
    expect(container.querySelector('canvas')?.height).toBe(480);
    expect(reader.slots()).toBe(slots);
    expect(internal.scrollElement.scrollTop).toBe(180);
  });
  it('el scroll cambia la página actual y libera canvas lejos del viewport', () => {
    container.firstElementChild?.appendChild(document.createElement('canvas'));
    reader.readyPages.set(new Set([1]));
    internal.document = {};
    vi.spyOn(internal, 'pump').mockImplementation(() => undefined);
    internal.scrollElement.scrollTop = 2500;
    internal.updateWindow();
    expect(reader.page()).toBe(6);
    expect(reader.activePages().has(6)).toBe(true);
    expect(reader.activePages().has(1)).toBe(false);
    expect(container.querySelector('canvas')).toBeNull();
    expect(reader.readyPages().has(1)).toBe(false);
  });
  it('solo inicia dos renders simultáneos aunque existan muchas páginas', async () => {
    const pending = deferred<void>();
    const page = pdfPage(pending.promise);
    const getPage = vi.fn(async () => page);
    internal.document = { getPage };
    reader.activePages.set(new Set([1, 2, 3, 4, 5]));
    internal.pump();
    await Promise.resolve();
    expect(internal.jobs.size).toBe(2);
    expect(getPage).toHaveBeenCalledTimes(2);
    reader.ionViewWillLeave();
    pending.resolve();
    await Promise.resolve();
  });
  it('descarta renders pendientes al salir y cancela sus tareas', async () => {
    const pending = deferred<void>();
    const page = pdfPage(pending.promise);
    internal.document = { getPage: async () => page };
    reader.activePages.set(new Set([1]));
    const render = internal.renderPage(1, 0);
    await Promise.resolve();
    const cancel = page.render.mock.results[0].value.cancel;
    reader.ionViewWillLeave();
    pending.resolve();
    await render;
    expect(cancel).toHaveBeenCalled();
    expect(container.querySelector('canvas')).toBeNull();
    expect(reader.slots()).toEqual([]);
  });
  it('muestra un fallo local de página con posibilidad de reintento', async () => {
    internal.document = { getPage: async () => { throw new Error('Página dañada'); } };
    reader.activePages.set(new Set([2]));
    await internal.renderPage(2, 0);
    expect(reader.pageErrors().get(2)).toContain('No fue posible');
    expect(reader.error()).toBe('');
    const pump = vi.spyOn(internal, 'pump').mockImplementation(() => undefined);
    reader.retryPage(2);
    expect(reader.pageErrors().has(2)).toBe(false);
    expect(pump).toHaveBeenCalled();
  });
  it('conserva el contador compacto en el encabezado sin botones de avance y refleja la página visible', async () => {
    const fixture = TestBed.createComponent(BookReaderPage); await fixture.whenStable();
    fixture.componentInstance.loading.set(false); fixture.componentInstance.totalPages.set(10); fixture.componentInstance.page.set(6);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('ion-header .page-counter').textContent).toContain('6 / 10');
    expect(fixture.nativeElement.querySelector('.page-counter ion-button')).toBeNull();
    fixture.componentInstance.page.set(7); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('ion-header .page-counter').textContent).toContain('7 / 10');
    fixture.destroy();
  });
  it('ignora cambios de altura cuando el ancho permanece igual', () => {
    internal.document = {};
    const slots = reader.slots();
    internal.resize();
    expect(reader.slots()).toBe(slots);
  });

  it('la rotación mantiene la posición relativa de lectura después del cambio de geometría', () => {
    internal.document = {};
    internal.scrollElement.scrollTop = 600;
    Object.defineProperty(container, 'clientWidth', { value: 480 });
    vi.spyOn(reader, 'onScroll').mockImplementation(() => undefined);
    internal.resize();
    expect(reader.slots()[1]).toEqual({ number: 2, top: 732, height: 720 });
    expect(internal.pendingScrollTop).toBeCloseTo(894);
  });
  it('prepara alturas ordenadas sin renderizar todas las páginas al abrir un documento', async () => {
    const pages = Array.from({ length: 10 }, () => pdfPage());
    const getPage = vi.fn(async (number: number) => pages[number - 1]);
    const pdf = { numPages: 10, getPage, destroy: vi.fn(async () => undefined) };
    vi.mocked(getDocument).mockReturnValueOnce({ promise: Promise.resolve(pdf), destroy: vi.fn(async () => undefined) } as unknown as ReturnType<typeof getDocument>);
    vi.spyOn(reader, 'onScroll').mockImplementation(() => undefined);
    await internal.prepareDocument(new ArrayBuffer(0), 'Libro', 0);
    expect(reader.slots().map(slot => slot.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(reader.loading()).toBe(false);
    expect(pages.every(page => page.render.mock.calls.length === 0)).toBe(true);
    expect(pages.every(page => page.cleanup.mock.calls.length === 1)).toBe(true);
  });
  it('captura también el fallo síncrono de inicio del worker', async () => {
    vi.mocked(getDocument).mockImplementationOnce(() => { throw new Error('Worker no disponible'); });
    await internal.prepareDocument(new ArrayBuffer(0), 'Libro', 0);
    expect(reader.loading()).toBe(false);
    expect(reader.error()).toContain('No fue posible preparar el PDF');
  });
});

describe('Lector: apertura autorizada y bloqueo de contenido no disponible', () => {
  let id: string;
  let pdf: ReturnType<typeof vi.fn>;
  function create(): BookReaderPage {
    TestBed.configureTestingModule({ providers: [
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => id } } } },
      { provide: PDF_READER_SOURCE, useValue: { pdf } },
    ] });
    const reader = TestBed.runInInjectionContext(() => new BookReaderPage());
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 320, configurable: true });
    (reader as unknown as ReaderInternals).container = new ElementRef(container);
    return reader;
  }
  beforeEach(() => { id = '52'; pdf = vi.fn(); });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('abre el PDF autorizado del libro y muestra su título y número de páginas', async () => {
    pdf.mockReturnValue(of({ data: new ArrayBuffer(8), titulo: 'Atlas de Anatomía' }));
    const page = pdfPage();
    const document = { numPages: 2, getPage: vi.fn(async () => page), destroy: vi.fn(async () => undefined) };
    vi.mocked(getDocument).mockReturnValueOnce({ promise: Promise.resolve(document), destroy: vi.fn(async () => undefined) } as unknown as ReturnType<typeof getDocument>);
    const reader = create();
    vi.spyOn(reader, 'onScroll').mockImplementation(() => undefined);
    reader.load();
    await vi.waitFor(() => expect(reader.loading()).toBe(false));
    expect(pdf).toHaveBeenCalledWith(52);
    expect(reader.title()).toBe('Atlas de Anatomía');
    expect(reader.totalPages()).toBe(2);
    expect(reader.error()).toBe('');
    reader.ngOnDestroy();
  });
  it('no pide el archivo con un identificador inválido', () => {
    id = 'abc';
    const reader = create();
    reader.load();
    expect(pdf).not.toHaveBeenCalled();
    expect(reader.loading()).toBe(false);
    expect(reader.error()).toBe('El archivo no está disponible.');
    reader.ngOnDestroy();
  });
  it('bloquea el contenido no autorizado, inexistente o fuera de Cloudinary con un mensaje claro', () => {
    const reader = create();
    pdf.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 403 })));
    reader.load();
    expect(reader.error()).toContain('Contenido no disponible para este usuario');
    pdf.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 404 })));
    reader.load();
    expect(reader.error()).toBe('El archivo no está disponible.');
    pdf.mockReturnValueOnce(throwError(() => new Error('URL de archivo inválida')));
    reader.load();
    expect(reader.error()).toBe('Este libro no tiene un archivo digital disponible.');
    expect(reader.loading()).toBe(false);
    reader.ngOnDestroy();
  });
  it('al entrar prepara el scroll de Ionic, observa el ancho y carga el archivo', async () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class { observe = observe; disconnect = disconnect; });
    pdf.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const reader = create();
    (reader as unknown as { content: unknown }).content = { getScrollElement: async () => document.createElement('div') };
    await reader.ionViewDidEnter();
    expect(observe).toHaveBeenCalled();
    expect(pdf).toHaveBeenCalledWith(52);
    reader.ngOnDestroy();
    expect(disconnect).toHaveBeenCalled();
  });
  it('aplica el desplazamiento pendiente en el siguiente frame', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const reader = create();
    const internal = reader as unknown as ReaderInternals;
    internal.scrollElement = document.createElement('div');
    internal.document = {};
    reader.loading.set(false);
    internal.pendingScrollTop = 300;
    const update = vi.spyOn(internal, 'updateWindow').mockImplementation(() => undefined);
    reader.onScroll();
    expect(internal.scrollElement.scrollTop).toBe(300);
    expect(internal.pendingScrollTop).toBeNull();
    expect(update).toHaveBeenCalled();
    reader.ngOnDestroy();
  });
});

describe('Geometría de lectura continua', () => {
  it('reserva páginas de tamaños distintos en orden con separaciones constantes', () => {
    expect(layoutPdfPages([1.5, 1, 2], 320)).toEqual([
      { number: 1, top: 0, height: 480 }, { number: 2, top: 492, height: 320 }, { number: 3, top: 824, height: 640 },
    ]);
  });
  it('mantiene una ventana acotada alrededor del viewport para documentos largos', () => {
    const slots = layoutPdfPages(Array(1000).fill(1.5), 320);
    const window = visiblePdfWindow(slots, 49200, 600);
    expect(window.current).toBe(101);
    expect(window.pages).toEqual([100, 101, 102, 103]);
  });
});
