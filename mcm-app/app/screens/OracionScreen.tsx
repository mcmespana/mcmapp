// app/screens/OracionScreen.tsx
// Mi Rato de Oración — registro diario de oración
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import { radii, shadows } from '@/constants/uiStyles';
import {
  useContigoHabits,
  EMOTION_COLORS,
  EMOTION_LABELS,
  EMOTION_EMOJIS,
  PRAYER_DURATION_LABELS,
  PrayerDuration,
  Emotion,
} from '@/hooks/useContigoHabits';
import PrayerLogger from '@/components/contigo/PrayerLogger';

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const DAYS_ES = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado',
];

function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAYS_ES[d.getDay()]} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]}`;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/** Returns the days of the current calendar month for a given date */
function getMonthDays(dateStr: string): string[] {
  const d = new Date(dateStr + 'T00:00:00');
  const year = d.getFullYear();
  const month = d.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: string[] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
  }
  return days;
}

export default function OracionScreen() {
  const params = useLocalSearchParams<{ date?: string }>();
  const today = todayISO();
  const [date, setDate] = useState(params.date ?? today);
  const [showLogger, setShowLogger] = useState(false);

  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];
  const isDark = scheme === 'dark';

  const { habits, getRecord, setPrayerRecord, clearPrayerRecord, getStreak } =
    useContigoHabits();

  const record = getRecord(date);
  const isToday = date === today;
  const canGoNext = date < today;

  const prayerStreak = getStreak('prayer');
  const monthDays = getMonthDays(date);

  const handleSave = useCallback(
    async (duration: PrayerDuration, emotion: Emotion) => {
      await setPrayerRecord(date, duration, emotion);
      setShowLogger(false);
    },
    [date, setPrayerRecord],
  );

  const handleEdit = useCallback(async () => {
    if (record?.prayerDone) {
      await clearPrayerRecord(date);
    }
    setShowLogger(true);
  }, [record, date, clearPrayerRecord]);

  // Stats for the month
  const monthStats = monthDays.reduce(
    (acc, d) => {
      const r = habits[d];
      if (r?.prayerDone) {
        acc.days++;
        if (r.prayerEmotion) {
          acc.emotions[r.prayerEmotion] = (acc.emotions[r.prayerEmotion] ?? 0) + 1;
        }
      }
      return acc;
    },
    { days: 0, emotions: {} as Record<string, number> },
  );
  const topEmotion = Object.entries(monthStats.emotions).sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0] as Emotion | undefined;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={['top']}
    >
      {/* ── Top bar ── */}
      <View
        style={[
          styles.topBar,
          { borderBottomColor: isDark ? '#ffffff10' : '#00000010' },
        ]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>

        {/* Date navigator */}
        <View style={styles.dateNav}>
          <TouchableOpacity
            onPress={() => {
              setDate((d) => offsetDate(d, -1));
              setShowLogger(false);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="chevron-left" size={24} color={theme.icon} />
          </TouchableOpacity>

          <Text style={[styles.dateText, { color: theme.text }]}>
            {isToday ? 'Hoy' : formatDateLong(date)}
          </Text>

          <TouchableOpacity
            onPress={() => {
              if (canGoNext) {
                setDate((d) => offsetDate(d, 1));
                setShowLogger(false);
              }
            }}
            disabled={!canGoNext}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons
              name="chevron-right"
              size={24}
              color={canGoNext ? theme.icon : theme.icon + '30'}
            />
          </TouchableOpacity>
        </View>

        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Title ── */}
        <Text style={[styles.screenTitle, { color: theme.text }]}>
          Mi Rato de Oración
        </Text>

        {/* Streak badge */}
        {prayerStreak > 1 && (
          <View style={styles.streakRow}>
            <Text style={styles.streakText}>
              🔥 {prayerStreak} días seguidos orando
            </Text>
          </View>
        )}

        {/* ── Status / Logger ── */}
        {showLogger ? (
          <View
            style={[
              styles.loggerCard,
              {
                backgroundColor: theme.card,
                borderColor: isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(0,0,0,0.06)',
                ...shadows.sm,
              },
            ]}
          >
            <PrayerLogger
              onSave={handleSave}
              onCancel={() => setShowLogger(false)}
            />
          </View>
        ) : record?.prayerDone ? (
          /* Already recorded — show summary */
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: '#4CAF5012',
                borderColor: '#4CAF5040',
              },
            ]}
          >
            <MaterialIcons name="check-circle" size={32} color="#4CAF50" />
            <View style={styles.summaryContent}>
              <Text style={[styles.summaryTitle, { color: theme.text }]}>
                {isToday ? 'Has orado hoy' : `Oraste ${formatDateLong(date)}`}
              </Text>
              {record.prayerDuration && (
                <Text style={[styles.summaryDetail, { color: theme.icon }]}>
                  {PRAYER_DURATION_LABELS[record.prayerDuration]}
                </Text>
              )}
              {record.prayerEmotion && (
                <Text style={[styles.summaryDetail, { color: theme.icon }]}>
                  {EMOTION_EMOJIS[record.prayerEmotion]}{' '}
                  {EMOTION_LABELS[record.prayerEmotion]}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={handleEdit} style={styles.editBtn}>
              <MaterialIcons name="edit" size={18} color={theme.icon} />
              <Text style={[styles.editText, { color: theme.icon }]}>
                Editar
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Not recorded yet */
          <View
            style={[
              styles.pendingCard,
              {
                backgroundColor: theme.card,
                borderColor: isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(0,0,0,0.06)',
                ...shadows.sm,
              },
            ]}
          >
            <MaterialIcons
              name="self-improvement"
              size={36}
              color="#31AADF"
              style={{ opacity: 0.7 }}
            />
            <Text style={[styles.pendingTitle, { color: theme.text }]}>
              {isToday
                ? '¿Has orado hoy?'
                : `¿Oraste ${formatDateLong(date)}?`}
            </Text>
            <Text style={[styles.pendingSubtitle, { color: theme.icon }]}>
              Registra tu rato de oración
            </Text>
            <TouchableOpacity
              style={[styles.logBtn, { backgroundColor: '#31AADF' }]}
              onPress={() => setShowLogger(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.logBtnText}>Registrar oración</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Monthly mini-calendar ── */}
        <View
          style={[
            styles.monthCard,
            {
              backgroundColor: theme.card,
              borderColor: isDark
                ? 'rgba(255,255,255,0.07)'
                : 'rgba(0,0,0,0.05)',
              ...shadows.sm,
            },
          ]}
        >
          <View style={styles.monthHeader}>
            <Text style={[styles.monthTitle, { color: theme.text }]}>
              {(() => {
                const d = new Date(date + 'T00:00:00');
                return `${MONTHS_ES[d.getMonth()].charAt(0).toUpperCase() + MONTHS_ES[d.getMonth()].slice(1)} ${d.getFullYear()}`;
              })()}
            </Text>
            {monthStats.days > 0 && (
              <Text style={[styles.monthStats, { color: theme.icon }]}>
                {monthStats.days}/{monthDays.length} días
              </Text>
            )}
          </View>

          {/* Stats row */}
          {topEmotion && (
            <Text style={[styles.monthSubStats, { color: theme.icon }]}>
              Emoción más frecuente:{' '}
              {EMOTION_EMOJIS[topEmotion]} {EMOTION_LABELS[topEmotion]}
            </Text>
          )}

          {/* Day dots grid */}
          <View style={styles.dotsGrid}>
            {monthDays.map((d) => {
              const r = habits[d];
              const done = r?.prayerDone;
              const emotion = r?.prayerEmotion;
              const isFuture = d > today;
              const isSelected = d === date;
              const dotColor = done
                ? emotion
                  ? EMOTION_COLORS[emotion]
                  : '#31AADF'
                : null;

              return (
                <TouchableOpacity
                  key={d}
                  style={[
                    styles.dayDot,
                    {
                      backgroundColor: dotColor
                        ? dotColor + '30'
                        : isSelected
                          ? isDark
                            ? '#ffffff15'
                            : '#00000008'
                          : 'transparent',
                      borderColor: isSelected
                        ? theme.tint
                        : dotColor
                          ? dotColor
                          : 'transparent',
                      borderWidth: isSelected ? 1.5 : dotColor ? 0 : 0,
                    },
                  ]}
                  onPress={() => {
                    if (!isFuture) {
                      setDate(d);
                      setShowLogger(false);
                    }
                  }}
                  disabled={isFuture}
                >
                  <Text
                    style={[
                      styles.dayDotNum,
                      {
                        color: isFuture
                          ? theme.icon + '40'
                          : isSelected
                            ? theme.tint
                            : theme.text,
                        fontWeight: isSelected ? '700' : '400',
                      },
                    ]}
                  >
                    {new Date(d + 'T00:00:00').getDate()}
                  </Text>
                  {done && (
                    <View
                      style={[
                        styles.dotIndicator,
                        { backgroundColor: dotColor ?? '#31AADF' },
                      ]}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 } as ViewStyle,

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
  } as ViewStyle,
  backBtn: { padding: 4 } as ViewStyle,
  dateNav: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  } as ViewStyle,
  dateText: {
    fontSize: 15,
    fontWeight: '700',
  } as TextStyle,

  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl + 20,
    gap: spacing.md,
  } as ViewStyle,

  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  } as TextStyle,

  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  streakText: {
    fontSize: 13,
    color: '#F59E0B',
    fontWeight: '600',
  } as TextStyle,

  // Logger card
  loggerCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.md,
  } as ViewStyle,

  // Summary card
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    padding: spacing.md,
  } as ViewStyle,
  summaryContent: {
    flex: 1,
    gap: 3,
  } as ViewStyle,
  summaryTitle: {
    fontSize: 15,
    fontWeight: '700',
  } as TextStyle,
  summaryDetail: {
    fontSize: 13,
  } as TextStyle,
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
  } as ViewStyle,
  editText: {
    fontSize: 12,
    fontWeight: '600',
  } as TextStyle,

  // Pending card
  pendingCard: {
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.lg,
  } as ViewStyle,
  pendingTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  } as TextStyle,
  pendingSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    opacity: 0.7,
  } as TextStyle,
  logBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: radii.pill,
    marginTop: 4,
  } as ViewStyle,
  logBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  } as TextStyle,

  // Monthly calendar
  monthCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  } as ViewStyle,
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as ViewStyle,
  monthTitle: {
    fontSize: 15,
    fontWeight: '700',
  } as TextStyle,
  monthStats: {
    fontSize: 12,
    fontWeight: '600',
  } as TextStyle,
  monthSubStats: {
    fontSize: 12,
    marginTop: -4,
  } as TextStyle,
  dotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  } as ViewStyle,
  dayDot: {
    width: `${100 / 7 - 0.5}%` as any,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  } as ViewStyle,
  dayDotNum: {
    fontSize: 12,
  } as TextStyle,
  dotIndicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 1,
  } as ViewStyle,
});
