import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AlertController,
  IonButton,
  IonContent,
  IonInput,
  IonModal,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonSpinner,
  NavController,
  ToastController,
} from '@ionic/angular';
import { Observable, map, startWith } from 'rxjs';
import { HapticDirective } from '../../core/directives/haptic.directive';
import { AuthService } from '../../core/services/auth.service';
import { toProfileError } from '../../core/services/profile.service';
import {
  EMAIL_PATTERN,
  noForbiddenChars,
  passwordRules,
  passwordsMatch,
  patternTrimmed,
  strongPassword,
} from '../../core/validators/form.validators';
import { ProfileViewModel } from './profile.view-model';

// Mismas reglas que el registro de visitante (register.page.ts).
const NAME_PATTERN = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]{2,30}$/;
const PHONE_PATTERN = /^[0-9]{10}$/;
// Límites de la palabra secreta que aplica el backend al actualizar el perfil.
const SECRET_MIN = 4;
const SECRET_MAX = 10;

type Sheet = 'edit' | 'secret' | 'password' | null;

const DATE = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
const DATE_TIME = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * Vista del perfil (Estudiante, Docente y Visitante): enlaza la plantilla con el estado
 * de su ViewModel, muestra los datos de la cuenta, edita la información permitida y
 * cambia la palabra secreta y la contraseña. También cierra la sesión y, solo para
 * Visitante, elimina la cuenta.
 */
@Component({
  selector: 'app-profile',
  templateUrl: 'profile.page.html',
  styleUrls: ['profile.page.scss', 'profile.cards.scss', 'profile.states.scss', 'profile.sheets.scss'],
  imports: [
    ReactiveFormsModule,
    IonButton,
    IonContent,
    IonInput,
    IonModal,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    IonSpinner,
    HapticDirective,
  ],
})
export class ProfilePage {
  private readonly auth = inject(AuthService);
  private readonly nav = inject(NavController);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly vm = new ProfileViewModel();
  readonly profile = this.vm.profile;
  readonly error = this.vm.error;
  readonly saving = this.vm.saving;
  readonly isVisitor = this.vm.isVisitor;
  readonly isStudent = this.vm.isStudent;

  readonly sheet = signal<Sheet>(null);
  readonly sheetError = signal<string | null>(null);
  readonly showSecret = signal(false);
  readonly showPasswords = signal(false);
  readonly secretMax = SECRET_MAX;

  /** Visitante puede cambiar su nombre; Estudiante y Docente solo correo y teléfono. */
  readonly editForm = this.fb.group({
    nombre: this.fb.control('', [Validators.required, patternTrimmed(NAME_PATTERN, 'name')]),
    a_paterno: this.fb.control('', [Validators.required, patternTrimmed(NAME_PATTERN, 'name')]),
    a_materno: this.fb.control('', [Validators.required, patternTrimmed(NAME_PATTERN, 'name')]),
    correo: this.fb.control('', [Validators.required, patternTrimmed(EMAIL_PATTERN, 'email')]),
    telefono: this.fb.control('', [Validators.required, patternTrimmed(PHONE_PATTERN, 'phone')]),
  });

  readonly secretForm = this.fb.group({
    palabra: this.fb.control('', [
      Validators.required,
      Validators.minLength(SECRET_MIN),
      Validators.maxLength(SECRET_MAX),
      noForbiddenChars,
    ]),
  });

  readonly passwordForm = this.fb.group(
    {
      actual: this.fb.control('', Validators.required),
      contrasena: this.fb.control('', [Validators.required, noForbiddenChars, strongPassword]),
      confirmar: this.fb.control('', Validators.required),
    },
    { validators: [passwordsMatch, differentFromCurrent] },
  );

  private readonly newPassword = toSignal(
    this.passwordForm.controls.contrasena.valueChanges.pipe(startWith('')),
    { initialValue: '' },
  );
  readonly rules = computed(() => passwordRules(this.newPassword()));

  /** El botón Guardar solo se activa si hay cambios respecto a lo que se ve en el perfil. */
  readonly editChanged = toSignal(
    this.editForm.valueChanges.pipe(
      startWith(null),
      map(() => Object.keys(this.vm.changes(this.editForm.getRawValue())).length > 0),
    ),
    { initialValue: false },
  );

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

  /* ---------- Hojas de edición ---------- */

  openEdit(): void {
    const p = this.profile();
    if (!p) return;
    this.editForm.reset({
      nombre: p.nombre,
      a_paterno: p.aPaterno,
      a_materno: p.aMaterno,
      correo: p.correo,
      telefono: p.telefono,
    });
    // Estudiante y Docente no pueden modificar su nombre: no se validan ni se envían.
    for (const name of ['nombre', 'a_paterno', 'a_materno'] as const) {
      const control = this.editForm.controls[name];
      if (this.isVisitor()) control.enable();
      else control.disable();
    }
    this.openSheet('edit');
  }

  openSecret(): void {
    this.secretForm.reset();
    this.showSecret.set(false);
    this.openSheet('secret');
  }

  openPassword(): void {
    this.passwordForm.reset();
    this.showPasswords.set(false);
    this.openSheet('password');
  }

  closeSheet(): void {
    if (!this.saving()) this.sheet.set(null);
  }

  saveProfile(): void {
    if (this.saving()) return;
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    const changes = this.vm.changes(this.editForm.getRawValue());
    if (!Object.keys(changes).length) {
      this.sheet.set(null);
      return;
    }
    this.submit(this.vm.update(changes), 'Perfil actualizado correctamente.', true);
  }

  saveSecret(): void {
    if (this.saving()) return;
    if (this.secretForm.invalid) {
      this.secretForm.markAllAsTouched();
      return;
    }
    this.submit(this.vm.saveSecret(this.secretForm.getRawValue().palabra), 'Palabra secreta guardada correctamente.', true);
  }

  savePassword(): void {
    if (this.saving()) return;
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const { actual, contrasena } = this.passwordForm.getRawValue();
    this.submit(this.vm.changePassword(actual, contrasena), 'Contraseña actualizada correctamente.', false);
  }

  /* ---------- Mensajes de validación (cerca de cada campo) ---------- */

  fieldError(control: AbstractControl, kind: 'name' | 'email' | 'phone'): string {
    if (!control.touched || control.valid) return '';
    if (control.hasError('required')) return 'Este campo es obligatorio.';
    if (kind === 'name') return 'Usa solo letras y espacios (2 a 30 caracteres).';
    if (kind === 'email') return 'Ingresa un correo electrónico válido.';
    return 'Ingresa un teléfono de 10 dígitos.';
  }

  get secretError(): string {
    const control = this.secretForm.controls.palabra;
    if (!control.touched || control.valid) return '';
    if (control.hasError('required')) return 'Escribe tu palabra secreta.';
    if (control.hasError('forbidden')) return 'No uses los caracteres < > " \' `.';
    return `Debe tener entre ${SECRET_MIN} y ${SECRET_MAX} caracteres.`;
  }

  get newPasswordError(): string {
    const control = this.passwordForm.controls.contrasena;
    if (!control.touched || control.valid) return '';
    if (control.hasError('required')) return 'Escribe tu nueva contraseña.';
    if (control.hasError('forbidden')) return 'No uses los caracteres < > " \' `.';
    return 'La contraseña no cumple los requisitos.';
  }

  get confirmError(): string {
    const control = this.passwordForm.controls.confirmar;
    if (!control.touched) return '';
    if (control.hasError('required')) return 'Confirma tu nueva contraseña.';
    if (this.passwordForm.hasError('mismatch')) return 'Las contraseñas no coinciden.';
    if (this.passwordForm.hasError('sameAsCurrent')) return 'La nueva contraseña debe ser distinta de la actual.';
    return '';
  }

  /* ---------- Sesión y cuenta ---------- */

  async logout(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Cerrar sesión',
      message: '¿Deseas cerrar tu sesión en este dispositivo?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Cerrar sesión', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'confirm') return;
    this.auth.logout();
    await this.nav.navigateRoot('/login');
  }

  /** Sesión vencida: se descarta y se vuelve al inicio de sesión sin pedir confirmación. */
  goToLogin(): void {
    this.auth.logout();
    void this.nav.navigateRoot('/login');
  }

  async deleteAccount(): Promise<void> {
    if (!this.isVisitor() || this.saving()) return;
    const alert = await this.alerts.create({
      header: 'Eliminar cuenta',
      message:
        'Se eliminarán tu cuenta y sus datos (compras, progreso de lectura y sesiones). Esta acción no se puede deshacer. Escribe ELIMINAR para confirmar.',
      inputs: [{ name: 'confirm', type: 'text', placeholder: 'ELIMINAR', attributes: { autocapitalize: 'characters' } }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', role: 'destructive' },
      ],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss<{ values?: { confirm?: string } }>();
    if (role !== 'destructive') return;
    if ((data?.values?.confirm ?? '').trim().toUpperCase() !== 'ELIMINAR') {
      await this.toast('No se eliminó la cuenta: escribe ELIMINAR para confirmar.', 'warning');
      return;
    }
    this.vm
      .deleteAccount()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: async (message) => {
          await this.toast(message, 'success');
          await this.nav.navigateRoot('/login');
        },
        error: (err: unknown) => void this.toast(toProfileError(err).message, 'danger'),
      });
  }

  /* ---------- Auxiliares ---------- */

  private openSheet(sheet: Exclude<Sheet, null>): void {
    this.sheetError.set(null);
    this.sheet.set(sheet);
  }

  /** Envía un cambio desde una hoja: cierra la hoja y avisa, o muestra el error dentro de ella. */
  private submit(request: Observable<string>, success: string, reload: boolean): void {
    this.sheetError.set(null);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: async () => {
        this.sheet.set(null);
        await this.toast(success, 'success');
        if (reload) this.load();
      },
      error: (err: unknown) => {
        const error = toProfileError(err);
        if (error.kind === 'session') {
          this.sheet.set(null);
          void this.toast(error.message, 'danger');
          this.goToLogin();
          return;
        }
        this.sheetError.set(error.message);
      },
    });
  }

  private async toast(message: string, color: 'success' | 'danger' | 'warning'): Promise<void> {
    const toast = await this.toasts.create({ message, duration: 3500, position: 'bottom', color });
    await toast.present();
  }
}

/** La nueva contraseña no puede ser igual a la actual. */
function differentFromCurrent(group: AbstractControl) {
  const actual = group.get('actual')?.value;
  const nueva = group.get('contrasena')?.value;
  return actual && nueva && actual === nueva ? { sameAsCurrent: true } : null;
}
