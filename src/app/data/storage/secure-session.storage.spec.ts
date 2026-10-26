import { TestBed } from '@angular/core/testing';
import { SECURE_STORAGE_PLUGIN, SecureSessionStore } from './secure-session.storage';

const KEY = 'tiozihuatl.session';

describe('SecureSessionStore (almacenamiento cifrado)', () => {
  let cifrado: Map<string, string>;
  let store: SecureSessionStore;

  beforeEach(() => {
    localStorage.clear();
    cifrado = new Map();
    TestBed.configureTestingModule({ providers: [{
      provide: SECURE_STORAGE_PLUGIN,
      useValue: {
        getItem: async (key: string) => cifrado.get(key) ?? null,
        setItem: async (key: string, value: string) => { cifrado.set(key, value); },
        removeItem: async (key: string) => { cifrado.delete(key); },
      },
    }] });
    store = TestBed.inject(SecureSessionStore);
  });

  afterEach(() => vi.restoreAllMocks());

  it('no ofrece lectura inmediata: la sesión se obtiene con load()', () => {
    expect(store.readSync()).toBeNull();
  });

  it('guarda y recupera la sesión desde el almacén cifrado, no desde localStorage', async () => {
    await store.write('{"accessToken":"a"}');

    expect(cifrado.get(KEY)).toBe('{"accessToken":"a"}');
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(await store.load()).toBe('{"accessToken":"a"}');
  });

  it('migra la sesión sin cifrar de la versión anterior y la borra de localStorage', async () => {
    localStorage.setItem(KEY, '{"accessToken":"viejo"}');

    expect(await store.load()).toBe('{"accessToken":"viejo"}');
    expect(cifrado.get(KEY)).toBe('{"accessToken":"viejo"}');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('devuelve null cuando no hay sesión guardada', async () => {
    expect(await store.load()).toBeNull();
  });

  it('borra la sesión del almacén cifrado y cualquier copia vieja', async () => {
    cifrado.set(KEY, 'x');
    localStorage.setItem(KEY, 'y');

    await store.remove();

    expect(cifrado.has(KEY)).toBe(false);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('ignora un localStorage bloqueado al buscar la sesión vieja', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    expect(await store.load()).toBeNull();
  });
});
