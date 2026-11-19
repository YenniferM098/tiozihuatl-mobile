import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GuiaComponent } from './guia.component';
import { GuidePaso } from './pasos';

const PASOS: GuidePaso[] = [
  { tab: 'home', titulo: 'Inicio', texto: 'Texto de inicio' },
  { tab: 'revistas', titulo: 'Revistas', texto: 'Texto de revistas' },
  { tab: 'perfil', titulo: 'Perfil', texto: 'Texto de perfil' },
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
    expect(texto('.guia__titulo')).toBe('Revistas');
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

  it('resalta la opción del paso y coloca el globo encima de ella', () => {
    const opcion = document.createElement('ion-tab-button');
    opcion.setAttribute('tab', 'home');
    opcion.getBoundingClientRect = () => ({ top: 700, left: 20, width: 60, height: 48 }) as DOMRect;
    document.body.appendChild(opcion);

    fixture.componentInstance.onResize();
    const foco = fixture.componentInstance.foco();
    expect(foco).toEqual({ top: 694, left: 14, width: 72, height: 60 });
    expect(fixture.componentInstance.posicion().bottom).toBe(window.innerHeight - 700 + 6 + 18);

    opcion.remove();
  });

  it('sin la opción en pantalla centra el globo sin resaltado', () => {
    fixture.componentInstance.onResize();
    expect(fixture.componentInstance.foco()).toBeNull();
  });
});
