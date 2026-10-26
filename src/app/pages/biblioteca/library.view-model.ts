import { inject, signal } from '@angular/core';
import { Subscription, forkJoin } from 'rxjs';
import { LibraryBook, LibraryFilters, LibrarySemester, LibrarySubject } from '../../core/models/library.models';
import { LibraryService, libraryError } from '../../core/services/library.service';
import { SessionService } from '../../core/services/session.service';

const EMPTY_FILTERS: LibraryFilters = { search: '', materia: '', semestre: '', formato: '', ordenAutor: '' };

/**
 * ViewModel del catálogo (MVVM): conserva resultados, filtros, paginación y estados de carga,
 * y decide cuándo volver a consultar. La vista solo enlaza estos valores.
 * Se crea dentro del contexto de inyección de la página.
 */
export class LibraryViewModel {
  private readonly service = inject(LibraryService);
  private readonly session = inject(SessionService);
  private loadedAt = 0;
  private optionsLoadedAt = 0;
  private loadedKey = '';
  private pendingKey = '';
  private owner = '';
  private catalogRequest?: Subscription;
  private optionsRequest?: Subscription;
  filters: LibraryFilters = { ...EMPTY_FILTERS };
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

  /** Al entrar a la vista: descarta datos de otra sesión y recarga lo que ya caducó. */
  enter(): void {
    const user = this.session.user();
    const owner = `${user?.id}:${user?.rol}`;
    if (owner !== this.owner) {
      this.leave();
      this.pendingKey = '';
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
  reset(): void { this.filters = { ...EMPTY_FILTERS }; this.load(); }
  changePage(delta: number): void { this.page.set(Math.max(1, Math.min(this.totalPages, this.page() + delta))); }
  /** Al salir de la vista: cancela las peticiones pendientes. */
  leave(): void { this.catalogRequest?.unsubscribe(); this.optionsRequest?.unsubscribe(); this.loading.set(false); }
}
