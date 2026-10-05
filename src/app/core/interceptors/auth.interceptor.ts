import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { SessionService } from '../services/session.service';

/** Agrega el access token a las peticiones hacia la API institucional. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(SessionService).current?.accessToken;
  const isApiRequest = req.url.startsWith(environment.apiUrl);

  if (!token || !isApiRequest || req.headers.has('Authorization')) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
