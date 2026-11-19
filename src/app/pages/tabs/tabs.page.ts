import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { HapticDirective } from '../../core/directives/haptic.directive';
import { OnboardingService } from '../../core/services/onboarding.service';
import { SessionService } from '../../core/services/session.service';
import { GuiaComponent } from './guia/guia.component';
import { GuideModulo, GuidePaso, moduloDeRuta, pasosGuia, pasosModulo } from './guia/pasos';
import { filter } from 'rxjs';

interface TabItem {
  /** Segmento de ruta hijo de las pestañas (/home, /biblioteca…). */
  tab: string;
  label: string;
  /** Nombre del icono Phosphor (regular), sin el prefijo "ph-". */
  icon: string;
  /** Solo para Estudiante y Docente (Visitante no tiene Biblioteca ni Materiales). */
  membersOnly?: boolean;
}

const TABS: readonly TabItem[] = [
  { tab: 'home', label: 'Inicio', icon: 'house' },
  { tab: 'biblioteca', label: 'Biblioteca', icon: 'books', membersOnly: true },
  { tab: 'revistas', label: 'Revistas', icon: 'newspaper' },
  { tab: 'materiales', label: 'Materiales C.', icon: 'files', membersOnly: true },
  { tab: 'perfil', label: 'Perfil', icon: 'user' },
];

/** Contenedor con la barra inferior fija de la app autenticada. */
@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  imports: [IonTabs, IonTabBar, IonTabButton, IonLabel, HapticDirective, GuiaComponent],
})
export class TabsPage {
  private readonly user = inject(SessionService).user;
  private readonly onboarding = inject(OnboardingService);

  /** Estudiante y Docente: 5 opciones. Visitante: Inicio, Revistas y Perfil. */
  readonly tabs = computed(() => {
    const rol = this.user()?.rol;
    const isMember = rol === 'Estudiante' || rol === 'Docente';
    return TABS.filter((item) => isMember || !item.membersOnly);
  });

  /** Guía de primer uso (MEJ-01): solo después del primer inicio de sesión en este dispositivo. */
  readonly showGuide = this.onboarding.guidePending;
  readonly guideSteps = computed(() => pasosGuia(this.user()?.rol));

  /** Guía del módulo abierto, la primera vez que se entra a él. */
  readonly moduleGuide = signal<{ module: GuideModulo; steps: GuidePaso[] } | null>(null);

  private readonly router = inject(Router);

  constructor() {
    this.onboarding.settleGuide();
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => this.openModuleGuide(e.urlAfterRedirects));
  }

  closeGuide(): void {
    this.onboarding.markGuideSeen();
    // Si la guía de la barra se cerró dentro de un módulo, sigue la de ese módulo.
    this.openModuleGuide(this.router.url);
  }

  closeModuleGuide(module: GuideModulo): void {
    this.onboarding.markModuleGuideSeen(module);
    this.moduleGuide.set(null);
  }

  private openModuleGuide(url: string): void {
    const module = moduloDeRuta(url, this.user()?.rol);
    if (!module || this.showGuide() || !this.onboarding.shouldShowModuleGuide(module)) return;
    this.moduleGuide.set({ module, steps: pasosModulo(module) });
  }
}
