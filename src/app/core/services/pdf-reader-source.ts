import { InjectionToken, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LibraryService } from './library.service';

/** El lector conserva un único motor; cada módulo proporciona su archivo autorizado. */
export interface PdfReaderSource {
  readonly detailPath?: string;
  pdf(id: number): Observable<{ data: ArrayBuffer; titulo: string }>;
}
export const PDF_READER_SOURCE = new InjectionToken<PdfReaderSource>('PDF_READER_SOURCE', {
  providedIn: 'root', factory: () => inject(LibraryService),
});
