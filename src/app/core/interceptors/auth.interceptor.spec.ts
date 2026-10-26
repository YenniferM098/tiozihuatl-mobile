import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { SessionService } from '../services/session.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor (HU-02 Inicio de sesión)', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let session: { current: { accessToken: string } | null };

  beforeEach(() => {
    session = { current: { accessToken: 'token-123' } };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: SessionService, useValue: session },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('agrega el JWT a las peticiones hacia la API', () => {
    http.get(`${environment.apiUrl}/auth/me`).subscribe();

    const req = backend.expectOne(`${environment.apiUrl}/auth/me`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-123');
    req.flush({});
  });

  it('no envía el token a otros dominios', () => {
    http.get('https://res.cloudinary.com/imagen.png').subscribe();

    const req = backend.expectOne('https://res.cloudinary.com/imagen.png');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('no agrega encabezado cuando no hay sesión', () => {
    session.current = null;
    http.get(`${environment.apiUrl}/catalog`).subscribe();

    const req = backend.expectOne(`${environment.apiUrl}/catalog`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('respeta el encabezado que ya trae la petición', () => {
    http.post(`${environment.apiUrl}/auth/logout`, {}, { headers: { Authorization: 'Bearer otro' } }).subscribe();

    const req = backend.expectOne(`${environment.apiUrl}/auth/logout`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer otro');
    req.flush({});
  });
});

describe('authInterceptor: renovación ante 401', () => {
  const API = environment.apiUrl;
  let http: HttpClient;
  let backend: HttpTestingController;
  let session: { current: { accessToken: string } | null; clear: ReturnType<typeof vi.fn> };
  let auth: { refresh: ReturnType<typeof vi.fn> };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    session = { current: { accessToken: 'vencido' }, clear: vi.fn(() => (session.current = null)) };
    auth = {
      refresh: vi.fn(() => {
        session.current = { accessToken: 'nuevo' };
        return of(true);
      }),
    };
    router = { navigateByUrl: vi.fn().mockResolvedValue(true) };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: SessionService, useValue: session },
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  const unauthorized = { status: 401, statusText: 'Unauthorized' };

  it('renueva el token y repite la petición una vez', () => {
    let body: unknown;
    http.get(`${API}/catalog`).subscribe((value) => (body = value));

    backend.expectOne(`${API}/catalog`).flush({}, unauthorized);
    const retry = backend.expectOne(`${API}/catalog`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer nuevo');
    retry.flush(['ok']);

    expect(auth.refresh).toHaveBeenCalledTimes(1);
    expect(body).toEqual(['ok']);
  });

  it('cierra la sesión y abre el inicio de sesión si no se puede renovar', () => {
    auth.refresh.mockReturnValue(of(false));
    let status = 0;
    http.get(`${API}/catalog`).subscribe({ error: (e: HttpErrorResponse) => (status = e.status) });

    backend.expectOne(`${API}/catalog`).flush({}, unauthorized);

    expect(status).toBe(401);
    expect(session.clear).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });

  it('no reintenta si el reintento también responde 401', () => {
    let status = 0;
    http.get(`${API}/catalog`).subscribe({ error: (e: HttpErrorResponse) => (status = e.status) });

    backend.expectOne(`${API}/catalog`).flush({}, unauthorized);
    backend.expectOne(`${API}/catalog`).flush({}, unauthorized);

    expect(status).toBe(401);
    expect(auth.refresh).toHaveBeenCalledTimes(1);
  });

  it.each(['/auth/login', '/auth/refresh'])('no intenta renovar en %s', (path) => {
    let status = 0;
    http.post(`${API}${path}`, {}).subscribe({ error: (e: HttpErrorResponse) => (status = e.status) });

    backend.expectOne(`${API}${path}`).flush({}, unauthorized);

    expect(status).toBe(401);
    expect(auth.refresh).not.toHaveBeenCalled();
  });

  it('deja pasar los demás errores sin renovar', () => {
    let status = 0;
    http.get(`${API}/catalog`).subscribe({ error: (e: HttpErrorResponse) => (status = e.status) });

    backend.expectOne(`${API}/catalog`).flush({}, { status: 500, statusText: 'Error' });

    expect(status).toBe(500);
    expect(auth.refresh).not.toHaveBeenCalled();
  });
});
