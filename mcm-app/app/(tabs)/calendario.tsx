// app/(tabs)/calendario.tsx
import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, ViewStyle, TextStyle, TouchableOpacity, Alert, SectionList } from 'react-native';
import { CalendarList, CalendarProps, LocaleConfig } from 'react-native-calendars';
import { Checkbox, Text, SegmentedButtons, IconButton } from 'react-native-paper';
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

  const todayStr = new Date().toISOString().split('T')[0];

  const formatDate = (date: string) =>
    new Date(date + 'T00:00:00')
      .toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
      .replace(',', '');

  const monthLabel = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  }, [selectedDate]);

  const changeMonth = (delta: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setMonth(d.getMonth() + delta, 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const filteredByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    Object.keys(eventsByDate).forEach((date) => {
      const events = eventsByDate[date].filter(ev => visibleCalendars[ev.calendarIndex]);
      if (events.length) map[date] = events;
    });
    return map;
  }, [eventsByDate, visibleCalendars]);

  const agendaSections = useMemo(() => {
    const firstDay = new Date(selectedDate + 'T00:00:00');
    firstDay.setDate(1);
    const lastDay = new Date(firstDay);
    lastDay.setMonth(firstDay.getMonth() + 1);
    lastDay.setDate(0);
    const sections: { title: string; data: CalendarEvent[] }[] = [];
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      sections.push({ title: dateStr, data: filteredByDate[dateStr] || [] });
    }
    return sections;
  }, [filteredByDate, selectedDate]);

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
            onDayPress={(day) => {
              if (day.dateString !== selectedDate) {
                setSelectedDate(day.dateString);
              }
            }}
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
            <Text style={[styles.eventListTitle, selectedDate < todayStr && styles.pastText]}>Eventos {formatDate(selectedDate)}</Text>
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
                  <Text style={[styles.eventTitle, selectedDate < todayStr && styles.pastText]}>{ev.title}</Text>
                  {ev.location ? <Text style={[styles.eventLocation, selectedDate < todayStr && styles.pastText]}>{ev.location}</Text> : null}
                </View>
              </TouchableOpacity>
            ))}
            {eventsForSelected.length === 0 && (
              <Text style={styles.noEvents}>No hay eventos para este día.</Text>
            )}
          </View>
        </ScrollView>
      ) : (
        <>
          <View style={styles.agendaHeader}>
            <IconButton icon="chevron-left" onPress={() => changeMonth(-1)} />
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <IconButton icon="chevron-right" onPress={() => changeMonth(1)} />
          </View>
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
          <SectionList
            sections={agendaSections}
          keyExtractor={(item, index) => `${item.title}-${index}`}
          renderSectionHeader={({ section: { title, data } }) => {
            const isPast = title < todayStr;
            const isToday = title === todayStr && data.length > 0;
            return (
              <View style={styles.sectionHeader}>
                <Text style={[styles.eventListTitle, isPast && styles.pastText]}>
                  {formatDate(title)}{isToday ? ' (HOY)' : ''}
                </Text>
              </View>
            );
          }}
          renderItem={({ item, section }) => {
            const isPast = section.title < todayStr;
            return (
              <TouchableOpacity
                style={styles.eventItem}
                onPress={() => {
                  const info = `${item.title}\n${item.location ?? ''}\n${item.description ?? ''}`.trim();
                  Alert.alert('Evento', info || item.title, [{ text: 'OK' }]);
                }}
              >
                <View style={[styles.rect, { backgroundColor: calendarConfigs[item.calendarIndex].color }]} />
                <View style={styles.eventTextContainer}>
                  <Text style={[styles.eventTitle, isPast && styles.pastText]}>{item.title}</Text>
                  {item.location ? <Text style={[styles.eventLocation, isPast && styles.pastText]}>{item.location}</Text> : null}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyDate}>
              <Text style={styles.noEvents}>No hay eventos para este día.</Text>
            </View>
          }
        />
        </>
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
  sectionHeader: ViewStyle;
  emptyDate: ViewStyle;
  noEvents: TextStyle;
  agendaHeader: ViewStyle;
  monthLabel: TextStyle;
  pastText: TextStyle;
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
    monthLabel: {
      ...typography.h2,
      color: theme.text,
      marginHorizontal: spacing.sm,
    },
    agendaHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    eventItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.xs,
      paddingLeft: spacing.md,
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
    sectionHeader: {
      backgroundColor: theme.background,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
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
    pastText: {
      color: theme.icon,
    },
  });
};
