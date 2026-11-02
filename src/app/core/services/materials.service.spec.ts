import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MaterialsFilters } from '../models/material.models';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { MaterialsService, materialsError } from './materials.service';
const API = `${environment.apiUrl}/material`;
const ITEM = { id_material: 52, titulo: 'Recurso', descripcion: 'Descripción', tipo: 'PDF', id_usuario: 4, nombre_docente: 'Docente', materias: 'Anatomía', semestres: 'Primer semestre', fecha_creacion: null, activo: 1, visibilidad: 'PUBLICO' };
const RESPONSE = { data: [ITEM], total: 1, page: 1, limit: 9, totalPages: 1 };
describe('Materiales: contratos de consulta y alcance de la cuenta', () => {
  let service: MaterialsService;
  let http: HttpTestingController;
  let role: string;
  let semester: number | null;
  let valid: boolean;
  beforeEach(() => {
    role = 'Estudiante'; semester = 1; valid = true;
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: AuthService, useValue: { ensureValidSession: () => of(valid) } },
      { provide: SessionService, useValue: { user: () => ({ id_usuario: 2, rol: role, id_semestre: semester }), current: { accessToken: 'token' } } },
    ] });
    service = TestBed.inject(MaterialsService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('envía semestre de sesión, token, filtros reales y paginación', async () => {
    const result = firstValueFrom(service.list({ search: '<título>', materia: '3', docente: '4', tipo: 'PDF' }, 2));
    const request = http.expectOne(r => r.url === `${API}/materiales/todos`);
    expect(request.request.headers.get('Authorization')).toBe('Bearer token');
    expect(request.request.params.get('semestre')).toBe('1');
    expect(request.request.params.get('search')).toBe('<título>');
    expect(request.request.params.get('materia')).toBe('3');
    expect(request.request.params.get('docente')).toBe('4');
    expect(request.request.params.get('tipo')).toBe('PDF');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('limit')).toBe('9');
    request.flush(RESPONSE); expect((await result).data).toEqual([ITEM]);
  });
  it('no admite sobrescribir el semestre mediante otros filtros', async () => {
    const result = firstValueFrom(service.list({ semestre: '8' } as unknown as MaterialsFilters));
    const request = http.expectOne(r => r.url === `${API}/materiales/todos`);
    expect(request.request.params.get('semestre')).toBe('1');
    request.flush(RESPONSE); await result;
  });
  it('conserva la regla web de semestre vacío cuando la cuenta no lo tiene', async () => {
    semester = null;
    const result = firstValueFrom(service.list());
    const request = http.expectOne(r => r.url === `${API}/materiales/todos`);
    expect(request.request.params.get('semestre')).toBe('');
    request.flush(RESPONSE); await result;
  });
  it('permite consulta al Docente sin usar rutas administrativas', async () => {
    role = 'Docente'; const result = firstValueFrom(service.list());
    http.expectOne(r => r.url === `${API}/materiales/todos`).flush(RESPONSE);
    expect((await result).total).toBe(1);
  });
  it('rechaza Visitante y no solicita datos', async () => {
    role = 'Visitante'; await expect(firstValueFrom(service.list())).rejects.toMatchObject({ status: 403 });
    http.expectNone(r => r.url.startsWith(API));
  });
  it('rechaza sesión inválida', async () => {
    valid = false; await expect(firstValueFrom(service.detail(52))).rejects.toMatchObject({ status: 403 });
    http.expectNone(r => r.url.startsWith(API));
  });
  it('resuelve una ruta de detalle recorriendo únicamente páginas del listado de su semestre', async () => {
    const result = firstValueFrom(service.detail(52));
    const first = http.expectOne(r => r.url === `${API}/materiales/todos` && r.params.get('page') === '1');
    expect(first.request.params.get('semestre')).toBe('1');
    first.flush({ ...RESPONSE, data: [{ ...ITEM, id_material: 10 }], totalPages: 2, total: 51 });
    const second = http.expectOne(r => r.url === `${API}/materiales/todos` && r.params.get('page') === '2');
    expect(second.request.params.get('semestre')).toBe('1');
    second.flush({ ...RESPONSE, page: 2 });
    expect(await result).toEqual(ITEM);
    http.expectNone(`${API}/docente/52`);
  });
  it('no muestra material privado o inactivo aunque aparezca inesperadamente en una respuesta', async () => {
    const result = firstValueFrom(service.detail(52));
    http.expectOne(r => r.url === `${API}/materiales/todos`).flush({ ...RESPONSE, data: [{ ...ITEM, activo: 0, visibilidad: 'PRIVADO' }] });
    expect(await result).toBeNull();
  });
  it('devuelve ausencia de detalle si no está en los resultados permitidos', async () => {
    const result = firstValueFrom(service.detail(9));
    http.expectOne(r => r.url === `${API}/materiales/todos`).flush(RESPONSE);
    expect(await result).toBeNull();
  });
  it('rechaza cambiar de semestre mientras obtiene el detalle', async () => {
    const result = firstValueFrom(service.detail(52)); semester = 2;
    http.expectOne(r => r.url === `${API}/materiales/todos`).flush(RESPONSE);
    await expect(result).rejects.toMatchObject({ status: 403 });
  });
  it('presenta acceso restringido al recibir 403', async () => {
    const result = firstValueFrom(service.list()).catch(error => materialsError(error));
    http.expectOne(r => r.url === `${API}/materiales/todos`).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(await result).toContain('Contenido no disponible para este usuario');
  });
  it('consulta materias, docentes y semestres con la misma validación de sesión y rol', async () => {
    const subjects = firstValueFrom(service.subjects());
    http.expectOne(`${API}/materias`).flush([{ id: 1, nombre: 'Anatomía' }]);
    expect(await subjects).toEqual([{ id: 1, nombre: 'Anatomía' }]);
    const teachers = firstValueFrom(service.teachers());
    http.expectOne(`${API}/docentes`).flush([{ id_usuario: 4, nombre: 'Docente', total_materiales: 3 }]);
    expect((await teachers)[0].nombre).toBe('Docente');
    const semesters = firstValueFrom(service.semesters());
    http.expectOne(`${API}/semestres`).flush([{ id_semestre: 1, nombre_semestre: 'Primer semestre' }]);
    expect((await semesters)[0].id_semestre).toBe(1);
    role = 'Visitante';
    await expect(firstValueFrom(service.teachers())).rejects.toMatchObject({ status: 403 });
    http.expectNone(`${API}/docentes`);
  });
  it('no consulta la API con un identificador de detalle inválido', async () => {
    expect(await firstValueFrom(service.detail(0))).toBeNull();
    expect(await firstValueFrom(service.detail(Number.NaN))).toBeNull();
    http.expectNone(r => r.url === `${API}/materiales/todos`);
  });
});
