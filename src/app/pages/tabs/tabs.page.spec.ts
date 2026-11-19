import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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

  beforeEach(() => localStorage.clear());

  function abrirPestañas(rol: UserRole, primerInicio: boolean): { page: TabsPage; onboarding: OnboardingService } {
    user.set({ id: 1, id_usuario: 1, rol, correo: 'a@b.com', id_semestre: null });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: SessionService, useValue: { user } }] });
    const onboarding = TestBed.inject(OnboardingService);
    if (primerInicio) onboarding.markGuidePendingIfNew();
    const page = TestBed.runInInjectionContext(() => new TabsPage());
    return { page, onboarding };
  }

  it('muestra la guía después del primer inicio de sesión con los pasos del rol', () => {
    const { page } = abrirPestañas('Estudiante', true);
    expect(page.showGuide()).toBe(true);
    expect(page.guideSteps().map((p) => p.tab)).toEqual(page.tabs().map((t) => t.tab));
  });

  it('los pasos del Visitante coinciden con sus 3 opciones', () => {
    const { page } = abrirPestañas('Visitante', true);
    expect(page.guideSteps().map((p) => p.tab)).toEqual(['home', 'revistas', 'perfil']);
  });

  it('al cerrar la guía no vuelve a mostrarse', () => {
    const { page, onboarding } = abrirPestañas('Docente', true);
    page.closeGuide();
    expect(page.showGuide()).toBe(false);

    onboarding.markGuidePendingIfNew();
    expect(page.showGuide()).toBe(false);
  });

  it('con una sesión que ya existía antes de esta versión no se muestra', () => {
    const { page } = abrirPestañas('Estudiante', false);
    expect(page.showGuide()).toBe(false);
  });
});
