import { useEffect, useState } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseApp } from '@/utils/firebaseApp';
import { logger } from '@/utils/logger';
import { isPermissionDenied } from '@/utils/firebaseErrors';
import { withRetry } from '@/hooks/useFirebaseData';
import type { EventConfig } from '@/constants/events';
import {
  HORARIO_MAX,
  horarioKey,
  parseCachedSheets,
  sheetsFromProbes,
  type HorarioProbe,
  type HorarioSheet,
} from '@/utils/eventHorarios';

async function probeHorario(base: string, n: number): Promise<HorarioProbe> {
  const db = getDatabase(getFirebaseApp());
  const key = horarioKey(n);
  const [updatedAt, hidden, nombre] = await Promise.all([
    get(ref(db, `${base}/${key}/updatedAt`)),
    get(ref(db, `${base}/${key}/hidden`)),
    get(ref(db, `${base}/${key}/meta/nombre`)),
  ]);
  return {
    n,
    exists: updatedAt.exists(),
    hidden: hidden.val() === true,
    nombre: nombre.val(),
  };
}

/**
 * Descubre los horarios numerados de un evento. Primero `horario1` (una sola
 * lectura para los eventos de siempre, que no lo tienen); si existe, el resto
 * en paralelo.
 */
async function fetchHorarioSheets(event: EventConfig): Promise<HorarioSheet[]> {
  const base = event.firebasePrefix;
  const first = await probeHorario(base, 1);
  if (!first.exists) return [];
  const rest = await Promise.all(
    Array.from({ length: HORARIO_MAX - 1 }, (_, i) =>
      probeHorario(base, i + 2),
    ),
  );
  return sheetsFromProbes([first, ...rest]);
}

/**
 * Los horarios (`horario1`, `horario2`…) de un evento, con su nombre.
 *
 * - `sheets` vacío + `ready` = el evento usa el `horario` único de siempre.
 * - Sirve primero la última lista que se vio (AsyncStorage) y revalida.
 * - `ready` es false hasta saber si hay horarios numerados o no, para no
 *   pintar «próximamente» mientras se averigua.
 */
export function useEventHorarios(event: EventConfig): {
  sheets: HorarioSheet[];
  ready: boolean;
} {
  const [state, setState] = useState<{
    sheets: HorarioSheet[];
    ready: boolean;
  }>({ sheets: [], ready: false });

  useEffect(() => {
    let alive = true;
    const cacheKey = `eventHorarios_${event.id}`;

    (async () => {
      const cached = parseCachedSheets(
        await AsyncStorage.getItem(cacheKey).catch(() => null),
      );
      if (cached && alive) setState({ sheets: cached, ready: true });

      try {
        let sheets: HorarioSheet[] = [];
        await withRetry(
          async () => {
            sheets = await fetchHorarioSheets(event);
          },
          { op: 'read', path: `${event.firebasePrefix}/horario1` },
        );
        await AsyncStorage.setItem(cacheKey, JSON.stringify(sheets)).catch(
          () => {},
        );
        if (alive) setState({ sheets, ready: true });
      } catch (e) {
        if (!isPermissionDenied(e)) {
          logger.warn('[horarios] no se pudo sondear los horarios', e);
        }
        // Sin red ni caché: se sigue con el horario único de siempre.
        if (alive) setState((s) => ({ ...s, ready: true }));
      }
    })();

    return () => {
      alive = false;
    };
    // `event` entero cambiaría de identidad sin que cambie el evento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, event.firebasePrefix]);

  return state;
}
