import React, { useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useContigoHabits, type DayRecord } from '@/hooks/useContigoHabits';
import { useDailyReadings } from '@/hooks/useDailyReadings';
import { warm, formatDateLong, MONTHS_CAP } from '@/components/contigo/theme';
import {
  HabitTile,
  HeroCard,
  EvangelioTeaserCard,
  WeekStrip,
  StatCard,
  MonthHeatmap,
} from '@/components/contigo/HomeWidgets';
import { LiturgicalBadge } from '@/components/contigo/LiturgicalBadge';

export default function ContigoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const W = warm(isDark);

  const {
    todayStr,
    todayRecord,
    records,
    getStreak,
    getTotalMinutesWeek,
    getReadingsMonth,
    getActiveDaysMonth,
    reloadRecords,
    isRevisionDone,
  } = useContigoHabits();

  const { readings } = useDailyReadings(todayStr);

  useFocusEffect(
    useCallback(() => {
      reloadRecords();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const readingDone = !!todayRecord?.readingDone;
  const prayerDone = !!todayRecord?.prayerDone;
  const revisionDone = isRevisionDone(todayStr);
  const doneCount = [readingDone, prayerDone, revisionDone].filter(
    Boolean,
  ).length;

  const prayStreak = getStreak('prayer');
  const totalMins = getTotalMinutesWeek(todayStr);
  const totalReads = getReadingsMonth(todayStr);
  const activeDays = getActiveDaysMonth(todayStr);

  const [, mNum] = todayStr.split('-').map(Number);
  const year = todayStr.split('-')[0];
  const monthLabel = `${MONTHS_CAP[mNum - 1]} ${year}`;

  // Tapping a calendar day opens the matching record screen.
  // Priority: revision → oración → evangelio (most reflective first).
  const handleDayPress = useCallback(
    (date: string, rec: DayRecord | null) => {
      if (!rec) return;
      if (rec.revisionDone) {
        router.push({
          pathname: '/(tabs)/contigo/revision' as never,
          params: { date },
        });
      } else if (rec.prayerDone) {
        router.push({
          pathname: '/(tabs)/contigo/oracion' as never,
          params: { date },
        });
      } else if (rec.readingDone) {
        router.push({
          pathname: '/(tabs)/contigo/evangelio' as never,
          params: { date },
        });
      }
    },
    [router],
  );

  const bgGradient = isDark
    ? (['#1A1712', '#100F0C'] as const)
    : (['#FAF6F0', '#F0E8D8'] as const);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={bgGradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 14,
          paddingBottom: insets.bottom + 60,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────── */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.title, { color: isDark ? '#F5EFE3' : '#2A1E0E' }]}
            >
              Contigo
            </Text>
            <Text style={[styles.subtitle, { color: W.textSec }]}>
              {formatDateLong(todayStr)}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.headerBadgeWrap}>
              <LiturgicalBadge dateStr={todayStr} />
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/contigo/bookmarks')}
              style={[
                styles.headerBtn,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.07)'
                    : 'rgba(0,0,0,0.05)',
                  borderColor: W.border,
                },
              ]}
              accessibilityLabel="Ver evangelios guardados"
            >
              <MaterialIcons name="bookmarks" size={18} color={W.accent} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Hero card ──────────────────────────────── */}
        <View style={styles.section}>
          <HeroCard
            doneCount={doneCount}
            prayStreak={prayStreak}
            totalMins={totalMins}
            isDark={isDark}
          />
        </View>

        {/* ── Three habit tiles ──────────────────────── */}
        <View style={[styles.section, styles.tilesRow]}>
          <HabitTile
            habitKey="evangelio"
            done={readingDone}
            onPress={() => router.push('/(tabs)/contigo/evangelio')}
            isDark={isDark}
          />
          <HabitTile
            habitKey="oracion"
            done={prayerDone}
            onPress={() => router.push('/(tabs)/contigo/oracion')}
            isDark={isDark}
          />
          <HabitTile
            habitKey="revision"
            done={revisionDone}
            onPress={() => router.push('/(tabs)/contigo/revision' as never)}
            isDark={isDark}
          />
        </View>

        {/* ── Evangelio teaser ───────────────────────── */}
        <View style={styles.section}>
          <EvangelioTeaserCard
            titulo={readings?.info?.titulo}
            cita={readings?.evangelio?.cita}
            texto={readings?.evangelio?.texto}
            readingDone={readingDone}
            onOpen={() => router.push('/(tabs)/contigo/evangelio')}
            isDark={isDark}
          />
        </View>

        {/* ── Esta semana ────────────────────────────── */}
        <View style={[styles.section, { paddingTop: 18 }]}>
          <Text style={[styles.smallLabel, { color: W.textMuted }]}>
            ESTA SEMANA
          </Text>
          <View
            style={[
              styles.cardSurface,
              {
                backgroundColor: W.bgCard,
                borderColor: W.border,
                shadowColor: W.shadow,
              },
            ]}
          >
            <WeekStrip records={records} todayStr={todayStr} isDark={isDark} />
          </View>
        </View>

        {/* ── Stats ──────────────────────────────────── */}
        <View style={[styles.section, styles.statsRow]}>
          <StatCard
            icon="🔥"
            value={prayStreak}
            label={'racha de\noración'}
            color={W.fire}
            isDark={isDark}
          />
          <StatCard
            icon="⏱"
            value={`${totalMins}'`}
            label={'min\nesta sem.'}
            color={W.accent}
            isDark={isDark}
          />
          <StatCard
            icon="📖"
            value={totalReads}
            label={'lecturas\neste mes'}
            color={W.blue}
            isDark={isDark}
          />
        </View>

        {/* ── Calendario completo ────────────────────── */}
        <View style={[styles.section, { paddingTop: 18 }]}>
          <View style={styles.monthHdr}>
            <Text style={[styles.smallLabel, { color: W.textMuted }]}>
              {monthLabel.toUpperCase()}
            </Text>
            <View
              style={[
                styles.monthBadge,
                {
                  backgroundColor: isDark
                    ? 'rgba(218,165,32,0.12)'
                    : 'rgba(196,146,42,0.10)',
                },
              ]}
            >
              <Text style={[styles.monthBadgeText, { color: W.accent }]}>
                {activeDays} {activeDays === 1 ? 'día activo' : 'días activos'}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.cardSurface,
              {
                backgroundColor: W.bgCard,
                borderColor: W.border,
                shadowColor: W.shadow,
              },
            ]}
          >
            <MonthHeatmap
              records={records}
              todayStr={todayStr}
              isDark={isDark}
              onDayPress={handleDayPress}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 6,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1.4,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  headerBadgeWrap: { transform: [{ scale: 0.92 }] },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  tilesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cardSurface: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
  },
  smallLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  monthHdr: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  monthBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  monthBadgeText: { fontSize: 11, fontWeight: '700' },
});
