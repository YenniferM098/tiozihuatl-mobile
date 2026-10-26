import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { SecureSessionStore } from './secure-session.storage';
import { LocalSessionStore, SESSION_KEY, SESSION_STORE } from './session.storage';

describe('Almacén de sesión según la plataforma', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('usa localStorage en el navegador', () => {
    expect(TestBed.inject(SESSION_STORE)).toBeInstanceOf(LocalSessionStore);
  });

  it('usa el almacén cifrado en Android e iOS', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    expect(TestBed.inject(SESSION_STORE)).toBeInstanceOf(SecureSessionStore);
  });

  it('LocalSessionStore lee, escribe y borra la sesión', async () => {
    const store = TestBed.inject(LocalSessionStore);
    expect(store.readSync()).toBeNull();

    await store.write('{"a":1}');
    expect(localStorage.getItem(SESSION_KEY)).toBe('{"a":1}');
    expect(await store.load()).toBe('{"a":1}');

    await store.remove();
    expect(store.readSync()).toBeNull();
  });

  it('LocalSessionStore no falla si el almacenamiento está bloqueado', async () => {
    const store = TestBed.inject(LocalSessionStore);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('bloqueado'); });

    expect(store.readSync()).toBeNull();
    await expect(store.write('x')).resolves.toBeUndefined();
    await expect(store.remove()).resolves.toBeUndefined();
  });
});
