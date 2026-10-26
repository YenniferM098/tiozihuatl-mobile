import { Injectable } from '@angular/core';

/** Prefijo de la clave donde se guarda la última página leída de cada libro. */
export const READING_PROGRESS_KEY = 'tiozihuatl.lectura.';

/** Recuerda en el dispositivo la última página leída de cada libro. */
@Injectable({ providedIn: 'root' })
export class ReadingProgressStore {
  lastPage(bookId: number): number {
    try {
      const page = Number(localStorage.getItem(READING_PROGRESS_KEY + bookId));
      return Number.isSafeInteger(page) && page > 0 ? page : 1;
    } catch {
      return 1;
    }
  }

  save(bookId: number, page: number): void {
    try {
      localStorage.setItem(READING_PROGRESS_KEY + bookId, String(page));
    } catch {
      // Sin almacenamiento disponible, el libro se abre desde la primera página.
    }
  }
}
