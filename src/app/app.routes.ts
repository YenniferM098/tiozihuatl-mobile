import { Route, Routes } from '@angular/router';
import { authGuard, guestGuard, startGuard, welcomeGuard } from './core/guards/auth.guard';
import type { ComingSoonData } from './pages/coming-soon/coming-soon.page';

/** Pestaña aún sin contenido: muestra la pantalla "Próximamente". */
function comingSoon(path: string, data: ComingSoonData): Route {
  return {
    path,
    data,
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
    // Temporal: el módulo de inicio de sesión se integra en su propia rama.
    // Mientras tanto, las redirecciones a /login llevan al registro.
    path: 'login',
    redirectTo: 'register',
    pathMatch: 'full',
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/register/register.page').then((m) => m.RegisterPage),
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
      }),
      comingSoon('revistas', {
        title: 'Revistas',
        icon: 'newspaper',
        description: 'Muy pronto podrás leer las revistas del Instituto desde tu celular.',
      }),
      comingSoon('materiales', {
        title: 'Materiales complementarios',
        icon: 'files',
        description: 'Muy pronto podrás consultar los materiales complementarios de tus cursos.',
      }),
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
