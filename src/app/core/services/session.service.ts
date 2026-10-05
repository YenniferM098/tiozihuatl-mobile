import { Injectable, computed, signal } from '@angular/core';
import { AuthSession } from '../models/auth.models';

const STORAGE_KEY = 'tiozihuatl.session';

/**
 * Guarda la sesión (tokens y datos básicos del usuario) en el almacenamiento local.
 * Nunca se guarda la contraseña.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly session = signal<AuthSession | null>(this.read());

  readonly user = computed(() => this.session()?.user ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);

  get current(): AuthSession | null {
    return this.session();
  }

  save(session: AuthSession): void {
    this.session.set(session);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Si el almacenamiento no está disponible, la sesión vive solo en memoria.
    }
  }

  clear(): void {
    this.session.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Sin almacenamiento disponible no hay nada que borrar.
    }
  }

  /** Indica si el access token ya expiró (o expira en los próximos `skewMs`). */
  isAccessTokenExpired(skewMs = 30_000): boolean {
    const token = this.session()?.accessToken;
    if (!token) return true;

    const exp = this.readTokenExpiration(token);
    return exp === null || exp * 1000 - skewMs <= Date.now();
  }

  private read(): AuthSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as AuthSession;
      return parsed?.accessToken && parsed?.refreshToken && parsed?.user ? parsed : null;
    } catch {
      return null;
    }
  }

  private readTokenExpiration(token: string): number | null {
    try {
      const payload = token.split('.')[1];
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      const exp = JSON.parse(json)?.exp;
      return typeof exp === 'number' ? exp : null;
    } catch {
      return null;
    }
  }
}
