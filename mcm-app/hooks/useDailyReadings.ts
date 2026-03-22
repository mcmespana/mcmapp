import { useEffect, useState } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import { getFirebaseApp } from './firebaseApp';

/**
 * Data for the evangelio/ node in Firebase.
 * Fields use source-prefixed names (vidaNueva...) to allow multiple sources.
 */
export interface EvangelioNode {
  /** Source key, e.g. "vidaNueva" */
  activo: string;
  /** Gospel citation, e.g. "Juan 7, 40-53" */
  vidaNuevaCita?: string;
  /** Full commentary text (plain text, \n\n between paragraphs) */
  vidaNuevaComentario?: string;
  /** Author of the commentary */
  vidaNuevaComentarista?: string;
  /** Full gospel text (plain text, \n\n between paragraphs) */
  vidaNuevaEvangelioTexto?: string;
  /** Source URL */
  vidaNuevaURL?: string;
  /** Last updated ISO timestamp */
  vidaNuevaLastUpdated?: string;
  /** Error code if extraction failed */
  vidaNuevaError?: string;
}

/**
 * Data for the info/ node in Firebase.
 * Contains liturgical metadata for the day.
 */
export interface InfoNode {
  /** Source key, e.g. "vidaNueva" */
  activo: string;
  /** Gospel citation (duplicate of evangelio/vidaNuevaCita for quick access) */
  vidaNuevaEvangelio?: string;
  /** Title/headline for the day */
  vidaNuevaTitulo?: string;
  /** Liturgical day description (saints, feast name) */
  vidaNuevaDiaLiturgico?: string;
  /** First reading citation */
  vidaNuevaPrimeraLectura?: string;
  /** Second reading citation (Sundays/solemnities only) */
  vidaNuevaSegundaLectura?: string;
  /** Psalm reference */
  vidaNuevaSalmo?: string;
}

export interface DayReadings {
  evangelio: EvangelioNode | null;
  info: InfoNode | null;
}

interface UseDailyReadingsResult {
  readings: DayReadings | null;
  loading: boolean;
  error: string | null;
  /** True when data exists and has at least a gospel citation */
  available: boolean;
}

/**
 * Fetches readings for a given date from Firebase:
 *   seccion_oracion/lecturas/{date}/evangelio
 *   seccion_oracion/lecturas/{date}/info
 *
 * Only data from the current day (and roughly ±30 days) is available
 * since the scraper only runs for today's readings.
 */
export function useDailyReadings(date: string): UseDailyReadingsResult {
  const [readings, setReadings] = useState<DayReadings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!date) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);
    setReadings(null);

    async function fetchReadings() {
      try {
        const db = getDatabase(getFirebaseApp());
        const dayRef = ref(db, `seccion_oracion/lecturas/${date}`);
        const snapshot = await get(dayRef);

        if (!isMounted) return;

        if (snapshot.exists()) {
          const val = snapshot.val() as {
            evangelio?: EvangelioNode;
            info?: InfoNode;
          };
          setReadings({
            evangelio: val.evangelio ?? null,
            info: val.info ?? null,
          });
        } else {
          setReadings({ evangelio: null, info: null });
        }
      } catch (e: any) {
        if (isMounted) {
          console.error('useDailyReadings error:', e);
          setError(e?.message ?? 'Error al cargar las lecturas');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchReadings();
    return () => {
      isMounted = false;
    };
  }, [date]);

  const available = Boolean(
    readings?.evangelio &&
      !readings.evangelio.vidaNuevaError &&
      readings.evangelio.vidaNuevaCita,
  );

  return { readings, loading, error, available };
}
