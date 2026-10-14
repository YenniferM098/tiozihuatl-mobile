/**
 * Modelos de Inicio. Solo incluyen los campos que Inicio usa de las respuestas
 * existentes del backend (eventos, catálogo, revistas y materiales).
 */

/** Imagen de GET /api/events (tabla evento_imagenes). */
export interface EventImageDto {
  id_imagen: number;
  url: string;
  orden?: number;
}

/** Evento de GET /api/events. `destacado` llega como 0/1 desde MySQL. */
export interface EventDto {
  id_evento: number;
  titulo: string;
  descripcion: string;
  destacado: number | boolean | string;
  imagen_principal: string | null;
  imagenes?: EventImageDto[];
}

/** Libro de GET /api/catalog. */
export interface BookDto {
  id: number;
  titulo: string;
  autores: string | null;
  editorial: string | null;
  materias: string | null;
  tiene_digital: number;
  tiene_fisico: number;
}

/** Revista de GET /api/magazines y GET /api/magazines/filter (solo el primero trae portada). */
export interface MagazineCatalogDto {
  id_magazine: number;
  titulo: string;
  portada_url?: string;
}

/** Material de /api/material/materiales/todos o /api/docente/materiales/mis-materiales. */
export interface MaterialDto {
  id_material: number;
  titulo: string;
  tipo: string | null;
  materias: string | null;
  nombre_docente?: string;
}

export interface PagedResponse<T> {
  data: T[];
}

/* ---------- Datos ya listos para la vista ---------- */

export interface FeaturedEvent {
  id: number;
  title: string;
  /** Máximo 3 imágenes: la principal primero. */
  images: string[];
}

export interface HomeBook {
  id: number;
  title: string;
  /** Primera página del PDF; null si no hay un PDF válido. */
  cover: string | null;
}

export interface HomeMagazine {
  id: number;
  title: string;
  cover: string | null;
}


export interface HomeMaterial {
  id: number;
  title: string;
  type: string;
  /** Icono Phosphor según el tipo de archivo, sin el prefijo "ph-". */
  icon: string;
  detail: string;
}
