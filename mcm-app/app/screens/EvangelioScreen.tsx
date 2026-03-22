import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useContigoHabits } from '@/hooks/useContigoHabits';
import { useDailyReadings } from '@/hooks/useDailyReadings';
import {
  useLiturgicalSeason,
  SEASON_ACCENT,
} from '@/hooks/useLiturgicalSeason';
import LiturgicalBadge from '@/components/contigo/LiturgicalBadge';
import ReadingCard from '@/components/contigo/ReadingCard';
import { ActivityIndicator } from 'react-native-paper';

function formatDateNav(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const days = [
    'Domingo', 'Lunes', 'Martes', 'Miércoles',
    'Jueves', 'Viernes', 'Sábado',
  ];
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  return `${days[d.getDay()]} ${d.getDate()} de ${months[d.getMonth()]}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function EvangelioScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const todayStr = getTodayStr();

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [activeTab, setActiveTab] = useState<'lectura' | 'comentario'>(
    'lectura',
  );

  const { readings, loading } = useDailyReadings(selectedDate);
  const liturgical = useLiturgicalSeason(selectedDate);
  const { getRecord, setReadingDone } = useContigoHabits();
  const record = getRecord(selectedDate);
  const accent = SEASON_ACCENT[liturgical.seasonId] ?? '#3A7D44';

  // Reading done animation
  const checkAnim = useRef(new Animated.Value(record?.readingDone ? 1 : 0)).current;

  const toggleReading = useCallback(() => {
    const newDone = !record?.readingDone;
    setReadingDone(selectedDate, newDone);
    Animated.spring(checkAnim, {
      toValue: newDone ? 1 : 0,
      useNativeDriver: true,
      tension: 50,
      friction: 3,
    }).start();
  }, [record, selectedDate, setReadingDone, checkAnim]);

  useEffect(() => {
    checkAnim.setValue(record?.readingDone ? 1 : 0);
  }, [selectedDate, record?.readingDone, checkAnim]);

  const canGoForward = selectedDate < addDays(todayStr, 30);
  const canGoBack = selectedDate > addDays(todayStr, -30);
  const isToday = selectedDate === todayStr;

  return (
    <SafeAreaView
      style={[
        styles.safe,
        { backgroundColor: isDark ? '#1C1C1E' : '#F8F6F3' },
      ]}
      edges={['bottom']}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Date Navigator ── */}
        <View style={styles.dateNav}>
          <TouchableOpacity
            onPress={() => canGoBack && setSelectedDate(addDays(selectedDate, -1))}
            disabled={!canGoBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons
              name="chevron-left"
              size={28}
              color={canGoBack ? accent : '#CCC'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSelectedDate(todayStr)}
            style={styles.dateCenter}
          >
            <Text
              style={[
                styles.dateText,
                { color: isDark ? '#FFF' : '#1A1A2E' },
              ]}
            >
              {formatDateNav(selectedDate)}
            </Text>
            {!isToday && (
              <Text style={[styles.todayLink, { color: accent }]}>
                Ir a hoy
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() =>
              canGoForward && setSelectedDate(addDays(selectedDate, 1))
            }
            disabled={!canGoForward}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons
              name="chevron-right"
              size={28}
              color={canGoForward ? accent : '#CCC'}
            />
          </TouchableOpacity>
        </View>

        {/* Liturgical badge */}
        <View style={styles.badgeRow}>
          <LiturgicalBadge
            seasonId={liturgical.seasonId}
            seasonName={liturgical.seasonName}
            specialDay={liturgical.specialDay}
          />
        </View>

        {/* Liturgical day info */}
        {readings?.info?.diaLiturgico ? (
          <Text
            style={[
              styles.litDay,
              { color: isDark ? '#BBB' : '#666' },
            ]}
          >
            {readings.info.diaLiturgico}
          </Text>
        ) : null}

        {loading && !readings ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={accent} />
            <Text
              style={[
                styles.loadingText,
                { color: isDark ? '#888' : '#999' },
              ]}
            >
              Cargando lecturas...
            </Text>
          </View>
        ) : !readings?.evangelio ? (
          <View style={styles.empty}>
            <MaterialIcons name="cloud-off" size={48} color="#CCC" />
            <Text
              style={[
                styles.emptyText,
                { color: isDark ? '#888' : '#999' },
              ]}
            >
              No hay lecturas disponibles para este día
            </Text>
          </View>
        ) : (
          <>
            {/* Tab selector: Lectura / Comentario */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'lectura' && [
                    styles.tabActive,
                    { borderBottomColor: accent },
                  ],
                ]}
                onPress={() => setActiveTab('lectura')}
              >
                <MaterialIcons
                  name="auto-stories"
                  size={18}
                  color={activeTab === 'lectura' ? accent : '#999'}
                />
                <Text
                  style={[
                    styles.tabText,
                    {
                      color:
                        activeTab === 'lectura'
                          ? accent
                          : isDark
                            ? '#888'
                            : '#999',
                      fontWeight: activeTab === 'lectura' ? '700' : '500',
                    },
                  ]}
                >
                  Lectura
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === 'comentario' && [
                    styles.tabActive,
                    { borderBottomColor: accent },
                  ],
                ]}
                onPress={() => setActiveTab('comentario')}
              >
                <MaterialIcons
                  name="forum"
                  size={18}
                  color={activeTab === 'comentario' ? accent : '#999'}
                />
                <Text
                  style={[
                    styles.tabText,
                    {
                      color:
                        activeTab === 'comentario'
                          ? accent
                          : isDark
                            ? '#888'
                            : '#999',
                      fontWeight:
                        activeTab === 'comentario' ? '700' : '500',
                    },
                  ]}
                >
                  Comentario
                </Text>
              </TouchableOpacity>
            </View>

            {activeTab === 'lectura' ? (
              <>
                {/* Gospel (main) */}
                <ReadingCard
                  title="Evangelio"
                  cita={readings.evangelio.cita}
                  texto={readings.evangelio.texto}
                  accent={accent}
                />

                {/* Other readings */}
                {readings.lectura1 ? (
                  <ReadingCard
                    title="Primera Lectura"
                    cita={readings.lectura1.cita}
                    texto={readings.lectura1.texto}
                    accent="#31AADF"
                    collapsible
                    initiallyExpanded={false}
                  />
                ) : null}

                {readings.info?.salmo ? (
                  <ReadingCard
                    title="Salmo"
                    cita={readings.info.salmo}
                    texto=""
                    accent="#6B3FA0"
                    collapsible
                    initiallyExpanded={false}
                  />
                ) : null}

                {readings.lectura2 ? (
                  <ReadingCard
                    title="Segunda Lectura"
                    cita={readings.lectura2.cita}
                    texto={readings.lectura2.texto}
                    accent="#E15C62"
                    collapsible
                    initiallyExpanded={false}
                  />
                ) : null}
              </>
            ) : (
              <>
                {readings.evangelio.comentario ? (
                  <View
                    style={[
                      styles.commentCard,
                      {
                        backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.commentText,
                        { color: isDark ? '#D0D0D0' : '#333' },
                      ]}
                    >
                      {readings.evangelio.comentario}
                    </Text>
                    {readings.evangelio.comentarista ? (
                      <Text
                        style={[
                          styles.commentAuthor,
                          { color: accent },
                        ]}
                      >
                        — {readings.evangelio.comentarista}
                      </Text>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.empty}>
                    <MaterialIcons
                      name="speaker-notes-off"
                      size={36}
                      color="#CCC"
                    />
                    <Text
                      style={[
                        styles.emptyText,
                        { color: isDark ? '#888' : '#999' },
                      ]}
                    >
                      No hay comentario disponible
                    </Text>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* ── Reading Done Toggle ── */}
        {readings?.evangelio ? (
          <TouchableOpacity
            style={[
              styles.doneButton,
              {
                backgroundColor: record?.readingDone
                  ? '#4CAF50'
                  : isDark
                    ? '#2C2C2E'
                    : '#FFFFFF',
                borderColor: record?.readingDone ? '#4CAF50' : '#E0E0E0',
              },
            ]}
            onPress={toggleReading}
            activeOpacity={0.7}
          >
            <Animated.View
              style={{
                transform: [
                  {
                    scale: checkAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.1],
                    }),
                  },
                ],
              }}
            >
              <MaterialIcons
                name={record?.readingDone ? 'check-circle' : 'radio-button-unchecked'}
                size={28}
                color={record?.readingDone ? '#FFF' : '#CCC'}
              />
            </Animated.View>
            <Text
              style={[
                styles.doneText,
                {
                  color: record?.readingDone
                    ? '#FFF'
                    : isDark
                      ? '#BBB'
                      : '#666',
                },
              ]}
            >
              {record?.readingDone
                ? '¡Leído!'
                : 'Marcar como leído'}
            </Text>
            {record?.readingDone && (
              <Text style={styles.doneEmoji}>✨</Text>
            )}
          </TouchableOpacity>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dateCenter: {
    alignItems: 'center',
  },
  dateText: {
    fontSize: 17,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  todayLink: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  badgeRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  litDay: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 15,
  },
  commentCard: {
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      default: { elevation: 1 },
    }),
  },
  commentText: {
    fontSize: 15,
    lineHeight: 26,
    letterSpacing: 0.2,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'right',
  },
  loader: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 50,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      default: { elevation: 2 },
    }),
  },
  doneText: {
    fontSize: 17,
    fontWeight: '700',
  },
  doneEmoji: {
    fontSize: 20,
  },
});
