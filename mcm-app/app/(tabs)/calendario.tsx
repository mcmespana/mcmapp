// app/(tabs)/calendario.tsx
import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, ViewStyle, TextStyle } from 'react-native';
import { Calendar, CalendarProps } from 'react-native-calendars';
import { Checkbox, Text } from 'react-native-paper';
import colors from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import useCalendarEvents, { CalendarConfig, CalendarEvent } from '@/hooks/useCalendarEvents';

const calendarConfigs: CalendarConfig[] = [
  {
    name: 'MCM Europa',
    url: 'https://calendar.google.com/calendar/ical/consolacion.org_11dp4qj27sgud37d7fjanghfck%40group.calendar.google.com/public/basic.ics',
    color: '#A3BD31',
  },
  {
    name: 'MCM Local',
    url: 'https://calendar.google.com/calendar/ical/33j7mpbn86b2jj9sl8rds2e9m8%40group.calendar.google.com/public/basic.ics',
    color: '#31AADF',
  },
];

export default function Calendario() {
  const [visibleCalendars, setVisibleCalendars] = useState<boolean[]>(calendarConfigs.map(() => true));
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const { eventsByDate } = useCalendarEvents(calendarConfigs);

  const filteredByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    Object.keys(eventsByDate).forEach((date) => {
      const events = eventsByDate[date].filter(ev => visibleCalendars[ev.calendarIndex]);
      if (events.length) map[date] = events;
    });
    return map;
  }, [eventsByDate, visibleCalendars]);

  const markedDates = useMemo<CalendarProps['markedDates']>(() => {
    const marks: { [date: string]: any } = {};
    Object.keys(filteredByDate).forEach((date) => {
      const dots = filteredByDate[date].map(ev => ({
        key: `${ev.calendarIndex}-${ev.title}`,
        color: calendarConfigs[ev.calendarIndex].color,
      }));
      marks[date] = { marked: true, dots };
    });
    marks[selectedDate] = { ...(marks[selectedDate] || {}), selected: true, selectedColor: colors.primary };
    return marks;
  }, [filteredByDate, selectedDate]);

  const eventsForSelected = filteredByDate[selectedDate] || [];

  return (
    <ScrollView style={styles.container}>
      <Calendar
        onDayPress={(day) => setSelectedDate(day.dateString)}
        markedDates={markedDates}
        markingType="multi-dot"
        style={styles.calendar}
      />
      <View style={styles.checkboxContainer}>
        {calendarConfigs.map((cal, idx) => (
          <View key={idx} style={styles.checkboxItem}>
            <Checkbox
              status={visibleCalendars[idx] ? 'checked' : 'unchecked'}
              onPress={() => {
                const copy = [...visibleCalendars];
                copy[idx] = !copy[idx];
                setVisibleCalendars(copy);
              }}
              color={cal.color}
            />
            <Text style={styles.checkboxLabel}>{cal.name}</Text>
          </View>
        ))}
      </View>
      <View style={styles.eventList}>
        <Text style={styles.eventListTitle}>Eventos para {selectedDate}</Text>
        {eventsForSelected.map((ev, i) => (
          <View key={i} style={styles.eventItem}>
            <View style={[styles.dot, { backgroundColor: calendarConfigs[ev.calendarIndex].color }]} />
            <View style={styles.eventTextContainer}>
              <Text style={styles.eventTitle}>{ev.title}</Text>
              {ev.location ? <Text style={styles.eventLocation}>{ev.location}</Text> : null}
            </View>
          </View>
        ))}
        {eventsForSelected.length === 0 && (
          <Text style={styles.noEvents}>No hay eventos para este día.</Text>
        )}
      </View>
    </ScrollView>
  );
}

interface Styles {
  container: ViewStyle;
  calendar: ViewStyle;
  checkboxContainer: ViewStyle;
  checkboxItem: ViewStyle;
  checkboxLabel: TextStyle;
  eventList: ViewStyle;
  eventListTitle: TextStyle;
  eventItem: ViewStyle;
  eventTitle: TextStyle;
  eventLocation: TextStyle;
  dot: ViewStyle;
  eventTextContainer: ViewStyle;
  noEvents: TextStyle;
}

const styles = StyleSheet.create<Styles>({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  calendar: {
    marginBottom: spacing.md,
  },
  checkboxContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
    marginBottom: spacing.sm,
  },
  checkboxLabel: {
    ...typography.body,
    color: colors.text,
  },
  eventList: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  eventListTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.sm,
    fontWeight: 'bold',
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.sm,
  },
  eventTextContainer: {
    flexDirection: 'column',
  },
  eventTitle: {
    ...typography.body,
    color: colors.text,
  },
  eventLocation: {
    ...typography.body,
    color: colors.secondary,
  },
  noEvents: {
    ...typography.body,
    color: colors.text,
    fontStyle: 'italic',
  },
});
