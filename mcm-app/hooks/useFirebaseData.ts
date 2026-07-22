import { logger } from '@/utils/logger';
import { useEffect, useState } from 'react';
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

    // Con caché válida, primero comprobamos solo el metadato (pocos bytes) y
    // descargamos `data` únicamente si `updatedAt` cambió.
    if (hasLocalCache && localUpdatedAt) {
      const [metaSnap, hiddenSnap] = await Promise.all([
        get(ref(db, `${path}/updatedAt`)),
        get(ref(db, `${path}/hidden`)),
      ]);
      if (!metaSnap.exists()) return;

      const remoteUpdatedAt = String(metaSnap.val() ?? '0');
      const remoteHidden = hiddenSnap.exists() && hiddenSnap.val() === true;
      await AsyncStorage.setItem(
        `${storageKey}_hidden`,
        remoteHidden ? 'true' : 'false',
      );
      mergeCacheEntry(storageKey, { hidden: remoteHidden });

      if (localUpdatedAt === remoteUpdatedAt) return; // sin cambios remotos

      const dataSnap = await get(ref(db, `${path}/data`));
      if (!dataSnap.exists()) return;
      const rawData = dataSnap.val();
      // No persistir `undefined`: en web AsyncStorage lo guarda como el string
      // "undefined" y luego JSON.parse revienta.
      if (rawData !== undefined) {
        await AsyncStorage.setItem(
          `${storageKey}_data`,
          JSON.stringify(rawData),
        );
        await AsyncStorage.setItem(`${storageKey}_updatedAt`, remoteUpdatedAt);
      }
      mergeCacheEntry(storageKey, {
        parsed: rawData,
        updatedAt: remoteUpdatedAt,
      });
      return;
    }

    // Sin caché local: descarga completa del nodo en una sola llamada.
    const snapshot = await get(ref(db, path));
    if (!snapshot.exists()) return;
    const val = snapshot.val();
    const remoteUpdatedAt = String(val.updatedAt ?? '0');
    const remoteHidden = val.hidden === true;
    await AsyncStorage.setItem(
      `${storageKey}_hidden`,
      remoteHidden ? 'true' : 'false',
    );
    const rawData = val.data;
    if (rawData !== undefined) {
      await AsyncStorage.setItem(`${storageKey}_data`, JSON.stringify(rawData));
      await AsyncStorage.setItem(`${storageKey}_updatedAt`, remoteUpdatedAt);
    }
    mergeCacheEntry(storageKey, {
      parsed: rawData,
      updatedAt: remoteUpdatedAt,
      hidden: remoteHidden,
    });
  };

  const promise = run().finally(() => {
    const entry = nodeCache.get(storageKey);
    if (entry) entry.inflight = null;
  });
  mergeCacheEntry(storageKey, { inflight: promise });
  return promise;
}

export function useFirebaseData<T>(
  path: string,
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

  useEffect(() => {
    let isMounted = true;

    // Aplica el transform de ESTA instancia a los datos crudos de la caché.
    const applyParsed = (parsed: unknown, isHidden: boolean) => {
      if (parsed === undefined) return;
      const transformed = transform ? transform(parsed) : (parsed as T);
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
        await refreshRemote(path, storageKey, hasLocalCache, localUpdatedAt);

        // Tras el refresco, releer la caché de módulo (ya con datos frescos si
        // los hubo) y aplicar el transform de esta instancia.
        const fresh = nodeCache.get(storageKey);
        if (fresh) applyParsed(fresh.parsed, fresh.hidden);
      } catch (e) {
        logger.error('Error loading firebase data', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [path, storageKey, transform]);

  return { data, loading, offline, hidden } as const;
}
