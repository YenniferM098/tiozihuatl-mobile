import { UserRole } from '../../../core/models/auth.models';

/** Un paso de la guía de primer uso (MEJ-01): resalta un elemento de la pantalla. */
export interface GuidePaso {
  /** Selector CSS del elemento que se resalta (una opción de la barra o un elemento del módulo). */
  objetivo: string;
  titulo: string;
  texto: string;
}

/** Módulos con guía propia, que aparece la primera vez que se entra a cada uno. */
export type GuideModulo = 'biblioteca' | 'revistas' | 'materiales' | 'perfil';

const marca = (nombre: string) => `[data-guia="${nombre}"]`;

// ---------------------------------------------------------------- Barra inferior

const opcion = (tab: string) => `ion-tab-button[tab="${tab}"]`;

const INICIO_MIEMBRO: GuidePaso = {
  objetivo: opcion('home'),
  titulo: 'Inicio',
  texto: '¡Bienvenido a Tiozihuatl! Aquí verás los eventos y lo más reciente de la Biblioteca, las Revistas y los Materiales.',
};

const INICIO_VISITANTE: GuidePaso = {
  objetivo: opcion('home'),
  titulo: 'Inicio',
  texto: '¡Bienvenido a Tiozihuatl! Aquí verás los eventos del Instituto y las revistas más recientes.',
};

/**
 * Guía de la barra inferior: un solo paso que señala Inicio con la bienvenida.
 * El texto del Visitante no menciona Biblioteca ni Materiales, que no tiene.
 */
export function pasosGuia(rol: UserRole | null | undefined): GuidePaso[] {
  return [esMiembro(rol) ? INICIO_MIEMBRO : INICIO_VISITANTE];
}

// ---------------------------------------------------------------- Inicio de sesión

const LOGIN: GuidePaso[] = [
  {
    objetivo: marca('login-rol'),
    titulo: 'Elige tu tipo de usuario',
    texto: 'Antes de entrar, selecciona si eres Estudiante, Docente o Visitante. Debe ser el de tu cuenta.',
  },
  {
    objetivo: marca('login-recuperar'),
    titulo: '¿Olvidaste tu contraseña?',
    texto: 'Si no la recuerdas, toca aquí para recuperarla con tu correo.',
  },
];

/** Pasos de la guía del inicio de sesión: el selector de rol y la recuperación de contraseña. */
export function pasosLogin(): GuidePaso[] {
  return LOGIN;
}

// ---------------------------------------------------------------- Módulos

const GUIAS_MODULO: Record<GuideModulo, GuidePaso[]> = {
  biblioteca: [
    { objetivo: marca('biblioteca-buscador'), titulo: 'Buscar libros', texto: 'Escribe el título o el autor del libro que buscas.' },
    { objetivo: marca('biblioteca-filtros'), titulo: 'Filtros y ordenamiento', texto: 'Filtra por materia, semestre o formato digital, y ordena por autor.' },
    { objetivo: marca('biblioteca-libro'), titulo: 'Detalle del libro', texto: 'Toca un libro para ver su información y leerlo si tiene versión digital.' },
  ],
  revistas: [
    { objetivo: marca('revistas-vistas'), titulo: 'Todas y Mis revistas', texto: 'Cambia entre el catálogo completo y las revistas que ya adquiriste.' },
    { objetivo: marca('revistas-buscador'), titulo: 'Buscar revistas', texto: 'Escribe el título de la revista; no importan los acentos ni las mayúsculas.' },
    { objetivo: marca('revistas-filtros'), titulo: 'Filtros y ordenamiento', texto: 'Filtra por letra inicial y ordena por título o por precio.' },
    { objetivo: marca('revistas-revista'), titulo: 'Detalle de la revista', texto: 'Toca una revista para ver su detalle. La compra se hace en el sitio web del Instituto.' },
  ],
  materiales: [
    { objetivo: marca('materiales-buscador'), titulo: 'Buscar materiales', texto: 'Busca por el título o la descripción del material.' },
    { objetivo: marca('materiales-filtros'), titulo: 'Filtrar materiales', texto: 'Filtra por materia, tipo de recurso o docente.' },
    { objetivo: marca('materiales-material'), titulo: 'Ver o descargar', texto: 'Toca un material para ver su detalle, abrirlo o descargarlo.' },
  ],
  perfil: [
    { objetivo: marca('perfil-editar'), titulo: 'Tus datos', texto: 'Actualiza tu nombre, correo o teléfono de contacto.' },
    { objetivo: marca('perfil-contrasena'), titulo: 'Cambiar contraseña', texto: 'Cambia la contraseña con la que inicias sesión.' },
    { objetivo: marca('perfil-salir'), titulo: 'Cerrar sesión', texto: 'Sal de tu cuenta cuando termines, sobre todo en un dispositivo compartido.' },
  ],
};

/** Guía del módulo de una ruta de la barra (/biblioteca, /revistas…), o null si no tiene o el rol no lo usa. */
export function moduloDeRuta(url: string, rol: UserRole | null | undefined): GuideModulo | null {
  const ruta = url.split(/[?#]/)[0].replace(/\/+$/, '');
  const modulo = ruta.startsWith('/') ? ruta.slice(1) : ruta;
  if (!(modulo in GUIAS_MODULO)) return null;
  if ((modulo === 'biblioteca' || modulo === 'materiales') && !esMiembro(rol)) return null;
  return modulo as GuideModulo;
}

export function pasosModulo(modulo: GuideModulo): GuidePaso[] {
  return GUIAS_MODULO[modulo];
}

function esMiembro(rol: UserRole | null | undefined): boolean {
  return rol === 'Estudiante' || rol === 'Docente';
}
