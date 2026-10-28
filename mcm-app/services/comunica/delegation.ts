// services/comunica/delegation.ts
//
// La DELEGACIÓN DE TRABAJO (plan 17; `sticpa_pl_delegation()` del plugin,
// 23/10/2026): quien colabora con otra delegación además de la suya (coordina
// Burriana siendo de Castellón) elige en un selector con cuál trabaja. Todo lo
// de equipo —Pasar Lista, Grupos y fichas, Coordinación, eventos— va con ella;
// lo personal (su ficha, sus inscripciones), con la de su ficha.
//
//   · Vive en memoria y se guarda en el cajón de la persona (no es secreta);
//     «Salir» la borra con el resto.
//   · `null` = la de la ficha (el servidor la pone sola sin cabecera).
//   · Cada escritura de la cola sube con la delegación con la que se hizo,
//     aunque luego se cambie el selector (`withWriteDelegation`): una lista de
//     Burriana se escribe en Burriana. Solo afecta a ESCRITURAS: las lecturas
//     van siempre con la de trabajo, también mientras sube la cola.

let working: string | null = null;
let writeOverride: { id: string | null } | null = null;
const listeners = new Set<() => void>();

export const DELEGATION_HEADER = 'X-Comunica-Delegation';

export function getWorkingDelegation(): string | null {
  return working;
}

export function setWorkingDelegation(id: string | null): void {
  if (id === working) return;
  working = id;
  listeners.forEach((l) => l());
}

export function subscribeWorkingDelegation(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** La delegación que lleva una petición (las escrituras de la cola, la suya). */
export function delegationForRequest(write: boolean): string | null {
  return write && writeOverride ? writeOverride.id : working;
}

/**
 * Sube una escritura con la delegación con la que se hizo. La cola sube de
 * una en una, así que no se pisan entre ellas.
 */
export async function withWriteDelegation<T>(
  id: string | null | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (id === undefined) return fn();
  const prev = writeOverride;
  writeOverride = { id };
  try {
    return await fn();
  } finally {
    writeOverride = prev;
  }
}

/**
 * Rutas que NO son de equipo (no llevan la cabecera): entrar, lo personal y el
 * móvil. Las de familias (`/v1/me/profiles` y `/v1/profiles/…`, planes 11-16)
 * tampoco: van con la delegación de la ficha.
 */
const PERSONAL = [
  /^\/v1\/auth\//,
  /^\/v1\/me\/(monitor|documents|profiles)/,
  /^\/v1\/devices/,
  /^\/v1\/profiles\//,
  /^\/v1\/web-pass/,
];

export const isTeamPath = (path: string) =>
  path.startsWith('/v1/') && !PERSONAL.some((re) => re.test(path));

/** Los bloques de la caché que dependen de la delegación de trabajo. */
export const TEAM_BLOCKS: readonly string[] = [
  'me',
  'pasar-lista',
  'grupos',
  'coordination',
  'events',
];
