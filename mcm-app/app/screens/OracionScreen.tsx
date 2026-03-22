// app/screens/OracionScreen.tsx — Prayer registration: duration + emotion + history
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import { radii, shadows } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import useContigoHabits from '@/hooks/useContigoHabits';
import DateNavigator from '@/components/contigo/DateNavigator';
import PrayerLogger from '@/components/contigo/PrayerLogger';
import { DURATIONS, EMOTIONS } from '@/types/contigo';
import type { PrayerDuration, Emotion } from '@/types/contigo';

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function OracionScreen() {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];
  const todayStr = getTodayStr();

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const minDate = addDays(todayStr, -30);
  const maxDate = todayStr; // Can only register prayer for today or past

  const goToPrev = useCallback(() => {
    setSelectedDate((d) => {
      const prev = addDays(d, -1);
      return prev >= minDate ? prev : d;
    });
  }, [minDate]);

  const goToNext = useCallback(() => {
    setSelectedDate((d) => {
      const next = addDays(d, 1);
      return next <= maxDate ? next : d;
    });
  }, [maxDate]);

  const habits = useContigoHabits();
  const dayRecord = habits.getRecord(selectedDate);
  const prayerDone = dayRecord?.prayerDone ?? false;
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = useCallback(
    (duration: PrayerDuration, emotion: Emotion) => {
      habits.setPrayerDone(selectedDate, duration, emotion);
      setIsEditing(false);
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    [habits, selectedDate],
  );

  // Monthly mini-calendar
  const [, selMonth] = selectedDate.split('-').map(Number);
  const selYear = parseInt(selectedDate.split('-')[0]);
  const monthStats = useMemo(
    () => habits.getMonthStats(selYear, selMonth),
    [habits, selYear, selMonth],
  );

  // Days in month for mini calendar
  const daysInMonth = new Date(selYear, selMonth, 0).getDate();
  const monthDays = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateStr = `${selYear}-${String(selMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const rec = habits.getRecord(dateStr);
      return { day, dateStr, record: rec };
    });
  }, [selYear, selMonth, daysInMonth, habits]);

  // First day of month (0=Sun, 1=Mon...)
  const firstDayOfWeek = new Date(selYear, selMonth - 1, 1).getDay();
  const mondayOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const streakPrayer = habits.getStreak('prayer');

  const durLabel =
    DURATIONS.find((d) => d.key === dayRecord?.prayerDuration)?.label ?? '';
  const emoConfig = EMOTIONS.find((e) => e.key === dayRecord?.prayerEmotion);
  const mostFreqEmo = EMOTIONS.find(
    (e) => e.key === monthStats.mostFrequentEmotion,
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Mi Rato de Oración',
          headerBackTitle: 'Contigo',
        }}
      />
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.background }]}
        edges={['bottom']}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Date Navigator */}
          <DateNavigator
            dateStr={selectedDate}
            onPrev={goToPrev}
            onNext={goToNext}
            canGoPrev={selectedDate > minDate}
            canGoNext={selectedDate < maxDate}
          />

          {/* ── Summary or Logger ── */}
          {prayerDone && !isEditing ? (
            <View
              style={[
                styles.summaryCard,
                {
                  backgroundColor: theme.card,
                  borderColor:
                    scheme === 'dark'
                      ? 'rgba(255,255,255,0.09)'
                      : 'rgba(0,0,0,0.07)',
                },
              ]}
            >
              <View style={styles.summaryIcon}>
                <MaterialIcons name="check-circle" size={36} color="#4CAF50" />
              </View>
              <Text style={[styles.summaryTitle, { color: theme.text }]}>
                Oración registrada
              </Text>
              <View style={styles.summaryRow}>
                <View
                  style={[
                    styles.summaryChip,
                    { backgroundColor: '#6B3FA0' + '15' },
                  ]}
                >
                  <MaterialIcons name="schedule" size={16} color="#6B3FA0" />
                  <Text style={[styles.summaryChipText, { color: '#6B3FA0' }]}>
                    {durLabel}
                  </Text>
                </View>
                {emoConfig && (
                  <View
                    style={[
                      styles.summaryChip,
                      { backgroundColor: emoConfig.color + '15' },
                    ]}
                  >
                    <Text style={{ fontSize: 16 }}>{emoConfig.emoji}</Text>
                    <Text
                      style={[
                        styles.summaryChipText,
                        { color: emoConfig.color },
                      ]}
                    >
                      {emoConfig.label}
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={[styles.editBtn, { borderColor: theme.icon + '30' }]}
                onPress={() => setIsEditing(true)}
              >
                <MaterialIcons name="edit" size={14} color={theme.icon} />
                <Text style={[styles.editBtnText, { color: theme.icon }]}>
                  Editar
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View
              style={[
                styles.loggerCard,
                {
                  backgroundColor: theme.card,
                  borderColor:
                    scheme === 'dark'
                      ? 'rgba(255,255,255,0.09)'
                      : 'rgba(0,0,0,0.07)',
                },
              ]}
            >
              <PrayerLogger
                onSave={handleSave}
                onCancel={prayerDone ? () => setIsEditing(false) : undefined}
              />
            </View>
          )}

          {/* ── Streak ── */}
          {streakPrayer > 0 && (
            <View style={styles.streakRow}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={[styles.streakText, { color: theme.text }]}>
                {streakPrayer} {streakPrayer === 1 ? 'día' : 'días'} seguidos
              </Text>
            </View>
          )}

          {/* ── Monthly Mini-Calendar ── */}
          <View
            style={[
              styles.monthCard,
              {
                backgroundColor: theme.card,
                borderColor:
                  scheme === 'dark'
                    ? 'rgba(255,255,255,0.09)'
                    : 'rgba(0,0,0,0.07)',
              },
            ]}
          >
            <Text style={[styles.monthTitle, { color: theme.text }]}>
              {getMonthName(selMonth)} {selYear}
            </Text>

            {/* Day headers */}
            <View style={styles.calRow}>
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
                <View key={d} style={styles.calCell}>
                  <Text style={[styles.calHeader, { color: theme.icon }]}>
                    {d}
                  </Text>
                </View>
              ))}
            </View>

            {/* Days grid */}
            <View style={styles.calGrid}>
              {/* Empty cells for offset */}
              {Array.from({ length: mondayOffset }, (_, i) => (
                <View key={`empty-${i}`} style={styles.calCell} />
              ))}
              {monthDays.map(({ day, record }) => {
                const hasPrayer = record?.prayerDone;
                const emoColor = hasPrayer
                  ? (EMOTIONS.find((e) => e.key === record?.prayerEmotion)
                      ?.color ?? '#6B3FA0')
                  : undefined;

                return (
                  <View key={day} style={styles.calCell}>
                    <Text
                      style={[
                        styles.calDay,
                        { color: theme.icon, opacity: 0.5 },
                      ]}
                    >
                      {day}
                    </Text>
                    {hasPrayer && (
                      <View
                        style={[styles.calDot, { backgroundColor: emoColor }]}
                      />
                    )}
                  </View>
                );
              })}
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <StatItem
                label="Días con oración"
                value={`${monthStats.prayerDays}/${daysInMonth}`}
                theme={theme}
              />
              <StatItem
                label="Tiempo total"
                value={`~${monthStats.totalPrayerMinutes} min`}
                theme={theme}
              />
              {mostFreqEmo && (
                <StatItem
                  label="Más frecuente"
                  value={`${mostFreqEmo.emoji} ${mostFreqEmo.label}`}
                  theme={theme}
                />
              )}
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

function StatItem({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: typeof Colors.light;
}) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.icon }]}>{label}</Text>
    </View>
  );
}

function getMonthName(m: number): string {
  return [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ][m - 1];
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  summaryCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm + 2,
    ...shadows.sm,
  },
  summaryIcon: {
    marginBottom: 2,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
  },
  summaryChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    marginTop: spacing.xs,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  loggerCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.lg,
    ...shadows.sm,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  streakEmoji: {
    fontSize: 20,
  },
  streakText: {
    fontSize: 15,
    fontWeight: '700',
  },
  monthCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm + 2,
    ...shadows.sm,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  calRow: {
    flexDirection: 'row',
  },
  calGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 4,
    gap: 2,
  },
  calHeader: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  calDay: {
    fontSize: 11,
    fontWeight: '500',
  },
  calDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10,
    opacity: 0.7,
  },
});
