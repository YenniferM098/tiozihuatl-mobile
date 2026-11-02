import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Observable, TimeoutError, defer, firstValueFrom, from, map, switchMap, throwError, timeout } from 'rxjs';
import { ComplementaryMaterial } from '../models/material.models';
import { MATERIALS_REPOSITORY } from '../../domain/repositories/materials.repository';
import { DownloadedMaterial, MATERIAL_FILES_NATIVE } from '../native/material-files';
import { materialFileName, validateMaterialBytes } from './material-file-validation';
import { MaterialsService } from './materials.service';
import { SessionService } from './session.service';

export function materialFileError(error: unknown): string {
  if (error instanceof TimeoutError) return 'La descarga tardó demasiado. Revisa tu conexión e intenta nuevamente.';
  if (error instanceof HttpErrorResponse) {
    if (error.status === 401 || error.status === 403) return 'Contenido no disponible para este usuario. Revisa tu sesión.';
    if (error.status === 404) return 'El archivo ya no está disponible.';
    return 'No fue posible obtener el archivo. Revisa tu conexión e intenta nuevamente.';
  }
  return error instanceof Error ? error.message : 'No fue posible obtener el archivo. Intenta nuevamente.';
}
@Injectable({ providedIn: 'root' })
export class MaterialFilesService {
  private readonly native = inject(MATERIAL_FILES_NATIVE);
  private readonly materials = inject(MaterialsService);
  private readonly repository = inject(MATERIALS_REPOSITORY);
  private readonly session = inject(SessionService);
  readonly detailPath = '/materiales';
  readonly progressPrefix = 'material.';
  private scope(): string { const u = this.session.user(); return `${u?.id_usuario}:${u?.rol}:${u?.id_semestre}`; }
  private checkScope(scope: string): void { if (this.scope() !== scope) throw new HttpErrorResponse({ status: 403 }); }
  private resource(id: number): Observable<ComplementaryMaterial & { url: string }> {
    return this.materials.detail(id).pipe(switchMap(material => {
      if (!material) return throwError(() => new HttpErrorResponse({ status: 403 }));
      if (!this.safeUrl(material.url)) return throwError(() => new Error('El material no tiene un archivo disponible.'));
      return from([material as ComplementaryMaterial & { url: string }]);
    }));
  }
  safeUrl(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'res.cloudinary.com' && !u.username && !u.password && (!u.port || u.port === '443') && /\/(image|video|raw)\/upload\//.test(u.pathname); } catch { return false; }
  }
  private blob(material: ComplementaryMaterial & { url: string }): Observable<{ blob: Blob; name: string; mime: string }> {
    const scope = this.scope();
    // El interceptor institucional no envía credenciales a Cloudinary. No se modifican URLs ni firmas.
    return this.repository.file(material.url).pipe(timeout(120000), switchMap(response => from((async () => {
      this.checkScope(scope);
      const blob = response.body;
      if (!blob || blob.size > 100 * 1024 * 1024) throw new Error('Archivo vacío o demasiado grande.');
      const info = validateMaterialBytes(new Uint8Array(await blob.slice(0, 512).arrayBuffer()), material.tipo, response.headers.get('Content-Type') ?? blob.type);
      return { blob: blob.slice(0, blob.size, info.mime), mime: info.mime, name: materialFileName(material.url, material.titulo, info.extension, response.headers.get('Content-Disposition') ?? '') };
    })())));
  }
  pdf(id: number): Observable<{ data: ArrayBuffer; titulo: string }> {
    return this.resource(id).pipe(switchMap(material => {
      if (material.tipo !== 'PDF') return throwError(() => new Error('El material no es un PDF.'));
      return this.blob(material).pipe(switchMap(file => from(file.blob.arrayBuffer())), map(data => ({ data, titulo: material.titulo })));
    }));
  }
  preview(id: number): Observable<{ material: ComplementaryMaterial; url: string; mime: string }> {
    return this.resource(id).pipe(switchMap(material => {
      const scope = this.scope();
      if (material.tipo !== 'IMAGEN' && material.tipo !== 'VIDEO') return throwError(() => new Error('Este formato requiere una aplicación compatible. Puedes descargarlo desde el detalle.'));
      if (Capacitor.getPlatform() === 'android') {
        return defer(() => from(this.native.probe({ url: material.url, title: material.titulo, kind: material.tipo }))).pipe(map(info => {
          this.checkScope(scope); return { material, url: material.url, mime: info.mime };
        }));
      }
      if (material.tipo === 'IMAGEN') return this.blob(material).pipe(map(file => ({ material, url: URL.createObjectURL(file.blob), mime: file.mime })));
      return this.repository.fileStart(material.url).pipe(timeout(45000), map(response => {
        this.checkScope(scope);
        const info = validateMaterialBytes(new Uint8Array(response.body ?? new ArrayBuffer(0)), material.tipo, response.headers.get('Content-Type') ?? '');
        return { material, url: material.url, mime: info.mime };
      }));
    }));
  }
  async download(id: number, signal: AbortSignal): Promise<DownloadedMaterial | null> {
    const material = await firstValueFrom(this.resource(id));
    if (signal.aborted) throw new Error('Descarga cancelada.');
    const scope = this.scope();
    if (Capacitor.getPlatform() === 'android') {
      const requestId = crypto.randomUUID();
      const cancel = () => { void this.native.cancel({ requestId }).catch(() => undefined); };
      signal.addEventListener('abort', cancel, { once: true });
      try {
        const result = await this.native.download({ url: material.url, title: material.titulo, kind: material.tipo, requestId });
        this.checkScope(scope); return result;
      } finally { signal.removeEventListener('abort', cancel); }
    }
    const file = await firstValueFrom(this.blob(material));
    if (signal.aborted) throw new Error('Descarga cancelada.');
    this.checkScope(scope);
    const url = URL.createObjectURL(file.blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = file.name;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return null; // El navegador decide dónde guardar; no se afirma que ya terminó.
  }
  async open(file: DownloadedMaterial): Promise<void> { await this.native.open({ uri: file.uri, mime: file.mime }); }
}
