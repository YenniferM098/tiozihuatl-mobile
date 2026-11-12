import { InjectionToken, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpMagazinesRepository } from '../../data/repositories/http-magazines.repository';
import {
  MagazineCatalogResponse,
  MagazineDetailResponse,
  MagazineFilterParams,
  MagazineFilterResponse,
  PurchasedMagazineDto,
} from '../../core/models/magazine.models';

/**
 * Contrato de acceso a Revistas Digitales (patrón Repository).
 * La capa de aplicación depende de esta interfaz y no de HttpClient.
 */
export interface MagazinesRepository {
  /** GET /magazines (público): revistas activas con portada y descuento vigente. */
  catalog(): Observable<MagazineCatalogResponse>;
  /** GET /magazines/filter (público): búsqueda por título, letra inicial y orden. */
  filter(params: MagazineFilterParams): Observable<MagazineFilterResponse>;
  /** GET /magazines/:id (público). */
  detail(id: number): Observable<MagazineDetailResponse>;
  /** GET /magazines/my-purchases (con sesión): revistas que adquirió el usuario. */
  myPurchases(): Observable<PurchasedMagazineDto[]>;
}

/** Punto de inyección del repositorio; la fábrica entrega la implementación HTTP (patrón Factory). */
export const MAGAZINES_REPOSITORY = new InjectionToken<MagazinesRepository>('MAGAZINES_REPOSITORY', {
  providedIn: 'root',
  factory: () => inject(HttpMagazinesRepository),
});
