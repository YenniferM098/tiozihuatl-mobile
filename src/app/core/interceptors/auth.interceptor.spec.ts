import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
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
