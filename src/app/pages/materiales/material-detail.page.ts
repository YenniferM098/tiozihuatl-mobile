import { DatePipe } from '@angular/common';
import { Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonModal, IonTitle, IonToolbar } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { ComplementaryMaterial, materialIcon } from '../../core/models/material.models';
import { DownloadedMaterial } from '../../core/native/material-files';
import { MaterialFilesService, materialFileError } from '../../core/services/material-files.service';
import { MaterialsService, materialsError } from '../../core/services/materials.service';
import { LibraryStateComponent } from '../biblioteca/library-state.component';
@Component({
  selector: 'app-material-detail', templateUrl: './material-detail.page.html',
  styleUrls: ['../biblioteca/library.scss', './materials.page.scss', './material-detail.page.scss'],
  imports: [DatePipe, RouterLink, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonButton, IonModal, LibraryStateComponent],
})
export class MaterialDetailPage implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(MaterialsService);
  private readonly files = inject(MaterialFilesService);
  private abort?: AbortController;
  private downloadVersion = 0;
  private confirmationTimer?: ReturnType<typeof setTimeout>;
  readonly downloadConfirmation = signal(false);
  closeConfirmation(): void {
    if (this.confirmationTimer) clearTimeout(this.confirmationTimer);
    this.confirmationTimer = undefined; this.downloadConfirmation.set(false);
  }
  private showConfirmation(): void {
    this.closeConfirmation(); this.downloadConfirmation.set(true);
    this.confirmationTimer = setTimeout(() => this.closeConfirmation(), 5000);
  }
  readonly downloading = signal(false);
  readonly downloadMessage = signal('');
  readonly downloadError = signal('');
  readonly downloaded = signal<DownloadedMaterial | null>(null);
  canPreview(type: string): boolean { return ['PDF', 'IMAGEN', 'VIDEO'].includes(type); }
  hasFile(url: unknown): boolean { return this.files.safeUrl(url); }
  private request?: Subscription;
  readonly material = signal<ComplementaryMaterial | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly icon = materialIcon;
  ionViewWillEnter(): void { this.load(); }
  load(): void {
    this.closeConfirmation(); this.abort?.abort(); this.downloadVersion++; this.downloading.set(false); this.downloadMessage.set(''); this.downloadError.set(''); this.downloaded.set(null);
    this.request?.unsubscribe(); this.material.set(null); this.error.set(''); this.loading.set(true);
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.request = this.service.detail(id).subscribe({
      next: material => { this.material.set(material); this.loading.set(false); if (!material) this.error.set('El material no está disponible para tu cuenta o ya no está publicado.'); },
      error: error => { this.loading.set(false); this.error.set(materialsError(error)); },
    });
  }
  async download(): Promise<void> {
    const material = this.material(); if (!material || this.downloading()) return;
    this.abort = new AbortController(); const version = ++this.downloadVersion;
    this.closeConfirmation(); this.downloading.set(true); this.downloadError.set(''); this.downloadMessage.set(''); this.downloaded.set(null);
    try {
      const file = await this.files.download(material.id_material, this.abort.signal);
      if (version !== this.downloadVersion) return;
      this.downloaded.set(file);
      if (file) this.showConfirmation();
      else this.downloadMessage.set('Archivo enviado al navegador. Consulta sus descargas para comprobar dónde se guardó.');
    } catch (error) { if (version === this.downloadVersion) this.downloadError.set(materialFileError(error)); }
    finally { if (version === this.downloadVersion) this.downloading.set(false); }
  }
  async openDownloaded(): Promise<void> {
    const file = this.downloaded(); if (!file) return;
    try { await this.files.open(file); } catch (error) { this.downloadError.set(materialFileError(error)); }
  }
  ionViewWillLeave(): void { this.request?.unsubscribe(); this.closeConfirmation(); this.abort?.abort(); this.downloadVersion++; this.downloading.set(false); }
  ngOnDestroy(): void { this.ionViewWillLeave(); }
}
