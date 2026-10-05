import { Injectable } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export type HapticStrength = 'light' | 'medium';

/** Plugin nativo propio (android/.../TouchFeedbackPlugin.java). */
interface TouchFeedbackPlugin {
  perform(options: { strength: HapticStrength }): Promise<void>;
}

const TouchFeedback = registerPlugin<TouchFeedbackPlugin>('TouchFeedback');

const IOS_STYLES: Record<HapticStrength, ImpactStyle> = {
  light: ImpactStyle.Light,
  medium: ImpactStyle.Medium,
};

/**
 * Respuesta táctil al presionar controles (el "toque" del sistema, no una vibración).
 * En Android usa la respuesta táctil nativa, que respeta el ajuste e intensidad del celular;
 * en iOS, el motor háptico. En el navegador no hace nada.
 */
@Injectable({ providedIn: 'root' })
export class HapticsService {
  private readonly platform = Capacitor.getPlatform();

  tap(strength: HapticStrength = 'light'): void {
    // Si el dispositivo no lo admite o el usuario lo desactivó, se ignora en silencio.
    if (this.platform === 'android') {
      TouchFeedback.perform({ strength }).catch(() => undefined);
    } else if (this.platform === 'ios') {
      Haptics.impact({ style: IOS_STYLES[strength] }).catch(() => undefined);
    }
  }
}
