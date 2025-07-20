import { useEffect, useState } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseApp } from './firebaseApp';
import * as Network from 'expo-network';

function getFallbackData(path: string): any | null {
  switch (path) {
    case 'albums':
      return require('../assets/albums.json');
    case 'songs':
      return require('../assets/songs.json');
    case 'jubileo/horario':
      return require('../assets/jubileo-horario.json');
    case 'jubileo/materiales':
      return require('../assets/jubileo-materiales.json');
    case 'jubileo/visitas':
      return require('../assets/jubileo-visitas.json');
    case 'jubileo/profundiza':
      return require('../assets/jubileo-profundiza.json');
    case 'jubileo/grupos':
      return require('../assets/jubileo-grupos.json');
    case 'jubileo/contactos':
      return require('../assets/jubileo-contactos.json');
    default:
      return null;
  }
}

export function useFirebaseData<T>(
  path: string,
  storageKey: string,
  transform?: (data: any) => T,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      setLoading(true);
      try {
        const state = await Network.getNetworkStateAsync();
        const connected = state.isConnected && state.isInternetReachable !== false;
        setOffline(!connected);
        const [localDataStr, localUpdatedAt] = await Promise.all([
          AsyncStorage.getItem(`${storageKey}_data`),
          AsyncStorage.getItem(`${storageKey}_updatedAt`),
        ]);

        if (localDataStr) {
          const parsed = JSON.parse(localDataStr);
          const transformed = transform ? transform(parsed) : (parsed as T);
          if (isMounted) setData(transformed);
        } else {
          const fallback = getFallbackData(path);
          if (fallback) {
            const transformed = transform ? transform(fallback) : (fallback as T);
            await AsyncStorage.setItem(
              `${storageKey}_data`,
              JSON.stringify(transformed),
            );
            await AsyncStorage.setItem(`${storageKey}_updatedAt`, '0');
            if (isMounted) setData(transformed);
          }
        }

        if (connected) {
          const db = getDatabase(getFirebaseApp());
          const snapshot = await get(ref(db, path));
          if (snapshot.exists()) {
            const val = snapshot.val();
            const remoteUpdatedAt = String(val.updatedAt ?? '0');
            if (!localUpdatedAt || localUpdatedAt !== remoteUpdatedAt) {
              const remoteData = transform ? transform(val.data) : (val.data as T);
              await AsyncStorage.setItem(
                `${storageKey}_data`,
                JSON.stringify(remoteData),
              );
              await AsyncStorage.setItem(
                `${storageKey}_updatedAt`,
                remoteUpdatedAt,
              );
              if (isMounted) setData(remoteData);
            }
          }
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

  return { data, loading, offline } as const;
}
