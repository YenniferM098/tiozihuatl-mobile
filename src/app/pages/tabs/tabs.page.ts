import { Component } from '@angular/core';
import { IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { HapticDirective } from '../../core/directives/haptic.directive';

interface TabItem {
  /** Segmento de ruta hijo de las pestañas (/home, /biblioteca…). */
  tab: string;
  label: string;
  /** Nombre del icono Phosphor (regular), sin el prefijo "ph-". */
  icon: string;
}

/** Contenedor con la barra inferior fija de la app autenticada. */
@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  imports: [IonTabs, IonTabBar, IonTabButton, IonLabel, HapticDirective],
})
export class TabsPage {
  readonly tabs: TabItem[] = [
    { tab: 'home', label: 'Inicio', icon: 'house' },
    { tab: 'biblioteca', label: 'Biblioteca', icon: 'books' },
    { tab: 'revistas', label: 'Revistas', icon: 'newspaper' },
    { tab: 'materiales', label: 'Materiales C.', icon: 'files' },
    { tab: 'perfil', label: 'Perfil', icon: 'user' },
  ];
}
