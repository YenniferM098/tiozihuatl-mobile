import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { HomeContentService } from './home-content.service';

const API = environment.apiUrl;
const IMG = 'https://res.cloudinary.com/demo';

describe('HomeContentService (HU-02 Inicio después de iniciar sesión)', () => {
  let service: HomeContentService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(HomeContentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('eventos destacados', () => {
    it('muestra solo los destacados, con texto limpio y máximo 3 imágenes https', async () => {
      const result = firstValueFrom(service.featuredEvents());

      const req = http.expectOne((r) => r.url === `${API}/events`);
      expect(req.request.params.get('destacado')).toBe('1');
      req.flush([
        {
          id_evento: 1,
          titulo: '<b>Feria</b>&nbsp;  del libro',
          descripcion: '',
          destacado: 1,
          imagen_principal: `${IMG}/principal.jpg`,
          imagenes: [
            { id_imagen: 2, url: `${IMG}/b.jpg`, orden: 2 },
            { id_imagen: 1, url: `${IMG}/a.jpg`, orden: 1 },
            { id_imagen: 3, url: 'javascript:alert(1)', orden: 3 },
            { id_imagen: 4, url: `${IMG}/principal.jpg` },
          ],
        },
        { id_evento: 2, titulo: 'Oculto', descripcion: '', destacado: 0, imagen_principal: null },
        { id_evento: 3, titulo: 'Otro', descripcion: '', destacado: 'true', imagen_principal: null },
      ]);

      expect(await result).toEqual([
        { id: 1, title: 'Feria del libro', images: [`${IMG}/principal.jpg`, `${IMG}/a.jpg`, `${IMG}/b.jpg`] },
        { id: 3, title: 'Otro', images: [] },
      ]);
    });

    it('si la consulta falla, la sección queda vacía', async () => {
      const result = firstValueFrom(service.featuredEvents());
      http.expectOne((r) => r.url === `${API}/events`).flush({}, { status: 500, statusText: 'Error' });

      expect(await result).toEqual([]);
    });

    it('tolera una respuesta que no es lista', async () => {
      const result = firstValueFrom(service.featuredEvents());
      http.expectOne((r) => r.url === `${API}/events`).flush({ data: null });

      expect(await result).toEqual([]);
    });
  });

  describe('libros digitales', () => {
    it('Estudiante: filtra por semestre, toma los 2 más recientes y su portada', async () => {
      const result = firstValueFrom(service.books(3));

      const req = http.expectOne((r) => r.url === `${API}/catalog`);
      expect(req.request.params.get('formato')).toBe('DIGITAL');
      expect(req.request.params.get('semestre')).toBe('3');
      req.flush([
        { id: 1, titulo: 'Viejo', tiene_digital: 1 },
        { id: 5, titulo: 'Físico', tiene_digital: 0 },
        { id: 9, titulo: 'Nuevo', tiene_digital: 1 },
        { id: 4, titulo: 'Medio', tiene_digital: 1 },
      ]);

      http.expectOne(`${API}/catalog/libros/9/preview`).flush({ previewUrl: `${IMG}/9.png` });
      http.expectOne(`${API}/catalog/libros/4/preview`).flush({ previewUrl: `${IMG}/fetch/https://otro.com/4.pdf` });

      expect(await result).toEqual([
        { id: 9, title: 'Nuevo', cover: `${IMG}/9.png` },
        { id: 4, title: 'Medio', cover: null },
      ]);
    });

    it('Docente: consulta todo el acervo y tolera portadas que fallan', async () => {
      const result = firstValueFrom(service.books(null));

      const req = http.expectOne((r) => r.url === `${API}/catalog`);
      expect(req.request.params.has('semestre')).toBe(false);
      req.flush([{ id: 2, titulo: 'Único', tiene_digital: 1 }]);
      http.expectOne(`${API}/catalog/libros/2/preview`).flush({}, { status: 404, statusText: 'Not Found' });

      expect(await result).toEqual([{ id: 2, title: 'Único', cover: null }]);
    });

    it('sin libros digitales no pide portadas', async () => {
      const result = firstValueFrom(service.books(null));
      http.expectOne((r) => r.url === `${API}/catalog`).flush('no es lista');

      expect(await result).toEqual([]);
    });
  });

  describe('revistas recientes', () => {
    it('toma las 2 más recientes con la portada del catálogo', async () => {
      const result = firstValueFrom(service.recentMagazines());

      const filtro = http.expectOne((r) => r.url === `${API}/magazines/filter`);
      expect(filtro.request.params.get('sort')).toBe('recent');
      filtro.flush({
        data: [
          { id_magazine: 1, titulo: 'Ciencia' },
          { id_magazine: 2, titulo: 'Arte' },
          { id_magazine: 3, titulo: 'Tercera' },
        ],
      });
      http.expectOne(`${API}/magazines`).flush({
        data: [
          { id_magazine: 1, titulo: 'Ciencia', portada_url: `${IMG}/1.jpg` },
          { id_magazine: 2, titulo: 'Arte', portada_url: 'http://inseguro.com/2.jpg' },
        ],
      });

      expect(await result).toEqual([
        { id: 1, title: 'Ciencia', cover: `${IMG}/1.jpg` },
        { id: 2, title: 'Arte', cover: null },
      ]);
    });

    it('se muestran sin portada si falla el catálogo de portadas', async () => {
      const result = firstValueFrom(service.recentMagazines());
      http.expectOne((r) => r.url === `${API}/magazines/filter`).flush({ data: [{ id_magazine: 1, titulo: 'Ciencia' }] });
      http.expectOne(`${API}/magazines`).flush({}, { status: 500, statusText: 'Error' });

      expect(await result).toEqual([{ id: 1, title: 'Ciencia', cover: null }]);
    });

    it('sin datos la sección queda vacía', async () => {
      const result = firstValueFrom(service.recentMagazines());
      http.expectOne((r) => r.url === `${API}/magazines/filter`).flush({});
      http.expectOne(`${API}/magazines`).flush({});

      expect(await result).toEqual([]);
    });
  });

  describe('materiales', () => {
    it('Estudiante: materiales de su semestre con tipo, icono y docente', async () => {
      const result = firstValueFrom(service.semesterMaterials(3));

      const req = http.expectOne((r) => r.url === `${API}/material/materiales/todos`);
      expect(req.request.params.get('semestre')).toBe('3');
      req.flush({
        data: [
          { id_material: 1, titulo: 'Guía', tipo: 'pdf', materias: 'Cálculo, Física', nombre_docente: 'Mtro. Ruiz' },
          { id_material: 2, titulo: 'Notas', tipo: null, materias: 'Química' },
        ],
      });

      expect(await result).toEqual([
        { id: 1, title: 'Guía', type: 'PDF', icon: 'file-pdf', detail: 'Mtro. Ruiz' },
        { id: 2, title: 'Notas', type: 'Archivo', icon: 'file', detail: 'Química' },
      ]);
    });

    it('Estudiante sin semestre: no filtra', async () => {
      const result = firstValueFrom(service.semesterMaterials(null));
      const req = http.expectOne((r) => r.url === `${API}/material/materiales/todos`);
      expect(req.request.params.has('semestre')).toBe(false);
      req.flush([]);

      expect(await result).toEqual([]);
    });

    it('Docente: sus materiales muestran la materia, no su nombre', async () => {
      const result = firstValueFrom(service.teacherMaterials());

      http.expectOne((r) => r.url === `${API}/docente/materiales/mis-materiales`).flush([
        { id_material: 3, titulo: 'Presentación', tipo: 'PPT', materias: 'Historia', nombre_docente: 'Yo' },
        { id_material: 4, titulo: 'Sin materia', tipo: 'ZIP', materias: null },
      ]);

      expect(await result).toEqual([
        { id: 3, title: 'Presentación', type: 'Presentación', icon: 'file-ppt', detail: 'Historia' },
        { id: 4, title: 'Sin materia', type: 'Archivo comprimido', icon: 'file-zip', detail: '' },
      ]);
    });

    it('si la consulta falla, la sección queda vacía', async () => {
      const result = firstValueFrom(service.teacherMaterials());
      http
        .expectOne((r) => r.url === `${API}/docente/materiales/mis-materiales`)
        .flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(await result).toEqual([]);
    });
  });
});
