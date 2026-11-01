import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MaterialSemester, MaterialSubject, MaterialTeacher, MaterialsResponse } from '../../core/models/material.models';
import type { MaterialsQuery, MaterialsRepository } from '../../domain/repositories/materials.repository';

/** Implementación del repositorio de materiales complementarios sobre la API REST. */
@Injectable({ providedIn: 'root' })
export class HttpMaterialsRepository implements MaterialsRepository {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/material`;

  list(query: MaterialsQuery): Observable<MaterialsResponse> {
    let params = new HttpParams().set('semestre', query.semestre).set('page', String(query.page)).set('limit', String(query.limit));
    for (const key of ['search', 'materia', 'docente', 'tipo'] as const) {
      const value = query[key];
      if (value) params = params.set(key, value);
    }
    return this.http.get<MaterialsResponse>(`${this.api}/materiales/todos`, { params });
  }

  subjects(): Observable<MaterialSubject[]> {
    return this.http.get<MaterialSubject[]>(`${this.api}/materias`);
  }

  teachers(): Observable<MaterialTeacher[]> {
    return this.http.get<MaterialTeacher[]>(`${this.api}/docentes`);
  }

  semesters(): Observable<MaterialSemester[]> {
    return this.http.get<MaterialSemester[]>(`${this.api}/semestres`);
  }

  // El interceptor institucional no envía el token a Cloudinary. No se modifican URLs ni firmas.
  file(url: string): Observable<HttpResponse<Blob>> {
    return this.http.get(url, { responseType: 'blob', observe: 'response' });
  }

  fileStart(url: string): Observable<HttpResponse<ArrayBuffer>> {
    return this.http.get(url, { headers: { Range: 'bytes=0-511' }, responseType: 'arraybuffer', observe: 'response' });
  }
}
