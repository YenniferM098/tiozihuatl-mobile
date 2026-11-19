import {
  Component,
  DestroyRef,
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
/** Separación entre el globo y el elemento resaltado (deja espacio para la flecha). */
const SEPARACION = 18;
/** Holgura del resaltado alrededor del elemento. */
const HOLGURA = 6;
/** Alto aproximado del globo, para decidir si cabe arriba o abajo del elemento. */
const ALTO_GLOBO = 190;
/** Alto de la barra inferior: un elemento detrás de ella no se considera visible. */
const ALTO_BARRA = 80;
/** Tiempo máximo para esperar un elemento que todavía se está cargando (tarjetas, perfil). */
const ESPERA_MAXIMA_MS = 3000;
const INTERVALO_MS = 150;

interface Foco {
  top: number;
  left: number;
  width: number;
  height: number;
  radio: number;
}

interface Posicion {
  /** Distancia desde arriba (globo debajo del elemento) o desde abajo (globo encima). */
  top: number | null;
  bottom: number | null;
  left: number;
  width: number;
  /** Posición horizontal de la flecha dentro del globo. */
  flecha: number;
}

/** Evento del botón Atrás de Android que emite Ionic (permite registrar un manejador con prioridad). */
type BackButtonEvent = CustomEvent<{ register: (prioridad: number, manejador: () => void) => void }>;

/**
 * Guía de primer uso (MEJ-01): oscurece la pantalla, resalta el elemento del paso
 * actual (una opción de la barra inferior o un elemento de un módulo) y muestra un
 * globo con su mensaje y los botones Anterior, Siguiente (Entendido en el último
 * paso) y Omitir. El globo se coloca arriba o abajo del elemento según el espacio.
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
  private espera?: ReturnType<typeof setTimeout>;

  readonly pasos = input.required<GuidePaso[]>();
  readonly cerrada = output<void>();

  readonly indice = signal(0);
  readonly paso = computed(() => this.pasos()[this.indice()]);
  readonly esPrimero = computed(() => this.indice() === 0);
  readonly esUltimo = computed(() => this.indice() === this.pasos().length - 1);

  /** Área resaltada; null si el elemento no está en pantalla (el globo se centra sin flecha). */
  readonly foco = signal<Foco | null>(null);
  readonly posicion = signal<Posicion>({ top: null, bottom: 120, left: MARGEN, width: ANCHO_MAXIMO, flecha: 0 });
  /** El globo está debajo del elemento (la flecha apunta hacia arriba). */
  readonly debajo = computed(() => this.posicion().top !== null);

  constructor() {
    // Cada cambio de paso busca su elemento cuando la vista ya se pintó.
    effect(() => {
      const objetivo = this.paso()?.objetivo;
      requestAnimationFrame(() => this.buscar(objetivo, Date.now()));
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.espera));
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
    this.medir(this.elemento(this.paso()?.objetivo));
  }

  /** El botón Atrás de Android cierra la guía igual que Omitir, antes que la navegación. */
  @HostListener('document:ionBackButton', ['$event'])
  onBackButton(event: Event): void {
    (event as BackButtonEvent).detail?.register(150, () => this.omitir());
  }

  private cerrar(): void {
    clearTimeout(this.espera);
    this.cerrada.emit();
  }

  /** Primer elemento visible que coincide (Ionic conserva ocultas las pestañas visitadas). */
  private elemento(objetivo: string | undefined): HTMLElement | null {
    if (!objetivo) return null;
    const candidatos = Array.from(document.querySelectorAll<HTMLElement>(objetivo));
    return candidatos.find((el) => el.getBoundingClientRect().width > 0) ?? null;
  }

  /** Espera a que aparezca el elemento (por ejemplo, tarjetas que aún se cargan); si no aparece, centra el globo. */
  private buscar(objetivo: string | undefined, inicio: number): void {
    clearTimeout(this.espera);
    const el = this.elemento(objetivo);
    if (!el && objetivo && Date.now() - inicio < ESPERA_MAXIMA_MS) {
      this.espera = setTimeout(() => this.buscar(objetivo, inicio), INTERVALO_MS);
      return;
    }
    if (el && !this.estaVisible(el)) {
      el.scrollIntoView({ block: 'center' });
      requestAnimationFrame(() => this.medir(el));
      return;
    }
    this.medir(el);
  }

  private estaVisible(el: HTMLElement): boolean {
    const rect = el.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight - ALTO_BARRA;
  }

  private medir(el: HTMLElement | null): void {
    const anchoPantalla = window.innerWidth;
    const altoPantalla = window.innerHeight;
    const width = Math.min(anchoPantalla - MARGEN * 2, ANCHO_MAXIMO);
    const left = (anchoPantalla - width) / 2;
    const rect = el?.getBoundingClientRect();

    if (!el || !rect || rect.width === 0) {
      this.foco.set(null);
      this.posicion.set({ top: null, bottom: 120, left, width, flecha: 0 });
    } else {
      const esOpcionDeBarra = el.tagName === 'ION-TAB-BUTTON';
      this.foco.set({
        top: rect.top - HOLGURA,
        left: rect.left - HOLGURA,
        width: rect.width + HOLGURA * 2,
        height: rect.height + HOLGURA * 2,
        radio: esOpcionDeBarra ? 999 : 16,
      });
      const flecha = Math.min(Math.max(rect.left + rect.width / 2 - left, 24), width - 24);
      const espacioArriba = rect.top;
      const espacioAbajo = altoPantalla - ALTO_BARRA - rect.bottom;
      const arriba = esOpcionDeBarra || espacioArriba >= ALTO_GLOBO || espacioArriba > espacioAbajo;
      this.posicion.set(
        arriba
          ? { top: null, bottom: Math.min(altoPantalla - rect.top + HOLGURA + SEPARACION, altoPantalla - ALTO_GLOBO - MARGEN), left, width, flecha }
          : { top: Math.min(rect.bottom + HOLGURA + SEPARACION, altoPantalla - ALTO_BARRA - ALTO_GLOBO), bottom: null, left, width, flecha },
      );
    }
    // El foco del teclado y del lector de pantalla queda en la acción principal del globo.
    this.host.querySelector<HTMLButtonElement>('.guia__siguiente')?.focus();
  }
}
