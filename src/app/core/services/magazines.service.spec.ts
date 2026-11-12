import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TimeoutError, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MagazineCatalogItemDto, MagazineError } from '../models/magazine.models';
import { MagazinesService, toMagazineError } from './magazines.service';

const API = `${environment.apiUrl}/magazines`;

function saveSession(rol = 'Visitante'): void {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }));
  localStorage.setItem(
    'tiozihuatl.session',
    JSON.stringify({ accessToken: `h.${payload}.s`, refreshToken: 'r', user: { id: 9, id_usuario: 9, nombre: 'Ana', rol } }),
  );
}

const SALUD: MagazineCatalogItemDto = {
  id_magazine: 3,
  titulo: '<b>Salud</b>  comunitaria',
  descripcion: 'Edición <script>x</script> 1',
  precio: '120.00',
  precio_final: '90.00',
  descuento_activo: 1,
  portada_url: 'https://res.cloudinary.com/demo/image/upload/pg_1/salud',
};
const ANATOMIA: MagazineCatalogItemDto = {
  id_magazine: 5,
  titulo: 'Anatomía',
  descripcion: null,
  precio: 80,
  precio_final: 80,
  descuento_activo: 0,
  portada_url: 'javascript:alert(1)',
};

describe('MagazinesService - Revistas Digitales', () => {
  let service: MagazinesService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    saveSession();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(MagazinesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('convierte el catálogo para la vista, con texto plano, descuento y solo portadas https', async () => {
    const result = firstValueFrom(service.catalog());
    http.expectOne(API).flush({ success: true, data: [SALUD, ANATOMIA] });

    const [salud, anatomia] = await result;
    expect(salud).toEqual({
      id: 3,
      title: 'Salud comunitaria',
      description: 'Edición x 1',
      cover: SALUD.portada_url,
      price: 120,
      finalPrice: 90,
      hasDiscount: true,
    });
    expect(anatomia.cover).toBeNull();
    expect(anatomia.hasDiscount).toBe(false);
    expect(anatomia.description).toBe('');
  });

  it('comparte el catálogo y solo lo vuelve a pedir al actualizar', async () => {
    const first = firstValueFrom(service.catalog());
    http.expectOne(API).flush({ data: [SALUD] });
    await first;
    await firstValueFrom(service.catalog());
    http.expectNone(API);

    const refreshed = firstValueFrom(service.catalog(true));
    http.expectOne(API).flush({ data: [] });
    expect(await refreshed).toEqual([]);
  });

  it('busca en el backend sin acentos y toma las portadas del catálogo', async () => {
    const result = firstValueFrom(service.search({ search: '  Anatomía   humana ', letter: 'a', sort: 'price_desc' }));
    const req = http.expectOne((r) => r.url === `${API}/filter`);
    expect(req.request.params.get('search')).toBe('Anatomia humana');
    expect(req.request.params.get('letter')).toBe('A');
    expect(req.request.params.get('sort')).toBe('price_desc');
    req.flush({ ok: true, data: [{ ...SALUD, portada_url: undefined }] });
    http.expectOne(API).flush({ data: [SALUD] });

    expect((await result)[0].cover).toBe(SALUD.portada_url);
  });

  it('sin búsqueda ni letra y en orden A–Z usa el catálogo; ignora letras no válidas', async () => {
    const result = firstValueFrom(service.search({ search: '   ', letter: '<', sort: 'asc' }));
    http.expectNone((r) => r.url === `${API}/filter`);
    http.expectOne(API).flush({ data: [ANATOMIA] });
    expect(await result).toHaveLength(1);
  });

  it('si el catálogo falla, la búsqueda muestra resultados sin portada', async () => {
    const result = firstValueFrom(service.search({ search: '', letter: '', sort: 'desc' }));
    http.expectOne((r) => r.url === `${API}/filter`).flush({ ok: true, data: [SALUD, ANATOMIA].map((m) => ({ ...m, portada_url: null })) });
    http.expectOne(API).flush(null, { status: 500, statusText: 'Error' });
    expect((await result).map((m) => m.cover)).toEqual([null, null]);
  });

  it('obtiene las revistas adquiridas con la portada del catálogo', async () => {
    const result = firstValueFrom(service.purchases());
    http.expectOne(`${API}/my-purchases`).flush([{ id_revista: 3, titulo: 'Salud', fecha_compra: '2026-10-01' }]);
    http.expectOne(API).flush({ data: [SALUD] });
    expect(await result).toEqual([{ id: 3, title: 'Salud', cover: SALUD.portada_url, purchasedAt: '2026-10-01' }]);
  });

  it('el detalle combina la revista, el catálogo y si fue adquirida', async () => {
    const result = firstValueFrom(service.detail(3));
    http.expectOne(`${API}/3`).flush({ data: { id_revista: 3, titulo: 'Salud comunitaria', descripcion: 'Descripción completa', precio: 120 } });
    http.expectOne(API).flush({ data: [SALUD] });
    http.expectOne(`${API}/my-purchases`).flush([{ id_revista: 3, titulo: 'Salud' }]);

    expect(await result).toMatchObject({ id: 3, description: 'Descripción completa', finalPrice: 90, hasDiscount: true, purchased: true });
  });

  it('una revista inactiva (fuera del catálogo) no se muestra', async () => {
    const result = firstValueFrom(service.detail(8));
    http.expectOne(`${API}/8`).flush({ data: { id_revista: 8, titulo: 'Inactiva', descripcion: null, precio: 10 } });
    http.expectOne(API).flush({ data: [SALUD] });
    http.expectOne(`${API}/my-purchases`).flush([]);
    await expect(result).rejects.toMatchObject({ kind: 'notFound' });
  });

  it('si no puede verificar las compras, el detalle se muestra sin ese dato', async () => {
    const result = firstValueFrom(service.detail(3));
    http.expectOne(`${API}/3`).flush({ data: { id_revista: 3, titulo: 'Salud', descripcion: null, precio: 120 } });
    http.expectOne(API).flush({ data: [SALUD] });
    http.expectOne(`${API}/my-purchases`).flush(null, { status: 500, statusText: 'Error' });
    expect((await result).purchased).toBeNull();
  });

  it('rechaza identificadores no válidos sin consultar al servidor', async () => {
    await expect(firstValueFrom(service.detail(-1))).rejects.toMatchObject({ kind: 'notFound' });
    await expect(firstValueFrom(service.detail(Number.NaN))).rejects.toMatchObject({ kind: 'notFound' });
  });

  it('informa error de conexión cuando el servidor no responde', async () => {
    const result = firstValueFrom(service.catalog());
    http.expectOne(API).error(new ProgressEvent('error'), { status: 0 });
    await expect(result).rejects.toMatchObject({ kind: 'connection' });
  });
});

describe('MagazinesService - sin sesión', () => {
  it('no consulta las compras y pide iniciar sesión', async () => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const service = TestBed.inject(MagazinesService);
    const http = TestBed.inject(HttpTestingController);

    await expect(firstValueFrom(service.purchases())).rejects.toMatchObject({ kind: 'session' });
    http.expectNone(`${API}/my-purchases`);
    http.verify();
  });
});

describe('toMagazineError - mensajes claros sin detalles técnicos', () => {
  const http = (status: number) => new HttpErrorResponse({ status, error: { error: 'ER_BAD_FIELD_ERROR' } });

  it('clasifica cada respuesta del servidor', () => {
    expect(toMagazineError(new TimeoutError()).kind).toBe('connection');
    expect(toMagazineError(http(504)).kind).toBe('connection');
    expect(toMagazineError(http(401)).kind).toBe('session');
    expect(toMagazineError(http(404)).kind).toBe('notFound');
    expect(toMagazineError(http(500))).toMatchObject({ kind: 'server', message: 'Ocurrió un problema en el servidor. Intenta más tarde.' });
    expect(toMagazineError(new Error('x')).kind).toBe('server');
    const error = new MagazineError('session', 'Mensaje');
    expect(toMagazineError(error)).toBe(error);
  });
});
