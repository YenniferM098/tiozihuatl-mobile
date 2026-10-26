import { Injectable, InjectionToken, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { SecureSessionStore } from './secure-session.storage';

/** Clave con la que se guarda la sesión en cualquier almacén. */
export const SESSION_KEY = 'tiozihuatl.session';

/** Almacén donde persiste la sesión entre aperturas de la app. */
export interface SessionStore {
  /** Lectura inmediata al iniciar; un almacén asíncrono devuelve null y se lee con `load()`. */
  readSync(): string | null;
  load(): Promise<string | null>;
  write(value: string): Promise<void>;
  remove(): Promise<void>;
}

/** Almacén del navegador (web, Lighthouse y pruebas unitarias). No está cifrado. */
@Injectable({ providedIn: 'root' })
export class LocalSessionStore implements SessionStore {
  readSync(): string | null {
    try {
      return localStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  }

  load(): Promise<string | null> {
    return Promise.resolve(this.readSync());
  }

  write(value: string): Promise<void> {
    try {
      localStorage.setItem(SESSION_KEY, value);
    } catch {
      // Si el almacenamiento no está disponible, la sesión vive solo en memoria.
    }
    return Promise.resolve();
  }

  remove(): Promise<void> {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // Sin almacenamiento disponible no hay nada que borrar.
    }
    return Promise.resolve();
  }
}

/**
 * Elige el almacén según la plataforma (patrón Factory): en Android e iOS la sesión
 * se guarda cifrada con el Keystore o el Keychain; en el navegador se usa localStorage.
 */
export const SESSION_STORE = new InjectionToken<SessionStore>('SESSION_STORE', {
  providedIn: 'root',
  factory: () => (Capacitor.isNativePlatform() ? inject(SecureSessionStore) : inject(LocalSessionStore)),
});
