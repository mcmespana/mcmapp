import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  DayRecord,
  EMOTION_CONFIG,
  Emotion,
} from '@/hooks/useContigoHabits';

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

interface Props {
  weekRecords: DayRecord[];
  streak: number;
  onPrevWeek?: () => void;
  onNextWeek?: () => void;
  weekLabel?: string;
}

export default function HabitWeekView({
  weekRecords,
  streak,
  onPrevWeek,
  onNextWeek,
  weekLabel,
}: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF' },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text
            style={[styles.title, { color: isDark ? '#FFF' : '#1A1A2E' }]}
          >
            Mi Semana
          </Text>
          {streak > 0 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={styles.streakNum}>{streak} días</Text>
            </View>
          )}
        </View>
        <View style={styles.nav}>
          <TouchableOpacity
            onPress={onPrevWeek}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons
              name="chevron-left"
              size={24}
              color={isDark ? '#888' : '#AAA'}
            />
          </TouchableOpacity>
          {weekLabel ? (
            <Text
              style={[
                styles.weekLabel,
                { color: isDark ? '#AAA' : '#777' },
              ]}
            >
              {weekLabel}
            </Text>
          ) : null}
          <TouchableOpacity
            onPress={onNextWeek}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons
              name="chevron-right"
              size={24}
              color={isDark ? '#888' : '#AAA'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Days grid */}
      <View style={styles.daysRow}>
        {weekRecords.map((rec, i) => {
          const isToday = rec.date === todayStr;
          const isPast = rec.date < todayStr;
          const emotionColor = rec.prayerEmotion
            ? EMOTION_CONFIG[rec.prayerEmotion].color
            : undefined;

          return (
            <View key={rec.date} style={styles.dayColumn}>
              <Text
                style={[
                  styles.dayLabel,
                  {
                    color: isToday
                      ? '#E15C62'
                      : isDark
                        ? '#888'
                        : '#999',
                    fontWeight: isToday ? '800' : '600',
                  },
                ]}
              >
                {DAYS[i]}
              </Text>

              {/* Day circle background */}
              <View
                style={[
                  styles.dayCircle,
                  {
                    backgroundColor: isToday
                      ? (isDark ? '#3A2A2A' : '#FFF0F0')
                      : 'transparent',
                    borderColor: isToday ? '#E15C62' + '40' : 'transparent',
                  },
                ]}
              >
                {/* Reading dot */}
                <View
                  style={[
                    styles.dot,
                    rec.readingDone
                      ? styles.dotFilled
                      : isPast
                        ? styles.dotMissed
                        : styles.dotEmpty,
                  ]}
                >
                  {rec.readingDone && (
                    <MaterialIcons name="auto-stories" size={10} color="#FFF" />
                  )}
                </View>

                {/* Prayer dot */}
                <View
                  style={[
                    styles.dot,
                    rec.prayerDone
                      ? [styles.dotFilled, { backgroundColor: emotionColor ?? '#FCD200' }]
                      : isPast
                        ? styles.dotMissed
                        : styles.dotEmpty,
                  ]}
                >
                  {rec.prayerDone && (
                    <MaterialIcons name="self-improvement" size={10} color="#FFF" />
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.dotFilled]} />
          <Text style={[styles.legendText, { color: isDark ? '#888' : '#999' }]}>
            Evangelio
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[styles.legendDot, { backgroundColor: '#FCD200' }]}
          />
          <Text style={[styles.legendText, { color: isDark ? '#888' : '#999' }]}>
            Oración
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      default: { elevation: 2 },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 3,
  },
  streakEmoji: {
    fontSize: 12,
  },
  streakNum: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E65100',
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weekLabel: {
    fontSize: 12,
    fontWeight: '500',
    minWidth: 50,
    textAlign: 'center',
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayColumn: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  dayLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayCircle: {
    width: 40,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotFilled: {
    backgroundColor: '#4CAF50',
  },
  dotMissed: {
    backgroundColor: '#E0E0E0',
  },
  dotEmpty: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
