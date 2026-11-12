import { Component, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { MagazineFilters } from '../../core/models/magazine.models';
import { LibraryStateComponent } from '../biblioteca/library-state.component';
import { MAGAZINE_LETTERS, MAGAZINE_SORTS, MagazinesViewModel, formatPrice } from './magazines.view-model';

/** Vista del catálogo de Revistas Digitales (todos los roles): enlaza la plantilla con su ViewModel. */
@Component({
  selector: 'app-magazines',
  templateUrl: './magazines.page.html',
  styleUrls: ['../biblioteca/library.scss', './magazines.page.scss'],
  imports: [
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonSearchbar,
    IonSelect,
    IonSelectOption,
    IonButton,
    LibraryStateComponent,
  ],
})
export class MagazinesPage implements OnDestroy {
  readonly vm = new MagazinesViewModel();
  readonly magazines = this.vm.magazines;
  readonly loading = this.vm.loading;
  readonly error = this.vm.error;
  readonly price = formatPrice;
  readonly sorts = MAGAZINE_SORTS;
  readonly letters = MAGAZINE_LETTERS;
  /** Portadas que no se pudieron descargar: se muestra el icono en su lugar. */
  readonly brokenCovers = signal<ReadonlySet<number>>(new Set());

  get filters(): MagazineFilters {
    return this.vm.filters;
  }

  get filtered(): boolean {
    return this.vm.filtered;
  }

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

  /** "3 revistas" o, con búsqueda o filtros, "3 revistas encontradas". */
  countLabel(): string {
    const total = this.magazines().length;
    const label = total === 1 ? '1 revista' : `${total} revistas`;
    if (!this.filtered) return label;
    return `${label} ${total === 1 ? 'encontrada' : 'encontradas'}`;
  }

  reset(): void {
    this.vm.reset();
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
