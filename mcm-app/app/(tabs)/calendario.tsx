// app/(tabs)/calendario.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ViewStyle,
  TextStyle,
  Alert,
  SectionList,
} from 'react-native';
import {
  CalendarList,
  CalendarProps,
  LocaleConfig,
} from 'react-native-calendars';
import {
  Text,
  SegmentedButtons,
  IconButton,
  Chip,
  Card,
} from 'react-native-paper';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import useCalendarEvents, { CalendarEvent } from '@/hooks/useCalendarEvents';
import { useCalendarConfigs } from '@/hooks/useCalendarConfigs';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import OfflineBanner from '@/components/OfflineBanner';

LocaleConfig.locales['es'] = {
  monthNames: [
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
  ],
  monthNamesShort: [
    'Ene',
    'Feb',
    'Mar',
    'Abr',
    'May',
    'Jun',
    'Jul',
    'Ago',
    'Sep',
    'Oct',
    'Nov',
    'Dic',
  ],
  dayNames: [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
  ],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  today: 'Hoy',
};
LocaleConfig.defaultLocale = 'es';

export default function Calendario() {
  const scheme = useColorScheme();
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);

  const {
    calendarConfigs,
    visibleCalendars,
    toggleCalendarVisibility,
    loading: configsLoading,
    offline,
  } = useCalendarConfigs();

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [viewMode, setViewMode] = useState<'calendar' | 'agenda'>('calendar');
  const { eventsByDate, loading: eventsLoading } =
    useCalendarEvents(calendarConfigs);

  const loading = configsLoading || eventsLoading;

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
    const currentDate = new Date(selectedDate + 'T00:00:00');
    const newDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + delta,
      1,
    );
    setSelectedDate(newDate.toISOString().split('T')[0]);
  };

  const filteredByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    Object.keys(eventsByDate).forEach((date) => {
      const events = eventsByDate[date].filter(
        (ev) => visibleCalendars[ev.calendarIndex],
      );
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
      const eventsForDate = filteredByDate[date];

      if (eventsForDate.length > 0) {
        // Use periods (bars) for ALL events - both single day and multi-day
        const periods = eventsForDate.map((ev) => {
          // For single-day events (including corrected all-day events), show as a complete bar for that day
          const isEffectivelySingleDay =
            ev.isSingleDay === true ||
            !ev.endDate ||
            ev.startDate === ev.endDate;

          if (isEffectivelySingleDay) {
            // Single day event: show as a complete bar for just this day
            return {
              startingDay: true,
              endingDay: true,
              color: calendarConfigs[ev.calendarIndex].color,
            };
          } else {
            // Multi-day event: show as part of a continuous bar
            return {
              startingDay: date === ev.startDate,
              endingDay: date === (ev.endDate || ev.startDate),
              color: calendarConfigs[ev.calendarIndex].color,
            };
          }
        });

        marks[date] = { periods };
      }
    });

    // Handle selected date
    marks[selectedDate] = {
      ...(marks[selectedDate] || {}),
      selected: true,
      selectedColor: colors.primary,
      selectedTextColor: colors.white,
    };

    return marks;
  }, [filteredByDate, selectedDate, calendarConfigs]);

  const eventsForSelected = filteredByDate[selectedDate] || [];

  if (loading && calendarConfigs.length === 0) {
    return <ProgressWithMessage message="Cargando calendarios..." />;
  }

  return (
    <View style={styles.container}>
      {offline && <OfflineBanner text="Mostrando datos sin conexión" />}
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
          <View style={styles.chipsContainer}>
            {calendarConfigs.map((cal, idx) => (
              <Chip
                key={idx}
                selected={visibleCalendars[idx]}
                onPress={() => toggleCalendarVisibility(idx)}
                style={[
                  styles.calendarChip,
                  {
                    backgroundColor: visibleCalendars[idx]
                      ? cal.color
                      : Colors[scheme ?? 'light'].background,
                  },
                ]}
                textStyle={[
                  styles.chipText,
                  {
                    color: visibleCalendars[idx]
                      ? colors.white
                      : Colors[scheme ?? 'light'].text,
                  },
                ]}
                showSelectedOverlay={false}
                icon={
                  visibleCalendars[idx]
                    ? ({ size, color }) => (
                        <IconButton
                          icon="check"
                          size={16}
                          iconColor={colors.white}
                          style={{ margin: 0 }}
                        />
                      )
                    : undefined
                }
              >
                {cal.name}
              </Chip>
            ))}
          </View>
          <View style={styles.eventList}>
            <Text
              style={[
                styles.eventListTitle,
                selectedDate < todayStr && styles.pastText,
              ]}
            >
              Eventos {formatDate(selectedDate)}
            </Text>
            {eventsForSelected.map((ev, i) => (
              <Card
                key={i}
                style={[
                  styles.eventCard,
                  selectedDate < todayStr && styles.pastEventCard,
                ]}
                onPress={() => {
                  const info =
                    `${ev.title}\n${ev.location ?? ''}\n${ev.description ?? ''}`.trim();
                  Alert.alert('Evento', info || ev.title, [{ text: 'OK' }]);
                }}
              >
                <Card.Content style={styles.eventCardContent}>
                  <View style={styles.eventHeader}>
                    <View
                      style={[
                        styles.eventIndicator,
                        {
                          backgroundColor:
                            calendarConfigs[ev.calendarIndex].color,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.eventTitle,
                        selectedDate < todayStr && styles.pastText,
                      ]}
                      numberOfLines={2}
                    >
                      {ev.title}
                    </Text>
                  </View>
                  {ev.location && (
                    <View style={styles.eventMeta}>
                      <IconButton
                        icon="map-marker"
                        size={16}
                        style={styles.metaIcon}
                        iconColor={Colors[scheme ?? 'light'].icon}
                      />
                      <Text
                        style={[
                          styles.eventLocation,
                          selectedDate < todayStr && styles.pastText,
                        ]}
                        numberOfLines={2}
                      >
                        {ev.location}
                      </Text>
                    </View>
                  )}
                  {ev.endDate && ev.startDate !== ev.endDate && (
                    <View style={styles.eventMeta}>
                      <IconButton
                        icon="calendar-range"
                        size={16}
                        style={styles.metaIcon}
                        iconColor={Colors[scheme ?? 'light'].icon}
                      />
                      <Text
                        style={[
                          styles.eventDuration,
                          selectedDate < todayStr && styles.pastText,
                        ]}
                      >
                        Hasta {formatDate(ev.endDate)}
                      </Text>
                    </View>
                  )}
                </Card.Content>
              </Card>
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
          <View style={styles.chipsContainer}>
            {calendarConfigs.map((cal, idx) => (
              <Chip
                key={idx}
                selected={visibleCalendars[idx]}
                onPress={() => toggleCalendarVisibility(idx)}
                style={[
                  styles.calendarChip,
                  {
                    backgroundColor: visibleCalendars[idx]
                      ? cal.color
                      : Colors[scheme ?? 'light'].background,
                  },
                ]}
                textStyle={[
                  styles.chipText,
                  {
                    color: visibleCalendars[idx]
                      ? colors.white
                      : Colors[scheme ?? 'light'].text,
                  },
                ]}
                showSelectedOverlay={false}
                icon={
                  visibleCalendars[idx]
                    ? ({ size, color }) => (
                        <IconButton
                          icon="check"
                          size={16}
                          iconColor={colors.white}
                          style={{ margin: 0 }}
                        />
                      )
                    : undefined
                }
              >
                {cal.name}
              </Chip>
            ))}
          </View>
          <SectionList
            sections={agendaSections}
            keyExtractor={(item, index) => `${item.title}-${index}`}
            renderSectionHeader={({ section: { title, data } }) => {
              // Don't render header if there are no events for this day
              if (!data || data.length === 0) return null;

              const isPast = title < todayStr;
              const isToday = title === todayStr;
              const isTomorrow =
                new Date(title + 'T00:00:00').getTime() ===
                new Date(todayStr + 'T00:00:00').getTime() +
                  24 * 60 * 60 * 1000;

              return (
                <View
                  style={[
                    styles.sectionHeader,
                    isToday && styles.todaySectionHeader,
                    isPast && styles.pastSectionHeader,
                  ]}
                >
                  <Text
                    style={[
                      styles.sectionHeaderText,
                      isPast && styles.pastText,
                      isToday && styles.todayText,
                    ]}
                  >
                    {isToday
                      ? '🌟 HOY'
                      : isTomorrow
                        ? '📅 MAÑANA'
                        : formatDate(title)}
                  </Text>
                  <Text style={[styles.eventCount, isPast && styles.pastText]}>
                    {data.length} evento{data.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              );
            }}
            renderItem={({ item, section }) => {
              const isPast = section.title < todayStr;
              return (
                <Card
                  style={[
                    styles.eventCard,
                    isPast && styles.pastEventCard,
                    { marginHorizontal: spacing.md, marginBottom: spacing.xs },
                  ]}
                  onPress={() => {
                    const info =
                      `${item.title}\n${item.location ?? ''}\n${item.description ?? ''}`.trim();
                    Alert.alert('Evento', info || item.title, [{ text: 'OK' }]);
                  }}
                >
                  <Card.Content style={styles.eventCardContent}>
                    <View style={styles.eventHeader}>
                      <View
                        style={[
                          styles.eventIndicator,
                          {
                            backgroundColor:
                              calendarConfigs[item.calendarIndex].color,
                          },
                        ]}
                      />
                      <Text
                        style={[styles.eventTitle, isPast && styles.pastText]}
                        numberOfLines={2}
                      >
                        {item.title}
                      </Text>
                    </View>
                    {item.location && (
                      <View style={styles.eventMeta}>
                        <IconButton
                          icon="map-marker"
                          size={16}
                          style={styles.metaIcon}
                          iconColor={Colors[scheme ?? 'light'].icon}
                        />
                        <Text
                          style={[
                            styles.eventLocation,
                            isPast && styles.pastText,
                          ]}
                          numberOfLines={2}
                        >
                          {item.location}
                        </Text>
                      </View>
                    )}
                    {item.endDate && item.startDate !== item.endDate && (
                      <View style={styles.eventMeta}>
                        <IconButton
                          icon="calendar-range"
                          size={16}
                          style={styles.metaIcon}
                          iconColor={Colors[scheme ?? 'light'].icon}
                        />
                        <Text
                          style={[
                            styles.eventDuration,
                            isPast && styles.pastText,
                          ]}
                        >
                          Hasta {formatDate(item.endDate)}
                        </Text>
                      </View>
                    )}
                  </Card.Content>
                </Card>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyDate}>
                <Text style={styles.noEvents}>
                  No hay eventos para este día.
                </Text>
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
  chipsContainer: ViewStyle;
  calendarChip: ViewStyle;
  chipText: TextStyle;
  eventList: ViewStyle;
  eventListTitle: TextStyle;
  eventItem: ViewStyle;
  eventCard: ViewStyle;
  pastEventCard: ViewStyle;
  eventCardContent: ViewStyle;
  eventHeader: ViewStyle;
  eventIndicator: ViewStyle;
  eventMeta: ViewStyle;
  metaIcon: ViewStyle;
  eventDuration: TextStyle;
  eventTitle: TextStyle;
  eventLocation: TextStyle;
  rect: ViewStyle;
  eventTextContainer: ViewStyle;
  sectionHeader: ViewStyle;
  todaySectionHeader: ViewStyle;
  pastSectionHeader: ViewStyle;
  sectionHeaderText: TextStyle;
  todayText: TextStyle;
  eventCount: TextStyle;
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
    chipsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      marginHorizontal: spacing.md,
      marginBottom: spacing.md,
      gap: spacing.sm,
    },
    calendarChip: {
      marginBottom: spacing.xs,
      borderWidth: 1,
      borderColor: theme.icon,
    },
    chipText: {
      ...typography.caption,
      fontWeight: '600',
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
    eventCard: {
      marginBottom: spacing.sm,
      marginHorizontal: spacing.md,
      elevation: 2,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    pastEventCard: {
      opacity: 0.6,
    },
    eventCardContent: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    eventHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    eventIndicator: {
      width: 4,
      height: 20,
      borderRadius: 2,
      marginRight: spacing.sm,
    },
    eventMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.xs,
    },
    metaIcon: {
      margin: 0,
      marginRight: spacing.xs,
    },
    eventDuration: {
      ...typography.caption,
      color: theme.icon,
      flex: 1,
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
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: theme.icon + '20',
    },
    todaySectionHeader: {
      backgroundColor: colors.primary + '10',
      borderBottomColor: colors.primary + '40',
    },
    pastSectionHeader: {
      opacity: 0.7,
    },
    sectionHeaderText: {
      ...typography.h2,
      color: theme.text,
      fontWeight: 'bold',
      fontSize: 18,
    },
    todayText: {
      color: colors.primary,
    },
    eventCount: {
      ...typography.caption,
      color: theme.icon,
      fontWeight: '500',
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
