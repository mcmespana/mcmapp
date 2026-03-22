import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { DayRecord, EMOTION_COLORS } from '@/hooks/useContigoHabits';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { radii } from '@/constants/uiStyles';

const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

interface HabitWeekViewProps {
  weekDates: string[];
  habits: Record<string, DayRecord>;
  today: string;
  onDayPress?: (date: string) => void;
}

export default function HabitWeekView({
  weekDates,
  habits,
  today,
  onDayPress,
}: HabitWeekViewProps) {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];
  const isDark = scheme === 'dark';

  return (
    <View style={styles.container}>
      {weekDates.map((date, index) => {
        const record = habits[date];
        const readingDone = record?.readingDone ?? false;
        const prayerDone = record?.prayerDone ?? false;
        const prayerColor = record?.prayerEmotion
          ? EMOTION_COLORS[record.prayerEmotion]
          : undefined;
        const isToday = date === today;
        const isFuture = date > today;
        const dayNum = new Date(date + 'T00:00:00').getDate();

        return (
          <TouchableOpacity
            key={date}
            style={[
              styles.dayCol,
              isToday && [
                styles.todayCol,
                { backgroundColor: isDark ? '#ffffff18' : '#00000008' },
              ],
            ]}
            onPress={() => onDayPress?.(date)}
            activeOpacity={0.7}
          >
            {/* Day label */}
            <Text
              style={[
                styles.dayLabel,
                { color: isToday ? theme.tint : theme.icon },
                isToday && styles.dayLabelToday,
              ]}
            >
              {DAY_LABELS[index]}
            </Text>

            {/* Day number */}
            <Text
              style={[
                styles.dayNum,
                { color: isToday ? theme.tint : theme.text },
                isToday && styles.dayNumToday,
              ]}
            >
              {dayNum}
            </Text>

            {/* Reading dot */}
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: readingDone
                    ? '#F59E0B'
                    : isFuture
                      ? 'transparent'
                      : isDark
                        ? '#444'
                        : '#E5E5E5',
                  borderWidth: readingDone ? 0 : isFuture ? 0 : 1.5,
                  borderColor: isDark ? '#555' : '#CCC',
                },
              ]}
            />

            {/* Prayer dot */}
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: prayerDone
                    ? prayerColor ?? '#31AADF'
                    : isFuture
                      ? 'transparent'
                      : isDark
                        ? '#444'
                        : '#E5E5E5',
                  borderWidth: prayerDone ? 0 : isFuture ? 0 : 1.5,
                  borderColor: isDark ? '#555' : '#CCC',
                },
              ]}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  } as ViewStyle,
  dayCol: {
    alignItems: 'center',
    gap: 5,
    flex: 1,
    paddingVertical: 8,
    borderRadius: radii.md,
  } as ViewStyle,
  todayCol: {
    borderRadius: radii.md,
  } as ViewStyle,
  dayLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  } as TextStyle,
  dayLabelToday: {
    fontWeight: '800',
  } as TextStyle,
  dayNum: {
    fontSize: 14,
    fontWeight: '600',
  } as TextStyle,
  dayNumToday: {
    fontWeight: '800',
  } as TextStyle,
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  } as ViewStyle,
});
