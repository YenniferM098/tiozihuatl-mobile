import { Component, computed, inject } from '@angular/core';
import { IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { HapticDirective } from '../../core/directives/haptic.directive';
import { SessionService } from '../../core/services/session.service';

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
  imports: [IonTabs, IonTabBar, IonTabButton, IonLabel, HapticDirective],
})
export class TabsPage {
  private readonly user = inject(SessionService).user;

  /** Estudiante y Docente: 5 opciones. Visitante: Inicio, Revistas y Perfil. */
  readonly tabs = computed(() => {
    const rol = this.user()?.rol;
    const isMember = rol === 'Estudiante' || rol === 'Docente';
    return TABS.filter((item) => isMember || !item.membersOnly);
  });
}
