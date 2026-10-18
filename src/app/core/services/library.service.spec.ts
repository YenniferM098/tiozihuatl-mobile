import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { LibraryService, hasDigitalFile, libraryError } from './library.service';

const API = `${environment.apiUrl}/catalog`;
describe('Biblioteca: contratos HTTP y sesión', () => {
  let service: LibraryService;
  let http: HttpTestingController;
  let role: string;
  let valid: boolean;
  beforeEach(() => {
    role = 'Estudiante'; valid = true;
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: AuthService, useValue: { ensureValidSession: () => of(valid) } },
      { provide: SessionService, useValue: { user: () => ({ rol: role }), current: { accessToken: 'session-token' } } },
    ] });
    service = TestBed.inject(LibraryService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('envía búsqueda, filtros y token institucional', async () => {
    const promise = firstValueFrom(service.catalog({ search: '<anatomía>', materia: 'Enfermería', semestre: '2', formato: 'DIGITAL', ordenAutor: 'ASC' }));
    const request = http.expectOne(r => r.url === API);
    expect(request.request.params.get('search')).toBe('<anatomía>');
    expect(request.request.params.get('materia')).toBe('Enfermería');
    expect(request.request.params.get('formato')).toBe('DIGITAL');
    expect(request.request.params.get('semestre')).toBe('2');
    expect(request.request.params.get('ordenAutor')).toBe('ASC');
    expect(request.request.headers.get('Authorization')).toBe('Bearer session-token');
    request.flush([]);
    expect(await promise).toEqual([]);
  });
  it('omite los filtros vacíos', async () => {
    const promise = firstValueFrom(service.catalog({ search: '', materia: '', semestre: '', formato: '', ordenAutor: 'DESC' }));
    const request = http.expectOne(r => r.url === API);
    expect(request.request.params.keys()).toEqual(['ordenAutor']);
    request.flush([]);
    expect(await promise).toEqual([]);
  });
  it('permite al Docente consultar el catálogo', async () => {
    role = 'Docente';
    const promise = firstValueFrom(service.catalog());
    http.expectOne(API).flush([]);
    expect(await promise).toEqual([]);
  });
  it('consulta materias y semestres para los filtros', async () => {
    const subjects = firstValueFrom(service.subjects());
    http.expectOne(`${API}/materias`).flush([{ id: 1, nombre: 'Anatomía' }]);
    expect(await subjects).toEqual([{ id: 1, nombre: 'Anatomía' }]);
    const semesters = firstValueFrom(service.semesters());
    http.expectOne(`${API}/semestres`).flush([{ id_semestre: 1, nombre_semestre: 'Primer semestre' }]);
    expect(await semesters).toEqual([{ id_semestre: 1, nombre_semestre: 'Primer semestre' }]);
  });
  it('rechaza Visitante sin enviar peticiones', async () => {
    role = 'Visitante';
    await expect(firstValueFrom(service.catalog())).rejects.toMatchObject({ status: 403 });
    http.expectNone(API);
  });
  it('rechaza sesión inválida antes de consultar el catálogo', async () => {
    valid = false;
    await expect(firstValueFrom(service.catalog())).rejects.toMatchObject({ status: 403 });
    http.expectNone(API);
  });
  it('identifica el contenido digital autorizado solo si el archivo está en Cloudinary', () => {
    expect(hasDigitalFile({ tiene_digital: 1, pdf_url: 'libros/catalogo-001' })).toBe(true);
    expect(hasDigitalFile({ tiene_digital: 1, pdf_url: 'https://res.cloudinary.com/demo/image/upload/libro.pdf' })).toBe(true);
    expect(hasDigitalFile({ tiene_digital: 1, pdf_url: 'https://biblioteca.example/enfermeria/catalogo-010.pdf' })).toBe(false);
    expect(hasDigitalFile({ tiene_digital: 1, pdf_url: 'https://' })).toBe(false);
    expect(hasDigitalFile({ tiene_digital: 0, pdf_url: 'libros/catalogo-001' })).toBe(false);
    expect(hasDigitalFile({ tiene_digital: 1, pdf_url: null })).toBe(false);
  });
  it('traduce los errores del catálogo a mensajes para el usuario', () => {
    expect(libraryError(new HttpErrorResponse({ status: 401 }))).toContain('Contenido no disponible para este usuario');
    expect(libraryError(new HttpErrorResponse({ status: 403 }))).toContain('Contenido no disponible para este usuario');
    expect(libraryError(new HttpErrorResponse({ status: 404 }))).toBe('El libro no está disponible.');
    expect(libraryError(new HttpErrorResponse({ status: 0 }))).toContain('No fue posible conectar con el servidor');
  });
  it('solo acepta portadas HTTPS de Cloudinary', () => {
    expect(service.safeResource('https://res.cloudinary.com/instituto/image/upload/pg_1/libro.jpg')).toBe(true);
    expect(service.safeResource('http://res.cloudinary.com/instituto/libro.jpg')).toBe(false);
    expect(service.safeResource('https://usuario:clave@res.cloudinary.com/libro.jpg')).toBe(false);
    expect(service.safeResource('https://otro.example/libro.jpg')).toBe(false);
    expect(service.safeResource('no es una URL')).toBe(false);
  });
  it('reutiliza el preview real de una portada sin repetir HTTP y sigue comprobando el rol', async () => {
    const first = firstValueFrom(service.preview(1));
    http.expectOne(`${API}/libros/1/preview`).flush({ previewUrl: 'https://res.cloudinary.com/instituto/image/upload/pg_1/libro.jpg' });
    expect(await first).toEqual(await firstValueFrom(service.preview(1)));
    http.expectNone(`${API}/libros/1/preview`);
    role = 'Visitante';
    await expect(firstValueFrom(service.preview(1))).rejects.toMatchObject({ status: 403 });
  });
  it('permite volver a pedir la portada si el preview falla', async () => {
    const failed = firstValueFrom(service.preview(2));
    http.expectOne(`${API}/libros/2/preview`).flush({}, { status: 500, statusText: 'Error' });
    await expect(failed).rejects.toMatchObject({ status: 500 });
    const retry = firstValueFrom(service.preview(2));
    http.expectOne(`${API}/libros/2/preview`).flush({ previewUrl: 'https://res.cloudinary.com/instituto/image/upload/pg_1/libro2.jpg' });
    expect((await retry).previewUrl).toContain('libro2.jpg');
  });
});
