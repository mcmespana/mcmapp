// components/contigo/HabitWeekView.tsx — Weekly habit tracker dots view
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import type { DayRecord, Emotion } from '@/types/contigo';
import { EMOTIONS } from '@/types/contigo';

const DAY_NAMES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function getEmotionColor(emotion?: Emotion): string {
  if (!emotion) return '#999';
  return EMOTIONS.find((e) => e.key === emotion)?.color ?? '#999';
}

interface Props {
  weekDates: string[];
  weekRecords: (DayRecord | null)[];
  todayStr: string;
  streak: number;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onDayPress?: (date: string) => void;
}

export default function HabitWeekView({
  weekDates,
  weekRecords,
  todayStr,
  streak,
  onPrevWeek,
  onNextWeek,
  onDayPress,
}: Props) {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];

  const weekLabel = useMemo(() => {
    if (weekDates.length < 7) return '';
    const start = weekDates[0];
    const end = weekDates[6];
    const [, sm, sd] = start.split('-');
    const [, em, ed] = end.split('-');
    return `${parseInt(sd)} ${getMonthShort(parseInt(sm))} – ${parseInt(ed)} ${getMonthShort(parseInt(em))}`;
  }, [weekDates]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.card,
          borderColor:
            scheme === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)',
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.text }]}>Mi Semana</Text>
          <Text style={[styles.weekRange, { color: theme.icon }]}>
            {weekLabel}
          </Text>
        </View>
        {streak > 0 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={[styles.streakNum, { color: theme.text }]}>
              {streak} {streak === 1 ? 'día' : 'días'}
            </Text>
          </View>
        )}
      </View>

      {/* Navigation + Days */}
      <View style={styles.navRow}>
        <TouchableOpacity
          onPress={onPrevWeek}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Semana anterior"
        >
          <MaterialIcons name="chevron-left" size={24} color={theme.icon} />
        </TouchableOpacity>

        <View style={styles.daysRow}>
          {weekDates.map((date, idx) => {
            const rec = weekRecords[idx];
            const isToday = date === todayStr;
            const isFuture = date > todayStr;

            return (
              <TouchableOpacity
                key={date}
                style={[
                  styles.dayCol,
                  isToday && {
                    backgroundColor:
                      scheme === 'dark'
                        ? 'rgba(255,255,255,0.08)'
                        : 'rgba(0,0,0,0.04)',
                    borderRadius: 10,
                  },
                ]}
                onPress={() => onDayPress?.(date)}
                disabled={isFuture}
                accessibilityLabel={`${DAY_NAMES[idx]} ${date}`}
              >
                <Text
                  style={[
                    styles.dayName,
                    {
                      color: isToday
                        ? theme.text
                        : isFuture
                          ? theme.icon + '50'
                          : theme.icon,
                      fontWeight: isToday ? '800' : '600',
                    },
                  ]}
                >
                  {DAY_NAMES[idx]}
                </Text>

                {/* Reading dot */}
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: rec?.readingDone
                        ? '#4CAF50'
                        : isFuture
                          ? 'transparent'
                          : theme.icon + '20',
                    },
                  ]}
                />

                {/* Prayer dot */}
                <View
                  style={[
                    styles.dot,
                    {
                      backgroundColor: rec?.prayerDone
                        ? getEmotionColor(rec.prayerEmotion)
                        : isFuture
                          ? 'transparent'
                          : theme.icon + '20',
                    },
                  ]}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          onPress={onNextWeek}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Semana siguiente"
        >
          <MaterialIcons name="chevron-right" size={24} color={theme.icon} />
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#4CAF50' }]} />
          <Text style={[styles.legendText, { color: theme.icon }]}>
            Evangelio
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FCD200' }]} />
          <Text style={[styles.legendText, { color: theme.icon }]}>
            Oración
          </Text>
        </View>
      </View>
    </View>
  );
}

function getMonthShort(m: number): string {
  return [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ][m - 1];
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm + 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  weekRange: {
    fontSize: 11,
    marginTop: 1,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakEmoji: {
    fontSize: 16,
  },
  streakNum: {
    fontSize: 13,
    fontWeight: '700',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  daysRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  dayCol: {
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 4,
    minWidth: 28,
  },
  dayName: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
