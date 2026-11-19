import { UserRole } from '../../../core/models/auth.models';

/** Un paso de la guía de primer uso (MEJ-01): resalta una opción de la barra inferior. */
export interface GuidePaso {
  /** Pestaña que se resalta (el mismo segmento que usa la barra inferior). */
  tab: string;
  titulo: string;
  texto: string;
}

const INICIO_MIEMBRO: GuidePaso = {
  tab: 'home',
  titulo: 'Inicio',
  texto: '¡Bienvenido a Tiozihuatl! Aquí verás los eventos y lo más reciente de la Biblioteca, las Revistas y los Materiales.',
};

const INICIO_VISITANTE: GuidePaso = {
  tab: 'home',
  titulo: 'Inicio',
  texto: '¡Bienvenido a Tiozihuatl! Aquí verás los eventos del Instituto y las revistas más recientes.',
};

const BIBLIOTECA: GuidePaso = {
  tab: 'biblioteca',
  titulo: 'Biblioteca',
  texto: 'Consulta el acervo, busca y filtra libros, y lee los que tienen versión digital.',
};

const REVISTAS: GuidePaso = {
  tab: 'revistas',
  titulo: 'Revistas',
  texto: 'Explora las revistas digitales y lee las que adquiriste en el sitio web.',
};

const MATERIALES: GuidePaso = {
  tab: 'materiales',
  titulo: 'Materiales complementarios',
  texto: 'Encuentra los materiales de apoyo de tus materias: PDF, presentaciones, videos y más.',
};

const PERFIL: GuidePaso = {
  tab: 'perfil',
  titulo: 'Perfil',
  texto: 'Revisa y actualiza tus datos, cambia tu contraseña o cierra sesión.',
};

/**
 * Pasos de la guía según el rol, en el mismo orden que la barra inferior.
 * Estudiante y Docente: 5 pasos. Visitante (o sin rol): Inicio, Revistas y Perfil.
 */
export function pasosGuia(rol: UserRole | null | undefined): GuidePaso[] {
  const esMiembro = rol === 'Estudiante' || rol === 'Docente';
  return esMiembro
    ? [INICIO_MIEMBRO, BIBLIOTECA, REVISTAS, MATERIALES, PERFIL]
    : [INICIO_VISITANTE, REVISTAS, PERFIL];
}
