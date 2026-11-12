import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { MagazineDetail, MagazineError } from '../../core/models/magazine.models';
import { MagazinesService } from '../../core/services/magazines.service';
import { MagazineDetailPage } from './magazine-detail.page';
import { MagazineDetailViewModel } from './magazine-detail.view-model';

const DETAIL: MagazineDetail = {
  id: 3,
  title: '<b>Salud</b> comunitaria',
  description: '<img src=x onerror=alert(1)> Edición especial',
  cover: 'https://res.cloudinary.com/demo/image/upload/pg_1/salud',
  price: 120,
  finalPrice: 90,
  hasDiscount: true,
  purchased: false,
};

describe('Revistas: detalle de la revista', () => {
  let response: Subject<MagazineDetail>;
  let detail: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    response = new Subject();
    detail = vi.fn(() => response);
    TestBed.configureTestingModule({
      imports: [MagazineDetailPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '3' } } } },
        { provide: MagazinesService, useValue: { detail } },
      ],
    });
  });

  async function open() {
    const fixture = TestBed.createComponent(MagazineDetailPage);
    await fixture.whenStable();
    fixture.componentInstance.ionViewWillEnter();
    await fixture.whenStable();
    return fixture;
  }

  it('consulta la revista de la ruta y muestra portada, título, descripción y precio como texto', async () => {
    const fixture = await open();
    const el: HTMLElement = fixture.nativeElement;
    expect(detail).toHaveBeenCalledWith(3);
    expect(el.textContent).toContain('Cargando información de la revista');

    response.next(DETAIL);
    await fixture.whenStable();
    expect(el.querySelector('h1')?.textContent).toBe(DETAIL.title);
    expect(el.querySelector('h1 b, .description img')).toBeNull();
    expect(el.querySelector('.description')?.textContent).toBe(DETAIL.description);
    expect(el.querySelector('.magazine-detail-cover img')?.getAttribute('alt')).toBe(`Portada de ${DETAIL.title}`);
    expect(el.querySelector('.price-block')?.getAttribute('aria-label')).toBe('Precio $90.00, antes $120.00');
    expect(el.querySelector('.price-block s')?.textContent).toBe('$120.00');
    expect(el.querySelector('ion-button[routerLink="/revistas"], ion-button[href="/revistas"]')).toBeTruthy();
  });

  it('sin descuento ni descripción ni portada muestra textos e icono predeterminados', async () => {
    const fixture = await open();
    response.next({ ...DETAIL, description: '', cover: null, hasDiscount: false, finalPrice: 120 });
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Esta revista no tiene descripción.');
    expect(el.querySelector('.price-block s, .discount, img')).toBeNull();
    expect(el.querySelector('.magazine-detail-cover .ph-newspaper')).toBeTruthy();
  });

  it('si la portada no se descarga muestra el icono', async () => {
    const fixture = await open();
    response.next(DETAIL);
    await fixture.whenStable();
    fixture.nativeElement.querySelector('img').dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
  });

  it('una revista inexistente o inactiva se informa sin Reintentar', async () => {
    const fixture = await open();
    response.error(new MagazineError('notFound', 'La revista solicitada no existe o ya no está disponible.'));
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('ya no está disponible');
    expect(fixture.nativeElement.textContent).not.toContain('Reintentar');
  });

  it('un error de conexión permite reintentar', async () => {
    const fixture = await open();
    response.error(new MagazineError('connection', 'No fue posible conectar con el servidor.'));
    await fixture.whenStable();
    response = new Subject();
    (Array.from(fixture.nativeElement.querySelectorAll('ion-button')) as HTMLElement[])
      .find((b) => b.textContent?.includes('Reintentar'))!
      .click();
    expect(detail).toHaveBeenCalledTimes(2);
  });

  it('al salir cancela la consulta pendiente', async () => {
    const fixture = await open();
    expect(response.observed).toBe(true);
    fixture.componentInstance.ionViewWillLeave();
    expect(response.observed).toBe(false);
  });

  it('el ViewModel traduce errores desconocidos sin detalles técnicos', () => {
    const vm = TestBed.runInInjectionContext(() => new MagazineDetailViewModel());
    vm.load(3);
    response.error(new Error('ECONNRESET'));
    expect(vm.error()).toMatchObject({ kind: 'server' });
    expect(vm.loading()).toBe(false);
    expect(vm.magazine()).toBeNull();
  });
});
