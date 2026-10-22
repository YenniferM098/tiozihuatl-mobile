import { Route, Routes } from '@angular/router';
import { authGuard, guestGuard, memberGuard, startGuard, welcomeGuard } from './core/guards/auth.guard';
import type { ComingSoonData } from './pages/coming-soon/coming-soon.page';

/** Pestaña aún sin contenido: muestra la pantalla "Próximamente". */
function comingSoon(path: string, data: ComingSoonData, extra: Partial<Route> = {}): Route {
  return {
    path,
    data,
    ...extra,
    loadComponent: () => import('./pages/coming-soon/coming-soon.page').then((m) => m.ComingSoonPage),
  };
}

export const routes: Routes = [
  {
    path: 'welcome',
    canActivate: [welcomeGuard],
    loadComponent: () => import('./pages/welcome/welcome.page').then((m) => m.WelcomePage),
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/register/register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/recover-password/recover-password.page').then((m) => m.RecoverPasswordPage),
  },
  {
    // Misma ruta que el enlace del correo (/reset-password?token=…): abre directo el paso de nueva contraseña.
    path: 'reset-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/recover-password/recover-password.page').then((m) => m.RecoverPasswordPage),
  },
  {
    // Entrada de la app: startGuard siempre redirige (Home, Bienvenida o Login).
    path: '',
    pathMatch: 'full',
    canActivate: [startGuard],
    children: [],
  },
  {
    // App autenticada con barra inferior: /home, /biblioteca, /revistas, /materiales, /perfil.
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/tabs/tabs.page').then((m) => m.TabsPage),
    children: [
      {
        path: 'home',
        loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
      },
      comingSoon('biblioteca', {
        title: 'Biblioteca',
        icon: 'books',
        description: 'Muy pronto podrás consultar el acervo de la biblioteca digital desde aquí.',
      }, { canActivate: [memberGuard] }),
      comingSoon('revistas', {
        title: 'Revistas',
        icon: 'newspaper',
        description: 'Muy pronto podrás leer las revistas del Instituto desde tu celular.',
      }),
      comingSoon('materiales', {
        title: 'Materiales complementarios',
        icon: 'files',
        description: 'Muy pronto podrás consultar los materiales complementarios de tus cursos.',
      }, { canActivate: [memberGuard] }),
      comingSoon('perfil', {
        title: 'Perfil',
        icon: 'user',
        description: 'Muy pronto podrás consultar y editar los datos de tu cuenta.',
      }),
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
