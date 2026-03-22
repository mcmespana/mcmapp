// app/screens/EvangelioScreen.tsx — Daily readings + commentary + reading tracker
import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import { radii, shadows } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import useDailyReadings from '@/hooks/useDailyReadings';
import useContigoHabits from '@/hooks/useContigoHabits';
import DateNavigator from '@/components/contigo/DateNavigator';
import ReadingCard from '@/components/contigo/ReadingCard';
import { useLiturgicalInfo } from '@/hooks/useLiturgicalCalendar';

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

type ViewMode = 'lectura' | 'comentario';

export default function EvangelioScreen() {
  const scheme = useColorScheme();
  const theme = Colors[scheme ?? 'light'];
  const todayStr = getTodayStr();

  // Date navigation (±30 days from today)
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const minDate = addDays(todayStr, -30);
  const maxDate = addDays(todayStr, 30);

  const goToPrev = useCallback(() => {
    setSelectedDate((d) => {
      const prev = addDays(d, -1);
      return prev >= minDate ? prev : d;
    });
  }, [minDate]);

  const goToNext = useCallback(() => {
    setSelectedDate((d) => {
      const next = addDays(d, 1);
      return next <= maxDate ? next : d;
    });
  }, [maxDate]);

  // Data
  const { readings, loading, error, hasEvangelio, hasAnyContent } =
    useDailyReadings(selectedDate);
  const habits = useContigoHabits();
  const dayRecord = habits.getRecord(selectedDate);
  const liturgical = useLiturgicalInfo(selectedDate);

  // View mode toggle: Lectura / Comentario
  const [viewMode, setViewMode] = useState<ViewMode>('lectura');

  // Check animation for reading tracker
  const checkScale = useRef(new Animated.Value(1)).current;

  const toggleReadingDone = useCallback(() => {
    const newVal = !(dayRecord?.readingDone ?? false);
    habits.setReadingDone(selectedDate, newVal);
    if (newVal && Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    // Bounce animation
    Animated.sequence([
      Animated.timing(checkScale, {
        toValue: 1.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.spring(checkScale, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();
  }, [dayRecord, selectedDate, habits, checkScale]);

  const isReadDone = dayRecord?.readingDone ?? false;

  // Info from Firebase
  const infoTitle = readings?.info?.titulo ?? '';
  const infoDiaLiturgico = readings?.info?.diaLiturgico ?? '';

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Evangelio del Día',
          headerBackTitle: 'Contigo',
        }}
      />
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.background }]}
        edges={['bottom']}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Date Navigator ── */}
          <DateNavigator
            dateStr={selectedDate}
            onPrev={goToPrev}
            onNext={goToNext}
            canGoPrev={selectedDate > minDate}
            canGoNext={selectedDate < maxDate}
          />

          {/* ── Day info ── */}
          {(infoDiaLiturgico || infoTitle) && (
            <View style={styles.dayInfo}>
              {infoDiaLiturgico ? (
                <Text
                  style={[styles.dayInfoText, { color: theme.icon }]}
                  numberOfLines={2}
                >
                  {infoDiaLiturgico}
                </Text>
              ) : null}
              {infoTitle ? (
                <Text
                  style={[styles.dayTitle, { color: liturgical.color }]}
                  numberOfLines={2}
                >
                  {infoTitle}
                </Text>
              ) : null}
            </View>
          )}

          {/* ── Loading / Error / Empty ── */}
          {loading && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={liturgical.color} />
              <Text style={[styles.loadingText, { color: theme.icon }]}>
                Cargando lecturas...
              </Text>
            </View>
          )}

          {!loading && error && (
            <View style={styles.center}>
              <MaterialIcons
                name="cloud-off"
                size={40}
                color={theme.icon}
                style={{ opacity: 0.4 }}
              />
              <Text style={[styles.emptyText, { color: theme.icon }]}>
                No se pudieron cargar las lecturas
              </Text>
              <Text style={[styles.emptyHint, { color: theme.icon }]}>
                Comprueba tu conexión e inténtalo de nuevo
              </Text>
            </View>
          )}

          {!loading && !error && !hasAnyContent && (
            <View style={styles.center}>
              <MaterialIcons
                name="event-busy"
                size={40}
                color={theme.icon}
                style={{ opacity: 0.4 }}
              />
              <Text style={[styles.emptyText, { color: theme.icon }]}>
                Lecturas no disponibles para este día
              </Text>
              <Text style={[styles.emptyHint, { color: theme.icon }]}>
                Las lecturas solo están disponibles para un rango de ±30 días
                desde hoy
              </Text>
            </View>
          )}

          {/* ── Gospel Section ── */}
          {!loading && hasEvangelio && (
            <>
              {/* Toggle: Lectura / Comentario */}
              <View
                style={[
                  styles.modeToggle,
                  {
                    backgroundColor:
                      scheme === 'dark'
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(0,0,0,0.04)',
                  },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.modeBtn,
                    viewMode === 'lectura' && {
                      backgroundColor: liturgical.color,
                    },
                  ]}
                  onPress={() => setViewMode('lectura')}
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      {
                        color: viewMode === 'lectura' ? '#fff' : theme.icon,
                      },
                    ]}
                  >
                    Lectura
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modeBtn,
                    viewMode === 'comentario' && {
                      backgroundColor: liturgical.color,
                    },
                  ]}
                  onPress={() => setViewMode('comentario')}
                  disabled={!readings?.evangelio?.comentario}
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      {
                        color:
                          viewMode === 'comentario'
                            ? '#fff'
                            : !readings?.evangelio?.comentario
                              ? theme.icon + '40'
                              : theme.icon,
                      },
                    ]}
                  >
                    Comentario
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Gospel content */}
              <View
                style={[
                  styles.gospelCard,
                  {
                    backgroundColor: theme.card,
                    borderColor:
                      scheme === 'dark'
                        ? 'rgba(255,255,255,0.09)'
                        : 'rgba(0,0,0,0.07)',
                  },
                ]}
              >
                <View style={styles.gospelHeader}>
                  <Text
                    style={[styles.gospelLabel, { color: liturgical.color }]}
                  >
                    EVANGELIO
                  </Text>
                  <Text style={[styles.gospelCita, { color: theme.icon }]}>
                    {readings?.evangelio?.cita ?? ''}
                  </Text>
                </View>

                {viewMode === 'lectura' ? (
                  <Text
                    style={[styles.gospelText, { color: theme.text }]}
                    selectable
                  >
                    {(readings?.evangelio?.texto ?? '')
                      .replace(/\\n/g, '\n')
                      .replace(/\n{3,}/g, '\n\n')
                      .trim()}
                  </Text>
                ) : (
                  <View style={styles.commentarySection}>
                    <Text
                      style={[styles.gospelText, { color: theme.text }]}
                      selectable
                    >
                      {(readings?.evangelio?.comentario ?? '')
                        .replace(/\\n/g, '\n')
                        .replace(/\n{3,}/g, '\n\n')
                        .trim()}
                    </Text>
                    {readings?.evangelio?.comentarista && (
                      <Text
                        style={[styles.commentSource, { color: theme.icon }]}
                      >
                        Comentario de {readings.evangelio.comentarista}
                      </Text>
                    )}
                    {readings?.evangelio?.url && (
                      <TouchableOpacity
                        onPress={() =>
                          Linking.openURL(readings.evangelio!.url!)
                        }
                        style={styles.sourceLink}
                      >
                        <MaterialIcons
                          name="open-in-new"
                          size={13}
                          color={liturgical.color}
                        />
                        <Text
                          style={[
                            styles.sourceLinkText,
                            { color: liturgical.color },
                          ]}
                        >
                          Ver fuente original
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </>
          )}

          {/* ── Other Readings (accordion) ── */}
          {!loading && hasAnyContent && (
            <View style={styles.otherReadings}>
              {readings?.lectura1 && (
                <ReadingCard
                  title="Primera Lectura"
                  cita={readings.lectura1.cita}
                  texto={readings.lectura1.texto}
                  accentColor={liturgical.color}
                />
              )}
              {readings?.info?.salmo ? (
                <ReadingCard
                  title="Salmo"
                  cita={readings.info.salmo}
                  texto=""
                  accentColor={liturgical.color}
                />
              ) : null}
              {readings?.lectura2 && (
                <ReadingCard
                  title="Segunda Lectura"
                  cita={readings.lectura2.cita}
                  texto={readings.lectura2.texto}
                  accentColor={liturgical.color}
                />
              )}
            </View>
          )}

          {/* ── Reading Tracker Toggle ── */}
          {!loading && hasAnyContent && (
            <TouchableOpacity
              style={[
                styles.trackerBtn,
                {
                  backgroundColor: isReadDone
                    ? '#4CAF50' + '15'
                    : scheme === 'dark'
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(0,0,0,0.04)',
                  borderColor: isReadDone ? '#4CAF50' : theme.icon + '30',
                },
              ]}
              onPress={toggleReadingDone}
              activeOpacity={0.7}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isReadDone }}
              accessibilityLabel={
                isReadDone ? 'Marcar como no leído' : 'Marcar como leído'
              }
            >
              <Animated.View style={{ transform: [{ scale: checkScale }] }}>
                <MaterialIcons
                  name={isReadDone ? 'check-circle' : 'radio-button-unchecked'}
                  size={28}
                  color={isReadDone ? '#4CAF50' : theme.icon}
                />
              </Animated.View>
              <Text
                style={[
                  styles.trackerText,
                  {
                    color: isReadDone ? '#4CAF50' : theme.text,
                    fontWeight: isReadDone ? '800' : '600',
                  },
                ]}
              >
                {isReadDone ? '¡Leído!' : 'Marcar como leído'}
              </Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  dayInfo: {
    alignItems: 'center',
    gap: 3,
  },
  dayInfoText: {
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  dayTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  center: {
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: 14,
    marginTop: spacing.sm,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  emptyHint: {
    fontSize: 13,
    textAlign: 'center',
    opacity: 0.6,
    lineHeight: 18,
    paddingHorizontal: spacing.lg,
  },
  modeToggle: {
    flexDirection: 'row',
    borderRadius: radii.md,
    padding: 3,
    alignSelf: 'center',
  },
  modeBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: radii.md - 2,
  },
  modeBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  gospelCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm + 4,
    ...shadows.sm,
  },
  gospelHeader: {
    gap: 2,
  },
  gospelLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  gospelCita: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  gospelText: {
    fontSize: 16,
    lineHeight: 26,
  },
  commentarySection: {
    gap: spacing.sm,
  },
  commentSource: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  sourceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  sourceLinkText: {
    fontSize: 12,
    fontWeight: '600',
  },
  otherReadings: {
    gap: spacing.sm + 2,
  },
  trackerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm + 2,
    paddingVertical: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1.5,
    marginTop: spacing.sm,
  },
  trackerText: {
    fontSize: 16,
  },
});
