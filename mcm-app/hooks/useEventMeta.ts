import { logger } from '@/utils/logger';
import { useEffect, useState } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import { getFirebaseApp } from '@/utils/firebaseApp';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RemoteEventMeta } from '@/utils/mergeEventMeta';

/**
 * Lee el nodo `activities/<eventId>/_meta` de Firebase (forma PLANA que escribe
 * el panel: `{ status, title, tintColor, bannerText, updatedAt }`, NO
 * `{ updatedAt, data }`, por eso no se usa `useFirebaseData`).
 *
 * El nodo es diminuto (unos pocos campos), así que se descarga entero en cada
 * arranque sin la optimización por `updatedAt` de `useFirebaseData`. Se cachea
 * en AsyncStorage para funcionar offline y mostrar algo al instante.
 *
 * Devuelve `null` mientras no hay valor (o si falla): el llamante cae al
 * registry hardcodeado (`constants/events.ts`) vía `mergeEventMeta`.
 */
export function useEventMeta(eventId: string | null): RemoteEventMeta | null {
  const [meta, setMeta] = useState<RemoteEventMeta | null>(null);

  useEffect(() => {
    if (!eventId) {
      setMeta(null);
      return;
    }
    let isMounted = true;
    const cacheKey = `eventMeta_${eventId}`;

    async function load() {
      // 1) Caché local inmediata.
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached && cached !== 'undefined' && isMounted) {
          setMeta(JSON.parse(cached) as RemoteEventMeta);
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
        if (val && typeof val === 'object' && isMounted) {
          setMeta(val as RemoteEventMeta);
          await AsyncStorage.setItem(cacheKey, JSON.stringify(val));
        }
      } catch (e) {
        logger.error('Error cargando _meta del evento', e);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, [eventId]);

  return meta;
}
