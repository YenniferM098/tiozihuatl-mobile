import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HapticsService } from '../services/haptics.service';
import { HapticDirective } from './haptic.directive';

@Component({
  imports: [HapticDirective],
  template: `
    <button id="ligero" tzHaptic>Pestaña</button>
    <button id="medio" tzHaptic="medium">Iniciar sesión</button>
  `,
})
class HostComponent {}

describe('HapticDirective (HU-02 respuesta táctil)', () => {
  it('da un toque ligero por defecto y el indicado cuando se pide', async () => {
    const haptics = { tap: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: HapticsService, useValue: haptics }] });
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const html: HTMLElement = fixture.nativeElement;

    html.querySelector<HTMLButtonElement>('#ligero')!.click();
    html.querySelector<HTMLButtonElement>('#medio')!.click();

    expect(haptics.tap).toHaveBeenNthCalledWith(1, 'light');
    expect(haptics.tap).toHaveBeenNthCalledWith(2, 'medium');
  });
});
