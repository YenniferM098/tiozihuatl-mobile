import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LibraryBook, LibraryFilters, LibrarySemester, LibrarySubject } from '../../core/models/library.models';
import type { LibraryRepository } from '../../domain/repositories/library.repository';

/** Implementación del repositorio del catálogo sobre la API REST. */
@Injectable({ providedIn: 'root' })
export class HttpLibraryRepository implements LibraryRepository {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/catalog`;

  catalog(filters?: LibraryFilters): Observable<LibraryBook[]> {
    let params = new HttpParams();
    if (filters) for (const [key, value] of Object.entries(filters)) {
      if (value) params = params.set(key, value);
    }
    return this.http.get<LibraryBook[]>(this.api, { params });
  }

  subjects(): Observable<LibrarySubject[]> {
    return this.http.get<LibrarySubject[]>(`${this.api}/materias`);
  }

  semesters(): Observable<LibrarySemester[]> {
    return this.http.get<LibrarySemester[]>(`${this.api}/semestres`);
  }

  preview(id: number): Observable<{ previewUrl: string }> {
    return this.http.get<{ previewUrl: string }>(`${this.api}/libros/${id}/preview`);
  }

  pdfUrl(id: number): Observable<{ url: string; titulo: string }> {
    return this.http.get<{ url: string; titulo: string }>(`${this.api}/libros/${id}/pdf-url`);
  }

  file(url: string): Observable<ArrayBuffer> {
    return this.http.get(url, { responseType: 'arraybuffer' });
  }
}
