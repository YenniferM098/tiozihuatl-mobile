/** Cuerpo esperado por POST /api/password/forgot. */
export interface ForgotPasswordRequest {
  correo: string;
  palabra_secreta: string;
}

/**
 * Respuesta de POST /api/password/forgot. El backend responde 200 incluso cuando la
 * palabra secreta es incorrecta; en ese caso marca `error: true` con un mensaje para el usuario.
 */
export interface ForgotPasswordResponse {
  message?: string;
  error?: boolean | string;
}

/** Respuesta de GET /api/password/validate. */
export interface ValidateRecoveryTokenResponse {
  valid: boolean;
}

/** Cuerpo esperado por POST /api/password/reset. */
export interface ResetPasswordRequest {
  token: string;
  nuevaContrasena: string;
}

/** Respuesta de POST /api/password/reset. */
export interface ResetPasswordResponse {
  message: string;
}
