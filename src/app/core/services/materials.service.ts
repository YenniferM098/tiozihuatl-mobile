import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, switchMap, throwError, timeout } from 'rxjs';
import { ComplementaryMaterial, MaterialSemester, MaterialSubject, MaterialTeacher, MaterialsFilters, MaterialsResponse } from '../models/material.models';
import { MATERIALS_REPOSITORY } from '../../domain/repositories/materials.repository';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
export function materialsError(error: unknown): string {
  if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) return 'Contenido no disponible para este usuario. Revisa tu sesión.';
  return 'No fue posible conectar con el servidor. Revisa tu conexión e intenta nuevamente.';
}
/** Casos de uso de Materiales: valida sesión, rol y semestre de la cuenta; los datos vienen del repositorio. */
@Injectable({ providedIn: 'root' })
export class MaterialsService {
  private readonly repository = inject(MATERIALS_REPOSITORY);
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionService);
  private authorized<T>(request: () => Observable<T>): Observable<T> {
    return this.auth.ensureValidSession().pipe(switchMap(valid => {
      const role = this.session.user()?.rol;
      if (!valid || (role !== 'Estudiante' && role !== 'Docente')) return throwError(() => new HttpErrorResponse({ status: 403 }));
      return request().pipe(timeout(45000));
    }));
  }
  list(filters?: MaterialsFilters, page = 1, limit = 9): Observable<MaterialsResponse> {
    return this.authorized(() => {
      // El semestre se toma de la sesión validada: los filtros no pueden sobrescribirlo.
      const semestre = String(this.session.user()?.id_semestre ?? '');
      return this.repository.list({ semestre, page, limit, search: filters?.search, materia: filters?.materia, docente: filters?.docente, tipo: filters?.tipo });
    });
  }
  subjects(): Observable<MaterialSubject[]> { return this.authorized(() => this.repository.subjects()); }
  teachers(): Observable<MaterialTeacher[]> { return this.authorized(() => this.repository.teachers()); }
  semesters(): Observable<MaterialSemester[]> { return this.authorized(() => this.repository.semesters()); }
  detail(id: number): Observable<ComplementaryMaterial | null> {
    if (!Number.isSafeInteger(id) || id <= 0) return of(null);
    const scope = this.scope();
    // No existe detalle público por id: se busca en el mismo listado de consulta autorizado.
    const find = (page: number): Observable<ComplementaryMaterial | null> => this.list(undefined, page, 50).pipe(switchMap(response => {
      if (scope !== this.scope()) return throwError(() => new HttpErrorResponse({ status: 403 }));
      const material = response.data.find(item => Number(item.id_material) === id && Number(item.activo) === 1 && item.visibilidad === 'PUBLICO');
      if (material) return of(material);
      return response.page < response.totalPages ? find(response.page + 1) : of(null);
    }));
    return find(1);
  }
  private scope(): string {
    const user = this.session.user();
    return `${user?.id_usuario}:${user?.rol}:${user?.id_semestre}`;
  }
}
