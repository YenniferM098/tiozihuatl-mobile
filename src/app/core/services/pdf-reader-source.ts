import { InjectionToken, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LibraryService } from './library.service';

/** El lector conserva un único motor; cada módulo proporciona su archivo autorizado. */
export interface PdfReaderSource {
  readonly detailPath?: string;
  /** Separa la última página guardada de cada módulo (por ejemplo 'material.'); los libros no usan prefijo. */
  readonly progressPrefix?: string;
  pdf(id: number): Observable<{ data: ArrayBuffer; titulo: string }>;
  /** Mensaje propio del módulo para un error al obtener el archivo; sin él se usan los de Biblioteca. */
  errorMessage?(error: unknown): string;
}
export const PDF_READER_SOURCE = new InjectionToken<PdfReaderSource>('PDF_READER_SOURCE', {
  providedIn: 'root', factory: () => inject(LibraryService),
});
