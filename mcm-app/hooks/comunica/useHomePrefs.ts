// Lo que la portada recuerda por persona (plan 11): el saludo se oculta con su × y vuelve dentro de un mes. Va en el cajón `home` del móvil
// (un número, nada personal) y se borra al salir, como todo lo del área.

import { useCallback, useEffect, useState } from 'react';
import { comunicaNow } from '@/services/comunica';
import { readDrawer, writeDrawer } from '@/services/comunica/storage';
import { useMe } from './useMe';

interface Prefs {
  greetingHiddenUntil?: number;
}

/** Un mes: «Ocultar el saludo (volverá dentro de un mes)». */
export const GREETING_HIDDEN_MS = 30 * 24 * 60 * 60 * 1000;

export function useGreetingHidden() {
  const personId = useMe().me?.personId ?? null;
  const [loaded, setLoaded] = useState<{
    personId: string;
    until: number;
  } | null>(null);
  useEffect(() => {
    if (!personId) return;
    let cancelled = false;
    void readDrawer<Prefs>(personId, 'home').then((p) => {
      if (!cancelled)
        setLoaded({ personId, until: p?.greetingHiddenUntil ?? 0 });
    });
    return () => {
      cancelled = true;
    };
  }, [personId]);
  const until = personId && loaded?.personId === personId ? loaded.until : 0;
  const hide = useCallback(() => {
    if (!personId) return;
    const next = comunicaNow().getTime() + GREETING_HIDDEN_MS;
    setLoaded({ personId, until: next });
    void writeDrawer(personId, 'home', {
      greetingHiddenUntil: next,
    } satisfies Prefs);
  }, [personId]);
  return { hidden: until > comunicaNow().getTime(), hide };
}
