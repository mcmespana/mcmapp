// hooks/useDailyReview.ts — Hook para gestionar las revisiones del día
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@daily_reviews';

export interface ReviewStep {
  /** Step 1: Presencia de Dios — free text */
  presencia?: string;
  /** Step 2: Dar gracias — selected tags + free text */
  gracias_tags?: string[];
  gracias_texto?: string;
  /** Step 3: Pedir perdón — selected tags + free text */
  perdon_tags?: string[];
  perdon_texto?: string;
  /** Step 4: Conocimiento propio — free text */
  conocimiento_texto?: string;
  /** Step 5: Mañana — free text */
  manana_texto?: string;
  /** Final closing — free text */
  cierre_texto?: string;
}

export interface DailyReview {
  date: string; // 'YYYY-MM-DD'
  steps: ReviewStep;
  completedAt: number; // timestamp
}

export type ReviewsRecord = Record<string, DailyReview>;

interface UseDailyReview {
  reviews: ReviewsRecord;
  loading: boolean;
  saveReview: (date: string, steps: ReviewStep) => Promise<void>;
  getReview: (date: string) => DailyReview | null;
  deleteReview: (date: string) => Promise<void>;
  getAllReviewsSorted: () => DailyReview[];
}

export function useDailyReview(): UseDailyReview {
  const [reviews, setReviews] = useState<ReviewsRecord>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await AsyncStorage.getItem(STORAGE_KEY);
        if (data) {
          setReviews(JSON.parse(data));
        }
      } catch (e) {
        console.error('Failed loading daily reviews', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const persist = useCallback(async (updated: ReviewsRecord) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed saving daily reviews', e);
    }
  }, []);

  const saveReview = useCallback(
    async (date: string, steps: ReviewStep) => {
      const review: DailyReview = {
        date,
        steps,
        completedAt: Date.now(),
      };
      const updated = { ...reviews, [date]: review };
      setReviews(updated);
      await persist(updated);
    },
    [reviews, persist],
  );

  const getReview = useCallback(
    (date: string): DailyReview | null => {
      return reviews[date] ?? null;
    },
    [reviews],
  );

  const deleteReview = useCallback(
    async (date: string) => {
      const updated = { ...reviews };
      delete updated[date];
      setReviews(updated);
      await persist(updated);
    },
    [reviews, persist],
  );

  const getAllReviewsSorted = useCallback((): DailyReview[] => {
    return Object.values(reviews).sort(
      (a, b) => b.completedAt - a.completedAt,
    );
  }, [reviews]);

  return {
    reviews,
    loading,
    saveReview,
    getReview,
    deleteReview,
    getAllReviewsSorted,
  };
}
