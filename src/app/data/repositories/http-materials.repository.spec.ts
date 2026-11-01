import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MATERIALS_REPOSITORY } from '../../domain/repositories/materials.repository';
import { HttpMaterialsRepository } from './http-materials.repository';

const API = `${environment.apiUrl}/material`;

describe('HttpMaterialsRepository (capa de datos)', () => {
  let repository: HttpMaterialsRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    repository = TestBed.inject(HttpMaterialsRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('es la implementación que entrega el token MATERIALS_REPOSITORY', () => {
    expect(TestBed.inject(MATERIALS_REPOSITORY)).toBe(repository);
  });

  it('envía semestre, página, límite y solo los filtros con valor', () => {
    repository.list({ semestre: '2', page: 3, limit: 9, search: 'Anatomía', materia: '', docente: '7', tipo: '' }).subscribe();
    const req = http.expectOne((r) => r.url === `${API}/materiales/todos`);
    expect(req.request.params.keys()).toEqual(['semestre', 'page', 'limit', 'search', 'docente']);
    expect(req.request.params.get('page')).toBe('3');
    req.flush({ data: [], total: 0, page: 3, limit: 9, totalPages: 0 });
  });

  it('consulta materias, docentes y semestres', () => {
    repository.subjects().subscribe();
    repository.teachers().subscribe();
    repository.semesters().subscribe();
    http.expectOne(`${API}/materias`).flush([]);
    http.expectOne(`${API}/docentes`).flush([]);
    http.expectOne(`${API}/semestres`).flush([]);
  });

  it('descarga el archivo completo como Blob con sus cabeceras', async () => {
    const url = 'https://res.cloudinary.com/demo/raw/upload/material.pdf';
    const promise = firstValueFrom(repository.file(url));
    const req = http.expectOne(url);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['%PDF-']), { headers: { 'Content-Type': 'application/pdf' } });
    expect((await promise).headers.get('Content-Type')).toBe('application/pdf');
  });

  it('pide solo los primeros 512 bytes para validar un video', async () => {
    const url = 'https://res.cloudinary.com/demo/video/upload/clase.mp4';
    const promise = firstValueFrom(repository.fileStart(url));
    const req = http.expectOne(url);
    expect(req.request.headers.get('Range')).toBe('bytes=0-511');
    expect(req.request.responseType).toBe('arraybuffer');
    req.flush(new ArrayBuffer(8));
    expect((await promise).body?.byteLength).toBe(8);
  });
});
