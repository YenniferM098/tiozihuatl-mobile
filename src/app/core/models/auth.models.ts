/** Roles habilitados en la app móvil (nombres exactos de la tabla `roles` del backend). */
export type UserRole = 'Estudiante' | 'Docente' | 'Visitante';

export const MOBILE_ROLES: readonly UserRole[] = ['Estudiante', 'Docente', 'Visitante'];

/** Cuerpo esperado por POST /api/auth/login. */
export interface LoginRequest {
  credential: string;
  contrasena: string;
  rolSeleccionado: UserRole;
}

export interface AuthUser {
  id: number;
  id_usuario: number;
  nombre?: string;
  rol: UserRole;
  correo: string;
  id_semestre: number | null;
}

/** Respuesta de POST /api/auth/login y POST /api/auth/refresh. */
export interface AuthResponse {
  message: string;
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}
