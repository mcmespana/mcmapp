import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firestore } from '../services/firebase';

export default function useFirestoreDocument<T>(collection: string, documentId: string, fallbackData: T) {
  const [data, setData] = useState<T>(fallbackData);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const storageKey = `${collection}-${documentId}`;
      try {
        const cachedString = await AsyncStorage.getItem(storageKey);
        if (cachedString) {
          const cached = JSON.parse(cachedString);
          if (cached.data) setData(cached.data);
        }

        const snap = await getDoc(doc(firestore, collection, documentId));
        if (snap.exists()) {
          const remote = snap.data();
          const cached = cachedString ? JSON.parse(cachedString) : null;
          if (!cached || remote.updatedAt !== cached.updatedAt) {
            await AsyncStorage.setItem(storageKey, JSON.stringify(remote));
            if (remote.data) setData(remote.data);
          }
        }
        setLoading(false);
      } catch (err) {
        console.error('Error fetching document from Firestore', err);
        setError(err as Error);
        setLoading(false);
      }
    };
    load();
  }, [collection, documentId]);

  return { data, loading, error };
}
