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

describe('Catálogo: título de sección en la barra (#229)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LibraryPage], providers: [provideRouter([]),
      { provide: LibraryService, useValue: { catalog: () => of([BOOK, { ...BOOK, id: 2 }]), subjects: () => of([]), semesters: () => of([]) } },
      { provide: SessionService, useValue: { user: () => ({ id: 1, rol: 'Estudiante' }) } },
    ] });
  });
  it('muestra el título con el total del acervo y el buscador en la barra', async () => {
    const fixture = TestBed.createComponent(LibraryPage);
    fixture.componentInstance.ionViewWillEnter();
    await fixture.whenStable();
    const header: HTMLElement = fixture.nativeElement.querySelector('ion-header');
    expect(header.querySelector('app-section-title h1')?.textContent).toBe('Biblioteca Digital');
    expect(header.querySelector('.section-count')?.textContent).toBe('2 libros');
    expect(header.querySelector('ion-searchbar[data-guia="biblioteca-buscador"]')).not.toBeNull();
  });
  it('con filtros no muestra el total del acervo', () => {
    const page = TestBed.runInInjectionContext(() => new LibraryPage());
    page.ionViewWillEnter();
    expect(page.countLabel).toBe('2 libros');
    page.filters.search = 'Anatomía';
    expect(page.countLabel).toBe('');
  });
});

describe('Catálogo: lista rediseñada (#229)', () => {
  let response: Subject<LibraryBook[]>;
  let catalog: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    response = new Subject<LibraryBook[]>();
    catalog = vi.fn(() => response);
    TestBed.configureTestingModule({ imports: [LibraryPage], providers: [provideRouter([]),
      { provide: LibraryService, useValue: { catalog, subjects: () => of([]), semesters: () => of([]), preview: () => of({ previewUrl: '' }), safeResource: () => false } },
      { provide: SessionService, useValue: { user: () => ({ id: 1, rol: 'Estudiante' }) } },
    ] });
  });
  it('muestra siluetas mientras carga y los filtros como chips', async () => {
    const fixture = TestBed.createComponent(LibraryPage);
    fixture.componentInstance.ionViewWillEnter();
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-list-skeleton')).not.toBeNull();
    expect(el.querySelectorAll('.chip-row ion-select.filter-chip').length).toBe(4);
    expect(el.querySelector('.chip-row')?.getAttribute('data-guia')).toBe('biblioteca-filtros');
  });
  it('la tarjeta muestra los semestres en etiquetas cortas', async () => {
    const fixture = TestBed.createComponent(LibraryPage);
    fixture.componentInstance.ionViewWillEnter();
    response.next([{ ...BOOK, semestres: 'Primer semestre,Segundo semestre' }]); response.complete();
    await fixture.whenStable();
    const tags = [...fixture.nativeElement.querySelectorAll('.semester-tag')].map((t: Element) => t.textContent);
    expect(tags).toEqual(['1.º', '2.º']);
  });
  it('deslizar para actualizar recarga el catálogo y cierra el indicador al terminar', async () => {
    const fixture = TestBed.createComponent(LibraryPage);
    const page = fixture.componentInstance;
    page.ionViewWillEnter(); response.next([BOOK]); response.complete();
    await fixture.whenStable();
    response = new Subject<LibraryBook[]>();
    const complete = vi.fn();
    page.refresh({ target: { complete } } as unknown as Event);
    expect(catalog).toHaveBeenCalledTimes(2);
    await fixture.whenStable();
    expect(complete).not.toHaveBeenCalled();
    response.next([BOOK]); response.complete();
    await fixture.whenStable();
    expect(complete).toHaveBeenCalledTimes(1);
  });
});
