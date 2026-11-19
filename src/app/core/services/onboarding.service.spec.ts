import { TestBed } from '@angular/core/testing';
import { OnboardingService } from './onboarding.service';

describe('OnboardingService (Bienvenida y guía de primer uso MEJ-01)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  /** Crea el servicio como al abrir la app, leyendo lo que hay guardado. */
  function abrirApp(): OnboardingService {
    TestBed.resetTestingModule();
    return TestBed.inject(OnboardingService);
  }

  it('recuerda que ya se vio la Bienvenida', () => {
    expect(abrirApp().hasSeenWelcome).toBe(false);
    abrirApp().markWelcomeSeen();
    expect(abrirApp().hasSeenWelcome).toBe(true);
  });

  it('el primer inicio de sesión deja la guía pendiente', () => {
    const servicio = abrirApp();
    expect(servicio.guidePending()).toBe(false);

    servicio.markGuidePendingIfNew();
    expect(servicio.guidePending()).toBe(true);
  });

  it('la guía sigue pendiente si se cierra la app sin terminarla', () => {
    abrirApp().markGuidePendingIfNew();
    const reabierta = abrirApp();
    reabierta.settleGuide();
    expect(reabierta.guidePending()).toBe(true);
  });

  it('terminar u omitir la guía la cierra de forma definitiva', () => {
    const servicio = abrirApp();
    servicio.markGuidePendingIfNew();
    servicio.markGuideSeen();
    expect(servicio.guidePending()).toBe(false);

    const despues = abrirApp();
    despues.markGuidePendingIfNew();
    expect(despues.guidePending()).toBe(false);
  });

  it('quien ya tenía sesión antes de esta versión no ve la guía', () => {
    const actualizada = abrirApp();
    actualizada.settleGuide();
    expect(actualizada.guidePending()).toBe(false);

    const otroInicio = abrirApp();
    otroInicio.markGuidePendingIfNew();
    expect(otroInicio.guidePending()).toBe(false);
  });

  it('la guía de cada módulo aparece después de la de la barra y una sola vez', () => {
    const servicio = abrirApp();
    servicio.markGuidePendingIfNew();
    expect(servicio.shouldShowModuleGuide('biblioteca')).toBe(false);

    servicio.markGuideSeen();
    expect(servicio.shouldShowModuleGuide('biblioteca')).toBe(true);

    servicio.markModuleGuideSeen('biblioteca');
    expect(servicio.shouldShowModuleGuide('biblioteca')).toBe(false);
    expect(servicio.shouldShowModuleGuide('revistas')).toBe(true);
    expect(abrirApp().shouldShowModuleGuide('biblioteca')).toBe(false);
  });

  it('quien ya tenía sesión antes de esta versión tampoco ve las guías de módulo', () => {
    const actualizada = abrirApp();
    actualizada.settleGuide();
    expect(actualizada.shouldShowModuleGuide('revistas')).toBe(false);
  });

  it('al dejar la bienvenida en una instalación nueva queda pendiente la guía del inicio de sesión', () => {
    const servicio = abrirApp();
    expect(servicio.loginGuidePending()).toBe(false);
    servicio.markWelcomeSeen();
    expect(servicio.loginGuidePending()).toBe(true);
    expect(abrirApp().loginGuidePending()).toBe(true);

    servicio.markLoginGuideSeen();
    expect(servicio.loginGuidePending()).toBe(false);
    expect(abrirApp().loginGuidePending()).toBe(false);
  });

  it('si la bienvenida ya se había visto antes de esta versión no activa la guía del inicio de sesión', () => {
    abrirApp().markWelcomeSeen();
    localStorage.removeItem('tiozihuatl.guia.login');
    const actualizada = abrirApp();
    actualizada.markWelcomeSeen();
    expect(actualizada.loginGuidePending()).toBe(false);
  });

  it('funciona en memoria si el almacenamiento no está disponible', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('sin almacenamiento');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('sin almacenamiento');
    });
    const servicio = abrirApp();
    expect(servicio.hasSeenWelcome).toBe(false);

    servicio.markWelcomeSeen();
    servicio.markGuidePendingIfNew();
    expect(servicio.hasSeenWelcome).toBe(true);
    expect(servicio.guidePending()).toBe(true);

    servicio.markGuideSeen();
    servicio.markModuleGuideSeen('perfil');
    expect(servicio.shouldShowModuleGuide('perfil')).toBe(false);
  });
});
