import { Component, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonHeader, IonSearchbar, IonSelect, IonSelectOption, IonTitle, IonToolbar } from '@ionic/angular';
import { Subscription, forkJoin } from 'rxjs';
import { LibraryBook, LibraryFilters, LibrarySemester, LibrarySubject } from '../../core/models/library.models';
import { LibraryService, libraryError } from '../../core/services/library.service';
import { SessionService } from '../../core/services/session.service';
import { BookCoverComponent } from './book-cover.component';
import { LibraryStateComponent } from './library-state.component';
@Component({
  selector: 'app-library',
  templateUrl: './library.page.html',
  styleUrls: ['./library.scss'],
  imports: [FormsModule, RouterLink, IonHeader, IonToolbar, IonTitle, IonContent, IonSearchbar, IonSelect, IonSelectOption, IonButton, BookCoverComponent, LibraryStateComponent],
})
export class LibraryPage implements OnDestroy {
  @ViewChild(IonContent) private content?: IonContent;
  private readonly service = inject(LibraryService);
  private readonly session = inject(SessionService);
  private loadedAt = 0;
  private optionsLoadedAt = 0;
  private loadedKey = '';
  private pendingKey = '';
  private owner = '';
  private catalogRequest?: Subscription;
  private optionsRequest?: Subscription;
  filters: LibraryFilters = { search: '', materia: '', semestre: '', formato: '', ordenAutor: '' };
  readonly books = signal<LibraryBook[]>([]);
  readonly subjects = signal<LibrarySubject[]>([]);
  readonly semesters = signal<LibrarySemester[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly optionsError = signal('');
  readonly page = signal(1);
  readonly pageSize = 10;
  get totalPages(): number { return Math.ceil(this.books().length / this.pageSize); }
  get visibleBooks(): LibraryBook[] { return this.books().slice((this.page() - 1) * this.pageSize, this.page() * this.pageSize); }
  get filtered(): boolean { return Object.values(this.filters).some(Boolean); }
  ionViewWillEnter(): void {
    const user = this.session.user();
    const owner = `${user?.id}:${user?.rol}`;
    if (owner !== this.owner) {
      this.catalogRequest?.unsubscribe();
      this.optionsRequest?.unsubscribe();
      this.pendingKey = '';
      this.loading.set(false);
      this.owner = owner;
      this.loadedAt = this.optionsLoadedAt = 0;
      this.loadedKey = '';
      this.page.set(1);
      this.books.set([]);
      this.subjects.set([]);
      this.semesters.set([]);
    }
    if (Date.now() - this.optionsLoadedAt > 300000) this.loadOptions();
    this.load();
  }
  loadOptions(): void {
    if (this.optionsRequest && !this.optionsRequest.closed) return;
    this.optionsError.set('');
    this.optionsRequest = forkJoin({ subjects: this.service.subjects(), semesters: this.service.semesters() }).subscribe({
      next: value => { this.subjects.set(value.subjects); this.semesters.set(value.semesters); this.optionsLoadedAt = Date.now(); },
      error: () => { this.optionsError.set('No fue posible cargar los filtros de materia y semestre.'); },
    });
  }
  load(force = false): void {
    const filters = { ...this.filters, search: this.filters.search.trim().slice(0, 200) };
    const key = JSON.stringify(filters);
    if (!force && ((this.loading() && this.pendingKey === key) ||
      (this.loadedKey === key && Date.now() - this.loadedAt < 60000))) return;
    this.catalogRequest?.unsubscribe();
    this.pendingKey = key;
    this.loading.set(true);
    this.error.set('');
    if (this.loadedKey !== key) { this.books.set([]); this.page.set(1); this.loadedAt = 0; this.loadedKey = ''; }
    this.catalogRequest = this.service.catalog(filters).subscribe({
      next: books => {
        this.books.set(books); this.loading.set(false);
        this.loadedAt = Date.now(); this.loadedKey = key;
        this.page.set(Math.min(this.page(), Math.max(1, this.totalPages)));
      },
      error: error => { this.error.set(libraryError(error)); this.loading.set(false); },
    });
  }
  reset(): void { this.filters = { search: '', materia: '', semestre: '', formato: '', ordenAutor: '' }; this.load(); }
  changePage(delta: number): void { this.page.set(Math.max(1, Math.min(this.totalPages, this.page() + delta))); void this.content?.scrollToTop(0); }
  ionViewWillLeave(): void { this.catalogRequest?.unsubscribe(); this.optionsRequest?.unsubscribe(); this.loading.set(false); }
  ngOnDestroy(): void { this.ionViewWillLeave(); }
}
