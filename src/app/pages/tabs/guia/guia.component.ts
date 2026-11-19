import {
  Component,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { HapticDirective } from '../../../core/directives/haptic.directive';
import { GuidePaso } from './pasos';

/** Margen del globo con los bordes de la pantalla y ancho máximo. */
const MARGEN = 16;
const ANCHO_MAXIMO = 360;
/** Separación entre el globo y la opción resaltada (deja espacio para la flecha). */
const SEPARACION = 18;
/** Holgura del resaltado alrededor de la opción. */
const HOLGURA = 6;

interface Foco {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Posicion {
  bottom: number;
  left: number;
  width: number;
  /** Posición horizontal de la flecha dentro del globo. */
  flecha: number;
}

/** Evento del botón Atrás de Android que emite Ionic (permite registrar un manejador con prioridad). */
type BackButtonEvent = CustomEvent<{ register: (prioridad: number, manejador: () => void) => void }>;

/**
 * Guía de primer uso (MEJ-01): oscurece la pantalla, resalta la opción de la barra
 * inferior del paso actual y muestra un globo con su mensaje y los botones
 * Anterior, Siguiente (Entendido en el último paso) y Omitir.
 * Emite `cerrada` al terminar u omitir; quien la usa guarda que ya se vio.
 */
@Component({
  selector: 'app-guia',
  templateUrl: 'guia.component.html',
  styleUrls: ['guia.component.scss'],
  imports: [HapticDirective],
})
export class GuiaComponent {
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

  readonly pasos = input.required<GuidePaso[]>();
  readonly cerrada = output<void>();

  readonly indice = signal(0);
  readonly paso = computed(() => this.pasos()[this.indice()]);
  readonly esPrimero = computed(() => this.indice() === 0);
  readonly esUltimo = computed(() => this.indice() === this.pasos().length - 1);

  /** Área resaltada; null si la opción no está en pantalla (el globo se centra sin flecha). */
  readonly foco = signal<Foco | null>(null);
  readonly posicion = signal<Posicion>({ bottom: 120, left: MARGEN, width: ANCHO_MAXIMO, flecha: 0 });

  constructor() {
    // Cada cambio de paso vuelve a medir la opción cuando la vista ya se pintó.
    effect(() => {
      const tab = this.paso()?.tab;
      requestAnimationFrame(() => this.medir(tab));
    });
  }

  siguiente(): void {
    if (this.esUltimo()) this.cerrar();
    else this.indice.update((i) => i + 1);
  }

  anterior(): void {
    if (!this.esPrimero()) this.indice.update((i) => i - 1);
  }

  omitir(): void {
    this.cerrar();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.medir(this.paso()?.tab);
  }

  /** El botón Atrás de Android cierra la guía igual que Omitir, antes que la navegación. */
  @HostListener('document:ionBackButton', ['$event'])
  onBackButton(event: Event): void {
    (event as BackButtonEvent).detail?.register(150, () => this.omitir());
  }

  private cerrar(): void {
    this.cerrada.emit();
  }

  private medir(tab: string | undefined): void {
    const anchoPantalla = window.innerWidth;
    const altoPantalla = window.innerHeight;
    const width = Math.min(anchoPantalla - MARGEN * 2, ANCHO_MAXIMO);
    const left = (anchoPantalla - width) / 2;
    const opcion = tab ? document.querySelector(`ion-tab-button[tab="${tab}"]`) : null;
    const rect = opcion?.getBoundingClientRect();

    if (!rect || rect.width === 0) {
      this.foco.set(null);
      this.posicion.set({ bottom: 120, left, width, flecha: 0 });
    } else {
      this.foco.set({
        top: rect.top - HOLGURA,
        left: rect.left - HOLGURA,
        width: rect.width + HOLGURA * 2,
        height: rect.height + HOLGURA * 2,
      });
      const centro = rect.left + rect.width / 2 - left;
      this.posicion.set({
        bottom: altoPantalla - rect.top + HOLGURA + SEPARACION,
        left,
        width,
        flecha: Math.min(Math.max(centro, 24), width - 24),
      });
    }
    // El foco del teclado y del lector de pantalla queda en la acción principal del globo.
    this.host.querySelector<HTMLButtonElement>('.guia__siguiente')?.focus();
  }
}
