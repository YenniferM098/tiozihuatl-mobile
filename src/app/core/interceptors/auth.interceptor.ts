import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { SessionService } from '../services/session.service';

/** Peticiones que nunca se reintentan tras un 401: el propio inicio de sesión y la renovación. */
const NO_RETRY = ['/auth/login', '/auth/refresh', '/auth/logout'];

/**
 * Agrega el access token a las peticiones hacia la API institucional.
 * Si la API responde 401, renueva el token una sola vez y repite la petición;
 * si la renovación falla, cierra la sesión y lleva al inicio de sesión.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionService);
  const injector = inject(Injector);
  const token = session.current?.accessToken;
  const isApiRequest = req.url.startsWith(environment.apiUrl);

  if (!token || !isApiRequest || req.headers.has('Authorization')) {
    return next(req);
  }

  const withToken = (value: string) => req.clone({ setHeaders: { Authorization: `Bearer ${value}` } });
  const retryable = !NO_RETRY.some((path) => req.url.startsWith(`${environment.apiUrl}${path}`));

  return next(withToken(token)).pipe(
    catchError((error: unknown) => {
      if (!retryable || !(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }
      // Se obtienen aquí para no crear AuthService ni Router en cada petición.
      return injector.get(AuthService).refresh().pipe(
        switchMap((renewed) => {
          const newToken = session.current?.accessToken;
          if (renewed && newToken) return next(withToken(newToken));
          session.clear();
          void injector.get(Router).navigateByUrl('/login', { replaceUrl: true });
          return throwError(() => error);
        }),
      );
    }),
  );
};
