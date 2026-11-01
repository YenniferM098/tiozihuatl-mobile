import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { MaterialsResponse } from '../../core/models/material.models';
import { MaterialFilesService } from '../../core/services/material-files.service';
import { MaterialsService } from '../../core/services/materials.service';
import { SessionService } from '../../core/services/session.service';
import { MaterialsPage } from './materials.page';
import { MaterialDetailPage } from './material-detail.page';
const ITEM = { id_material: 52, titulo: '<b>Material</b>', descripcion: '<img src=x onerror=alert(1)>', tipo: 'PDF', id_usuario: 4, nombre_docente: 'Docente', materias: 'Anatomía', semestres: 'Primer semestre', fecha_creacion: null, activo: 1, visibilidad: 'PUBLICO' };
const RESPONSE: MaterialsResponse = { data: [ITEM], total: 1, page: 1, limit: 9, totalPages: 1 };
describe('Materiales: estados de consulta y detalle', () => {
  let response: Subject<MaterialsResponse>;
  let list: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    response = new Subject(); list = vi.fn(() => response);
    TestBed.configureTestingModule({ imports: [MaterialsPage, MaterialDetailPage], providers: [provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '52' } } } },
      { provide: SessionService, useValue: { user: () => ({ id_semestre: 1, rol: 'Estudiante' }) } },
      { provide: MaterialFilesService, useValue: { safeUrl: () => false } },
      { provide: MaterialsService, useValue: { list, detail: () => of(ITEM), subjects: () => of([]), teachers: () => of([]), semesters: () => of([{ id_semestre: 1, nombre_semestre: 'Primer semestre' }]) } },
    ] });
  });
  it('muestra carga y resultados como texto, con enlace al detalle', async () => {
    const fixture = TestBed.createComponent(MaterialsPage); await fixture.whenStable();
    fixture.componentInstance.ionViewWillEnter(); await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Cargando materiales');
    response.next(RESPONSE); await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain(ITEM.titulo);
    expect(fixture.nativeElement.querySelector('h2 b')).toBeNull();
    expect(fixture.nativeElement.querySelector('.description-preview img')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/materiales/52"]')).toBeTruthy();
  });
  it('distingue ausencia de materiales y búsqueda sin coincidencias', async () => {
    const fixture = TestBed.createComponent(MaterialsPage); await fixture.whenStable(); fixture.componentInstance.load();
    response.next({ ...RESPONSE, data: [], total: 0 }); await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No hay materiales publicados');
    fixture.componentInstance.filters.search = 'sin coincidencias'; fixture.componentInstance.load(true);
    response.next({ ...RESPONSE, data: [], total: 0 }); await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No se encontraron materiales');
  });
  it('envía filtros y reinicia la paginación', () => {
    const page = TestBed.runInInjectionContext(() => new MaterialsPage()); page.page.set(3);
    page.filters = { search: 'descripción', materia: '2', docente: '4', tipo: 'WORD' }; page.load(true);
    expect(list).toHaveBeenLastCalledWith(page.filters, 1);
  });
  it('muestra error de conexión y permite reintentar', () => {
    const page = TestBed.runInInjectionContext(() => new MaterialsPage()); page.load(); response.error(new Error('Sin conexión'));
    expect(page.error()).toContain('No fue posible conectar'); expect(page.loading()).toBe(false);
    response = new Subject(); page.load(); expect(list).toHaveBeenCalledTimes(2);
  });
  it('el detalle sin archivo conserva texto seguro y no ofrece acciones de archivo', async () => {
    const fixture = TestBed.createComponent(MaterialDetailPage); await fixture.whenStable(); fixture.componentInstance.ionViewWillEnter(); await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('El material no tiene un archivo disponible');
    expect(fixture.nativeElement.querySelector('h1 b')).toBeNull();
    expect(fixture.nativeElement.querySelector('iframe, video, img, a[download]')).toBeNull();
    expect(fixture.nativeElement.querySelector('ion-button[href="/materiales"]')).toBeTruthy();
  });
});
