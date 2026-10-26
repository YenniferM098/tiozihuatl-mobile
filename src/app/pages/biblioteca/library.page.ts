import { Component, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonHeader, IonSearchbar, IonSelect, IonSelectOption, IonTitle, IonToolbar } from '@ionic/angular';
import { LibraryBook, LibraryFilters } from '../../core/models/library.models';
import { BookCoverComponent } from './book-cover.component';
import { LibraryStateComponent } from './library-state.component';
import { LibraryViewModel } from './library.view-model';

/** Vista del catálogo: enlaza la plantilla con el estado y las acciones de su ViewModel. */
@Component({
  selector: 'app-library',
  templateUrl: './library.page.html',
  styleUrls: ['./library.scss'],
  imports: [FormsModule, RouterLink, IonHeader, IonToolbar, IonTitle, IonContent, IonSearchbar, IonSelect, IonSelectOption, IonButton, BookCoverComponent, LibraryStateComponent],
})
export class LibraryPage implements OnDestroy {
  @ViewChild(IonContent) private content?: IonContent;
  readonly vm = new LibraryViewModel();
  readonly books = this.vm.books;
  readonly subjects = this.vm.subjects;
  readonly semesters = this.vm.semesters;
  readonly loading = this.vm.loading;
  readonly error = this.vm.error;
  readonly optionsError = this.vm.optionsError;
  readonly page = this.vm.page;
  readonly pageSize = this.vm.pageSize;
  get filters(): LibraryFilters { return this.vm.filters; }
  set filters(value: LibraryFilters) { this.vm.filters = value; }
  get totalPages(): number { return this.vm.totalPages; }
  get visibleBooks(): LibraryBook[] { return this.vm.visibleBooks; }
  get filtered(): boolean { return this.vm.filtered; }
  ionViewWillEnter(): void { this.vm.enter(); }
  loadOptions(): void { this.vm.loadOptions(); }
  load(force = false): void { this.vm.load(force); }
  reset(): void { this.vm.reset(); }
  changePage(delta: number): void { this.vm.changePage(delta); void this.content?.scrollToTop(0); }
  ionViewWillLeave(): void { this.vm.leave(); }
  ngOnDestroy(): void { this.ionViewWillLeave(); }
}
