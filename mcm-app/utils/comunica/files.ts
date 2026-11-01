// utils/comunica/files.ts
//
// Archivos que se suben o se abren (plan 16), PURO: la extensión, el tipo MIME, el nombre seguro y la validación ANTES de enviar (como el handler del plugin
// antes de escribir, `stic-action.php` l. 255-262). El servidor vuelve a mirar todo: aquí solo se evita ir y volver con un archivo que se sabe malo.
//
//   · Más de 0 bytes y 4 MB como mucho (lo que cabe en una función de Vercel; el plugin dejaba 6) y una extensión de la lista, sin SVG ni HTML.
//   · Los certificados (plan 09) tienen su propia lista más corta (`pdf, jpg, jpeg, png`): no es esta.

export const MAX_FILE_BYTES = 4 * 1024 * 1024;

/** Las extensiones de un documento (`stic-security.php` l. 475-478), sin SVG ni HTML. */
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

export const FILE_ERRORS = {
  empty: 'El archivo está vacío',
  tooBig: 'Ese archivo pesa más de 4 MB',
  badType: 'Ese tipo de archivo no se puede subir',
} as const;

/** La extensión en minúsculas, o `null` si no hay una que valga (más de 5 caracteres o con algo que no es letra o cifra). */
export function fileExtension(name: string): string | null {
  const m = /\.([^./\\]+)$/.exec(name.trim());
  if (!m) return null;
  const ext = m[1].toLowerCase();
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : null;
}

/** El problema de un archivo antes de enviarlo, o `null` si vale. */
export function fileProblem(
  file: { name: string; size: number },
  allowed: readonly string[] = DOCUMENT_EXTENSIONS,
): string | null {
  if (!(file.size > 0)) return FILE_ERRORS.empty;
  if (file.size > MAX_FILE_BYTES) return FILE_ERRORS.tooBig;
  const ext = fileExtension(file.name);
  if (!ext || !allowed.includes(ext)) return FILE_ERRORS.badType;
  return null;
}

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  heic: 'image/heic',
  webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  odt: 'application/vnd.oasis.opendocument.text',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  txt: 'text/plain',
};
export const mimeOf = (name: string): string =>
  MIME[fileExtension(name) ?? ''] ?? 'application/octet-stream';

const IMAGE = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);
/** Una imagen que `expo-image` enseña tal cual (HEIC, no: se comparte). */
export const isImageFile = (name: string) =>
  IMAGE.has(fileExtension(name) ?? '');
export const isPdfFile = (name: string) => fileExtension(name) === 'pdf';

/** Un nombre de archivo seguro para la caché: sin rutas, sin caracteres raros y con su extensión. */
export function safeFileName(name: string, fallback = 'archivo'): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const clean = base
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^[._]+/, '')
    .slice(0, 80);
  return clean || fallback;
}

/** El nombre propuesto al elegir un archivo: el del archivo sin extensión («Informe final.PDF» → «Informe final»). */
export function defaultDocumentName(fileName: string): string {
  const ext = fileExtension(fileName);
  const base = ext
    ? fileName.slice(0, fileName.length - ext.length - 1)
    : fileName;
  return base.replace(/[_]+/g, ' ').trim();
}
