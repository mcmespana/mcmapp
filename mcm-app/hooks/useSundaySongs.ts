/**
 * «Cantos para el domingo» de una fecha: el día litúrgico, la misa propuesta y
 * lo que la persona cambió o quitó, recordado POR FECHA en el dispositivo
 * (`@mcm_sunday_songs_v1`, podado a ±60 días al abrir). Así, volver el sábado
 * enseña lo que se dejó el jueves.
 *
 * Las canciones salen de `useFirebaseData('songs')`: la misma caché que pintan
 * las listas del cantoral (deduplica por clave), así que no hay descarga nueva
 * y, si el cantoral se abrió alguna vez, funciona sin conexión. La lógica está
 * en `utils/sundaySongs.ts` (pura); esto solo la conecta.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useHiddenTags } from '@/hooks/useHiddenTags';
import { useSongTagIndex } from '@/hooks/useSongTags';
import { useSettings } from '@/contexts/SettingsContext';
import { filterSongsData, type SongsData } from '@/utils/filterSongsData';
import { isoDateLocal, liturgicalDayOf } from '@/utils/liturgicalDay';
import { logger } from '@/utils/logger';
import type { MassMomentId } from '@/constants/massMoments';
import {
  REMOVED,
  SUNDAY_PICKS_KEY,
  nextCandidate,
  parseSundayPicks,
  pruneSundayPicks,
  suggestMass,
  withPick,
  type StoredSundayPicks,
} from '@/utils/sundaySongs';

export function useSundaySongs(fecha: string) {
  const {
    data: songs,
    loading,
    offline,
    refresh,
  } = useFirebaseData<SongsData | null>('songs', 'songs', filterSongsData);
  const tagIndex = useSongTagIndex(songs);
  const { hiddenSlugs } = useHiddenTags();
  const { settings } = useSettings();

  // Lo recordado: se lee una vez y se escribe tras cada cambio (ya leído). La
  // pantalla no pinta la misa hasta `ready`, para no enseñar la propuesta pura
  // un instante y cambiarla por lo que la persona dejó.
  const [store, setStore] = useState<StoredSundayPicks>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SUNDAY_PICKS_KEY);
        const all = parseSundayPicks(raw);
        const pruned = pruneSundayPicks(all, isoDateLocal());
        if (!cancelled) setStore(pruned);
      } catch (e) {
        logger.warn('[sundaySongs] no se pudo leer lo guardado', e);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(SUNDAY_PICKS_KEY, JSON.stringify(store)).catch((e) =>
      logger.warn('[sundaySongs] no se pudo guardar', e),
    );
  }, [store, ready]);

  const day = useMemo(() => liturgicalDayOf(fecha), [fecha]);
  const picks = store[fecha];

  const mass = useMemo(
    () =>
      suggestMass(day, songs, {
        hiddenSlugs,
        hideHiddenTagSongs: settings.hideHiddenTagSongs,
        aliases: tagIndex.aliases,
        picks,
      }),
    [
      day,
      songs,
      hiddenSlugs,
      settings.hideHiddenTagSongs,
      tagIndex.aliases,
      picks,
    ],
  );

  /** Pone esta canción en ese momento. */
  const choose = useCallback(
    (moment: MassMomentId, filename: string) =>
      setStore((prev) => withPick(prev, fecha, moment, filename)),
    [fecha],
  );
  /** «Cambiar»: la siguiente del ranking. */
  const change = useCallback(
    (moment: MassMomentId) => {
      const next = nextCandidate(mass.find((m) => m.moment === moment)!);
      if (next)
        setStore((prev) => withPick(prev, fecha, moment, next.filename));
    },
    [mass, fecha],
  );
  const remove = useCallback(
    (moment: MassMomentId) =>
      setStore((prev) => withPick(prev, fecha, moment, REMOVED)),
    [fecha],
  );
  /** Vuelve a la propuesta de ese momento. */
  const restore = useCallback(
    (moment: MassMomentId) =>
      setStore((prev) => withPick(prev, fecha, moment, null)),
    [fecha],
  );
  /** Vuelve a la propuesta de toda la misa. */
  const resetAll = useCallback(
    () =>
      setStore((prev) => {
        const next = { ...prev };
        delete next[fecha];
        return next;
      }),
    [fecha],
  );

  return {
    day,
    mass,
    songs,
    hasSongs: !!songs && Object.keys(songs).length > 0,
    loading,
    offline,
    refresh,
    ready,
    /** ¿Hay algo cambiado respecto a la propuesta? */
    customized: !!picks && Object.keys(picks).length > 0,
    choose,
    change,
    remove,
    restore,
    resetAll,
  };
}
