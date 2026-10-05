import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent } from '@ionic/angular';
import { OnboardingService } from '../../core/services/onboarding.service';

/** Bienvenida que se muestra solo en la primera ejecución de la app. */
@Component({
  selector: 'app-welcome',
  templateUrl: 'welcome.page.html',
  styleUrls: ['welcome.page.scss'],
  imports: [IonContent, IonButton],
})
export class WelcomePage {
  private readonly router = inject(Router);
  private readonly onboarding = inject(OnboardingService);

  start(): void {
    this.leaveTo('/login');
  }

  goToRegister(): void {
    this.leaveTo('/register');
  }

  private leaveTo(url: string): void {
    this.onboarding.markWelcomeSeen();
    // replaceUrl: el botón "atrás" de Android no regresa a la bienvenida.
    this.router.navigateByUrl(url, { replaceUrl: true });
  }
}
