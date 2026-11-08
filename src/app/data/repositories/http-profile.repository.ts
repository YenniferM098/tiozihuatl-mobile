import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ProfileDto, ProfileMessageResponse, ProfileUpdateRequest } from '../../core/models/profile.models';
import type { ChangePasswordRequest, ProfileRepository } from '../../domain/repositories/profile.repository';

/** Implementación del repositorio del perfil sobre la API REST (el interceptor agrega el token). */
@Injectable({ providedIn: 'root' })
export class HttpProfileRepository implements ProfileRepository {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/users/profile`;

  profile(): Observable<ProfileDto> {
    return this.http.get<ProfileDto>(this.api);
  }

  update(data: ProfileUpdateRequest): Observable<ProfileMessageResponse> {
    return this.http.put<ProfileMessageResponse>(this.api, data);
  }

  changePassword(data: ChangePasswordRequest): Observable<ProfileMessageResponse> {
    return this.http.put<ProfileMessageResponse>(`${this.api}/change-password`, data);
  }

  deleteAccount(): Observable<ProfileMessageResponse> {
    return this.http.delete<ProfileMessageResponse>(this.api);
  }
}
