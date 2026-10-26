import { Component, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { LibraryBook } from '../../core/models/library.models';
import { LibraryService, hasDigitalFile, libraryError } from '../../core/services/library.service';
import { BookCoverComponent } from './book-cover.component';
import { LibraryStateComponent } from './library-state.component';
@Component({
  selector: 'app-book-detail',
  templateUrl: './book-detail.page.html',
  styleUrls: ['./library.scss'],
  imports: [RouterLink, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonButton, BookCoverComponent, LibraryStateComponent],
})
export class BookDetailPage implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(LibraryService);
  private request?: Subscription;
  readonly book = signal<LibraryBook | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  /** El contenido digital solo se considera autorizado si el archivo existe en Cloudinary. */
  readonly hasDigitalFile = hasDigitalFile;
  /** Disponibilidad de ejemplares físicos según total/disponibles de GET /catalog. */
  physicalCopies(book: LibraryBook): string {
    if (Number(book.tiene_fisico) !== 1) return 'Este libro no cuenta con ejemplares físicos.';
    if (book.disponibles == null) return 'Cuenta con ejemplares físicos en la biblioteca.';
    const total = book.total == null ? '' : ` de ${book.total}`;
    if (Number(book.disponibles) <= 0) return `Sin ejemplares disponibles por el momento (0${total}).`;
    return `${book.disponibles}${total} ejemplares disponibles para consulta en la biblioteca.`;
  }
  ionViewWillEnter(): void { this.load(); }
  load(): void {
    this.request?.unsubscribe();
    this.book.set(null);
    this.error.set('');
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isSafeInteger(id) || id <= 0) { this.loading.set(false); this.error.set('El libro no está disponible.'); return; }
    this.loading.set(true);
    // La API no ofrece GET por id; se recupera el catálogo como en el detalle web.
    this.request = this.service.catalog().subscribe({
      next: books => { this.book.set(books.find(book => Number(book.id) === id) ?? null); this.loading.set(false); if (!this.book()) this.error.set('El libro no está disponible.'); },
      error: error => { this.loading.set(false); this.error.set(libraryError(error)); },
    });
  }
  ionViewWillLeave(): void { this.request?.unsubscribe(); }
  ngOnDestroy(): void { this.ionViewWillLeave(); }
}
