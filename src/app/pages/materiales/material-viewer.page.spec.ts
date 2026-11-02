import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { MaterialFilesService } from '../../core/services/material-files.service';
import { MaterialViewerPage } from './material-viewer.page';
import { MaterialDetailPage } from './material-detail.page';
import { MaterialsService } from '../../core/services/materials.service';
const ITEM = { id_material: 52, titulo: 'Clase de anatomía', tipo: 'IMAGEN', url: 'https://res.cloudinary.com/demo/image/upload/clase.png', activo: 1, visibilidad: 'PUBLICO' };
describe('Materiales: visualización y descarga desde detalle', () => {
  let preview: Subject<{ material: typeof ITEM; url: string; mime: string }>;
  let files: { preview: ReturnType<typeof vi.fn>; download: ReturnType<typeof vi.fn>; open: ReturnType<typeof vi.fn>; safeUrl: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });
    preview = new Subject(); files = { preview: vi.fn(() => preview), download: vi.fn(), open: vi.fn(), safeUrl: vi.fn(() => true) };
    TestBed.configureTestingModule({ imports: [MaterialViewerPage, MaterialDetailPage], providers: [provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '52' } } } },
      { provide: MaterialFilesService, useValue: files }, { provide: MaterialsService, useValue: { detail: () => of(ITEM) } },
    ] });
  });
  afterEach(() => vi.restoreAllMocks());
  it('carga imagen ajustada sin alterar proporciones y vuelve al detalle', async () => {
    const fixture = TestBed.createComponent(MaterialViewerPage); await fixture.whenStable(); fixture.componentInstance.load(); await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Preparando archivo');
    preview.next({ material: ITEM, url: ITEM.url, mime: 'image/png' }); await fixture.whenStable();
    const image = fixture.nativeElement.querySelector('img'); expect(image.getAttribute('src')).toBe(ITEM.url);
    expect(image.getAttribute('alt')).toBe(ITEM.titulo); image.dispatchEvent(new Event('load')); await fixture.whenStable();
    expect(fixture.componentInstance.loading()).toBe(false); expect(fixture.componentInstance.detailUrl).toBe('/materiales/52');
  });
  it('usa video con controles y evita reproducir automáticamente', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('probably');
    const fixture = TestBed.createComponent(MaterialViewerPage); await fixture.whenStable(); fixture.componentInstance.load();
    preview.next({ material: { ...ITEM, tipo: 'VIDEO' }, url: ITEM.url, mime: 'video/mp4' }); await fixture.whenStable();
    const video = fixture.nativeElement.querySelector('video'); expect(video.hasAttribute('controls')).toBe(true);
    expect(video.hasAttribute('playsinline')).toBe(true); expect(video.hasAttribute('autoplay')).toBe(false);
    video.dispatchEvent(new Event('loadedmetadata')); expect(fixture.componentInstance.loading()).toBe(false);
  });
  it('explica un codec sin soporte y ofrece volver para descargar', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('');
    const page = TestBed.runInInjectionContext(() => new MaterialViewerPage()); page.load();
    preview.next({ material: { ...ITEM, tipo: 'VIDEO' }, url: ITEM.url, mime: 'video/quicktime' });
    expect(page.error()).toContain('descargarlo'); expect(page.source()).toBe(''); expect(page.loading()).toBe(false);
  });
  it('libera blob y detiene video al salir; cancela la suscripción pendiente', () => {
    const page = TestBed.runInInjectionContext(() => new MaterialViewerPage()); page.load();
    page.source.set('blob:test'); const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const video = { pause: vi.fn(), removeAttribute: vi.fn(), load: vi.fn() };
    (page as unknown as { video: ElementRef<unknown> }).video = new ElementRef(video);
    page.ionViewWillLeave(); expect(revoke).toHaveBeenCalledWith('blob:test'); expect(video.pause).toHaveBeenCalled(); expect(video.load).toHaveBeenCalled();
    expect(preview.observed).toBe(false); expect(page.source()).toBe('');
  });
  it('muestra error de archivo/conexión y puede reintentar la consulta', () => {
    const page = TestBed.runInInjectionContext(() => new MaterialViewerPage()); page.load(); preview.error(new Error('Archivo no disponible'));
    expect(page.error()).toContain('no disponible'); expect(page.loading()).toBe(false);
    preview = new Subject(); page.load(); expect(files.preview).toHaveBeenCalledTimes(2); expect(page.error()).toBe('');
  });
  it('el detalle enlaza imagen/PDF al visor adecuado y Office solo a descarga', async () => {
    const fixture = TestBed.createComponent(MaterialDetailPage); await fixture.whenStable(); fixture.componentInstance.load(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('ion-button[href="/materiales/52/visor"]')).toBeTruthy();
    fixture.componentInstance.material.set({ ...ITEM, tipo: 'PDF' } as never); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('ion-button[href="/materiales/52/lector"]')).toBeTruthy();
    fixture.componentInstance.material.set({ ...ITEM, tipo: 'PPT' } as never); await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('no tiene vista previa');
    expect(fixture.nativeElement.querySelector('ion-button[href="/materiales/52/visor"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Descargar archivo');
  });
  it('informa ubicación solo cuando terminó la descarga y permite abrirla', async () => {
    const page = TestBed.runInInjectionContext(() => new MaterialDetailPage()); page.load();
    const file = { uri: 'content://media/downloads/1', name: 'clase.png', mime: 'image/png', location: 'Descargas/Tiozihuatl/clase.png' };
    let resolve!: (value: typeof file) => void; files.download.mockReturnValue(new Promise(done => { resolve = done; }));
    const pending = page.download(); expect(page.downloading()).toBe(true); expect(page.downloadMessage()).toBe('');
    resolve(file); await pending; expect(page.downloading()).toBe(false); expect(page.downloadConfirmation()).toBe(true); expect(page.downloaded()?.location).toBe(file.location);
    await page.openDownloaded(); expect(files.open).toHaveBeenCalledWith(file); page.ngOnDestroy();
  });
  it('cierra la confirmación a los cinco segundos o al aceptar, conservando el archivo', async () => {
    vi.useFakeTimers();
    const page = TestBed.runInInjectionContext(() => new MaterialDetailPage()); page.load();
    const file = { uri: 'content://media/downloads/1', name: 'clase.png', mime: 'image/png', location: 'Descargas/Tiozihuatl/clase.png' };
    files.download.mockResolvedValue(file);
    try {
      await page.download(); expect(page.downloadConfirmation()).toBe(true);
      vi.advanceTimersByTime(4999); expect(page.downloadConfirmation()).toBe(true);
      vi.advanceTimersByTime(1); expect(page.downloadConfirmation()).toBe(false); expect(page.downloaded()).toEqual(file);
      await page.download(); page.closeConfirmation(); expect(page.downloadConfirmation()).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
      await page.download(); page.ionViewWillLeave(); expect(page.downloadConfirmation()).toBe(false); expect(vi.getTimerCount()).toBe(0);
    } finally { page.ngOnDestroy(); vi.useRealTimers(); }
  });
  it('no confirma éxito cuando el navegador solo recibió la solicitud de descarga', async () => {
    const page = TestBed.runInInjectionContext(() => new MaterialDetailPage()); page.load(); files.download.mockResolvedValue(null);
    await page.download(); expect(page.downloadConfirmation()).toBe(false); expect(page.downloadMessage()).toContain('Archivo enviado al navegador');
  });
  it('muestra fallos de descarga, permite reintentar y cancela al salir', async () => {
    const page = TestBed.runInInjectionContext(() => new MaterialDetailPage()); page.load();
    files.download.mockRejectedValueOnce(new Error('Descarga fallida')); await page.download(); expect(page.downloadError()).toContain('fallida'); expect(page.downloadConfirmation()).toBe(false);
    let signal!: AbortSignal; let resolve!: (value: null) => void;
    files.download.mockImplementation((_id, abort) => { signal = abort; return new Promise(done => { resolve = done; }); });
    const pending = page.download(); page.ionViewWillLeave(); expect(signal.aborted).toBe(true);
    resolve(null); await pending; expect(page.downloadMessage()).toBe(''); expect(page.downloading()).toBe(false);
  });
});
