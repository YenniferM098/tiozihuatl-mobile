import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GuiaComponent } from './guia.component';
import { GuidePaso } from './pasos';

const PASOS: GuidePaso[] = [
  { objetivo: 'ion-tab-button[tab="home"]', titulo: 'Inicio', texto: 'Texto de inicio' },
  { objetivo: '[data-guia="prueba-buscador"]', titulo: 'Buscar', texto: 'Texto de buscar' },
  { objetivo: '[data-guia="prueba-salir"]', titulo: 'Salir', texto: 'Texto de salir' },
];

describe('GuiaComponent (MEJ-01 guía de primer uso)', () => {
  let fixture: ComponentFixture<GuiaComponent>;
  let html: HTMLElement;
  let cerrada: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(GuiaComponent);
    fixture.componentRef.setInput('pasos', PASOS);
    cerrada = vi.fn<() => void>();
    fixture.componentInstance.cerrada.subscribe(cerrada);
    html = fixture.nativeElement;
    await fixture.whenStable();
  });

  const texto = (selector: string) => html.querySelector(selector)?.textContent?.trim();
  const tocar = async (selector: string) => {
    html.querySelector<HTMLButtonElement>(selector)!.click();
    await fixture.whenStable();
  };

  it('muestra el primer paso con su contador y sin el botón Anterior', () => {
    expect(texto('.guia__titulo')).toBe('Inicio');
    expect(texto('.guia__texto')).toBe('Texto de inicio');
    expect(texto('.guia__contador')).toBe('1 de 3');
    expect(html.querySelector('.guia__anterior')).toBeNull();
    expect(texto('.guia__siguiente')).toBe('Siguiente');
  });

  it('avanza y regresa entre los pasos', async () => {
    await tocar('.guia__siguiente');
    expect(texto('.guia__titulo')).toBe('Buscar');
    expect(texto('.guia__contador')).toBe('2 de 3');

    await tocar('.guia__anterior');
    expect(texto('.guia__titulo')).toBe('Inicio');
    expect(cerrada).not.toHaveBeenCalled();
  });

  it('en el último paso dice Entendido y al tocarlo se cierra', async () => {
    await tocar('.guia__siguiente');
    await tocar('.guia__siguiente');
    expect(texto('.guia__siguiente')).toBe('Entendido');

    await tocar('.guia__siguiente');
    expect(cerrada).toHaveBeenCalledTimes(1);
  });

  it('Omitir cierra la guía desde cualquier paso', async () => {
    await tocar('.guia__siguiente');
    await tocar('.guia__omitir');
    expect(cerrada).toHaveBeenCalledTimes(1);
  });

  it('el botón Atrás de Android cierra la guía como Omitir', () => {
    let manejador: (() => void) | undefined;
    const evento = new CustomEvent('ionBackButton', {
      detail: { register: (_prioridad: number, fn: () => void) => (manejador = fn) },
    });
    document.dispatchEvent(evento);

    manejador?.();
    expect(cerrada).toHaveBeenCalledTimes(1);
  });

  it('es un diálogo accesible con título y mensaje', () => {
    const dialogo = html.querySelector('[role="dialog"]')!;
    expect(dialogo.getAttribute('aria-modal')).toBe('true');
    expect(dialogo.getAttribute('aria-labelledby')).toBe('guia-titulo');
    expect(dialogo.getAttribute('aria-describedby')).toBe('guia-texto');
  });

  /** Agrega a la página un elemento con su posición en pantalla. */
  function elemento(tag: string, atributos: Record<string, string>, rect: Partial<DOMRect>): HTMLElement {
    const el = document.createElement(tag);
    for (const [nombre, valor] of Object.entries(atributos)) el.setAttribute(nombre, valor);
    el.getBoundingClientRect = () => ({ top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0, ...rect }) as DOMRect;
    document.body.appendChild(el);
    return el;
  }

  afterEach(() => document.querySelectorAll('ion-tab-button, [data-guia]').forEach((el) => el.remove()));

  it('resalta la opción de la barra y coloca el globo encima de ella', () => {
    elemento('ion-tab-button', { tab: 'home' }, { top: 700, left: 20, width: 60, height: 48, bottom: 748 });

    fixture.componentInstance.onResize();
    expect(fixture.componentInstance.foco()).toEqual({ top: 694, left: 14, width: 72, height: 60, radio: 999 });
    expect(fixture.componentInstance.posicion().bottom).toBe(
      Math.min(window.innerHeight - 700 + 6 + 18, window.innerHeight - 190 - 16),
    );
    expect(fixture.componentInstance.debajo()).toBe(false);
  });

  it('con un elemento en la parte superior coloca el globo debajo', async () => {
    elemento('div', { 'data-guia': 'prueba-buscador' }, { top: 60, left: 16, width: 300, height: 50, bottom: 110 });
    await tocar('.guia__siguiente');

    fixture.componentInstance.onResize();
    expect(fixture.componentInstance.foco()?.radio).toBe(16);
    expect(fixture.componentInstance.debajo()).toBe(true);
    await fixture.whenStable();
    expect(html.querySelector('.guia__flecha--arriba')).not.toBeNull();
  });

  it('ignora las copias ocultas de un elemento (pestañas que Ionic conserva)', () => {
    elemento('ion-tab-button', { tab: 'home' }, { width: 0 });
    elemento('ion-tab-button', { tab: 'home' }, { top: 700, left: 100, width: 60, height: 48, bottom: 748 });

    fixture.componentInstance.onResize();
    expect(fixture.componentInstance.foco()?.left).toBe(94);
  });

  it('desplaza la pantalla si el elemento no está a la vista', async () => {
    vi.useFakeTimers();
    const salir = elemento('button', { 'data-guia': 'prueba-salir' }, { top: 2000, left: 16, width: 200, height: 48, bottom: 2048 });
    salir.scrollIntoView = vi.fn();
    fixture.componentInstance.indice.set(2);
    fixture.detectChanges();
    vi.advanceTimersByTime(50);

    expect(salir.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    vi.useRealTimers();
  });

  it('espera a que el elemento aparezca y, si no aparece, centra el globo sin resaltado', () => {
    vi.useFakeTimers();
    fixture.componentInstance.indice.set(1);
    fixture.detectChanges();
    vi.advanceTimersByTime(1000);
    expect(fixture.componentInstance.foco()).toBeNull();

    elemento('div', { 'data-guia': 'prueba-buscador' }, { top: 300, left: 16, width: 300, height: 50, bottom: 350 });
    vi.advanceTimersByTime(300);
    expect(fixture.componentInstance.foco()).not.toBeNull();
    vi.useRealTimers();
  });

  it('sin el elemento en pantalla centra el globo sin resaltado', () => {
    fixture.componentInstance.onResize();
    expect(fixture.componentInstance.foco()).toBeNull();
    expect(fixture.componentInstance.debajo()).toBe(false);
  });

  it('con un solo paso no muestra el contador ni Omitir, solo Entendido', async () => {
    fixture.componentRef.setInput('pasos', [PASOS[0]]);
    await fixture.whenStable();
    expect(html.querySelector('.guia__contador')).toBeNull();
    expect(html.querySelector('.guia__omitir')).toBeNull();
    expect(texto('.guia__siguiente')).toBe('Entendido');

    await tocar('.guia__siguiente');
    expect(cerrada).toHaveBeenCalledTimes(1);
  });
});
