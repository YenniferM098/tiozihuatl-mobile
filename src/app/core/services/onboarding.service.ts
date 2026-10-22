import { Injectable } from '@angular/core';

const STORAGE_KEY = 'tiozihuatl.onboarding';

/**
 * Recuerda si el usuario ya vio la pantalla de bienvenida (primera ejecución).
 * Se guarda en el almacenamiento local, igual que la sesión.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private seen = this.read();

  get hasSeenWelcome(): boolean {
    return this.seen;
  }

  markWelcomeSeen(): void {
    this.seen = true;
    try {
      localStorage.setItem(STORAGE_KEY, 'done');
    } catch {
      // Sin almacenamiento disponible la marca vive solo en memoria.
    }
  }

  private read(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'done';
    } catch {
      return false;
    }
  }
}
