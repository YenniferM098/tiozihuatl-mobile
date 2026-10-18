import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, shareReplay, switchMap, throwError, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LibraryBook, LibraryFilters, LibrarySemester, LibrarySubject } from '../models/library.models';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

/**
 * Indica si el libro tiene contenido digital autorizado: un public_id o una URL
 * de Cloudinary. Algunos registros guardan una URL externa de ejemplo (p. ej. biblioteca.example)
 * que no corresponde a ningún archivo; esos se muestran sin contenido digital.
 */
export function hasDigitalFile(book: Pick<LibraryBook, 'tiene_digital' | 'pdf_url'>): boolean {
  const ref = (book.pdf_url ?? '').trim();
  if (Number(book.tiene_digital) !== 1 || !ref) return false;
  if (!/^https?:\/\//i.test(ref)) return true;
  try { return new URL(ref).hostname === 'res.cloudinary.com'; } catch { return false; }
}

export function libraryError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 401 || error.status === 403) return 'Contenido no disponible para este usuario. Revisa tu sesión.';
    if (error.status === 404) return 'El libro no está disponible.';
  }
  return 'No fue posible conectar con el servidor. Revisa tu conexión e intenta nuevamente.';
}

/** Solo utiliza contratos existentes del catálogo institucional. */
@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);
  private readonly previews = new Map<number, Observable<{ previewUrl: string }>>();
  private readonly api = `${environment.apiUrl}/catalog`;

  private authorized<T>(request: () => Observable<T>): Observable<T> {
    return this.auth.ensureValidSession().pipe(switchMap(valid => {
      const role = this.session.user()?.rol;
      if (!valid || (role !== 'Estudiante' && role !== 'Docente')) {
        return throwError(() => new HttpErrorResponse({ status: 403 }));
      }
      return request().pipe(timeout(45000));
    }));
  }

  catalog(filters?: LibraryFilters): Observable<LibraryBook[]> {
    let params = new HttpParams();
    if (filters) for (const [key, value] of Object.entries(filters)) {
      if (value) params = params.set(key, value);
    }
    return this.authorized(() => this.http.get<LibraryBook[]>(this.api, { params }));
  }
  subjects(): Observable<LibrarySubject[]> {
    return this.authorized(() => this.http.get<LibrarySubject[]>(`${this.api}/materias`));
  }
  semesters(): Observable<LibrarySemester[]> {
    return this.authorized(() => this.http.get<LibrarySemester[]>(`${this.api}/semestres`));
  }
  preview(id: number): Observable<{ previewUrl: string }> {
    return this.authorized(() => {
      let preview = this.previews.get(id);
      if (!preview) {
        preview = this.http.get<{ previewUrl: string }>(`${this.api}/libros/${id}/preview`).pipe(
          timeout(45000),
          catchError(error => { this.previews.delete(id); return throwError(() => error); }),
          // La respuesta HTTP corta termina y queda disponible aunque un consumidor se retire tras next.
          shareReplay({ bufferSize: 1, refCount: false }),
        );
        if (this.previews.size >= 64) this.previews.delete(this.previews.keys().next().value!);
        this.previews.set(id, preview);
      }
      return preview;
    });
  }
  safeResource(value: string): boolean {
    try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' && !url.username && !url.password; }
    catch { return false; }
  }
}
