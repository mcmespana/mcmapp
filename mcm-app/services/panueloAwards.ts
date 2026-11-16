// De dónde salen las piezas del pañuelo por asistencia.
//
// La verdad de estas piezas será `/panueloAwards/{personId}`, que escribe SOLO
// la Cloud Function `panueloClaimAttendance` (fases F2–F4 de
// `docs/planes/PLAN_PANUELO_ASISTENCIA.md`). Mientras no exista, la única
// fuente es la **SIMULACIÓN del Laboratorio Alpha**: un sustituto LOCAL,
// guardado en este móvil (`@panuelo_awards_simulados`), con la misma forma que
// ese nodo. Las piezas que se simulan son de mentira (las de asistencia de
// `constants/panueloEjemplo.json`, atadas a los eventos del servidor falso de
// Comunica) y solo existen en el catálogo mientras hay simulación.
//
// Para F4 solo cambia `loadAwards`: el resto de la app (reflejo, retiradas,
// desvelado) ya lee de aquí.
//
// Documentación: `docs/funcionalidades/PANUELO.md` («Piezas por asistencia»).

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_PANUELO_CATALOG,
  EXAMPLE_PANUELO_CATALOG,
} from '@/constants/panueloCatalog';
import type { PanueloAward, PanueloCatalog } from '@/types/panuelo';
import { logger } from '@/utils/logger';
import { isAttendancePiece, sanitizeAwards } from '@/utils/panuelo';
import {
  computeAwards,
  type AttendanceDay,
  type AttendedEvents,
} from '@/utils/panueloAttendance';

/** ⚠️ SIMULACIÓN (Laboratorio Alpha). No es lo que dice el servidor. */
export const PANUELO_AWARDS_SIM_KEY = '@panuelo_awards_simulados';

/** Lo que se sabe hoy de las piezas por asistencia de quien usa el móvil. */
export interface PanueloAwardsSnapshot {
  /** Lo concedido, como `/panueloAwards/{personId}`. */
  awards: Record<string, PanueloAward>;
  /** Piezas que solo existen mientras dura la simulación (si no, vacío). */
  catalog: PanueloCatalog;
}

interface SimStore {
  /** Las marcas «que daría el CRM», por evento. */
  attended: AttendedEvents;
  /** Lo que «escribiría la función». */
  awards: Record<string, PanueloAward>;
}

/** Las piezas de mentira que se pueden simular. */
export const SIMULATED_PIECES: PanueloCatalog = Object.fromEntries(
  Object.entries(EXAMPLE_PANUELO_CATALOG).filter(([, item]) =>
    isAttendancePiece(item),
  ),
);

/** Un evento que se puede simular desde el Laboratorio. */
export interface SimulatedEvent {
  id: string;
  /** Lo que se lee en el botón: el origen de su pieza. */
  name: string;
  /** Las piezas que da. */
  pieces: string[];
}

/**
 * Los eventos de las piezas por asistencia: las de mentira y, si el catálogo
 * de verdad ya tiene alguna, también las suyas (así se prueba la de verdad
 * antes de que exista el servidor).
 */
export function simulatedEvents(
  catalog: PanueloCatalog = DEFAULT_PANUELO_CATALOG,
): SimulatedEvent[] {
  const byEvent = new Map<string, SimulatedEvent>();
  for (const item of Object.values({ ...SIMULATED_PIECES, ...catalog })) {
    if (item.grant?.type !== 'attendance') continue;
    for (const id of item.grant.events) {
      const event = byEvent.get(id) ?? {
        id,
        name: item.origin ?? item.name,
        pieces: [],
      };
      event.pieces.push(item.id);
      byEvent.set(id, event);
    }
  }
  return [...byEvent.values()];
}

async function readSim(): Promise<SimStore | null> {
  const raw = await AsyncStorage.getItem(PANUELO_AWARDS_SIM_KEY);
  if (!raw) return null;
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') return null;
  const store = parsed as Partial<SimStore>;
  return {
    attended:
      store.attended && typeof store.attended === 'object'
        ? store.attended
        : {},
    awards: sanitizeAwards(store.awards),
  };
}

/**
 * Las piezas por asistencia de quien usa el móvil. `null` = no se ha podido
 * saber: quien llama NO debe quitar nada (sin red no se retira ninguna pieza).
 */
export async function loadAwards(): Promise<PanueloAwardsSnapshot | null> {
  // F4: aquí entra el servidor. Con sesión (uid) y el catálogo con alguna
  // pieza `attendance`: reclamar con la callable `panueloClaimAttendance`
  // (pista: `Me.personId` de la sesión de Comunica, NUNCA la ficha de
  // «Viendo a»), leer `/panueloAccounts/{uid}` y luego
  // `/panueloAwards/{personId}`, y devolver `{ awards, catalog: {} }`. Si no
  // se puede leer, `null`. La simulación se queda para el Laboratorio.
  try {
    const sim = await readSim();
    if (!sim) return { awards: {}, catalog: {} };
    return { awards: sim.awards, catalog: SIMULATED_PIECES };
  } catch (err) {
    logger.warn(
      '[Pañuelo] las piezas por asistencia no se pudieron leer:',
      err,
    );
    return null;
  }
}

/** Recalcula lo concedido como lo haría la función, y lo guarda. */
async function writeSim(
  change: (attended: AttendedEvents) => AttendedEvents,
): Promise<{ granted: string[]; revoked: string[] }> {
  const before = (await readSim()) ?? { attended: {}, awards: {} };
  const attended = change({ ...before.attended });
  const result = computeAwards(
    { ...SIMULATED_PIECES, ...DEFAULT_PANUELO_CATALOG },
    attended,
    before.awards,
    Date.now(),
  );
  await AsyncStorage.setItem(
    PANUELO_AWARDS_SIM_KEY,
    JSON.stringify({ attended, awards: result.awards }),
  );
  return { granted: result.granted, revoked: result.revoked };
}

/** «Hoy», como lo escribe el CRM: `AAAA-MM-DD` en la hora del móvil. */
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Simula que a esta persona le pasan lista («Sí») en ese evento. */
export function simulateAttendance(eventId: string) {
  const mark: AttendanceDay = { day: today(), mark: 'yes' };
  return writeSim((attended) => ({ ...attended, [eventId]: [mark] }));
}

/** Simula que corrigen la lista de ese evento: la marca pasa a «No». */
export function simulateCorrection(eventId: string) {
  return writeSim((attended) => ({
    ...attended,
    [eventId]: (attended[eventId] ?? [{ day: today(), mark: 'yes' }]).map(
      (d) => ({ ...d, mark: 'no_unjustified' as const }),
    ),
  }));
}

/** Los eventos que ahora mismo «tienen marca» en la simulación. */
export async function simulatedAttended(): Promise<string[]> {
  const sim = await readSim().catch(() => null);
  return Object.entries(sim?.attended ?? {})
    .filter(([, days]) =>
      days.some((d) => d.mark === 'yes' || d.mark === 'partial'),
    )
    .map(([id]) => id);
}

/** Borra la simulación entera: sus piezas se van sin aviso. */
export async function clearSimulation(): Promise<void> {
  await AsyncStorage.removeItem(PANUELO_AWARDS_SIM_KEY);
}
