import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PreRegisterRequest } from '../models/register.models';
import { AuthError, AuthService } from './auth.service';

const API = `${environment.apiUrl}/auth`;

const DATOS: PreRegisterRequest = {
  nombre: 'Juan',
  apaterno: 'Pérez',
  amaterno: 'López',
  correo: 'juan@correo.com',
  telefono: '7711234567',
};

describe('AuthService - registro de visitante (HU-01)', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('checkContactAvailability', () => {
    it('consulta correo y teléfono y reporta cuáles ya están registrados', async () => {
      const result = firstValueFrom(service.checkContactAvailability(DATOS.correo, DATOS.telefono));

      http.expectOne((r) => r.url === `${API}/check-email` && r.params.get('correo') === DATOS.correo).flush({ exists: true });
      http.expectOne((r) => r.url === `${API}/check-phone` && r.params.get('telefono') === DATOS.telefono).flush({ exists: false });

      expect(await result).toEqual({ emailTaken: true, phoneTaken: false });
    });
  });

  describe('preRegister', () => {
    it('envía los datos personales y devuelve el mensaje de verificación', async () => {
      const result = firstValueFrom(service.preRegister(DATOS));

      const req = http.expectOne(`${API}/pre-registro`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(DATOS);
      req.flush({ message: 'Te enviamos un correo.', retryAfterSeconds: 120 });

      expect(await result).toEqual({ kind: 'sent', message: 'Te enviamos un correo.', retryAfterSeconds: 120 });
    });

    it('permite continuar cuando el enlace se envió hace poco (429)', async () => {
      const result = firstValueFrom(service.preRegister(DATOS));

      http
        .expectOne(`${API}/pre-registro`)
        .flush({ retryAfterSeconds: 60 }, { status: 429, statusText: 'Too Many Requests' });

      const value = await result;
      expect(value.kind).toBe('cooldown');
      expect(value).toMatchObject({ retryAfterSeconds: 60 });
    });

    it('salta a la seguridad de la cuenta cuando el correo ya fue verificado (409)', async () => {
      const result = firstValueFrom(service.preRegister(DATOS));

      http
        .expectOne(`${API}/pre-registro`)
        .flush({ code: 'EMAIL_ALREADY_VERIFIED' }, { status: 409, statusText: 'Conflict' });

      expect((await result).kind).toBe('alreadyVerified');
    });

    it('muestra el mensaje del backend cuando los datos no son válidos (400)', async () => {
      const result = firstValueFrom(service.preRegister(DATOS));

      http
        .expectOne(`${API}/pre-registro`)
        .flush({ error: 'El nombre no es válido.' }, { status: 400, statusText: 'Bad Request' });

      await expect(result).rejects.toEqual(new AuthError('El nombre no es válido.'));
    });

    it('traduce la falta de conexión a un mensaje claro', async () => {
      const result = firstValueFrom(service.preRegister(DATOS));

      http.expectOne(`${API}/pre-registro`).error(new ProgressEvent('error'), { status: 0 });

      await expect(result).rejects.toBeInstanceOf(AuthError);
      await expect(result).rejects.toHaveProperty('message', expect.stringContaining('conectar con el servidor'));
    });
  });

  describe('finishRegister', () => {
    const body = { correo: DATOS.correo, contrasena: 'Segura1!', palabra_secreta: 'tiozi' };

    it('crea la cuenta y devuelve la confirmación del backend', async () => {
      const result = firstValueFrom(service.finishRegister(body));

      const req = http.expectOne(`${API}/finalizar-registro`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({ success: true, message: 'Cuenta creada exitosamente.' });

      expect(await result).toBe('Cuenta creada exitosamente.');
    });

    it('pide verificar el correo cuando falta el pre-registro', async () => {
      const result = firstValueFrom(service.finishRegister(body));

      http
        .expectOne(`${API}/finalizar-registro`)
        .flush({ error: 'No existe un pre-registro para este correo' }, { status: 400, statusText: 'Bad Request' });

      await expect(result).rejects.toHaveProperty('message', expect.stringContaining('verificado tu correo'));
    });

    it('avisa cuando el correo ya está registrado (409)', async () => {
      const result = firstValueFrom(service.finishRegister(body));

      http.expectOne(`${API}/finalizar-registro`).flush({}, { status: 409, statusText: 'Conflict' });

      await expect(result).rejects.toEqual(new AuthError('Este correo ya está registrado.'));
    });
  });
});
