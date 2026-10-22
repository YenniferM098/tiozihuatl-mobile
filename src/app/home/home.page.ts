import { Component, WritableSignal, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonRefresher, IonRefresherContent, IonSkeletonText } from '@ionic/angular';
import { Observable, forkJoin, tap } from 'rxjs';
import { HapticDirective } from '../core/directives/haptic.directive';
import { FeaturedEvent, HomeBook, HomeMagazine, HomeMaterial } from '../core/models/home.models';
import { AuthService } from '../core/services/auth.service';
import { HomeContentService } from '../core/services/home-content.service';
import { SessionService } from '../core/services/session.service';

/** `null` mientras carga; lista vacía cuando no hay contenido o la consulta falló. */
type Section<T> = T[] | null;

/**
 * Inicio: saludo y contenido según el tipo de usuario.
 * - Estudiante: destacados, libros y materiales de su semestre, y revistas recientes.
 * - Docente: destacados, libros del acervo, sus materiales y revistas recientes.
 * - Visitante: destacados y revistas recientes (no se consulta Biblioteca ni Materiales).
 * Libros, revistas y materiales son solo informativos en esta versión.
 */
@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss', 'home.page.common.scss', 'home.page.waves.scss'],
  imports: [IonContent, IonRefresher, IonRefresherContent, IonSkeletonText, HapticDirective],
})
export class HomePage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly content = inject(HomeContentService);
  private readonly user = inject(SessionService).user;

  readonly events = signal<Section<FeaturedEvent>>(null);
  readonly books = signal<Section<HomeBook>>(null);
  readonly magazines = signal<Section<HomeMagazine>>(null);
  readonly materials = signal<Section<HomeMaterial>>(null);

  readonly firstName = computed(() => {
    const name = (this.user()?.nombre ?? '').trim();
    return name ? name.split(/\s+/)[0] : '';
  });

  /** El título dice qué criterio usa cada sección. */
  readonly isTeacher = computed(() => this.user()?.rol === 'Docente');

  /** Portadas de PDF que no se pudieron cargar: el libro vuelve al diseño con icono. */
  readonly brokenCovers = signal<ReadonlySet<string>>(new Set());

  readonly skeletonCards = [1, 2];
  readonly skeletonRows = [1, 2, 3];

  constructor() {
    this.load();
  }

  refresh(event: Event): void {
    this.load(() => (event.target as HTMLIonRefresherElement).complete());
  }

  coverFailed(url: string): void {
    this.brokenCovers.update((set) => new Set(set).add(url));
  }

  logout(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  /** Primero identifica el tipo de usuario y después consulta solo lo que le corresponde. */
  private load(done?: () => void): void {
    const user = this.user();
    if (!user) {
      done?.();
      return;
    }

    const requests: Observable<unknown>[] = [
      this.fill(this.events, this.content.featuredEvents()),
      this.fill(this.magazines, this.content.recentMagazines()),
    ];

    if (user.rol === 'Estudiante') {
      requests.push(
        this.fill(this.books, this.content.books(user.id_semestre)),
        this.fill(this.materials, this.content.semesterMaterials(user.id_semestre)),
      );
    } else if (user.rol === 'Docente') {
      requests.push(
        this.fill(this.books, this.content.books(null)),
        this.fill(this.materials, this.content.teacherMaterials()),
      );
    } else {
      // Visitante: Biblioteca y Materiales no forman parte de su Inicio.
      this.books.set([]);
      this.materials.set([]);
    }

    // Cada sección se muestra en cuanto llega; el refresco termina cuando llegan todas.
    forkJoin(requests).subscribe({ complete: () => done?.() });
  }

  /** Al refrescar se conserva lo que ya se ve hasta que llega la respuesta nueva. */
  private fill<T>(target: WritableSignal<Section<T>>, source: Observable<T[]>): Observable<T[]> {
    return source.pipe(tap((items) => target.set(items)));
  }
}
