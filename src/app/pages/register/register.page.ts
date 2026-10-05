import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton, IonCheckbox, IonContent, IonInput, IonSpinner, ToastController } from '@ionic/angular';
import { environment } from '../../../environments/environment';
import { PreRegisterRequest } from '../../core/models/register.models';
import { HapticDirective } from '../../core/directives/haptic.directive';
import { AuthError, AuthService } from '../../core/services/auth.service';
import {
  EMAIL_PATTERN,
  noForbiddenChars,
  passwordRules,
  passwordsMatch,
  patternTrimmed,
  strongPassword,
} from '../../core/validators/form.validators';

// Mismas reglas que el registro web y el middleware validateRegisterData del backend.
const NAME_PATTERN = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]{2,30}$/;
const PHONE_PATTERN = /^[0-9]{10}$/;

type Step = 'datos' | 'verificacion' | 'seguridad';

@Component({
  selector: 'app-register',
  templateUrl: 'register.page.html',
  styleUrls: ['register.page.scss'],
  imports: [ReactiveFormsModule, IonContent, IonInput, IonButton, IonSpinner, IonCheckbox, HapticDirective],
})
export class RegisterPage implements OnDestroy {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);

  readonly webUrl = environment.webUrl;

  readonly datosForm = this.fb.group({
    nombre: this.fb.control('', [Validators.required, patternTrimmed(NAME_PATTERN, 'name')]),
    apaterno: this.fb.control('', [Validators.required, patternTrimmed(NAME_PATTERN, 'name')]),
    amaterno: this.fb.control('', [Validators.required, patternTrimmed(NAME_PATTERN, 'name')]),
    correo: this.fb.control('', [Validators.required, patternTrimmed(EMAIL_PATTERN, 'email')]),
    telefono: this.fb.control('', [Validators.required, patternTrimmed(PHONE_PATTERN, 'phone')]),
  });

  readonly seguridadForm = this.fb.group(
    {
      contrasena: this.fb.control('', [Validators.required, noForbiddenChars, strongPassword]),
      confirmar: this.fb.control('', Validators.required),
      palabraSecreta: this.fb.control('', [
        Validators.required,
        Validators.minLength(4),
        Validators.maxLength(30),
        noForbiddenChars,
      ]),
      terminos: this.fb.control(false, Validators.requiredTrue),
      privacidad: this.fb.control(false, Validators.requiredTrue),
      seguridad: this.fb.control(false, Validators.requiredTrue),
    },
    { validators: passwordsMatch },
  );

  readonly step = signal<Step>('datos');
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly infoMessage = signal('');
  readonly resendIn = signal(0);
  readonly showPassword = signal(false);
  readonly showConfirm = signal(false);
  readonly passwordValue = signal('');

  readonly stepNumber = computed(() => ({ datos: 1, verificacion: 2, seguridad: 3 })[this.step()]);
  readonly rules = computed(() => passwordRules(this.passwordValue()));
  readonly resendLabel = computed(() => {
    const seconds = this.resendIn();
    if (seconds <= 0) return 'Reenviar correo';
    const min = Math.floor(seconds / 60);
    const sec = String(seconds % 60).padStart(2, '0');
    return `Reenviar en ${min}:${sec}`;
  });

  /** Correo con el que se hizo el pre-registro; solo vive en memoria mientras dura el flujo. */
  private correoRegistro = '';
  private resendTimer?: ReturnType<typeof setInterval>;

  constructor() {
    this.seguridadForm.controls.contrasena.valueChanges.subscribe((value) => this.passwordValue.set(value));
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  // ---------- Mensajes de error por campo ----------

  nameError(field: 'nombre' | 'apaterno' | 'amaterno'): string {
    const ctrl = this.datosForm.controls[field];
    if (ctrl.hasError('required')) return 'Este campo es obligatorio.';
    if (ctrl.hasError('name')) return 'Solo letras y espacios (mínimo 2).';
    return '';
  }

  get emailError(): string {
    const ctrl = this.datosForm.controls.correo;
    if (ctrl.hasError('required')) return 'Ingresa tu correo electrónico.';
    if (ctrl.hasError('email')) return 'El correo electrónico no es válido.';
    if (ctrl.hasError('taken')) return 'Este correo ya está registrado.';
    return '';
  }

  get phoneError(): string {
    const ctrl = this.datosForm.controls.telefono;
    if (ctrl.hasError('required')) return 'Ingresa tu teléfono.';
    if (ctrl.hasError('phone')) return 'El teléfono debe tener 10 dígitos.';
    if (ctrl.hasError('taken')) return 'Este teléfono ya está registrado.';
    return '';
  }

  get passwordError(): string {
    const ctrl = this.seguridadForm.controls.contrasena;
    if (ctrl.hasError('required')) return 'Crea una contraseña.';
    if (ctrl.hasError('forbidden')) return 'No uses los caracteres < > " \' `.';
    if (ctrl.hasError('weak')) return 'La contraseña no cumple los requisitos.';
    return '';
  }

  get confirmError(): string {
    if (this.seguridadForm.controls.confirmar.hasError('required')) return 'Confirma tu contraseña.';
    if (this.seguridadForm.hasError('mismatch')) return 'Las contraseñas no coinciden.';
    return '';
  }

  get secretError(): string {
    const ctrl = this.seguridadForm.controls.palabraSecreta;
    if (ctrl.hasError('required')) return 'Ingresa una palabra secreta.';
    if (ctrl.hasError('minlength') || ctrl.hasError('maxlength')) return 'Debe tener entre 4 y 30 caracteres.';
    if (ctrl.hasError('forbidden')) return 'No uses los caracteres < > " \' `.';
    return '';
  }

  get confirmInvalid(): boolean {
    const ctrl = this.seguridadForm.controls.confirmar;
    return ctrl.touched && (ctrl.invalid || this.seguridadForm.hasError('mismatch'));
  }

  /** Solo deja escribir dígitos en el teléfono. */
  onPhoneInput(): void {
    const ctrl = this.datosForm.controls.telefono;
    const digits = ctrl.value.replace(/\D/g, '').slice(0, 10);
    if (digits !== ctrl.value) ctrl.setValue(digits);
    this.errorMessage.set(null);
  }

  // ---------- Paso 1: datos personales ----------

  submitDatos(): void {
    if (this.loading()) return;

    this.errorMessage.set(null);
    this.datosForm.markAllAsTouched();
    if (this.datosForm.invalid) {
      this.errorMessage.set('Revisa los campos marcados.');
      return;
    }

    const data = this.datosPayload();
    this.loading.set(true);

    this.auth.checkContactAvailability(data.correo, data.telefono).subscribe({
      next: ({ emailTaken, phoneTaken }) => {
        if (emailTaken || phoneTaken) {
          this.loading.set(false);
          if (emailTaken) this.markTaken('correo');
          if (phoneTaken) this.markTaken('telefono');
          this.errorMessage.set(
            emailTaken ? 'Este correo ya tiene una cuenta. Inicia sesión.' : 'Este teléfono ya está registrado.',
          );
          return;
        }
        this.sendVerification(data);
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  resend(): void {
    if (this.loading() || this.resendIn() > 0) return;
    this.errorMessage.set(null);
    this.loading.set(true);
    this.sendVerification(this.datosPayload());
  }

  editDatos(): void {
    this.errorMessage.set(null);
    this.step.set('datos');
  }

  // ---------- Paso 2: verificación del correo ----------

  continueToSecurity(): void {
    this.errorMessage.set(null);
    this.step.set('seguridad');
  }

  // ---------- Paso 3: seguridad de la cuenta ----------

  submitSeguridad(): void {
    if (this.loading()) return;

    this.errorMessage.set(null);
    this.seguridadForm.markAllAsTouched();

    const { terminos, privacidad, seguridad } = this.seguridadForm.controls;
    if (this.seguridadForm.invalid) {
      this.errorMessage.set(
        terminos.invalid || privacidad.invalid || seguridad.invalid
          ? 'Debes aceptar los términos, la privacidad y las políticas de seguridad.'
          : 'Revisa los campos marcados.',
      );
      return;
    }

    const { contrasena, palabraSecreta } = this.seguridadForm.getRawValue();
    this.loading.set(true);

    this.auth
      .finishRegister({ correo: this.correoRegistro, contrasena, palabra_secreta: palabraSecreta.trim() })
      .subscribe({
        next: async (message) => {
          this.loading.set(false);
          this.seguridadForm.reset();
          this.stopTimer();
          await this.router.navigateByUrl('/login', { replaceUrl: true });
          const toast = await this.toastCtrl.create({
            message: `${message} Ya puedes iniciar sesión como Visitante.`,
            duration: 3500,
            position: 'bottom',
            color: 'success',
          });
          await toast.present();
        },
        error: (err: unknown) => this.fail(err),
      });
  }

  goBack(): void {
    if (this.loading()) return;
    const current = this.step();
    if (current === 'seguridad') {
      this.step.set('verificacion');
    } else if (current === 'verificacion') {
      this.step.set('datos');
    } else {
      this.router.navigateByUrl('/login', { replaceUrl: true });
    }
    this.errorMessage.set(null);
  }

  goToLogin(): void {
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  // ---------- Auxiliares ----------

  private sendVerification(data: PreRegisterRequest): void {
    this.auth.preRegister(data).subscribe({
      next: (result) => {
        this.loading.set(false);
        this.correoRegistro = data.correo;
        this.infoMessage.set(result.message);
        if (result.kind === 'alreadyVerified') {
          this.step.set('seguridad');
          return;
        }
        this.startTimer(result.retryAfterSeconds);
        this.step.set('verificacion');
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  private datosPayload(): PreRegisterRequest {
    const v = this.datosForm.getRawValue();
    return {
      nombre: v.nombre.trim(),
      apaterno: v.apaterno.trim(),
      amaterno: v.amaterno.trim(),
      correo: v.correo.trim(),
      telefono: v.telefono.trim(),
    };
  }

  private markTaken(field: 'correo' | 'telefono'): void {
    const ctrl = this.datosForm.controls[field];
    ctrl.setErrors({ ...(ctrl.errors ?? {}), taken: true });
    ctrl.markAsTouched();
  }

  private fail(err: unknown): void {
    this.loading.set(false);
    this.errorMessage.set(
      err instanceof AuthError ? err.message : 'No fue posible completar el registro. Intenta nuevamente.',
    );
  }

  private startTimer(seconds: number): void {
    this.stopTimer();
    this.resendIn.set(Math.max(1, Math.ceil(seconds)));
    this.resendTimer = setInterval(() => {
      const next = Math.max(0, this.resendIn() - 1);
      this.resendIn.set(next);
      if (next === 0) this.stopTimer();
    }, 1000);
  }

  private stopTimer(): void {
    if (this.resendTimer) clearInterval(this.resendTimer);
    this.resendTimer = undefined;
  }
}
