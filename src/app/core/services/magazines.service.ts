import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, TimeoutError, catchError, forkJoin, map, of, shareReplay, switchMap, throwError, timeout } from 'rxjs';
import {
  Magazine,
  MagazineCatalogItemDto,
  MagazineDetail,
  MagazineError,
  MagazineFilters,
  PurchasedMagazine,
  PurchasedMagazineDto,
} from '../models/magazine.models';
import { MAGAZINES_REPOSITORY } from '../../domain/repositories/magazines.repository';
import { AuthService } from './auth.service';

// Render puede tardar en "despertar" el servidor en la primera petición.
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_SEARCH_LENGTH = 100;

const MESSAGES: Record<MagazineError['kind'], string> = {
  connection: 'No fue posible conectar con el servidor. Revisa tu conexión e intenta nuevamente.',
  session: 'Tu sesión expiró. Inicia sesión nuevamente.',
  notFound: 'La revista solicitada no existe o ya no está disponible.',
  server: 'Ocurrió un problema en el servidor. Intenta más tarde.',
};

/**
 * Casos de uso de Revistas Digitales (todos los roles): catálogo, búsqueda, detalle y
 * revistas adquiridas. Los datos vienen del repositorio. La compra no forma parte de la
 * app móvil: se realiza en el sitio web.
 */
@Injectable({ providedIn: 'root' })
export class MagazinesService {
  private readonly repository = inject(MAGAZINES_REPOSITORY);
  private readonly auth = inject(AuthService);

  /** El catálogo es público e igual para todos: se comparte mientras no se pida actualizarlo. */
  private catalog$: Observable<Magazine[]> | null = null;

  /** GET /magazines: revistas activas con portada y precio con descuento, ordenadas por título. */
  catalog(refresh = false): Observable<Magazine[]> {
    if (refresh || !this.catalog$) {
      this.catalog$ = this.repository.catalog().pipe(
        timeout(REQUEST_TIMEOUT_MS),
        map((res) => (Array.isArray(res?.data) ? res.data : []).map(toMagazine)),
        catchError((err) => {
          this.catalog$ = null;
          return throwError(() => toMagazineError(err));
        }),
        shareReplay(1),
      );
    }
    return this.catalog$;
  }

  /**
   * GET /magazines/filter: búsqueda por título, letra inicial y orden en el backend.
   * Ese endpoint no genera portadas, así que se toman del catálogo (si falla, sin portada).
   */
  search(filters: MagazineFilters, refresh = false): Observable<Magazine[]> {
    const search = normalizeSearch(filters.search);
    const letter = normalizeLetter(filters.letter);
    // Sin búsqueda ni letra y en orden A–Z, el resultado es el mismo catálogo.
    if (!search && !letter && filters.sort === 'asc') return this.catalog(refresh);

    const covers = this.catalog(refresh).pipe(catchError(() => of([] as Magazine[])));
    return forkJoin([this.repository.filter({ sort: filters.sort, search, letter }).pipe(timeout(REQUEST_TIMEOUT_MS)), covers]).pipe(
      map(([res, catalog]) => {
        const byId = new Map(catalog.map((m) => [m.id, m.cover]));
        return (Array.isArray(res?.data) ? res.data : []).map((dto) => {
          const magazine = toMagazine(dto);
          return { ...magazine, cover: magazine.cover ?? byId.get(magazine.id) ?? null };
        });
      }),
      catchError((err) => throwError(() => toMagazineError(err))),
    );
  }

  /** GET /magazines/my-purchases: solo las revistas del usuario autenticado (el backend usa su token). */
  purchases(): Observable<PurchasedMagazine[]> {
    return this.withSession(() =>
      forkJoin([
        this.repository.myPurchases().pipe(timeout(REQUEST_TIMEOUT_MS)),
        this.catalog().pipe(catchError(() => of([] as Magazine[]))),
      ]),
    ).pipe(map(([items, catalog]) => toPurchases(items, catalog)));
  }

  /**
   * Detalle: GET /magazines/:id más el catálogo (portada, descuento y si sigue activa)
   * y las compras del usuario. Una revista inactiva no se muestra.
   */
  detail(id: number): Observable<MagazineDetail> {
    if (!Number.isSafeInteger(id) || id <= 0) return throwError(() => new MagazineError('notFound', MESSAGES.notFound));
    return forkJoin([
      this.repository.detail(id).pipe(timeout(REQUEST_TIMEOUT_MS)),
      this.catalog(),
      this.purchases().pipe(
        map((items): boolean | null => items.some((p) => p.id === id)),
        catchError(() => of(null)),
      ),
    ]).pipe(
      map(([res, catalog, purchased]) => {
        const dto = res?.data;
        const fromCatalog = catalog.find((m) => m.id === id);
        if (!dto || !fromCatalog) throw new MagazineError('notFound', MESSAGES.notFound);
        return {
          ...fromCatalog,
          title: plainText(dto.titulo) || fromCatalog.title,
          description: plainText(dto.descripcion) || fromCatalog.description,
          purchased,
        };
      }),
      catchError((err) => throwError(() => toMagazineError(err))),
    );
  }

  /** Renueva el access token si expiró antes de llamar a un endpoint protegido. */
  private withSession<T>(request: () => Observable<T>): Observable<T> {
    return this.auth.ensureValidSession().pipe(
      switchMap((valid) => (valid ? request() : throwError(() => new MagazineError('session', MESSAGES.session)))),
      catchError((err) => throwError(() => toMagazineError(err))),
    );
  }
}

/** Traduce cualquier error a un estado de interfaz con un mensaje claro, sin detalles técnicos. */
export function toMagazineError(err: unknown): MagazineError {
  if (err instanceof MagazineError) return err;
  if (err instanceof TimeoutError) return new MagazineError('connection', MESSAGES.connection);
  if (!(err instanceof HttpErrorResponse)) return new MagazineError('server', MESSAGES.server);

  switch (err.status) {
    case 0:
    case 502:
    case 503:
    case 504:
      return new MagazineError('connection', MESSAGES.connection);
    case 401:
      return new MagazineError('session', MESSAGES.session);
    case 404:
      return new MagazineError('notFound', MESSAGES.notFound);
    default:
      return new MagazineError('server', MESSAGES.server);
  }
}

function toMagazine(dto: MagazineCatalogItemDto): Magazine {
  const price = toNumber(dto.precio);
  const finalPrice = dto.precio_final == null ? price : toNumber(dto.precio_final);
  return {
    id: Number(dto.id_magazine),
    title: plainText(dto.titulo),
    description: plainText(dto.descripcion),
    cover: isHttpsUrl(dto.portada_url) ? dto.portada_url.trim() : null,
    price,
    finalPrice,
    hasDiscount: isTruthy(dto.descuento_activo) && finalPrice < price,
  };
}

function toPurchases(items: unknown, catalog: Magazine[]): PurchasedMagazine[] {
  const covers = new Map(catalog.map((m) => [m.id, m.cover]));
  return (Array.isArray(items) ? (items as PurchasedMagazineDto[]) : []).map((p) => ({
    id: Number(p.id_revista),
    title: plainText(p.titulo),
    cover: covers.get(Number(p.id_revista)) ?? null,
    purchasedAt: p.fecha_compra ?? null,
  }));
}

/**
 * La base de datos compara sin distinguir mayúsculas ni acentos ("enfermeria" encuentra
 * "Enfermería"); se envía el término sin acentos, sin espacios repetidos y con longitud máxima.
 */
function normalizeSearch(value: string): string | undefined {
  const text = String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);
  return text || undefined;
}

/** Solo una letra (A–Z o Ñ); cualquier otro valor se ignora. */
function normalizeLetter(value: string): string | undefined {
  const letter = String(value ?? '').trim().toUpperCase();
  return /^[A-ZÑ]$/.test(letter) ? letter : undefined;
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isTruthy(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

/** Solo URLs https (Cloudinary); evita esquemas como javascript: o data:. */
function isHttpsUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https:\/\//i.test(value.trim());
}

/** Texto plano: quita etiquetas HTML y espacios repetidos. Angular lo interpola siempre como texto. */
function plainText(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/<[^<>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
