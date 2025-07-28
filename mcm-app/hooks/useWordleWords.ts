import { useState, useEffect } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import { getFirebaseApp } from './firebaseApp';
import dailyWordsLocal from '@/assets/wordle-daily.json';

const FALLBACK_WORDS = ['ROMAN', 'AMIGO', 'JOVEN', 'SALVE', 'MARIA'];

export interface DailyWords {
  [date: string]: string[];
}

export default function useWordleWords() {
  const [words, setWords] = useState<DailyWords>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWordsFromFirebase = async () => {
      try {
        const db = getDatabase(getFirebaseApp());
        const wordsRef = ref(db, 'wordle/daily-words');
        const snapshot = await get(wordsRef);

        if (snapshot.exists()) {
          const firebaseWords = snapshot.val() as DailyWords;
          setWords(firebaseWords);
          console.log(
            'Palabras cargadas desde Firebase:',
            Object.keys(firebaseWords).length,
            'fechas',
          );
        } else {
          console.log(
            'No se encontraron palabras en Firebase, usando archivo local',
          );
          setWords(dailyWordsLocal);
        }
      } catch (error) {
        console.error('Error cargando palabras desde Firebase:', error);
        console.log('Usando palabras del archivo local como fallback');
        setWords(dailyWordsLocal);
      } finally {
        setLoading(false);
      }
    };

    fetchWordsFromFirebase();
  }, []);

  const getWordForDate = (
    dateKey: string,
    cycle: 'morning' | 'evening',
  ): string => {
    const cycleIndex = cycle === 'morning' ? 0 : 1;
    const hash = dateKey
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);

    // 1. Intentar obtener palabra de Firebase (si ya cargó)
    if (!loading && words[dateKey] && words[dateKey][cycleIndex]) {
      return words[dateKey][cycleIndex];
    }

    // 2. Fallback a wordle-daily.json local
    const localWords = dailyWordsLocal as DailyWords;
    if (localWords[dateKey] && localWords[dateKey][cycleIndex]) {
      return localWords[dateKey][cycleIndex];
    }

    // 3. Último recurso: usar cualquier palabra disponible de wordle-daily.json
    const availableDates = Object.keys(localWords);
    if (availableDates.length > 0) {
      const randomDate = availableDates[hash % availableDates.length];
      const randomWord =
        localWords[randomDate][cycleIndex] || localWords[randomDate][0];
      return randomWord;
    }

    // 4. Fallback final (solo si wordle-daily.json está completamente vacío)
    const fallbackWord = FALLBACK_WORDS[hash % FALLBACK_WORDS.length];
    return fallbackWord;
  };
  return {
    words,
    loading,
    getWordForDate,
  };
}
