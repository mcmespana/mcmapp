import { useEffect, useState } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseApp } from './firebaseApp';

export function useFirebaseData<T>(
  path: string,
  storageKey: string,
  transform?: (data: any) => T,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function fetchData() {
      setLoading(true);
      try {
        const [localDataStr, localUpdatedAt] = await Promise.all([
          AsyncStorage.getItem(`${storageKey}_data`),
          AsyncStorage.getItem(`${storageKey}_updatedAt`),
        ]);
        if (localDataStr) {
          const parsed = JSON.parse(localDataStr);
          const transformed = transform ? transform(parsed) : (parsed as T);
          if (isMounted) setData(transformed);
        }

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

  return { data, loading } as const;
}
