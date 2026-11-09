import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TimeoutError, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProfileDto, ProfileError } from '../models/profile.models';
import { ProfileService, toProfileError } from './profile.service';
import { SessionService } from './session.service';

const API = `${environment.apiUrl}/users/profile`;

function saveSession(rol = 'Estudiante'): void {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
  localStorage.setItem(
    'tiozihuatl.session',
    JSON.stringify({
      accessToken: `h.${payload}.s`,
      refreshToken: 'r',
      user: { id: 5, id_usuario: 5, nombre: 'Astrid', rol, correo: 'viejo@correo.com', id_semestre: 2 },
    }),
  );
}

const DTO: ProfileDto = {
  id_usuario: 5,
  nombre: 'Astrid  Cireth',
  a_paterno: 'Zamora',
  a_materno: 'Guzmán',
  correo: 'astrid@correo.com',
  telefono: '7711234567',
  matricula: 'IEST0514',
  grupo: 'A',
  carrera: 'Licenciatura en Enfermería',
  semestre: 'Segundo semestre',
  tiene_palabra_secreta: 1,
  estado: 'Activo',
  fecha_registro: '2026-01-15T10:00:00.000Z',
  ultima_conexion: null,
  rol: 'Estudiante',
};

describe('ProfileService - Perfil de usuario', () => {
  let service: ProfileService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    saveSession();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ProfileService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('obtiene el perfil, lo limpia y actualiza nombre y correo en la sesión', async () => {
    const result = firstValueFrom(service.profile());
    http.expectOne(API).flush(DTO);

    const profile = await result;
    expect(profile.fullName).toBe('Astrid Cireth Zamora Guzmán');
    expect(profile.matricula).toBe('IEST0514');
    expect(profile.tienePalabraSecreta).toBe(true);
    expect(profile.ultimaConexion).toBeNull();

    const user = TestBed.inject(SessionService).user();
    expect(user?.correo).toBe('astrid@correo.com');
    expect(user?.nombre).toBe('Astrid Cireth');
  });

  it('envía solo los datos indicados al actualizar', async () => {
    const result = firstValueFrom(service.update({ correo: 'nuevo@correo.com' }));
    const req = http.expectOne(API);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ correo: 'nuevo@correo.com' });
    req.flush({ message: 'Perfil actualizado correctamente.' });

    expect(await result).toBe('Perfil actualizado correctamente.');
  });

  it('traduce el correo duplicado (409) a un mensaje con acentos', async () => {
    const result = firstValueFrom(service.update({ correo: 'otro@correo.com' }));
    http.expectOne(API).flush(
      { error: 'El correo electronico ya esta registrado en otra cuenta.' },
      { status: 409, statusText: 'Conflict' },
    );

    await expect(result).rejects.toMatchObject({
      kind: 'conflict',
      message: 'El correo electrónico ya está registrado en otra cuenta.',
    });
  });

  it('cambia la contraseña con el contrato del backend', async () => {
    const result = firstValueFrom(service.changePassword('Actual1@', 'Nueva12@'));
    const req = http.expectOne(`${API}/change-password`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ contrasenaActual: 'Actual1@', nuevaContrasena: 'Nueva12@' });
    req.flush({ message: 'Contrasena actualizada correctamente.' });

    await result;
  });

  it('informa cuando la contraseña actual es incorrecta', async () => {
    const result = firstValueFrom(service.changePassword('Mala123@', 'Nueva12@'));
    http
      .expectOne(`${API}/change-password`)
      .flush({ error: 'La contrasena actual es incorrecta.' }, { status: 400, statusText: 'Bad Request' });

    await expect(result).rejects.toMatchObject({ kind: 'validation', message: 'La contraseña actual es incorrecta.' });
  });

  it('al eliminar la cuenta descarta la sesión local', async () => {
    const result = firstValueFrom(service.deleteAccount());
    const req = http.expectOne(API);
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'Tu cuenta fue eliminada correctamente.' });

    await result;
    expect(TestBed.inject(SessionService).current).toBeNull();
  });

  it('un rol que no es Visitante no puede eliminar su cuenta (403)', async () => {
    const result = firstValueFrom(service.deleteAccount());
    http.expectOne(API).flush(
      { error: 'Solo las cuentas de tipo Visitante pueden eliminarse desde el perfil.' },
      { status: 403, statusText: 'Forbidden' },
    );

    await expect(result).rejects.toMatchObject({ kind: 'forbidden' });
    expect(TestBed.inject(SessionService).current).not.toBeNull();
  });

  it('informa error de conexión cuando el servidor no responde', async () => {
    const result = firstValueFrom(service.profile());
    http.expectOne(API).error(new ProgressEvent('error'), { status: 0 });

    await expect(result).rejects.toMatchObject({ kind: 'connection' });
  });
});

describe('ProfileService - sin sesión', () => {
  it('no consulta el perfil y pide iniciar sesión', async () => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(ProfileService);
    const http = TestBed.inject(HttpTestingController);

    await expect(firstValueFrom(service.profile())).rejects.toMatchObject({ kind: 'session' });
    http.expectNone(API);
    http.verify();
  });
});

describe('toProfileError - mensajes claros sin detalles técnicos', () => {
  const http = (status: number, error: unknown = null) => new HttpErrorResponse({ status, error });

  it('clasifica cada respuesta del servidor', () => {
    expect(toProfileError(new TimeoutError()).kind).toBe('connection');
    expect(toProfileError(http(503)).kind).toBe('connection');
    expect(toProfileError(http(401))).toMatchObject({ kind: 'session', message: 'Tu sesión expiró. Inicia sesión nuevamente.' });
    expect(toProfileError(http(403)).message).toBe('Esta acción no está disponible para tu cuenta.');
    expect(toProfileError(http(409)).message).toBe('Revisa los datos ingresados.');
    expect(toProfileError(http(500))).toMatchObject({ kind: 'server', message: 'Ocurrió un problema en el servidor. Intenta más tarde.' });
    expect(toProfileError(new Error('cualquier cosa')).kind).toBe('server');
  });

  it('agrega acentos a los mensajes conocidos y conserva los demás', () => {
    expect(toProfileError(http(409, { error: 'El telefono ya esta registrado' })).message).toBe(
      'El número de teléfono ya está registrado en otra cuenta.',
    );
    expect(toProfileError(http(400, { error: 'La palabra secreta debe tener entre 4 y 10' })).message).toBe(
      'La palabra secreta debe tener entre 4 y 10 caracteres.',
    );
    expect(toProfileError(http(400, { error: '  Dato no válido  ' })).message).toBe('Dato no válido');
  });

  it('un error ya traducido se conserva', () => {
    const error = new ProfileError('validation', 'Mensaje');
    expect(toProfileError(error)).toBe(error);
  });
});
