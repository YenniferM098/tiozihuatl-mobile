import { inject, signal } from '@angular/core';
import { Subscription, finalize } from 'rxjs';
import { Magazine } from '../../core/models/magazine.models';
import { MagazinesService, toMagazineError } from '../../core/services/magazines.service';

const PRICE = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

/** Precio en pesos mexicanos ($120.00). */
export function formatPrice(value: number): string {
  return PRICE.format(value);
}

/**
 * ViewModel del catálogo de Revistas (MVVM): conserva las revistas, el estado de carga y el
 * mensaje de error, y ejecuta los casos de uso del servicio. Al actualizar, si falla, conserva
 * lo que ya se ve. Se crea dentro del contexto de inyección de la página.
 */
export class MagazinesViewModel {
  private readonly service = inject(MagazinesService);
  private request?: Subscription;

  readonly magazines = signal<Magazine[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  /** Consulta el catálogo; `refresh` vuelve a pedirlo al servidor y `done` avisa al terminar. */
  load(refresh = false, done?: () => void): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.request = this.service
      .catalog(refresh)
      .pipe(finalize(() => done?.()))
      .subscribe({
        next: (magazines) => {
          this.magazines.set(magazines);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(toMagazineError(err).message);
          this.loading.set(false);
        },
      });
  }

  /** Al salir de la vista: cancela la petición pendiente. */
  leave(): void {
    this.request?.unsubscribe();
  }
}
