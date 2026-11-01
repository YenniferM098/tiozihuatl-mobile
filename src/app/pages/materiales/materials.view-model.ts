import { inject, signal } from '@angular/core';
import { Subscription, forkJoin } from 'rxjs';
import { ComplementaryMaterial, MaterialSubject, MaterialTeacher, MaterialsFilters } from '../../core/models/material.models';
import { MaterialsService, materialsError } from '../../core/services/materials.service';
import { SessionService } from '../../core/services/session.service';

const EMPTY_FILTERS: MaterialsFilters = { search: '', materia: '', docente: '', tipo: '' };

/**
 * ViewModel del listado de Materiales (MVVM): conserva resultados, filtros, paginación del servidor
 * y estados de carga. El semestre es el de la cuenta y no forma parte de los filtros editables.
 * Se crea dentro del contexto de inyección de la página.
 */
export class MaterialsViewModel {
  private readonly service = inject(MaterialsService);
  private readonly session = inject(SessionService);
  private request?: Subscription;
  private optionsRequest?: Subscription;
  filters: MaterialsFilters = { ...EMPTY_FILTERS };
  readonly materials = signal<ComplementaryMaterial[]>([]);
  readonly subjects = signal<MaterialSubject[]>([]);
  readonly teachers = signal<MaterialTeacher[]>([]);
  readonly semesterName = signal('');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly optionsError = signal('');
  readonly page = signal(1);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  get filtered(): boolean { return Object.values(this.filters).some(Boolean); }

  /** Al entrar a la vista: carga los catálogos de filtros y la página actual. */
  enter(): void { this.loadOptions(); this.load(); }
  loadOptions(): void {
    this.optionsRequest?.unsubscribe(); this.optionsError.set(''); this.semesterName.set('');
    this.optionsRequest = forkJoin({ subjects: this.service.subjects(), teachers: this.service.teachers(), semesters: this.service.semesters() }).subscribe({
      next: data => {
        this.subjects.set(data.subjects); this.teachers.set(data.teachers);
        this.semesterName.set(data.semesters.find(semester => Number(semester.id_semestre) === Number(this.session.user()?.id_semestre))?.nombre_semestre ?? '');
      },
      error: error => this.optionsError.set(materialsError(error)),
    });
  }
  load(resetPage = false): void {
    this.request?.unsubscribe(); if (resetPage) this.page.set(1);
    this.loading.set(true); this.error.set(''); this.materials.set([]);
    this.request = this.service.list({ ...this.filters, search: this.filters.search.trim().slice(0, 200) }, this.page()).subscribe({
      next: result => { this.materials.set(result.data); this.page.set(result.page); this.total.set(result.total); this.totalPages.set(result.totalPages); this.loading.set(false); },
      error: error => { this.error.set(materialsError(error)); this.loading.set(false); },
    });
  }
  reset(): void { this.filters = { ...EMPTY_FILTERS }; this.load(true); }
  /** Cambia de página si es posible; devuelve si hubo cambio para que la vista vuelva al inicio. */
  changePage(delta: number): boolean {
    const next = this.page() + delta;
    if (this.loading() || next < 1 || next > this.totalPages()) return false;
    this.page.set(next); this.load(); return true;
  }
  /** Al salir de la vista: cancela las peticiones pendientes. */
  leave(): void { this.request?.unsubscribe(); this.optionsRequest?.unsubscribe(); }
}
