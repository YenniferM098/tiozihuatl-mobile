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

  describe('errores comunes del registro', () => {
    const casos: { status: number; error: object; mensaje: string }[] = [
      { status: 503, error: {}, mensaje: 'No fue posible enviar el correo de verificación en este momento. Intenta nuevamente en unos minutos.' },
      { status: 502, error: {}, mensaje: 'No fue posible conectar con el servidor. Revisa tu conexión e intenta nuevamente.' },
      { status: 400, error: {}, mensaje: 'Revisa los datos ingresados.' },
      { status: 409, error: { error: 'El teléfono ya está registrado.' }, mensaje: 'El teléfono ya está registrado.' },
      { status: 429, error: {}, mensaje: 'Realizaste demasiados intentos. Espera un momento e intenta nuevamente.' },
      { status: 500, error: {}, mensaje: 'Ocurrió un problema en el servidor. Intenta más tarde.' },
    ];

    for (const caso of casos) {
      it(`traduce el estado ${caso.status} de la consulta de correo y teléfono`, async () => {
        const result = firstValueFrom(service.checkContactAvailability(DATOS.correo, DATOS.telefono));

        http.expectOne((r) => r.url === `${API}/check-email`).flush(caso.error, { status: caso.status, statusText: 'Error' });
        http.match((r) => r.url === `${API}/check-phone`);

        await expect(result).rejects.toEqual(new AuthError(caso.mensaje));
      });
    }

    it('usa mensajes por defecto cuando el backend no envía texto', async () => {
      const pre = firstValueFrom(service.preRegister(DATOS));
      http.expectOne(`${API}/pre-registro`).flush({});
      expect(await pre).toEqual({
        kind: 'sent',
        message: 'Te enviamos un enlace para verificar tu correo. Puede tardar unos minutos.',
        retryAfterSeconds: 300,
      });

      const fin = firstValueFrom(service.finishRegister({ correo: DATOS.correo, contrasena: 'Segura1!', palabra_secreta: 'tiozi' }));
      http.expectOne(`${API}/finalizar-registro`).flush({});
      expect(await fin).toBe('Cuenta creada exitosamente.');
    });
  });
});
