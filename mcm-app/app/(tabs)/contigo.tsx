// app/(tabs)/contigo.tsx
// "Contigo" — Propuestas para la oración de cada día
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import { radii, shadows } from '@/constants/uiStyles';
import { useContigoHabits } from '@/hooks/useContigoHabits';
import { useLiturgicalInfo } from '@/hooks/useLiturgicalCalendar';
import { useDailyReadings } from '@/hooks/useDailyReadings';
import LiturgicalBadge from '@/components/contigo/LiturgicalBadge';
import ContigoToolCard from '@/components/contigo/ContigoToolCard';
import HabitWeekView from '@/components/contigo/HabitWeekView';

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function currentMondayISO(): string {
  const d = new Date();
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return monday.toISOString().split('T')[0];
}

export default function ContigoTab() {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];
  const isDark = scheme === 'dark';

  const today = todayISO();
  const [weekStart, setWeekStart] = useState(currentMondayISO());

  const { habits, todayRecord, getStreak, getWeekDates } = useContigoHabits();
  const liturgical = useLiturgicalInfo(today);
  const { readings, available: readingsAvailable } = useDailyReadings(today);

  const weekDates = getWeekDates(weekStart);

  const readingStreak = getStreak('reading');
  const prayerStreak = getStreak('prayer');

  // Info from today's Firebase readings
  const info = readings?.info;
  const activeSource = info?.activo ?? 'vidaNueva';
  const evangelioCita =
    info?.[`${activeSource}Evangelio` as keyof typeof info] ??
    readings?.evangelio?.[
      `${activeSource}Cita` as keyof typeof readings.evangelio
    ] ??
    null;
  const diaLiturgico =
    info?.[`${activeSource}DiaLiturgico` as keyof typeof info] ?? null;

  // Week navigation
  function goToPrevWeek() {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() - 7);
    setWeekStart(d.toISOString().split('T')[0]);
  }
  function goToNextWeek() {
    const d = new Date(weekStart + 'T00:00:00');
    d.setDate(d.getDate() + 7);
    const newStart = d.toISOString().split('T')[0];
    // Don't go past the current week
    if (newStart <= currentMondayISO()) {
      setWeekStart(newStart);
    }
  }
  const isCurrentWeek = weekStart === currentMondayISO();

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={['top']}
    >
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>
              Contigo
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.icon }]}>
              Propuestas para la oración de cada día
            </Text>
          </View>
          <LiturgicalBadge info={liturgical} style={styles.headerBadge} />
        </View>

        {/* Liturgical day label */}
        {!!diaLiturgico && (
          <Text style={[styles.diaLiturgico, { color: theme.icon }]}>
            {diaLiturgico}
          </Text>
        )}

        {/* ── Tool cards ── */}
        <View style={[styles.section, { marginTop: spacing.md }]}>
          {/* 1. Evangelio del Día */}
          <ContigoToolCard
            icon="menu-book"
            iconColor="#F59E0B"
            title="Evangelio del Día"
            subtitle={
              evangelioCita
                ? (evangelioCita as string)
                : readingsAvailable
                  ? 'Lecturas de hoy disponibles'
                  : 'Toca para leer'
            }
            badge={
              liturgical.celebracion
                ? {
                    text: liturgical.celebracion,
                    color: liturgical.color,
                    bgColor: liturgical.color + '22',
                  }
                : undefined
            }
            statusText={
              todayRecord?.readingDone ? 'Leído hoy' : 'Pendiente de leer'
            }
            statusDone={todayRecord?.readingDone}
            streak={readingStreak}
            onPress={() =>
              router.push({
                pathname: '/screens/EvangelioScreen',
                params: { date: today },
              } as any)
            }
          />

          {/* 2. Mi Rato de Oración */}
          <ContigoToolCard
            icon="self-improvement"
            iconColor="#31AADF"
            title="Mi Rato de Oración"
            subtitle={
              todayRecord?.prayerDone
                ? `${todayRecord.prayerDuration ? getPrayerDurationShort(todayRecord.prayerDuration) : ''}`
                : 'Registra tu oración de hoy'
            }
            statusText={
              todayRecord?.prayerDone ? 'Registrado hoy' : 'Pendiente'
            }
            statusDone={todayRecord?.prayerDone}
            streak={prayerStreak}
            onPress={() =>
              router.push({
                pathname: '/screens/OracionScreen',
                params: { date: today },
              } as any)
            }
          />

          {/* 3. Examen del Día (placeholder) */}
          <ContigoToolCard
            icon="search"
            iconColor="#9D1E74"
            title="Examen del Día"
            subtitle="Revisión de conciencia"
            disabled
          />
        </View>

        {/* ── Habit Tracker semanal ── */}
        <View
          style={[
            styles.trackerCard,
            {
              backgroundColor: theme.card,
              borderColor: isDark
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.06)',
              ...shadows.sm,
            },
          ]}
        >
          {/* Tracker header */}
          <View style={styles.trackerHeader}>
            <View style={styles.trackerTitleRow}>
              <Text style={[styles.trackerTitle, { color: theme.text }]}>
                Mi Semana
              </Text>
              {(readingStreak > 1 || prayerStreak > 1) && (
                <Text style={styles.streakBadge}>
                  🔥{' '}
                  {Math.max(readingStreak, prayerStreak)} días seguidos
                </Text>
              )}
            </View>

            {/* Week navigation */}
            <View style={styles.weekNav}>
              <TouchableOpacity
                onPress={goToPrevWeek}
                style={styles.navBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons
                  name="chevron-left"
                  size={20}
                  color={theme.icon}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={goToNextWeek}
                style={[styles.navBtn, isCurrentWeek && styles.navBtnDisabled]}
                disabled={isCurrentWeek}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons
                  name="chevron-right"
                  size={20}
                  color={isCurrentWeek ? theme.icon + '40' : theme.icon}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Habit legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={[styles.legendText, { color: theme.icon }]}>
                Evangelio
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#31AADF' }]} />
              <Text style={[styles.legendText, { color: theme.icon }]}>
                Oración
              </Text>
            </View>
          </View>

          {/* Week grid */}
          <HabitWeekView
            weekDates={weekDates}
            habits={habits}
            today={today}
            onDayPress={(date) => {
              if (date <= today) {
                router.push({
                  pathname: '/screens/EvangelioScreen',
                  params: { date },
                } as any);
              }
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function getPrayerDurationShort(d: string): string {
  const map: Record<string, string> = {
    less_than_1: '< 1 min',
    '2_to_4': '2–4 min',
    '5_to_10': '5–10 min',
    '10_to_15': '10–15 min',
    more_than_15: '> 15 min',
  };
  return map[d] ?? d;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 } as ViewStyle,

  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl + 16,
  } as ViewStyle,

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: spacing.sm,
  } as ViewStyle,
  headerText: {
    flex: 1,
    gap: 3,
  } as ViewStyle,
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  } as TextStyle,
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  } as TextStyle,
  headerBadge: {
    marginTop: 4,
    alignItems: 'flex-end',
  } as ViewStyle,
  diaLiturgico: {
    fontSize: 12,
    fontStyle: 'italic',
    opacity: 0.7,
    marginBottom: spacing.sm,
  } as TextStyle,

  section: {} as ViewStyle,

  // ── Habit Tracker card ──
  trackerCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  } as ViewStyle,
  trackerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as ViewStyle,
  trackerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  } as ViewStyle,
  trackerTitle: {
    fontSize: 15,
    fontWeight: '700',
  } as TextStyle,
  streakBadge: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
  } as TextStyle,
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  } as ViewStyle,
  navBtn: {
    padding: 4,
  } as ViewStyle,
  navBtnDisabled: {
    opacity: 0.3,
  } as ViewStyle,
  legend: {
    flexDirection: 'row',
    gap: spacing.md,
  } as ViewStyle,
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  } as ViewStyle,
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  } as ViewStyle,
  legendText: {
    fontSize: 11,
    fontWeight: '500',
  } as TextStyle,
});
