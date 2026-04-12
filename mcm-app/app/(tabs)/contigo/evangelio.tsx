import React, { useState, useRef, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, Stack } from 'expo-router';
import { Card, Tabs, PressableFeedback, CloseButton } from 'heroui-native';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import useFontScale from '@/hooks/useFontScale';
import { useContigoHabits } from '@/hooks/useContigoHabits';
import { useDailyReadings } from '@/hooks/useDailyReadings';
import {
  LiturgicalBadge,
  getLiturgicalInfo,
} from '@/components/contigo/LiturgicalBadge';
import { ReadingCard } from '@/components/contigo/ReadingCard';
import SettingsPanel from '@/components/SettingsPanel';
import BottomSheet from '@/components/BottomSheet';
import { radii, shadows } from '@/constants/uiStyles';
import { hexAlpha } from '@/utils/colorUtils';

// ── Contigo warm palette ──
const WARM = {
  light: {
    accent: '#B8860B',
    accentSoft: '#FFF8E7',
    surface: '#FEFBF5',
    warmGray: '#6B6560',
  },
  dark: {
    accent: '#DAA520',
    accentSoft: '#2A2112',
    surface: '#1C1A17',
    warmGray: '#A09A94',
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

import { CelebrationAnimation } from '@/components/contigo/CelebrationAnimation';

export default function EvangelioScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  const warm = isDark ? WARM.dark : WARM.light;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fontScale = useFontScale();

  const { todayStr, getRecord, setReadingDone } = useContigoHabits();

  const [selectedDate, setSelectedDate] = useState(
    todayStr || new Date().toISOString().split('T')[0],
  );
  const { readings, isLoading, error } = useDailyReadings(selectedDate);
  const [viewMode, setViewMode] = useState<'lectura' | 'comentario'>('lectura');
  const [showCheck, setShowCheck] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [creditsVisible, setCreditsVisible] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('@contigo_bookmarks').then((str) => {
      if (str) {
        const bookmarks: any[] = JSON.parse(str);
        if (bookmarks.length > 0 && typeof bookmarks[0] === 'string') {
          setIsBookmarked(bookmarks.includes(selectedDate));
        } else {
          setIsBookmarked(bookmarks.some((b) => b.date === selectedDate));
        }
      }
    });
  }, [selectedDate]);

  const toggleBookmark = async () => {
    if (Platform.OS !== 'web')
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const str = await AsyncStorage.getItem('@contigo_bookmarks');
      let bookmarks: any[] = str ? JSON.parse(str) : [];
      if (isBookmarked) {
        if (bookmarks.length > 0 && typeof bookmarks[0] === 'string') {
          bookmarks = bookmarks.filter((d) => d !== selectedDate);
        } else {
          bookmarks = bookmarks.filter((b) => b.date !== selectedDate);
        }
      } else {
        // Handle migration if mixing arrays, filter strings out
        bookmarks = bookmarks.filter((b) => typeof b !== 'string');
        bookmarks.push({
          date: selectedDate,
          readings: readings,
          bookmarkedAt: Date.now(),
        });
      }
      await AsyncStorage.setItem(
        '@contigo_bookmarks',
        JSON.stringify(bookmarks),
      );
      setIsBookmarked(!isBookmarked);
    } catch (e) {
      console.error('Failed to save bookmark', e);
    }
  };

  const record = getRecord(selectedDate);
  const isDone = record?.readingDone || false;

  const liturgicalInfo = getLiturgicalInfo(selectedDate);
  const isToday = selectedDate === todayStr;

  const goBack = () => router.back();

  const changeDate = (offset: number) => {
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
        console.error("Couldn't open URL", err),
      );
    }
  };

  // Liturgical color for subtle tinting
  const liturgicalAccent =
    liturgicalInfo.hex === '#F5F5F5'
      ? isDark
        ? '#888888'
        : '#999999'
      : liturgicalInfo.hex;

  return (
    <View style={[styles.container, { backgroundColor: warm.surface }]}>
      {/* Remove standard header in favor of Liquid Glass floating header */}
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* ── Custom Floating Liquid Glass Header ── */}
      <View
        style={[
          styles.floatingHeader,
          {
            paddingTop: Math.max(insets.top, 16),
            backgroundColor: isDark
              ? 'rgba(28, 26, 23, 0.85)'
              : 'rgba(254, 251, 245, 0.85)',
          },
        ]}
      >
        <TouchableOpacity
          onPress={goBack}
          style={[
            styles.frostedBtn,
            {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.05)',
            },
          ]}
        >
          <MaterialIcons
            name="arrow-back-ios-new"
            size={20}
            color={theme.text}
          />
        </TouchableOpacity>

        <View style={styles.floatingActions}>
          <TouchableOpacity
            onPress={toggleBookmark}
            style={[
              styles.frostedBtn,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(0,0,0,0.05)',
              },
            ]}
          >
            <MaterialIcons
              name={isBookmarked ? 'bookmark' : 'bookmark-border'}
              size={24}
              color={isBookmarked ? warm.accent : theme.text}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSettingsVisible(true)}
            style={[
              styles.frostedBtn,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.08)'
                  : 'rgba(0,0,0,0.05)',
              },
            ]}
          >
            <MaterialIcons name="text-fields" size={22} color={theme.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 80 },
        ]}
        showsVerticalScrollIndicator={false}
      >
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
            <MaterialIcons name="chevron-right" size={26} color={theme.text} />
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
                            fontWeight: viewMode === 'lectura' ? '700' : '500',
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
                          <MaterialIcons
                            name="format-quote"
                            size={14}
                            color={warm.accent}
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            style={[styles.citaText, { color: warm.accent }]}
                          >
                            {readings.evangelio.cita}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.bodyText,
                            {
                              color: theme.text,
                              fontSize: 18 * fontScale,
                              lineHeight: 28 * fontScale,
                              fontFamily:
                                Platform.OS === 'ios' ? 'Palatino' : 'serif',
                            },
                          ]}
                          selectable
                        >
                          {readings.evangelio.texto}
                        </Text>
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
                    <MaterialIcons
                      name="format-quote"
                      size={14}
                      color={warm.accent}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.citaText, { color: warm.accent }]}>
                      {readings.evangelio.cita}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.bodyText,
                      {
                        color: theme.text,
                        fontSize: 18 * fontScale,
                        lineHeight: 28 * fontScale,
                        fontFamily:
                          Platform.OS === 'ios' ? 'Palatino' : 'serif',
                      },
                    ]}
                    selectable
                  >
                    {readings.evangelio.texto}
                  </Text>
                </View>
              )}
            </Card>

            {/* ── Tracker button ── */}
            <View style={styles.trackerContainer}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleToggleDone}
                style={[
                  styles.trackerBtn,
                  isDone
                    ? {
                        backgroundColor: isDark
                          ? 'rgba(163,189,49,0.12)'
                          : 'rgba(58,125,68,0.08)',
                        borderColor: isDark
                          ? 'rgba(163,189,49,0.25)'
                          : 'rgba(58,125,68,0.18)',
                        borderWidth: 1,
                      }
                    : {
                        backgroundColor: warm.accent,
                      },
                ]}
              >
                <View style={styles.trackerContent}>
                  <MaterialIcons
                    name={isDone ? 'check-circle' : 'favorite'}
                    size={22}
                    color={
                      isDone ? (isDark ? '#A3BD31' : '#3A7D44') : '#FFFFFF'
                    }
                  />
                  <Text
                    style={[
                      styles.trackerText,
                      isDone
                        ? { color: isDark ? '#A3BD31' : '#3A7D44' }
                        : { color: '#FFFFFF' },
                    ]}
                  >
                    {isDone
                      ? '¡He rezado hoy con el Evangelio!'
                      : 'Completar momento de oración'}
                  </Text>
                </View>
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
                  />
                )}

                {readings.salmo && (
                  <ReadingCard
                    title="Salmo"
                    cita={readings.salmo.cita}
                    texto={readings.salmo.texto}
                  />
                )}

                {readings.lectura2 && (
                  <ReadingCard
                    title="Segunda Lectura"
                    cita={readings.lectura2.cita}
                    texto={readings.lectura2.texto}
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
      </ScrollView>

      {/* Celebration burst animation */}
      <CelebrationAnimation visible={showCheck} isDark={isDark} />

      <SettingsPanel
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />

      {/* Credits Sheet */}
      <BottomSheet
        visible={creditsVisible}
        onClose={() => setCreditsVisible(false)}
      >
        <View style={{ paddingHorizontal: 24, paddingBottom: 40 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
            }}
          >
            <Text
              style={{
                fontSize: 22,
                fontWeight: '800',
                color: theme.text,
                letterSpacing: -0.3,
              }}
            >
              Fuentes de los textos
            </Text>
            <CloseButton onPress={() => setCreditsVisible(false)} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 20, paddingBottom: 20 }}
          >
            <Text style={{ fontSize: 15, lineHeight: 22, color: theme.text }}>
              Los textos bíblicos y los comentarios que te mostramos en la
              aplicación están extraídos de webs que los comparten de forma
              gratuita en abierto. Junto a los comentarios se indica su autor de
              la misma forma que se muestra en la web original.
            </Text>

            <View
              style={{
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(0,0,0,0.04)',
                padding: 16,
                borderRadius: radii.lg,
                gap: 4,
              }}
            >
              <Text
                style={{ fontSize: 14, fontWeight: '700', color: theme.text }}
              >
                Vatican News
              </Text>
              <Text style={{ fontSize: 13, color: theme.icon }}>
                © 2017-{new Date().getFullYear()} Dicasterium pro Communicatione
              </Text>
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL(
                    'https://www.vaticannews.va/es/evangelio-de-hoy',
                  )
                }
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: warm.accent,
                    textDecorationLine: 'underline',
                    marginTop: 4,
                  }}
                >
                  vaticannews.va/es/evangelio-de-hoy
                </Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 13, color: theme.icon, marginTop: 4 }}>
                webmaster@vaticannews.va
              </Text>
            </View>

            <View
              style={{
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(0,0,0,0.04)',
                padding: 16,
                borderRadius: radii.lg,
                gap: 4,
              }}
            >
              <Text
                style={{ fontSize: 14, fontWeight: '700', color: theme.text }}
              >
                Vida Nueva
              </Text>
              <Text style={{ fontSize: 13, color: theme.icon }}>
                © {new Date().getFullYear()} Copyright Vida Nueva
              </Text>
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL(
                    'https://www.vidanuevadigital.com/evangeliodeldia/',
                  )
                }
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: warm.accent,
                    textDecorationLine: 'underline',
                    marginTop: 4,
                  }}
                >
                  vidanuevadigital.com/evangeliodeldia
                </Text>
              </TouchableOpacity>
            </View>

            <View
              style={{
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(0,0,0,0.04)',
                padding: 16,
                borderRadius: radii.lg,
                gap: 4,
              }}
            >
              <Text
                style={{ fontSize: 14, fontWeight: '700', color: theme.text }}
              >
                Dominicos · Orden de Predicadores
              </Text>
              <Text style={{ fontSize: 13, color: theme.icon, lineHeight: 18 }}>
                Textos bíblicos de la Versión oficial de la Conferencia
                Episcopal Española. Editorial BAC
              </Text>
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL(
                    'https://www.dominicos.org/predicacion/evangelio-del-dia/hoy/',
                  )
                }
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: warm.accent,
                    textDecorationLine: 'underline',
                    marginTop: 4,
                  }}
                >
                  dominicos.org/predicacion/evangelio-del-dia/hoy
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  trackerBtn: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
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
