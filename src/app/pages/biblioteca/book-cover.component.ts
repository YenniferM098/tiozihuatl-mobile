import { Component, OnDestroy, effect, inject, input, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { LibraryService } from '../../core/services/library.service';
@Component({
  selector: 'app-book-cover',
  template: `@if (url()) { <img loading="lazy" decoding="async" [src]="url()" [alt]="'Portada de ' + title()" (error)="url.set('')" /> }
    @else { <span class="placeholder" aria-label="Portada no disponible"><i class="ph ph-book-open" aria-hidden="true"></i></span> }`,
  styles: [`:host { display:block; width:76px; flex-shrink:0; } img,.placeholder { width:100%; height:108px; border-radius:8px; object-fit:contain; background:#edf5fb; } .placeholder { display:grid; place-items:center; font-size:32px; color:var(--ion-color-primary-shade); }`],
})
export class BookCoverComponent implements OnDestroy {
  readonly id = input.required<number>();
  readonly title = input.required<string>();
  readonly digital = input(false);
  readonly url = signal('');
  private readonly service = inject(LibraryService);
  private request?: Subscription;
  constructor() {
    effect(() => {
      this.request?.unsubscribe();
      this.url.set('');
      if (!this.digital()) return;
      this.request = this.service.preview(this.id()).subscribe({
        next: ({ previewUrl }) => { if (this.service.safeResource(previewUrl)) this.url.set(previewUrl); },
        error: () => this.url.set(''),
      });
    });
  }
  ngOnDestroy(): void { this.request?.unsubscribe(); }
}
