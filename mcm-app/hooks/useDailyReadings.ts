import { useEffect, useState, useCallback } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseApp } from './firebaseApp';

export interface ReadingData {
  cita: string;
  texto: string;
  comentario: string;
  comentarista: string;
  url: string;
  lastUpdated: string;
}

export interface DailyReadings {
  evangelio: ReadingData | null;
  lectura1: ReadingData | null;
  lectura2: ReadingData | null;
  info: {
    diaLiturgico: string;
    titulo: string;
    citaEvangelio: string;
    primeraLectura: string;
    segundaLectura: string;
    salmo: string;
  } | null;
}

const CACHE_PREFIX = '@contigo_readings_';

function extractReading(data: any, prefix: string): ReadingData | null {
  if (!data || !prefix) return null;
  const cita = data[`${prefix}Cita`];
  if (!cita) return null;
  return {
    cita: cita ?? '',
    texto: data[`${prefix}EvangelioTexto`] ?? data[`${prefix}Texto`] ?? '',
    comentario: data[`${prefix}Comentario`] ?? '',
    comentarista: data[`${prefix}Comentarista`] ?? '',
    url: data[`${prefix}URL`] ?? data[`${prefix}Url`] ?? '',
    lastUpdated: data[`${prefix}LastUpdated`] ?? '',
  };
}

function extractInfo(data: any, prefix: string) {
  if (!data || !prefix) return null;
  return {
    diaLiturgico: data[`${prefix}DiaLiturgico`] ?? '',
    titulo: data[`${prefix}Titulo`] ?? '',
    citaEvangelio: data[`${prefix}Cita`] ?? '',
    primeraLectura: data[`${prefix}PrimeraLectura`] ?? '',
    segundaLectura: data[`${prefix}SegundaLectura`] ?? '',
    salmo: data[`${prefix}Salmo`] ?? '',
  };
}

export function useDailyReadings(date: string) {
  const [readings, setReadings] = useState<DailyReadings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReadings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Try cache first
      const cached = await AsyncStorage.getItem(`${CACHE_PREFIX}${date}`);
      if (cached) {
        setReadings(JSON.parse(cached));
        setLoading(false);
      }

      const db = getDatabase(getFirebaseApp());
      const snapshot = await get(ref(db, `seccion_oracion/lecturas/${date}`));

      if (snapshot.exists()) {
        const val = snapshot.val();
        const evangelioData = val.evangelio;
        const lectura1Data = val.lectura1;
        const lectura2Data = val.lectura2;
        const infoData = val.info;

        const evangelioPrefix = evangelioData?.activo ?? '';
        const lectura1Prefix = lectura1Data?.activo ?? '';
        const lectura2Prefix = lectura2Data?.activo ?? '';
        const infoPrefix = infoData?.activo ?? '';

        const result: DailyReadings = {
          evangelio: extractReading(evangelioData, evangelioPrefix),
          lectura1: extractReading(lectura1Data, lectura1Prefix),
          lectura2: extractReading(lectura2Data, lectura2Prefix),
          info: extractInfo(infoData, infoPrefix),
        };

        setReadings(result);
        await AsyncStorage.setItem(
          `${CACHE_PREFIX}${date}`,
          JSON.stringify(result),
        );
      } else if (!cached) {
        setReadings(null);
      }
    } catch (e: any) {
      console.error('Error loading readings:', e);
      setError(e.message ?? 'Error al cargar lecturas');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchReadings();
  }, [fetchReadings]);

  return { readings, loading, error, refetch: fetchReadings };
}
