import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AUTH_REPOSITORY } from '../../domain/repositories/auth.repository';
import { HttpAuthRepository } from './http-auth.repository';

const AUTH = `${environment.apiUrl}/auth`;
const PASSWORD = `${environment.apiUrl}/password`;

describe('HttpAuthRepository (capa de datos)', () => {
  let repository: HttpAuthRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    repository = TestBed.inject(HttpAuthRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('es la implementación que entrega el token AUTH_REPOSITORY', () => {
    expect(TestBed.inject(AUTH_REPOSITORY)).toBe(repository);
  });

  it('envía login y refresh por POST con el cuerpo esperado', async () => {
    const login = firstValueFrom(repository.login({ credential: 'ana@correo.com', contrasena: 'x', rolSeleccionado: 'Docente' }));
    const req = http.expectOne(`${AUTH}/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ credential: 'ana@correo.com', contrasena: 'x', rolSeleccionado: 'Docente' });
    req.flush({ accessToken: 'a' });
    expect(await login).toEqual({ accessToken: 'a' });

    const refresh = firstValueFrom(repository.refresh(7, 'r-token'));
    const refreshReq = http.expectOne(`${AUTH}/refresh`);
    expect(refreshReq.request.body).toEqual({ id_usuario: 7, refreshToken: 'r-token' });
    refreshReq.flush({ accessToken: 'b' });
    expect(await refresh).toEqual({ accessToken: 'b' });
  });

  it('cierra sesión con el token de acceso en la cabecera', () => {
    repository.logout(7, 'acceso').subscribe();
    const req = http.expectOne(`${AUTH}/logout`);
    expect(req.request.body).toEqual({ id_usuario: 7 });
    expect(req.request.headers.get('Authorization')).toBe('Bearer acceso');
    req.flush({});
  });

  it('consulta si el correo y el teléfono ya existen', () => {
    repository.emailExists('ana@correo.com').subscribe();
    repository.phoneExists('7711234567').subscribe();
    expect(http.expectOne((r) => r.url === `${AUTH}/check-email`).request.params.get('correo')).toBe('ana@correo.com');
    expect(http.expectOne((r) => r.url === `${AUTH}/check-phone`).request.params.get('telefono')).toBe('7711234567');
    http.match(() => true).forEach((r) => r.flush({ exists: false }));
  });

  it('usa los endpoints del registro en dos pasos', () => {
    repository.preRegister({ nombre: 'Ana', apaterno: 'P', amaterno: 'L', correo: 'ana@correo.com', telefono: '7711234567' }).subscribe();
    repository.finishRegister({ correo: 'ana@correo.com', contrasena: 'x', palabra_secreta: 'y' }).subscribe();
    expect(http.expectOne(`${AUTH}/pre-registro`).request.method).toBe('POST');
    expect(http.expectOne(`${AUTH}/finalizar-registro`).request.method).toBe('POST');
  });

  it('usa los endpoints de recuperación de contraseña', () => {
    repository.forgotPassword({ correo: 'ana@correo.com', palabra_secreta: 'y' }).subscribe();
    repository.validateRecoveryToken('t-123').subscribe();
    repository.resetPassword({ token: 't-123', nuevaContrasena: 'Nueva1!' }).subscribe();
    expect(http.expectOne(`${PASSWORD}/forgot`).request.method).toBe('POST');
    expect(http.expectOne((r) => r.url === `${PASSWORD}/validate`).request.params.get('token')).toBe('t-123');
    expect(http.expectOne(`${PASSWORD}/reset`).request.body).toEqual({ token: 't-123', nuevaContrasena: 'Nueva1!' });
  });
});
