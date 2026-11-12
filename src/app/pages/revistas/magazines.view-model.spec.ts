import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Magazine, MagazineError } from '../../core/models/magazine.models';
import { MagazinesService } from '../../core/services/magazines.service';
import { MagazinesViewModel, formatPrice } from './magazines.view-model';

const MAGAZINE: Magazine = { id: 3, title: 'Salud', description: '', cover: null, price: 120, finalPrice: 90, hasDiscount: true };

describe('MagazinesViewModel (MVVM)', () => {
  let search: ReturnType<typeof vi.fn>;
  let purchases: ReturnType<typeof vi.fn>;
  let vm: MagazinesViewModel;

  beforeEach(() => {
    search = vi.fn(() => of([MAGAZINE]));
    purchases = vi.fn(() => of([{ id: 3, title: 'Salud', cover: null, purchasedAt: '2026-10-01' }]));
    TestBed.configureTestingModule({ providers: [{ provide: MagazinesService, useValue: { search, purchases } }] });
    vm = TestBed.runInInjectionContext(() => new MagazinesViewModel());
  });

  it('carga el catálogo y avisa al terminar', () => {
    const done = vi.fn();
    vm.load(false, done);
    expect(search).toHaveBeenCalledWith({ search: '', letter: '', sort: 'asc' }, false);
    expect(vm.magazines()).toEqual([MAGAZINE]);
    expect(vm.loading()).toBe(false);
    expect(vm.error()).toBe('');
    expect(done).toHaveBeenCalled();
  });

  it('muestra el mensaje de error y al actualizar conserva lo que ya se ve', () => {
    vm.load();
    search.mockReturnValue(throwError(() => new MagazineError('connection', 'Sin conexión')));
    vm.load(true);
    expect(search).toHaveBeenLastCalledWith({ search: '', letter: '', sort: 'asc' }, true);
    expect(vm.error()).toBe('Sin conexión');
    expect(vm.magazines()).toEqual([MAGAZINE]);
    expect(vm.loading()).toBe(false);
  });

  it('un error desconocido se muestra sin detalles técnicos', () => {
    search.mockReturnValue(throwError(() => new Error('ECONNRESET')));
    vm.load();
    expect(vm.error()).toBe('Ocurrió un problema en el servidor. Intenta más tarde.');
  });

  it('cancela la consulta anterior y la pendiente al salir', () => {
    const first = new Subject<Magazine[]>();
    search.mockReturnValue(first);
    vm.load();
    expect(first.observed).toBe(true);
    vm.leave();
    expect(first.observed).toBe(false);
    expect(vm.loading()).toBe(true);
  });

  it('envía la búsqueda sin espacios en los extremos, la letra y el orden', () => {
    expect(vm.filtered).toBe(false);
    vm.filters = { search: '  salud ', letter: 'S', sort: 'price_desc' };
    expect(vm.filtered).toBe(true);
    vm.load();
    expect(search).toHaveBeenLastCalledWith({ search: 'salud', letter: 'S', sort: 'price_desc' }, false);
  });

  it('el orden distinto de A–Z también cuenta como filtro', () => {
    vm.filters.sort = 'desc';
    expect(vm.filtered).toBe(true);
  });

  it('si falla una búsqueda nueva no deja los resultados anteriores', () => {
    vm.load();
    search.mockReturnValue(throwError(() => new MagazineError('connection', 'Sin conexión')));
    vm.filters.search = 'otra';
    vm.load();
    expect(vm.error()).toBe('Sin conexión');
    expect(vm.magazines()).toEqual([]);
  });

  it('limpiar quita la búsqueda, la letra y el orden y vuelve a consultar', () => {
    vm.filters = { search: 'salud', letter: 'S', sort: 'desc' };
    vm.reset();
    expect(vm.filters).toEqual({ search: '', letter: '', sort: 'asc' });
    expect(vm.filtered).toBe(false);
    expect(search).toHaveBeenLastCalledWith({ search: '', letter: '', sort: 'asc' }, false);
  });

  it('al entrar consulta el catálogo y las revistas adquiridas', () => {
    vm.enter();
    expect(search).toHaveBeenCalled();
    expect(purchases).toHaveBeenCalled();
    expect(vm.purchasesLoading()).toBe(false);
    expect(vm.purchasedIds().has(3)).toBe(true);
    expect(vm.purchasedIds().has(5)).toBe(false);
    expect(vm.view()).toBe('all');
  });

  it('si no puede consultar las compras lo informa sin afectar el catálogo', () => {
    purchases.mockReturnValue(throwError(() => new MagazineError('session', 'Tu sesión expiró. Inicia sesión nuevamente.')));
    vm.enter();
    expect(vm.purchasesError()).toBe('Tu sesión expiró. Inicia sesión nuevamente.');
    expect(vm.purchasedIds().size).toBe(0);
    expect(vm.magazines()).toEqual([MAGAZINE]);
    expect(vm.error()).toBe('');
  });

  it('al salir también cancela la consulta de compras', () => {
    const pending = new Subject<never[]>();
    purchases.mockReturnValue(pending);
    vm.loadPurchases();
    vm.leave();
    expect(pending.observed).toBe(false);
  });

  it('muestra los precios en pesos mexicanos', () => {
    expect(formatPrice(120)).toBe('$120.00');
    expect(formatPrice(1234.5)).toBe('$1,234.50');
  });
});
