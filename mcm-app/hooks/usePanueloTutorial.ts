// El tutorial del pañuelo: sale solo la primera vez (y cuando sube su versión,
// `constants/panueloTutorial.ts`) y siempre a mano desde el botón de ayuda.
// Lo visto se recuerda en este móvil: `@panuelo_tutorial_seen` = la versión.

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { PANUELO_TUTORIAL_VERSION } from '@/constants/panueloTutorial';
import { logger } from '@/utils/logger';

export const PANUELO_TUTORIAL_KEY = '@panuelo_tutorial_seen';

/** Puro: ¿toca enseñarlo solo? Sin nada guardado o con una versión vieja. */
export function shouldAutoShowTutorial(stored: string | null): boolean {
  const seen = Number(stored);
  return !(Number.isFinite(seen) && seen >= PANUELO_TUTORIAL_VERSION);
}

export function usePanueloTutorial() {
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(PANUELO_TUTORIAL_KEY)
      .then((stored) => {
        if (mounted) setOpen(shouldAutoShowTutorial(stored));
      })
      // Si no se puede leer no se sabe si ya lo vio: mejor no insistir.
      .catch((err) => logger.warn('[Pañuelo] tutorial ilegible:', err))
      .finally(() => {
        if (mounted) setLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const show = useCallback(() => setOpen(true), []);
  const finish = useCallback(() => {
    setOpen(false);
    AsyncStorage.setItem(
      PANUELO_TUTORIAL_KEY,
      String(PANUELO_TUTORIAL_VERSION),
    ).catch((err) => logger.warn('[Pañuelo] no se pudo guardar:', err));
  }, []);

  return {
    /** Ya se sabe si hay que enseñarlo. */
    loaded,
    open,
    /** Mientras el tutorial no se ha resuelto, nada más se presenta. */
    busy: !loaded || open,
    show,
    finish,
  };
}
