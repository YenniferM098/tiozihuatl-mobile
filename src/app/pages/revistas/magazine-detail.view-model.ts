import { inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { MagazineDetail, MagazineError } from '../../core/models/magazine.models';
import { MagazinesService, toMagazineError } from '../../core/services/magazines.service';

/**
 * ViewModel del detalle de una revista (MVVM): conserva la revista, el estado de carga y el
 * error ya clasificado. Se crea dentro del contexto de inyección de la página.
 */
export class MagazineDetailViewModel {
  private readonly service = inject(MagazinesService);
  private request?: Subscription;

  readonly magazine = signal<MagazineDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal<MagazineError | null>(null);

  load(id: number): void {
    this.request?.unsubscribe();
    this.magazine.set(null);
    this.error.set(null);
    this.loading.set(true);
    this.request = this.service.detail(id).subscribe({
      next: (magazine) => {
        this.magazine.set(magazine);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(toMagazineError(err));
        this.loading.set(false);
      },
    });
  }

  /** Al salir de la vista: cancela la petición pendiente. */
  leave(): void {
    this.request?.unsubscribe();
  }
}
