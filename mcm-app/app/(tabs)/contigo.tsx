// app/(tabs)/contigo.tsx — Main "Contigo" tab: spiritual tools + habit tracker
import React, { useState, useCallback, useLayoutEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import { useLiturgicalInfo } from '@/hooks/useLiturgicalCalendar';
import useContigoHabits from '@/hooks/useContigoHabits';
import useDailyReadings from '@/hooks/useDailyReadings';
import ContigoToolCard from '@/components/contigo/ContigoToolCard';
import HabitWeekView from '@/components/contigo/HabitWeekView';
import LiturgicalBadge from '@/components/contigo/LiturgicalBadge';
import { EMOTIONS, DURATIONS } from '@/types/contigo';

export default function ContigoTab() {
  const navigation = useNavigation();
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];

  // Hide default tab header
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Habits
  const habits = useContigoHabits();
  const { todayRecord, todayStr, bestStreak, getWeekSummary } = habits;

  // Liturgical info for today
  const liturgical = useLiturgicalInfo(todayStr);

  // Today's readings (for subtitle on the card)
  const { readings, hasEvangelio } = useDailyReadings(todayStr);

  // Weekly tracker state
  const [weekOffset, setWeekOffset] = useState(0);
  const currentWeekStart = useMemo(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - diff + weekOffset * 7);
    return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
  }, [weekOffset]);

  const weekDates = useMemo(
    () => habits.getWeekDates(currentWeekStart),
    [currentWeekStart, habits],
  );
  const weekRecords = useMemo(
    () => habits.getWeekSummary(currentWeekStart),
    [currentWeekStart, habits],
  );

  // Gospel card subtitle
  const evangelioSubtitle = hasEvangelio
    ? `${readings?.info?.citaEvangelio ?? ''} · ${liturgical.season?.nombre ?? ''}`
    : (liturgical.season?.nombre ?? '');

  // Prayer card info
  const prayerStatus = todayRecord?.prayerDone
    ? (() => {
        const dur = DURATIONS.find((d) => d.key === todayRecord.prayerDuration);
        const emo = EMOTIONS.find((e) => e.key === todayRecord.prayerEmotion);
        return `${dur?.label ?? ''} · ${emo?.emoji ?? ''} ${emo?.label ?? ''}`;
      })()
    : 'Pendiente hoy';

  // Gradient colors based on liturgical season
  const gradientColors = useMemo(() => {
    const base = liturgical.color;
    if (scheme === 'dark') {
      return [base + '25', base + '08', theme.background] as const;
    }
    return [base + '18', base + '06', theme.background] as const;
  }, [liturgical.color, scheme, theme.background]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={['top']}
    >
      <ScrollView
        style={{ backgroundColor: 'transparent' }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Cabecera con gradiente litúrgico ── */}
        <LinearGradient
          colors={gradientColors as any}
          style={styles.headerGradient}
        >
          <Text style={[styles.title, { color: theme.text }]}>Contigo</Text>
          <Text style={[styles.subtitle, { color: theme.icon }]}>
            Propuestas para la oración de cada día
          </Text>
          <LiturgicalBadge info={liturgical} />
        </LinearGradient>

        {/* ── Tool Cards ── */}
        <View style={styles.cardsSection}>
          {/* 1. Evangelio del Día */}
          <ContigoToolCard
            icon="menu-book"
            iconColor="#F59E0B"
            title="Evangelio del Día"
            subtitle={evangelioSubtitle}
            statusText={todayRecord?.readingDone ? 'Leído hoy' : 'Sin leer'}
            statusDone={todayRecord?.readingDone ?? false}
            onPress={() => router.push('/screens/EvangelioScreen' as any)}
          />

          {/* 2. Mi Rato de Oración */}
          <ContigoToolCard
            icon="self-improvement"
            iconColor="#6B3FA0"
            title="Mi Rato de Oración"
            statusText={prayerStatus}
            statusDone={todayRecord?.prayerDone ?? false}
            streakCount={habits.getStreak('prayer')}
            onPress={() => router.push('/screens/OracionScreen' as any)}
          />

          {/* 3. Revisión del Día (futuro) */}
          <ContigoToolCard
            icon="search"
            iconColor="#31AADF"
            title="Revisión del Día"
            subtitle="Próximamente"
            disabled
          />
        </View>

        {/* ── Habit Tracker Semanal ── */}
        <View style={styles.trackerSection}>
          <HabitWeekView
            weekDates={weekDates}
            weekRecords={weekRecords}
            todayStr={todayStr}
            streak={bestStreak}
            onPrevWeek={() => setWeekOffset((o) => o - 1)}
            onNextWeek={() => setWeekOffset((o) => o + 1)}
          />
        </View>

        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  headerGradient: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: 6,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  cardsSection: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm + 4,
  },
  trackerSection: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
});
