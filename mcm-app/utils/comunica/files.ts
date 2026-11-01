// utils/comunica/files.ts
//
// Los archivos del área (plan 16), puro: qué se puede subir, qué tipo es por
// su extensión y cómo se abre. Origen: `sticpa_document_kind()` y
// `sticpa_upload_is_acceptable()` del plugin, con el tope del middleware
// (`comunicaMiddleware:src/app/profile-docs-write.ts`): 4 MB, lo que cabe en
// Vercel, no los 6 del plugin. Manda el servidor.

/** `DOCUMENT_EXTENSIONS` del middleware (la lista del plugin, sin SVG ni HTML). */
export const DOCUMENT_EXTENSIONS = [
  'pdf',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'heic',
  'webp',
  'doc',
  'docx',
  'odt',
  'xls',
  'xlsx',
  'ods',
  'txt',
] as const;

/** El tope de subida de documentos (`MAX_FILE_BYTES` del middleware). */
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  txt: 'text/plain',
};

/** La extensión en minúsculas, o `null` si no la hay. */
export function extensionOf(name: string | null | undefined): string | null {
  const n = (name ?? '').trim();
  const dot = n.lastIndexOf('.');
  if (dot <= 0 || dot === n.length - 1) return null;
  return n.slice(dot + 1).toLowerCase();
}

/** El nombre sin la extensión («Autorización.pdf» → «Autorización»). */
export function baseName(name: string): string {
  const ext = extensionOf(name);
  return (ext ? name.slice(0, -(ext.length + 1)) : name).trim();
}

/**
 * `sticpa_document_kind()`: el tipo en tres o cuatro letras para la cápsula
 * («PDF», «JPG», «DOC»…). Sin extensión reconocible, `''` (la cápsula pinta
 * el icono de archivo).
 */
export function documentKind(fileName: string | null | undefined): string {
  const ext = extensionOf(fileName);
  if (!ext || ext.length > 4 || !/^[a-z0-9]+$/.test(ext)) return '';
  const FAMILY: Record<string, string> = {
    jpg: 'JPG',
    jpeg: 'JPG',
    docx: 'DOC',
    xlsx: 'XLS',
    pptx: 'PPT',
  };
  return FAMILY[ext] ?? ext.toUpperCase();
}

/** El tipo MIME por la extensión (como lo sirve el middleware). */
export function mimeOfName(name: string | null | undefined): string {
  return MIME[extensionOf(name) ?? ''] ?? 'application/octet-stream';
}

export type DocumentFileProblem = 'empty' | 'too_big' | 'bad_type';

export const DOCUMENT_FILE_PROBLEM_TEXT: Record<DocumentFileProblem, string> = {
  empty: 'Ese archivo está vacío.',
  too_big: 'Ese archivo pesa más de 4 MB.',
  bad_type: 'Ese tipo de archivo no se puede subir.',
};

/**
 * Por qué no vale un documento, o `null`. Se mira ANTES de enviar, como el
 * servidor antes de escribir: extensión de la lista, más de 0 bytes y 4 MB
 * como mucho.
 */
export function documentFileProblem(f: {
  name: string;
  size: number;
}): DocumentFileProblem | null {
  const ext = extensionOf(f.name);
  if (!ext || !(DOCUMENT_EXTENSIONS as readonly string[]).includes(ext)) {
    return 'bad_type';
  }
  if (!(f.size > 0)) return 'empty';
  if (f.size > MAX_DOCUMENT_BYTES) return 'too_big';
  return null;
}

/** Nombre listo para subir: si la cámara no lo da, uno por el tipo. */
export function documentUploadName(
  name: string | null | undefined,
  mimeType: string | null | undefined,
): { name: string; mimeType: string } {
  const n = (name ?? '').trim();
  if (n && extensionOf(n)) return { name: n, mimeType: mimeOfName(n) };
  const ext = Object.keys(MIME).find((k) => MIME[k] === mimeType);
  const base = n || 'documento';
  return ext
    ? { name: `${base}.${ext}`, mimeType: MIME[ext] }
    : { name: base, mimeType: mimeType || 'application/octet-stream' };
}

/**
 * Cómo se abre un archivo (regla C1): imagen y PDF, en el visor de la app
 * (PDF en web, en una pestaña nueva); PDF en Android y lo demás, con la hoja
 * del sistema («Abrir con…» / compartir).
 */
export type OpenMode = 'image' | 'pdf' | 'tab' | 'system';

export function openModeOf(
  mimeType: string,
  platform: 'ios' | 'android' | 'web' | string,
): OpenMode {
  const m = mimeType.toLowerCase();
  const image = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (image.includes(m)) return 'image';
  if (m === 'application/pdf') {
    if (platform === 'web') return 'tab';
    return platform === 'ios' ? 'pdf' : 'system';
  }
  return platform === 'web' ? 'tab' : 'system';
}

/** El UTI de iOS para la hoja de compartir. */
export function utiOf(mimeType: string): string | undefined {
  const UTI: Record<string, string> = {
    'application/pdf': 'com.adobe.pdf',
    'image/jpeg': 'public.jpeg',
    'image/png': 'public.png',
    'image/gif': 'com.compuserve.gif',
    'image/heic': 'public.heic',
    'text/plain': 'public.plain-text',
  };
  return UTI[mimeType.toLowerCase()];
}
