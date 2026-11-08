import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, TimeoutError, catchError, map, switchMap, tap, throwError, timeout } from 'rxjs';
import { Profile, ProfileDto, ProfileError, ProfileUpdateRequest } from '../models/profile.models';
import { PROFILE_REPOSITORY } from '../../domain/repositories/profile.repository';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

// Render puede tardar en "despertar" el servidor en la primera petición.
const REQUEST_TIMEOUT_MS = 30_000;

const MESSAGES = {
  connection: 'No fue posible conectar con el servidor. Revisa tu conexión e intenta nuevamente.',
  session: 'Tu sesión expiró. Inicia sesión nuevamente.',
  forbidden: 'Esta acción no está disponible para tu cuenta.',
  server: 'Ocurrió un problema en el servidor. Intenta más tarde.',
  validation: 'Revisa los datos ingresados.',
} as const;

/**
 * Mensajes del backend (sin acentos) reescritos para mostrarse al usuario.
 * Se comparan en minúsculas; si no hay coincidencia se usa el mensaje del backend.
 */
const SERVER_MESSAGES: readonly [string, string][] = [
  ['correo electronico ya esta registrado', 'El correo electrónico ya está registrado en otra cuenta.'],
  ['telefono ya esta registrado', 'El número de teléfono ya está registrado en otra cuenta.'],
  ['ya esta registrado', 'Uno de los datos capturados ya está registrado en otra cuenta.'],
  ['contrasena actual es incorrecta', 'La contraseña actual es incorrecta.'],
  ['palabra secreta debe tener', 'La palabra secreta debe tener entre 4 y 10 caracteres.'],
  ['solo las cuentas de tipo visitante', 'Solo las cuentas de Visitante pueden eliminarse desde el perfil.'],
];

/**
 * Casos de uso del perfil: renueva la sesión antes de cada petición, transforma la
 * respuesta para la vista y traduce los errores. Los datos vienen del repositorio.
 * El backend decide qué datos puede modificar cada rol:
 * - Estudiante y Docente: correo, teléfono y palabra secreta.
 * - Visitante: además, nombre y apellidos; también puede eliminar su cuenta.
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly repository = inject(PROFILE_REPOSITORY);
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);

  /** GET /api/users/profile. Mantiene al día el nombre y correo guardados en la sesión. */
  profile(): Observable<Profile> {
    return this.withSession(() => this.repository.profile()).pipe(
      map((dto: ProfileDto) => {
        if (!dto || typeof dto !== 'object') throw new ProfileError('server', MESSAGES.server);
        return toProfile(dto);
      }),
      tap((profile) => this.syncSession(profile)),
    );
  }

  /** PUT /users/profile con los datos personales permitidos o la palabra secreta. */
  update(data: ProfileUpdateRequest): Observable<string> {
    return this.withSession(() => this.repository.update(data)).pipe(
      map((res) => res?.message || 'Perfil actualizado correctamente.'),
    );
  }

  /** El saludo de Inicio y otros módulos leen el nombre y correo de la sesión. */
  private syncSession(profile: Profile): void {
    const current = this.session.current;
    if (!current || current.user.id_usuario !== profile.id) return;
    const { nombre, correo } = current.user;
    if (nombre === profile.nombre && correo === profile.correo) return;
    this.session.save({ ...current, user: { ...current.user, nombre: profile.nombre, correo: profile.correo } });
  }

  /** Renueva el access token si expiró antes de llamar a un endpoint protegido. */
  private withSession<T>(request: () => Observable<T>): Observable<T> {
    return this.auth.ensureValidSession().pipe(
      switchMap((valid) =>
        valid
          ? request().pipe(timeout(REQUEST_TIMEOUT_MS))
          : throwError(() => new ProfileError('session', MESSAGES.session)),
      ),
      catchError((err) => throwError(() => toProfileError(err))),
    );
  }
}

/** Traduce cualquier error a un mensaje claro, sin detalles técnicos. */
export function toProfileError(err: unknown): ProfileError {
  if (err instanceof ProfileError) return err;
  if (err instanceof TimeoutError) return new ProfileError('connection', MESSAGES.connection);
  if (!(err instanceof HttpErrorResponse)) return new ProfileError('server', MESSAGES.server);

  const serverMessage = friendly(typeof err.error?.error === 'string' ? err.error.error : '');
  switch (err.status) {
    case 0:
    case 502:
    case 503:
    case 504:
      return new ProfileError('connection', MESSAGES.connection);
    case 401:
      return new ProfileError('session', MESSAGES.session);
    case 403:
      return new ProfileError('forbidden', serverMessage || MESSAGES.forbidden);
    case 409:
      return new ProfileError('conflict', serverMessage || MESSAGES.validation);
    case 400:
      return new ProfileError('validation', serverMessage || MESSAGES.validation);
    default:
      return new ProfileError('server', MESSAGES.server);
  }
}

function friendly(message: string): string {
  const text = message.toLowerCase();
  return SERVER_MESSAGES.find(([key]) => text.includes(key))?.[1] ?? message.trim();
}

function toProfile(dto: ProfileDto): Profile {
  const nombre = clean(dto.nombre);
  const aPaterno = clean(dto.a_paterno);
  const aMaterno = clean(dto.a_materno);
  return {
    id: Number(dto.id_usuario),
    nombre,
    aPaterno,
    aMaterno,
    fullName: [nombre, aPaterno, aMaterno].filter(Boolean).join(' '),
    correo: clean(dto.correo),
    telefono: clean(dto.telefono),
    matricula: clean(dto.matricula) || null,
    grupo: clean(dto.grupo) || null,
    carrera: clean(dto.carrera) || null,
    semestre: clean(dto.semestre) || null,
    rol: clean(dto.rol),
    estado: clean(dto.estado) || null,
    fechaRegistro: dto.fecha_registro ?? null,
    ultimaConexion: dto.ultima_conexion ?? null,
    tienePalabraSecreta: isTruthy(dto.tiene_palabra_secreta),
  };
}

function isTruthy(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

/** Texto plano: quita etiquetas HTML y espacios repetidos. Angular lo interpola siempre como texto. */
function clean(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
