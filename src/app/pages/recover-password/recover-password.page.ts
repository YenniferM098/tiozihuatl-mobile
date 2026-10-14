import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonButton, IonContent, IonInput, IonSpinner, ToastController } from '@ionic/angular';
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

/** El backend genera el token con crypto.randomUUID(). */
const TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Step = 'solicitud' | 'enviado' | 'restablecer';

/** Acepta el enlace completo del correo (…/reset-password?token=…) o solo el token. */
function extractToken(input: string): string | null {
  const text = input.trim();
  const fromUrl = text.match(/[?&]token=([^&#\s]+)/);
  let raw = text;
  if (fromUrl) {
    try {
      raw = decodeURIComponent(fromUrl[1]);
    } catch {
      return null;
    }
  }
  return TOKEN_PATTERN.test(raw) ? raw : null;
}

@Component({
  selector: 'app-recover-password',
  templateUrl: 'recover-password.page.html',
  // Reutiliza el layout del registro (cabecera azul, hoja blanca, pasos y requisitos de contraseña).
  styleUrls: ['../register/register.page.scss', 'recover-password.page.scss'],
  imports: [ReactiveFormsModule, IonContent, IonInput, IonButton, IonSpinner, HapticDirective],
})
export class RecoverPasswordPage implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toastCtrl = inject(ToastController);

  readonly solicitudForm = this.fb.group({
    correo: this.fb.control('', [Validators.required, patternTrimmed(EMAIL_PATTERN, 'email')]),
    palabraSecreta: this.fb.control('', [Validators.required, Validators.maxLength(30), noForbiddenChars]),
  });

  readonly enlaceForm = this.fb.group({
    enlace: this.fb.control('', Validators.required),
  });

  readonly passwordForm = this.fb.group(
    {
      contrasena: this.fb.control('', [Validators.required, noForbiddenChars, strongPassword]),
      confirmar: this.fb.control('', Validators.required),
    },
    { validators: passwordsMatch },
  );

  readonly step = signal<Step>('solicitud');
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly infoMessage = signal('');
  /** Token del enlace ya validado con el backend; solo vive en memoria. */
  readonly token = signal<string | null>(null);
  readonly showSecret = signal(false);
  readonly showPassword = signal(false);
  readonly showConfirm = signal(false);
  readonly passwordValue = signal('');

  readonly stepNumber = computed(() => ({ solicitud: 1, enviado: 2, restablecer: 3 })[this.step()]);
  readonly rules = computed(() => passwordRules(this.passwordValue()));

  constructor() {
    this.passwordForm.controls.contrasena.valueChanges.subscribe((value) => this.passwordValue.set(value));
  }

  ngOnInit(): void {
    // Si la app se abre con el enlace del correo (/reset-password?token=…), se valida directamente.
    const token = this.route.snapshot.queryParamMap.get('token');
    if (token) {
      this.step.set('restablecer');
      this.validateToken(token);
    }
  }

  // ---------- Mensajes de error por campo ----------

  get emailError(): string {
    const ctrl = this.solicitudForm.controls.correo;
    if (ctrl.hasError('required')) return 'Ingresa tu correo electrónico.';
    if (ctrl.hasError('email')) return 'El correo electrónico no es válido.';
    return '';
  }

  get secretError(): string {
    const ctrl = this.solicitudForm.controls.palabraSecreta;
    if (ctrl.hasError('required')) return 'Ingresa tu palabra secreta.';
    if (ctrl.hasError('maxlength')) return 'Máximo 30 caracteres.';
    if (ctrl.hasError('forbidden')) return 'No uses los caracteres < > " \' `.';
    return '';
  }

  get linkError(): string {
    const ctrl = this.enlaceForm.controls.enlace;
    if (ctrl.hasError('required')) return 'Pega el enlace que recibiste por correo.';
    if (ctrl.hasError('format')) return 'El enlace no es válido. Cópialo completo desde el correo.';
    return '';
  }

  get passwordError(): string {
    const ctrl = this.passwordForm.controls.contrasena;
    if (ctrl.hasError('required')) return 'Crea una nueva contraseña.';
    if (ctrl.hasError('forbidden')) return 'No uses los caracteres < > " \' `.';
    if (ctrl.hasError('weak')) return 'La contraseña no cumple los requisitos.';
    return '';
  }

  get confirmError(): string {
    if (this.passwordForm.controls.confirmar.hasError('required')) return 'Confirma tu nueva contraseña.';
    if (this.passwordForm.hasError('mismatch')) return 'Las contraseñas no coinciden.';
    return '';
  }

  get confirmInvalid(): boolean {
    const ctrl = this.passwordForm.controls.confirmar;
    return ctrl.touched && (ctrl.invalid || this.passwordForm.hasError('mismatch'));
  }

  // ---------- Paso 1: correo + palabra secreta ----------

  submitSolicitud(): void {
    if (this.loading()) return;

    this.errorMessage.set(null);
    this.solicitudForm.markAllAsTouched();
    if (this.solicitudForm.invalid) {
      this.errorMessage.set('Revisa los campos marcados.');
      return;
    }

    const { correo, palabraSecreta } = this.solicitudForm.getRawValue();
    this.loading.set(true);

    this.auth.requestPasswordRecovery({ correo: correo.trim(), palabra_secreta: palabraSecreta }).subscribe({
      next: (message) => {
        this.loading.set(false);
        this.solicitudForm.controls.palabraSecreta.reset();
        this.infoMessage.set(message);
        this.step.set('enviado');
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  // ---------- Paso 2: enlace enviado ----------

  goToLinkStep(): void {
    this.errorMessage.set(null);
    this.step.set('restablecer');
  }

  // ---------- Paso 3: validar enlace y nueva contraseña ----------

  submitEnlace(): void {
    if (this.loading()) return;

    this.errorMessage.set(null);
    const ctrl = this.enlaceForm.controls.enlace;
    ctrl.markAsTouched();
    if (ctrl.invalid) return;

    const token = extractToken(ctrl.value);
    if (!token) {
      ctrl.setErrors({ format: true });
      return;
    }
    this.validateToken(token);
  }

  submitPassword(): void {
    const token = this.token();
    if (this.loading() || !token) return;

    this.errorMessage.set(null);
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid) {
      this.errorMessage.set('Revisa los campos marcados.');
      return;
    }

    this.loading.set(true);
    this.auth.resetPassword({ token, nuevaContrasena: this.passwordForm.getRawValue().contrasena }).subscribe({
      next: async (message) => {
        this.loading.set(false);
        this.passwordForm.reset();
        this.token.set(null);
        await this.router.navigateByUrl('/login', { replaceUrl: true });
        const toast = await this.toastCtrl.create({
          message: `${message} Ya puedes iniciar sesión.`,
          duration: 3500,
          position: 'bottom',
          color: 'success',
        });
        await toast.present();
      },
      error: (err: unknown) => {
        // Si el enlace venció mientras escribía, se vuelve a pedir uno válido.
        if (err instanceof AuthError && err.message.includes('expirado')) this.token.set(null);
        this.fail(err);
      },
    });
  }

  /** Vuelve a pedir un enlace (por ejemplo, cuando el anterior venció). */
  requestNewLink(): void {
    if (this.loading()) return;
    this.token.set(null);
    this.enlaceForm.reset();
    this.passwordForm.reset();
    this.errorMessage.set(null);
    this.step.set('solicitud');
  }

  goBack(): void {
    if (this.loading()) return;
    this.errorMessage.set(null);
    switch (this.step()) {
      case 'restablecer':
        this.token.set(null);
        this.passwordForm.reset();
        this.step.set(this.infoMessage() ? 'enviado' : 'solicitud');
        break;
      case 'enviado':
        this.step.set('solicitud');
        break;
      default:
        this.goToLogin();
    }
  }

  goToLogin(): void {
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  // ---------- Auxiliares ----------

  private validateToken(token: string): void {
    this.errorMessage.set(null);
    this.loading.set(true);

    this.auth.validateRecoveryToken(token).subscribe({
      next: (valid) => {
        this.loading.set(false);
        if (valid) {
          this.enlaceForm.reset();
          this.token.set(token);
        } else {
          this.token.set(null);
          this.errorMessage.set('El enlace es inválido o ha expirado. Solicita uno nuevo.');
        }
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  private fail(err: unknown): void {
    this.loading.set(false);
    this.errorMessage.set(
      err instanceof AuthError ? err.message : 'No fue posible completar la solicitud. Intenta nuevamente.',
    );
  }
}
