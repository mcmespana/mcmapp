/**
 * "Mi coro": el coro que este dispositivo tiene elegido. Se guarda en
 * AsyncStorage para que solo haya que elegirlo una vez en la vida — a partir
 * de ahí, importar la playlist del domingo es un toque.
 *
 * Guardamos también el nombre para poder pintarlo sin esperar a Firebase
 * (arranque en frío, sin cobertura en el sótano de la parroquia…).
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/utils/logger';
import { isChoirId } from '@/utils/choirIds';

const STORAGE_KEY = '@mcm_my_choir_v1';

export interface MyChoir {
  id: string;
  name: string;
}

export function useMyChoir() {
  const [choir, setChoirState] = useState<MyChoir | null>(null);
  const [isHydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw) as MyChoir;
        if (parsed?.id && isChoirId(parsed.id)) {
          setChoirState({ id: parsed.id, name: parsed.name || parsed.id });
        }
      })
      .catch((e) => logger.error('my choir restore error', e))
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setChoir = useCallback((next: MyChoir | null) => {
    setChoirState(next);
    if (next) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    } else {
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    }
  }, []);

  return { choir, setChoir, isHydrated };
}
