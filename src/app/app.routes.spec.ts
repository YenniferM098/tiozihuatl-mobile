import { Route } from '@angular/router';
import { routes } from './app.routes';
import { authGuard, guestGuard, memberGuard } from './core/guards/auth.guard';
import { HomePage } from './home/home.page';
import { BookDetailPage } from './pages/biblioteca/book-detail.page';
import { BookReaderPage } from './pages/biblioteca/book-reader.page';
import { LibraryPage } from './pages/biblioteca/library.page';
import { ComingSoonPage } from './pages/coming-soon/coming-soon.page';
import { LoginPage } from './pages/login/login.page';
import { RecoverPasswordPage } from './pages/recover-password/recover-password.page';
import { TabsPage } from './pages/tabs/tabs.page';

describe('Rutas de la app (HU-02 navegación)', () => {
  const ruta = (path: string) => routes.find((r) => r.path === path)!;
  const tabs = routes.find((r) => r.path === '' && r.loadComponent)!;
  const pestana = (path: string) => tabs.children!.find((r) => r.path === path)!;
  const componente = (r: Route) => r.loadComponent!();

  it('las pantallas de acceso solo se abren sin sesión', () => {
    for (const path of ['login', 'register', 'forgot-password', 'reset-password']) {
      expect(ruta(path).canActivate).toEqual([guestGuard]);
    }
  });

  it('la barra inferior exige sesión y tiene las cinco pestañas', () => {
    expect(tabs.canActivate).toEqual([authGuard]);
    expect(tabs.children!.map((r) => r.path)).toEqual(['home', 'biblioteca', 'revistas', 'materiales', 'perfil']);
  });

  it('Biblioteca y Materiales son solo para Estudiante y Docente', () => {
    expect(pestana('biblioteca').canActivate).toEqual([authGuard, memberGuard]);
    expect(pestana('materiales').canActivate).toEqual([memberGuard]);
    expect(pestana('revistas').canActivate).toBeUndefined();
    expect(pestana('perfil').canActivate).toBeUndefined();
  });

  it('las pestañas sin contenido muestran "Próximamente" con sus datos', async () => {
    for (const path of ['revistas', 'materiales', 'perfil']) {
      expect(await componente(pestana(path))).toBe(ComingSoonPage);
      expect(pestana(path).data).toEqual(
        expect.objectContaining({ title: expect.any(String), icon: expect.any(String), description: expect.any(String) }),
      );
    }
  });

  it('cada ruta carga su pantalla', async () => {
    expect(await componente(ruta('login'))).toBe(LoginPage);
    expect(await componente(ruta('forgot-password'))).toBe(RecoverPasswordPage);
    expect(await componente(ruta('reset-password'))).toBe(RecoverPasswordPage);
    expect(await componente(tabs)).toBe(TabsPage);
    expect(await componente(pestana('home'))).toBe(HomePage);
  });

  it('Biblioteca (HU-04) carga el catálogo y el detalle del libro', async () => {
    const hija = (path: string) => pestana('biblioteca').children!.find((r) => r.path === path)!;
    expect(await componente(hija(''))).toBe(LibraryPage);
    expect(await componente(hija(':id'))).toBe(BookDetailPage);
  });

  it('Lector de libros (HU-05) a pantalla completa y protegido por sesión y rol', async () => {
    const lector = ruta('biblioteca/:id/lector');
    expect(lector.canActivate).toEqual([authGuard, memberGuard]);
    expect(await componente(lector)).toBe(BookReaderPage);
    // Fuera de la barra inferior y declarado antes de las pestañas.
    expect(routes.indexOf(lector)).toBeLessThan(routes.indexOf(tabs));
  });

  it('una dirección desconocida regresa a la entrada', () => {
    expect(ruta('**').redirectTo).toBe('');
  });
});
