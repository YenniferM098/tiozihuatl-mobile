import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  BookDto,
  EventDto,
  FeaturedEvent,
  HomeBook,
  HomeMagazine,
  HomeMaterial,
  MagazineCatalogDto,
  MaterialDto,
  PagedResponse,
} from '../models/home.models';

const REQUEST_TIMEOUT_MS = 20_000;
const MAX_EVENTS = 5;
const MAX_EVENT_IMAGES = 3;
const MAX_BOOKS = 2;
const MAX_MAGAZINES = 2;
const MAX_MATERIALS = 3;

/** Tipos que asigna el backend al subir un material: etiqueta e icono Phosphor. */
const MATERIAL_TYPES: Record<string, Omit<HomeMaterial, 'id' | 'title' | 'detail'>> = {
  PDF: { type: 'PDF', icon: 'file-pdf' },
  WORD: { type: 'Documento', icon: 'file-doc' },
  EXCEL: { type: 'Hoja de cálculo', icon: 'file-xls' },
  PPT: { type: 'Presentación', icon: 'file-ppt' },
  IMAGEN: { type: 'Imagen', icon: 'file-image' },
  VIDEO: { type: 'Video', icon: 'file-video' },
  ZIP: { type: 'Archivo comprimido', icon: 'file-zip' },
};
const DEFAULT_MATERIAL_TYPE: Omit<HomeMaterial, 'id' | 'title' | 'detail'> = { type: 'Archivo', icon: 'file' };

/**
 * Contenido de Inicio a partir de endpoints existentes. Cada sección es
 * independiente: si una falla, devuelve una lista vacía y Inicio la omite.
 */
@Injectable({ providedIn: 'root' })
export class HomeContentService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  /** GET /api/events?destacado=1 (público). Solo eventos marcados como destacados. */
  featuredEvents(): Observable<FeaturedEvent[]> {
    const params = new HttpParams().set('destacado', '1').set('limit', MAX_EVENTS);
    return this.safe(
      this.http.get<EventDto[]>(`${this.api}/events`, { params }).pipe(
        map((events) =>
          (Array.isArray(events) ? events : [])
            .filter((e) => isTruthy(e.destacado))
            .slice(0, MAX_EVENTS)
            .map((e) => ({
              id: e.id_evento,
              title: plainText(e.titulo),
              images: eventImages(e),
            })),
        ),
      ),
    );
  }

  /**
   * Libros digitales más recientes: GET /api/catalog?formato=DIGITAL (público; con
   * semestre, solo los de ese semestre). Incluye los que también tienen formato físico
   * y excluye los que solo son físicos. El catálogo no trae fecha, así que se toman
   * los de id más alto (los últimos dados de alta). La portada es la primera página
   * del PDF: GET /api/catalog/libros/:id/preview; si no hay una válida queda en null.
   */
  books(semesterId: number | null): Observable<HomeBook[]> {
    let params = new HttpParams().set('formato', 'DIGITAL');
    if (semesterId) params = params.set('semestre', semesterId);
    return this.safe(
      this.http.get<BookDto[]>(`${this.api}/catalog`, { params }).pipe(
        map((books) =>
          [...(Array.isArray(books) ? books : [])]
            .filter((b) => Number(b.tiene_digital) === 1)
            .sort((a, b) => b.id - a.id)
            .slice(0, MAX_BOOKS),
        ),
        switchMap((books) => {
          if (!books.length) return of([] as HomeBook[]);
          return forkJoin(
            books.map((b) =>
              this.bookCover(b.id).pipe(map((cover) => ({ id: b.id, title: plainText(b.titulo), cover }))),
            ),
          );
        }),
      ),
    );
  }

  private bookCover(id: number): Observable<string | null> {
    return this.http.get<{ previewUrl?: string }>(`${this.api}/catalog/libros/${id}/preview`).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      // Algunos libros guardan una URL externa en lugar del PDF en Cloudinary: no hay portada.
      map((res) => (isHttpsUrl(res?.previewUrl) && !/\/https?:/i.test(res.previewUrl.slice(8)) ? res.previewUrl : null)),
      catchError(() => of(null)),
    );
  }

  /**
   * Las revistas más recientes de la tienda: GET /api/magazines/filter?sort=recent
   * (público, ordenado por fecha de alta). La portada sale de GET /api/magazines,
   * que es el único endpoint que la genera.
   */
  recentMagazines(): Observable<HomeMagazine[]> {
    const params = new HttpParams().set('sort', 'recent');
    return this.safe(
      forkJoin([
        this.http.get<{ data?: MagazineCatalogDto[] }>(`${this.api}/magazines/filter`, { params }),
        this.magazineCovers(),
      ]).pipe(
        map(([res, covers]) =>
          (res?.data ?? []).slice(0, MAX_MAGAZINES).map((m) => ({
            id: m.id_magazine,
            title: plainText(m.titulo),
            cover: covers.get(m.id_magazine) ?? null,
          })),
        ),
      ),
    );
  }

  /** Estudiante: materiales públicos de su semestre (GET /api/material/materiales/todos). */
  semesterMaterials(semesterId: number | null): Observable<HomeMaterial[]> {
    let params = new HttpParams().set('limit', MAX_MATERIALS).set('page', 1);
    if (semesterId) params = params.set('semestre', semesterId);
    return this.materials(`${this.api}/material/materiales/todos`, params, true);
  }

  /** Docente: sus propios materiales (GET /api/docente/materiales/mis-materiales). */
  teacherMaterials(): Observable<HomeMaterial[]> {
    const params = new HttpParams().set('limit', MAX_MATERIALS).set('page', 1);
    return this.materials(`${this.api}/docente/materiales/mis-materiales`, params, false);
  }

  private materials(url: string, params: HttpParams, showTeacher: boolean): Observable<HomeMaterial[]> {
    return this.safe(
      this.http.get<PagedResponse<MaterialDto> | MaterialDto[]>(url, { params }).pipe(
        map((res) => (Array.isArray(res) ? res : (res?.data ?? [])).slice(0, MAX_MATERIALS)),
        map((items) =>
          items.map((m) => ({
            ...(MATERIAL_TYPES[(m.tipo ?? '').toUpperCase()] ?? DEFAULT_MATERIAL_TYPE),
            id: m.id_material,
            title: plainText(m.titulo),
            detail: plainText(showTeacher && m.nombre_docente ? m.nombre_docente : firstItem(m.materias)),
          })),
        ),
      ),
    );
  }

  private magazineCovers(): Observable<Map<number, string>> {
    return this.http.get<{ data?: MagazineCatalogDto[] }>(`${this.api}/magazines`).pipe(
      timeout(REQUEST_TIMEOUT_MS),
      map((res) => {
        const covers = new Map<number, string>();
        for (const m of res?.data ?? []) {
          if (m.portada_url && isHttpsUrl(m.portada_url)) covers.set(m.id_magazine, m.portada_url);
        }
        return covers;
      }),
      // Sin portadas la sección se muestra igual, con una portada de color.
      catchError(() => of(new Map<number, string>())),
    );
  }

  /** Aplica tiempo límite y convierte cualquier error en "sin contenido". */
  private safe<T>(source: Observable<T[]>): Observable<T[]> {
    return source.pipe(
      timeout(REQUEST_TIMEOUT_MS),
      catchError(() => of([] as T[])),
    );
  }
}

function isTruthy(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

/** Solo URLs https (Cloudinary); evita esquemas como javascript: o data:. */
function isHttpsUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https:\/\//i.test(value.trim());
}

function eventImages(e: EventDto): string[] {
  const ordered = [...(e.imagenes ?? [])]
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    .map((img) => img.url);
  const urls = [e.imagen_principal, ...ordered].filter(isHttpsUrl);
  return [...new Set(urls)].slice(0, MAX_EVENT_IMAGES);
}

function firstItem(list: string | null | undefined): string {
  return (list ?? '').split(',')[0]?.trim() ?? '';
}

/**
 * Texto plano para mostrar contenido de la API: quita etiquetas HTML y
 * espacios repetidos. Angular lo interpola siempre como texto (sin innerHTML).
 */
function plainText(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
