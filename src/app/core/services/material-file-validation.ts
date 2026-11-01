export interface ValidatedFile { mime: string; extension: string; }
const INVALID = 'El servidor no devolvió un archivo válido o el formato no coincide con el material.';
/** Se valida contenido, no solamente Content-Type: Cloudinary raw puede usar octet-stream. */
export function validateMaterialBytes(bytes: Uint8Array, kind: string, contentType = ''): ValidatedFile {
  const type = contentType.split(';')[0].trim().toLowerCase();
  const text = new TextDecoder().decode(bytes.subarray(0, 128)).trimStart().toLowerCase();
  if (!bytes.length || (/html|json/.test(type) || type === 'application/xml' || type === 'text/xml' || type.endsWith('+xml')) || /^(<!doctype|<html|<\?xml|\{|\[)/.test(text)) throw new Error(INVALID);
  const at = (value: number[], offset = 0) => value.every((n, i) => bytes[offset + i] === n);
  const ascii = (value: string, offset = 0) => at([...value].map(c => c.charCodeAt(0)), offset);
  let mime = '', extension = '', group = '';
  if (ascii('%PDF-')) { mime = 'application/pdf'; extension = 'pdf'; group = 'PDF'; }
  else if (at([0xff, 0xd8, 0xff])) { mime = 'image/jpeg'; extension = 'jpg'; group = 'IMAGEN'; }
  else if (at([137, 80, 78, 71, 13, 10, 26, 10])) { mime = 'image/png'; extension = 'png'; group = 'IMAGEN'; }
  else if (ascii('RIFF') && ascii('WEBP', 8)) { mime = 'image/webp'; extension = 'webp'; group = 'IMAGEN'; }
  else if (ascii('ftyp', 4)) { extension = ascii('qt', 8) ? 'mov' : 'mp4'; mime = extension === 'mov' ? 'video/quicktime' : 'video/mp4'; group = 'VIDEO'; }
  else if (at([0x1a, 0x45, 0xdf, 0xa3])) { mime = 'video/webm'; extension = 'webm'; group = 'VIDEO'; }
  else if (at([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    const office: Record<string, [string, string]> = { WORD: ['application/msword', 'doc'], EXCEL: ['application/vnd.ms-excel', 'xls'], PPT: ['application/vnd.ms-powerpoint', 'ppt'] };
    if (office[kind]) { [mime, extension] = office[kind]; group = kind; }
  } else if (at([0x50, 0x4b, 3, 4]) || at([0x50, 0x4b, 5, 6]) || at([0x50, 0x4b, 7, 8])) {
    const office: Record<string, [string, string]> = {
      WORD: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
      EXCEL: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'],
      PPT: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx'],
    };
    [mime, extension] = office[kind] ?? ['application/zip', 'zip']; group = office[kind] ? kind : 'ZIP';
  } else if (ascii('Rar!', 0)) { mime = 'application/vnd.rar'; extension = 'rar'; group = 'ZIP'; }
  else if (at([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) { mime = 'application/x-7z-compressed'; extension = '7z'; group = 'ZIP'; }
  if (!mime || (group !== kind && kind !== 'OTRO')) throw new Error(INVALID);
  return { mime, extension };
}
export function materialFileName(url: string, title: string, extension: string, disposition = ''): string {
  let name = '';
  const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const plain = /filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i.exec(disposition);
  try { name = encoded ? decodeURIComponent(encoded) : plain?.[1] ?? plain?.[2] ?? decodeURIComponent(new URL(url).pathname.split('/').pop() ?? ''); } catch { name = title; }
  const clean = (value: string) => value.replace(/[\\/\x00-\x1f:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
  const stripExtensions = (value: string) => value.replace(/(?:\.(?:pdf|docx?|xlsx?|pptx?|png|jpe?g|webp|mp4|webm|mov|zip|rar|7z))+$/i, '');
  name = clean(name);
  const suffix = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  const actualExtension = extension === 'jpg' && suffix === 'jpeg' ? 'jpeg' : extension;
  let base = stripExtensions(name);
  const generic = /^(archivo|file|documento?|material|recurso|download|descarga|imagen|image|video|untitled|sin[_ -]?t[ií]tulo)([_ -]*\d+)?$/i;
  const identifier = /^(?:\d+|[a-f0-9]{16,}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i;
  const opaque = /^[a-z0-9]{20,}$/i.test(base) && /\d/.test(base);
  if (!base || generic.test(base) || identifier.test(base) || opaque) base = stripExtensions(clean(title)) || 'material';
  // Una única extensión, obtenida del formato validado; el título también puede incluirla.
  return base.slice(0, 170) + '.' + actualExtension;
}
