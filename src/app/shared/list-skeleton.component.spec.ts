import { TestBed } from '@angular/core/testing';
import { ListSkeletonComponent } from './list-skeleton.component';
import { commaList, shortSemesters } from './semesters';

describe('ListSkeletonComponent - carga con siluetas (#229)', () => {
  it('muestra las siluetas indicadas y anuncia el mensaje al lector de pantalla', async () => {
    const fixture = TestBed.createComponent(ListSkeletonComponent);
    fixture.componentRef.setInput('message', 'Cargando catálogo…');
    fixture.componentRef.setInput('count', 3);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.skeleton-card').length).toBe(3);
    expect(el.querySelector('[role="status"]')?.textContent).toBe('Cargando catálogo…');
    expect(el.querySelector('.skeleton-list')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('en cuadrícula usa dos columnas y siempre muestra al menos una silueta', async () => {
    const fixture = TestBed.createComponent(ListSkeletonComponent);
    fixture.componentRef.setInput('message', 'Cargando');
    fixture.componentRef.setInput('count', 0);
    fixture.componentRef.setInput('layout', 'grid');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.skeleton-list.grid')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.skeleton-card').length).toBe(1);
  });
});

describe('shortSemesters - semestres en etiquetas cortas', () => {
  it('convierte los ordinales y quita repetidos', () => {
    expect(shortSemesters('Primer semestre,Segundo semestre,Tercer semestre')).toEqual(['1.º', '2.º', '3.º']);
    expect(shortSemesters('Séptimo semestre, Octavo semestre, Primero, 4 semestre')).toEqual(['1.º', '4.º', '7.º', '8.º']);
    expect(shortSemesters('Cuarto semestre,Tercer semestre')).toEqual(['3.º', '4.º']);
    expect(shortSemesters('Primer semestre,Primer semestre')).toEqual(['1.º']);
  });

  it('deja tal cual lo que no reconoce y tolera valores vacíos', () => {
    expect(shortSemesters('Propedéutico,Segundo semestre')).toEqual(['2.º', 'Propedéutico']);
    expect(shortSemesters('')).toEqual([]);
    expect(shortSemesters(null)).toEqual([]);
    expect(shortSemesters(' , ')).toEqual([]);
  });
});

describe('commaList - listas legibles', () => {
  it('agrega un espacio después de cada coma y quita vacíos', () => {
    expect(commaList('Enfermería,Enfermería Básica')).toBe('Enfermería, Enfermería Básica');
    expect(commaList(' A , ,B ')).toBe('A, B');
    expect(commaList(null)).toBe('');
  });
});
