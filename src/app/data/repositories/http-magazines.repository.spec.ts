import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MAGAZINES_REPOSITORY } from '../../domain/repositories/magazines.repository';
import { HttpMagazinesRepository } from './http-magazines.repository';

const API = `${environment.apiUrl}/magazines`;

describe('HttpMagazinesRepository (capa de datos)', () => {
  let repository: HttpMagazinesRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    repository = TestBed.inject(HttpMagazinesRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('es la implementación que entrega el token MAGAZINES_REPOSITORY', () => {
    expect(TestBed.inject(MAGAZINES_REPOSITORY)).toBe(repository);
  });

  it('consulta el catálogo con GET', async () => {
    const result = firstValueFrom(repository.catalog());
    const req = http.expectOne(API);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: [] });
    expect(await result).toEqual({ success: true, data: [] });
  });

  it('envía solo los parámetros de filtro indicados', () => {
    repository.filter({ sort: 'price_asc', search: 'salud', letter: 'S' }).subscribe();
    const req = http.expectOne((r) => r.url === `${API}/filter`);
    expect(req.request.params.get('sort')).toBe('price_asc');
    expect(req.request.params.get('search')).toBe('salud');
    expect(req.request.params.get('letter')).toBe('S');
    req.flush({ ok: true, data: [] });

    repository.filter({ sort: 'asc' }).subscribe();
    const plain = http.expectOne((r) => r.url === `${API}/filter`);
    expect(plain.request.params.keys()).toEqual(['sort']);
    plain.flush({ ok: true, data: [] });
  });

  it('consulta el detalle y las compras del usuario', () => {
    repository.detail(7).subscribe();
    http.expectOne(`${API}/7`).flush({ data: null });
    repository.myPurchases().subscribe();
    const req = http.expectOne(`${API}/my-purchases`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
