/**
 * Modelos de Revistas Digitales. Los DTO reflejan las respuestas de
 * backend_Tiozihuatl/src/modules/magazines; solo incluyen los campos que usa la app.
 * La compra no forma parte de la app móvil: se realiza en el sitio web.
 */

/** Sección de Revistas del sitio web, donde el usuario puede adquirirlas. */
export const MAGAZINES_WEB_URL = 'https://frontend-tiozihuatl.pages.dev/magazines';

/** Revista de GET /magazines (con portada) y GET /magazines/filter (sin portada). */
export interface MagazineCatalogItemDto {
  id_magazine: number;
  titulo: string;
  descripcion: string | null;
  precio: number | string;
  precio_final?: number | string | null;
  descuento_activo?: number | boolean | string | null;
  /** Solo la incluye GET /magazines. */
  portada_url?: string | null;
}

/** Respuesta de GET /magazines. */
export interface MagazineCatalogResponse {
  success?: boolean;
  data?: MagazineCatalogItemDto[];
}

/** Respuesta de GET /magazines/filter. */
export interface MagazineFilterResponse {
  ok?: boolean;
  data?: MagazineCatalogItemDto[];
}

/** Respuesta de GET /magazines/:id (no filtra por estado ni calcula descuentos). */
export interface MagazineDetailResponse {
  data?: {
    id_revista: number;
    titulo: string;
    descripcion: string | null;
    precio: number | string;
    portada_url?: string | null;
  };
}

/** Elemento de GET /magazines/my-purchases (compras pagadas de revistas activas). */
export interface PurchasedMagazineDto {
  id_revista: number;
  titulo: string;
  fecha_compra?: string | null;
}

/** Respuesta de GET /magazines/secure-pdf/:id cuando el usuario adquirió la revista (403 si no). */
export interface SecurePdfResponse {
  url?: string;
}

/** Ordenamientos que admite GET /magazines/filter. */
export type MagazineSort = 'asc' | 'desc' | 'price_asc' | 'price_desc';

/** Parámetros de GET /magazines/filter. */
export interface MagazineFilterParams {
  sort: MagazineSort;
  search?: string;
  letter?: string;
}

/** Búsqueda, letra inicial y orden que elige el usuario en el catálogo. */
export interface MagazineFilters {
  search: string;
  letter: string;
  sort: MagazineSort;
}

/* ---------- Datos ya listos para la vista ---------- */

export interface Magazine {
  id: number;
  title: string;
  description: string;
  /** Portada (primera página generada por Cloudinary) o null si no hay una válida. */
  cover: string | null;
  price: number;
  /** Precio con el descuento vigente; igual a `price` si no hay descuento. */
  finalPrice: number;
  hasDiscount: boolean;
}

export interface PurchasedMagazine {
  id: number;
  title: string;
  cover: string | null;
  purchasedAt: string | null;
}

export interface MagazineDetail extends Magazine {
  /** true si la adquirió, false si no, null si no se pudo verificar. */
  purchased: boolean | null;
}

/** Motivo de un error ya clasificado para mostrar el estado de interfaz adecuado. */
export type MagazineErrorKind = 'connection' | 'session' | 'forbidden' | 'notFound' | 'unavailable' | 'server';

export class MagazineError extends Error {
  constructor(
    readonly kind: MagazineErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'MagazineError';
  }
}
