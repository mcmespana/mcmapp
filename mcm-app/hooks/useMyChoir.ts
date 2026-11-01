/**
 * "Mi coro": el coro que este dispositivo tiene elegido. Se guarda en
 * AsyncStorage para que solo haya que elegirlo una vez en la vida — a partir
 * de ahí, importar la playlist del domingo es un toque.
 *
 * Guardamos también el nombre para poder pintarlo sin esperar a Firebase
 * (arranque en frío, sin cobertura en el sótano de la parroquia…).
 *
 * Se elige desde dos sitios (la hoja del coro y el onboarding del cantoral),
 * y cada uno monta su propia instancia del hook: los cambios se difunden entre
 * todas las instancias vivas para que ninguna se quede con el coro viejo.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/utils/logger';
import { isChoirId } from '@/utils/choirIds';

const STORAGE_KEY = '@mcm_my_choir_v1';

export interface MyChoir {
  id: string;
  name: string;
}

type Listener = (choir: MyChoir | null) => void;
const listeners = new Set<Listener>();

export function useMyChoir() {
  const [choir, setChoirState] = useState<MyChoir | null>(null);
  const [isHydrated, setHydrated] = useState(false);
  // Si se elige un coro antes de que termine de leerse el guardado, lo leído
  // (más viejo) no debe pisarlo.
  const touchedRef = useRef(false);

  useEffect(() => {
    const onChange: Listener = (next) => {
      touchedRef.current = true;
      setChoirState(next);
    };
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || touchedRef.current || !raw) return;
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
    touchedRef.current = true;
    if (next) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    } else {
      AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    }
    listeners.forEach((l) => l(next));
  }, []);

  return { choir, setChoir, isHydrated };
}
