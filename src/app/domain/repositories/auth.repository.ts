import { InjectionToken, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpAuthRepository } from '../../data/repositories/http-auth.repository';
import { AuthResponse, LoginRequest } from '../../core/models/auth.models';
import {
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  ValidateRecoveryTokenResponse,
} from '../../core/models/password.models';
import {
  ExistsResponse,
  FinishRegisterRequest,
  FinishRegisterResponse,
  PreRegisterRequest,
  PreRegisterResponse,
} from '../../core/models/register.models';

/**
 * Contrato de acceso a los datos de autenticación (patrón Repository).
 * La capa de aplicación depende de esta interfaz y no de HttpClient.
 */
export interface AuthRepository {
  login(data: LoginRequest): Observable<AuthResponse>;
  refresh(idUsuario: number, refreshToken: string): Observable<AuthResponse>;
  logout(idUsuario: number, accessToken: string): Observable<unknown>;
  emailExists(correo: string): Observable<ExistsResponse>;
  phoneExists(telefono: string): Observable<ExistsResponse>;
  preRegister(data: PreRegisterRequest): Observable<PreRegisterResponse>;
  finishRegister(data: FinishRegisterRequest): Observable<FinishRegisterResponse>;
  forgotPassword(data: ForgotPasswordRequest): Observable<ForgotPasswordResponse>;
  validateRecoveryToken(token: string): Observable<ValidateRecoveryTokenResponse>;
  resetPassword(data: ResetPasswordRequest): Observable<ResetPasswordResponse>;
}

/** Punto de inyección del repositorio; la fábrica entrega la implementación HTTP (patrón Factory). */
export const AUTH_REPOSITORY = new InjectionToken<AuthRepository>('AUTH_REPOSITORY', {
  providedIn: 'root',
  factory: () => inject(HttpAuthRepository),
});
