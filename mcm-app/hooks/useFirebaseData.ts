import { useEffect, useState } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseApp } from './firebaseApp';
import * as Network from 'expo-network';

export function useFirebaseData<T>(path: string, storageKey: string) {
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
          const parsed = JSON.parse(localDataStr) as T;
          if (isMounted) setData(parsed);
        }

        if (connected) {
          const db = getDatabase(getFirebaseApp());
          const snapshot = await get(ref(db, path));
          if (snapshot.exists()) {
            const val = snapshot.val();
            const remoteUpdatedAt = String(val.updatedAt ?? '0');
            if (!localUpdatedAt || localUpdatedAt !== remoteUpdatedAt) {
              await AsyncStorage.setItem(`${storageKey}_data`, JSON.stringify(val.data));
              await AsyncStorage.setItem(`${storageKey}_updatedAt`, remoteUpdatedAt);
              if (isMounted) setData(val.data as T);
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
    return () => { isMounted = false; };
  }, [path, storageKey]);

  return { data, loading, offline } as const;
}
