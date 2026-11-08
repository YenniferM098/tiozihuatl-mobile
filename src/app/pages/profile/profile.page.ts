import { Component, inject } from '@angular/core';
import {
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  NavController,
  ToastController,
} from '@ionic/angular';
import { HapticDirective } from '../../core/directives/haptic.directive';
import { AuthService } from '../../core/services/auth.service';
import { ProfileViewModel } from './profile.view-model';

const DATE = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
const DATE_TIME = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Vista del perfil (Estudiante, Docente y Visitante): enlaza la plantilla con el estado
 * de su ViewModel y muestra los datos de la cuenta, el rol, la matrícula y el estado.
 */
@Component({
  selector: 'app-profile',
  templateUrl: 'profile.page.html',
  styleUrls: ['profile.page.scss', 'profile.cards.scss', 'profile.states.scss'],
  imports: [IonContent, IonRefresher, IonRefresherContent, IonSkeletonText, HapticDirective],
})
export class ProfilePage {
  private readonly auth = inject(AuthService);
  private readonly nav = inject(NavController);
  private readonly toasts = inject(ToastController);

  readonly vm = new ProfileViewModel();
  readonly profile = this.vm.profile;
  readonly error = this.vm.error;
  readonly isVisitor = this.vm.isVisitor;
  readonly isStudent = this.vm.isStudent;

  readonly skeletonRows = [1, 2, 3, 4];

  constructor() {
    this.load();
  }

  load(done?: () => void): void {
    this.vm.load(done, (error) => void this.toast(error.message, 'danger'));
  }

  refresh(event: Event): void {
    this.load(() => (event.target as HTMLIonRefresherElement).complete());
  }

  formatDate(value: string | null, withTime = false): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return (withTime ? DATE_TIME : DATE).format(date);
  }

  /** Sesión vencida: se descarta y se vuelve al inicio de sesión sin pedir confirmación. */
  goToLogin(): void {
    this.auth.logout();
    void this.nav.navigateRoot('/login');
  }

  private async toast(message: string, color: 'success' | 'danger' | 'warning'): Promise<void> {
    const toast = await this.toasts.create({ message, duration: 3500, position: 'bottom', color });
    await toast.present();
  }
}
