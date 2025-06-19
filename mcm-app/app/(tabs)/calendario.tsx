// app/(tabs)/calendario.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, ViewStyle, TextStyle, TouchableOpacity, Alert } from 'react-native';
import { CalendarList, CalendarProps, Agenda, LocaleConfig, DateData } from 'react-native-calendars';
import { Checkbox, Text, SegmentedButtons } from 'react-native-paper';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import useCalendarEvents, { CalendarConfig, CalendarEvent } from '@/hooks/useCalendarEvents';

LocaleConfig.locales['es'] = {
  monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  today: 'Hoy',
};
LocaleConfig.defaultLocale = 'es';

const calendarConfigs: CalendarConfig[] = [
  {
    name: 'MCM Europa',
    url: 'https://calendar.google.com/calendar/ical/consolacion.org_11dp4qj27sgud37d7fjanghfck%40group.calendar.google.com/public/basic.ics',
    color: '#31AADF',
  },
  {
    name: 'MCM Castellón',
    url: 'https://calendar.google.com/calendar/ical/33j7mpbn86b2jj9sl8rds2e9m8%40group.calendar.google.com/public/basic.ics',
    color: '#A3BD31',
  },
];

export default function Calendario() {
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const [visibleCalendars, setVisibleCalendars] = useState<boolean[]>(calendarConfigs.map(() => true));
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'calendar' | 'agenda'>('calendar');
  const { eventsByDate } = useCalendarEvents(calendarConfigs);

  const handleDayPress = useCallback((day: DateData) => {
    if (day.dateString !== selectedDate) {
      setSelectedDate(day.dateString);
    }
  }, [selectedDate]);

  const filteredByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    Object.keys(eventsByDate).forEach((date) => {
      const events = eventsByDate[date].filter(ev => visibleCalendars[ev.calendarIndex]);
      if (events.length) map[date] = events;
    });
    return map;
  }, [eventsByDate, visibleCalendars]);

  const agendaItems = useMemo(() => {
    const items: Record<string, any[]> = {};
    Object.keys(filteredByDate).forEach(date => {
      items[date] = filteredByDate[date].map(event => ({
        ...event,
        day: date,
        name: event.title,
        height: 80,
      }));
    });
    return items;
  }, [filteredByDate]);

  const agendaData = useMemo(() => {
    return { ...agendaItems, [selectedDate]: agendaItems[selectedDate] || [] };
  }, [agendaItems, selectedDate]);

  const markedDates = useMemo<CalendarProps['markedDates']>(() => {
    const marks: { [date: string]: any } = {};
    Object.keys(filteredByDate).forEach((date) => {
      const periods = filteredByDate[date].map(ev => ({
        startingDay: date === ev.startDate,
        endingDay: date === (ev.endDate || ev.startDate),
        color: calendarConfigs[ev.calendarIndex].color,
      }));
      marks[date] = { periods };
    });
    marks[selectedDate] = { ...(marks[selectedDate] || {}), selected: true, selectedColor: colors.primary };
    return marks;
  }, [filteredByDate, selectedDate]);

  const eventsForSelected = filteredByDate[selectedDate] || [];

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={viewMode}
        onValueChange={(v) => setViewMode(v as 'calendar' | 'agenda')}
        buttons={[
          { value: 'calendar', label: 'Mes' },
          { value: 'agenda', label: 'Agenda' },
        ]}
        style={styles.segmented}
      />
      {viewMode === 'calendar' ? (
        <ScrollView>
          <CalendarList
            onDayPress={handleDayPress}
            markedDates={markedDates}
            markingType="multi-period"
            horizontal
            pagingEnabled
            pastScrollRange={12}
            futureScrollRange={12}
            firstDay={1}
            style={styles.calendar}
            theme={{
              calendarBackground: Colors[scheme ?? 'light'].background,
              dayTextColor: Colors[scheme ?? 'light'].text,
              monthTextColor: Colors[scheme ?? 'light'].text,
              textSectionTitleColor: Colors[scheme ?? 'light'].text,
              selectedDayBackgroundColor: colors.primary,
              selectedDayTextColor: colors.white,
              arrowColor: Colors[scheme ?? 'light'].tint,
            }}
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
              <TouchableOpacity
                key={i}
                style={styles.eventItem}
                onPress={() => {
                  const info = `${ev.title}\n${ev.location ?? ''}\n${ev.description ?? ''}`.trim();
                  Alert.alert('Evento', info || ev.title, [{ text: 'OK' }]);
                }}
              >
                <View style={[styles.rect, { backgroundColor: calendarConfigs[ev.calendarIndex].color }]} />
                <View style={styles.eventTextContainer}>
                  <Text style={styles.eventTitle}>{ev.title}</Text>
                  {ev.location ? <Text style={styles.eventLocation}>{ev.location}</Text> : null}
                </View>
              </TouchableOpacity>
            ))}
            {eventsForSelected.length === 0 && (
              <Text style={styles.noEvents}>No hay eventos para este día.</Text>
            )}
          </View>
        </ScrollView>
      ) : (
        <Agenda
          items={agendaData}
          selected={selectedDate}
          markedDates={markedDates}
          onDayPress={handleDayPress}
          firstDay={1}
          renderItem={(item: any) => (
            <TouchableOpacity
              style={styles.eventItem}
              onPress={() => {
                const info = `${item.title}\n${item.location ?? ''}\n${item.description ?? ''}`.trim();
                Alert.alert('Evento', info || item.title, [{ text: 'OK' }]);
              }}
            >
              <View style={[styles.rect, { backgroundColor: calendarConfigs[item.calendarIndex].color }]} />
              <View style={styles.eventTextContainer}>
                <Text style={styles.eventTitle}>{item.title}</Text>
                {item.location ? <Text style={styles.eventLocation}>{item.location}</Text> : null}
              </View>
            </TouchableOpacity>
          )}
          renderEmptyData={() => (
            <View style={styles.emptyDate}>
              <Text style={styles.noEvents}>No hay eventos para este día.</Text>
            </View>
          )}
          markingType="multi-period"
          theme={{
            calendarBackground: Colors[scheme ?? 'light'].background,
            agendaKnobColor: Colors[scheme ?? 'light'].tint,
            dayTextColor: Colors[scheme ?? 'light'].text,
            monthTextColor: Colors[scheme ?? 'light'].text,
            selectedDayBackgroundColor: colors.primary,
            selectedDayTextColor: colors.white,
          }}
        />
      )}
    </View>
  );
}

interface Styles {
  container: ViewStyle;
  calendar: ViewStyle;
  segmented: ViewStyle;
  checkboxContainer: ViewStyle;
  checkboxItem: ViewStyle;
  checkboxLabel: TextStyle;
  eventList: ViewStyle;
  eventListTitle: TextStyle;
  eventItem: ViewStyle;
  eventTitle: TextStyle;
  eventLocation: TextStyle;
  rect: ViewStyle;
  eventTextContainer: ViewStyle;
  emptyDate: ViewStyle;
  noEvents: TextStyle;
}

const createStyles = (scheme: 'light' | 'dark') => {
  const theme = Colors[scheme];
  return StyleSheet.create<Styles>({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    segmented: {
      margin: spacing.md,
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
      color: theme.text,
    },
    eventList: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.lg,
    },
    eventListTitle: {
      ...typography.h2,
      color: theme.text,
      marginBottom: spacing.sm,
      fontWeight: 'bold',
    },
    eventItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    rect: {
      width: 12,
      height: 6,
      borderRadius: 2,
      marginRight: spacing.sm,
    },
    eventTextContainer: {
      flexDirection: 'column',
    },
    emptyDate: {
      padding: spacing.md,
    },
    eventTitle: {
      ...typography.body,
      color: theme.text,
    },
    eventLocation: {
      ...typography.body,
      color: theme.icon,
    },
    noEvents: {
      ...typography.body,
      color: theme.text,
      fontStyle: 'italic',
    },
  });
};
