/**
 * ¿El `updatedAt` remoto de un nodo `{ updatedAt, data }` es más nuevo que el
 * que tengo en caché?
 *
 * Antes se comparaba como texto (`local === remoto`): cualquier diferencia
 * —también un valor MÁS VIEJO, o el mismo instante en otra unidad— bajaba el
 * nodo entero. En `songs` eso es el cantoral completo en cada móvil.
 *
 * En Firebase conviven varios formatos (ver los contratos con el panel):
 * milisegundos (número o texto), segundos (el CI del cantoral), ISO
 * (`new Date().toISOString()`) y contadores pequeños de las semillas (`"1"`).
 * Se normaliza todo a milisegundos: un número por debajo de 1e11 se toma como
 * segundos (1e11 ms es marzo de 1973; 1e11 s, el año 5138). Si alguno de los
 * dos no se entiende (p. ej. `'fixture'`), se vuelve a la regla de siempre:
 * distinto = nuevo, para no quedarse nunca con datos viejos por un formato raro.
 */
const SECONDS_THRESHOLD = 1e11;

export function updatedAtToMs(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return value < SECONDS_THRESHOLD ? value * 1000 : value;
  }
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return updatedAtToMs(Number(trimmed));
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

export function isRemoteUpdatedAtNewer(
  local: unknown,
  remote: unknown,
): boolean {
  const localMs = updatedAtToMs(local);
  const remoteMs = updatedAtToMs(remote);
  if (localMs !== null && remoteMs !== null) return remoteMs > localMs;
  return String(local ?? '') !== String(remote ?? '');
}
