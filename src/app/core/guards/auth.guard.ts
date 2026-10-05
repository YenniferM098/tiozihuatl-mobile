import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { OnboardingService } from '../services/onboarding.service';

/** Permite el acceso solo con sesión válida; si no, envía al login. */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService)
    .ensureValidSession()
    .pipe(map((valid) => valid || router.createUrlTree(['/login'])));
};

/** Evita mostrar el login a quien ya tiene sesión válida. */
export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  return inject(AuthService)
    .ensureValidSession()
    .pipe(map((valid) => (valid ? router.createUrlTree(['/home']) : true)));
};

/**
 * Decide la pantalla de entrada: con sesión válida va a Home; si es la primera
 * ejecución, a la bienvenida; en otro caso, al login.
 */
export const startGuard: CanActivateFn = () => {
  const router = inject(Router);
  const onboarding = inject(OnboardingService);
  return inject(AuthService)
    .ensureValidSession()
    .pipe(
      map((valid) => {
        if (valid) return router.createUrlTree(['/home']);
        return router.createUrlTree([onboarding.hasSeenWelcome ? '/login' : '/welcome']);
      }),
    );
};

/** La bienvenida solo se muestra una vez y nunca a quien ya tiene sesión. */
export const welcomeGuard: CanActivateFn = () => {
  const router = inject(Router);
  const onboarding = inject(OnboardingService);
  return inject(AuthService)
    .ensureValidSession()
    .pipe(
      map((valid) => {
        if (valid) return router.createUrlTree(['/home']);
        return onboarding.hasSeenWelcome ? router.createUrlTree(['/login']) : true;
      }),
    );
};
