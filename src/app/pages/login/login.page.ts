import { Component, inject, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
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
import { UserRole } from '../../core/models/auth.models';
import { AuthError, AuthService } from '../../core/services/auth.service';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MATRICULA_PATTERN = /^[A-Za-z0-9-]{3,30}$/;

/** Acepta un correo válido o una matrícula (letras, números y guiones, sin espacios). */
function credentialValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = (control.value ?? '').trim();
  if (!value) return null;
  if (value.includes('@')) return EMAIL_PATTERN.test(value) ? null : { email: true };
  return MATRICULA_PATTERN.test(value) ? null : { matricula: true };
}

interface RoleOption {
  value: UserRole;
  label: string;
  /** Clase de Phosphor Icons. */
  icon: string;
}

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
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly roles: RoleOption[] = [
    { value: 'Estudiante', label: 'Estudiante', icon: 'ph-graduation-cap' },
    { value: 'Docente', label: 'Docente', icon: 'ph-chalkboard-teacher' },
    { value: 'Visitante', label: 'Visitante', icon: 'ph-user' },
  ];

  readonly form = this.fb.group({
    rol: this.fb.control<UserRole>('Estudiante', Validators.required),
    credential: this.fb.control('', [Validators.required, credentialValidator]),
    contrasena: this.fb.control('', Validators.required),
  });

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly showPassword = signal(false);

  get credentialError(): string {
    const ctrl = this.form.controls.credential;
    if (ctrl.hasError('required')) return 'Ingresa tu matrícula o correo electrónico.';
    if (ctrl.hasError('email')) return 'El correo electrónico no es válido.';
    if (ctrl.hasError('matricula')) return 'La matrícula solo puede contener letras, números y guiones.';
    return '';
  }

  onRoleChange(value: unknown): void {
    if (typeof value === 'string') {
      this.form.controls.rol.setValue(value as UserRole);
      this.errorMessage.set(null);
    }
  }

  submit(): void {
    if (this.loading()) return;

    this.errorMessage.set(null);
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.errorMessage.set('Completa los campos obligatorios.');
      return;
    }

    const { rol, credential, contrasena } = this.form.getRawValue();
    this.loading.set(true);

    this.auth
      .login({ credential: credential.trim(), contrasena, rolSeleccionado: rol })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.form.controls.contrasena.reset();
          this.router.navigateByUrl('/home', { replaceUrl: true });
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.errorMessage.set(
            err instanceof AuthError ? err.message : 'No fue posible iniciar sesión. Intenta nuevamente.',
          );
        },
      });
  }

  goToRegister(): void {
    if (this.loading()) return;
    this.router.navigateByUrl('/register');
  }

  goToForgotPassword(): void {
    if (this.loading()) return;
    this.router.navigateByUrl('/forgot-password');
  }
}
