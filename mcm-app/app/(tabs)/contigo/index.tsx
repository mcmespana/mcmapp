import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useTabScroll } from '@/components/tabs/useTabScroll';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useContigoHabits } from '@/hooks/useContigoHabits';
import { useDailyReadings } from '@/hooks/useDailyReadings';
import {
  MONTHS_CAP,
  WARM_DARK,
  WARM_LIGHT,
  formatDateLong,
  warm,
} from '@/components/contigo/theme';
import {
  HabitTile,
  HeroCard,
  EvangelioTeaserCard,
  WeekStrip,
  StatCard,
  MonthHeatmap,
} from '@/components/contigo/HomeWidgets';
import DayActionSheet from '@/components/contigo/DayActionSheet';
import { LiturgicalBadge } from '@/components/contigo/LiturgicalBadge';
import { useContigoDayMenu } from '@/hooks/useContigoDayMenu';
import LoginNudgeBanner from '@/components/LoginNudgeBanner';
import { useAuth } from '@/contexts/AuthContext';
import { h } from '@/utils/haptics';
import typography from '@/constants/typography';

export default function ContigoScreen() {
  const insets = useSafeAreaInsets();
  // Pantalla raíz del tab Contigo.
  const { scrollRef, onScroll, contentPaddingBottom } = useTabScroll('contigo');
  const router = useRouter();
  const scheme = useColorScheme();
  const { user: authUser } = useAuth();
  const isDark = scheme === 'dark';
  const W = warm(isDark);
  const { width: windowWidth } = useWindowDimensions();
  // iPad / large tablet / desktop web — cap content width so the layout
  // doesn't stretch into a sparse, unbalanced canvas.
  const isWide = windowWidth >= 720;
  const contentMaxWidth = windowWidth >= 1100 ? 880 : 720;

  const {
    todayStr,
    todayRecord,
    records,
    getStreak,
    getTotalMinutesWeek,
    getReadingsMonth,
    getActiveDaysMonth,
    reloadRecords,
    isRevisionDone,
  } = useContigoHabits();

  const { readings } = useDailyReadings(todayStr);

  useFocusEffect(
    useCallback(() => {
      reloadRecords();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const readingDone = !!todayRecord?.readingDone;
  const prayerDone = !!todayRecord?.prayerDone;
  const revisionDone = isRevisionDone(todayStr);
  const doneCount = [readingDone, prayerDone, revisionDone].filter(
    Boolean,
  ).length;

  const prayStreak = getStreak('prayer');
  const totalMins = getTotalMinutesWeek(todayStr);
  const totalReads = getReadingsMonth(todayStr);

  // Mes que se ve en el calendario de abajo. Arranca en el de hoy y se mueve
  // con las flechas: el calendario ya no está clavado al mes en curso, así se
  // puede volver a un evangelio de hace dos meses (o ir al de la semana que
  // viene) sin entrar antes en la pantalla del evangelio.
  const [monthKey, setMonthKey] = React.useState(() => todayStr.slice(0, 7));
  const [mYear, mMonth] = monthKey.split('-').map(Number);
  const monthLabel = `${MONTHS_CAP[mMonth - 1]} ${mYear}`;
  const isCurrentMonth = monthKey === todayStr.slice(0, 7);
  const daysInMonth = new Date(mYear, mMonth, 0).getDate();
  // `getActiveDaysMonth` corta en el día que se le pasa: hoy si es el mes en
  // curso (no cuenta días que aún no han pasado) y el mes entero si es otro.
  const monthAnchor = isCurrentMonth
    ? todayStr
    : `${monthKey}-${String(daysInMonth).padStart(2, '0')}`;
  const shiftMonth = (delta: number) => {
    h.select();
    const d = new Date(mYear, mMonth - 1 + delta, 1);
    setMonthKey(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    );
  };
  const activeDays = getActiveDaysMonth(monthAnchor);

  // Pulsar un día (racha o calendario) abre lo que haya guardado; si hay
  // varias cosas, pregunta. Ver `useContigoDayMenu`.
  const { dayMenu, handleDayPress, openDay, closeDayMenu } =
    useContigoDayMenu();

  const bgGradient = isDark
    ? ([WARM_DARK.bg, WARM_DARK.bgDeep] as const)
    : ([WARM_LIGHT.bg, '#F0E8D8'] as const);

  return (
    <View style={styles.container}>
      {/* Header NATIVO: título pequeño "Contigo" + badge litúrgico y favoritos
          como bar items. La fecha pasa al cuerpo. */}
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Contigo',
          headerTransparent: true,
          headerShadowVisible: false,
          headerTintColor: isDark ? WARM_DARK.text : '#2A1E0E',
          headerTitleStyle: {
            color: isDark ? WARM_DARK.text : '#2A1E0E',
            fontWeight: '700',
            fontSize: 17,
          },
          headerRight: () => (
            <View style={styles.nativeHeaderRight}>
              <View style={styles.headerBadgeWrap}>
                <LiturgicalBadge dateStr={todayStr} />
              </View>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/contigo/bookmarks')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ padding: 4 }}
                accessibilityLabel="Ver evangelios guardados"
              >
                <MaterialIcons name="bookmarks" size={22} color={W.accent} />
              </TouchableOpacity>
            </View>
          ),
          ...(Platform.OS === 'ios' &&
          parseInt(String(Platform.Version), 10) < 26
            ? { headerBlurEffect: 'systemChromeMaterial' as const }
            : {}),
        }}
      />
      <LinearGradient
        colors={bgGradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 52,
          paddingBottom: contentPaddingBottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={
            isWide
              ? {
                  width: '100%',
                  maxWidth: contentMaxWidth,
                  alignSelf: 'center',
                }
              : undefined
          }
        >
          {/* Fecha (el título y acciones están ahora en el header nativo) */}
          <Text style={[styles.dateLine, { color: W.textSec }]}>
            {formatDateLong(todayStr)}
          </Text>

          {/* ── Login nudge (solo si hay hábitos y no hay sesión) ── */}
          {!authUser && Object.keys(records).length > 0 && (
            <View style={[styles.section, { alignItems: 'center' }]}>
              <LoginNudgeBanner />
            </View>
          )}

          {/* ── Hero card ──────────────────────────────── */}
          <View style={styles.section}>
            <HeroCard
              doneCount={doneCount}
              prayStreak={prayStreak}
              totalMins={totalMins}
              isDark={isDark}
            />
          </View>

          {/* ── Three habit tiles ──────────────────────── */}
          <View style={[styles.section, styles.tilesRow]}>
            <HabitTile
              habitKey="evangelio"
              done={readingDone}
              onPress={() => router.push('/(tabs)/contigo/evangelio')}
              isDark={isDark}
            />
            <HabitTile
              habitKey="oracion"
              done={prayerDone}
              onPress={() => router.push('/(tabs)/contigo/oracion')}
              isDark={isDark}
            />
            <HabitTile
              habitKey="revision"
              done={revisionDone}
              onPress={() => router.push('/(tabs)/contigo/revision' as never)}
              isDark={isDark}
            />
          </View>

          {/* ── Evangelio teaser ───────────────────────── */}
          <View style={styles.section}>
            <EvangelioTeaserCard
              titulo={readings?.info?.titulo}
              cita={readings?.evangelio?.cita}
              texto={readings?.evangelio?.texto}
              readingDone={readingDone}
              onOpen={() => router.push('/(tabs)/contigo/evangelio')}
              isDark={isDark}
            />
          </View>

          {/* ── Esta semana ────────────────────────────── */}
          <View style={[styles.section, { paddingTop: 18 }]}>
            <Text style={[styles.smallLabel, { color: W.textMuted }]}>
              ÚLTIMOS 7 DÍAS
            </Text>
            <View
              style={[
                styles.cardSurface,
                {
                  backgroundColor: W.bgCard,
                  borderColor: W.border,
                  shadowColor: W.shadow,
                },
              ]}
            >
              <WeekStrip
                records={records}
                todayStr={todayStr}
                isDark={isDark}
                onDayPress={handleDayPress}
              />
            </View>
          </View>

          {/* ── Stats ──────────────────────────────────── */}
          <View style={[styles.section, styles.statsRow]}>
            <StatCard
              icon="🔥"
              value={prayStreak}
              label={'racha de\noración'}
              color={W.fire}
              isDark={isDark}
            />
            <StatCard
              icon="⏱"
              value={`${totalMins}'`}
              label={'min\nesta sem.'}
              color={W.accent}
              isDark={isDark}
            />
            <StatCard
              icon="📖"
              value={totalReads}
              label={'lecturas\neste mes'}
              color={W.blue}
              isDark={isDark}
            />
          </View>

          {/* ── Calendario completo ────────────────────── */}
          <View style={[styles.section, { paddingTop: 18 }]}>
            <View style={styles.monthHdr}>
              <View style={styles.monthNavGroup}>
                <TouchableOpacity
                  onPress={() => shiftMonth(-1)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
                  accessibilityLabel="Mes anterior"
                >
                  <MaterialIcons
                    name="chevron-left"
                    size={20}
                    color={W.textMuted}
                  />
                </TouchableOpacity>
                <Text
                  style={[
                    styles.smallLabel,
                    styles.monthNavLabel,
                    { color: W.textMuted },
                  ]}
                >
                  {monthLabel.toUpperCase()}
                </Text>
                <TouchableOpacity
                  onPress={() => shiftMonth(1)}
                  hitSlop={{ top: 10, bottom: 10, left: 6, right: 10 }}
                  accessibilityLabel="Mes siguiente"
                >
                  <MaterialIcons
                    name="chevron-right"
                    size={20}
                    color={W.textMuted}
                  />
                </TouchableOpacity>
                {!isCurrentMonth ? (
                  <TouchableOpacity
                    onPress={() => {
                      h.select();
                      setMonthKey(todayStr.slice(0, 7));
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                    accessibilityLabel="Volver al mes de hoy"
                  >
                    <MaterialIcons name="today" size={16} color={W.accent} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <View
                style={[
                  styles.monthBadge,
                  {
                    backgroundColor: isDark
                      ? 'rgba(218,165,32,0.12)'
                      : 'rgba(196,146,42,0.10)',
                  },
                ]}
              >
                <Text style={[styles.monthBadgeText, { color: W.accent }]}>
                  {activeDays}{' '}
                  {activeDays === 1 ? 'día activo' : 'días activos'}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.cardSurface,
                {
                  backgroundColor: W.bgCard,
                  borderColor: W.border,
                  shadowColor: W.shadow,
                },
              ]}
            >
              <MonthHeatmap
                records={records}
                todayStr={todayStr}
                monthDate={`${monthKey}-01`}
                isDark={isDark}
                onDayPress={handleDayPress}
              />
            </View>
          </View>
        </View>
      </Animated.ScrollView>

      <DayActionSheet
        visible={!!dayMenu}
        onClose={closeDayMenu}
        date={dayMenu?.date ?? null}
        record={dayMenu?.rec ?? null}
        onSelect={openDay}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 6,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1.4,
    lineHeight: 38,
  },
  subtitle: {
    ...typography.caption,
    fontWeight: '500',
    marginTop: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  nativeHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateLine: {
    ...typography.caption,
    fontWeight: '500',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  headerBadgeWrap: { transform: [{ scale: 0.92 }] },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  tilesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cardSurface: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
  },
  smallLabel: {
    ...typography.micro,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  monthHdr: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  monthNavGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  // `smallLabel` lleva un `marginBottom` pensado para cuando va suelto encima
  // de una tarjeta; dentro de la fila de flechas ese hueco descuadraba el mes
  // respecto a los chevrones.
  monthNavLabel: {
    marginBottom: 0,
  },
  monthBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  monthBadgeText: { fontSize: 11, fontWeight: '700' },
});
