import { logger } from '@/utils/logger';
import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
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
import { useColorScheme } from '@/hooks/useColorScheme';
import useSectionFontScale from '@/hooks/useSectionFontScale';
import { useContigoHabits } from '@/hooks/useContigoHabits';
import { useDailyReadings } from '@/hooks/useDailyReadings';
import {
  LiturgicalBadge,
  getLiturgicalInfo,
} from '@/components/contigo/LiturgicalBadge';
import { ReadingCard } from '@/components/contigo/ReadingCard';
import {
  HighlightableReading,
  type ReadingSelection,
} from '@/components/contigo/HighlightableReading';
import { HighlightActionBar } from '@/components/contigo/HighlightActionBar';
import { ReadingCalendarSheet } from '@/components/contigo/ReadingCalendarSheet';
import { CreditsSheet } from '@/components/contigo/CreditsSheet';
import ReaderSettingsSheet from '@/components/contigo/ReaderSettingsSheet';
import { radii, shadows } from '@/constants/uiStyles';
import { hexAlpha } from '@/utils/colorUtils';
import { useReaderBookmarks } from '@/hooks/useReaderBookmarks';
import { useAvailableReadingDates } from '@/hooks/useAvailableReadingDates';
import { segmentReading, normalizeReadingText } from '@/utils/readingSegments';
import {
  addHighlight,
  normalizeHighlights,
  removeHighlight,
  type HighlightColorKey,
} from '@/utils/highlightRanges';
import type { HighlightSource } from '@/utils/contigoBookmarks';

import { CelebrationAnimation } from '@/components/contigo/CelebrationAnimation';

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

  // Texto canónico (los rangos de subrayado son offsets sobre esta forma).
  const evangelioCanonical = useMemo(
    () =>
      readings?.evangelio?.texto
        ? normalizeReadingText(readings.evangelio.texto)
        : '',
    [readings?.evangelio?.texto],
  );
  const salmoCanonical = useMemo(
    () =>
      readings?.salmo?.texto ? normalizeReadingText(readings.salmo.texto) : '',
    [readings?.salmo?.texto],
  );
  const evangelioRanges = useMemo(
    () =>
      normalizeHighlights(evangelioCanonical, bookmark?.highlights?.evangelio),
    [evangelioCanonical, bookmark?.highlights?.evangelio],
  );
  const salmoRanges = useMemo(
    () => normalizeHighlights(salmoCanonical, bookmark?.highlights?.salmo),
    [salmoCanonical, bookmark?.highlights?.salmo],
  );

  // Selección nativa activa dentro del modo subrayar (evangelio o salmo).
  const [activeSel, setActiveSel] = useState<{
    source: HighlightSource;
    sel: ReadingSelection;
  } | null>(null);

  // "Pegajosa": nos quedamos con la ÚLTIMA selección no vacía. Al tocar un
  // chip de color, iOS puede colapsar la selección nativa antes de que llegue
  // el onPress — si la vaciáramos aquí, el color no tendría a qué aplicarse.
  const handleSelection =
    (source: HighlightSource) => (sel: ReadingSelection | null) => {
      if (sel) setActiveSel({ source, sel });
    };

  const sourceData = (source: HighlightSource) =>
    source === 'evangelio'
      ? { text: evangelioCanonical, ranges: evangelioRanges }
      : { text: salmoCanonical, ranges: salmoRanges };

  const applyHighlightColor = (color: HighlightColorKey) => {
    if (!activeSel) return;
    const { text, ranges } = sourceData(activeSel.source);
    const next = addHighlight(
      text,
      ranges,
      activeSel.sel.start,
      activeSel.sel.end,
      color,
    );
    setHighlights(selectedDate, activeSel.source, next, readings);
    // Salimos del modo subrayar: el texto vuelve a pintarse con los colores
    // pastel y el subrayado recién hecho se ve al instante.
    exitHighlightMode();
  };

  const eraseHighlightSelection = () => {
    if (!activeSel) return;
    const { text, ranges } = sourceData(activeSel.source);
    const next = removeHighlight(
      text,
      ranges,
      activeSel.sel.start,
      activeSel.sel.end,
    );
    setHighlights(selectedDate, activeSel.source, next, readings);
    exitHighlightMode();
  };

  const exitHighlightMode = () => {
    setHighlightMode(false);
    setActiveSel(null);
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

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + (Platform.OS === 'android' ? 68 : 56),
          },
          // Hueco para la barra flotante de subrayado
          highlightMode && { paddingBottom: 170 },
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
                            text={evangelioCanonical}
                            ranges={evangelioRanges}
                            penMode={highlightMode}
                            onSelectionChange={handleSelection('evangelio')}
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
                          <Text
                            style={[
                              styles.bodyText,
                              {
                                color: theme.text,
                                fontSize: 18 * fontScale,
                                lineHeight: 28 * fontScale,
                              },
                            ]}
                            selectable
                          >
                            {readings.evangelio.comentario}
                          </Text>

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
                      text={evangelioCanonical}
                      ranges={evangelioRanges}
                      penMode={highlightMode}
                      onSelectionChange={handleSelection('evangelio')}
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
                    Otras lecturas de la misa
                  </Text>

                  {readings.lectura1 && (
                    <ReadingCard
                      title="Primera Lectura"
                      cita={readings.lectura1.cita}
                      texto={readings.lectura1.texto}
                      scale={fontScale}
                    />
                  )}

                  {readings.salmo && (
                    <ReadingCard
                      title="Salmo"
                      cita={readings.salmo.cita}
                      texto={salmoCanonical}
                      scale={fontScale}
                      highlightable
                      penMode={highlightMode}
                      ranges={salmoRanges}
                      onSelectionChange={handleSelection('salmo')}
                    />
                  )}

                  {readings.lectura2 && (
                    <ReadingCard
                      title="Segunda Lectura"
                      cita={readings.lectura2.cita}
                      texto={readings.lectura2.texto}
                      scale={fontScale}
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
      </ScrollView>

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
        hasSelection={!!activeSel}
        onPickColor={applyHighlightColor}
        onErase={eraseHighlightSelection}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Acciones del header NATIVO (guardar / ajustes). Minimal —solo padding— para
  // que iOS 26 las envuelva en su cápsula liquid-glass.
  nativeHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  nativeHeaderBtn: {
    padding: 6,
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 50,
  },
  floatingActions: {
    flexDirection: 'row',
    gap: 12,
  },
  frostedBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 80,
  },
  // Custom Segmented Control
  segmentedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 4,
    borderRadius: 14,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentActive: {
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 15,
  },
  // Date navigator
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  dateNavBtn: {
    padding: 10,
    borderRadius: 14,
  },
  dateDisplay: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  dateText: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    textTransform: 'capitalize',
    textAlign: 'center',
  },
  badgeRow: {
    marginTop: 8,
  },
  diaLiturgico: {
    fontSize: 12,
    marginTop: 6,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tituloLiturgico: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // States
  stateContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  stateText: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 22,
  },
  todayBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 100,
  },
  todayBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  // Main content
  mainContent: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  evangelioCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
    ...shadows.sm,
  },
  cardContent: {
    padding: 20,
  },
  citaBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
    marginBottom: 20,
  },
  citaText: {
    fontSize: 14,
    fontWeight: '700',
  },
  bodyText: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '400',
  },
  authorText: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 24,
    textAlign: 'right',
    fontStyle: 'italic',
  },
  sourceLink: {
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sourceText: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
  },
  // Tracker
  trackerContainer: {
    marginBottom: 28,
    alignItems: 'center',
  },
  trackerBtnWrap: {
    width: '100%',
    borderRadius: 16,
    minHeight: 54,
  },
  trackerGradient: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'center',
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 8,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  trackerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackerText: {
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 10,
  },
  trackerNote: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 20,
    lineHeight: 17,
  },
  // Other readings
  divider: {
    height: 1,
    marginBottom: 20,
    marginHorizontal: 8,
  },
  otherReadings: {
    marginBottom: 16,
  },
  otherReadingsTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 16,
    textAlign: 'center',
  },
  // Checkmark overlay
  checkOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  checkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
