import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
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
import type { AuthRepository } from '../../domain/repositories/auth.repository';

/** Implementación del repositorio de autenticación sobre la API REST. */
@Injectable({ providedIn: 'root' })
export class HttpAuthRepository implements AuthRepository {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/auth`;
  private readonly passwordApi = `${environment.apiUrl}/password`;

  login(data: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.api}/login`, data);
  }

  refresh(idUsuario: number, refreshToken: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.api}/refresh`, { id_usuario: idUsuario, refreshToken });
  }

  logout(idUsuario: number, accessToken: string): Observable<unknown> {
    return this.http.post(
      `${this.api}/logout`,
      { id_usuario: idUsuario },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
  }

  emailExists(correo: string): Observable<ExistsResponse> {
    return this.http.get<ExistsResponse>(`${this.api}/check-email`, { params: { correo } });
  }

  phoneExists(telefono: string): Observable<ExistsResponse> {
    return this.http.get<ExistsResponse>(`${this.api}/check-phone`, { params: { telefono } });
  }

  preRegister(data: PreRegisterRequest): Observable<PreRegisterResponse> {
    return this.http.post<PreRegisterResponse>(`${this.api}/pre-registro`, data);
  }

  finishRegister(data: FinishRegisterRequest): Observable<FinishRegisterResponse> {
    return this.http.post<FinishRegisterResponse>(`${this.api}/finalizar-registro`, data);
  }

  forgotPassword(data: ForgotPasswordRequest): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>(`${this.passwordApi}/forgot`, data);
  }

  validateRecoveryToken(token: string): Observable<ValidateRecoveryTokenResponse> {
    return this.http.get<ValidateRecoveryTokenResponse>(`${this.passwordApi}/validate`, { params: { token } });
  }

  resetPassword(data: ResetPasswordRequest): Observable<ResetPasswordResponse> {
    return this.http.post<ResetPasswordResponse>(`${this.passwordApi}/reset`, data);
  }
}
