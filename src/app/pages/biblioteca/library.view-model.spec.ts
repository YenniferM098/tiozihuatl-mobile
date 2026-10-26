import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { LibraryBook } from '../../core/models/library.models';
import { LibraryService } from '../../core/services/library.service';
import { SessionService } from '../../core/services/session.service';
import { LibraryViewModel } from './library.view-model';

const books = (n: number): LibraryBook[] => Array.from({ length: n }, (_, i) => ({
  id: i + 1, titulo: `Libro ${i + 1}`, autores: null, editorial: null, materias: null, tiene_digital: 1, tiene_fisico: 0, pdf_url: null,
}));

describe('LibraryViewModel (MVVM)', () => {
  let service: { catalog: ReturnType<typeof vi.fn>; subjects: ReturnType<typeof vi.fn>; semesters: ReturnType<typeof vi.fn> };
  let vm: LibraryViewModel;

  beforeEach(() => {
    service = { catalog: vi.fn(() => of(books(23))), subjects: vi.fn(() => of([])), semesters: vi.fn(() => of([])) };
    TestBed.configureTestingModule({ providers: [
      { provide: LibraryService, useValue: service },
      { provide: SessionService, useValue: { user: () => ({ id: 1, rol: 'Docente' }) } },
    ] });
    vm = TestBed.runInInjectionContext(() => new LibraryViewModel());
  });

  it('pagina los resultados de diez en diez sin salirse de los límites', () => {
    vm.enter();
    expect(vm.totalPages).toBe(3);
    expect(vm.visibleBooks.map(b => b.id)).toEqual(books(10).map(b => b.id));
    vm.changePage(-1);
    expect(vm.page()).toBe(1);
    vm.changePage(1); vm.changePage(1); vm.changePage(1);
    expect(vm.page()).toBe(3);
    expect(vm.visibleBooks).toHaveLength(3);
  });

  it('recorta la búsqueda y limpia los filtros', () => {
    vm.enter();
    vm.filters.search = '  Anatomía  ';
    vm.filters.formato = 'DIGITAL';
    expect(vm.filtered).toBe(true);
    vm.load();
    expect(service.catalog).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Anatomía', formato: 'DIGITAL' }));
    vm.reset();
    expect(vm.filtered).toBe(false);
    expect(service.catalog).toHaveBeenCalledTimes(3);
  });

  it('informa cuando no se pueden cargar los filtros', () => {
    service.subjects.mockReturnValue(throwError(() => new Error('Sin conexión')));
    vm.enter();
    expect(vm.optionsError()).toBe('No fue posible cargar los filtros de materia y semestre.');
  });
});
