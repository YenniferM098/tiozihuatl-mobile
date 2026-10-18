import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { LibraryBook } from '../../core/models/library.models';
import { LibraryService } from '../../core/services/library.service';
import { BookDetailPage } from './book-detail.page';

const BOOK: LibraryBook = {
  id: 52, titulo: 'Libro de prueba', autores: 'Autor', editorial: 'Editorial', materias: 'Anatomía', semestres: 'Primer semestre',
  tiene_digital: 1, tiene_fisico: 1, total: 2, disponibles: 1, pdf_url: 'libros/documento',
};

describe('Detalle: datos bibliográficos, disponibilidad física y contenido digital', () => {
  let response: Subject<LibraryBook[]>;
  let id: string | null;
  beforeEach(() => {
    response = new Subject<LibraryBook[]>();
    id = '52';
    TestBed.configureTestingModule({
      imports: [BookDetailPage],
      providers: [provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => id } } } },
        { provide: LibraryService, useValue: { catalog: () => response, preview: () => of({ previewUrl: '' }), safeResource: () => false } },
      ],
    });
  });
  async function open(books?: LibraryBook[]) {
    const fixture = TestBed.createComponent(BookDetailPage);
    await fixture.whenStable();
    fixture.componentInstance.ionViewWillEnter();
    if (books) response.next(books);
    await fixture.whenStable();
    return fixture.nativeElement.textContent as string;
  }
  it('actualiza la pantalla al recibir el libro, sin otro toque', async () => {
    const text = await open([BOOK]);
    expect(text).toContain('Libro de prueba');
    expect(text).toContain('Editorial');
    expect(text).toContain('Anatomía');
    expect(text).toContain('Primer semestre');
    expect(text).toContain('1 de 2 ejemplares disponibles');
    expect(text).toContain('cuenta con contenido digital');
  });
  it('muestra información sin contenido digital cuando no existe archivo', async () => {
    const text = await open([{ ...BOOK, tiene_digital: 0, pdf_url: null }]);
    expect(text).toContain('no tiene contenido digital disponible');
    expect(text).not.toContain('Abrir lector digital');
    expect(text).toContain('Regresar al catálogo');
  });
  it('describe la disponibilidad de los ejemplares físicos', () => {
    const page = TestBed.runInInjectionContext(() => new BookDetailPage());
    expect(page.physicalCopies({ ...BOOK, disponibles: 2, total: 2 })).toBe('2 de 2 ejemplares disponibles para consulta en la biblioteca.');
    expect(page.physicalCopies({ ...BOOK, disponibles: 0, total: 3 })).toBe('Sin ejemplares disponibles por el momento (0 de 3).');
    expect(page.physicalCopies({ ...BOOK, disponibles: null, total: null })).toBe('Cuenta con ejemplares físicos en la biblioteca.');
    expect(page.physicalCopies({ ...BOOK, disponibles: 4, total: null })).toBe('4 ejemplares disponibles para consulta en la biblioteca.');
    expect(page.physicalCopies({ ...BOOK, tiene_fisico: 0, disponibles: null, total: null })).toBe('Este libro no cuenta con ejemplares físicos.');
  });
  it('informa cuando el libro no existe en el catálogo', async () => {
    const text = await open([{ ...BOOK, id: 7 }]);
    expect(text).toContain('El libro no está disponible.');
  });
  it('no consulta la API con un identificador inválido', async () => {
    id = 'abc';
    const text = await open();
    expect(text).toContain('El libro no está disponible.');
  });
  it('muestra el error de conexión y vuelve a consultar al tocar Reintentar', async () => {
    const fixture = TestBed.createComponent(BookDetailPage);
    await fixture.whenStable();
    fixture.componentInstance.ionViewWillEnter();
    response.error(new Error('Sin conexión'));
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No fue posible conectar');
    response = new Subject<LibraryBook[]>();
    fixture.nativeElement.querySelector('app-library-state ion-button').click();
    response.next([BOOK]);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Libro de prueba');
  });
});
