import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MagazineFilesService, isMagazinePdfUrl } from './magazine-files.service';
import { SessionService } from './session.service';

const API = `${environment.apiUrl}/magazines`;
const PDF_URL = 'https://res.cloudinary.com/demo/image/upload/magazines/revistas/salud.pdf';

function saveSession(id = 9): void {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
  localStorage.setItem(
    'tiozihuatl.session',
    JSON.stringify({ accessToken: `h.${payload}.s`, refreshToken: 'r', user: { id, id_usuario: id, nombre: 'Ana', rol: 'Visitante' } }),
  );
}

/** ArrayBuffer con el texto indicado (HttpTestingController solo acepta ArrayBuffer propios). */
function bytes(text: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(text);
  const buffer = new ArrayBuffer(encoded.length);
  new Uint8Array(buffer).set(encoded);
  return buffer;
}

function pdfBytes(): ArrayBuffer {
  return bytes('%PDF-1.7\n%contenido');
}

describe('MagazineFilesService - archivo protegido de la revista', () => {
  let service: MagazineFilesService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    saveSession();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(MagazineFilesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('es la fuente del lector para Revistas, con su ruta y su progreso separados', () => {
    expect(service.detailPath).toBe('/revistas');
    expect(service.progressPrefix).toBe('revista.');
  });

  it('pide el archivo autorizado, lo descarga sin token y entrega el título del catálogo', async () => {
    const result = firstValueFrom(service.pdf(3));
    const secure = http.expectOne(`${API}/secure-pdf/3`);
    expect(secure.request.method).toBe('GET');
    secure.flush({ url: PDF_URL });
    http.expectOne(API).flush({ data: [{ id_magazine: 3, titulo: 'Salud comunitaria', descripcion: null, precio: 10 }] });

    const file = http.expectOne(PDF_URL);
    expect(file.request.responseType).toBe('arraybuffer');
    expect(file.request.headers.has('Authorization')).toBe(false);
    file.flush(pdfBytes());

    const { data, titulo } = await result;
    expect(titulo).toBe('Salud comunitaria');
    expect(new TextDecoder().decode(data).startsWith('%PDF-')).toBe(true);
  });

  it('una revista no adquirida (403) no se descarga e informa que solo se leen las adquiridas', async () => {
    const result = firstValueFrom(service.pdf(4));
    http.expectOne(`${API}/secure-pdf/4`).flush({ error: 'Access denied' }, { status: 403, statusText: 'Forbidden' });
    http.expectOne(API).flush({ data: [] });

    await expect(result).rejects.toMatchObject({ kind: 'forbidden', message: 'Solo puedes leer las revistas que adquiriste.' });
    http.expectNone(PDF_URL);
  });

  it('rechaza direcciones que no son un PDF https de Cloudinary sin descargarlas', async () => {
    for (const url of ['http://res.cloudinary.com/demo/image/upload/a.pdf', 'https://evil.example.com/a.pdf', 'javascript:alert(1)', null]) {
      const result = firstValueFrom(service.pdf(3));
      http.expectOne(`${API}/secure-pdf/3`).flush({ url });
      http.match(API).forEach((r) => r.flush({ data: [] }));
      await expect(result).rejects.toMatchObject({ kind: 'unavailable' });
    }
  });

  it('rechaza un archivo que no es PDF', async () => {
    const result = firstValueFrom(service.pdf(3));
    http.expectOne(`${API}/secure-pdf/3`).flush({ url: PDF_URL });
    http.expectOne(API).flush({ data: [] });
    http.expectOne(PDF_URL).flush(bytes('<html>error</html>'));

    await expect(result).rejects.toMatchObject({ kind: 'unavailable', message: 'El archivo de esta revista no está disponible.' });
  });

  it('si el catálogo falla usa un título genérico', async () => {
    const result = firstValueFrom(service.pdf(3));
    http.expectOne(`${API}/secure-pdf/3`).flush({ url: PDF_URL });
    http.expectOne(API).flush(null, { status: 500, statusText: 'Error' });
    http.expectOne(PDF_URL).flush(pdfBytes());

    expect((await result).titulo).toBe('Revista digital');
  });

  it('no entrega el archivo si la sesión cambió durante la descarga', async () => {
    const result = firstValueFrom(service.pdf(3));
    http.expectOne(`${API}/secure-pdf/3`).flush({ url: PDF_URL });
    http.expectOne(API).flush({ data: [] });
    // Otra cuenta inicia sesión mientras se descarga el archivo.
    const session = TestBed.inject(SessionService);
    session.save({ ...session.current!, user: { ...session.current!.user, id: 15, id_usuario: 15 } });
    http.expectOne(PDF_URL).flush(pdfBytes());

    await expect(result).rejects.toMatchObject({ kind: 'session' });
  });

  it('un identificador no válido no consulta al servidor', async () => {
    await expect(firstValueFrom(service.pdf(0))).rejects.toMatchObject({ kind: 'notFound' });
  });

  it('informa error de conexión cuando el servidor no responde', async () => {
    const result = firstValueFrom(service.pdf(3));
    http.expectOne(`${API}/secure-pdf/3`).error(new ProgressEvent('error'), { status: 0 });
    http.match(API).forEach((r) => r.flush({ data: [] }));
    await expect(result).rejects.toMatchObject({ kind: 'connection' });
  });
});

describe('MagazineFilesService - sin sesión', () => {
  it('no pide el archivo y pide iniciar sesión', async () => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);

    await expect(firstValueFrom(TestBed.inject(MagazineFilesService).pdf(3))).rejects.toMatchObject({ kind: 'session' });
    http.expectNone(`${API}/secure-pdf/3`);
    http.verify();
  });
});

describe('MagazineFilesService - mensajes del lector', () => {
  it('traduce cada error a un mensaje propio de Revistas, sin detalles técnicos', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(MagazineFilesService);
    expect(service.errorMessage(new HttpErrorResponse({ status: 403 }))).toBe('Solo puedes leer las revistas que adquiriste.');
    expect(service.errorMessage(new HttpErrorResponse({ status: 0 }))).toContain('No fue posible conectar');
    expect(service.errorMessage(new Error('ENOTFOUND res.cloudinary.com'))).toBe('Ocurrió un problema en el servidor. Intenta más tarde.');
  });
});

describe('isMagazinePdfUrl', () => {
  it('solo acepta PDF https de Cloudinary sin credenciales', () => {
    expect(isMagazinePdfUrl('https://res.cloudinary.com/demo/image/upload/v1/r.pdf')).toBe(true);
    expect(isMagazinePdfUrl('https://res.cloudinary.com/demo/raw/upload/r.pdf?_a=1')).toBe(true);
    expect(isMagazinePdfUrl('https://res.cloudinary.com/demo/image/upload/r.jpg')).toBe(false);
    expect(isMagazinePdfUrl('https://user:pass@res.cloudinary.com/demo/image/upload/r.pdf')).toBe(false);
    expect(isMagazinePdfUrl('https://res.cloudinary.com:8443/demo/image/upload/r.pdf')).toBe(false);
    expect(isMagazinePdfUrl('no es url')).toBe(false);
  });
});
