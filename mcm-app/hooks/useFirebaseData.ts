import { logger } from '@/utils/logger';
import {
  isPermissionDenied,
  reportIfPermissionDenied,
  type FirebaseOp,
} from '@/utils/firebaseErrors';
import { useEffect, useRef, useState } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseApp } from '../utils/firebaseApp';
import * as Network from 'expo-network';

// ── Caché a nivel de módulo (compartida entre instancias del mismo storageKey) ──
// Antes cada consumidor del mismo path repetía el JSON.parse de la caché de
// AsyncStorage (síncrono, en el hilo JS) y su propio round-trip a Firebase. El
// nodo `songs` tiene 3 consumidores vivos a la vez (Categories, SongList,
// SelectedSongs por `freezeOnBlur`). Esta caché de módulo deduplica ambos.
//
// Guarda lo CRUDO (sin `transform`): dos consumidores del mismo path pueden
// tener transforms distintos —p.ej. `songs`, donde Categories/SongList filtran
// borradores y SelectedSongs no—, así que el transform se aplica por instancia
// al leer. Por coherencia, AsyncStorage también guarda ahora lo crudo (antes
// guardaba lo transformado del último consumidor que escribiera, dependiente de
// una carrera): la vista de cada pantalla no cambia porque el transform se
// aplica siempre al leer.
//
// Vive lo que viva el proceso JS (se vacía solo en OTA/reload); sin TTL a
// propósito (ver plan 008).
type CacheEntry = {
  parsed: unknown; // JSON.parse de `_data`, SIN transform
  updatedAt: string | null;
  hidden: boolean;
  inflight: Promise<void> | null; // refresco remoto en curso para este storageKey
};

const nodeCache = new Map<string, CacheEntry>();

/** Solo para tests: vacía la caché de módulo para aislar casos. */
export function __resetNodeCacheForTests() {
  nodeCache.clear();
}

function mergeCacheEntry(storageKey: string, patch: Partial<CacheEntry>) {
  const prev = nodeCache.get(storageKey) ?? {
    parsed: undefined,
    updatedAt: null,
    hidden: false,
    inflight: null,
  };
  nodeCache.set(storageKey, { ...prev, ...patch });
}

/**
 * Reintentos con espera creciente para la fase remota.
 *
 * Antes, un `get()` que fallara por red intermitente se tragaba con un
 * `logger.error` y la pantalla se quedaba con lo que hubiera en caché hasta el
 * siguiente montaje. En un encuentro con el wifi saturado, eso es exactamente
 * "la app no carga". Ahora se reintenta dos veces (0,4 s → 1,2 s) antes de
 * rendirse.
 *
 * No se reintenta eternamente a propósito: si de verdad no hay red, insistir
 * solo gasta batería. Para ese caso está el re-fetch al volver online, que es
 * un evento y no una espera activa.
 *
 * Reintentar `run()` ENTERO es seguro: sus escrituras en AsyncStorage son
 * idempotentes (mismo valor, misma clave).
 */
const RETRY_DELAYS_MS = [400, 1200];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry(
  run: () => Promise<void>,
  /** Qué se estaba haciendo, para poder reportar una denegación de reglas. */
  context?: { op: FirebaseOp; path: string },
): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await run();
      return;
    } catch (error) {
      // Una denegación de reglas NO es un fallo de red: no se arregla
      // esperando. Se reporta con su path y se corta el bucle en el primer
      // intento, en vez de gastar 1,6 s y tres peticiones para volver a fallar.
      if (
        context &&
        reportIfPermissionDenied(error, context.op, context.path)
      ) {
        throw error;
      }
      if (attempt >= RETRY_DELAYS_MS.length) throw error;
      logger.warn(
        `[firebase] fallo de red, reintento ${attempt + 1}/${RETRY_DELAYS_MS.length}`,
        error,
      );
      await wait(RETRY_DELAYS_MS[attempt]);
    }
  }
}

// Refresco remoto COALESCIDO por storageKey: si ya hay uno en vuelo, se reutiliza
// su promesa en lugar de lanzar otra descarga. Actualiza `nodeCache` y
// AsyncStorage con datos CRUDOS. No retiene errores en la caché: el `finally`
// limpia `inflight` pase lo que pase.
function refreshRemote(
  path: string,
  storageKey: string,
  hasLocalCache: boolean,
  localUpdatedAt: string | null,
): Promise<void> {
  const existing = nodeCache.get(storageKey);
  if (existing?.inflight) return existing.inflight;

  const run = async () => {
    const db = getDatabase(getFirebaseApp());

    // SIEMPRE por hijos (`updatedAt` / `hidden` / `data`), nunca `get(path)`
    // del nodo entero. Antes, la primera carga sin caché se traía el nodo
    // completo, y en `surveys/<id>` o `<evento>/evaluacion` eso incluye
    // `respuestas`: las respuestas de TODO el mundo, con nombre y delegación,
    // descargadas a cada móvil para pintar un formulario. Además las reglas
    // ya no lo permiten — `respuestas` solo es legible respuesta a respuesta.
    const [metaSnap, hiddenSnap] = await Promise.all([
      get(ref(db, `${path}/updatedAt`)),
      get(ref(db, `${path}/hidden`)),
    ]);

    const remoteHidden = hiddenSnap.exists() && hiddenSnap.val() === true;
    await AsyncStorage.setItem(
      `${storageKey}_hidden`,
      remoteHidden ? 'true' : 'false',
    );
    mergeCacheEntry(storageKey, { hidden: remoteHidden });

    // Con caché válida basta el metadato: si `updatedAt` no cambió (o el nodo
    // ni siquiera lo tiene) no hay nada que descargar.
    if (hasLocalCache && localUpdatedAt) {
      if (!metaSnap.exists()) return;
      if (localUpdatedAt === String(metaSnap.val() ?? '0')) return;
    }

    const remoteUpdatedAt = String(metaSnap.val() ?? '0');
    const dataSnap = await get(ref(db, `${path}/data`));
    if (!dataSnap.exists()) return;
    const rawData = dataSnap.val();
    // No persistir `undefined`: en web AsyncStorage lo guarda como el string
    // "undefined" y luego JSON.parse revienta.
    if (rawData !== undefined) {
      await AsyncStorage.setItem(`${storageKey}_data`, JSON.stringify(rawData));
      await AsyncStorage.setItem(`${storageKey}_updatedAt`, remoteUpdatedAt);
    }
    mergeCacheEntry(storageKey, {
      parsed: rawData,
      updatedAt: remoteUpdatedAt,
    });
  };

  const promise = withRetry(run, { op: 'read', path }).finally(() => {
    const entry = nodeCache.get(storageKey);
    if (entry) entry.inflight = null;
  });
  mergeCacheEntry(storageKey, { inflight: promise });
  return promise;
}

/**
 * `path` admite `null` para "este consumidor no tiene nodo que mirar": no se
 * consulta nada y se devuelve el estado vacío. Antes, quien no tenía nodo
 * pasaba un path inventado (`__noop__/<slug>`) que sí llegaba a Firebase; con
 * las reglas abiertas devolvía null sin más, pero con las reglas cerradas es un
 * `PERMISSION_DENIED` por cada tarjeta de sección renderizada — es decir, un
 * chorro de eventos en Sentry por algo que nunca hizo falta preguntar.
 */
export function useFirebaseData<T>(
  path: string | null,
  storageKey: string,
  transform?: (data: any) => T,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  // `hidden` se lee del mismo nodo Firebase (hermano de `data` y `updatedAt`).
  // Lo usa el hub de eventos para esconder secciones desde el panel sin
  // borrar sus datos. Si el nodo no lo trae, se asume false.
  const [hidden, setHidden] = useState(false);
  // Estado de red de la última comprobación, para distinguir "he recuperado la
  // conexión" de "el listener ha vuelto a emitir estando ya conectado".
  const wasOfflineRef = useRef(false);

  // Última aplicación del transform de ESTA instancia: si el `parsed` crudo
  // no cambió de identidad (p. ej. `refreshRemote` salió por la vía rápida
  // porque el updatedAt remoto coincide con el local), reutilizamos el
  // resultado en vez de re-ejecutar `transform` y estrenar una identidad
  // nueva. Sin esto, `applyParsed` se llama dos veces por carga (caché +
  // post-refresh) y la segunda siempre entregaba un objeto nuevo aunque los
  // datos fueran idénticos: React re-renderizaba y todo `useMemo` aguas
  // abajo recomputaba para cero cambio visible. Memo POR INSTANCIA (no en
  // `nodeCache`): transforms distintos por consumidor del mismo path siguen
  // aislados (ver el comentario de cabecera sobre `nodeCache`).
  const lastApplied = useRef<{ src: unknown; out: T } | null>(null);

  useEffect(() => {
    // Sin nodo que mirar no hay nada que hacer. `loading` se resuelve al
    // devolver el estado, no con un `setState` aquí dentro.
    if (path === null) return;
    // Copia ya estrechada a `string`: TypeScript no conserva el narrowing del
    // parámetro dentro de `fetchData`, que es una función anidada.
    const nodePath = path;
    let isMounted = true;

    // Aplica el transform de ESTA instancia a los datos crudos de la caché.
    const applyParsed = (parsed: unknown, isHidden: boolean) => {
      if (parsed === undefined) return;
      let transformed: T;
      if (lastApplied.current && lastApplied.current.src === parsed) {
        transformed = lastApplied.current.out;
      } else {
        transformed = transform ? transform(parsed) : (parsed as T);
        lastApplied.current = { src: parsed, out: transformed };
      }
      if (isMounted) {
        setData(transformed);
        setHidden(isHidden);
      }
    };

    async function fetchData() {
      try {
        const state = await Network.getNetworkStateAsync();
        const connected =
          state.isConnected && state.isInternetReachable !== false;
        wasOfflineRef.current = !connected;
        if (isMounted) setOffline(!connected);

        // 1. Servir desde la caché de módulo o, si no existe, desde AsyncStorage.
        const cached = nodeCache.get(storageKey);
        let hasLocalCache = false;
        let localUpdatedAt: string | null = null;

        if (cached && cached.parsed !== undefined) {
          applyParsed(cached.parsed, cached.hidden);
          if (isMounted) setLoading(false);
          hasLocalCache = true;
          localUpdatedAt = cached.updatedAt;
        } else {
          const [localDataStr, localUpdatedAtStored, localHiddenStr] =
            await Promise.all([
              AsyncStorage.getItem(`${storageKey}_data`),
              AsyncStorage.getItem(`${storageKey}_updatedAt`),
              AsyncStorage.getItem(`${storageKey}_hidden`),
            ]);
          localUpdatedAt = localUpdatedAtStored;

          // Caché corrupta (JSON inválido) no debe impedir el fetch remoto:
          // se descarta y se sigue como si no hubiera caché.
          if (localDataStr && localDataStr !== 'undefined') {
            try {
              const parsed = JSON.parse(localDataStr);
              const isHidden = localHiddenStr === 'true';
              mergeCacheEntry(storageKey, {
                parsed,
                updatedAt: localUpdatedAtStored,
                hidden: isHidden,
              });
              applyParsed(parsed, isHidden);
              if (isMounted) setLoading(false); // mostrar caché mientras revalida
              hasLocalCache = true;
            } catch {
              await AsyncStorage.multiRemove([
                `${storageKey}_data`,
                `${storageKey}_updatedAt`,
              ]).catch(() => {});
              nodeCache.delete(storageKey);
              localUpdatedAt = null;
            }
          }
        }

        // 2. Fase remota, coalescida entre instancias del mismo storageKey.
        await refreshRemote(
          nodePath,
          storageKey,
          hasLocalCache,
          localUpdatedAt,
        );

        // Tras el refresco, releer la caché de módulo (ya con datos frescos si
        // los hubo) y aplicar el transform de esta instancia.
        const fresh = nodeCache.get(storageKey);
        if (fresh) applyParsed(fresh.parsed, fresh.hidden);
      } catch (e) {
        // Las denegaciones de reglas ya las reportó `withRetry` con su path;
        // volver a registrarlas aquí solo duplicaría el evento en Sentry.
        if (!isPermissionDenied(e)) {
          logger.error('Error loading firebase data', e);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchData();

    // Resincronización al RECUPERAR la red.
    //
    // Antes, si la app arrancaba sin cobertura, se quedaba con la caché hasta
    // que el usuario volviera a montar la pantalla — o sea, hasta que navegara
    // a otro sitio y volviera. Ahora, en cuanto hay red otra vez, se revalida
    // sola.
    //
    // Solo dispara en la TRANSICIÓN sin red → con red: el listener también
    // emite al cambiar de wifi a datos estando ya conectado, y ahí no hay nada
    // que recuperar.
    const subscription = Network.addNetworkStateListener((state) => {
      const connected =
        !!state.isConnected && state.isInternetReachable !== false;
      const wasOffline = wasOfflineRef.current;
      wasOfflineRef.current = !connected;
      if (isMounted) setOffline(!connected);
      if (connected && wasOffline) fetchData();
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [path, storageKey, transform]);

  // Sin nodo no hay carga pendiente ni nada que esperar.
  return {
    data,
    loading: path === null ? false : loading,
    offline,
    hidden,
  } as const;
}
