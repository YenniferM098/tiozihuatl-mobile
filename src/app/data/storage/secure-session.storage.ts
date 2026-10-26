import { Injectable, InjectionToken, inject } from '@angular/core';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import type { SessionStore } from './session.storage';

/** Operaciones del plugin nativo que usa el almacén; se inyecta para poder simularlo en pruebas. */
export type SecureStoragePlugin = Pick<typeof SecureStorage, 'getItem' | 'setItem' | 'removeItem'>;

export const SECURE_STORAGE_PLUGIN = new InjectionToken<SecureStoragePlugin>('SECURE_STORAGE_PLUGIN', {
  providedIn: 'root',
  // Objeto propio y no el proxy del plugin: Angular busca ngOnDestroy en lo que entrega una fábrica.
  factory: () => ({
    getItem: (key) => SecureStorage.getItem(key),
    setItem: (key, value) => SecureStorage.setItem(key, value),
    removeItem: (key) => SecureStorage.removeItem(key),
  }),
});

/** Misma clave que `SESSION_KEY`; se repite para no crear una dependencia circular entre archivos. */
const KEY = 'tiozihuatl.session';

/**
 * Almacén cifrado para Android e iOS. En Android cifra con AES-256-GCM usando una llave
 * del Android Keystore (equivalente a EncryptedSharedPreferences); en iOS usa el Keychain.
 * La primera vez migra la sesión que versiones anteriores dejaron en localStorage y la borra de ahí.
 */
@Injectable({ providedIn: 'root' })
export class SecureSessionStore implements SessionStore {
  private readonly plugin = inject(SECURE_STORAGE_PLUGIN);

  readSync(): string | null {
    return null;
  }

  async load(): Promise<string | null> {
    const value = await this.plugin.getItem(KEY);
    if (value) return value;

    const legacy = this.takeLegacy();
    if (legacy) await this.plugin.setItem(KEY, legacy);
    return legacy;
  }

  write(value: string): Promise<void> {
    return this.plugin.setItem(KEY, value);
  }

  async remove(): Promise<void> {
    this.takeLegacy();
    await this.plugin.removeItem(KEY);
  }

  /** Lee y elimina la sesión sin cifrar de versiones anteriores. */
  private takeLegacy(): string | null {
    try {
      const value = localStorage.getItem(KEY);
      if (value !== null) localStorage.removeItem(KEY);
      return value;
    } catch {
      return null;
    }
  }
}
