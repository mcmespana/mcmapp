import { useEffect, useState } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseApp } from '../utils/firebaseApp';
import * as Network from 'expo-network';

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
    async function fetchData() {
      try {
        const state = await Network.getNetworkStateAsync();
        const connected =
          state.isConnected && state.isInternetReachable !== false;
        setOffline(!connected);

        const [localDataStr, localUpdatedAt, localHiddenStr] =
          await Promise.all([
            AsyncStorage.getItem(`${storageKey}_data`),
            AsyncStorage.getItem(`${storageKey}_updatedAt`),
            AsyncStorage.getItem(`${storageKey}_hidden`),
          ]);

        // Caché corrupta (JSON inválido) no debe impedir el fetch remoto:
        // se descarta y se sigue como si no hubiera caché.
        let hasLocalCache = false;
        if (localDataStr && localDataStr !== 'undefined') {
          try {
            const parsed = JSON.parse(localDataStr);
            const transformed = transform ? transform(parsed) : (parsed as T);
            if (isMounted) setData(transformed);
            if (isMounted) setHidden(localHiddenStr === 'true');
            setLoading(false); // show existing data while fetching remote
            hasLocalCache = true;
          } catch {
            await AsyncStorage.multiRemove([
              `${storageKey}_data`,
              `${storageKey}_updatedAt`,
            ]).catch(() => {});
          }
        }

        const db = getDatabase(getFirebaseApp());

        // Si ya tengo caché válido (data + updatedAt), primero compruebo
        // sólo el metadato (pocos bytes) y descargo `data` únicamente si
        // ha cambiado. Esto evita bajar megas de `songs`/`albums` en cada
        // arranque cuando el contenido remoto no se ha tocado.

        if (hasLocalCache && localUpdatedAt) {
          const [metaSnap, hiddenSnap] = await Promise.all([
            get(ref(db, `${path}/updatedAt`)),
            get(ref(db, `${path}/hidden`)),
          ]);
          if (!metaSnap.exists()) return;

          const remoteUpdatedAt = String(metaSnap.val() ?? '0');
          const remoteHidden = hiddenSnap.exists() && hiddenSnap.val() === true;
          if (isMounted) setHidden(remoteHidden);
          await AsyncStorage.setItem(
            `${storageKey}_hidden`,
            remoteHidden ? 'true' : 'false',
          );

          if (localUpdatedAt === remoteUpdatedAt) {
            return; // sin cambios remotos: no descargamos `data`
          }

          if (isMounted) setLoading(true); // show loader for update
          const dataSnap = await get(ref(db, `${path}/data`));
          if (!dataSnap.exists()) return;
          const rawData = dataSnap.val();
          const remoteData = transform ? transform(rawData) : (rawData as T);
          // No persistir `undefined`: en web AsyncStorage lo guarda como el
          // string "undefined" y luego JSON.parse revienta.
          if (remoteData !== undefined) {
            await AsyncStorage.setItem(
              `${storageKey}_data`,
              JSON.stringify(remoteData),
            );
            await AsyncStorage.setItem(
              `${storageKey}_updatedAt`,
              remoteUpdatedAt,
            );
          }
          if (isMounted) setData(remoteData);
          return;
        }

        // Sin caché local: descarga completa del nodo en una sola llamada.
        const snapshot = await get(ref(db, path));
        if (snapshot.exists()) {
          const val = snapshot.val();
          const remoteUpdatedAt = String(val.updatedAt ?? '0');
          const remoteHidden = val.hidden === true;
          if (isMounted) setHidden(remoteHidden);
          await AsyncStorage.setItem(
            `${storageKey}_hidden`,
            remoteHidden ? 'true' : 'false',
          );
          const remoteData = transform ? transform(val.data) : (val.data as T);
          // No persistir `undefined` (nodo sin `data`): evita guardar el
          // string "undefined" que rompería el JSON.parse del próximo arranque.
          if (remoteData !== undefined) {
            await AsyncStorage.setItem(
              `${storageKey}_data`,
              JSON.stringify(remoteData),
            );
            await AsyncStorage.setItem(
              `${storageKey}_updatedAt`,
              remoteUpdatedAt,
            );
          }
          if (isMounted) setData(remoteData);
        }
      } catch (e) {
        console.error('Error loading firebase data', e);
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
