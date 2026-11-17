/**
 * ¿Toca destacar «Tu año en Contigo»? Y cuántas veces se ha entrado en esta
 * temporada: a la tercera, la tarjeta deja de animarse.
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  RECAP_SEASON_OPENS,
  recapSeason,
  type RecapSeason,
} from '@/utils/contigoRecapSeason';

const KEY = '@contigo_recap_opens';

async function readOpens(): Promise<Record<string, number>> {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}');
  } catch {
    return {};
  }
}

/** Apunta una visita a «Tu año» (si estamos en temporada). */
export async function markRecapOpened(now = new Date()): Promise<void> {
  const season = recapSeason(now);
  if (!season) return;
  const opens = await readOpens();
  opens[season.id] = (opens[season.id] ?? 0) + 1;
  await AsyncStorage.setItem(KEY, JSON.stringify(opens)).catch(() => {});
}

export function useRecapSeason(): {
  season: RecapSeason | null;
  /** Animar la tarjeta (menos de tres visitas esta temporada). */
  animate: boolean;
  refresh: () => void;
} {
  const [season] = useState(() => recapSeason(new Date()));
  const [opens, setOpens] = useState<number | null>(null);

  const refresh = useCallback(() => {
    if (!season) return;
    void readOpens().then((o) => setOpens(o[season.id] ?? 0));
  }, [season]);

  useEffect(refresh, [refresh]);

  return {
    season,
    animate: !!season && opens !== null && opens < RECAP_SEASON_OPENS,
    refresh,
  };
}
