import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'tiozihuatl.onboarding';
const GUIDE_KEY = 'tiozihuatl.guia';

/** Estado guardado de la guía de primer uso (MEJ-01). Sin valor: nunca se ha decidido. */
type GuideState = 'pendiente' | 'vista';

/**
 * Recuerda lo que el usuario ya vio en este dispositivo:
 * - la pantalla de bienvenida (primera ejecución);
 * - la guía de primer uso, que solo aparece después del primer inicio de sesión
 *   en una instalación nueva y no vuelve a mostrarse.
 * Se guarda en el almacenamiento local, igual que la sesión.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private seen = this.read(STORAGE_KEY) === 'done';
  private readonly guide = signal<GuideState | null>(this.readGuide());

  /** La guía debe mostrarse (se inició sesión y todavía no se termina ni se omite). */
  readonly guidePending = () => this.guide() === 'pendiente';

  get hasSeenWelcome(): boolean {
    return this.seen;
  }

  markWelcomeSeen(): void {
    this.seen = true;
    this.write(STORAGE_KEY, 'done');
  }

  /** Al iniciar sesión: si la guía nunca se ha decidido en este dispositivo, queda pendiente. */
  markGuidePendingIfNew(): void {
    if (this.guide() === null) this.setGuide('pendiente');
  }

  /**
   * Al entrar a la app con sesión: si la guía nunca se decidió es porque la sesión ya
   * existía antes de esta versión (actualización); ese usuario ya conoce la app y no la ve.
   */
  settleGuide(): void {
    if (this.guide() === null) this.setGuide('vista');
  }

  /** Terminar u omitir la guía la cierra de forma definitiva. */
  markGuideSeen(): void {
    this.setGuide('vista');
  }

  private setGuide(state: GuideState): void {
    this.guide.set(state);
    this.write(GUIDE_KEY, state);
  }

  private readGuide(): GuideState | null {
    const value = this.read(GUIDE_KEY);
    return value === 'pendiente' || value === 'vista' ? value : null;
  }

  private read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Sin almacenamiento disponible la marca vive solo en memoria.
    }
  }
}
