/**
 * Modelos de Perfil de usuario. El DTO refleja la respuesta real de
 * backend_Tiozihuatl/src/modules/users/common (GET /api/users/profile).
 */

/** Respuesta de GET /api/users/profile (el objeto llega directo, sin `data`). */
export interface ProfileDto {
  id_usuario: number;
  nombre: string | null;
  a_paterno: string | null;
  a_materno: string | null;
  correo: string | null;
  telefono: string | null;
  /** Solo Estudiante; el backend lo envía en null para Docente y Visitante. */
  matricula: string | null;
  grupo: string | null;
  carrera: string | null;
  semestre: string | null;
  /** MySQL devuelve 0/1. */
  tiene_palabra_secreta: number | boolean | string;
  estado: string | null;
  fecha_registro: string | null;
  ultima_conexion: string | null;
  rol: string | null;
}

/** Cuerpo de PUT /api/users/profile. El backend solo aplica los campos permitidos al rol. */
export interface ProfileUpdateRequest {
  nombre?: string;
  a_paterno?: string;
  a_materno?: string;
  correo?: string;
  telefono?: string;
  palabra_secreta?: string;
}

/** Respuesta de PUT /api/users/profile, PUT /change-password y DELETE /api/users/profile. */
export interface ProfileMessageResponse {
  message?: string;
}

/* ---------- Datos ya listos para la vista ---------- */

export interface Profile {
  id: number;
  nombre: string;
  aPaterno: string;
  aMaterno: string;
  fullName: string;
  correo: string;
  telefono: string;
  matricula: string | null;
  grupo: string | null;
  carrera: string | null;
  semestre: string | null;
  rol: string;
  estado: string | null;
  fechaRegistro: string | null;
  ultimaConexion: string | null;
  tienePalabraSecreta: boolean;
}

export type ProfileErrorKind = 'connection' | 'session' | 'validation' | 'conflict' | 'forbidden' | 'server';

/** Error ya traducido a un mensaje apto para mostrarse al usuario. */
export class ProfileError extends Error {
  constructor(
    readonly kind: ProfileErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'ProfileError';
  }
}
