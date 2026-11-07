import { logger } from '@/utils/logger';
import { useEffect, useMemo, useState } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import { getFirebaseApp } from '@/utils/firebaseApp';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RemoteEventMeta } from '@/utils/mergeEventMeta';

/**
 * Lee el nodo `activities/<eventId>/_meta` de Firebase (forma PLANA que escribe
 * el panel: `{ status, title, tintColor, bannerText, updatedAt }`, NO
 * `{ updatedAt, data }`, por eso no se usa `useFirebaseData`).
 *
 * Cada nodo es diminuto (unos pocos campos), así que se descargan enteros en
 * cada arranque sin la optimización por `updatedAt` de `useFirebaseData`. Se
 * cachean en AsyncStorage para funcionar offline y mostrar algo al instante.
 *
 * Devuelve un mapa `id -> meta` con SOLO los eventos que ya han contestado (o
 * tenían caché). El llamante cae al registry hardcodeado
 * (`constants/events.ts`) vía `mergeEventMeta` para los que falten.
 *
 * B1: se leen TODOS los eventos, no solo el activo. El panel puede archivar,
 * renombrar o recolorear cualquier evento —incluidos los pasados— y hasta que
 * esto existió la app solo hacía caso al activo: archivar un evento que no
 * fuera el en curso no tenía ningún efecto visible.
 */
export function useEventsMeta(
  eventIds: string[],
): Record<string, RemoteEventMeta> {
  const [metas, setMetas] = useState<Record<string, RemoteEventMeta>>({});

  // Los arrays se recrean en cada render; la clave estable evita que el efecto
  // se dispare en bucle.
  const idsKey = useMemo(
    () =>
      Array.from(new Set(eventIds.filter(Boolean)))
        .sort()
        .join(','),
    [eventIds],
  );

  useEffect(() => {
    const ids = idsKey ? idsKey.split(',') : [];
    if (ids.length === 0) return;
    let isMounted = true;

    const remember = (eventId: string, meta: RemoteEventMeta) => {
      if (isMounted) setMetas((prev) => ({ ...prev, [eventId]: meta }));
    };

    async function load(eventId: string) {
      const cacheKey = `eventMeta_${eventId}`;

      // 1) Caché local inmediata.
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached && cached !== 'undefined') {
          remember(eventId, JSON.parse(cached) as RemoteEventMeta);
        }
      } catch {
        // Caché corrupta: se ignora y se sigue con el fetch remoto.
      }

      // 2) Fetch remoto del nodo _meta completo.
      try {
        const db = getDatabase(getFirebaseApp());
        const snap = await get(ref(db, `activities/${eventId}/_meta`));
        if (!snap.exists()) return;
        const val = snap.val();
        if (val && typeof val === 'object') {
          remember(eventId, val as RemoteEventMeta);
          await AsyncStorage.setItem(cacheKey, JSON.stringify(val));
        }
      } catch (e) {
        logger.error('Error cargando _meta del evento', e);
      }
    }

    ids.forEach(load);
    return () => {
      isMounted = false;
    };
  }, [idsKey]);

  return metas;
}

/**
 * Versión de un solo evento. Devuelve `null` mientras no hay valor (o si
 * falla): el llamante cae al registry hardcodeado vía `mergeEventMeta`.
 */
export function useEventMeta(eventId: string | null): RemoteEventMeta | null {
  const ids = useMemo(() => (eventId ? [eventId] : []), [eventId]);
  const metas = useEventsMeta(ids);
  return eventId ? (metas[eventId] ?? null) : null;
}
