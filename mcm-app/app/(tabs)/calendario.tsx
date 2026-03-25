// app/(tabs)/calendario.tsx
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ViewStyle,
  TextStyle,
  SectionList,
  TouchableOpacity,
  Platform,
  Animated,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TabScreenWrapper from '@/components/ui/TabScreenWrapper.ios';
import {
  CalendarList,
  CalendarProps,
  LocaleConfig,
} from 'react-native-calendars';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import spacing from '@/constants/spacing';
import { radii } from '@/constants/uiStyles';
import typography from '@/constants/typography';
import useCalendarEvents, { CalendarEvent } from '@/hooks/useCalendarEvents';
import { useCalendarConfigs } from '@/hooks/useCalendarConfigs';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import OfflineBanner from '@/components/OfflineBanner';
import GlassFAB from '@/components/ui/GlassFAB.ios';
import { useLocalSearchParams } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

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
  const isDark = scheme === 'dark';
  const params = useLocalSearchParams<{ date?: string }>();

  const {
    calendarConfigs,
    visibleCalendars,
    toggleCalendarVisibility,
    loading: configsLoading,
    offline,
  } = useCalendarConfigs();

  const todayStr = new Date().toISOString().split('T')[0];

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [viewMode, setViewMode] = useState<'calendar' | 'agenda'>('calendar');

  useEffect(() => {
    if (params.date && typeof params.date === 'string') {
      setSelectedDate(params.date);
    }
  }, [params.date]);

  const { eventsByDate, loading: eventsLoading } =
    useCalendarEvents(calendarConfigs);

  const loading = configsLoading || eventsLoading;

  const formatDate = (date: string) =>
    new Date(date + 'T00:00:00')
      .toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
      .replace(',', '');

  const formatDateShort = (date: string) => {
    const d = new Date(date + 'T00:00:00');
    const day = d.getDate();
    const weekday = d
      .toLocaleDateString('es-ES', { weekday: 'short' })
      .replace('.', '');
    return { day, weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1) };
  };

  const monthLabel = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    const label = d.toLocaleDateString('es-ES', {
      month: 'long',
      year: 'numeric',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
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

  const goToToday = useCallback(() => {
    setSelectedDate(todayStr);
  }, [todayStr]);

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
    for (
      let d = new Date(firstDay);
      d <= lastDay;
      d.setDate(d.getDate() + 1)
    ) {
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
        const periods = eventsForDate.map((ev) => {
          const isEffectivelySingleDay =
            ev.isSingleDay === true ||
            !ev.endDate ||
            ev.startDate === ev.endDate;

          if (isEffectivelySingleDay) {
            return {
              startingDay: true,
              endingDay: true,
              color: calendarConfigs[ev.calendarIndex].color,
            };
          } else {
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

    marks[selectedDate] = {
      ...(marks[selectedDate] || {}),
      selected: true,
      selectedColor: colors.info,
      selectedTextColor: colors.white,
    };

    return marks;
  }, [filteredByDate, selectedDate, calendarConfigs]);

  const eventsForSelected = filteredByDate[selectedDate] || [];

  const renderEventCard = (
    ev: CalendarEvent,
    index: number,
    isPast: boolean,
  ) => {
    const calColor = calendarConfigs[ev.calendarIndex]?.color || colors.info;

    return (
      <TouchableOpacity
        key={index}
        activeOpacity={0.7}
        style={[styles.eventCard, isPast && styles.pastEventCard]}
      >
        <View
          style={[styles.eventColorBar, { backgroundColor: calColor }]}
        />
        <View style={styles.eventCardBody}>
          <View style={styles.eventCardTop}>
            <Text
              style={[styles.eventTitle, isPast && styles.pastText]}
              numberOfLines={2}
            >
              {ev.title}
            </Text>
            <View
              style={[
                styles.calendarBadge,
                { backgroundColor: calColor + '18' },
              ]}
            >
              <View
                style={[styles.calendarDot, { backgroundColor: calColor }]}
              />
              <Text
                style={[styles.calendarBadgeText, { color: calColor }]}
                numberOfLines={1}
              >
                {calendarConfigs[ev.calendarIndex]?.name || ''}
              </Text>
            </View>
          </View>
          {ev.location ? (
            <View style={styles.eventMeta}>
              <MaterialIcons
                name="place"
                size={14}
                color={isDark ? '#8E8E93' : '#8E8E93'}
              />
              <Text
                style={[styles.eventLocation, isPast && styles.pastText]}
                numberOfLines={1}
              >
                {ev.location}
              </Text>
            </View>
          ) : null}
          {ev.endDate && ev.startDate !== ev.endDate ? (
            <View style={styles.eventMeta}>
              <MaterialIcons
                name="date-range"
                size={14}
                color={isDark ? '#8E8E93' : '#8E8E93'}
              />
              <Text
                style={[styles.eventDuration, isPast && styles.pastText]}
              >
                Hasta {formatDate(ev.endDate)}
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderFilterChips = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipsScroll}
    >
      {calendarConfigs.map((cal, idx) => {
        const isActive = visibleCalendars[idx];
        return (
          <TouchableOpacity
            key={idx}
            activeOpacity={0.7}
            onPress={() => toggleCalendarVisibility(idx)}
            style={[
              styles.filterChip,
              isActive
                ? { backgroundColor: cal.color + '20', borderColor: cal.color }
                : {},
            ]}
          >
            <View
              style={[
                styles.chipDot,
                {
                  backgroundColor: isActive
                    ? cal.color
                    : isDark
                      ? '#555'
                      : '#C7C7CC',
                },
              ]}
            />
            <Text
              style={[
                styles.chipLabel,
                isActive && { color: cal.color, fontWeight: '600' },
              ]}
              numberOfLines={1}
            >
              {cal.name}
            </Text>
            {isActive && (
              <MaterialIcons name="check" size={14} color={cal.color} />
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  if (loading && calendarConfigs.length === 0) {
    return <ProgressWithMessage message="Cargando calendarios..." />;
  }

  return (
    <TabScreenWrapper
      style={styles.container}
      edges={Platform.OS === 'ios' ? ['top'] : []}
    >
      {offline && <OfflineBanner text="Mostrando datos sin conexión" />}

      {/* View mode switcher */}
      <View style={styles.switcher}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setViewMode('calendar')}
          style={[
            styles.switcherTab,
            viewMode === 'calendar' && styles.switcherTabActive,
          ]}
        >
          <MaterialIcons
            name="calendar-month"
            size={18}
            color={
              viewMode === 'calendar'
                ? isDark
                  ? '#fff'
                  : '#fff'
                : isDark
                  ? '#8E8E93'
                  : '#8E8E93'
            }
          />
          <Text
            style={[
              styles.switcherLabel,
              viewMode === 'calendar' && styles.switcherLabelActive,
            ]}
          >
            Mes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setViewMode('agenda')}
          style={[
            styles.switcherTab,
            viewMode === 'agenda' && styles.switcherTabActive,
          ]}
        >
          <MaterialIcons
            name="view-agenda"
            size={18}
            color={
              viewMode === 'agenda'
                ? isDark
                  ? '#fff'
                  : '#fff'
                : isDark
                  ? '#8E8E93'
                  : '#8E8E93'
            }
          />
          <Text
            style={[
              styles.switcherLabel,
              viewMode === 'agenda' && styles.switcherLabelActive,
            ]}
          >
            Agenda
          </Text>
        </TouchableOpacity>
      </View>

      {viewMode === 'calendar' ? (
        <ScrollView showsVerticalScrollIndicator={false}>
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
              calendarBackground: isDark ? '#1C1C1E' : '#F2F2F7',
              dayTextColor: isDark ? '#FFFFFF' : '#1C1C1E',
              monthTextColor: isDark ? '#FFFFFF' : '#1C1C1E',
              textSectionTitleColor: isDark ? '#8E8E93' : '#8E8E93',
              selectedDayBackgroundColor: colors.info,
              selectedDayTextColor: colors.white,
              arrowColor: colors.info,
              todayTextColor: colors.info,
              textDayFontWeight: '500',
              textMonthFontWeight: '700',
              textDayHeaderFontWeight: '600',
              textMonthFontSize: 18,
            }}
          />

          {/* Filter chips */}
          {renderFilterChips()}

          {/* Events for selected date */}
          <View style={styles.eventSection}>
            <View style={styles.eventSectionHeader}>
              <View style={styles.eventSectionLeft}>
                <Text style={styles.eventSectionDay}>
                  {selectedDate === todayStr
                    ? 'Hoy'
                    : formatDateShort(selectedDate).day.toString()}
                </Text>
                <View>
                  <Text style={styles.eventSectionWeekday}>
                    {selectedDate === todayStr
                      ? formatDate(todayStr)
                      : formatDate(selectedDate)}
                  </Text>
                  {eventsForSelected.length > 0 && (
                    <Text style={styles.eventSectionCount}>
                      {eventsForSelected.length} evento
                      {eventsForSelected.length !== 1 ? 's' : ''}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {eventsForSelected.length > 0 ? (
              eventsForSelected.map((ev, i) =>
                renderEventCard(ev, i, selectedDate < todayStr),
              )
            ) : (
              <View style={styles.emptyState}>
                <MaterialIcons
                  name="event-available"
                  size={40}
                  color={isDark ? Colors.dark.card : '#D1D1D6'}
                />
                <Text style={styles.emptyText}>Sin eventos</Text>
                <Text style={styles.emptySubtext}>
                  No hay eventos programados para este día
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        <>
          {/* Agenda view header */}
          <View style={styles.agendaHeader}>
            <TouchableOpacity
              onPress={() => changeMonth(-1)}
              style={styles.agendaNavBtn}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name="chevron-left"
                size={28}
                color={colors.info}
              />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <TouchableOpacity
              onPress={() => changeMonth(1)}
              style={styles.agendaNavBtn}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name="chevron-right"
                size={28}
                color={colors.info}
              />
            </TouchableOpacity>
          </View>

          {/* Filter chips */}
          {renderFilterChips()}

          <SectionList
            sections={agendaSections}
            keyExtractor={(item, index) => `${item.title}-${index}`}
            contentContainerStyle={styles.agendaContent}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section: { title, data } }) => {
              if (!data || data.length === 0) return null;

              const isPast = title < todayStr;
              const isToday = title === todayStr;
              const isTomorrow =
                new Date(title + 'T00:00:00').getTime() ===
                new Date(todayStr + 'T00:00:00').getTime() +
                  24 * 60 * 60 * 1000;

              const { day, weekday } = formatDateShort(title);

              return (
                <View
                  style={[
                    styles.sectionHeader,
                    isToday && styles.todaySectionHeader,
                    isPast && styles.pastSectionHeader,
                  ]}
                >
                  <View style={styles.sectionDateColumn}>
                    <Text
                      style={[
                        styles.sectionDay,
                        isToday && styles.todayAccent,
                        isPast && styles.pastText,
                      ]}
                    >
                      {day}
                    </Text>
                    <Text
                      style={[
                        styles.sectionWeekday,
                        isToday && styles.todayAccent,
                        isPast && styles.pastText,
                      ]}
                    >
                      {isToday
                        ? 'HOY'
                        : isTomorrow
                          ? 'MAÑANA'
                          : weekday}
                    </Text>
                  </View>
                  <View style={styles.sectionDivider} />
                  <View style={styles.sectionBadge}>
                    <Text
                      style={[
                        styles.sectionBadgeText,
                        isPast && styles.pastText,
                      ]}
                    >
                      {data.length}
                    </Text>
                  </View>
                </View>
              );
            }}
            renderItem={({ item, section }) => {
              const isPast = section.title < todayStr;
              return renderEventCard(item, 0, isPast);
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialIcons
                  name="event-available"
                  size={40}
                  color={isDark ? Colors.dark.card : '#D1D1D6'}
                />
                <Text style={styles.emptyText}>Sin eventos este mes</Text>
              </View>
            }
          />
        </>
      )}

      {/* FAB to go to today */}
      {selectedDate !== todayStr &&
        (Platform.OS === 'ios' ? (
          <GlassFAB
            icon="today"
            onPress={goToToday}
            tintColor={colors.info}
            iconColor="#fff"
          />
        ) : (
          <TouchableOpacity
            style={styles.fab}
            onPress={goToToday}
            activeOpacity={0.8}
          >
            <MaterialIcons name="today" size={24} color="#fff" />
          </TouchableOpacity>
        ))}
    </TabScreenWrapper>
  );
}

const createStyles = (scheme: 'light' | 'dark') => {
  const isDark = scheme === 'dark';
  const theme = Colors[scheme];

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
    },

    // View mode switcher
    switcher: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 8,
      backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
      borderRadius: radii.md,
      padding: 3,
    },
    switcherTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 10,
      gap: 6,
    },
    switcherTabActive: {
      backgroundColor: colors.info,
      // On Android, elevation on the active tab causes colour bleed onto siblings.
      // The coloured background is contrast enough without any shadow.
      elevation: 0,
    },
    switcherLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#8E8E93' : '#8E8E93',
    },
    switcherLabelActive: {
      color: '#fff',
    },

    // Calendar
    calendar: {
      marginBottom: 4,
    },

    // Filter chips
    chipsScroll: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#2C2C2E' : '#fff',
      borderRadius: 100,
      paddingHorizontal: 12,
      paddingVertical: 7,
      gap: 6,
      borderWidth: 1,
      borderColor: isDark ? Colors.dark.card : '#E5E5EA',
      // No elevation/shadow — the border is enough. Elevation on Android
      // adds a Material Design drop-shadow that makes chips look dark & raised.
      elevation: 0,
    },
    chipDot: {
      width: 8,
      height: 8,
      borderRadius: radii.xs,
    },
    chipLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: isDark ? '#AEAEB2' : '#636366',
    },

    // Event section (calendar view)
    eventSection: {
      paddingHorizontal: 16,
      paddingBottom: Platform.OS === 'ios' ? 100 : 24,
    },
    eventSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      marginTop: 4,
    },
    eventSectionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    eventSectionDay: {
      fontSize: 34,
      fontWeight: '700',
      color: colors.info,
      lineHeight: 40,
    },
    eventSectionWeekday: {
      fontSize: 14,
      fontWeight: '500',
      color: isDark ? '#AEAEB2' : '#636366',
      textTransform: 'capitalize',
    },
    eventSectionCount: {
      fontSize: 12,
      fontWeight: '500',
      color: isDark ? '#636366' : '#AEAEB2',
      marginTop: 1,
    },

    // Event card
    eventCard: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#2C2C2E' : '#fff',
      borderRadius: radii.lg,
      marginBottom: 8,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? {
            boxShadow: isDark
              ? '0 1px 3px rgba(0,0,0,0.4)'
              : '0 1px 3px rgba(0,0,0,0.06)',
          }
        : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: isDark ? 0.25 : 0.04,
            shadowRadius: 3,
            elevation: 1,
          }),
    },
    pastEventCard: {
      opacity: 0.55,
    },
    eventColorBar: {
      width: 4,
      borderTopLeftRadius: radii.lg,
      borderBottomLeftRadius: radii.lg,
    },
    eventCardBody: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 6,
    },
    eventCardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 8,
    },
    eventTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : '#1C1C1E',
      flex: 1,
      letterSpacing: -0.2,
    },
    calendarBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: radii.sm,
      paddingHorizontal: 8,
      paddingVertical: 3,
      gap: 4,
      maxWidth: 120,
    },
    calendarDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    calendarBadgeText: {
      fontSize: 11,
      fontWeight: '600',
    },
    eventMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    eventLocation: {
      fontSize: 13,
      color: isDark ? '#8E8E93' : '#8E8E93',
      flex: 1,
    },
    eventDuration: {
      fontSize: 13,
      color: isDark ? '#8E8E93' : '#8E8E93',
    },

    // Empty state
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      gap: 8,
    },
    emptyText: {
      fontSize: 17,
      fontWeight: '600',
      color: isDark ? '#636366' : '#AEAEB2',
    },
    emptySubtext: {
      fontSize: 14,
      color: isDark ? '#48484A' : '#C7C7CC',
    },

    // Agenda view
    agendaHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      gap: 4,
    },
    agendaNavBtn: {
      width: 40,
      height: 40,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthLabel: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#1C1C1E',
      minWidth: 180,
      textAlign: 'center',
      letterSpacing: -0.3,
    },
    agendaContent: {
      paddingHorizontal: 16,
      paddingBottom: Platform.OS === 'ios' ? 100 : 24,
    },

    // Section header (agenda)
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 4,
      marginTop: 8,
      gap: 12,
    },
    todaySectionHeader: {},
    pastSectionHeader: {
      opacity: 0.6,
    },
    sectionDateColumn: {
      alignItems: 'center',
      minWidth: 44,
    },
    sectionDay: {
      fontSize: 26,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#1C1C1E',
      lineHeight: 30,
    },
    sectionWeekday: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? '#8E8E93' : '#8E8E93',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    todayAccent: {
      color: colors.info,
    },
    sectionDivider: {
      flex: 1,
      height: 1,
      backgroundColor: isDark ? Colors.dark.card : '#E5E5EA',
    },
    sectionBadge: {
      backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
      minWidth: 24,
      alignItems: 'center',
    },
    sectionBadgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: isDark ? '#8E8E93' : '#636366',
    },

    // Misc
    pastText: {
      color: isDark ? '#636366' : '#AEAEB2',
    },
    noEvents: {
      ...typography.body,
      color: theme.text,
      fontStyle: 'italic',
    },

    // FAB
    fab: {
      position: 'absolute',
      right: 16,
      bottom: Platform.OS === 'ios' ? 90 : 16,
      backgroundColor: colors.info,
      borderRadius: 16,
    },
  });
};
