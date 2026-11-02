import { HttpResponse } from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpMaterialsRepository } from '../../data/repositories/http-materials.repository';
import { MaterialSemester, MaterialSubject, MaterialTeacher, MaterialsResponse } from '../../core/models/material.models';

/** Parámetros de GET /material/materiales/todos: el semestre siempre es el de la cuenta. */
export interface MaterialsQuery {
  semestre: string;
  page: number;
  limit: number;
  search?: string;
  materia?: string;
  docente?: string;
  tipo?: string;
}

/** Contrato de acceso a los materiales complementarios (patrón Repository). */
export interface MaterialsRepository {
  list(query: MaterialsQuery): Observable<MaterialsResponse>;
  subjects(): Observable<MaterialSubject[]>;
  teachers(): Observable<MaterialTeacher[]>;
  semesters(): Observable<MaterialSemester[]>;
  /** Archivo completo desde Cloudinary, con sus cabeceras para validar tipo y nombre. */
  file(url: string): Observable<HttpResponse<Blob>>;
  /** Primeros 512 bytes del archivo, para validar un video sin descargarlo completo. */
  fileStart(url: string): Observable<HttpResponse<ArrayBuffer>>;
}

/** Punto de inyección del repositorio; la fábrica entrega la implementación HTTP (patrón Factory). */
export const MATERIALS_REPOSITORY = new InjectionToken<MaterialsRepository>('MATERIALS_REPOSITORY', {
  providedIn: 'root',
  factory: () => inject(HttpMaterialsRepository),
});
