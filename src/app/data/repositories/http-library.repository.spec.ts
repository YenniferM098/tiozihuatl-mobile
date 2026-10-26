import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LIBRARY_REPOSITORY } from '../../domain/repositories/library.repository';
import { HttpLibraryRepository } from './http-library.repository';

const API = `${environment.apiUrl}/catalog`;

describe('HttpLibraryRepository (capa de datos)', () => {
  let repository: HttpLibraryRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    repository = TestBed.inject(HttpLibraryRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('es la implementación que entrega el token LIBRARY_REPOSITORY', () => {
    expect(TestBed.inject(LIBRARY_REPOSITORY)).toBe(repository);
  });

  it('envía solo los filtros con valor', () => {
    repository.catalog({ search: 'Anatomía', materia: '', semestre: '3', formato: '', ordenAutor: '' }).subscribe();
    const req = http.expectOne((r) => r.url === API);
    expect(req.request.params.keys()).toEqual(['search', 'semestre']);
    req.flush([]);
  });

  it('consulta el catálogo sin filtros', () => {
    repository.catalog().subscribe();
    expect(http.expectOne(API).request.params.keys()).toEqual([]);
  });

  it('consulta materias, semestres, portada y URL del PDF', () => {
    repository.subjects().subscribe();
    repository.semesters().subscribe();
    repository.preview(4).subscribe();
    repository.pdfUrl(4).subscribe();
    http.expectOne(`${API}/materias`).flush([]);
    http.expectOne(`${API}/semestres`).flush([]);
    http.expectOne(`${API}/libros/4/preview`).flush({ previewUrl: 'x' });
    http.expectOne(`${API}/libros/4/pdf-url`).flush({ url: 'x', titulo: 'y' });
  });

  it('descarga el archivo como ArrayBuffer', async () => {
    const url = 'https://res.cloudinary.com/demo/raw/upload/libro.pdf';
    const promise = firstValueFrom(repository.file(url));
    const req = http.expectOne(url);
    expect(req.request.responseType).toBe('arraybuffer');
    const data = new ArrayBuffer(4);
    req.flush(data);
    expect(await promise).toBe(data);
  });
});
