import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PreRegisterRequest } from '../models/register.models';
import { AuthError, AuthService } from './auth.service';
import { SessionService } from './session.service';

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

const PASSWORD_API = `${environment.apiUrl}/password`;

/** Token JWT de prueba: solo importa el campo `exp` (segundos). */
function jwt(expSeconds: number): string {
  return `cabecera.${btoa(JSON.stringify({ exp: expSeconds })).replace(/=+$/, '')}.firma`;
}

const USUARIO = { id: 7, id_usuario: 7, nombre: 'Ana', rol: 'Estudiante' as const, correo: 'ana@correo.com', id_semestre: 3 };
const LOGIN = { credential: '20230033', contrasena: 'Segura1!', rolSeleccionado: 'Estudiante' as const };

describe('AuthService - inicio de sesión (HU-02)', () => {
  let service: AuthService;
  let http: HttpTestingController;
  let session: SessionService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    session = TestBed.inject(SessionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('login', () => {
    it('envía credencial, contraseña y rol, y guarda la sesión con JWT y rol', async () => {
      const result = firstValueFrom(service.login(LOGIN));

      const req = http.expectOne(`${API}/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(LOGIN);
      req.flush({ message: 'ok', accessToken: 'acceso', refreshToken: 'renovar', user: USUARIO });

      expect(await result).toEqual({ accessToken: 'acceso', refreshToken: 'renovar', user: USUARIO });
      expect(session.user()?.rol).toBe('Estudiante');
      expect(session.isAuthenticated()).toBe(true);
    });

    it('rechaza una respuesta sin token y no guarda la sesión', async () => {
      const result = firstValueFrom(service.login(LOGIN));
      http.expectOne(`${API}/login`).flush({ message: 'ok' });

      await expect(result).rejects.toThrow('No fue posible iniciar sesión. Intenta nuevamente.');
      expect(session.isAuthenticated()).toBe(false);
    });

    it.each([
      [401, 'Contraseña incorrecta.', 'Las credenciales ingresadas no son correctas. Verifica también el tipo de usuario seleccionado.'],
      [403, 'El rol no coincide con el usuario.', 'El tipo de usuario seleccionado no corresponde a esta cuenta.'],
      [403, 'Has excedido los intentos permitidos. Tu cuenta fue bloqueada por 15 minutos.', 'Has excedido los intentos permitidos. Tu cuenta fue bloqueada por 15 minutos.'],
      [403, 'Tu cuenta está bloqueada. Intenta en 12 minuto(s).', 'Tu cuenta está bloqueada. Intenta en 12 minuto(s).'],
      [403, 'Tu cuenta aún no ha sido activada.', 'Tu cuenta aún no ha sido activada. Solicita tu enlace de activación al administrador.'],
      [403, 'Tu cuenta está inactiva o bloqueada. Contacta al administrador.', 'Tu cuenta está inactiva o bloqueada. Contacta al administrador.'],
      [400, 'Faltan credenciales o rol.', 'Completa los campos obligatorios.'],
      [429, '', 'Realizaste demasiados intentos. Espera un momento e intenta nuevamente.'],
      [503, '', 'No fue posible conectar con el servidor. Revisa tu conexión e intenta nuevamente.'],
      [500, '', 'Ocurrió un problema en el servidor. Intenta más tarde.'],
    ])('traduce la respuesta %i "%s" a un mensaje claro', async (status, error, mensaje) => {
      const result = firstValueFrom(service.login(LOGIN));
      http.expectOne(`${API}/login`).flush({ error }, { status, statusText: 'Error' });

      await expect(result).rejects.toThrow(new AuthError(mensaje));
    });

    it('avisa cuando no hay conexión', async () => {
      const result = firstValueFrom(service.login(LOGIN));
      http.expectOne(`${API}/login`).error(new ProgressEvent('error'), { status: 0 });

      await expect(result).rejects.toThrow('No fue posible conectar con el servidor.');
    });
  });

  describe('mantener la sesión (token vencido)', () => {
    const guardar = (expSeconds: number) =>
      session.save({ accessToken: jwt(expSeconds), refreshToken: 'renovar', user: USUARIO });

    it('sin sesión no hay sesión válida', async () => {
      expect(await firstValueFrom(service.ensureValidSession())).toBe(false);
    });

    it('con token vigente no consulta al servidor', async () => {
      guardar(Math.floor(Date.now() / 1000) + 3600);
      expect(await firstValueFrom(service.ensureValidSession())).toBe(true);
    });

    it('con token vencido lo renueva y conserva el nombre del usuario', async () => {
      guardar(Math.floor(Date.now() / 1000) - 60);
      const result = firstValueFrom(service.ensureValidSession());

      const req = http.expectOne(`${API}/refresh`);
      expect(req.request.body).toEqual({ id_usuario: 7, refreshToken: 'renovar' });
      req.flush({ accessToken: 'nuevo', refreshToken: 'nuevo-renovar', user: { id_usuario: 7, rol: 'Estudiante' } });

      expect(await result).toBe(true);
      expect(session.current?.accessToken).toBe('nuevo');
      expect(session.user()?.nombre).toBe('Ana');
    });

    it('comparte una sola renovación entre peticiones simultáneas', async () => {
      guardar(Math.floor(Date.now() / 1000) - 60);
      const a = firstValueFrom(service.refresh());
      const b = firstValueFrom(service.refresh());

      http.expectOne(`${API}/refresh`).flush({ accessToken: 'n', refreshToken: 'r', user: USUARIO });

      expect(await Promise.all([a, b])).toEqual([true, true]);
    });

    it('cierra la sesión si el servidor rechaza la renovación', async () => {
      guardar(Math.floor(Date.now() / 1000) - 60);
      const result = firstValueFrom(service.refresh());
      http.expectOne(`${API}/refresh`).flush({ error: 'Token inválido' }, { status: 401, statusText: 'Unauthorized' });

      expect(await result).toBe(false);
      expect(session.isAuthenticated()).toBe(false);
    });

    it('conserva la sesión si no hay conexión al renovar', async () => {
      guardar(Math.floor(Date.now() / 1000) - 60);
      const result = firstValueFrom(service.refresh());
      http.expectOne(`${API}/refresh`).error(new ProgressEvent('error'), { status: 0 });

      expect(await result).toBe(false);
      expect(session.isAuthenticated()).toBe(true);
    });

    it('refresh sin sesión no consulta al servidor', async () => {
      expect(await firstValueFrom(service.refresh())).toBe(false);
    });
  });

  describe('logout', () => {
    it('borra la sesión y avisa al servidor con el token', () => {
      session.save({ accessToken: 'acceso', refreshToken: 'renovar', user: USUARIO });

      service.logout();

      expect(session.isAuthenticated()).toBe(false);
      const req = http.expectOne(`${API}/logout`);
      expect(req.request.body).toEqual({ id_usuario: 7 });
      expect(req.request.headers.get('Authorization')).toBe('Bearer acceso');
      req.flush({}, { status: 500, statusText: 'Error' });
    });

    it('sin sesión no consulta al servidor', () => {
      service.logout();
      http.expectNone(`${API}/logout`);
    });
  });

  describe('recuperación de contraseña', () => {
    const DATOS_RECUPERACION = { correo: 'ana@correo.com', palabra_secreta: 'tiozi' };

    it('solicita el enlace y devuelve el mensaje del servidor', async () => {
      const result = firstValueFrom(service.requestPasswordRecovery(DATOS_RECUPERACION));
      const req = http.expectOne(`${PASSWORD_API}/forgot`);
      expect(req.request.body).toEqual(DATOS_RECUPERACION);
      req.flush({ message: 'Si los datos son correctos, se envió un enlace.' });

      expect(await result).toBe('Si los datos son correctos, se envió un enlace.');
    });

    it('usa un mensaje por defecto si el servidor no envía texto', async () => {
      const result = firstValueFrom(service.requestPasswordRecovery(DATOS_RECUPERACION));
      http.expectOne(`${PASSWORD_API}/forgot`).flush({});

      expect(await result).toBe('Si los datos son correctos, se envió un enlace de recuperación.');
    });

    it('muestra el error cuando la palabra secreta es incorrecta (200 con error)', async () => {
      const result = firstValueFrom(service.requestPasswordRecovery(DATOS_RECUPERACION));
      http.expectOne(`${PASSWORD_API}/forgot`).flush({ error: true, message: 'La palabra secreta no es correcta.' });

      await expect(result).rejects.toThrow('La palabra secreta no es correcta.');
    });

    it('usa un mensaje por defecto si el error no trae texto', async () => {
      const result = firstValueFrom(service.requestPasswordRecovery(DATOS_RECUPERACION));
      http.expectOne(`${PASSWORD_API}/forgot`).flush({ error: true });

      await expect(result).rejects.toThrow('No fue posible validar tus datos. Intenta nuevamente.');
    });

    it('avisa cuando se pidieron varios enlaces seguidos', async () => {
      const result = firstValueFrom(service.requestPasswordRecovery(DATOS_RECUPERACION));
      http.expectOne(`${PASSWORD_API}/forgot`).flush({ message: 'Has solicitado varios enlaces. Espera 5 minutos.' });

      await expect(result).rejects.toThrow('Has solicitado varios enlaces. Espera 5 minutos.');
    });

    it('valida el token del enlace', async () => {
      const ok = firstValueFrom(service.validateRecoveryToken('abc'));
      http.expectOne((r) => r.url === `${PASSWORD_API}/validate` && r.params.get('token') === 'abc').flush({ valid: true });
      expect(await ok).toBe(true);

      const vencido = firstValueFrom(service.validateRecoveryToken('viejo'));
      http.expectOne((r) => r.url === `${PASSWORD_API}/validate`).flush({ error: 'x' }, { status: 400, statusText: 'Bad' });
      expect(await vencido).toBe(false);

      const caido = firstValueFrom(service.validateRecoveryToken('abc'));
      http.expectOne((r) => r.url === `${PASSWORD_API}/validate`).flush({}, { status: 502, statusText: 'Bad Gateway' });
      await expect(caido).rejects.toThrow('No fue posible conectar con el servidor.');
    });

    it('restablece la contraseña', async () => {
      const result = firstValueFrom(service.resetPassword({ token: 'abc', nuevaContrasena: 'Nueva123!' }));
      const req = http.expectOne(`${PASSWORD_API}/reset`);
      expect(req.request.body).toEqual({ token: 'abc', nuevaContrasena: 'Nueva123!' });
      req.flush({});

      expect(await result).toBe('Contraseña restablecida correctamente.');
    });

    it.each([
      [400, 'El enlace es inválido o ha expirado.', 'El enlace es inválido o ha expirado. Solicita uno nuevo.'],
      [400, 'Faltan datos.', 'Completa los campos obligatorios.'],
      [503, 'No se pudo enviar el correo.', 'No se pudo enviar el correo.'],
      [503, '', 'No fue posible enviar el correo de recuperación. Intenta nuevamente en unos minutos.'],
      [429, '', 'Realizaste demasiados intentos. Espera un momento e intenta nuevamente.'],
      [0, '', 'No fue posible conectar con el servidor. Revisa tu conexión e intenta nuevamente.'],
      [500, '', 'Ocurrió un problema en el servidor. Intenta más tarde.'],
    ])('traduce el error %i "%s" al restablecer', async (status, error, mensaje) => {
      const result = firstValueFrom(service.resetPassword({ token: 'abc', nuevaContrasena: 'Nueva123!' }));
      http.expectOne(`${PASSWORD_API}/reset`).flush({ error }, { status, statusText: 'Error' });

      await expect(result).rejects.toThrow(new AuthError(mensaje));
    });
  });
});
