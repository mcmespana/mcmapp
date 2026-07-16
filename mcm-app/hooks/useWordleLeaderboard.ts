import { logger } from '@/utils/logger';
import { useEffect, useState } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import { getFirebaseApp } from '../utils/firebaseApp';

interface LeaderboardEntry {
  userId: string;
  name: string;
  place?: string;
  attempts?: number;
  played?: number;
  average?: number;
}

export default function useWordleLeaderboard(
  dateKey: string,
  cycle: 'morning' | 'evening',
  userId: string,
  enabled: boolean,
) {
  const [topToday, setTopToday] = useState<LeaderboardEntry[]>([]);
  const [generalRanking, setGeneralRanking] = useState<LeaderboardEntry[]>([]);
  const [participationRanking, setParticipationRanking] = useState<
    LeaderboardEntry[]
  >([]);
  const [globalRank, setGlobalRank] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const fetchData = async () => {
      try {
        const db = getDatabase(getFirebaseApp());
        const [todaySnap, usersSnap, statsSnap] = await Promise.all([
          get(ref(db, `wordle/${dateKey}/${cycle}`)),
          get(ref(db, `wordle/users`)),
          get(ref(db, `wordle/stats`)),
        ]);

        const users = usersSnap.exists() ? usersSnap.val() : {};

        if (todaySnap.exists()) {
          const arr = Object.values(todaySnap.val() || []) as any[];
          arr.sort(
            (a, b) => a.attempts - b.attempts || a.timestamp - b.timestamp,
          );
          const top = arr.slice(0, 3).map((r) => ({
            userId: r.userId,
            name: r.userName || users[r.userId]?.name || 'Anónimo',
            place: r.userLocation || users[r.userId]?.place || '',
            attempts: r.attempts,
          }));
          setTopToday(top);
        } else {
          setTopToday([]);
        }

        if (statsSnap.exists()) {
          const statsData = statsSnap.val() as Record<string, any>;
          const entries: LeaderboardEntry[] = [];

          // ⚡ Bolt Optimization: Avoid chained Object.entries().map() and Object.entries().reduce()
          // that allocate intermediate arrays and closures for potentially large Firebase collections.
          for (const uid in statsData) {
            if (!Object.prototype.hasOwnProperty.call(statsData, uid)) continue;

            const data = statsData[uid];
            let totalAttempts = 0;

            if (data.distribution) {
              for (const k in data.distribution) {
                if (!Object.prototype.hasOwnProperty.call(data.distribution, k)) continue;
                totalAttempts += Number(k) * Number(data.distribution[k]);
              }
            }

            const played = data.played || 0;
            const avg = played ? totalAttempts / played : Infinity;

            entries.push({
              userId: uid,
              name: data.userName || users[uid]?.name || 'Anónimo',
              place: data.userLocation || users[uid]?.place || '',
              played,
              average: avg,
            });
          }

          const general = [...entries].sort((a, b) => (a.average ?? Infinity) - (b.average ?? Infinity));
          const participation = [...entries].sort(
            (a, b) => (b.played ?? 0) - (a.played ?? 0),
          );

          setGeneralRanking(general.slice(0, 5));
          setParticipationRanking(participation.slice(0, 5));

          const idx = general.findIndex((e) => e.userId === userId);
          if (idx !== -1) setGlobalRank(idx + 1);
        } else {
          setGeneralRanking([]);
          setParticipationRanking([]);
          setGlobalRank(null);
        }
      } catch (e) {
        logger.error('Error loading leaderboard', e);
      }
    };

    fetchData();
  }, [dateKey, cycle, userId, enabled]);

  return {
    topToday,
    generalRanking,
    participationRanking,
    globalRank,
  } as const;
}
