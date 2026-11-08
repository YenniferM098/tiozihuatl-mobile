import { DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { Profile, ProfileError } from '../../core/models/profile.models';
import { ProfileService, toProfileError } from '../../core/services/profile.service';

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
}
