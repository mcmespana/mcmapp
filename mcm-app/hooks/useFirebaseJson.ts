import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, get } from 'firebase/database';
import { firebaseDb } from '@/constants/firebase';

export interface UseFirebaseJsonOptions<T> {
  storageKey: string;
  defaultData?: T;
  versionKey?: string; // key for updatedAt/version stored in AsyncStorage
}

export function useFirebaseJson<T>(path: string, options: UseFirebaseJsonOptions<T>) {
  const { storageKey, defaultData, versionKey = storageKey + ':version' } = options;
  const [data, setData] = useState<T | null>(defaultData ?? null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const local = await AsyncStorage.getItem(storageKey);
        const localVersion = await AsyncStorage.getItem(versionKey);
        if (local) {
          setData(JSON.parse(local));
        } else if (defaultData) {
          setData(defaultData);
        }
        const snap = await get(ref(firebaseDb, path));
        const remote = snap.val();
        if (!remote) {
          return;
        }
        const remoteVersion = remote.updatedAt || remote.version || null;
        const remoteData = remote.data ?? remote;
        if (remoteVersion && remoteVersion === localVersion && local) {
          return;
        }
        await AsyncStorage.setItem(storageKey, JSON.stringify(remoteData));
        if (remoteVersion) {
          await AsyncStorage.setItem(versionKey, String(remoteVersion));
        }
        if (isMounted) {
          setData(remoteData);
        }
      } catch (err) {
        console.error('useFirebaseJson error', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [path]);

  return { data, loading } as const;
}
