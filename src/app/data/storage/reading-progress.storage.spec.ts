import { vi } from 'vitest';
import { READING_PROGRESS_KEY, ReadingProgressStore } from './reading-progress.storage';

describe('ReadingProgressStore', () => {
  const store = new ReadingProgressStore();
  afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

  it('guarda y recupera la última página de cada libro por separado', () => {
    store.save(52, 34);
    store.save(7, 3);
    expect(store.lastPage(52)).toBe(34);
    expect(store.lastPage(7)).toBe(3);
    expect(localStorage.getItem(READING_PROGRESS_KEY + '52')).toBe('34');
  });
  it('empieza en la primera página sin registro o con un valor inválido', () => {
    expect(store.lastPage(52)).toBe(1);
    localStorage.setItem(READING_PROGRESS_KEY + '52', 'abc');
    expect(store.lastPage(52)).toBe(1);
    localStorage.setItem(READING_PROGRESS_KEY + '52', '-4');
    expect(store.lastPage(52)).toBe(1);
  });
  it('no falla si el almacenamiento del dispositivo no está disponible', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    expect(() => store.save(52, 10)).not.toThrow();
    expect(store.lastPage(52)).toBe(1);
  });
});
