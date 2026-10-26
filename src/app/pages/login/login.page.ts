import { Component } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import {
  IonButton,
  IonContent,
  IonInput,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
} from '@ionic/angular';
import { HapticDirective } from '../../core/directives/haptic.directive';
import { LoginViewModel } from './login.view-model';

/** Vista del inicio de sesión: enlaza la plantilla con el estado y las acciones de su ViewModel. */
@Component({
  selector: 'app-login',
  templateUrl: 'login.page.html',
  styleUrls: ['login.page.scss'],
  imports: [
    ReactiveFormsModule,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonInput,
    IonButton,
    IonSpinner,
    HapticDirective,
  ],
})
export class LoginPage {
  readonly vm = new LoginViewModel();

  readonly roles = this.vm.roles;
  readonly form = this.vm.form;
  readonly loading = this.vm.loading;
  readonly errorMessage = this.vm.errorMessage;
  readonly showPassword = this.vm.showPassword;

  get credentialError(): string {
    return this.vm.credentialError;
  }

  onRoleChange(value: unknown): void {
    this.vm.onRoleChange(value);
  }

  submit(): void {
    this.vm.submit();
  }

  goToRegister(): void {
    this.vm.goToRegister();
  }

  goToForgotPassword(): void {
    this.vm.goToForgotPassword();
  }
}
