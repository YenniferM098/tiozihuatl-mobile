import { InjectionToken, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpProfileRepository } from '../../data/repositories/http-profile.repository';
import { ProfileDto, ProfileMessageResponse, ProfileUpdateRequest } from '../../core/models/profile.models';

/** Cuerpo de PUT /users/profile/change-password con los nombres que espera el backend. */
export interface ChangePasswordRequest {
  contrasenaActual: string;
  nuevaContrasena: string;
}

/**
 * Contrato de acceso al perfil del usuario autenticado (patrón Repository).
 * La capa de aplicación depende de esta interfaz y no de HttpClient.
 */
export interface ProfileRepository {
  /** GET /users/profile: datos de la cuenta, rol, matrícula y estado. */
  profile(): Observable<ProfileDto>;
  /** PUT /users/profile: datos personales permitidos o palabra secreta. */
  update(data: ProfileUpdateRequest): Observable<ProfileMessageResponse>;
  /** PUT /users/profile/change-password. */
  changePassword(data: ChangePasswordRequest): Observable<ProfileMessageResponse>;
  /** DELETE /users/profile: el backend solo lo permite a la cuenta Visitante. */
  deleteAccount(): Observable<ProfileMessageResponse>;
}

/** Punto de inyección del repositorio; la fábrica entrega la implementación HTTP (patrón Factory). */
export const PROFILE_REPOSITORY = new InjectionToken<ProfileRepository>('PROFILE_REPOSITORY', {
  providedIn: 'root',
  factory: () => inject(HttpProfileRepository),
});
