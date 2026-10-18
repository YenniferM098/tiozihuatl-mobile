import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { authGuard, memberGuard } from '../../core/guards/auth.guard';
import { SessionService } from '../../core/services/session.service';
import { routes } from '../../app.routes';

describe('Biblioteca: acceso directo y roles', () => {
  let role: string | undefined;
  beforeEach(() => TestBed.configureTestingModule({ providers: [
    provideRouter([]), { provide: SessionService, useValue: { user: () => role ? { rol: role } : null } },
  ] }));
  for (const permitted of ['Estudiante', 'Docente']) {
    it(`permite ${permitted}`, () => {
      role = permitted;
      expect(TestBed.runInInjectionContext(() => memberGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot))).toBe(true);
    });
  }
  for (const denied of ['Visitante', undefined]) {
    it(`redirige ${denied ?? 'sesión ausente'} a Inicio`, () => {
      role = denied;
      const result = TestBed.runInInjectionContext(() => memberGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as UrlTree;
      expect(TestBed.inject(Router).serializeUrl(result)).toBe('/home');
    });
  }
  it('protege catálogo y detalle incluso al navegar entre hijos', () => {
    const tabs = routes.find(route => route.children?.some(child => child.path === 'biblioteca'));
    const library = tabs?.children?.find(route => route.path === 'biblioteca');
    expect(library?.canActivate).toEqual([authGuard, memberGuard]);
    expect(library?.canActivateChild).toEqual([authGuard, memberGuard]);
    expect(library?.children?.map(route => route.path)).toEqual(['', ':id']);
  });
});
