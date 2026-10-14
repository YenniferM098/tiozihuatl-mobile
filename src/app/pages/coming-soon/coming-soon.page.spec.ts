import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { ComingSoonData, ComingSoonPage } from './coming-soon.page';

describe('ComingSoonPage (HU-02 navegación)', () => {
  const DATA: ComingSoonData = {
    title: 'Revistas',
    icon: 'newspaper',
    description: 'Muy pronto podrás leer las revistas del Instituto desde tu celular.',
  };

  it('muestra el título, el icono y la descripción de la pestaña', async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { data: DATA } } }],
    });
    const fixture = TestBed.createComponent(ComingSoonPage);
    await fixture.whenStable();
    const html: HTMLElement = fixture.nativeElement;

    expect(html.querySelector('ion-title')?.textContent).toContain('Revistas');
    expect(html.querySelector('.coming-soon__title')?.textContent).toBe('Próximamente');
    expect(html.querySelector('.coming-soon__text')?.textContent).toBe(DATA.description);
    expect(html.querySelector('.coming-soon__badge i')?.className).toContain('ph-newspaper');
  });
});
