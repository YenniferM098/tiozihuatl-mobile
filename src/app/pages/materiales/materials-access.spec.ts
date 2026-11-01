import { TestBed } from '@angular/core/testing';
import { routes } from '../../app.routes';
import { authGuard, memberGuard } from '../../core/guards/auth.guard';
import { SessionService } from '../../core/services/session.service';
import { TabsPage } from '../tabs/tabs.page';
describe('Materiales: navegación y protección de rutas', () => {
  it('protege tanto listado como detalle al navegar directamente o entre hijos', () => {
    const parent = routes.find(route => route.children?.some(child => child.path === 'materiales'));
    const material = parent?.children?.find(route => route.path === 'materiales');
    expect(material?.canActivate).toEqual([authGuard, memberGuard]);
    expect(material?.canActivateChild).toEqual([authGuard, memberGuard]);
    expect(material?.children?.map(route => route.path)).toEqual(['', ':id']);
  });
  it('protege el lector y el visor al abrir su URL directamente', () => {
    for (const path of ['materiales/:id/lector', 'materiales/:id/visor']) {
      expect(routes.find(route => route.path === path)?.canActivate).toEqual([authGuard, memberGuard]);
    }
  });
  for (const role of ['Estudiante', 'Docente', 'Visitante']) {
    it(`respeta la visibilidad de la pestaña para ${role}`, () => {
      TestBed.configureTestingModule({ providers: [{ provide: SessionService, useValue: { user: () => ({ rol: role }) } }] });
      const tabs = TestBed.runInInjectionContext(() => new TabsPage());
      expect(tabs.tabs().some(tab => tab.tab === 'materiales')).toBe(role !== 'Visitante');
    });
  }
});
