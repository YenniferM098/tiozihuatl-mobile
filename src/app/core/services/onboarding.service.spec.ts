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
  });
});
