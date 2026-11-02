import { InjectionToken } from '@angular/core';
import { registerPlugin } from '@capacitor/core';
export interface DownloadedMaterial { uri: string; name: string; mime: string; location: string; }
export interface MaterialFileInfo { name: string; mime: string; }
export interface MaterialFilesPlugin {
  probe(options: { url: string; title: string; kind: string }): Promise<MaterialFileInfo>;
  download(options: { url: string; title: string; kind: string; requestId: string }): Promise<DownloadedMaterial>;
  cancel(options: { requestId: string }): Promise<void>;
  open(options: { uri: string; mime: string }): Promise<void>;
}
export const MaterialFiles = registerPlugin<MaterialFilesPlugin>('MaterialFiles');

/**
 * Se entrega un objeto simple con los cuatro métodos del plugin: el proxy de Capacitor responde a cualquier
 * nombre (por ejemplo ngOnDestroy) y Angular lo trataría como un servicio con ciclo de vida.
 */
export const MATERIAL_FILES_NATIVE = new InjectionToken<MaterialFilesPlugin>('MATERIAL_FILES_NATIVE', {
  providedIn: 'root',
  factory: () => ({
    probe: options => MaterialFiles.probe(options),
    download: options => MaterialFiles.download(options),
    cancel: options => MaterialFiles.cancel(options),
    open: options => MaterialFiles.open(options),
  }),
});
