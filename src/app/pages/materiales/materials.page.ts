import { Component, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonHeader, IonSearchbar, IonSelect, IonSelectOption, IonTitle, IonToolbar } from '@ionic/angular';
import { MATERIAL_TYPES, MaterialsFilters, materialIcon } from '../../core/models/material.models';
import { LibraryStateComponent } from '../biblioteca/library-state.component';
import { MaterialsViewModel } from './materials.view-model';

/** Vista del listado de Materiales: enlaza la plantilla con el estado y las acciones de su ViewModel. */
@Component({
  selector: 'app-materials', templateUrl: './materials.page.html',
  styleUrls: ['../biblioteca/library.scss', './materials.page.scss'],
  imports: [FormsModule, RouterLink, IonHeader, IonToolbar, IonTitle, IonContent, IonSearchbar, IonSelect, IonSelectOption, IonButton, LibraryStateComponent],
})
export class MaterialsPage implements OnDestroy {
  @ViewChild(IonContent) private content?: IonContent;
  readonly vm = new MaterialsViewModel();
  readonly materials = this.vm.materials;
  readonly subjects = this.vm.subjects;
  readonly teachers = this.vm.teachers;
  readonly semesterName = this.vm.semesterName;
  readonly loading = this.vm.loading;
  readonly error = this.vm.error;
  readonly optionsError = this.vm.optionsError;
  readonly page = this.vm.page;
  readonly total = this.vm.total;
  readonly totalPages = this.vm.totalPages;
  readonly types = MATERIAL_TYPES;
  readonly icon = materialIcon;
  get filters(): MaterialsFilters { return this.vm.filters; }
  set filters(value: MaterialsFilters) { this.vm.filters = value; }
  get filtered(): boolean { return this.vm.filtered; }
  ionViewWillEnter(): void { this.vm.enter(); }
  loadOptions(): void { this.vm.loadOptions(); }
  load(resetPage = false): void { this.vm.load(resetPage); }
  reset(): void { this.vm.reset(); }
  changePage(delta: number): void { if (this.vm.changePage(delta)) void this.content?.scrollToTop(0); }
  ionViewWillLeave(): void { this.vm.leave(); }
  ngOnDestroy(): void { this.ionViewWillLeave(); }
}
