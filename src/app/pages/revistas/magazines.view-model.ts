import { inject, signal } from '@angular/core';
import { Subscription, finalize } from 'rxjs';
import { Magazine, MagazineFilters, MagazineSort } from '../../core/models/magazine.models';
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

/** Precio en pesos mexicanos ($120.00). */
export function formatPrice(value: number): string {
  return PRICE.format(value);
}

/**
 * ViewModel del catálogo de Revistas (MVVM): conserva las revistas, la búsqueda, la letra
 * inicial, el orden, el estado de carga y el mensaje de error, y ejecuta los casos de uso del
 * servicio. Si falla una actualización con los mismos filtros, conserva lo que ya se ve; con
 * filtros nuevos no deja resultados que no les corresponden. Se crea dentro del contexto de
 * inyección de la página.
 */
export class MagazinesViewModel {
  private readonly service = inject(MagazinesService);
  private request?: Subscription;
  /** Filtros de los resultados que están en pantalla. */
  private shown = '';
  filters: MagazineFilters = { ...DEFAULT_FILTERS };

  readonly magazines = signal<Magazine[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  /** Hay búsqueda, letra u orden distintos de los predeterminados. */
  get filtered(): boolean {
    return !!this.filters.search.trim() || !!this.filters.letter || this.filters.sort !== DEFAULT_FILTERS.sort;
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
  }
}
