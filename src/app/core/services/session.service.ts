import { Injectable, computed, inject, signal } from '@angular/core';
import { SESSION_STORE } from '../../data/storage/session.storage';
import { AuthSession } from '../models/auth.models';

/**
 * Guarda la sesión (tokens y datos básicos del usuario). En el celular se persiste cifrada;
 * en el navegador, en el almacenamiento local. Nunca se guarda la contraseña.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly store = inject(SESSION_STORE);
  private readonly session = signal<AuthSession | null>(this.parse(this.store.readSync()));

  readonly user = computed(() => this.session()?.user ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);

  get current(): AuthSession | null {
    return this.session();
  }

  /** Recupera la sesión del almacén cifrado al abrir la app; se ejecuta antes de la primera navegación. */
  async restore(): Promise<void> {
    if (this.session()) return;
    const raw = await this.store.load().catch(() => null);
    const restored = this.parse(raw);
    if (restored && !this.session()) this.session.set(restored);
  }

  save(session: AuthSession): void {
    this.session.set(session);
    // Si el almacenamiento falla, la sesión vive solo en memoria.
    this.store.write(JSON.stringify(session)).catch(() => undefined);
  }

  clear(): void {
    this.session.set(null);
    this.store.remove().catch(() => undefined);
  }

  /** Indica si el access token ya expiró (o expira en los próximos `skewMs`). */
  isAccessTokenExpired(skewMs = 30_000): boolean {
    const token = this.session()?.accessToken;
    if (!token) return true;

    const exp = this.readTokenExpiration(token);
    return exp === null || exp * 1000 - skewMs <= Date.now();
  }

  private parse(raw: string | null): AuthSession | null {
    try {
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
