// services/comunica/persist.ts
//
// Qué parte de la caché de consultas se guarda en el móvil (plan 01 §3), sin
// React: lo usa `ComunicaAreaProvider` y lo prueban los guardarraíles.

import {
  dehydrate,
  type DehydratedState,
  type QueryClient,
} from '@tanstack/react-query';
import { ROUTES } from './contract';
import { logger } from '@/utils/logger';

/**
 * Las lecturas del contrato que nunca se guardan (`persist: false`): la salud
 * y los datos personales. Sus claves llevan ese nombre (`GRUPOS_KEYS`), y se
 * excluyen aunque una consulta llegue marcada por error con `persist: true`.
 */
export const NEVER_STORED: ReadonlySet<string> = new Set(
  Object.entries(ROUTES)
    .filter(([, r]) => r.method === 'GET' && !r.persist)
    .map(([name]) => name),
);

/** Solo se guarda lo que es de guardar: `meta.persist` y con datos. */
export function dehydrateArea(qc: QueryClient): DehydratedState {
  return dehydrate(qc, {
    shouldDehydrateQuery: (q) =>
      q.state.status === 'success' &&
      q.meta?.persist === true &&
      !q.queryKey.some((k) => typeof k === 'string' && NEVER_STORED.has(k)),
  });
}

/**
 * Lo que cabe en una fila del almacén. En Android, AsyncStorage no lee una
 * fila de más de ~2 MB (CursorWindow): con menos de un millón de caracteres
 * hay margen aunque haya acentos.
 */
export const MAX_SAVED_CHARS = 1_000_000;

/** Una ficha, con o sin la delegación de trabajo delante (`d:<id>`, plan 17). */
const isFicha = (key: readonly unknown[]) => {
  const k =
    typeof key[1] === 'string' && key[1].startsWith('d:') ? key.slice(1) : key;
  return k[1] === 'grupos' && k[2] === 'person';
};

/**
 * Si la caché no cabe, se quitan fichas (de la más vieja a la más nueva) hasta
 * que quepa: mejor perder unas fichas precargadas que la caché entera.
 */
export function fitForStorage(
  state: DehydratedState,
  max = MAX_SAVED_CHARS,
): DehydratedState {
  if (JSON.stringify(state).length <= max) return state;
  const keep = state.queries.filter((q) => !isFicha(q.queryKey));
  const fichas = state.queries
    .filter((q) => isFicha(q.queryKey))
    .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt);
  let total = JSON.stringify({ ...state, queries: keep }).length;
  const queries = [...keep];
  for (const q of fichas) {
    const size = JSON.stringify(q).length + 1;
    if (total + size > max) break;
    queries.push(q);
    total += size;
  }
  logger.warn(
    '[comunica] caché grande: fichas sin guardar',
    fichas.length - (queries.length - keep.length),
  );
  return { ...state, queries };
}
