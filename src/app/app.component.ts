import { Component, inject } from '@angular/core';
import {
  NavigationCancel,
  NavigationCancellationCode,
  NavigationEnd,
  NavigationError,
  Router,
} from '@angular/router';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { filter, take } from 'rxjs';

/** Tiempo mínimo que se ve el splash, contado desde que abre la app. */
const SPLASH_MIN_MS = 1500;
const SPLASH_FADE_MS = 350;

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  constructor() {
    // El splash de index.html se retira cuando la primera pantalla ya está decidida
    // (Bienvenida, Login o Home), para no mostrar un parpadeo entre rutas.
    inject(Router)
      .events.pipe(
        filter(
          (e) =>
            e instanceof NavigationEnd ||
            e instanceof NavigationError ||
            // La redirección de startGuard también cancela; esa no cuenta como "lista".
            (e instanceof NavigationCancel && e.code !== NavigationCancellationCode.Redirect),
        ),
        take(1),
      )
      .subscribe(() => this.hideSplash());
  }

  private hideSplash(): void {
    const splash = document.getElementById('tz-splash');
    if (!splash) return;

    const wait = Math.max(0, SPLASH_MIN_MS - performance.now());
    setTimeout(() => {
      splash.classList.add('tz-splash--hidden');
      setTimeout(() => splash.remove(), SPLASH_FADE_MS);
    }, wait);
  }
}
