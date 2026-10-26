import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, shareReplay, switchMap, throwError, timeout } from 'rxjs';
import { LIBRARY_REPOSITORY } from '../../domain/repositories/library.repository';
import { LibraryBook, LibraryFilters, LibrarySemester, LibrarySubject } from '../models/library.models';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

/** Mensaje del servicio cuando el archivo del libro no proviene de Cloudinary. */
const INVALID_FILE = 'URL de archivo inválida';

/**
 * Indica si el libro tiene un archivo digital que el lector puede abrir: un public_id o una URL
 * de Cloudinary. Algunos registros guardan una URL externa de ejemplo (p. ej. biblioteca.example)
 * que no corresponde a ningún archivo; para esos no se ofrece el lector.
 */
export function hasDigitalFile(book: Pick<LibraryBook, 'tiene_digital' | 'pdf_url'>): boolean {
  const ref = (book.pdf_url ?? '').trim();
  if (Number(book.tiene_digital) !== 1 || !ref) return false;
  if (!/^https?:\/\//i.test(ref)) return true;
  try { return new URL(ref).hostname === 'res.cloudinary.com'; } catch { return false; }
}

export function libraryError(error: unknown, file = false): string {
  if (error instanceof Error && error.message === INVALID_FILE) return 'Este libro no tiene un archivo digital disponible.';
  if (error instanceof HttpErrorResponse) {
    if (error.status === 401 || error.status === 403) return 'Contenido no disponible para este usuario. Revisa tu sesión.';
    if (error.status === 404) return file ? 'El archivo no está disponible.' : 'El libro no está disponible.';
  }
  return file ? 'No fue posible abrir el archivo. Revisa tu conexión e intenta nuevamente.' : 'No fue posible conectar con el servidor. Revisa tu conexión e intenta nuevamente.';
}

/** Solo utiliza contratos existentes del catálogo institucional. */
@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly repository = inject(LIBRARY_REPOSITORY);
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);
  private readonly previews = new Map<number, Observable<{ previewUrl: string }>>();

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
    return this.authorized(() => this.repository.catalog(filters));
  }
  subjects(): Observable<LibrarySubject[]> {
    return this.authorized(() => this.repository.subjects());
  }
  semesters(): Observable<LibrarySemester[]> {
    return this.authorized(() => this.repository.semesters());
  }
  preview(id: number): Observable<{ previewUrl: string }> {
    return this.authorized(() => {
      let preview = this.previews.get(id);
      if (!preview) {
        preview = this.repository.preview(id).pipe(
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
  pdf(id: number): Observable<{ data: ArrayBuffer; titulo: string }> {
    return this.authorized(() => this.repository.pdfUrl(id)).pipe(
      switchMap(({ url, titulo }) => {
        // El backend firma el recurso en Cloudinary. Nunca enviamos el token a ese host.
        if (!this.safeResource(url)) return throwError(() => new Error(INVALID_FILE));
        return this.authorized(() => this.repository.file(url)).pipe(
          map(data => ({ data, titulo }))
        );
      })
    );
  }
  safeResource(value: string): boolean {
    try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' && !url.username && !url.password; }
    catch { return false; }
  }
}
