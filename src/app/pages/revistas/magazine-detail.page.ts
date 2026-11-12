import { Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { LibraryStateComponent } from '../biblioteca/library-state.component';
import { MagazineDetailViewModel } from './magazine-detail.view-model';
import { formatPrice } from './magazines.view-model';

/** Vista del detalle de una revista: portada, título, descripción y precio. */
@Component({
  selector: 'app-magazine-detail',
  templateUrl: './magazine-detail.page.html',
  styleUrls: ['../biblioteca/library.scss', './magazine-detail.page.scss'],
  imports: [RouterLink, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonButton, LibraryStateComponent],
})
export class MagazineDetailPage implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  readonly vm = new MagazineDetailViewModel();
  readonly magazine = this.vm.magazine;
  readonly loading = this.vm.loading;
  readonly error = this.vm.error;
  readonly price = formatPrice;
  readonly coverBroken = signal(false);

  ionViewWillEnter(): void {
    this.load();
  }

  load(): void {
    this.coverBroken.set(false);
    this.vm.load(Number(this.route.snapshot.paramMap.get('id')));
  }

  ionViewWillLeave(): void {
    this.vm.leave();
  }

  ngOnDestroy(): void {
    this.ionViewWillLeave();
  }
}
