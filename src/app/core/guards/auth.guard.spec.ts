import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, isObservable, of } from 'rxjs';
import { UserRole } from '../models/auth.models';
import { AuthService } from '../services/auth.service';
import { OnboardingService } from '../services/onboarding.service';
import { SessionService } from '../services/session.service';
import { authGuard, guestGuard, memberGuard, startGuard, welcomeGuard } from './auth.guard';

type Guard = typeof authGuard;

describe('Guardas de navegación (HU-02 Inicio de sesión)', () => {
  let valid: boolean;
  let seenWelcome: boolean;
  let rol: UserRole | null;

  beforeEach(() => {
    valid = false;
    seenWelcome = true;
    rol = null;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { ensureValidSession: () => of(valid) } },
        {
          provide: OnboardingService,
          useValue: {
            get hasSeenWelcome() {
              return seenWelcome;
            },
          },
        },
        { provide: SessionService, useValue: { user: () => (rol ? { rol } : null) } },
      ],
    });
  });

  /** Ejecuta la guarda y devuelve `true` o la ruta a la que redirige. */
  async function run(guard: Guard): Promise<true | string> {
    const result = TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    const value = isObservable(result) ? await firstValueFrom(result as Observable<boolean | UrlTree>) : await result;
    if (value instanceof UrlTree) return TestBed.inject(Router).serializeUrl(value);
    return value as true;
  }

  describe('authGuard', () => {
    it('deja pasar con sesión válida', async () => {
      valid = true;
      expect(await run(authGuard)).toBe(true);
    });

    it('envía al login sin sesión o con sesión vencida', async () => {
      expect(await run(authGuard)).toBe('/login');
    });
  });

  describe('guestGuard', () => {
    it('muestra login y registro a quien no tiene sesión', async () => {
      expect(await run(guestGuard)).toBe(true);
    });

    it('envía a Inicio a quien ya inició sesión', async () => {
      valid = true;
      expect(await run(guestGuard)).toBe('/home');
    });
  });

  describe('startGuard', () => {
    it('con sesión guardada abre Inicio sin pedir credenciales', async () => {
      valid = true;
      expect(await run(startGuard)).toBe('/home');
    });

    it('la primera vez abre la bienvenida', async () => {
      seenWelcome = false;
      expect(await run(startGuard)).toBe('/welcome');
    });

    it('después de la bienvenida abre el login', async () => {
      expect(await run(startGuard)).toBe('/login');
    });
  });

  describe('welcomeGuard', () => {
    it('muestra la bienvenida solo la primera vez', async () => {
      seenWelcome = false;
      expect(await run(welcomeGuard)).toBe(true);
    });

    it('si ya la vio, envía al login', async () => {
      expect(await run(welcomeGuard)).toBe('/login');
    });

    it('con sesión válida envía a Inicio', async () => {
      valid = true;
      expect(await run(welcomeGuard)).toBe('/home');
    });
  });

  describe('memberGuard (control de acceso por rol)', () => {
    it.each<UserRole>(['Estudiante', 'Docente'])('permite Biblioteca y Materiales al rol %s', async (r) => {
      rol = r;
      expect(await run(memberGuard)).toBe(true);
    });

    it('regresa a Inicio al Visitante', async () => {
      rol = 'Visitante';
      expect(await run(memberGuard)).toBe('/home');
    });

    it('regresa a Inicio si no hay usuario', async () => {
      expect(await run(memberGuard)).toBe('/home');
    });
  });
});
