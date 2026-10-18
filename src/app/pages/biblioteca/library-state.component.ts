import { Component, input, output } from '@angular/core';
import { IonButton, IonSpinner } from '@ionic/angular';
@Component({
  selector: 'app-library-state',
  imports: [IonButton, IonSpinner],
  template: `<div class="state" role="status" aria-live="polite">
    @if (loading()) { <ion-spinner name="crescent" aria-label="Cargando" /> }
    <p>{{ message() }}</p>
    @if (retry()) { <ion-button (click)="retryClick.emit()">Reintentar</ion-button> }
  </div>`,
  styles: [`.state { text-align:center; padding:32px 16px; color:var(--tz-text-muted); }`],
})
export class LibraryStateComponent {
  readonly loading = input(false);
  readonly message = input.required<string>();
  readonly retry = input(false);
  readonly retryClick = output<void>();
}
