import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  Observable,
  TimeoutError,
  catchError,
  finalize,
  forkJoin,
  map,
  of,
  shareReplay,
  tap,
  throwError,
  timeout,
} from 'rxjs';
import { AUTH_REPOSITORY } from '../../domain/repositories/auth.repository';
import { AuthSession, LoginRequest } from '../models/auth.models';
import { ForgotPasswordRequest, ResetPasswordRequest } from '../models/password.models';
import { FinishRegisterRequest, PreRegisterRequest, PreRegisterResult } from '../models/register.models';
import { SessionService } from './session.service';

/** Render (plan gratuito) puede tardar cerca de un minuto en despertar el servidor. */
const REQUEST_TIMEOUT_MS = 60_000;
/** Espera entre reenvíos del correo de verificación que aplica el backend (5 min). */
const VERIFICATION_COOLDOWN_SECONDS = 300;
const CONNECTION_ERROR = 'No fue posible conectar con el servidor. Revisa tu conexión e intenta nuevamente.';
const SERVER_ERROR = 'Ocurrió un problema en el servidor. Intenta más tarde.';

/** Error ya traducido a un mensaje apto para mostrarse al usuario. */
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly repository = inject(AUTH_REPOSITORY);
  private readonly session = inject(SessionService);

  private refreshRequest$: Observable<boolean> | null = null;

  login(data: LoginRequest): Observable<AuthSession> {
    return this.repository.login(data).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      map((res) => {
        if (!res?.accessToken || !res?.refreshToken || !res?.user) {
          throw new AuthError('No fue posible iniciar sesión. Intenta nuevamente.');
        }
        return { accessToken: res.accessToken, refreshToken: res.refreshToken, user: res.user };
      }),
      tap((session) => this.session.save(session)),
      catchError((err) => throwError(() => this.toAuthError(err))),
    );
  }

  /**
   * Garantiza que exista una sesión con access token vigente.
   * Si expiró, intenta renovarlo con el refresh token; si no se puede, limpia la sesión.
   */
  ensureValidSession(): Observable<boolean> {
    const current = this.session.current;
    if (!current) return of(false);
    if (!this.session.isAccessTokenExpired()) return of(true);
    return this.refresh();
  }

  refresh(): Observable<boolean> {
    if (this.refreshRequest$) return this.refreshRequest$;

    const current = this.session.current;
    if (!current) return of(false);

    this.refreshRequest$ = this.repository
      .refresh(current.user.id_usuario, current.refreshToken)
      .pipe(
        timeout(REQUEST_TIMEOUT_MS),
        map((res) => {
          // La respuesta de refresh no incluye el nombre; se conserva el que ya teníamos.
          this.session.save({
            accessToken: res.accessToken,
            refreshToken: res.refreshToken,
            user: { ...current.user, ...res.user },
          });
          return true;
        }),
        catchError((err) => {
          // Solo se descarta la sesión si el servidor la rechazó; sin conexión se conserva.
          if (err instanceof HttpErrorResponse && err.status >= 400 && err.status < 500) {
            this.session.clear();
          }
          return of(false);
        }),
        finalize(() => (this.refreshRequest$ = null)),
        shareReplay(1),
      );

    return this.refreshRequest$;
  }

  /** Cierra la sesión local y avisa al backend sin bloquear al usuario si falla. */
  logout(): void {
    const current = this.session.current;
    this.session.clear();
    if (!current) return;

    this.repository
      .logout(current.user.id_usuario, current.accessToken)
      .pipe(timeout(REQUEST_TIMEOUT_MS), catchError(() => of(null)))
      .subscribe();
  }

  // ============================================================
  // Registro de visitante (mismo flujo que la plataforma web)
  // ============================================================

  /** Indica si el correo y el teléfono ya pertenecen a una cuenta existente. */
  checkContactAvailability(correo: string, telefono: string): Observable<{ emailTaken: boolean; phoneTaken: boolean }> {
    const email$ = this.repository.emailExists(correo);
    const phone$ = this.repository.phoneExists(telefono);

    return forkJoin([email$, phone$]).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      map(([email, phone]) => ({ emailTaken: !!email?.exists, phoneTaken: !!phone?.exists })),
      catchError((err) => throwError(() => this.toRegisterError(err))),
    );
  }

  /** Paso 1: guarda los datos personales y solicita el correo de verificación. */
  preRegister(data: PreRegisterRequest): Observable<PreRegisterResult> {
    return this.repository.preRegister(data).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      map(
        (res): PreRegisterResult => ({
          kind: 'sent',
          message:
            res?.message ||
            'Te enviamos un enlace para verificar tu correo. Puede tardar unos minutos.',
          retryAfterSeconds: Number(res?.retryAfterSeconds) || VERIFICATION_COOLDOWN_SECONDS,
        }),
      ),
      catchError((err) => {
        // El backend responde 429 si el enlace ya se envió hace poco y 409 si el correo ya se verificó;
        // en ambos casos el usuario puede continuar con el registro.
        if (err instanceof HttpErrorResponse && err.status === 429) {
          const retry = Number(err.error?.retryAfterSeconds ?? err.headers?.get('Retry-After'));
          return of<PreRegisterResult>({
            kind: 'cooldown',
            message: 'Ya te enviamos un enlace de verificación. Revisa tu correo, incluida la carpeta de spam.',
            retryAfterSeconds: retry || VERIFICATION_COOLDOWN_SECONDS,
          });
        }
        if (err instanceof HttpErrorResponse && err.status === 409 && err.error?.code === 'EMAIL_ALREADY_VERIFIED') {
          return of<PreRegisterResult>({
            kind: 'alreadyVerified',
            message: 'Tu correo ya fue verificado. Continúa con la seguridad de tu cuenta.',
          });
        }
        return throwError(() => this.toRegisterError(err));
      }),
    );
  }

  /** Paso 2: crea la cuenta de visitante una vez verificado el correo. */
  finishRegister(data: FinishRegisterRequest): Observable<string> {
    return this.repository.finishRegister(data).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      map((res) => res?.message || 'Cuenta creada exitosamente.'),
      catchError((err) => {
        if (
          err instanceof HttpErrorResponse &&
          err.status === 400 &&
          String(err.error?.error ?? '').toLowerCase().includes('pre-registro')
        ) {
          return throwError(
            () =>
              new AuthError(
                'Aún no has verificado tu correo. Abre el enlace que te enviamos y vuelve a intentarlo.',
              ),
          );
        }
        return throwError(() => this.toRegisterError(err));
      }),
    );
  }

  // ============================================================
  // Recuperación de contraseña (mismo flujo que la plataforma web)
  // ============================================================

  /**
   * Paso 1: valida correo + palabra secreta y pide al backend el enlace de recuperación.
   * Devuelve el mensaje general del backend ("Si los datos son correctos, se envió un enlace...").
   */
  requestPasswordRecovery(data: ForgotPasswordRequest): Observable<string> {
    return this.repository.forgotPassword(data).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      map((res) => {
        const message = typeof res?.message === 'string' ? res.message : '';
        // Palabra secreta incorrecta o sin configurar: el backend responde 200 con `error: true`.
        if (res?.error) {
          throw new AuthError(message || 'No fue posible validar tus datos. Intenta nuevamente.');
        }
        // Límite de 3 solicitudes cada 5 minutos por correo.
        if (message.toLowerCase().includes('varios')) {
          throw new AuthError(message);
        }
        return message || 'Si los datos son correctos, se envió un enlace de recuperación.';
      }),
      catchError((err) => throwError(() => this.toRecoveryError(err))),
    );
  }

  /** Paso 2: indica si el token del enlace de recuperación sigue vigente. */
  validateRecoveryToken(token: string): Observable<boolean> {
    return this.repository
      .validateRecoveryToken(token)
      .pipe(
        timeout(REQUEST_TIMEOUT_MS),
        map((res) => res?.valid === true),
        catchError((err) => {
          if (err instanceof HttpErrorResponse && err.status === 400) return of(false);
          return throwError(() => this.toRecoveryError(err));
        }),
      );
  }

  /** Paso 3: guarda la nueva contraseña usando el token del enlace. */
  resetPassword(data: ResetPasswordRequest): Observable<string> {
    return this.repository.resetPassword(data).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      map((res) => res?.message || 'Contraseña restablecida correctamente.'),
      catchError((err) => throwError(() => this.toRecoveryError(err))),
    );
  }

  /**
   * Traduce los errores de recuperación. Los 503 del envío de correo ya están redactados
   * para el usuario; el 400 de token vencido se reformula para invitar a pedir otro enlace.
   */
  private toRecoveryError(err: unknown): AuthError {
    if (err instanceof AuthError) return err;
    if (err instanceof TimeoutError) return new AuthError(CONNECTION_ERROR);
    if (!(err instanceof HttpErrorResponse)) return new AuthError(SERVER_ERROR);

    const serverMessage = typeof err.error?.error === 'string' ? err.error.error : '';

    switch (true) {
      case err.status === 0:
      case err.status === 502:
      case err.status === 504:
        return new AuthError(CONNECTION_ERROR);
      case err.status === 503:
        return new AuthError(
          serverMessage || 'No fue posible enviar el correo de recuperación. Intenta nuevamente en unos minutos.',
        );
      case err.status === 400 && serverMessage.toLowerCase().includes('enlace'):
        return new AuthError('El enlace es inválido o ha expirado. Solicita uno nuevo.');
      case err.status === 400:
        return new AuthError('Completa los campos obligatorios.');
      case err.status === 429:
        return new AuthError('Realizaste demasiados intentos. Espera un momento e intenta nuevamente.');
      default:
        return new AuthError(SERVER_ERROR);
    }
  }

  /**
   * Traduce los errores del registro. Los mensajes de validación (400) y de conflicto (409)
   * del backend ya están redactados para el usuario; los demás se reemplazan por uno genérico.
   */
  private toRegisterError(err: unknown): AuthError {
    if (err instanceof AuthError) return err;
    if (err instanceof TimeoutError) return new AuthError(CONNECTION_ERROR);
    if (!(err instanceof HttpErrorResponse)) return new AuthError(SERVER_ERROR);

    const serverMessage = typeof err.error?.error === 'string' ? err.error.error : '';

    switch (true) {
      case err.status === 0:
      case err.status === 502:
      case err.status === 504:
        return new AuthError(CONNECTION_ERROR);
      case err.status === 503:
        return new AuthError(
          'No fue posible enviar el correo de verificación en este momento. Intenta nuevamente en unos minutos.',
        );
      case err.status === 400:
        return new AuthError(serverMessage || 'Revisa los datos ingresados.');
      case err.status === 409:
        return new AuthError(serverMessage || 'Este correo ya está registrado.');
      case err.status === 429:
        return new AuthError('Realizaste demasiados intentos. Espera un momento e intenta nuevamente.');
      default:
        return new AuthError(SERVER_ERROR);
    }
  }

  /** Traduce cualquier error de la petición a un mensaje claro, sin detalles técnicos. */
  private toAuthError(err: unknown): AuthError {
    if (err instanceof AuthError) return err;

    if (err instanceof TimeoutError) {
      return new AuthError('No fue posible conectar con el servidor. Revisa tu conexión e intenta nuevamente.');
    }

    if (!(err instanceof HttpErrorResponse)) {
      return new AuthError('No fue posible iniciar sesión. Intenta nuevamente.');
    }

    const serverMessage = String(err.error?.error ?? '').toLowerCase();

    switch (true) {
      case err.status === 0:
      case err.status === 502:
      case err.status === 503:
      case err.status === 504:
        return new AuthError('No fue posible conectar con el servidor. Revisa tu conexión e intenta nuevamente.');
      case err.status === 400:
        return new AuthError('Completa los campos obligatorios.');
      case err.status === 401:
        return new AuthError(
          'Las credenciales ingresadas no son correctas. Verifica también el tipo de usuario seleccionado.',
        );
      case err.status === 403 && serverMessage.includes('rol no coincide'):
        return new AuthError('El tipo de usuario seleccionado no corresponde a esta cuenta.');
      case err.status === 403 && serverMessage.includes('excedido'):
        return new AuthError('Has excedido los intentos permitidos. Tu cuenta fue bloqueada por 15 minutos.');
      case err.status === 403 && serverMessage.includes('bloqueada') && serverMessage.includes('minuto'):
        // El mensaje del backend indica los minutos restantes y es apto para el usuario.
        return new AuthError(String(err.error.error));
      case err.status === 403 && serverMessage.includes('activada'):
        return new AuthError('Tu cuenta aún no ha sido activada. Solicita tu enlace de activación al administrador.');
      case err.status === 403:
        return new AuthError('Tu cuenta está inactiva o bloqueada. Contacta al administrador.');
      case err.status === 429:
        return new AuthError('Realizaste demasiados intentos. Espera un momento e intenta nuevamente.');
      default:
        return new AuthError('Ocurrió un problema en el servidor. Intenta más tarde.');
    }
  }
}
