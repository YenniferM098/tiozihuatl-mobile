import { Component, OnDestroy, signal } from '@angular/core';
import { IonContent, IonHeader, IonRefresher, IonRefresherContent, IonTitle, IonToolbar } from '@ionic/angular';
import { LibraryStateComponent } from '../biblioteca/library-state.component';
import { MagazinesViewModel, formatPrice } from './magazines.view-model';

/** Vista del catálogo de Revistas Digitales (todos los roles): enlaza la plantilla con su ViewModel. */
@Component({
  selector: 'app-magazines',
  templateUrl: './magazines.page.html',
  styleUrls: ['../biblioteca/library.scss', './magazines.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonRefresher, IonRefresherContent, LibraryStateComponent],
})
export class MagazinesPage implements OnDestroy {
  readonly vm = new MagazinesViewModel();
  readonly magazines = this.vm.magazines;
  readonly loading = this.vm.loading;
  readonly error = this.vm.error;
  readonly price = formatPrice;
  /** Portadas que no se pudieron descargar: se muestra el icono en su lugar. */
  readonly brokenCovers = signal<ReadonlySet<number>>(new Set());

  ionViewWillEnter(): void {
    this.vm.load();
  }

  load(refresh = false): void {
    this.vm.load(refresh);
  }

  /** Gesto de deslizar hacia abajo: vuelve a pedir el catálogo al servidor. */
  refresh(event: Event): void {
    this.brokenCovers.set(new Set());
    this.vm.load(true, () => (event.target as HTMLIonRefresherElement).complete());
  }

  coverFailed(id: number): void {
    this.brokenCovers.update((ids) => new Set(ids).add(id));
  }

  ionViewWillLeave(): void {
    this.vm.leave();
  }

  ngOnDestroy(): void {
    this.ionViewWillLeave();
  }
}
