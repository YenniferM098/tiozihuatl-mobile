/** Cuerpo esperado por POST /api/auth/pre-registro (paso 1: datos personales). */
export interface PreRegisterRequest {
  nombre: string;
  apaterno: string;
  amaterno: string;
  correo: string;
  telefono: string;
}

/** Respuesta de POST /api/auth/pre-registro. */
export interface PreRegisterResponse {
  message: string;
  retryAfterSeconds?: number;
}

/** Cuerpo esperado por POST /api/auth/finalizar-registro (paso 2: seguridad de la cuenta). */
export interface FinishRegisterRequest {
  correo: string;
  contrasena: string;
  palabra_secreta: string;
}

/** Respuesta de POST /api/auth/finalizar-registro. */
export interface FinishRegisterResponse {
  success: boolean;
  message: string;
}

/** Respuesta de GET /api/auth/check-email y GET /api/auth/check-phone. */
export interface ExistsResponse {
  exists: boolean;
}

/** Resultado del pre-registro ya interpretado para la pantalla. */
export type PreRegisterResult =
  | { kind: 'sent'; message: string; retryAfterSeconds: number }
  | { kind: 'cooldown'; message: string; retryAfterSeconds: number }
  | { kind: 'alreadyVerified'; message: string };
