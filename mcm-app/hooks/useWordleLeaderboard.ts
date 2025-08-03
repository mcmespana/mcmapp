import { useEffect, useState } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import { getFirebaseApp } from './firebaseApp';

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
            name: users[r.userId]?.name || 'Anónimo',
            place: users[r.userId]?.place || '',
            attempts: r.attempts,
          }));
          setTopToday(top);
        } else {
          setTopToday([]);
        }

        if (statsSnap.exists()) {
          const statsData = statsSnap.val() as Record<string, any>;
          const entries = Object.entries(statsData).map(([uid, data]) => {
            const totalAttempts = data.distribution
              ? Object.entries(data.distribution).reduce(
                  (sum, [k, v]) => sum + Number(k) * Number(v),
                  0,
                )
              : 0;
            const played = data.played || 0;
            const avg = played ? totalAttempts / played : Infinity;
            return {
              userId: uid,
              name: users[uid]?.name || 'Anónimo',
              place: users[uid]?.place || '',
              played,
              average: avg,
            };
          });

          const general = [...entries].sort((a, b) => a.average - b.average);
          const participation = [...entries].sort(
            (a, b) => b.played - a.played,
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
        console.error('Error loading leaderboard', e);
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
