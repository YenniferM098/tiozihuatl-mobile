import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthUser, UserRole } from '../../core/models/auth.models';
import { OnboardingService } from '../../core/services/onboarding.service';
import { SessionService } from '../../core/services/session.service';
import { TabsPage } from './tabs.page';

describe('TabsPage (HU-02 control de acceso por rol)', () => {
  const user = signal<AuthUser | null>(null);

  beforeEach(() => localStorage.clear());

  function pestañas(rol: UserRole | null): string[] {
    user.set(rol ? { id: 1, id_usuario: 1, rol, correo: 'a@b.com', id_semestre: null } : null);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: SessionService, useValue: { user } }] });
    const page = TestBed.runInInjectionContext(() => new TabsPage());
    return page.tabs().map((t) => t.tab);
  }

  it.each<UserRole>(['Estudiante', 'Docente'])('el rol %s ve las 5 opciones', (rol) => {
    expect(pestañas(rol)).toEqual(['home', 'biblioteca', 'revistas', 'materiales', 'perfil']);
  });

  it('el Visitante no ve Biblioteca ni Materiales', () => {
    expect(pestañas('Visitante')).toEqual(['home', 'revistas', 'perfil']);
  });

  it('sin usuario solo se muestran las opciones públicas', () => {
    expect(pestañas(null)).toEqual(['home', 'revistas', 'perfil']);
  });
});

describe('TabsPage (MEJ-01 guía de primer uso)', () => {
  const user = signal<AuthUser | null>(null);
  let eventos: Subject<unknown>;
  let url: string;

  beforeEach(() => localStorage.clear());

  function abrirPestañas(rol: UserRole, primerInicio: boolean): { page: TabsPage; onboarding: OnboardingService } {
    user.set({ id: 1, id_usuario: 1, rol, correo: 'a@b.com', id_semestre: null });
    eventos = new Subject();
    url = '/home';
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SessionService, useValue: { user } },
        { provide: Router, useValue: { events: eventos, get url() { return url; } } },
      ],
    });
    const onboarding = TestBed.inject(OnboardingService);
    if (primerInicio) onboarding.markGuidePendingIfNew();
    const page = TestBed.runInInjectionContext(() => new TabsPage());
    return { page, onboarding };
  }

  function navegar(destino: string): void {
    url = destino;
    eventos.next(new NavigationEnd(1, destino, destino));
  }

  it('muestra la guía después del primer inicio de sesión señalando Inicio', () => {
    const { page } = abrirPestañas('Estudiante', true);
    expect(page.showGuide()).toBe(true);
    expect(page.guideSteps().map((p) => p.objetivo)).toEqual(['ion-tab-button[tab="home"]']);
  });

  it('al Visitante también le señala Inicio, sin mencionar módulos que no tiene', () => {
    const { page } = abrirPestañas('Visitante', true);
    expect(page.guideSteps().map((p) => p.titulo)).toEqual(['Inicio']);
    expect(page.guideSteps()[0].texto).not.toMatch(/Biblioteca|Materiales/);
  });

  it('al cerrar la guía no vuelve a mostrarse', () => {
    const { page, onboarding } = abrirPestañas('Docente', true);
    page.closeGuide();
    expect(page.showGuide()).toBe(false);

    onboarding.markGuidePendingIfNew();
    expect(page.showGuide()).toBe(false);
  });

  it('con una sesión que ya existía antes de esta versión no se muestra ninguna guía', () => {
    const { page } = abrirPestañas('Estudiante', false);
    expect(page.showGuide()).toBe(false);
    navegar('/biblioteca');
    expect(page.moduleGuide()).toBeNull();
  });

  it('la primera vez que entra a un módulo muestra su guía, y no se repite', () => {
    const { page } = abrirPestañas('Estudiante', true);
    navegar('/biblioteca');
    expect(page.moduleGuide()).toBeNull();

    page.closeGuide();
    navegar('/biblioteca');
    expect(page.moduleGuide()?.module).toBe('biblioteca');

    page.closeModuleGuide('biblioteca');
    expect(page.moduleGuide()).toBeNull();
    navegar('/home');
    navegar('/biblioteca');
    expect(page.moduleGuide()).toBeNull();
  });

  it('si la guía de la barra se cierra dentro de un módulo, sigue la de ese módulo', () => {
    const { page } = abrirPestañas('Visitante', true);
    url = '/revistas';
    page.closeGuide();
    expect(page.moduleGuide()?.module).toBe('revistas');
  });

  it('el Visitante no recibe guías de módulos que no tiene', () => {
    const { page } = abrirPestañas('Visitante', true);
    page.closeGuide();
    navegar('/materiales');
    expect(page.moduleGuide()).toBeNull();
  });
});
