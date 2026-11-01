import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ComplementaryMaterial } from '../../core/models/material.models';
import { MaterialsService } from '../../core/services/materials.service';
import { SessionService } from '../../core/services/session.service';
import { MaterialsViewModel } from './materials.view-model';

const material = (id: number): ComplementaryMaterial => ({
  id_material: id, titulo: `Material ${id}`, descripcion: null, tipo: 'PDF', id_usuario: 4, nombre_docente: 'Docente',
  materias: 'Anatomía', semestres: 'Segundo semestre', fecha_creacion: null, activo: 1, visibilidad: 'PUBLICO',
});

describe('MaterialsViewModel (MVVM)', () => {
  let service: { list: ReturnType<typeof vi.fn>; subjects: ReturnType<typeof vi.fn>; teachers: ReturnType<typeof vi.fn>; semesters: ReturnType<typeof vi.fn> };
  let vm: MaterialsViewModel;

  beforeEach(() => {
    service = {
      list: vi.fn((_filters, page: number) => of({ data: [material(page)], total: 19, page, limit: 9, totalPages: 3 })),
      subjects: vi.fn(() => of([{ id: 1, nombre: 'Anatomía' }])),
      teachers: vi.fn(() => of([{ id_usuario: 4, nombre: 'Docente', total_materiales: 19 }])),
      semesters: vi.fn(() => of([{ id_semestre: 1, nombre_semestre: 'Primer semestre' }, { id_semestre: 2, nombre_semestre: 'Segundo semestre' }])),
    };
    TestBed.configureTestingModule({ providers: [
      { provide: MaterialsService, useValue: service },
      { provide: SessionService, useValue: { user: () => ({ id_usuario: 1, rol: 'Estudiante', id_semestre: 2 }) } },
    ] });
    vm = TestBed.runInInjectionContext(() => new MaterialsViewModel());
  });

  it('al entrar carga filtros, el nombre del semestre de la cuenta y la primera página', () => {
    vm.enter();
    expect(vm.subjects()).toHaveLength(1);
    expect(vm.teachers()).toHaveLength(1);
    expect(vm.semesterName()).toBe('Segundo semestre');
    expect(vm.materials().map(item => item.id_material)).toEqual([1]);
    expect(vm.total()).toBe(19);
    expect(vm.totalPages()).toBe(3);
    expect(vm.loading()).toBe(false);
  });

  it('pagina en el servidor sin salirse de los límites', () => {
    vm.enter();
    expect(vm.changePage(-1)).toBe(false);
    expect(vm.changePage(1)).toBe(true);
    expect(service.list).toHaveBeenLastCalledWith(expect.anything(), 2);
    vm.changePage(1);
    expect(vm.changePage(1)).toBe(false);
    expect(vm.page()).toBe(3);
  });

  it('recorta la búsqueda, vuelve a la primera página al limpiar y no envía el semestre como filtro', () => {
    vm.enter();
    vm.changePage(1);
    vm.filters = { search: '  anatomía  ', materia: '1', docente: '', tipo: 'PDF' };
    expect(vm.filtered).toBe(true);
    vm.load(true);
    expect(service.list).toHaveBeenLastCalledWith({ search: 'anatomía', materia: '1', docente: '', tipo: 'PDF' }, 1);
    vm.reset();
    expect(vm.filtered).toBe(false);
    expect(vm.page()).toBe(1);
  });

  it('informa los errores de la lista y de los filtros por separado', () => {
    service.list.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    service.subjects.mockReturnValue(throwError(() => new Error('Sin conexión')));
    vm.enter();
    expect(vm.error()).toContain('Contenido no disponible para este usuario');
    expect(vm.optionsError()).toContain('No fue posible conectar');
    expect(vm.loading()).toBe(false);
  });
});
