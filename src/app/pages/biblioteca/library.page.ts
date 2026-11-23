import { Component, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonHeader, IonRefresher, IonRefresherContent, IonSearchbar, IonSelect, IonSelectOption, IonSpinner, IonToolbar } from '@ionic/angular';
import { LibraryBook, LibraryFilters } from '../../core/models/library.models';
import { ListSkeletonComponent } from '../../shared/list-skeleton.component';
import { PullRefresh } from '../../shared/pull-refresh';
import { SectionTitleComponent } from '../../shared/section-title.component';
import { commaList, shortSemesters } from '../../shared/semesters';
import { BookCoverComponent } from './book-cover.component';
import { LibraryStateComponent } from './library-state.component';
import { LibraryViewModel } from './library.view-model';

/** Vista del catálogo: enlaza la plantilla con el estado y las acciones de su ViewModel. */
@Component({
  selector: 'app-library',
  templateUrl: './library.page.html',
  styleUrls: ['./library.scss'],
  imports: [FormsModule, RouterLink, IonHeader, IonToolbar, IonContent, IonSearchbar, IonSelect, IonSelectOption, IonButton, IonRefresher, IonRefresherContent, IonSpinner, BookCoverComponent, LibraryStateComponent, SectionTitleComponent, ListSkeletonComponent],
})
export class LibraryPage implements OnDestroy {
  @ViewChild(IonContent) private content?: IonContent;
  readonly vm = new LibraryViewModel();
  /** Semestres de la tarjeta en etiquetas cortas (1.º, 2.º…). */
  readonly semesterTags = shortSemesters;
  /** Materias con espacio después de cada coma. */
  readonly list = commaList;
  readonly books = this.vm.books;
  readonly subjects = this.vm.subjects;
  readonly semesters = this.vm.semesters;
  readonly loading = this.vm.loading;
  readonly error = this.vm.error;
  readonly optionsError = this.vm.optionsError;
  /** Deslizar para actualizar: el indicador se cierra cuando termina la recarga. */
  private readonly pull = new PullRefresh(this.loading);
  readonly page = this.vm.page;
  readonly pageSize = this.vm.pageSize;
  get filters(): LibraryFilters { return this.vm.filters; }
  set filters(value: LibraryFilters) { this.vm.filters = value; }
  get totalPages(): number { return this.vm.totalPages; }
  get visibleBooks(): LibraryBook[] { return this.vm.visibleBooks; }
  get filtered(): boolean { return this.vm.filtered; }
  /** Total del acervo para el título; se oculta mientras carga, con error o con filtros. */
  get countLabel(): string {
    const total = this.books().length;
    if (this.loading() || this.error() || this.filtered || !total) return '';
    return total === 1 ? '1 libro' : `${total} libros`;
  }
  ionViewWillEnter(): void { this.vm.enter(); }
  /** Jalar la lista hacia abajo recarga el catálogo desde el servidor. */
  refresh(event: Event): void {
    this.pull.start(event);
    this.load(true);
  }
  loadOptions(): void { this.vm.loadOptions(); }
  load(force = false): void { this.vm.load(force); }
  reset(): void { this.vm.reset(); }
  changePage(delta: number): void { this.vm.changePage(delta); void this.content?.scrollToTop(0); }
  ionViewWillLeave(): void { this.vm.leave(); }
  ngOnDestroy(): void { this.ionViewWillLeave(); }
}
