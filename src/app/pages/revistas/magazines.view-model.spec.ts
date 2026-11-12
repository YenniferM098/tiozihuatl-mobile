import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Magazine, MagazineError } from '../../core/models/magazine.models';
import { MagazinesService } from '../../core/services/magazines.service';
import { MagazinesViewModel, formatPrice } from './magazines.view-model';

const MAGAZINE: Magazine = { id: 3, title: 'Salud', description: '', cover: null, price: 120, finalPrice: 90, hasDiscount: true };

describe('MagazinesViewModel (MVVM)', () => {
  let catalog: ReturnType<typeof vi.fn>;
  let vm: MagazinesViewModel;

  beforeEach(() => {
    catalog = vi.fn(() => of([MAGAZINE]));
    TestBed.configureTestingModule({ providers: [{ provide: MagazinesService, useValue: { catalog } }] });
    vm = TestBed.runInInjectionContext(() => new MagazinesViewModel());
  });

  it('carga el catálogo y avisa al terminar', () => {
    const done = vi.fn();
    vm.load(false, done);
    expect(catalog).toHaveBeenCalledWith(false);
    expect(vm.magazines()).toEqual([MAGAZINE]);
    expect(vm.loading()).toBe(false);
    expect(vm.error()).toBe('');
    expect(done).toHaveBeenCalled();
  });

  it('muestra el mensaje de error y al actualizar conserva lo que ya se ve', () => {
    vm.load();
    catalog.mockReturnValue(throwError(() => new MagazineError('connection', 'Sin conexión')));
    vm.load(true);
    expect(catalog).toHaveBeenLastCalledWith(true);
    expect(vm.error()).toBe('Sin conexión');
    expect(vm.magazines()).toEqual([MAGAZINE]);
    expect(vm.loading()).toBe(false);
  });

  it('un error desconocido se muestra sin detalles técnicos', () => {
    catalog.mockReturnValue(throwError(() => new Error('ECONNRESET')));
    vm.load();
    expect(vm.error()).toBe('Ocurrió un problema en el servidor. Intenta más tarde.');
  });

  it('cancela la consulta anterior y la pendiente al salir', () => {
    const first = new Subject<Magazine[]>();
    catalog.mockReturnValue(first);
    vm.load();
    expect(first.observed).toBe(true);
    vm.leave();
    expect(first.observed).toBe(false);
    expect(vm.loading()).toBe(true);
  });

  it('muestra los precios en pesos mexicanos', () => {
    expect(formatPrice(120)).toBe('$120.00');
    expect(formatPrice(1234.5)).toBe('$1,234.50');
  });
});
