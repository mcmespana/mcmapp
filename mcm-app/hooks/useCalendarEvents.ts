import { logger } from '@/utils/logger';
import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { getDatabase, ref, get } from 'firebase/database';
import { getFirebaseApp } from '@/utils/firebaseApp';
import {
  buildEventsByDate,
  localizeEvents,
  parseICS,
  type CalendarEvent,
  type ParsedEvent,
  type PortableEvent,
} from '@/utils/icsParser';
import type { CalendarConfig } from './useCalendarConfigs';

// El parser vive en `utils/icsParser.ts` (módulo puro, compartido con la Cloud
// Function que precachea los ICS). Se re-exporta aquí porque media app —y los
// tests— importan estos símbolos desde el hook desde antes de la extracción.
export {
  addDaysISO,
  buildEventsByDate,
  MAX_EVENT_DAYS,
  parseICS,
} from '@/utils/icsParser';
export type { CalendarEvent } from '@/utils/icsParser';

const CACHE_KEY = 'calendar_events';
/** Metadatos de la última expansión guardada en `CACHE_KEY`. */
const CACHE_META_KEY = 'calendar_events_meta';

/**
 * Nodo de Firebase que mantiene la Cloud Function `cacheCalendarIcs`
 * (`functions/src/index.ts`): los ICS ya descargados y parseados, cada pocas
 * horas. Ver `docs/funcionalidades/CALENDARIOS.md`.
 *
 *   /calendarEvents/meta = { updatedAt, checkedAt, calendarIds }
 *   /calendarEvents/data = { <calendarId>: { events: PortableEvent[] } }
 */
const NODE = 'calendarEvents';

/**
 * Si el cron lleva más de esto sin dar señales de vida (`meta.checkedAt`), no
 * nos fiamos del nodo y bajamos los ICS directamente. La función corre cada 2 h,
 * así que 24 h son doce fallos seguidos: a esas alturas el problema es el cron,
 * y es mejor un calendario lento que un calendario de la semana pasada.
 *
 * Ojo: se mira `checkedAt`, NO `updatedAt`. La función solo reescribe
 * `updatedAt` cuando el contenido cambia de verdad (para no invalidar la caché
 * de todo el mundo cada 2 h), así que un `updatedAt` viejo es lo NORMAL y no
 * indica nada roto.
 */
const MAX_NODE_AGE_MS = 24 * 60 * 60 * 1000;

type CacheMeta = {
  /** `meta.updatedAt` del nodo con el que se construyó la caché pintada. */
  nodeUpdatedAt: string | null;
  /** IDs de calendario, en orden, con los que se construyó. */
  calendarIds: string[];
};

type CalendarFetchResult = {
  map: Record<string, CalendarEvent[]>;
  anyFailed: boolean;
};

type NodeMeta = {
  updatedAt?: unknown;
  checkedAt?: unknown;
  calendarIds?: unknown;
};

// Descarga + parseo de TODOS los calendarios, COALESCIDO por la lista de URLs:
// `useCalendarEvents` se monta a la vez en Home y en Calendario; sin esto cada
// instancia descargaba y parseaba todos los ICS por su cuenta. Dos monturas
// concurrentes con la misma lista comparten un único ciclo fetch+parse.
const calendarInflight = new Map<string, Promise<CalendarFetchResult>>();

/** Solo para tests: vacía el coalescer de calendarios y la ventana de frescura. */
export function __resetCalendarCacheForTests() {
  calendarInflight.clear();
  lastFullFetch.clear();
}

// Última descarga COMPLETA por lista de URLs. Dentro de la ventana, los
// montajes nuevos sirven caché sin relanzar la descarga (Home→Calendario→
// Home re-descargaba y re-parseaba todos los ICS). 5 min: los calendarios
// cambian a ritmo humano. Solo se registra cuando el fetch fue completo
// (`!anyFailed`) — un resultado parcial no cuenta como fresco.
const FRESH_WINDOW_MS = 5 * 60 * 1000;
const lastFullFetch = new Map<string, number>();

/**
 * Descarga y parsea UN calendario desde su ICS de origen.
 *
 * El proxy CORS es EXCLUSIVO de web: en iOS/Android no hay política de mismo
 * origen que sortear, y meter el salto igualmente costaba un round-trip entero
 * de más (el ICS de Google tarda ~1 s en generarse, así que el salto extra no
 * es gratis). Peor aún: si el proxy fallaba, el `catch` reintentaba directo y
 * el usuario pagaba DOS esperas de ~1 s.
 */
async function fetchOneCalendar(cfg: CalendarConfig): Promise<ParsedEvent[]> {
  const proxyBase =
    Platform.OS === 'web' ? process.env.EXPO_PUBLIC_CORS_PROXY_URL : undefined;
  const proxyUrl = proxyBase ? proxyBase + encodeURIComponent(cfg.url) : null;
  let res: Response | null = null;
  if (proxyUrl) {
    try {
      res = await fetch(proxyUrl);
      if (!res.ok) throw new Error('Proxy request failed');
    } catch {
      // Fallback to direct fetch if proxy fails
      res = await fetch(cfg.url);
    }
  } else {
    res = await fetch(cfg.url);
  }
  const text = await res.text();
  return parseICS(text);
}

/** `meta` del nodo → eventos localizados por ID de calendario, o `null`. */
function readNodeEvents(
  data: unknown,
  ids: string[],
): Record<string, ParsedEvent[]> {
  const out: Record<string, ParsedEvent[]> = {};
  if (!data || typeof data !== 'object') return out;
  const byId = data as Record<string, unknown>;

  for (const id of ids) {
    const entry = byId[id];
    if (!entry || typeof entry !== 'object') continue;
    const events = (entry as { events?: unknown }).events;
    if (!Array.isArray(events)) continue;
    // El nodo guarda eventos PORTABLES (sin localizar): la conversión a la
    // zona del dispositivo se hace aquí, nunca en el servidor.
    out[id] = localizeEvents(events as PortableEvent[]);
  }
  return out;
}

/**
 * Lee el nodo precacheado. Devuelve qué calendarios cubre y si hace falta
 * bajarse `data` (o basta con la caché ya pintada).
 *
 * Coste en el caso normal: UNA lectura de `meta` (un objeto de tres campos).
 * Si `meta.updatedAt` no ha cambiado desde la última expansión guardada y la
 * lista de calendarios es la misma, no se descarga nada más.
 */
async function readCachedNode(
  ids: string[],
  localMeta: CacheMeta | null,
): Promise<
  | { kind: 'unusable' }
  | { kind: 'cache-still-valid' }
  | { kind: 'fresh'; events: Record<string, ParsedEvent[]>; updatedAt: string }
> {
  const db = getDatabase(getFirebaseApp());

  const metaSnap = await get(ref(db, `${NODE}/meta`));
  if (!metaSnap.exists()) return { kind: 'unusable' };
  const meta = metaSnap.val() as NodeMeta;
  if (!meta || typeof meta !== 'object') return { kind: 'unusable' };

  const checkedAt =
    typeof meta.checkedAt === 'string' ? Date.parse(meta.checkedAt) : NaN;
  if (!Number.isFinite(checkedAt)) return { kind: 'unusable' };
  if (Date.now() - checkedAt > MAX_NODE_AGE_MS) {
    logger.warn(
      '[calendar] el nodo precacheado lleva demasiado sin actualizarse, bajando ICS',
      meta.checkedAt,
    );
    return { kind: 'unusable' };
  }

  // Sin `updatedAt` no hay forma de saber si la caché local sigue valiendo, y
  // convertirlo a la cadena "undefined" sería peor que no tenerlo: dos nodos
  // igual de rotos parecerían la misma versión y la caché nunca se refrescaría.
  if (typeof meta.updatedAt !== 'string' || !meta.updatedAt) {
    return { kind: 'unusable' };
  }
  const updatedAt = meta.updatedAt;

  const covered = Array.isArray(meta.calendarIds)
    ? meta.calendarIds.filter((x): x is string => typeof x === 'string')
    : [];
  // Si el nodo no cubre todos los calendarios que este usuario ve (p.ej. una
  // delegación acaba de añadir un `extraCalendar` que el cron aún no conoce),
  // no vale la vía rápida: hay que bajar los que falten por ICS.
  const coversAll = ids.every((id) => covered.includes(id));

  if (
    coversAll &&
    localMeta &&
    localMeta.nodeUpdatedAt === updatedAt &&
    localMeta.calendarIds.length === ids.length &&
    localMeta.calendarIds.every((id, i) => id === ids[i])
  ) {
    return { kind: 'cache-still-valid' };
  }

  const dataSnap = await get(ref(db, `${NODE}/data`));
  if (!dataSnap.exists()) return { kind: 'unusable' };
  const events = readNodeEvents(dataSnap.val(), ids);
  if (Object.keys(events).length === 0) return { kind: 'unusable' };

  return { kind: 'fresh', events, updatedAt };
}

/**
 * Consigue los eventos de todos los calendarios: nodo precacheado cuando
 * cubre, ICS directo para el resto, coalescido entre montajes simultáneos.
 */
function fetchAndParseCalendars(
  calendars: CalendarConfig[],
  prefetched: Record<string, ParsedEvent[]>,
): Promise<CalendarFetchResult> {
  const key = calendars.map((c) => c.url).join('|');
  const existing = calendarInflight.get(key);
  if (existing) return existing;

  const run = async (): Promise<CalendarFetchResult> => {
    let anyFailed = false;

    // Descarga en PARALELO (antes en serie: el tiempo total era la suma de
    // los round-trips en vez del máximo). Se preserva el índice posicional de
    // cada calendario, imprescindible para `calendarIndex`.
    const results = await Promise.allSettled(
      calendars.map((cfg) => {
        const ready = prefetched[cfg.id];
        return ready ? Promise.resolve(ready) : fetchOneCalendar(cfg);
      }),
    );

    const perCalendar = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      // Antes este catch era vacío: un calendario roto (o su fuente caída)
      // desaparecía sin rastro. Marcamos el fallo para no pisar la caché
      // buena con un resultado parcial (ver más abajo).
      anyFailed = true;
      logger.error(
        '[calendar] fallo cargando calendario',
        i,
        calendars[i].url,
        r.reason,
      );
      return undefined;
    });

    const map = buildEventsByDate(perCalendar, (ev) => {
      logger.warn(
        '[calendar] evento con rango absurdo, truncado',
        ev.startDate,
        ev.endDate,
        ev.title,
      );
    });

    if (!anyFailed) lastFullFetch.set(key, Date.now());
    return { map, anyFailed };
  };

  const promise = run().finally(() => {
    calendarInflight.delete(key);
  });
  calendarInflight.set(key, promise);
  return promise;
}

export default function useCalendarEvents(calendars: CalendarConfig[]) {
  const [eventsByDate, setEventsByDate] = useState<
    Record<string, CalendarEvent[]>
  >({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);

      // 1. Caché primero SIEMPRE (online u offline): stale-while-revalidate.
      //    Va ANTES de preguntar por el estado de la red: `getNetworkStateAsync`
      //    es un salto al lado nativo y no hace ninguna falta para leer disco;
      //    tenerlo delante solo retrasaba el primer pintado.
      const [cachedStr, metaStr] = await Promise.all([
        AsyncStorage.getItem(CACHE_KEY),
        AsyncStorage.getItem(CACHE_META_KEY),
      ]);
      let hadCache = false;
      if (cachedStr) {
        try {
          const cached = JSON.parse(cachedStr) as Record<
            string,
            CalendarEvent[]
          >;
          hadCache = true;
          if (mounted) {
            setEventsByDate(cached);
            setLoading(false);
          }
        } catch (e) {
          logger.error('[calendar] caché local corrupta', e);
        }
      }

      let localMeta: CacheMeta | null = null;
      if (hadCache && metaStr) {
        try {
          const parsed = JSON.parse(metaStr) as CacheMeta;
          if (parsed && Array.isArray(parsed.calendarIds)) localMeta = parsed;
        } catch {
          // Meta corrupta: se ignora y se revalida como si no hubiera.
        }
      }

      // 2. Offline: nos quedamos con la caché (o con nada si no la había).
      const state = await Network.getNetworkStateAsync();
      const connected =
        state.isConnected && state.isInternetReachable !== false;
      if (!connected) {
        if (mounted) setLoading(false);
        return;
      }

      // 2.5. Ventana de frescura: si ya hubo una descarga COMPLETA reciente
      // para esta misma lista de calendarios, la caché ya pintada (paso 1)
      // es suficiente — evita que un paseo Home→Calendario→Home
      // re-descargue y re-parsee todos los ICS en cada montaje.
      const freshnessKey = calendars.map((c) => c.url).join('|');
      const lastFetchAt = lastFullFetch.get(freshnessKey) ?? 0;
      if (Date.now() - lastFetchAt < FRESH_WINDOW_MS) {
        if (mounted) setLoading(false);
        return;
      }

      // 3. Nodo precacheado por la Cloud Function. En el caso normal esto es
      //    UNA lectura de tres campos y se acabó: ni un solo ICS de por medio,
      //    que es lo que convierte ~1,2 s por calendario en ~50 ms en total.
      const ids = calendars.map((c) => c.id);
      let prefetched: Record<string, ParsedEvent[]> = {};
      try {
        const node = await readCachedNode(ids, localMeta);
        if (!mounted) return;

        if (node.kind === 'cache-still-valid') {
          // Lo pintado en el paso 1 ya es exactamente lo que hay. Cuenta como
          // ciclo completo: nada que descargar, nada que persistir.
          lastFullFetch.set(freshnessKey, Date.now());
          setLoading(false);
          return;
        }
        if (node.kind === 'fresh') {
          prefetched = node.events;
          const covered = ids.every((id) => prefetched[id]);
          if (covered) {
            const map = buildEventsByDate(
              ids.map((id) => prefetched[id]),
              (ev) =>
                logger.warn(
                  '[calendar] evento con rango absurdo, truncado',
                  ev.startDate,
                  ev.endDate,
                  ev.title,
                ),
            );
            setEventsByDate(map);
            lastFullFetch.set(freshnessKey, Date.now());
            setLoading(false);
            await persist(map, {
              nodeUpdatedAt: node.updatedAt,
              calendarIds: ids,
            });
            return;
          }
        }
      } catch (e) {
        // Nodo ilegible (reglas, red, forma inesperada): no es fatal, están
        // los ICS. Se registra porque si pasa siempre, el precacheo no sirve.
        logger.warn('[calendar] no se pudo leer el nodo precacheado', e);
      }

      // 4. ICS directo para lo que el nodo no haya cubierto (o para todo, si
      //    no había nodo utilizable). Sigue siendo la red de seguridad.
      const { map, anyFailed } = await fetchAndParseCalendars(
        calendars,
        prefetched,
      );
      if (!mounted) return;

      if (!anyFailed) {
        // Resultado completo y autoritativo → actualiza vista y persiste.
        setEventsByDate(map);
        // `nodeUpdatedAt: null` porque esta expansión NO viene del nodo: en el
        // siguiente montaje hay que revalidar contra Firebase, no darla por
        // buena por coincidencia de `updatedAt`.
        persist(map, { nodeUpdatedAt: null, calendarIds: ids });
      } else if (!hadCache) {
        // Parcial pero no había caché: mostrar lo que sí llegó (mejor que nada).
        // NO se persiste: solo se guarda un resultado completo.
        setEventsByDate(map);
      }
      // Parcial CON caché: mantenemos la vista cacheada (no la degradamos con
      // un resultado incompleto) y tampoco pisamos el disco.
      setLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [calendars]);

  return { eventsByDate, loading };
}

/** Guarda la expansión pintada y con qué versión del nodo se construyó. */
function persist(
  map: Record<string, CalendarEvent[]>,
  meta: CacheMeta,
): Promise<void> {
  return Promise.all([
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(map)),
    AsyncStorage.setItem(CACHE_META_KEY, JSON.stringify(meta)),
  ])
    .then(() => undefined)
    .catch(() => undefined);
}
