import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { Card, Tabs, Chip, PressableFeedback } from 'heroui-native';
import { BlurView } from 'expo-blur';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useContigoHabits } from '@/hooks/useContigoHabits';
import { useDailyReadings } from '@/hooks/useDailyReadings';
import { LiturgicalBadge, getLiturgicalInfo } from '@/components/contigo/LiturgicalBadge';
import { ReadingCard } from '@/components/contigo/ReadingCard';
import ConfettiCannon from 'react-native-confetti-cannon';
import { radii, shadows } from '@/constants/uiStyles';
import { hexAlpha } from '@/utils/colorUtils';
import spacing from '@/constants/spacing';

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
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function formatDateDisplay(dateStr: string) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return `${days[date.getDay()]}, ${date.getDate()} de ${MONTHS[date.getMonth()]}`;
}

export default function EvangelioScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  const warm = isDark ? WARM.dark : WARM.light;
  const router = useRouter();

  const { todayStr, getRecord, setReadingDone } = useContigoHabits();

  const [selectedDate, setSelectedDate] = useState(
    todayStr || new Date().toISOString().split('T')[0]
  );
  const { readings, isLoading, error } = useDailyReadings(selectedDate);
  const [viewMode, setViewMode] = useState<'lectura' | 'comentario'>('lectura');
  const [showConfetti, setShowConfetti] = useState(false);

  const record = getRecord(selectedDate);
  const isDone = record?.readingDone || false;

  const liturgicalInfo = getLiturgicalInfo(selectedDate);
  const isToday = selectedDate === todayStr;

  const goBack = () => router.back();

  const changeDate = (days: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleToggleDone = async () => {
    const newValue = !isDone;
    await setReadingDone(selectedDate, newValue);
    if (newValue) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3500);
    }
  };

  const openSource = () => {
    if (readings?.evangelio?.url) {
      Linking.openURL(readings.evangelio.url).catch((err) =>
        console.error("Couldn't open URL", err)
      );
    }
  };

  // Liturgical color used as subtle accent, NOT as full background
  const liturgicalAccent = liturgicalInfo.hex === '#F5F5F5'
    ? (isDark ? '#888888' : '#999999')
    : liturgicalInfo.hex;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? warm.surface : warm.surface }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* ── Header — Clean, minimal ── */}
        <View
          style={[
            styles.header,
            {
              backgroundColor: isDark
                ? 'rgba(28,26,23,0.95)'
                : 'rgba(254,251,245,0.95)',
              borderBottomColor: isDark
                ? 'rgba(255,255,255,0.06)'
                : 'rgba(0,0,0,0.06)',
            },
          ]}
        >
          <TouchableOpacity onPress={goBack} style={styles.backButton}>
            <MaterialIcons
              name="arrow-back"
              size={24}
              color={theme.text}
            />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text
              style={[styles.headerTitle, { color: theme.text }]}
              numberOfLines={1}
            >
              {isToday ? 'Evangelio de Hoy' : 'Evangelio del Día'}
            </Text>
          </View>

          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Date Navigator ── */}
          <View
            style={[
              styles.dateNav,
              {
                backgroundColor: isDark
                  ? hexAlpha(liturgicalAccent, '10')
                  : hexAlpha(liturgicalAccent, '08'),
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => changeDate(-1)}
              style={[
                styles.dateNavBtn,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.04)',
                },
              ]}
            >
              <MaterialIcons
                name="chevron-left"
                size={26}
                color={theme.text}
              />
            </TouchableOpacity>

            <View style={styles.dateDisplay}>
              <Text style={[styles.dateText, { color: theme.text }]}>
                {formatDateDisplay(selectedDate)}
              </Text>
              <View style={styles.badgeRow}>
                <LiturgicalBadge dateStr={selectedDate} />
              </View>
              {readings?.info?.titulo && (
                <Text
                  style={[
                    styles.tituloLiturgico,
                    { color: isDark ? warm.warmGray : '#8B7E6E' },
                  ]}
                  numberOfLines={2}
                >
                  {readings.info.titulo}
                </Text>
              )}
            </View>

            <TouchableOpacity
              onPress={() => changeDate(1)}
              style={[
                styles.dateNavBtn,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.04)',
                },
              ]}
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
              <MaterialIcons
                name="cloud-off"
                size={48}
                color={warm.warmGray}
              />
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
              {/* ── Evangelio Card with HeroUI Tabs ── */}
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
                {/* HeroUI Tabs for Lectura / Comentario */}
                {readings.evangelio.comentario ? (
                  <Tabs
                    value={viewMode}
                    onValueChange={(val) =>
                      setViewMode(val as 'lectura' | 'comentario')
                    }
                    variant="primary"
                  >
                    <Tabs.List className="mx-2 mt-2">
                      <Tabs.Indicator />
                      <Tabs.Trigger value="lectura">
                        <Tabs.Label>📖 Lectura</Tabs.Label>
                      </Tabs.Trigger>
                      <Tabs.Trigger value="comentario">
                        <Tabs.Label>💡 Comentario</Tabs.Label>
                      </Tabs.Trigger>
                    </Tabs.List>

                    <Tabs.Content value="lectura">
                      <View style={styles.cardContent}>
                        {/* Bible reference badge */}
                        <View
                          style={[
                            styles.citaBadge,
                            {
                              backgroundColor: hexAlpha(warm.accent, '12'),
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.citaText,
                              { color: warm.accent },
                            ]}
                          >
                            {readings.evangelio.cita}
                          </Text>
                        </View>
                        <Text
                          style={[styles.bodyText, { color: theme.text }]}
                          selectable
                        >
                          {readings.evangelio.texto}
                        </Text>
                      </View>
                    </Tabs.Content>

                    <Tabs.Content value="comentario">
                      <View style={styles.cardContent}>
                        <Text
                          style={[styles.bodyText, { color: theme.text }]}
                          selectable
                        >
                          {readings.evangelio.comentario}
                        </Text>

                        {readings.evangelio.comentarista && (
                          <Text
                            style={[
                              styles.authorText,
                              { color: warm.warmGray },
                            ]}
                          >
                            — {readings.evangelio.comentarista}
                          </Text>
                        )}

                        {readings.evangelio.url && (
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
                        )}
                      </View>
                    </Tabs.Content>
                  </Tabs>
                ) : (
                  /* No comment available — just show reading */
                  <View style={styles.cardContent}>
                    <View
                      style={[
                        styles.citaBadge,
                        { backgroundColor: hexAlpha(warm.accent, '12') },
                      ]}
                    >
                      <Text
                        style={[styles.citaText, { color: warm.accent }]}
                      >
                        {readings.evangelio.cita}
                      </Text>
                    </View>
                    <Text
                      style={[styles.bodyText, { color: theme.text }]}
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
                        isDone
                          ? isDark
                            ? '#A3BD31'
                            : '#3A7D44'
                          : '#FFFFFF'
                      }
                    />
                    <Text
                      style={[
                        styles.trackerText,
                        isDone
                          ? {
                              color: isDark ? '#A3BD31' : '#3A7D44',
                            }
                          : { color: '#FFFFFF' },
                      ]}
                    >
                      {isDone
                        ? '¡He rezado hoy con el Evangelio!'
                        : 'Completar momento de oración'}
                    </Text>
                  </View>
                </TouchableOpacity>
                <Text
                  style={[styles.trackerNote, { color: warm.warmGray }]}
                >
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
                    style={[
                      styles.otherReadingsTitle,
                      { color: theme.text },
                    ]}
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
            </View>
          )}
        </ScrollView>

        {showConfetti && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <ConfettiCannon
              count={100}
              origin={{ x: -10, y: 0 }}
              fallSpeed={2500}
              fadeOut
            />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    width: 44,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  // Date navigator
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 20,
    marginBottom: 8,
  },
  dateNavBtn: {
    padding: 8,
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
  tituloLiturgico: {
    fontSize: 13,
    marginTop: 8,
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
});
