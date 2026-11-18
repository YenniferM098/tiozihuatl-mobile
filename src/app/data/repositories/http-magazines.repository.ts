import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  MagazineCatalogResponse,
  MagazineDetailResponse,
  MagazineFilterParams,
  MagazineFilterResponse,
  PurchasedMagazineDto,
  SecurePdfResponse,
} from '../../core/models/magazine.models';
import type { MagazinesRepository } from '../../domain/repositories/magazines.repository';

/** Implementación del repositorio de Revistas sobre la API REST (el interceptor agrega el token). */
@Injectable({ providedIn: 'root' })
export class HttpMagazinesRepository implements MagazinesRepository {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/magazines`;

  catalog(): Observable<MagazineCatalogResponse> {
    return this.http.get<MagazineCatalogResponse>(this.api);
  }

  filter({ sort, search, letter }: MagazineFilterParams): Observable<MagazineFilterResponse> {
    let params = new HttpParams().set('sort', sort);
    if (search) params = params.set('search', search);
    if (letter) params = params.set('letter', letter);
    return this.http.get<MagazineFilterResponse>(`${this.api}/filter`, { params });
  }

  detail(id: number): Observable<MagazineDetailResponse> {
    return this.http.get<MagazineDetailResponse>(`${this.api}/${id}`);
  }

  myPurchases(): Observable<PurchasedMagazineDto[]> {
    return this.http.get<PurchasedMagazineDto[]>(`${this.api}/my-purchases`);
  }

  securePdf(id: number): Observable<SecurePdfResponse> {
    return this.http.get<SecurePdfResponse>(`${this.api}/secure-pdf/${id}`);
  }

  file(url: string): Observable<ArrayBuffer> {
    return this.http.get(url, { responseType: 'arraybuffer' });
  }
}
