import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SectionTitleComponent } from './section-title.component';

@Component({
  imports: [SectionTitleComponent],
  template: `<app-section-title icon="books" title="Biblioteca Digital" [count]="count" />`,
})
class HostComponent {
  count = '137 libros';
}

describe('SectionTitleComponent - título de sección en la barra (#229)', () => {
  it('muestra el ícono, el título como encabezado principal y el total', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h1')?.textContent).toBe('Biblioteca Digital');
    expect(el.querySelector('.section-count')?.textContent).toBe('137 libros');
    expect(el.querySelector('.section-icon i')?.className).toContain('ph-books');
  });

  it('el ícono es decorativo para el lector de pantalla', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.section-icon')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('oculta el total cuando no hay un total que mostrar', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.count = '';
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.section-count')).toBeNull();
  });
});
