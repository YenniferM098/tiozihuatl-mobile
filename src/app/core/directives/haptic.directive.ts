import { Directive, HostListener, inject, input } from '@angular/core';
import { HapticStrength, HapticsService } from '../services/haptics.service';

/**
 * Agrega respuesta háptica al tocar el elemento.
 * Uso: `<ion-button tzHaptic>` (ligera) o `<ion-button tzHaptic="medium">`.
 */
@Directive({ selector: '[tzHaptic]' })
export class HapticDirective {
  private readonly haptics = inject(HapticsService);
  readonly tzHaptic = input<HapticStrength | ''>('');

  @HostListener('click')
  onTap(): void {
    this.haptics.tap(this.tzHaptic() || 'light');
  }
}
