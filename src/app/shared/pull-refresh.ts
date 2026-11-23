import { Signal, effect, signal } from '@angular/core';

type Refresher = { complete(): unknown };

/**
 * Deslizar para actualizar (#229): guarda el indicador del gesto y lo cierra cuando la
 * recarga termina (`loading` vuelve a false). Se crea en el contexto de inyección de la página.
 */
export class PullRefresh {
  private readonly pending = signal<Refresher | null>(null);

  constructor(loading: Signal<boolean>) {
    effect(() => {
      const refresher = this.pending();
      if (loading() || !refresher) return;
      void refresher.complete();
      this.pending.set(null);
    });
  }

  /** Registra el gesto; la página inicia la recarga justo después. */
  start(event: Event): void {
    this.pending.set(event.target as unknown as Refresher);
  }
}
