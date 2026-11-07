/**
 * Identidad de un **coro** (la "entidad" de la que cuelgan las playlists y la
 * sesión en vivo).
 *
 * Un coro se identifica con una clave legible derivada de su nombre más un
 * sufijo aleatorio: `consolacion-castellon-4f2a`. Eso da tres cosas a la vez:
 *
 *  1. Es una clave válida de Realtime Database (sin `. $ # [ ] /`).
 *  2. Se puede leer en una URL (`/playlist?coro=consolacion-castellon-4f2a`)
 *     sin que parezca un identificador opaco.
 *  3. Nunca colisiona con un **código de playlist** de 4 dígitos: todos los
 *     ids de coro llevan al menos un guion, y los códigos son solo dígitos.
 *     Gracias a eso, `/choirSessions/<clave>` puede almacenar indistintamente
 *     sesiones de coro (clave = id del coro) y sesiones sueltas por código
 *     (clave = 4 dígitos) sin ambigüedad.
 *
 * Todo aquí es lógica pura y sin dependencias, para poder testearla.
 */

/** Longitud máxima de la parte "slug" del id (sin contar el sufijo). */
const MAX_SLUG_LENGTH = 32;

/** Nombre de coro más largo que aceptamos al crear. */
export const MAX_CHOIR_NAME_LENGTH = 60;

/**
 * Limpia el nombre tal cual lo escribe el usuario: sin espacios sobrantes ni
 * saltos de línea, y recortado a `MAX_CHOIR_NAME_LENGTH`.
 */
export function normalizeChoirName(raw: string): string {
  return (raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CHOIR_NAME_LENGTH);
}

/** Quita acentos/diacríticos: «Castellón» → «Castellon». */
function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Clave de comparación de nombres, para detectar duplicados: «Coro Consolación
 * Castellón», «coro consolacion castellon» y «CORO  CONSOLACION-CASTELLON»
 * comparten `nameKey`. Se guarda junto al coro para poder avisar de que ya
 * existe en vez de crear un tercer «Coro de Madrid».
 */
export function choirNameKey(name: string): string {
  return stripDiacritics(normalizeChoirName(name))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
}

/** Sufijo aleatorio de 4 caracteres (base 36) que hace único al id. */
function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6).padEnd(4, '0');
}

/**
 * Construye el id de un coro a partir de su nombre. `randomPart` se puede
 * inyectar en los tests para tener ids deterministas.
 */
export function makeChoirId(name: string, randomPart?: string): string {
  const slug = choirNameKey(name)
    .slice(0, MAX_SLUG_LENGTH)
    // Un guion final (por el recorte) daría un id feo tipo `coro-de-`.
    .replace(/-+$/, '');
  const base = slug || 'coro';
  return `${base}-${randomPart ?? randomSuffix()}`;
}

/**
 * ¿Es `key` un id de coro bien formado? Exigimos el guion a propósito: es lo
 * que garantiza que jamás se confunda con un código de 4 dígitos.
 */
export function isChoirId(key: string): boolean {
  if (typeof key !== 'string') return false;
  if (key.length < 3 || key.length > 48) return false;
  if (!key.includes('-')) return false;
  return /^[a-z0-9]+(-[a-z0-9]+)+$/.test(key);
}
