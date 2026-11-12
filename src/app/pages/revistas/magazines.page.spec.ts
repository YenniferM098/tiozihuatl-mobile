import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { MAGAZINES_WEB_URL, Magazine, MagazineError, PurchasedMagazine } from '../../core/models/magazine.models';
import { MagazinesService } from '../../core/services/magazines.service';
import { MagazinesPage } from './magazines.page';

const SALUD: Magazine = {
  id: 3,
  title: '<b>Salud</b> comunitaria',
  description: '<img src=x onerror=alert(1)>',
  cover: 'https://res.cloudinary.com/demo/image/upload/pg_1/salud',
  price: 120,
  finalPrice: 90,
  hasDiscount: true,
};
const ANATOMIA: Magazine = { id: 5, title: 'Anatomía', description: '', cover: null, price: 80, finalPrice: 80, hasDiscount: false };

describe('Revistas: catálogo', () => {
  let response: Subject<Magazine[]>;
  let search: ReturnType<typeof vi.fn>;
  let purchases: Subject<PurchasedMagazine[]>;

  beforeEach(() => {
    response = new Subject();
    search = vi.fn(() => response);
    purchases = new Subject();
    TestBed.configureTestingModule({
      imports: [MagazinesPage],
      providers: [provideRouter([]), { provide: MagazinesService, useValue: { search, purchases: () => purchases } }],
    });
  });

  async function open() {
    const fixture = TestBed.createComponent(MagazinesPage);
    await fixture.whenStable();
    fixture.componentInstance.ionViewWillEnter();
    await fixture.whenStable();
    return fixture;
  }

  it('muestra la carga y después las tarjetas con portada, título, descripción y precio como texto', async () => {
    const fixture = await open();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Cargando revistas');

    response.next([SALUD, ANATOMIA]);
    await fixture.whenStable();
    expect(el.textContent).toContain('2 revistas');
    expect(el.textContent).toContain(SALUD.title);
    expect(el.querySelector('h2 b')).toBeNull();
    expect(el.querySelector('.description-preview img')).toBeNull();
    expect(el.querySelector('img')?.getAttribute('alt')).toBe(`Portada de ${SALUD.title}`);
    expect(el.querySelectorAll('.magazine-card')[1].querySelector('img')).toBeNull();
    expect(el.querySelector('a.magazine-card[href="/revistas/3"]')).toBeTruthy();
  });

  it('marca el descuento con el precio anterior tachado', async () => {
    const fixture = await open();
    response.next([SALUD, ANATOMIA]);
    await fixture.whenStable();
    const [salud, anatomia] = Array.from(fixture.nativeElement.querySelectorAll('.magazine-card')) as HTMLElement[];
    expect(salud.querySelector('.discount')?.textContent).toContain('Descuento');
    expect(salud.querySelector('s')?.textContent).toContain('$120.00');
    expect(salud.querySelector('.price')?.getAttribute('aria-label')).toBe('Precio $90.00, antes $120.00');
    expect(anatomia.querySelector('.discount, s')).toBeNull();
  });

  it('si la portada no se descarga muestra el icono', async () => {
    const fixture = await open();
    response.next([SALUD]);
    await fixture.whenStable();
    fixture.nativeElement.querySelector('img').dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('.magazine-cover .ph-newspaper')).toBeTruthy();
  });

  it('indica cuando no hay revistas', async () => {
    const fixture = await open();
    response.next([]);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Por ahora no hay revistas disponibles');
  });

  it('muestra el error con Reintentar, que vuelve a consultar al servidor', async () => {
    const fixture = await open();
    response.error(new MagazineError('connection', 'No fue posible conectar con el servidor.'));
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No fue posible conectar con el servidor.');

    response = new Subject();
    fixture.nativeElement.querySelector('ion-button').click();
    expect(search).toHaveBeenLastCalledWith(expect.anything(), true);
  });

  it('al deslizar actualiza el catálogo y cierra el indicador', async () => {
    const fixture = await open();
    response.next([SALUD]);
    const complete = vi.fn();
    response = new Subject();
    fixture.componentInstance.refresh({ target: { complete } } as unknown as Event);
    expect(search).toHaveBeenLastCalledWith(expect.anything(), true);
    response.next([SALUD]);
    response.complete();
    expect(complete).toHaveBeenCalled();
  });

  it('distingue la búsqueda sin coincidencias y permite limpiarla', async () => {
    const fixture = await open();
    response.next([SALUD]);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('1 revista');
    expect(fixture.nativeElement.textContent).not.toContain('Limpiar búsqueda');

    const page = fixture.componentInstance;
    page.filters.search = 'zzz';
    response = new Subject();
    page.load();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Actualizando resultados');
    response.next([]);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No se encontraron revistas para esta búsqueda o filtros.');

    response = new Subject();
    (Array.from(fixture.nativeElement.querySelectorAll('ion-button')) as HTMLElement[])
      .find((b) => b.textContent?.includes('Limpiar'))!
      .click();
    expect(search).toHaveBeenLastCalledWith({ search: '', letter: '', sort: 'asc' }, false);
  });

  it('cuenta los resultados encontrados con filtros y ofrece letras y ordenamientos', async () => {
    const fixture = await open();
    const page = fixture.componentInstance;
    page.filters.letter = 'S';
    response.next([SALUD, ANATOMIA]);
    await fixture.whenStable();
    expect(page.countLabel()).toBe('2 revistas encontradas');
    response.next([SALUD]);
    expect(page.countLabel()).toBe('1 revista encontrada');
    expect(page.letters).toContain('Ñ');
    expect(page.sorts.map((s) => s.value)).toEqual(['asc', 'desc', 'price_asc', 'price_desc']);
  });

  it('marca como Adquiridas las revistas que compró el usuario', async () => {
    const fixture = await open();
    response.next([SALUD, ANATOMIA]);
    purchases.next([{ id: 3, title: 'Salud', cover: null, purchasedAt: null }]);
    await fixture.whenStable();
    const [salud, anatomia] = Array.from(fixture.nativeElement.querySelectorAll('.magazine-card')) as HTMLElement[];
    expect(salud.querySelector('.purchased')?.textContent).toContain('Adquirida');
    expect(anatomia.querySelector('.purchased')).toBeNull();
  });

  it('Mis revistas muestra las adquiridas con su fecha y sin buscador', async () => {
    const fixture = await open();
    const el: HTMLElement = fixture.nativeElement;
    fixture.componentInstance.selectView('mine');
    await fixture.whenStable();
    expect(el.textContent).toContain('Cargando tus revistas');
    expect(el.querySelector('ion-searchbar, details.filters')).toBeNull();

    purchases.next([{ id: 3, title: '<b>Salud</b>', cover: SALUD.cover, purchasedAt: '2026-10-01T12:00:00' }]);
    await fixture.whenStable();
    expect(el.textContent).toContain('1 revista adquirida');
    expect(el.textContent).toContain('El 01/10/2026');
    expect(el.querySelector('h2 b')).toBeNull();
    expect(el.querySelector('a.magazine-card[href="/revistas/3"]')).toBeTruthy();

    fixture.componentInstance.selectView('otra');
    expect(fixture.componentInstance.view()).toBe('mine');
  });

  it('sin revistas adquiridas indica que la compra se hace en el sitio web', async () => {
    const fixture = await open();
    fixture.componentInstance.selectView('mine');
    purchases.next([]);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Aún no has adquirido revistas.');
    expect(el.textContent).toContain('La compra de revistas no está disponible en la aplicación');
    const link = el.querySelector('a.web-link') as HTMLAnchorElement;
    expect(link.href).toBe(MAGAZINES_WEB_URL);
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener noreferrer');
  });

  it('si fallan las compras, Mis revistas permite reintentar', async () => {
    const fixture = await open();
    fixture.componentInstance.selectView('mine');
    purchases.error(new MagazineError('connection', 'No fue posible conectar con el servidor.'));
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('No fue posible conectar con el servidor.');
    purchases = new Subject();
    fixture.nativeElement.querySelector('ion-button').click();
    expect(purchases.observed).toBe(true);
  });

  it('al salir cancela la consulta pendiente', async () => {
    const fixture = await open();
    expect(response.observed).toBe(true);
    fixture.componentInstance.ionViewWillLeave();
    expect(response.observed).toBe(false);
  });
});
