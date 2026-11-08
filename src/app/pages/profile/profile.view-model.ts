import { DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize } from 'rxjs';
import { Profile, ProfileError, ProfileUpdateRequest } from '../../core/models/profile.models';
import { ProfileService, toProfileError } from '../../core/services/profile.service';

/** Valores del formulario de edición (los nombres coinciden con los del backend). */
export type EditableFields = Record<'nombre' | 'a_paterno' | 'a_materno' | 'correo' | 'telefono', string>;

/** Visitante puede cambiar su nombre; Estudiante y Docente solo correo y teléfono. */
const VISITOR_FIELDS = ['nombre', 'a_paterno', 'a_materno', 'correo', 'telefono'] as const;
const MEMBER_FIELDS = ['correo', 'telefono'] as const;

/**
 * ViewModel del perfil (MVVM): conserva los datos de la cuenta, el error de carga y si hay
 * una operación en curso, y ejecuta los casos de uso del servicio. La vista solo enlaza
 * estos valores y se encarga de formularios, hojas, alertas y avisos.
 * Se crea dentro del contexto de inyección de la página.
 */
export class ProfileViewModel {
  private readonly service = inject(ProfileService);
  private readonly destroyRef = inject(DestroyRef);

  readonly profile = signal<Profile | null>(null);
  readonly error = signal<ProfileError | null>(null);
  /** Hay un cambio enviándose: la vista bloquea los formularios y los botones. */
  readonly saving = signal(false);

  readonly isVisitor = computed(() => this.profile()?.rol === 'Visitante');
  readonly isStudent = computed(() => this.profile()?.rol === 'Estudiante');

  /**
   * Consulta el perfil. Sin datos en pantalla, un error se muestra como estado de la vista;
   * al refrescar se conserva lo que ya se ve y el error se entrega a `onRefreshError`.
   */
  load(done?: () => void, onRefreshError?: (error: ProfileError) => void): void {
    this.error.set(null);
    this.service
      .profile()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => done?.()),
      )
      .subscribe({
        next: (profile) => this.profile.set(profile),
        error: (err) => {
          const error = toProfileError(err);
          if (this.profile()) onRefreshError?.(error);
          else this.error.set(error);
        },
      });
  }

  /** Solo los campos permitidos al rol que cambiaron (el backend ignora los demás). */
  changes(values: EditableFields): ProfileUpdateRequest {
    const p = this.profile();
    if (!p) return {};
    const current: EditableFields = {
      nombre: p.nombre,
      a_paterno: p.aPaterno,
      a_materno: p.aMaterno,
      correo: p.correo,
      telefono: p.telefono,
    };
    const changes: ProfileUpdateRequest = {};
    for (const key of this.isVisitor() ? VISITOR_FIELDS : MEMBER_FIELDS) {
      const value = values[key].replace(/\s+/g, ' ').trim();
      if (value !== current[key]) changes[key] = key === 'correo' ? value.toLowerCase() : value;
    }
    return changes;
  }

  /** Guarda los datos personales permitidos. */
  update(changes: ProfileUpdateRequest): Observable<string> {
    return this.run(this.service.update(changes));
  }

  /** Guarda la palabra secreta con la que se recupera la contraseña. */
  saveSecret(palabra: string): Observable<string> {
    return this.run(this.service.update({ palabra_secreta: palabra.trim() }));
  }

  /** Cambia la contraseña con la que se inicia sesión. */
  changePassword(actual: string, nueva: string): Observable<string> {
    return this.run(this.service.changePassword(actual, nueva));
  }

  /** Marca la operación en curso mientras dura la petición. */
  private run(request: Observable<string>): Observable<string> {
    this.saving.set(true);
    return request.pipe(finalize(() => this.saving.set(false)));
  }
}
