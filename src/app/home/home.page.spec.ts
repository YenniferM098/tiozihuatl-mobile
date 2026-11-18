import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { AuthUser, UserRole } from '../core/models/auth.models';
import { AuthService } from '../core/services/auth.service';
import { HomeContentService } from '../core/services/home-content.service';
import { SessionService } from '../core/services/session.service';
import { HomePage } from './home.page';

describe('HomePage (HU-02 acceso según el rol)', () => {
  const user = signal<AuthUser | null>(null);
  let content: Record<
    'featuredEvents' | 'recentMagazines' | 'books' | 'semesterMaterials' | 'teacherMaterials',
    ReturnType<typeof vi.fn>
  >;
  let auth: { logout: ReturnType<typeof vi.fn> };
  let router: { navigateByUrl: ReturnType<typeof vi.fn> };

  const EVENTO = { id: 1, title: 'Feria', images: [], gallery: [] };
  const LIBRO = { id: 2, title: 'Álgebra', cover: null };
  const REVISTA = { id: 3, title: 'Ciencia', cover: null };
  const MATERIAL = { id: 4, title: 'Guía', type: 'PDF', icon: 'file-pdf', detail: '' };

  function crear(rol: UserRole | null, nombre = 'Ana María'): HomePage {
    user.set(rol ? { id: 1, id_usuario: 1, nombre, rol, correo: 'a@b.com', id_semestre: 3 } : null);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SessionService, useValue: { user } },
        { provide: HomeContentService, useValue: content },
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
    return TestBed.runInInjectionContext(() => new HomePage());
  }

  beforeEach(() => {
    content = {
      featuredEvents: vi.fn().mockReturnValue(of([EVENTO])),
      recentMagazines: vi.fn().mockReturnValue(of([REVISTA])),
      books: vi.fn().mockReturnValue(of([LIBRO])),
      semesterMaterials: vi.fn().mockReturnValue(of([MATERIAL])),
      teacherMaterials: vi.fn().mockReturnValue(of([MATERIAL])),
    };
    auth = { logout: vi.fn() };
    router = { navigateByUrl: vi.fn().mockResolvedValue(true) };
  });

  it('saluda con el primer nombre del usuario', () => {
    expect(crear('Estudiante').firstName()).toBe('Ana');
    expect(crear('Estudiante', '  ').firstName()).toBe('');
  });

  it('Estudiante: consulta libros y materiales de su semestre', () => {
    const page = crear('Estudiante');

    expect(content.books).toHaveBeenCalledWith(3);
    expect(content.semesterMaterials).toHaveBeenCalledWith(3);
    expect(content.teacherMaterials).not.toHaveBeenCalled();
    expect(page.events()).toEqual([EVENTO]);
    expect(page.books()).toEqual([LIBRO]);
    expect(page.magazines()).toEqual([REVISTA]);
    expect(page.materials()).toEqual([MATERIAL]);
    expect(page.isTeacher()).toBe(false);
  });

  it('Docente: consulta todo el acervo y sus propios materiales', () => {
    const page = crear('Docente');

    expect(content.books).toHaveBeenCalledWith(null);
    expect(content.teacherMaterials).toHaveBeenCalled();
    expect(content.semesterMaterials).not.toHaveBeenCalled();
    expect(page.isTeacher()).toBe(true);
  });

  it('Visitante: no consulta Biblioteca ni Materiales', () => {
    const page = crear('Visitante');

    expect(content.books).not.toHaveBeenCalled();
    expect(content.semesterMaterials).not.toHaveBeenCalled();
    expect(content.teacherMaterials).not.toHaveBeenCalled();
    expect(page.books()).toEqual([]);
    expect(page.materials()).toEqual([]);
    expect(page.events()).toEqual([EVENTO]);
  });

  it('sin usuario no consulta nada', () => {
    const page = crear(null);

    expect(content.featuredEvents).not.toHaveBeenCalled();
    expect(page.events()).toBeNull();
  });

  it('muestra el estado de carga hasta que llega cada sección', () => {
    const eventos = new Subject<typeof EVENTO[]>();
    content.featuredEvents.mockReturnValue(eventos);

    const page = crear('Visitante');
    expect(page.events()).toBeNull();

    eventos.next([EVENTO]);
    eventos.complete();
    expect(page.events()).toEqual([EVENTO]);
  });

  it('al deslizar para refrescar vuelve a consultar y termina la animación', () => {
    const page = crear('Estudiante');
    const complete = vi.fn();

    page.refresh({ target: { complete } } as unknown as Event);

    expect(content.featuredEvents).toHaveBeenCalledTimes(2);
    expect(complete).toHaveBeenCalled();
  });

  it('el refresco termina aunque no haya usuario', () => {
    const page = crear(null);
    const complete = vi.fn();

    page.refresh({ target: { complete } } as unknown as Event);

    expect(complete).toHaveBeenCalled();
  });

  it('recuerda las portadas que no cargaron', () => {
    const page = crear('Estudiante');

    page.coverFailed('https://res.cloudinary.com/libro.png');

    expect(page.brokenCovers().has('https://res.cloudinary.com/libro.png')).toBe(true);
  });

  it('cierra la sesión y vuelve al login', () => {
    const page = crear('Estudiante');

    page.logout();

    expect(auth.logout).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login', { replaceUrl: true });
  });
});

describe('Inicio: cada elemento abre su información (#204)', () => {
  const user = signal<AuthUser | null>(null);
  const IMG = (n: number) => `https://res.cloudinary.com/demo/image/upload/eventos/${n}.jpg`;

  async function render(rol: UserRole) {
    user.set({ id: 1, id_usuario: 1, nombre: 'Ana', rol, correo: 'a@b.com', id_semestre: 3 });
    TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideRouter([]),
        { provide: SessionService, useValue: { user } },
        { provide: AuthService, useValue: { logout: vi.fn() } },
        {
          provide: HomeContentService,
          useValue: {
            featuredEvents: () => of([{ id: 7, title: 'Congreso', images: [IMG(1)], gallery: [IMG(1), IMG(2), IMG(3), IMG(4)] }]),
            recentMagazines: () => of([{ id: 30, title: 'Edición 04', cover: null }]),
            books: () => of([{ id: 52, title: 'Anatomía', cover: null }]),
            semesterMaterials: () => of([{ id: 11, title: 'Guía', type: 'PDF', icon: 'file-pdf', detail: '' }]),
            teacherMaterials: () => of([]),
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();
    return fixture;
  }

  it('Estudiante: libros, revistas y materiales llevan a su detalle', async () => {
    const el: HTMLElement = (await render('Estudiante')).nativeElement;
    expect(el.querySelector('a[href="/biblioteca/52"]')?.textContent).toContain('Anatomía');
    expect(el.querySelector('a[href="/revistas/30"]')?.textContent).toContain('Edición 04');
    expect(el.querySelector('a.material__link[href="/materiales/11"]')?.textContent).toContain('Guía');
  });

  it('el destacado abre el visor con todas sus imágenes y se cierra con la X', async () => {
    const fixture = await render('Estudiante');
    const page = fixture.componentInstance;
    const card = fixture.nativeElement.querySelector('.event[role="button"]') as HTMLElement;
    expect(card.getAttribute('aria-label')).toBe('Ver imágenes de Congreso');
    expect(page.viewer()).toBeNull();

    card.click();
    expect(page.viewer()?.gallery).toHaveLength(4);
    page.closeEvent();
    expect(page.viewer()).toBeNull();

    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(page.viewer()?.id).toBe(7);
  });

  it('Visitante: solo destacados y revistas, sin enlaces a Biblioteca ni Materiales', async () => {
    const el: HTMLElement = (await render('Visitante')).nativeElement;
    expect(el.querySelector('.event[role="button"]')).toBeTruthy();
    expect(el.querySelector('a[href="/revistas/30"]')).toBeTruthy();
    expect(el.querySelector('a[href^="/biblioteca"], a[href^="/materiales"]')).toBeNull();
  });
});
