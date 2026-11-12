import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, throwError, timeout } from 'rxjs';
import { Magazine, MagazineError } from '../models/magazine.models';
import { MAGAZINES_REPOSITORY } from '../../domain/repositories/magazines.repository';
import { AuthService } from './auth.service';
import { MAGAZINE_MESSAGES, MagazinesService, toMagazineError } from './magazines.service';
import type { PdfReaderSource } from './pdf-reader-source';
import { SessionService } from './session.service';

const REQUEST_TIMEOUT_MS = 30_000;
// Las revistas pueden pesar varios MB; la descarga tiene más margen que una consulta.
const FILE_TIMEOUT_MS = 120_000;
const MAX_PDF_BYTES = 100 * 1024 * 1024;
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

/**
 * Fuente del lector para Revistas Digitales (el mismo motor de Biblioteca y Materiales).
 * El backend solo entrega la dirección del PDF si el usuario adquirió la revista; la app
 * valida que sea un PDF de Cloudinary antes de descargarlo y nunca le envía el token.
 */
@Injectable({ providedIn: 'root' })
export class MagazineFilesService implements PdfReaderSource {
  private readonly repository = inject(MAGAZINES_REPOSITORY);
  private readonly magazines = inject(MagazinesService);
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);
  readonly detailPath = '/revistas';
  /** La última página leída de cada revista se guarda aparte de libros y materiales. */
  readonly progressPrefix = 'revista.';

  /** GET /magazines/secure-pdf/:id y descarga del archivo autorizado. */
  pdf(id: number): Observable<{ data: ArrayBuffer; titulo: string }> {
    if (!Number.isSafeInteger(id) || id <= 0) return throwError(() => new MagazineError('notFound', MAGAZINE_MESSAGES.notFound));
    const owner = this.owner();
    return this.auth.ensureValidSession().pipe(
      switchMap((valid) => {
        if (!valid) throw new MagazineError('session', MAGAZINE_MESSAGES.session);
        return forkJoin([this.repository.securePdf(id).pipe(timeout(REQUEST_TIMEOUT_MS)), this.title(id)]);
      }),
      switchMap(([res, titulo]) => {
        const url = res?.url;
        if (!isMagazinePdfUrl(url)) throw new MagazineError('unavailable', MAGAZINE_MESSAGES.unavailable);
        return this.repository.file(url).pipe(
          timeout(FILE_TIMEOUT_MS),
          map((data) => {
            // Si la sesión cambió durante la descarga, el archivo no se entrega a otra cuenta.
            if (this.owner() !== owner) throw new MagazineError('session', MAGAZINE_MESSAGES.session);
            if (!isPdf(data)) throw new MagazineError('unavailable', MAGAZINE_MESSAGES.unavailable);
            return { data, titulo };
          }),
        );
      }),
      catchError((err) => throwError(() => toMagazineError(err))),
    );
  }

  /** Mensajes del lector propios de Revistas (por ejemplo, revista no adquirida). */
  errorMessage(error: unknown): string {
    return toMagazineError(error).message;
  }

  /** Título para la barra del lector; si el catálogo no responde, uno genérico. */
  private title(id: number): Observable<string> {
    return this.magazines.catalog().pipe(
      map((catalog: Magazine[]) => catalog.find((m) => m.id === id)?.title || 'Revista digital'),
      catchError(() => of('Revista digital')),
    );
  }

  private owner(): string {
    return String(this.session.user()?.id_usuario ?? '');
  }
}

/** Solo PDF https de Cloudinary, sin credenciales ni puertos extraños. */
export function isMagazinePdfUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'res.cloudinary.com' &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === '443') &&
      /\/(image|raw)\/upload\//.test(url.pathname) &&
      /\.pdf$/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

/** El archivo empieza con la firma %PDF- y no excede el tamaño máximo. */
function isPdf(data: ArrayBuffer | null | undefined): data is ArrayBuffer {
  if (!data || data.byteLength < PDF_SIGNATURE.length || data.byteLength > MAX_PDF_BYTES) return false;
  const head = new Uint8Array(data, 0, PDF_SIGNATURE.length);
  return PDF_SIGNATURE.every((byte, i) => head[i] === byte);
}
