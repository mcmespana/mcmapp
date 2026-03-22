// hooks/useDailyReadings.ts — Fetch daily readings from Firebase
import { useEffect, useState, useCallback } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import { getFirebaseApp } from './firebaseApp';
import type { DailyReadings, ReadingData, DayInfo } from '@/types/contigo';

interface ReadingResult {
  /** The raw text of the reading */
  texto: string;
  /** Biblical citation (e.g. "Mt 5, 1-12") */
  cita: string;
  /** Commentary text (evangelio only) */
  comentario?: string;
  /** Commentator name */
  comentarista?: string;
  /** Source URL */
  url?: string;
}

export interface ParsedReadings {
  evangelio: ReadingResult | null;
  lectura1: ReadingResult | null;
  lectura2: ReadingResult | null;
  info: {
    diaLiturgico: string;
    titulo: string;
    citaEvangelio: string;
    primeraLectura: string;
    segundaLectura: string;
    salmo: string;
  } | null;
}

/**
 * Extract reading fields using the "activo" prefix pattern.
 * e.g. if activo="vidaNueva", looks for vidaNuevaCita, vidaNuevaEvangelioTexto, etc.
 */
function parseReading(
  data: ReadingData | undefined,
  type: 'evangelio' | 'lectura',
): ReadingResult | null {
  if (!data) return null;

  const prefix = data.activo ?? 'vidaNueva';
  const cita = data[`${prefix}Cita`] ?? '';
  const texto =
    type === 'evangelio'
      ? (data[`${prefix}EvangelioTexto`] ?? '')
      : (data[`${prefix}Texto`] ?? data[`${prefix}EvangelioTexto`] ?? '');

  // If there's no text at all, this reading isn't available
  if (!texto && !cita) return null;

  return {
    texto,
    cita,
    comentario: type === 'evangelio' ? data[`${prefix}Comentario`] : undefined,
    comentarista:
      type === 'evangelio' ? data[`${prefix}Comentarista`] : undefined,
    url: data[`${prefix}URL`],
  };
}

function parseInfo(data: DayInfo | undefined): ParsedReadings['info'] {
  if (!data) return null;
  const prefix = data.activo ?? 'vidaNueva';
  return {
    diaLiturgico: data[`${prefix}DiaLiturgico`] ?? '',
    titulo: data[`${prefix}Titulo`] ?? '',
    citaEvangelio: data[`${prefix}Cita`] ?? '',
    primeraLectura: data[`${prefix}PrimeraLectura`] ?? '',
    segundaLectura: data[`${prefix}SegundaLectura`] ?? '',
    salmo: data[`${prefix}Salmo`] ?? '',
  };
}

/**
 * Hook to fetch daily readings for a given date.
 * Reads directly from Firebase (no updatedAt wrapper — readings are date-keyed).
 */
export default function useDailyReadings(dateStr: string) {
  const [readings, setReadings] = useState<ParsedReadings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReadings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const db = getDatabase(getFirebaseApp());
      const path = `seccion_oracion/lecturas/${dateStr}`;
      const snapshot = await get(ref(db, path));

      if (!snapshot.exists()) {
        setReadings(null);
        return;
      }

      const val = snapshot.val() as DailyReadings;

      setReadings({
        evangelio: parseReading(val.evangelio, 'evangelio'),
        lectura1: parseReading(val.lectura1, 'lectura'),
        lectura2: parseReading(val.lectura2, 'lectura'),
        info: parseInfo(val.info),
      });
    } catch (e: any) {
      console.error('Error fetching readings:', e);
      setError(e?.message ?? 'Error al cargar las lecturas');
      setReadings(null);
    } finally {
      setLoading(false);
    }
  }, [dateStr]);

  useEffect(() => {
    fetchReadings();
  }, [fetchReadings]);

  /** Whether we have at least the gospel text */
  const hasEvangelio = !!readings?.evangelio?.texto;

  /** Whether the day has any readings at all */
  const hasAnyContent =
    hasEvangelio || !!readings?.lectura1 || !!readings?.lectura2;

  return {
    readings,
    loading,
    error,
    hasEvangelio,
    hasAnyContent,
    refetch: fetchReadings,
  };
}
