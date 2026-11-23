import { Component, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonHeader, IonRefresher, IonRefresherContent, IonSearchbar, IonSelect, IonSelectOption, IonSpinner, IonToolbar } from '@ionic/angular';
import { MATERIAL_TYPES, MaterialsFilters, materialIcon } from '../../core/models/material.models';
import { ListSkeletonComponent } from '../../shared/list-skeleton.component';
import { PullRefresh } from '../../shared/pull-refresh';
import { SectionTitleComponent } from '../../shared/section-title.component';
import { commaList, shortSemesters } from '../../shared/semesters';
import { LibraryStateComponent } from '../biblioteca/library-state.component';
import { MaterialsViewModel } from './materials.view-model';

/** Vista del listado de Materiales: enlaza la plantilla con el estado y las acciones de su ViewModel. */
@Component({
  selector: 'app-materials', templateUrl: './materials.page.html',
  styleUrls: ['../biblioteca/library.scss', './materials.page.scss'],
  imports: [FormsModule, RouterLink, IonHeader, IonToolbar, IonContent, IonSearchbar, IonSelect, IonSelectOption, IonButton, IonRefresher, IonRefresherContent, IonSpinner, LibraryStateComponent, SectionTitleComponent, ListSkeletonComponent],
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
  /** Semestres en etiquetas cortas y materias con espacio después de cada coma. */
  readonly semesterTags = shortSemesters;
  readonly list = commaList;
  /** Deslizar para actualizar: el indicador se cierra cuando termina la recarga. */
  private readonly pull = new PullRefresh(this.loading);
  get filters(): MaterialsFilters { return this.vm.filters; }
  set filters(value: MaterialsFilters) { this.vm.filters = value; }
  get filtered(): boolean { return this.vm.filtered; }
  /** Total de materiales para el título; se oculta mientras carga, con error o con filtros. */
  get countLabel(): string {
    const total = this.total();
    if (this.loading() || this.error() || this.filtered || !total) return '';
    return total === 1 ? '1 material' : `${total} materiales`;
  }
  /** Jalar la lista hacia abajo vuelve a consultar los materiales. */
  refresh(event: Event): void { this.pull.start(event); this.load(); }
  ionViewWillEnter(): void { this.vm.enter(); }
  loadOptions(): void { this.vm.loadOptions(); }
  load(resetPage = false): void { this.vm.load(resetPage); }
  reset(): void { this.vm.reset(); }
  changePage(delta: number): void { if (this.vm.changePage(delta)) void this.content?.scrollToTop(0); }
  ionViewWillLeave(): void { this.vm.leave(); }
  ngOnDestroy(): void { this.ionViewWillLeave(); }
}
