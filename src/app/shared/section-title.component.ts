import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Título de sección dentro de la barra azul (#229): ícono pequeño, título y total de
 * elementos. Se coloca dentro de un `ion-toolbar`; el buscador va en una segunda barra.
 * Lo usan Biblioteca, Materiales, Revistas, Inicio y Perfil para que la app se vea uniforme.
 */
@Component({
  selector: 'app-section-title',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="section-icon" aria-hidden="true"><i class="ph ph-{{ icon() }}"></i></span>
    <h1>{{ title() }}</h1>
    @if (count()) { <span class="section-count">{{ count() }}</span> }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 56px;
      padding: 0 16px;
      color: #fff;
    }
    .section-icon {
      flex: none;
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 11px;
      background: rgba(255, 255, 255, 0.2);
      font-size: 20px;
    }
    h1 {
      flex: 1;
      min-width: 0;
      margin: 0;
      font-family: var(--tz-font-display);
      font-size: 20px;
      font-weight: 800;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .section-count {
      flex: none;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.22);
      font-size: 12px;
      font-weight: 700;
    }
  `,
})
export class SectionTitleComponent {
  /** Nombre del ícono de Phosphor, sin el prefijo `ph-` (por ejemplo `books`). */
  readonly icon = input.required<string>();
  readonly title = input.required<string>();
  /** Total que se muestra a la derecha (por ejemplo "137 libros"); vacío lo oculta. */
  readonly count = input<string>('');
}
