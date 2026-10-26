import { InjectionToken, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpLibraryRepository } from '../../data/repositories/http-library.repository';
import { LibraryBook, LibraryFilters, LibrarySemester, LibrarySubject } from '../../core/models/library.models';

/** Contrato de acceso al catálogo institucional (patrón Repository). */
export interface LibraryRepository {
  catalog(filters?: LibraryFilters): Observable<LibraryBook[]>;
  subjects(): Observable<LibrarySubject[]>;
  semesters(): Observable<LibrarySemester[]>;
  preview(id: number): Observable<{ previewUrl: string }>;
  pdfUrl(id: number): Observable<{ url: string; titulo: string }>;
  file(url: string): Observable<ArrayBuffer>;
}

/** Punto de inyección del repositorio; la fábrica entrega la implementación HTTP (patrón Factory). */
export const LIBRARY_REPOSITORY = new InjectionToken<LibraryRepository>('LIBRARY_REPOSITORY', {
  providedIn: 'root',
  factory: () => inject(HttpLibraryRepository),
});
