import { Route } from '@angular/router';
import { routes } from './app.routes';
import { authGuard, guestGuard, memberGuard } from './core/guards/auth.guard';
import { HomePage } from './home/home.page';
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
    expect(pestana('biblioteca').canActivate).toEqual([memberGuard]);
    expect(pestana('materiales').canActivate).toEqual([memberGuard]);
    expect(pestana('revistas').canActivate).toBeUndefined();
    expect(pestana('perfil').canActivate).toBeUndefined();
  });

  it('las pestañas sin contenido muestran "Próximamente" con sus datos', async () => {
    for (const path of ['biblioteca', 'revistas', 'materiales', 'perfil']) {
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

  it('una dirección desconocida regresa a la entrada', () => {
    expect(ruta('**').redirectTo).toBe('');
  });
});
