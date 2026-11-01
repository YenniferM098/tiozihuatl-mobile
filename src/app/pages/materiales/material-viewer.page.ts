import { Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { MaterialFilesService, materialFileError } from '../../core/services/material-files.service';
import { LibraryStateComponent } from '../biblioteca/library-state.component';
@Component({
  selector: 'app-material-viewer', templateUrl: './material-viewer.page.html',
  styleUrls: ['../biblioteca/library.scss', './materials.page.scss', './material-viewer.page.scss'],
  imports: [IonBackButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar, LibraryStateComponent],
})
export class MaterialViewerPage implements OnDestroy {
  @ViewChild('video') private video?: ElementRef<HTMLVideoElement>;
  private readonly route = inject(ActivatedRoute);
  private readonly files = inject(MaterialFilesService);
  private request?: Subscription;
  readonly loading = signal(true);
  readonly error = signal('');
  readonly source = signal('');
  readonly type = signal('');
  readonly mime = signal('');
  readonly title = signal('Visualizar material');
  get detailUrl(): string { return `/materiales/${this.route.snapshot.paramMap.get('id')}`; }
  ionViewWillEnter(): void { this.load(); }
  load(): void {
    this.release(); this.error.set(''); this.loading.set(true);
    this.request = this.files.preview(Number(this.route.snapshot.paramMap.get('id'))).subscribe({
      next: result => {
        this.title.set(result.material.titulo); this.type.set(result.material.tipo); this.mime.set(result.mime);
        if (result.material.tipo === 'VIDEO' && !document.createElement('video').canPlayType(result.mime)) {
          this.error.set('Este video no tiene una vista previa compatible con este dispositivo. Regresa al detalle para descargarlo y abrirlo con otra aplicación.');
          this.loading.set(false); return;
        }
        this.source.set(result.url);
      },
      error: error => { this.loading.set(false); this.error.set(materialFileError(error)); },
    });
  }
  ready(): void { this.loading.set(false); }
  failed(): void {
    this.video?.nativeElement.pause(); this.loading.set(false);
    this.error.set('No fue posible visualizar el archivo. Revisa tu conexión o regresa al detalle para descargarlo y abrirlo con una aplicación compatible.');
  }
  private release(): void {
    this.request?.unsubscribe();
    const video = this.video?.nativeElement;
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
    if (this.source().startsWith('blob:')) URL.revokeObjectURL(this.source());
    this.source.set(''); this.type.set(''); this.mime.set('');
  }
  ionViewWillLeave(): void { this.release(); }
  ngOnDestroy(): void { this.release(); }
}
