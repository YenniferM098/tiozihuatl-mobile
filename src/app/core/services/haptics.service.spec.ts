import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { ImpactStyle } from '@capacitor/haptics';
import { HapticsService } from './haptics.service';

describe('HapticsService (HU-02 respuesta táctil)', () => {
  let perform: ReturnType<typeof vi.fn>;
  let impact: ReturnType<typeof vi.fn>;

  function crear(platform: string): HapticsService {
    vi.spyOn(Capacitor, 'getPlatform').mockReturnValue(platform);
    TestBed.resetTestingModule();
    const service = TestBed.inject(HapticsService);
    Object.assign(service, { touchFeedback: { perform }, haptics: { impact } });
    return service;
  }

  beforeEach(() => {
    perform = vi.fn().mockResolvedValue(undefined);
    impact = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it('en Android usa la respuesta táctil nativa, ligera por defecto', () => {
    const haptics = crear('android');

    haptics.tap();
    haptics.tap('medium');

    expect(perform).toHaveBeenNthCalledWith(1, { strength: 'light' });
    expect(perform).toHaveBeenNthCalledWith(2, { strength: 'medium' });
    expect(impact).not.toHaveBeenCalled();
  });

  it('en iOS usa el motor háptico con la intensidad equivalente', () => {
    const haptics = crear('ios');

    haptics.tap();
    haptics.tap('medium');

    expect(impact).toHaveBeenNthCalledWith(1, { style: ImpactStyle.Light });
    expect(impact).toHaveBeenNthCalledWith(2, { style: ImpactStyle.Medium });
    expect(perform).not.toHaveBeenCalled();
  });

  it('en el navegador no hace nada', () => {
    crear('web').tap();

    expect(perform).not.toHaveBeenCalled();
    expect(impact).not.toHaveBeenCalled();
  });

  it('si el celular no lo admite, ignora el error sin romper la app', async () => {
    perform.mockRejectedValue(new Error('no disponible'));
    impact.mockRejectedValue(new Error('no disponible'));

    expect(() => crear('android').tap()).not.toThrow();
    expect(() => crear('ios').tap()).not.toThrow();
    await new Promise((r) => setTimeout(r));
  });
});
