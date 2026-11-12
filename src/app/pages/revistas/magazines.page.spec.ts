import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { Magazine, MagazineError } from '../../core/models/magazine.models';
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
  let catalog: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    response = new Subject();
    catalog = vi.fn(() => response);
    TestBed.configureTestingModule({
      imports: [MagazinesPage],
      providers: [provideRouter([]), { provide: MagazinesService, useValue: { catalog } }],
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
    expect(catalog).toHaveBeenLastCalledWith(true);
  });

  it('al deslizar actualiza el catálogo y cierra el indicador', async () => {
    const fixture = await open();
    response.next([SALUD]);
    const complete = vi.fn();
    response = new Subject();
    fixture.componentInstance.refresh({ target: { complete } } as unknown as Event);
    expect(catalog).toHaveBeenLastCalledWith(true);
    response.next([SALUD]);
    response.complete();
    expect(complete).toHaveBeenCalled();
  });

  it('al salir cancela la consulta pendiente', async () => {
    const fixture = await open();
    expect(response.observed).toBe(true);
    fixture.componentInstance.ionViewWillLeave();
    expect(response.observed).toBe(false);
  });
});
