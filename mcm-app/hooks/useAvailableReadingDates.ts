import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseConfig } from '@/constants/firebase';
import { logger } from '@/utils/logger';

const CACHE_KEY = '@contigo_lecturas_dates';
const TTL_MS = 6 * 60 * 60 * 1000; // 6 horas

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Fechas con lecturas disponibles en Firebase (`seccion_oracion/lecturas`).
 *
 * Usa el REST de RTDB con `shallow=true`: devuelve SOLO las claves (fechas),
 * sin descargar los textos — céntimos de banda frente a un `get()` del nodo.
 * Cachea el resultado 6 h en AsyncStorage y lo muestra al instante mientras
 * refresca. Devuelve `null` mientras no se sabe nada (el calendario tratará
 * todas las fechas como potencialmente disponibles).
 */
export function useAvailableReadingDates(enabled: boolean) {
  const [dates, setDates] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;

    (async () => {
      try {
        let fresh = false;
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached) as { at: number; dates: string[] };
          if (Array.isArray(parsed?.dates) && mounted) {
            setDates(new Set(parsed.dates));
          }
          fresh = Date.now() - (parsed?.at ?? 0) < TTL_MS;
        }
        if (fresh) return;

        const base = firebaseConfig.databaseURL;
        if (!base) return;
        const res = await fetch(
          `${base.replace(/\/$/, '')}/seccion_oracion/lecturas.json?shallow=true`,
        );
        if (!res.ok) return;
        const json = (await res.json()) as Record<string, unknown> | null;
        const keys = json
          ? Object.keys(json).filter((k) => ISO_DATE.test(k))
          : [];
        if (mounted) setDates(new Set(keys));
        await AsyncStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ at: Date.now(), dates: keys }),
        );
      } catch (e) {
        logger.warn('[useAvailableReadingDates]', e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [enabled]);

  return dates;
}
