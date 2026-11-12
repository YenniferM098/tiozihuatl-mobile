import { computed, inject, signal } from '@angular/core';
import { Subscription, finalize } from 'rxjs';
import { Magazine, MagazineFilters, MagazineSort, PurchasedMagazine } from '../../core/models/magazine.models';
import { MagazinesService, toMagazineError } from '../../core/services/magazines.service';

const PRICE = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const DEFAULT_FILTERS: MagazineFilters = { search: '', letter: '', sort: 'asc' };

/** Ordenamientos que ofrece la vista (los que admite el backend). */
export const MAGAZINE_SORTS: readonly { value: MagazineSort; label: string }[] = [
  { value: 'asc', label: 'Título A–Z' },
  { value: 'desc', label: 'Título Z–A' },
  { value: 'price_asc', label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' },
];

/** Letras iniciales para filtrar (alfabeto español). */
export const MAGAZINE_LETTERS: readonly string[] = [...'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'];

/** Pestañas del catálogo: todas las revistas o solo las que adquirió el usuario. */
export type MagazinesView = 'all' | 'mine';

/** Precio en pesos mexicanos ($120.00). */
export function formatPrice(value: number): string {
  return PRICE.format(value);
}

/**
 * ViewModel del catálogo de Revistas (MVVM): conserva las revistas, la búsqueda, la letra
 * inicial, el orden, el estado de carga y el mensaje de error, y ejecuta los casos de uso del
 * servicio. Si falla una actualización con los mismos filtros, conserva lo que ya se ve; con
 * filtros nuevos no deja resultados que no les corresponden. También conserva las revistas que
 * adquirió el usuario, para marcarlas en el catálogo y mostrarlas en "Mis revistas".
 * Se crea dentro del contexto de inyección de la página.
 */
export class MagazinesViewModel {
  private readonly service = inject(MagazinesService);
  private request?: Subscription;
  private purchasesRequest?: Subscription;
  /** Filtros de los resultados que están en pantalla. */
  private shown = '';
  filters: MagazineFilters = { ...DEFAULT_FILTERS };

  readonly magazines = signal<Magazine[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly view = signal<MagazinesView>('all');
  readonly purchases = signal<PurchasedMagazine[]>([]);
  readonly purchasesLoading = signal(true);
  readonly purchasesError = signal('');
  readonly purchasedIds = computed(() => new Set(this.purchases().map((p) => p.id)));

  /** Hay búsqueda, letra u orden distintos de los predeterminados. */
  get filtered(): boolean {
    return !!this.filters.search.trim() || !!this.filters.letter || this.filters.sort !== DEFAULT_FILTERS.sort;
  }

  /** Al entrar a la vista: consulta el catálogo y las revistas adquiridas. */
  enter(): void {
    this.load();
    this.loadPurchases();
  }

  /** GET /magazines/my-purchases. Si falla, el catálogo se muestra igual, sin la marca "Adquirida". */
  loadPurchases(): void {
    this.purchasesRequest?.unsubscribe();
    this.purchasesLoading.set(true);
    this.purchasesError.set('');
    this.purchasesRequest = this.service.purchases().subscribe({
      next: (purchases) => {
        this.purchases.set(purchases);
        this.purchasesLoading.set(false);
      },
      error: (err) => {
        this.purchasesError.set(toMagazineError(err).message);
        this.purchasesLoading.set(false);
      },
    });
  }

  /** Consulta el catálogo con los filtros; `refresh` vuelve a pedirlo al servidor y `done` avisa al terminar. */
  load(refresh = false, done?: () => void): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    const filters = { ...this.filters, search: this.filters.search.trim() };
    const key = JSON.stringify(filters);
    this.request = this.service
      .search(filters, refresh)
      .pipe(finalize(() => done?.()))
      .subscribe({
        next: (magazines) => {
          this.magazines.set(magazines);
          this.shown = key;
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(toMagazineError(err).message);
          if (key !== this.shown) this.magazines.set([]);
          this.loading.set(false);
        },
      });
  }

  /** Quita la búsqueda, la letra y el orden elegidos. */
  reset(): void {
    this.filters = { ...DEFAULT_FILTERS };
    this.load();
  }

  /** Al salir de la vista: cancela la petición pendiente. */
  leave(): void {
    this.request?.unsubscribe();
    this.purchasesRequest?.unsubscribe();
  }
}
