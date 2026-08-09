import { logger } from '@/utils/logger';
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Card } from 'heroui-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/colors';
import Animated from 'react-native-reanimated';
import { useTabScroll } from '@/components/tabs/useTabScroll';
import { useColorScheme } from '@/hooks/useColorScheme';
import useSectionFontScale from '@/hooks/useSectionFontScale';
import { useContigoHabits } from '@/hooks/useContigoHabits';
import { useDailyReadings } from '@/hooks/useDailyReadings';
import {
  LiturgicalBadge,
  getLiturgicalInfo,
} from '@/components/contigo/LiturgicalBadge';
import { ReadingCard } from '@/components/contigo/ReadingCard';
import { HighlightableReading } from '@/components/contigo/HighlightableReading';
import { HighlightActionBar } from '@/components/contigo/HighlightActionBar';
import { ReadingCalendarSheet } from '@/components/contigo/ReadingCalendarSheet';
import { CreditsSheet } from '@/components/contigo/CreditsSheet';
import ReaderSettingsSheet from '@/components/contigo/ReaderSettingsSheet';
import { hexAlpha } from '@/utils/colorUtils';
import { useReaderBookmarks } from '@/hooks/useReaderBookmarks';
import { useAvailableReadingDates } from '@/hooks/useAvailableReadingDates';
import { segmentReading } from '@/utils/readingSegments';
import { useReadingHighlights } from '@/hooks/useReadingHighlights';
import {
  HIGHLIGHT_SOURCES,
  type HighlightSource,
} from '@/utils/contigoBookmarks';
import { pickStickyHighlightColor } from '@/utils/stickyHighlightColor';
import type { ReadingSelection } from '@/components/contigo/HighlightableReading';

import { CelebrationAnimation } from '@/components/contigo/CelebrationAnimation';
import { styles } from '@/components/contigo/evangelioStyles';

// ── Contigo warm palette (aligned with redesign tokens) ──
const WARM = {
  light: {
    accent: '#C4922A',
    accentSoft: '#FFF8E7',
    surface: '#FAF6F0',
    warmGray: '#7A6550',
  },
  dark: {
    accent: '#DAA520',
    accentSoft: '#2A2112',
    surface: '#1A1712',
    warmGray: '#A09A8A',
  },
};

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function formatDateDisplay(dateStr: string) {
  if (!dateStr) return '';
  // Parse as local date — avoid timezone offset
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const days = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
  ];
  return `${days[date.getDay()]}, ${d} de ${MONTHS[m - 1]}`;
}

/** Navigate by exactly 1 day — uses local date math to avoid timezone bugs */
function addDays(dateStr: string, offset: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + offset);
  const ny = date.getFullYear();
  const nm = String(date.getMonth() + 1).padStart(2, '0');
  const nd = String(date.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

export default function EvangelioScreen() {
  // Subruta de Contigo: se registra con la clave del tab (gana el último
  // montado), así el re-tap sube el scroll de la pantalla que se está viendo.
  const { scrollRef, onScroll, contentPaddingBottom } = useTabScroll('contigo');
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  const warm = isDark ? WARM.dark : WARM.light;
  const insets = useSafeAreaInsets();
  const { scale: fontScale } = useSectionFontScale('contigo');
  const { width: windowWidth } = useWindowDimensions();
  // iPad / large tablet / desktop web — cap content width.
  const isWide = windowWidth >= 720;
  const contentMaxWidth = windowWidth >= 1100 ? 880 : 720;
  const wideWrapperStyle = isWide
    ? {
        width: '100%' as const,
        maxWidth: contentMaxWidth,
        alignSelf: 'center' as const,
      }
    : undefined;

  const { todayStr, getRecord, setReadingDone } = useContigoHabits();
  const params = useLocalSearchParams<{ date?: string }>();
  const initialDate =
    typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : todayStr || new Date().toISOString().split('T')[0];

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const { readings, isLoading, error } = useDailyReadings(selectedDate);
  const [viewMode, setViewMode] = useState<'lectura' | 'comentario'>('lectura');
  const [showCheck, setShowCheck] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [creditsVisible, setCreditsVisible] = useState(false);
  const [highlightMode, setHighlightMode] = useState(false);
  const [calendarVisible, setCalendarVisible] = useState(false);
  // Latch: no consultamos las fechas disponibles hasta abrir el calendario.
  const [calendarOpened, setCalendarOpened] = useState(false);
  const availableDates = useAvailableReadingDates(calendarOpened);

  const {
    bookmarks,
    getBookmark,
    isBookmarked: isBookmarkedFn,
    toggleBookmark: toggleBm,
    setHighlights,
  } = useReaderBookmarks();
  const isBookmarked = isBookmarkedFn(selectedDate);
  const bookmark = getBookmark(selectedDate);

  // Subrayado de TODAS las lecturas del día (evangelio, comentario, primera
  // lectura, salmo y segunda lectura). El texto canónico y los rangos viven en
  // el hook — ver hooks/useReadingHighlights.ts.
  const hl = useReadingHighlights(
    selectedDate,
    readings,
    bookmark,
    setHighlights,
  );

  /**
   * "Subrayar" desde el menú NATIVO de selección: subraya YA, con el color de
   * turno (`pickStickyHighlightColor`), y enciende el modo lápiz con la barra de
   * colores marcando el color puesto. Así el gesto entero es "selecciono →
   * Subrayar" y se acabó: elegir color pasa a ser opcional, no un toque de
   * peaje. El color se mantiene unos minutos, para que varias frases seguidas
   * salgan del mismo color.
   *
   * El modo lápiz NO desaparece: sigue siendo el único camino en web y el
   * respaldo si el menú nativo no llega a montarse.
   */
  const onNativeHighlight = useMemo(() => {
    const entries = HIGHLIGHT_SOURCES.map((source) => [
      source,
      (sel: ReadingSelection) => {
        hl.applyColor(pickStickyHighlightColor(), { source, sel });
        if (Platform.OS !== 'web')
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setHighlightMode(true);
      },
    ]);
    return Object.fromEntries(entries) as Record<
      HighlightSource,
      (sel: ReadingSelection) => void
    >;
  }, [hl.applyColor]);

  const exitHighlightMode = () => {
    setHighlightMode(false);
    hl.clearSelection();
  };

  const toggleBookmark = async () => {
    if (Platform.OS !== 'web')
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleBm(selectedDate, readings);
  };

  const toggleHighlightMode = () => {
    if (Platform.OS !== 'web')
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (highlightMode) exitHighlightMode();
    else setHighlightMode(true);
  };

  const openCalendar = () => {
    setCalendarOpened(true);
    setCalendarVisible(true);
  };

  const record = getRecord(selectedDate);
  const isDone = record?.readingDone || false;

  const liturgicalInfo = getLiturgicalInfo(selectedDate);

  const changeDate = (offset: number) => {
    exitHighlightMode();
    setSelectedDate(addDays(selectedDate, offset));
  };

  const goToToday = () => {
    if (Platform.OS !== 'web')
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    exitHighlightMode();
    setSelectedDate(todayStr);
  };

  const handleToggleDone = async () => {
    const newValue = !isDone;
    await setReadingDone(selectedDate, newValue);

    if (newValue) {
      // Create a playful, escalating vibration sequence
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTimeout(
          () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
          100,
        );
        setTimeout(
          () =>
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
          250,
        );
      }

      setShowCheck(true);
      setTimeout(() => setShowCheck(false), 2500);
    }
  };

  const openSource = () => {
    if (readings?.evangelio?.url) {
      Linking.openURL(readings.evangelio.url).catch((err) =>
        logger.error("Couldn't open URL", err),
      );
    }
  };

  // Liturgical color for subtle tinting
  const liturgicalAccent =
    liturgicalInfo.hex === '#D4A070'
      ? isDark
        ? '#D4A070'
        : '#A0693A'
      : liturgicalInfo.hex;

  return (
    <View style={[styles.container, { backgroundColor: warm.surface }]}>
      {/* Header NATIVO: back del sistema (con la gota de iOS 26) + acciones
          (guardar / ajustes de texto) como bar items. Sustituye al floating
          header custom. */}
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: '',
          headerTransparent: true,
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
          headerTintColor: theme.text,
          ...(Platform.OS === 'ios' &&
          parseInt(String(Platform.Version), 10) < 26
            ? { headerBlurEffect: 'systemChromeMaterial' as const }
            : {}),
          headerRight: () => (
            <View style={styles.nativeHeaderActions}>
              <TouchableOpacity
                onPress={openCalendar}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.nativeHeaderBtn}
                accessibilityLabel="Calendario de evangelios"
              >
                <MaterialIcons name="event" size={22} color={theme.text} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={toggleHighlightMode}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.nativeHeaderBtn}
                accessibilityLabel="Subrayar texto"
                accessibilityState={{ selected: highlightMode }}
              >
                <MaterialIcons
                  name="border-color"
                  size={21}
                  color={highlightMode ? warm.accent : theme.text}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={toggleBookmark}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.nativeHeaderBtn}
                accessibilityLabel="Guardar evangelio"
              >
                <MaterialIcons
                  name={isBookmarked ? 'bookmark' : 'bookmark-border'}
                  size={24}
                  color={isBookmarked ? warm.accent : theme.text}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSettingsVisible(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.nativeHeaderBtn}
                accessibilityLabel="Ajustes de lectura"
              >
                <MaterialIcons
                  name="text-fields"
                  size={22}
                  color={theme.text}
                />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + (Platform.OS === 'android' ? 68 : 56),
            paddingBottom: contentPaddingBottom,
          },
          // Hueco extra para la barra flotante de subrayado, que se pone por
          // encima de la de pestañas.
          highlightMode && { paddingBottom: contentPaddingBottom + 90 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={wideWrapperStyle}>
          {/* ── Date Navigator with liturgical color backdrop ── */}
          <View
            style={[
              styles.dateNav,
              {
                backgroundColor: isDark
                  ? hexAlpha(liturgicalAccent, '10')
                  : hexAlpha(liturgicalAccent, '08'),
                borderBottomColor: isDark
                  ? 'rgba(255,255,255,0.04)'
                  : 'rgba(0,0,0,0.04)',
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => changeDate(-1)}
              style={[
                styles.dateNavBtn,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(0,0,0,0.05)',
                },
              ]}
              accessibilityLabel="Día anterior"
            >
              <MaterialIcons name="chevron-left" size={26} color={theme.text} />
            </TouchableOpacity>

            <View style={styles.dateDisplay}>
              <Text style={[styles.dateText, { color: theme.text }]}>
                {formatDateDisplay(selectedDate)}
              </Text>

              {/* Volver a hoy: diminuto y solo cuando hace falta (estás en
                  otro día). Estando en hoy no se pinta nada. */}
              {selectedDate !== todayStr ? (
                <TouchableOpacity
                  onPress={goToToday}
                  style={[
                    styles.todayMiniPill,
                    {
                      backgroundColor: hexAlpha(warm.accent, '12'),
                      borderColor: hexAlpha(warm.accent, '30'),
                    },
                  ]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Volver a hoy"
                >
                  <MaterialIcons name="undo" size={12} color={warm.accent} />
                  <Text style={[styles.todayMiniLabel, { color: warm.accent }]}>
                    Volver a hoy
                  </Text>
                </TouchableOpacity>
              ) : null}

              {/* Liturgical badge */}
              <View style={styles.badgeRow}>
                <LiturgicalBadge dateStr={selectedDate} />
              </View>

              {/* Done / Pendiente chip */}
              <View
                style={[
                  styles.statusChip,
                  isDone
                    ? {
                        backgroundColor: isDark
                          ? 'rgba(163,189,49,0.14)'
                          : 'rgba(58,125,68,0.10)',
                      }
                    : {
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.05)',
                      },
                ]}
              >
                {isDone ? (
                  <>
                    <Text
                      style={{
                        fontSize: 10,
                        color: isDark ? '#A3BD31' : '#3A7D44',
                      }}
                    >
                      ✓
                    </Text>
                    <Text
                      style={[
                        styles.statusChipText,
                        { color: isDark ? '#A3BD31' : '#3A7D44' },
                      ]}
                    >
                      Leído
                    </Text>
                  </>
                ) : (
                  <Text
                    style={[styles.statusChipText, { color: warm.warmGray }]}
                  >
                    Pendiente
                  </Text>
                )}
              </View>

              {/* Liturgical day name / celebration */}
              {readings?.info?.diaLiturgico ? (
                <Text
                  style={[styles.diaLiturgico, { color: liturgicalAccent }]}
                  numberOfLines={2}
                >
                  {readings.info.diaLiturgico}
                </Text>
              ) : null}

              {/* Motivational title */}
              {readings?.info?.titulo ? (
                <Text
                  style={[
                    styles.tituloLiturgico,
                    { color: isDark ? warm.warmGray : '#8B7E6E' },
                  ]}
                  numberOfLines={2}
                >
                  {readings.info.titulo}
                </Text>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={() => changeDate(1)}
              style={[
                styles.dateNavBtn,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(0,0,0,0.05)',
                },
              ]}
              accessibilityLabel="Día siguiente"
            >
              <MaterialIcons
                name="chevron-right"
                size={26}
                color={theme.text}
              />
            </TouchableOpacity>
          </View>

          {/* ── Content ── */}
          {isLoading ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator size="large" color={warm.accent} />
              <Text style={[styles.stateText, { color: warm.warmGray }]}>
                Preparando la Palabra...
              </Text>
            </View>
          ) : error || !readings?.evangelio ? (
            <View style={styles.stateContainer}>
              <MaterialIcons name="cloud-off" size={48} color={warm.warmGray} />
              <Text style={[styles.stateText, { color: warm.warmGray }]}>
                No se encontraron lecturas para este día.
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedDate(todayStr)}
                style={[
                  styles.todayBtn,
                  { backgroundColor: hexAlpha(warm.accent, '15') },
                ]}
              >
                <Text style={[styles.todayBtnText, { color: warm.accent }]}>
                  Volver a hoy
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.mainContent}>
              {/* ── Evangelio Card ── */}
              <Card
                style={[
                  styles.evangelioCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: isDark
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.04)',
                  },
                ]}
              >
                {/* HeroUI Tabs — Lectura / Comentario */}
                {readings.evangelio.comentario ? (
                  <View>
                    <View
                      style={[
                        styles.segmentedContainer,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(0,0,0,0.04)',
                        },
                      ]}
                    >
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setViewMode('lectura')}
                        style={[
                          styles.segmentButton,
                          viewMode === 'lectura' && [
                            styles.segmentActive,
                            {
                              backgroundColor: isDark ? '#2A2A2A' : '#FFFFFF',
                              borderColor: isDark
                                ? 'rgba(255,255,255,0.1)'
                                : 'rgba(0,0,0,0.04)',
                            },
                          ],
                        ]}
                      >
                        <MaterialIcons
                          name="menu-book"
                          size={16}
                          color={
                            viewMode === 'lectura'
                              ? isDark
                                ? '#DAA520'
                                : '#B8860B'
                              : isDark
                                ? '#A09A94'
                                : '#888888'
                          }
                        />
                        <Text
                          style={[
                            styles.segmentText,
                            {
                              color:
                                viewMode === 'lectura'
                                  ? isDark
                                    ? '#DAA520'
                                    : '#B8860B'
                                  : isDark
                                    ? '#A09A94'
                                    : '#888888',
                              fontWeight:
                                viewMode === 'lectura' ? '700' : '500',
                            },
                          ]}
                        >
                          Lectura
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setViewMode('comentario')}
                        style={[
                          styles.segmentButton,
                          viewMode === 'comentario' && [
                            styles.segmentActive,
                            {
                              backgroundColor: isDark ? '#2A2A2A' : '#FFFFFF',
                              borderColor: isDark
                                ? 'rgba(255,255,255,0.1)'
                                : 'rgba(0,0,0,0.04)',
                            },
                          ],
                        ]}
                      >
                        <MaterialIcons
                          name="lightbulb-outline"
                          size={16}
                          color={
                            viewMode === 'comentario'
                              ? isDark
                                ? '#DAA520'
                                : '#B8860B'
                              : isDark
                                ? '#A09A94'
                                : '#888888'
                          }
                        />
                        <Text
                          style={[
                            styles.segmentText,
                            {
                              color:
                                viewMode === 'comentario'
                                  ? isDark
                                    ? '#DAA520'
                                    : '#B8860B'
                                  : isDark
                                    ? '#A09A94'
                                    : '#888888',
                              fontWeight:
                                viewMode === 'comentario' ? '700' : '500',
                            },
                          ]}
                        >
                          Comentario
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.cardContent}>
                      {viewMode === 'lectura' ? (
                        <>
                          <View
                            style={[
                              styles.citaBadge,
                              { backgroundColor: hexAlpha(warm.accent, '12') },
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                color: warm.accent,
                                marginRight: 6,
                                lineHeight: 16,
                              }}
                            >
                              ✦
                            </Text>
                            <Text
                              style={[styles.citaText, { color: warm.accent }]}
                            >
                              {readings.evangelio.cita}
                            </Text>
                          </View>
                          <HighlightableReading
                            text={hl.canonical.evangelio}
                            ranges={hl.ranges.evangelio}
                            penMode={highlightMode}
                            onSelectionChange={hl.onSelectionChange.evangelio}
                            onNativeHighlightRequest={
                              onNativeHighlight.evangelio
                            }
                            color={theme.text}
                            fontSize={18 * fontScale}
                            lineHeight={28 * fontScale}
                            fontFamily={
                              Platform.OS === 'ios' ? 'Palatino' : 'serif'
                            }
                            isDark={isDark}
                          />
                        </>
                      ) : (
                        <>
                          <HighlightableReading
                            text={hl.canonical.comentario}
                            ranges={hl.ranges.comentario}
                            penMode={highlightMode}
                            onSelectionChange={hl.onSelectionChange.comentario}
                            onNativeHighlightRequest={
                              onNativeHighlight.comentario
                            }
                            color={theme.text}
                            fontSize={18 * fontScale}
                            lineHeight={28 * fontScale}
                            isDark={isDark}
                          />

                          {readings.evangelio.comentarista ? (
                            <Text
                              style={[
                                styles.authorText,
                                { color: warm.warmGray },
                              ]}
                            >
                              — {readings.evangelio.comentarista}
                            </Text>
                          ) : null}

                          {readings.evangelio.url ? (
                            <TouchableOpacity
                              onPress={openSource}
                              style={[
                                styles.sourceLink,
                                {
                                  borderTopColor: isDark
                                    ? 'rgba(255,255,255,0.06)'
                                    : 'rgba(0,0,0,0.04)',
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.sourceText,
                                  { color: warm.accent },
                                ]}
                              >
                                Leer original completo
                              </Text>
                              <MaterialIcons
                                name="open-in-new"
                                size={14}
                                color={warm.accent}
                              />
                            </TouchableOpacity>
                          ) : null}
                        </>
                      )}
                    </View>
                  </View>
                ) : (
                  <View style={styles.cardContent}>
                    <View
                      style={[
                        styles.citaBadge,
                        { backgroundColor: hexAlpha(warm.accent, '12') },
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          color: warm.accent,
                          marginRight: 6,
                          lineHeight: 16,
                        }}
                      >
                        ✦
                      </Text>
                      <Text style={[styles.citaText, { color: warm.accent }]}>
                        {readings.evangelio.cita}
                      </Text>
                    </View>
                    <HighlightableReading
                      text={hl.canonical.evangelio}
                      ranges={hl.ranges.evangelio}
                      penMode={highlightMode}
                      onSelectionChange={hl.onSelectionChange.evangelio}
                      onNativeHighlightRequest={onNativeHighlight.evangelio}
                      color={theme.text}
                      fontSize={18 * fontScale}
                      lineHeight={28 * fontScale}
                      fontFamily={Platform.OS === 'ios' ? 'Palatino' : 'serif'}
                      isDark={isDark}
                    />
                  </View>
                )}
              </Card>

              {/* ── Tracker button ── */}
              <View style={styles.trackerContainer}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleToggleDone}
                  style={[
                    styles.trackerBtnWrap,
                    !isDone && {
                      shadowColor: '#1D4ED8',
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: isDark ? 0.45 : 0.35,
                      shadowRadius: 16,
                      elevation: 6,
                    },
                  ]}
                >
                  {isDone ? (
                    <View
                      style={[
                        styles.trackerGradient,
                        {
                          backgroundColor: isDark
                            ? 'rgba(163,189,49,0.12)'
                            : 'rgba(58,125,68,0.08)',
                          borderColor: isDark
                            ? 'rgba(163,189,49,0.28)'
                            : 'rgba(58,125,68,0.22)',
                          borderWidth: 1.5,
                        },
                      ]}
                    >
                      <View style={styles.trackerContent}>
                        <MaterialIcons
                          name="check-circle"
                          size={22}
                          color={isDark ? '#A3BD31' : '#3A7D44'}
                        />
                        <Text
                          style={[
                            styles.trackerText,
                            { color: isDark ? '#A3BD31' : '#3A7D44' },
                          ]}
                        >
                          ¡He rezado hoy con el Evangelio!
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <LinearGradient
                      colors={['#3B82F6', '#1D4ED8']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.trackerGradient}
                    >
                      <View style={styles.trackerContent}>
                        <MaterialIcons
                          name="auto-stories"
                          size={22}
                          color="#FFFFFF"
                        />
                        <Text
                          style={[styles.trackerText, { color: '#FFFFFF' }]}
                        >
                          Marcar como leído
                        </Text>
                      </View>
                    </LinearGradient>
                  )}
                </TouchableOpacity>
                <Text style={[styles.trackerNote, { color: warm.warmGray }]}>
                  Marcando este día sumas a tu constancia en «Contigo».
                </Text>
              </View>

              {/* ── Other Readings ── */}
              {(readings.lectura1 || readings.salmo || readings.lectura2) && (
                <View style={styles.otherReadings}>
                  <View
                    style={[
                      styles.divider,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.05)',
                      },
                    ]}
                  />
                  <Text
                    style={[styles.otherReadingsTitle, { color: theme.text }]}
                  >
                    Todas las lecturas del día
                  </Text>

                  {readings.lectura1 && (
                    <ReadingCard
                      title="Primera Lectura"
                      cita={readings.lectura1.cita}
                      texto={hl.canonical.lectura1}
                      scale={fontScale}
                      highlightable
                      penMode={highlightMode}
                      ranges={hl.ranges.lectura1}
                      onSelectionChange={hl.onSelectionChange.lectura1}
                      onNativeHighlightRequest={onNativeHighlight.lectura1}
                    />
                  )}

                  {readings.salmo && (
                    <ReadingCard
                      title="Salmo"
                      cita={readings.salmo.cita}
                      texto={hl.canonical.salmo}
                      scale={fontScale}
                      highlightable
                      penMode={highlightMode}
                      ranges={hl.ranges.salmo}
                      onSelectionChange={hl.onSelectionChange.salmo}
                      onNativeHighlightRequest={onNativeHighlight.salmo}
                    />
                  )}

                  {readings.lectura2 && (
                    <ReadingCard
                      title="Segunda Lectura"
                      cita={readings.lectura2.cita}
                      texto={hl.canonical.lectura2}
                      scale={fontScale}
                      highlightable
                      penMode={highlightMode}
                      ranges={hl.ranges.lectura2}
                      onSelectionChange={hl.onSelectionChange.lectura2}
                      onNativeHighlightRequest={onNativeHighlight.lectura2}
                    />
                  )}
                </View>
              )}

              <TouchableOpacity
                onPress={() => setCreditsVisible(true)}
                style={{
                  alignItems: 'center',
                  paddingVertical: 24,
                  marginTop: 10,
                  paddingBottom: 40,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: warm.warmGray,
                    textDecorationLine: 'underline',
                  }}
                >
                  ¿De dónde sacamos los textos?
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/* Celebration burst animation */}
      <CelebrationAnimation visible={showCheck} isDark={isDark} />

      <ReaderSettingsSheet
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        sectionKey="contigo"
        previewText={
          readings?.evangelio?.texto
            ? segmentReading(readings.evangelio.texto)[0]
            : undefined
        }
      />

      {/* Barra flotante del modo subrayar (colores pastel + goma) */}
      <HighlightActionBar
        visible={highlightMode}
        hasSelection={hl.hasSelection}
        selection={hl.selection}
        onPickColor={hl.applyColor}
        onErase={hl.erase}
        onDone={exitHighlightMode}
        isDark={isDark}
      />

      {/* Calendario de evangelios */}
      <ReadingCalendarSheet
        visible={calendarVisible}
        onClose={() => setCalendarVisible(false)}
        selectedDate={selectedDate}
        todayStr={todayStr}
        onSelectDate={(d) => {
          exitHighlightMode();
          setSelectedDate(d);
        }}
        availableDates={availableDates}
        bookmarks={bookmarks}
      />

      {/* Fuentes de los textos */}
      <CreditsSheet
        visible={creditsVisible}
        onClose={() => setCreditsVisible(false)}
      />
    </View>
  );
}
