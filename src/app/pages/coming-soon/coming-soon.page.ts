import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';

/** Datos de cada pestaña aún sin contenido (definidos en app.routes.ts). */
export interface ComingSoonData {
  title: string;
  icon: string;
  description: string;
}

/** Pantalla provisional para las secciones que todavía no están disponibles. */
@Component({
  selector: 'app-coming-soon',
  templateUrl: 'coming-soon.page.html',
  styleUrls: ['coming-soon.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent],
})
export class ComingSoonPage {
  readonly data = inject(ActivatedRoute).snapshot.data as ComingSoonData;
}
