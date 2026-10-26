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
    // Lector de libros digitales a pantalla completa (sin barra inferior), solo Estudiante y Docente.
    // Se declara antes de las pestañas para que /biblioteca/:id/lector no llegue a sus rutas hijas.
    path: 'biblioteca/:id/lector',
    canActivate: [authGuard, memberGuard],
    loadComponent: () => import('./pages/biblioteca/book-reader.page').then((m) => m.BookReaderPage),
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
      {
        // Biblioteca Digital (solo Estudiante y Docente): catálogo y detalle del libro.
        // Los guards también protegen las rutas hijas al abrir su URL directamente.
        path: 'biblioteca',
        canActivate: [authGuard, memberGuard],
        canActivateChild: [authGuard, memberGuard],
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () => import('./pages/biblioteca/library.page').then((m) => m.LibraryPage),
          },
          {
            path: ':id',
            loadComponent: () => import('./pages/biblioteca/book-detail.page').then((m) => m.BookDetailPage),
          },
        ],
      },
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
