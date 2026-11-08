/**
 * Pistas de gesto: enseñar que un gesto existe las primeras veces, y dejar de
 * hacerlo en cuanto el usuario lo ha usado.
 *
 * Patrón (skill `gestures` + guías de iOS/Material): un gesto escondido no se
 * descubre solo. Lo correcto no es un tutorial ni un cartel fijo, sino una
 * DEMOSTRACIÓN breve del propio gesto sobre el contenido real (la fila se
 * entreabre y enseña «Añadir»; la letra se aparta y asoma la siguiente
 * canción) que:
 *   · sale unas pocas veces (`HINT_MAX_SHOWS`), una por sesión como mucho;
 *   · se apaga para siempre en cuanto el usuario hace el gesto (`markLearned`);
 *   · se interrumpe si el usuario toca (el gesto manda sobre la demo).
 *
 * El recuento vive en AsyncStorage (`gestureHint:<clave>`).
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/utils/logger';

/** Veces que se enseña una pista antes de darla por vista. */
export const HINT_MAX_SHOWS = 3;
/** Valor guardado cuando el usuario ya ha usado el gesto: no vuelve a salir. */
export const HINT_LEARNED = 999;

const storageKey = (key: string) => `gestureHint:${key}`;

/** Pistas ya enseñadas en esta sesión de la app: como mucho una por sesión. */
const shownThisSession = new Set<string>();

/** ¿Toca enseñar la pista, con este recuento guardado? */
export function isHintDue(
  stored: string | null,
  maxShows = HINT_MAX_SHOWS,
): boolean {
  const n = Number(stored);
  return !Number.isFinite(n) || n < maxShows;
}

export function __resetGestureHintSession(): void {
  shownThisSession.clear();
}

export function useGestureHint(key: string, maxShows = HINT_MAX_SHOWS) {
  const [due, setDue] = useState(false);

  useEffect(() => {
    if (shownThisSession.has(key)) return;
    let alive = true;
    AsyncStorage.getItem(storageKey(key))
      .then((v) => {
        if (alive && isHintDue(v, maxShows)) setDue(true);
      })
      .catch((e) => logger.warn('gestureHint: no se pudo leer', e));
    return () => {
      alive = false;
    };
  }, [key, maxShows]);

  /**
   * La pista se acaba de enseñar: cuenta una vez más. `due` NO cambia en este
   * montaje (la demo sigue en marcha y quien la pinta no debe desmontarla a
   * medias); lo que impide repetirla es el pestillo de sesión.
   */
  const consume = useCallback(() => {
    shownThisSession.add(key);
    AsyncStorage.getItem(storageKey(key))
      .then((v) => {
        const n = Number(v);
        const next = (Number.isFinite(n) ? n : 0) + 1;
        return AsyncStorage.setItem(storageKey(key), String(next));
      })
      .catch((e) => logger.warn('gestureHint: no se pudo guardar', e));
  }, [key]);

  /** El usuario ha hecho el gesto: no hace falta volver a enseñárselo. */
  const markLearned = useCallback(() => {
    setDue(false);
    shownThisSession.add(key);
    AsyncStorage.setItem(storageKey(key), String(HINT_LEARNED)).catch((e) =>
      logger.warn('gestureHint: no se pudo guardar', e),
    );
  }, [key]);

  return { due, consume, markLearned };
}
