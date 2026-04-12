import { useState, useEffect } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import { getFirebaseApp } from '@/hooks/firebaseApp';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DailyReadings {
  evangelio?: {
    texto: string;
    cita: string;
    comentario: string;
    comentarista: string;
    url: string;
  };
  lectura1?: {
    texto: string;
    cita: string;
  };
  lectura2?: {
    texto: string;
    cita: string;
  };
  salmo?: {
    texto: string;
    cita: string;
  };
  info?: {
    diaLiturgico: string;
    titulo: string;
  };
}

const CACHE_PREFIX = '@daily_readings_';

export function useDailyReadings(dateStr: string) {
  const [readings, setReadings] = useState<DailyReadings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      if (!dateStr) return;

      try {
        setIsLoading(true);
        setError(null);

        // 1. Check local cache first
        const cacheKey = `${CACHE_PREFIX}${dateStr}`;
        let cached = await AsyncStorage.getItem(cacheKey);

        let foundInBookmarks: any = null;

        if (!cached) {
          // Fallback to bookmarks if not in regular cache
          try {
            const bStr = await AsyncStorage.getItem('@contigo_bookmarks');
            if (bStr) {
              const bookmarks = JSON.parse(bStr);
              const found = bookmarks.find((b: any) => b.date === dateStr);
              if (found && found.readings) {
                foundInBookmarks = found.readings;
                cached = JSON.stringify(foundInBookmarks);
              }
            }
          } catch (e) {}
        }

        if (cached) {
          if (isMounted) setReadings(foundInBookmarks || JSON.parse(cached));
          setIsLoading(false); // We can show cached data while we might re-fetch
        }

        // 2. Fetch from Firebase
        const db = getDatabase(getFirebaseApp());
        const snapshot = await get(
          ref(db, `seccion_oracion/lecturas/${dateStr}`),
        );

        if (snapshot.exists()) {
          const data = snapshot.val();

          // Parse dynamic fields based on "activo" key
          const parsedReadings: DailyReadings = {};

          // Evangelio
          if (data.evangelio) {
            const active = data.evangelio.activo || 'vidaNueva';
            parsedReadings.evangelio = {
              texto: data.evangelio[`${active}EvangelioTexto`] || '',
              cita: data.evangelio[`${active}Cita`] || '',
              comentario: data.evangelio[`${active}Comentario`] || '',
              comentarista: data.evangelio[`${active}Comentarista`] || '',
              url: data.evangelio[`${active}URL`] || '',
            };
          }

          // Lectura 1
          if (data.lectura1) {
            const active = data.lectura1.activo || 'vidaNueva';
            parsedReadings.lectura1 = {
              texto:
                data.lectura1[`${active}Lectura1Texto`] ||
                data.lectura1[`${active}Texto`] ||
                '',
              cita: data.lectura1[`${active}Cita`] || '',
            };
          }

          // Lectura 2
          if (data.lectura2) {
            const active = data.lectura2.activo || 'vidaNueva';
            parsedReadings.lectura2 = {
              texto:
                data.lectura2[`${active}Lectura2Texto`] ||
                data.lectura2[`${active}Texto`] ||
                '',
              cita: data.lectura2[`${active}Cita`] || '',
            };
          }

          // Salmo
          if (data.salmo) {
            const active = data.salmo.activo || 'vidaNueva';
            parsedReadings.salmo = {
              texto:
                data.salmo[`${active}SalmoTexto`] ||
                data.salmo[`${active}Texto`] ||
                '',
              cita: data.salmo[`${active}Cita`] || '',
            };
          }

          // Info
          if (data.info) {
            const active = data.info.activo || 'vidaNueva';
            parsedReadings.info = {
              diaLiturgico: data.info[`${active}DiaLiturgico`] || '',
              titulo: data.info[`${active}Titulo`] || '',
            };
          }

          if (isMounted) {
            setReadings(parsedReadings);
          }

          // Cache it
          await AsyncStorage.setItem(cacheKey, JSON.stringify(parsedReadings));
        } else if (!cached && isMounted) {
          // Only set empty if not cached
          setReadings(null);
        }
      } catch (err) {
        console.error('Failed to load daily readings:', err);
        if (isMounted)
          setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [dateStr]);

  return { readings, isLoading, error };
}
