import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { firstValueFrom, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { MATERIAL_FILES_NATIVE, MaterialFiles } from '../native/material-files';
import { SessionService } from './session.service';
import { MaterialsService } from './materials.service';
import { MaterialFilesService, materialFileError } from './material-files.service';
import { materialFileName, validateMaterialBytes } from './material-file-validation';
const native = { probe: vi.fn(), download: vi.fn(), cancel: vi.fn(), open: vi.fn() };
const URL_FILE = 'https://res.cloudinary.com/demo/raw/upload/v123/materiales/ppt/Presentacion';
const ITEM = { id_material: 52, titulo: 'Recurso', descripcion: null, tipo: 'PPT', url: URL_FILE, activo: 1, visibilidad: 'PUBLICO', id_usuario: 4, nombre_docente: null, materias: null, semestres: null, fecha_creacion: null };
function fakeBlob(data: Uint8Array, type = 'application/pdf'): Blob {
  const blob = new Blob([data.slice().buffer], { type });
  blob.arrayBuffer = async () => data.slice().buffer;
  blob.slice = (start = 0, end = data.length, mime = type) => fakeBlob(data.slice(start, end), mime);
  return blob;
}
describe('Archivos de materiales: autorización y transferencia', () => {
  let service: MaterialFilesService;
  let http: HttpTestingController;
  let detail: ReturnType<typeof vi.fn>;
  let role: string;
  beforeEach(() => {
    vi.resetAllMocks();
    role = 'Estudiante'; detail = vi.fn(() => of(ITEM));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: MATERIAL_FILES_NATIVE, useValue: native },
      { provide: MaterialsService, useValue: { detail } },
      { provide: SessionService, useValue: { user: () => ({ id_usuario: 1, rol: role, id_semestre: 1 }) } },
    ] });
    service = TestBed.inject(MaterialFilesService); http = TestBed.inject(HttpTestingController);
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android');
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });
  it('solo permite URLs HTTPS de entrega Cloudinary, sin credenciales', () => {
    expect(service.safeUrl(URL_FILE)).toBe(true);
    for (const url of ['http://res.cloudinary.com/demo/raw/upload/x', 'https://res.cloudinary.com.evil/raw/upload/x', 'https://user:pass@res.cloudinary.com/demo/raw/upload/x', 'https://res.cloudinary.com:444/demo/raw/upload/x', 'https://res.cloudinary.com/login']) expect(service.safeUrl(url)).toBe(false);
  });
  it('revalida la consulta antes de cada descarga y no envía tokens a la transferencia nativa', async () => {
    const saved = { uri: 'content://media/downloads/1', name: 'Presentacion.pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', location: 'Descargas/Tiozihuatl/Presentacion.pptx' };
    const download = native.download.mockResolvedValue(saved);
    expect(await service.download(52, new AbortController().signal)).toEqual(saved);
    expect(detail).toHaveBeenCalledWith(52);
    expect(download.mock.calls[0][0]).toEqual({ url: URL_FILE, title: 'Recurso', kind: 'PPT', requestId: expect.any(String) });
  });
  it('rechaza material ausente y sesión/Visitante restringidos antes de descargar', async () => {
    const download = native.download;
    detail.mockReturnValueOnce(of(null));
    await expect(service.download(52, new AbortController().signal)).rejects.toMatchObject({ status: 403 });
    detail.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 403 })));
    await expect(service.download(52, new AbortController().signal)).rejects.toMatchObject({ status: 403 });
    expect(download).not.toHaveBeenCalled();
  });
  it('no intenta descargar un material sin archivo o con URL insegura', async () => {
    detail.mockReturnValueOnce(of({ ...ITEM, url: null }));
    await expect(service.download(52, new AbortController().signal)).rejects.toThrow('no tiene un archivo');
    detail.mockReturnValueOnce(of({ ...ITEM, url: 'https://evil.example/file' }));
    await expect(service.download(52, new AbortController().signal)).rejects.toThrow('no tiene un archivo');
  });
  it('cancela la descarga nativa cuando se abandona el detalle', async () => {
    let resolve!: (value: never) => void;
    const download = native.download.mockReturnValue(new Promise(done => { resolve = done; }));
    const cancel = native.cancel.mockResolvedValue(undefined);
    const abort = new AbortController(); const pending = service.download(52, abort.signal);
    await vi.waitFor(() => expect(download).toHaveBeenCalled()); abort.abort();
    expect(cancel).toHaveBeenCalledWith({ requestId: download.mock.calls[0][0].requestId });
    resolve({} as never); await pending;
  });
  it('prepara PDF con bytes validados, sin interpretar páginas HTML como documento', async () => {
    detail.mockReturnValue(of({ ...ITEM, tipo: 'PDF' }));
    const valid = firstValueFrom(service.pdf(52));
    http.expectOne(URL_FILE).flush(fakeBlob(new TextEncoder().encode('%PDF-1.7\nfile')));
    expect((await valid).titulo).toBe('Recurso');
    const invalid = firstValueFrom(service.pdf(52));
    const rejection = expect(invalid).rejects.toThrow('no devolvió un archivo válido');
    http.expectOne(URL_FILE).flush(fakeBlob(new TextEncoder().encode('<html>Iniciar sesión</html>'), 'text/html'));
    await rejection;
  });
  it('propaga HTTP 403 del archivo y no acepta Office como PDF', async () => {
    await expect(firstValueFrom(service.pdf(52))).rejects.toThrow('no es un PDF');
    detail.mockReturnValue(of({ ...ITEM, tipo: 'PDF' }));
    const pdf = firstValueFrom(service.pdf(52)); const rejection = expect(pdf).rejects.toMatchObject({ status: 403 });
    http.expectOne(URL_FILE).flush(null, { status: 403, statusText: 'Forbidden' }); await rejection;
  });
  it('consulta el encabezado nativo de video y conserva la URL real para streaming', async () => {
    detail.mockReturnValue(of({ ...ITEM, tipo: 'VIDEO' }));
    const probe = native.probe.mockResolvedValue({ name: 'video.mp4', mime: 'video/mp4' });
    const result = await firstValueFrom(service.preview(52));
    expect(result.url).toBe(URL_FILE); expect(probe).toHaveBeenCalledWith({ url: URL_FILE, title: 'Recurso', kind: 'VIDEO' });
  });
  it('rechaza mezclar archivos tras un cambio de sesión', async () => {
    let resolve!: (value: { name: string; mime: string }) => void;
    detail.mockReturnValue(of({ ...ITEM, tipo: 'IMAGEN' }));
    native.probe.mockReturnValue(new Promise(done => { resolve = done; }));
    const pending = firstValueFrom(service.preview(52)); role = 'Visitante';
    const rejected = expect(pending).rejects.toMatchObject({ status: 403 }); resolve({ name: 'a.png', mime: 'image/png' }); await rejected;
  });
  it('traduce los errores del archivo a mensajes para el usuario', () => {
    expect(materialFileError(new HttpErrorResponse({ status: 403 }))).toContain('Contenido no disponible para este usuario');
    expect(materialFileError(new HttpErrorResponse({ status: 404 }))).toBe('El archivo ya no está disponible.');
    expect(materialFileError(new HttpErrorResponse({ status: 0 }))).toContain('No fue posible obtener el archivo');
    expect(materialFileError(new Error('Archivo vacío o demasiado grande.'))).toBe('Archivo vacío o demasiado grande.');
    expect(materialFileError('desconocido')).toContain('Intenta nuevamente');
  });
  it('en el navegador muestra la imagen desde un blob validado', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('web');
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:imagen');
    detail.mockReturnValue(of({ ...ITEM, tipo: 'IMAGEN', url: 'https://res.cloudinary.com/demo/image/upload/foto.png' }));
    const result = firstValueFrom(service.preview(52));
    await vi.waitFor(() => http.expectOne('https://res.cloudinary.com/demo/image/upload/foto.png').flush(fakeBlob(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image/png')));
    expect(await result).toMatchObject({ url: 'blob:imagen', mime: 'image/png' });
    expect(createUrl).toHaveBeenCalled();
  });
  it('en el navegador valida el inicio del video sin descargarlo completo', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('web');
    const url = 'https://res.cloudinary.com/demo/video/upload/clase.mp4';
    detail.mockReturnValue(of({ ...ITEM, tipo: 'VIDEO', url }));
    const result = firstValueFrom(service.preview(52));
    await vi.waitFor(() => {
      const request = http.expectOne(url);
      expect(request.request.headers.get('Range')).toBe('bytes=0-511');
      request.flush(new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32]).buffer, { headers: { 'Content-Type': 'video/mp4' } });
    });
    expect(await result).toMatchObject({ url, mime: 'video/mp4' });
  });
  it('en el navegador descarga con un enlace temporal y no afirma dónde se guardó', async () => {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('web');
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:archivo');
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    detail.mockReturnValue(of({ ...ITEM, tipo: 'PDF', url: 'https://res.cloudinary.com/demo/image/upload/guia.pdf' }));
    const result = service.download(52, new AbortController().signal);
    await vi.waitFor(() => http.expectOne('https://res.cloudinary.com/demo/image/upload/guia.pdf').flush(fakeBlob(new TextEncoder().encode('%PDF-1.7'))));
    expect(await result).toBeNull();
    expect(click).toHaveBeenCalled();
  });
  it('abre el archivo descargado con el plugin nativo', async () => {
    native.open.mockResolvedValue(undefined);
    await service.open({ uri: 'content://descargas/1', name: 'guia.pdf', mime: 'application/pdf', location: 'Descargas/Tiozihuatl' });
    expect(native.open).toHaveBeenCalledWith({ uri: 'content://descargas/1', mime: 'application/pdf' });
  });
});
describe('Validación y nombre de archivos', () => {
  it('detecta los formatos admitidos incluso con octet-stream', () => {
    const samples: [string, number[], string][] = [
      ['PDF', [37, 80, 68, 70, 45], 'pdf'], ['IMAGEN', [137, 80, 78, 71, 13, 10, 26, 10], 'png'],
      ['IMAGEN', [255, 216, 255], 'jpg'], ['IMAGEN', [82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80], 'webp'],
      ['VIDEO', [0, 0, 0, 24, 102, 116, 121, 112, 109, 112, 52, 50], 'mp4'], ['VIDEO', [26, 69, 223, 163], 'webm'],
      ['VIDEO', [0, 0, 0, 24, 102, 116, 121, 112, 113, 116, 32, 32], 'mov'],
      ['WORD', [80, 75, 3, 4], 'docx'], ['EXCEL', [80, 75, 3, 4], 'xlsx'], ['PPT', [80, 75, 3, 4], 'pptx'],
      ['WORD', [208, 207, 17, 224, 161, 177, 26, 225], 'doc'], ['EXCEL', [208, 207, 17, 224, 161, 177, 26, 225], 'xls'], ['PPT', [208, 207, 17, 224, 161, 177, 26, 225], 'ppt'],
      ['ZIP', [80, 75, 3, 4], 'zip'], ['ZIP', [82, 97, 114, 33], 'rar'], ['ZIP', [55, 122, 188, 175, 39, 28], '7z'],
    ];
    for (const [kind, bytes, extension] of samples) {
      const info = validateMaterialBytes(new Uint8Array(bytes), kind, 'application/octet-stream');
      expect(info.extension).toBe(extension);
      expect(validateMaterialBytes(new Uint8Array(bytes), kind, info.mime + '; charset=binary').extension).toBe(extension);
    }
  });
  it('rechaza HTML, JSON, vacíos y formatos incompatibles aunque devuelvan HTTP 200', () => {
    for (const content of ['<html>login</html>', '{"error":"forbidden"}', '', 'not a PDF']) expect(() => validateMaterialBytes(new TextEncoder().encode(content), 'PDF')).toThrow();
    expect(() => validateMaterialBytes(new Uint8Array([255, 216, 255]), 'PDF', 'application/pdf')).toThrow();
    for (const mime of ['text/html', 'application/json', 'application/xml', 'text/xml', 'application/problem+xml']) expect(() => validateMaterialBytes(new TextEncoder().encode('%PDF-1.7'), 'PDF', mime)).toThrow();
  });
  it('conserva el nombre de URL/header, distingue PNG/JPG y Office antiguo/moderno', () => {
    expect(materialFileName(URL_FILE, 'Título', 'pptx')).toBe('Presentacion.pptx');
    expect(materialFileName(URL_FILE + '.ppt', 'Título', 'ppt')).toBe('Presentacion.ppt');
    expect(materialFileName(URL_FILE, 'Título', 'png', "attachment; filename*=UTF-8''Cuadro%20acad%C3%A9mico.png")).toBe('Cuadro académico.png');
    expect(materialFileName(URL_FILE, 'Título', 'docx', 'attachment; filename="../Documento.docx"')).toBe('.._Documento.docx');
  });
  it('prefiere el título a identificadores y nombres genéricos sin duplicar extensiones', () => {
    const title = 'Guía de Anatomía.pdf';
    for (const name of ['123456', '550e8400-e29b-41d4-a716-446655440000', 'd41d8cd98f00b204e9800998ecf8427e', 'a9g3j2s8l5m1r6t0v7w4', 'archivo_12', 'documento']) {
      expect(materialFileName(URL_FILE + '/' + name + '.pdf', title, 'pdf')).toBe('Guía de Anatomía.pdf');
      expect(materialFileName(URL_FILE, title, 'pdf', `attachment; filename="${name}.pdf"`)).toBe('Guía de Anatomía.pdf');
    }
    expect(materialFileName(URL_FILE + '/Guia_Anatomia.pdf.pdf', 'Otro título', 'pdf')).toBe('Guia_Anatomia.pdf');
    expect(materialFileName(URL_FILE + '/Guia_Anatomia.PDF', 'Otro título', 'pdf')).toBe('Guia_Anatomia.pdf');
    expect(materialFileName(URL_FILE + '/archivo.doc', 'Informe.doc.doc', 'docx')).toBe('Informe.docx');
    expect(materialFileName(URL_FILE + '/123.png', 'Clase: órganos / sistemas.png', 'png')).toBe('Clase_ órganos _ sistemas.png');
  });

});
describe('Plugin nativo de archivos', () => {
  it('la fábrica expone solo los métodos del plugin y los delega en MaterialFiles', async () => {
    TestBed.configureTestingModule({});
    const plugin = TestBed.inject(MATERIAL_FILES_NATIVE);
    expect(Object.keys(plugin)).toEqual(['probe', 'download', 'cancel', 'open']);
    expect('ngOnDestroy' in plugin).toBe(false);
    // Fuera del celular Capacitor rechaza la llamada: confirma que llega al plugin registrado.
    await expect(plugin.open({ uri: 'content://x', mime: 'application/pdf' })).rejects.toMatchObject({ code: 'UNIMPLEMENTED' });
    expect(MaterialFiles).toBeDefined();
  });
});
