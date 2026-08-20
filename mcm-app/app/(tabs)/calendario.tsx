// app/(tabs)/calendario.tsx
import React, { useState, useMemo, useCallback, useLayoutEffect } from 'react';
import { createNativeStackNavigator } from 'expo-router/build/react-navigation/native-stack';
import {
  View,
  ScrollView,
  SectionList,
  TouchableOpacity,
  Platform,
  Text,
} from 'react-native';
import { CalendarProps, LocaleConfig } from 'react-native-calendars';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import colors, { TabHeaderColors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import Animated from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { SectionListProps } from 'react-native';
import { useTabScroll, useTabListScroll } from '@/components/tabs/useTabScroll';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import useCalendarEvents, { CalendarEvent } from '@/hooks/useCalendarEvents';
import { useCalendarConfig } from '@/contexts/CalendarConfigContext';
import ProgressWithMessage from '@/components/ProgressWithMessage';
import OfflineBanner from '@/components/OfflineBanner';
import { useLocalSearchParams } from 'expo-router';
import {
  useRoute,
  useNavigation,
  useHeaderHeight,
} from 'expo-router/react-navigation';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { hexAlpha } from '@/utils/colorUtils';
import { h } from '@/utils/haptics';
import { localISO } from '@/utils/localDate';
import SwipeableMonthCalendar from '@/components/calendar/SwipeableMonthCalendar';
import CalendarSubscribeBottomSheet from '@/components/CalendarSubscribeBottomSheet';
import EventDetailsBottomSheet from '@/components/EventDetailsBottomSheet';
import EmptyState from '@/components/ui/EmptyState';
import { createStyles } from '@/components/calendar/calendarioStyles';
import TabTintBar from '@/components/ui/TabTintBar';

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

// Reanimated 4 no trae `Animated.SectionList` hecho, hay que crearlo. Se hace
// a nivel de módulo para que no se remonte la lista en cada render.
const AnimatedSectionList = Animated.createAnimatedComponent(
  SectionList as React.ComponentType<
    SectionListProps<CalendarEvent, { title: string; data: CalendarEvent[] }>
  >,
);

/** 'YYYY-MM-DD' de un Date, en hora LOCAL (nada de toISOString, que en
 *  España desplaza el día 1 al último del mes anterior). */
const dateToStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Hueco que ocupa el botón de suscribirse (icono + su padding) en el header. */
const SUBSCRIBE_SLOT = 56;
/** Margen lateral del header nativo. */
const HEADER_SIDE_PADDING = 16;

/** Día 1 del mes al que pertenece la fecha dada. */
const monthStart = (dateStr: string): string => `${dateStr.slice(0, 7)}-01`;

/** Suma meses al mes de una fecha y devuelve su día 1. */
const addMonths = (dateStr: string, delta: number): string => {
  const [y, m] = dateStr.split('-').map(Number);
  return dateToStr(new Date(y, m - 1 + delta, 1));
};

export function CalendarScreen() {
  const scheme = useColorScheme();
  // Modo agenda: es el scroller que representa al tab (re-tap → arriba).
  const {
    listRef: agendaRef,
    onScroll: onAgendaScroll,
    contentPaddingBottom,
  } = useTabListScroll<
    SectionList<CalendarEvent, { title: string; data: CalendarEvent[] }>
  >('calendario');
  // Modo calendario: mismo tab; se registra igual y gana el que esté montado.
  const { scrollRef: calendarScrollRef, onScroll: onCalendarScroll } =
    useTabScroll('calendario');
  const styles = React.useMemo(() => createStyles(scheme), [scheme]);
  const isDark = scheme === 'dark';
  const layout = useResponsiveLayout();
  // En iPad landscape mostramos el calendario en dos paneles (mes a la
  // izquierda, eventos del día a la derecha). En portrait/estrecho es una sola
  // columna centrada. En móvil, ancho completo (sin cambios).
  const isLandscapeWide = layout.isWide && layout.isLandscape;
  const wideContentStyle = layout.isWide
    ? {
        width: '100%' as const,
        maxWidth: isLandscapeWide ? 1000 : 760,
        alignSelf: 'center' as const,
      }
    : null;
  const params = useLocalSearchParams<{ date?: string }>();
  // En iOS, `calendario` es un tab "overflow" sin trigger nativo: se navega
  // desde el stack de Más (React Navigation), cuyos params NO llegan a
  // `useLocalSearchParams` (que sólo lee la URL de expo-router). Leemos también
  // los params de React Navigation para soportar el salto a fecha desde Home.
  const navRoute = useRoute();
  const navParamDate = (navRoute.params as { date?: string } | undefined)?.date;
  const dateParam = params.date ?? navParamDate;

  const {
    calendarConfigs,
    visibleCalendars,
    toggleCalendarVisibility,
    loading: configsLoading,
    offline,
  } = useCalendarConfig();

  // `localISO()` (hora local) — `toISOString()` desplazaba "hoy" al día
  // anterior entre las 00:00 y ~01-02h locales (conversión a UTC).
  const todayStr = localISO();

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  // El MES visible es estado propio, independiente del día seleccionado: es lo
  // que comparten la rejilla del mes y la agenda, y lo que mueve el swipe.
  const [visibleMonth, setVisibleMonth] = useState<string>(() =>
    monthStart(todayStr),
  );
  const [viewMode, setViewMode] = useState<'calendar' | 'agenda'>('calendar');
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [detailsEvent, setDetailsEvent] = useState<CalendarEvent | null>(null);

  // Header NATIVO: el botón de calendarios (suscribirse) como bar item y, en el
  // TAB, el conmutador Mes/Agenda ocupando el sitio del título. El header estaba
  // casi vacío (la pestaña ya se llama Calendario) y el conmutador se comía una
  // fila entera justo debajo: metiéndolo dentro se recupera ese alto para la
  // rejilla del mes. En el stack de "Más" NO se hace: allí es una pantalla
  // apilada, con su back y su título, y el conmutador se queda en el cuerpo.
  const navigation = useNavigation();
  const switcherInHeader =
    Platform.OS !== 'web' && navRoute.name !== 'Calendario';
  // Ancho del conmutador dentro del header: TODO lo que hay desde el borde
  // hasta el botón de suscribirse. Se calcula desde el ancho real de la
  // ventana (no un número a ojo) para que cuadre igual en un iPhone pequeño,
  // en uno grande, en iPad y al girar la pantalla; en pantallas anchas se capa
  // para que no se convierta en una barra de medio metro.
  const switcherWidth = Math.min(
    Math.max(layout.width - HEADER_SIDE_PADDING * 2 - SUBSCRIBE_SLOT, 160),
    420,
  );
  // Altura REAL del header del anfitrión (incluye la barra de estado y baja a
  // 32pt en horizontal), en vez de los 44 a ojo de antes.
  const headerHeight = useHeaderHeight();
  const showSubscribe = !configsLoading && calendarConfigs.length > 0;
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: showSubscribe
        ? () => (
            <TouchableOpacity
              onPress={() => {
                h.tap();
                setSubscribeOpen(true);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ padding: 6 }}
              accessibilityLabel="Suscribirse a calendarios"
            >
              <MaterialIcons
                name="bookmark-add"
                size={22}
                color={isDark ? colors.info : colors.primary}
              />
            </TouchableOpacity>
          )
        : undefined,
      ...(switcherInHeader
        ? {
            headerTitle: () => (
              <View style={[styles.headerSwitcher, { width: switcherWidth }]}>
                <SegmentedControl
                  value={viewMode}
                  onChange={setViewMode}
                  compact
                  accessibilityLabel="Vista del calendario"
                  options={[
                    { value: 'calendar', label: 'Mes', icon: 'calendar-month' },
                    { value: 'agenda', label: 'Agenda', icon: 'view-agenda' },
                  ]}
                />
              </View>
            ),
          }
        : {}),
    });
  }, [
    navigation,
    showSubscribe,
    isDark,
    switcherInHeader,
    switcherWidth,
    viewMode,
    styles,
  ]);

  // Un deep-link con `?date=` salta a ese día. Se ajusta DURANTE el render (el
  // patrón que documenta React para "cambiar estado cuando cambia una prop"),
  // no en un efecto: así no hay un render intermedio pintando el día anterior.
  const [lastDateParam, setLastDateParam] = useState(dateParam);
  if (dateParam !== lastDateParam) {
    setLastDateParam(dateParam);
    if (dateParam && typeof dateParam === 'string') {
      setSelectedDate(dateParam);
      setVisibleMonth(monthStart(dateParam));
    }
  }

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
    const d = new Date(visibleMonth + 'T00:00:00');
    const label = d.toLocaleDateString('es-ES', {
      month: 'long',
      year: 'numeric',
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [visibleMonth]);

  // Al cambiar de mes, el día seleccionado se mueve con él: hoy si el mes es
  // el actual, y si no el día 1. Así la ficha de "eventos del día" nunca se
  // queda hablando de un mes que ya no está en pantalla.
  const goToMonth = useCallback(
    (monthISO: string) => {
      setVisibleMonth(monthISO);
      setSelectedDate(
        monthISO.slice(0, 7) === todayStr.slice(0, 7) ? todayStr : monthISO,
      );
    },
    [todayStr],
  );

  const changeMonth = useCallback(
    (delta: number) => {
      goToMonth(addMonths(visibleMonth, delta));
    },
    [visibleMonth, goToMonth],
  );

  const goToToday = useCallback(() => {
    setSelectedDate(todayStr);
    setVisibleMonth(monthStart(todayStr));
  }, [todayStr]);

  const selectDay = useCallback(
    (dateString: string) => {
      if (dateString === selectedDate) return;
      h.select();
      setSelectedDate(dateString);
      setVisibleMonth(monthStart(dateString));
    },
    [selectedDate],
  );

  // Swipe horizontal para la agenda (la rejilla del mes trae el suyo, con
  // animación, dentro de SwipeableMonthCalendar). `failOffsetY` deja pasar el
  // scroll vertical de la lista sin pelearse con el gesto.
  const agendaSwipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-18, 18])
        .failOffsetY([-16, 16])
        .onEnd((e) => {
          if (Math.abs(e.translationX) > 60 || Math.abs(e.velocityX) > 700) {
            scheduleOnRN(changeMonth, e.translationX < 0 ? 1 : -1);
          }
        }),
    [changeMonth],
  );

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
    const d0 = new Date(visibleMonth + 'T12:00:00');
    const firstDay = new Date(d0.getFullYear(), d0.getMonth(), 1);
    const lastDay = new Date(d0.getFullYear(), d0.getMonth() + 1, 0);
    const sections: { title: string; data: CalendarEvent[] }[] = [];
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      const dateStr = dateToStr(d);
      sections.push({ title: dateStr, data: filteredByDate[dateStr] || [] });
    }
    return sections;
  }, [filteredByDate, visibleMonth]);

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

    const timeLabel = ev.startTime
      ? ev.endTime
        ? `${ev.startTime} – ${ev.endTime}`
        : ev.startTime
      : null;

    return (
      <TouchableOpacity
        key={index}
        activeOpacity={0.7}
        style={[styles.eventCard, isPast && styles.pastEventCard]}
        onPress={() => {
          h.tap();
          setDetailsEvent(ev);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Ver detalles de ${ev.title}`}
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
          {timeLabel ? (
            <View style={styles.eventMeta}>
              <MaterialIcons name="schedule" size={14} color="#8E8E93" />
              <Text
                style={[styles.eventLocation, isPast && styles.pastText]}
                numberOfLines={1}
              >
                {timeLabel}
              </Text>
            </View>
          ) : null}
          {ev.location ? (
            <View style={styles.eventMeta}>
              <MaterialIcons name="place" size={14} color="#8E8E93" />
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
              <MaterialIcons name="date-range" size={14} color="#8E8E93" />
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
            hitSlop={{ top: 5, bottom: 5 }}
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
    <View
      style={[
        styles.container,
        { flex: 1 },
        // El header del stack es TRANSPARENTE en iOS (glass del sistema) en los
        // dos anfitriones —el tab y el stack de "Más"—: el contenido pasa por
        // debajo, así que hay que reservar su altura. Sin ella el conmutador
        // Mes/Agenda se metía DEBAJO del header y chocaba con el botón de
        // suscribirse. En Android y web el header es opaco y ya ocupa su sitio
        // en el layout, así que aquí no se reserva nada.
        { paddingTop: Platform.OS === 'ios' ? headerHeight : 0 },
      ]}
    >
      {offline && <OfflineBanner text="Mostrando datos sin conexión" />}

      <View style={[styles.bodyWrap, wideContentStyle]}>
        {/* Conmutador Mes/Agenda: solo aquí cuando NO va en el header (stack de
            "Más" y web). En el tab vive dentro del header, ver arriba. */}
        {!switcherInHeader && (
          <View
            style={[
              styles.switcherWrapper,
              layout.isWide && styles.switcherWrapperWide,
            ]}
          >
            <SegmentedControl
              value={viewMode}
              onChange={setViewMode}
              accessibilityLabel="Vista del calendario"
              options={[
                { value: 'calendar', label: 'Mes', icon: 'calendar-month' },
                { value: 'agenda', label: 'Agenda', icon: 'view-agenda' },
              ]}
            />
          </View>
        )}

        {viewMode === 'calendar' ? (
          <Animated.ScrollView
            ref={calendarScrollRef}
            onScroll={onCalendarScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingBottom: contentPaddingBottom }}
            showsVerticalScrollIndicator={false}
          >
            <View style={isLandscapeWide ? styles.monthRowTwoPane : undefined}>
              <View style={isLandscapeWide ? styles.monthLeftPane : undefined}>
                <View style={styles.calendarCardContainer}>
                  <SwipeableMonthCalendar
                    key={scheme ?? 'light'}
                    visibleMonth={visibleMonth}
                    markedDates={markedDates}
                    onDayPress={selectDay}
                    onChangeMonth={changeMonth}
                    isDark={isDark}
                  />
                </View>

                {/* Filter chips */}
                {renderFilterChips()}
              </View>
              <View style={isLandscapeWide ? styles.monthRightPane : undefined}>
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
                    {selectedDate !== todayStr && (
                      <BackToTodayPill onPress={goToToday} styles={styles} />
                    )}
                  </View>

                  {eventsForSelected.length > 0 ? (
                    eventsForSelected.map((ev, i) =>
                      renderEventCard(ev, i, selectedDate < todayStr),
                    )
                  ) : (
                    <EmptyState
                      icon="event-available"
                      title="Sin eventos"
                      subtitle="No hay eventos programados para este día"
                    />
                  )}
                </View>
              </View>
            </View>
          </Animated.ScrollView>
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

            {visibleMonth.slice(0, 7) !== todayStr.slice(0, 7) && (
              <View style={styles.agendaBackToTodayRow}>
                <BackToTodayPill onPress={goToToday} styles={styles} />
              </View>
            )}

            <GestureDetector gesture={agendaSwipe}>
              <AnimatedSectionList
                ref={agendaRef}
                onScroll={onAgendaScroll}
                scrollEventThrottle={16}
                sections={agendaSectionsFiltered}
                keyExtractor={(item, index) => `${item.title}-${index}`}
                style={styles.agendaList}
                contentContainerStyle={[
                  styles.agendaContent,
                  { paddingBottom: contentPaddingBottom },
                ]}
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
                  <EmptyState
                    icon={allCalendarsHidden ? 'visibility-off' : 'event-busy'}
                    title={
                      allCalendarsHidden
                        ? 'Todos los calendarios ocultos'
                        : 'Sin eventos este mes'
                    }
                    subtitle={
                      allCalendarsHidden
                        ? 'Activa algún calendario desde los filtros de arriba'
                        : 'No hay eventos programados para ' + monthLabel
                    }
                  />
                }
              />
            </GestureDetector>
          </View>
        )}
      </View>

      <CalendarSubscribeBottomSheet
        visible={subscribeOpen}
        onClose={() => setSubscribeOpen(false)}
        calendars={calendarConfigs}
      />

      <EventDetailsBottomSheet
        visible={!!detailsEvent}
        onClose={() => setDetailsEvent(null)}
        event={detailsEvent}
        calendarConfig={
          detailsEvent ? calendarConfigs[detailsEvent.calendarIndex] : undefined
        }
      />
    </View>
  );
}

// Tab del calendario: envuelve la pantalla en un stack para tener header nativo
// (SIN título — solo el botón de calendarios, que CalendarScreen añade como bar
// item). Reusa el mismo CalendarScreen que el stack de "Más", donde sí lleva
// título porque allí es una pantalla apilada.
const CalStack = createNativeStackNavigator();
export default function CalendarioTab() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return (
    <>
      {/* Raya celeste del calendario pegada arriba, como la roja de Fotos. */}
      <TabTintBar color={TabHeaderColors.calendario} />
      <CalStack.Navigator
        screenOptions={{
          headerShadowVisible: false,
          headerTintColor: isDark ? '#FFFFFF' : '#1a1a1a',
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 17,
            color: isDark ? '#FFFFFF' : '#1a1a1a',
          },
          // Header transparente (como el cantoral): glass del sistema en iOS.
          headerTransparent: Platform.OS === 'ios',
          ...(Platform.OS === 'ios' &&
          parseInt(String(Platform.Version), 10) < 26
            ? { headerBlurEffect: 'systemChromeMaterial' as const }
            : {}),
        }}
      >
        <CalStack.Screen
          name="CalendarMain"
          component={CalendarScreen}
          // Sin título: la pestaña ya se llama Calendario. `headerTitle: ''` deja
          // la barra vacía (transparente en iOS) para que el botón de
          // suscribirse conviva con el conmutador Mes/Agenda de debajo.
          options={{ headerTitle: '' }}
        />
      </CalStack.Navigator>
    </>
  );
}

interface BackToTodayPillProps {
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}

function BackToTodayPill({ onPress, styles }: BackToTodayPillProps) {
  return (
    <TouchableOpacity
      style={styles.backToTodayPill}
      onPress={() => {
        h.tap();
        onPress();
      }}
      activeOpacity={0.75}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel="Volver a hoy"
    >
      <MaterialIcons name="today" size={14} color={colors.info} />
      <Text style={styles.backToTodayLabel}>Volver a hoy</Text>
    </TouchableOpacity>
  );
}
