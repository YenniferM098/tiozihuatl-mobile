import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { LibraryBook } from '../../core/models/library.models';
import { LibraryService } from '../../core/services/library.service';
import { SessionService } from '../../core/services/session.service';
import { LibraryPage } from './library.page';

const BOOK: LibraryBook = { id: 1, titulo: 'Libro real de respuesta de prueba', autores: 'Autor', editorial: null, materias: null, tiene_digital: 0, tiene_fisico: 1, pdf_url: null };

describe('Catálogo: carga visible y solicitudes necesarias', () => {
  let response: Subject<LibraryBook[]>;
  let catalog: ReturnType<typeof vi.fn>;
  let subjects: ReturnType<typeof vi.fn>;
  let id: number;
  beforeEach(() => {
    response = new Subject<LibraryBook[]>();
    catalog = vi.fn(() => response);
    subjects = vi.fn(() => of([]));
    id = 1;
    TestBed.configureTestingModule({ imports: [LibraryPage], providers: [provideRouter([]),
      { provide: LibraryService, useValue: { catalog, subjects, semesters: () => of([]) } },
      { provide: SessionService, useValue: { user: () => ({ id, rol: 'Estudiante' }) } },
    ] });
  });
  it('muestra carga y actualiza los resultados al responder sin esperar una interacción', async () => {
    const fixture = TestBed.createComponent(LibraryPage);
    await fixture.whenStable();
    fixture.componentInstance.ionViewWillEnter();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Cargando catálogo');
    response.next([BOOK]); response.complete();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain(BOOK.titulo);
    expect(fixture.nativeElement.textContent).not.toContain('Cargando catálogo');
  });
  it('evita repetir catálogo y filtros al regresar del detalle con datos recientes', () => {
    const page = TestBed.runInInjectionContext(() => new LibraryPage());
    page.ionViewWillEnter(); response.next([BOOK]); response.complete();
    page.ionViewWillLeave(); page.ionViewWillEnter();
    expect(catalog).toHaveBeenCalledTimes(1);
    expect(subjects).toHaveBeenCalledTimes(1);
    expect(page.books()).toEqual([BOOK]);
  });
  it('no duplica una búsqueda pendiente, pero consulta cuando cambian los filtros', () => {
    const page = TestBed.runInInjectionContext(() => new LibraryPage());
    page.ionViewWillEnter(); page.load();
    expect(catalog).toHaveBeenCalledTimes(1);
    page.filters.search = 'Anatomía'; page.load();
    expect(catalog).toHaveBeenCalledTimes(2);
    expect(catalog).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Anatomía' }));
  });
  it('descarta datos y peticiones de una sesión anterior', () => {
    const page = TestBed.runInInjectionContext(() => new LibraryPage());
    page.ionViewWillEnter(); response.next([BOOK]); response.complete();
    id = 2; page.ionViewWillEnter();
    expect(catalog).toHaveBeenCalledTimes(2);
    expect(subjects).toHaveBeenCalledTimes(2);
  });
  it('permite reintentar tras un fallo', () => {
    const page = TestBed.runInInjectionContext(() => new LibraryPage());
    page.ionViewWillEnter(); response.error(new Error('Sin conexión'));
    expect(page.loading()).toBe(false);
    expect(page.error()).toContain('No fue posible conectar');
    response = new Subject(); page.load(true);
    expect(catalog).toHaveBeenCalledTimes(2);
    expect(page.loading()).toBe(true);
  });
});
