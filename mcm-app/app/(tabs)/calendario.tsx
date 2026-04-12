// app/(tabs)/calendario.tsx
import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  SectionList,
  TouchableOpacity,
  Platform,
  Text,
} from 'react-native';
import TabScreenWrapper from '@/components/ui/TabScreenWrapper.ios';
import { Calendar, CalendarProps, LocaleConfig } from 'react-native-calendars';
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
import { hexAlpha } from '@/utils/colorUtils';

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

  // Estado extra para forzar que Calendar navegue al mes correcto
  // (react-native-calendars trata `current` como valor inicial, no reactivo)
  const [calendarKey, setCalendarKey] = useState(0);

  // 'T12:00:00' evita que el offset UTC+2 (España) desplace el día 1
  // al último día del mes anterior cuando hacemos new Date(...).toISOString()
  const dateToStr = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const changeMonth = useCallback(
    (delta: number) => {
      const d = new Date(selectedDate + 'T12:00:00');
      const newDate = new Date(d.getFullYear(), d.getMonth() + delta, 1);
      setSelectedDate(dateToStr(newDate));
    },
    [selectedDate],
  );

  const goToToday = useCallback(() => {
    setSelectedDate(todayStr);
    // Incrementar la key fuerza al componente Calendar a remontarse y
    // posicionarse en el mes de hoy aunque el usuario estuviera en otro mes
    setCalendarKey((k) => k + 1);
  }, [todayStr]);

  // Ref del X inicial para detectar swipes cross-platform (funciona en web y nativo)
  const swipeTouchX = useRef(0);

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
    const d0 = new Date(selectedDate + 'T12:00:00');
    const firstDay = new Date(d0.getFullYear(), d0.getMonth(), 1);
    const lastDay = new Date(d0.getFullYear(), d0.getMonth() + 1, 0);
    const sections: { title: string; data: CalendarEvent[] }[] = [];
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      const dateStr = dateToStr(d);
      sections.push({ title: dateStr, data: filteredByDate[dateStr] || [] });
    }
    return sections;
  }, [filteredByDate, selectedDate]);

  // Solo secciones CON eventos — así ListEmptyComponent se activa cuando no hay nada
  const agendaSectionsFiltered = useMemo(
    () => agendaSections.filter((s) => s.data.length > 0),
    [agendaSections],
  );

  // true solo si todos los calendarios están explícitamente desactivados
  const allCalendarsHidden =
    visibleCalendars.length > 0 && !visibleCalendars.some(Boolean);

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
        <View style={[styles.eventColorBar, { backgroundColor: calColor }]} />
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
                { backgroundColor: hexAlpha(calColor, '18') },
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
              <Text style={[styles.eventDuration, isPast && styles.pastText]}>
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
      style={styles.chipsScrollView}
      contentContainerStyle={styles.chipsScroll}
    >
      {calendarConfigs.map((cal, idx) => {
        const isActive = visibleCalendars[idx];
        return (
          <TouchableOpacity
            key={idx}
            style={[
              styles.filterChip,
              isActive && {
                backgroundColor: hexAlpha(cal.color, '15'),
                borderColor: cal.color,
              },
            ]}
            onPress={() => toggleCalendarVisibility(idx)}
            activeOpacity={0.7}
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
              <MaterialIcons name="check" size={12} color={cal.color} />
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
      <View style={styles.switcherWrapper}>
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              viewMode === 'calendar' && styles.segmentBtnActive,
            ]}
            onPress={() => setViewMode('calendar')}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name="calendar-month"
              size={16}
              color={viewMode === 'calendar' ? '#fff' : '#8E8E93'}
            />
            <Text
              style={[
                styles.segmentLabel,
                viewMode === 'calendar' && styles.segmentLabelActive,
              ]}
            >
              Mes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              viewMode === 'agenda' && styles.segmentBtnActive,
            ]}
            onPress={() => setViewMode('agenda')}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name="view-agenda"
              size={16}
              color={viewMode === 'agenda' ? '#fff' : '#8E8E93'}
            />
            <Text
              style={[
                styles.segmentLabel,
                viewMode === 'agenda' && styles.segmentLabelActive,
              ]}
            >
              Agenda
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === 'calendar' ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Wrapper para detectar swipes horizontales (cross-platform) */}
          <View
            onTouchStart={(e) => {
              swipeTouchX.current = e.nativeEvent.pageX;
            }}
            onTouchEnd={(e) => {
              const dx = e.nativeEvent.pageX - swipeTouchX.current;
              if (Math.abs(dx) > 60) changeMonth(dx < 0 ? 1 : -1);
            }}
          >
            <Calendar
              key={calendarKey}
              current={selectedDate}
              onDayPress={(day) => {
                if (day.dateString !== selectedDate) {
                  setSelectedDate(day.dateString);
                }
              }}
              onMonthChange={(month) => {
                setSelectedDate(month.dateString);
              }}
              markedDates={markedDates}
              markingType="multi-period"
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
          </View>

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
        <View style={styles.agendaContainer}>
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
            sections={agendaSectionsFiltered}
            keyExtractor={(item, index) => `${item.title}-${index}`}
            style={styles.agendaList}
            contentContainerStyle={styles.agendaContent}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section: { title, data } }) => {
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
                      {isToday ? 'HOY' : isTomorrow ? 'MAÑANA' : weekday}
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
              <View style={styles.agendaEmptyState}>
                <MaterialIcons
                  name={allCalendarsHidden ? 'visibility-off' : 'event-busy'}
                  size={44}
                  color={isDark ? '#48484A' : '#C7C7CC'}
                />
                <Text style={[styles.emptyText, { marginTop: 12 }]}>
                  {allCalendarsHidden
                    ? 'Todos los calendarios ocultos'
                    : 'Sin eventos este mes'}
                </Text>
                <Text
                  style={[
                    styles.emptySubtext,
                    { textAlign: 'center', marginTop: 4 },
                  ]}
                >
                  {allCalendarsHidden
                    ? 'Activa algún calendario desde los filtros de arriba'
                    : 'No hay eventos programados para ' + monthLabel}
                </Text>
              </View>
            }
          />
        </View>
      )}

      {/* FAB to go to today */}
      {selectedDate !== todayStr &&
        (Platform.OS === 'ios' ? (
          <GlassFAB
            icon="arrow-back"
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
            <MaterialIcons name="today" size={18} color="#fff" />
            <Text style={styles.fabLabel}>Hoy</Text>
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
    switcherWrapper: {
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 8,
    },
    segmentedControl: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
      borderRadius: 10,
      padding: 2,
    },
    segmentBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      borderRadius: 8,
    },
    segmentBtnActive: {
      backgroundColor: colors.info,
    },
    segmentLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: '#8E8E93',
    },
    segmentLabelActive: {
      color: '#fff',
    },

    // Calendar
    calendar: {
      marginBottom: 4,
    },

    // Filter chips
    chipsScrollView: {
      flexShrink: 0,
      flexGrow: 0,
    },
    chipsScroll: {
      flexDirection: 'row', // Necesario en web — RN Web no lo aplica auto con horizontal={true}
      alignItems: 'center',
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

    // Agenda container — flex: 1 para que el SectionList crezca y los chips no
    agendaContainer: {
      flex: 1,
    },
    agendaList: {
      flex: 1,
    },
    agendaEmptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      paddingHorizontal: 32,
      gap: 4,
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
      bottom: Platform.OS === 'ios' ? 90 : 24,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.info,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
      ...(Platform.OS === 'web'
        ? { boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }
        : {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 6,
            elevation: 5,
          }),
    },
    fabLabel: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '700',
    },
  });
};
