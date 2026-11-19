import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'tiozihuatl.onboarding';
const GUIDE_KEY = 'tiozihuatl.guia';
const MODULE_GUIDE_KEY = 'tiozihuatl.guia.modulo.';
const LOGIN_GUIDE_KEY = 'tiozihuatl.guia.login';

/**
 * Estado guardado de la guía de primer uso (MEJ-01). Sin valor: nunca se ha decidido.
 * 'heredada': la sesión ya existía antes de esta versión; ese usuario no ve las guías.
 */
type GuideState = 'pendiente' | 'vista' | 'heredada';

/**
 * Recuerda lo que el usuario ya vio en este dispositivo:
 * - la pantalla de bienvenida (primera ejecución);
 * - la guía del inicio de sesión, que se activa al dejar la bienvenida (solo en una
 *   instalación nueva) y se cierra al terminarla u omitirla;
 * - la guía de primer uso, que solo aparece después del primer inicio de sesión
 *   en una instalación nueva y no vuelve a mostrarse;
 * - la guía de cada módulo, que aparece la primera vez que se entra a él, después
 *   de la guía de la barra inferior.
 * Se guarda en el almacenamiento local, igual que la sesión.
 */
@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private seen = this.read(STORAGE_KEY) === 'done';
  private readonly guide = signal<GuideState | null>(this.readGuide());
  private readonly seenModules = new Set<string>();
  private readonly loginGuide = signal(this.read(LOGIN_GUIDE_KEY) === 'pendiente');

  /** La guía debe mostrarse (se inició sesión y todavía no se termina ni se omite). */
  readonly guidePending = () => this.guide() === 'pendiente';

  /** La guía del inicio de sesión debe mostrarse (instalación nueva y todavía no se cierra). */
  readonly loginGuidePending = () => this.loginGuide();

  get hasSeenWelcome(): boolean {
    return this.seen;
  }

  markWelcomeSeen(): void {
    // Solo una instalación nueva pasa por la bienvenida: ahí se activa la guía del inicio de sesión.
    if (!this.seen && this.read(LOGIN_GUIDE_KEY) === null) {
      this.loginGuide.set(true);
      this.write(LOGIN_GUIDE_KEY, 'pendiente');
    }
    this.seen = true;
    this.write(STORAGE_KEY, 'done');
  }

  markLoginGuideSeen(): void {
    this.loginGuide.set(false);
    this.write(LOGIN_GUIDE_KEY, 'vista');
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
    if (this.guide() === null) this.setGuide('heredada');
  }

  /** Terminar u omitir la guía la cierra de forma definitiva. */
  markGuideSeen(): void {
    this.setGuide('vista');
  }

  /** La guía del módulo se muestra si ya se cerró la de la barra en esta instalación y el módulo no se ha visto. */
  shouldShowModuleGuide(module: string): boolean {
    if (this.guide() !== 'vista') return false;
    return !this.seenModules.has(module) && this.read(MODULE_GUIDE_KEY + module) !== 'vista';
  }

  markModuleGuideSeen(module: string): void {
    this.seenModules.add(module);
    this.write(MODULE_GUIDE_KEY + module, 'vista');
  }

  private setGuide(state: GuideState): void {
    this.guide.set(state);
    this.write(GUIDE_KEY, state);
  }

  private readGuide(): GuideState | null {
    const value = this.read(GUIDE_KEY);
    return value === 'pendiente' || value === 'vista' || value === 'heredada' ? value : null;
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
