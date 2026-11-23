import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Siluetas animadas con forma de tarjeta mientras carga una lista (#229). El mensaje queda
 * disponible para el lector de pantalla; las siluetas son decorativas.
 */
@Component({
  selector: 'app-list-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="sr-only" role="status" aria-live="polite">{{ message() }}</p>
    <div class="skeleton-list" [class.grid]="layout() === 'grid'" aria-hidden="true">
      @for (item of items(); track item) {
        <div class="skeleton-card">
          <span class="bone cover"></span>
          <div class="lines"><span class="bone title"></span><span class="bone line"></span><span class="bone line short"></span><span class="bone chip"></span></div>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .skeleton-list { display: grid; gap: 12px; }
    .skeleton-card { display: flex; gap: 14px; padding: 14px; background: #fff; border: 1px solid #e3e9ef; border-radius: 16px; }
    .lines { flex: 1; display: grid; gap: 8px; align-content: start; }
    .bone { display: block; border-radius: 6px; background: linear-gradient(90deg, #e9f0f6 25%, #f5f9fc 50%, #e9f0f6 75%); background-size: 200% 100%; animation: shimmer 1.2s ease-in-out infinite; }
    .cover { width: 72px; height: 100px; flex: none; border-radius: 8px; }
    .title { height: 16px; width: 85%; }
    .line { height: 12px; width: 65%; }
    .short { width: 45%; }
    .chip { height: 20px; width: 90px; border-radius: 999px; }
    .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grid .skeleton-card { flex-direction: column; }
    .grid .cover { width: 100%; height: 150px; }
    @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
    @media (prefers-reduced-motion: reduce) { .bone { animation: none; } }
  `,
})
export class ListSkeletonComponent {
  readonly message = input.required<string>();
  readonly count = input(4);
  /** `list`: tarjetas horizontales (libros, materiales); `grid`: dos columnas (revistas). */
  readonly layout = input<'list' | 'grid'>('list');
  readonly items = computed(() => Array.from({ length: Math.max(1, this.count()) }, (_, i) => i));
}
