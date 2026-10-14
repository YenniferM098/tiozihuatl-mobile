import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthUser, UserRole } from '../../core/models/auth.models';
import { SessionService } from '../../core/services/session.service';
import { TabsPage } from './tabs.page';

describe('TabsPage (HU-02 control de acceso por rol)', () => {
  const user = signal<AuthUser | null>(null);

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
