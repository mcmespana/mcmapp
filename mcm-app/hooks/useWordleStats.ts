import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase, push, ref, set } from 'firebase/database';
import { getFirebaseApp } from './firebaseApp';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

export interface WordleStats {
  played: number;
  distribution: Record<1 | 2 | 3 | 4 | 5 | 6, number>;
  lastPlayedKey?: string;
  userId: string;
}

const STATS_KEY = '@wordle_stats';

const defaultStats: WordleStats = {
  played: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
  userId: '',
};

export default function useWordleStats() {
  const [stats, setStats] = useState<WordleStats>(defaultStats);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const saved = await AsyncStorage.getItem(STATS_KEY);
        if (saved) {
          setStats(JSON.parse(saved));
        } else {
          const userId = uuidv4();
          const initial = { ...defaultStats, userId };
          await AsyncStorage.setItem(STATS_KEY, JSON.stringify(initial));
          setStats(initial);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const recordGame = async (attempts: number, key: string) => {
    const newStats: WordleStats = {
      ...stats,
      played: stats.played + 1,
      lastPlayedKey: key,
      distribution: {
        ...stats.distribution,
        [attempts as 1 | 2 | 3 | 4 | 5 | 6]:
          stats.distribution[attempts as 1 | 2 | 3 | 4 | 5 | 6] + 1,
      },
    };
    setStats(newStats);
    await AsyncStorage.setItem(STATS_KEY, JSON.stringify(newStats));
  };

  const saveResultToServer = async (key: string, attempts: number) => {
    try {
      const db = getDatabase(getFirebaseApp());
      const [date, cycle] = key.split('_');
      const entryRef = push(ref(db, `wordle/${date}/${cycle}`));
      await set(entryRef, {
        userId: stats.userId,
        attempts,
        timestamp: Date.now(),
      });
      await set(ref(db, `wordle/${date}/updatedAt`), Date.now().toString());
    } catch (e) {
      console.error('Error saving wordle result', e);
    }
  };

  return { stats, loading, recordGame, saveResultToServer } as const;
}
