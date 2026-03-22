import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useContigoHabits, DURATION_CONFIG } from '@/hooks/useContigoHabits';
import { useDailyReadings } from '@/hooks/useDailyReadings';
import {
  useLiturgicalSeason,
  SEASON_ACCENT,
} from '@/hooks/useLiturgicalSeason';
import ContigoToolCard from '@/components/contigo/ContigoToolCard';
import HabitWeekView from '@/components/contigo/HabitWeekView';
import LiturgicalBadge from '@/components/contigo/LiturgicalBadge';

interface Props {
  navigation: any;
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMonday(offset: number): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + offset * 7;
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatWeekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const mDay = monday.getDate();
  const sDay = sunday.getDate();
  const months = [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun',
    'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
  ];
  if (monday.getMonth() === sunday.getMonth()) {
    return `${mDay}–${sDay} ${months[monday.getMonth()]}`;
  }
  return `${mDay} ${months[monday.getMonth()]}–${sDay} ${months[sunday.getMonth()]}`;
}

function formatDate(dateStr: string): string {
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

export default function ContigoHomeScreen({ navigation }: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  const todayStr = getTodayStr();

  const { todayRecord, getStreak, getWeekSummary } = useContigoHabits();
  const { readings } = useDailyReadings(todayStr);
  const liturgical = useLiturgicalSeason(todayStr);
  const accent = SEASON_ACCENT[liturgical.seasonId] ?? '#3A7D44';

  const [weekOffset, setWeekOffset] = useState(0);
  const weekMonday = useMemo(() => getMonday(weekOffset), [weekOffset]);
  const weekRecords = getWeekSummary(weekMonday);
  const weekLabel = formatWeekLabel(weekMonday);
  const readingStreak = getStreak('reading');
  const prayerStreak = getStreak('prayer');

  const evangelioSubtitle = readings?.info?.citaEvangelio
    ? `${readings.info.citaEvangelio}`
    : undefined;

  const prayerStatusText = todayRecord?.prayerDone
    ? `${DURATION_CONFIG[todayRecord.prayerDuration!]?.label ?? 'Registrado'}`
    : 'Pendiente hoy';

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: isDark ? '#1C1C1E' : '#F8F6F3' }]}
      edges={['top']}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View
          style={[
            styles.headerContainer,
            {
              backgroundColor: isDark
                ? '#2C2C2E'
                : accent + '08',
            },
          ]}
        >
          <View style={styles.headerTop}>
            <View>
              <Text
                style={[
                  styles.headerTitle,
                  { color: isDark ? '#FFF' : '#1A1A2E' },
                ]}
              >
                Contigo
              </Text>
              <Text
                style={[
                  styles.headerSubtitle,
                  { color: isDark ? '#AAA' : '#666680' },
                ]}
              >
                Propuestas para la oración de cada día
              </Text>
            </View>
            <View style={[styles.headerIcon, { backgroundColor: accent + '15' }]}>
              <MaterialIcons name="favorite" size={24} color={accent} />
            </View>
          </View>

          {/* Date + liturgical info */}
          <View style={styles.dateRow}>
            <Text
              style={[
                styles.dateText,
                { color: isDark ? '#CCC' : '#555' },
              ]}
            >
              {formatDate(todayStr)}
            </Text>
          </View>
          <LiturgicalBadge
            seasonId={liturgical.seasonId}
            seasonName={liturgical.seasonName}
            specialDay={liturgical.specialDay}
          />

          {/* Greeting with liturgical info title */}
          {readings?.info?.titulo ? (
            <View style={[styles.greetingCard, { backgroundColor: isDark ? '#3A3A3C' : '#FFFFFF' }]}>
              <MaterialIcons name="format-quote" size={20} color={accent} />
              <Text
                style={[
                  styles.greetingText,
                  { color: isDark ? '#DDD' : '#444' },
                ]}
                numberOfLines={3}
              >
                {readings.info.titulo}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Tool Cards ── */}
        <View style={styles.section}>
          <ContigoToolCard
            title="Evangelio del Día"
            subtitle={evangelioSubtitle}
            statusText={
              todayRecord?.readingDone ? 'Leído hoy' : 'Sin leer hoy'
            }
            statusDone={todayRecord?.readingDone ?? false}
            icon="auto-stories"
            iconBg="#FFF8E1"
            iconColor="#F59E0B"
            accentColor="#F59E0B"
            streakCount={readingStreak}
            onPress={() => navigation.navigate('Evangelio')}
          />

          <ContigoToolCard
            title="Mi Rato de Oración"
            subtitle={
              todayRecord?.prayerDone
                ? prayerStatusText
                : undefined
            }
            statusText={
              todayRecord?.prayerDone
                ? 'Registrado hoy'
                : 'Pendiente hoy'
            }
            statusDone={todayRecord?.prayerDone ?? false}
            icon="self-improvement"
            iconBg="#E8F5E9"
            iconColor="#4CAF50"
            accentColor="#4CAF50"
            streakCount={prayerStreak}
            onPress={() => navigation.navigate('Oracion')}
          />

          <ContigoToolCard
            title="Revisión del Día"
            icon="visibility"
            iconBg="#F0F0F0"
            iconColor="#B0B0B0"
            accentColor="#999"
            disabled
            disabledLabel="Próximamente"
          />
        </View>

        {/* ── Week Tracker ── */}
        <View style={styles.section}>
          <HabitWeekView
            weekRecords={weekRecords}
            streak={readingStreak}
            weekLabel={weekLabel}
            onPrevWeek={() => setWeekOffset((o) => o - 1)}
            onNextWeek={() => setWeekOffset((o) => Math.min(o + 1, 0))}
          />
        </View>

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
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 20,
    gap: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateRow: {
    marginTop: 4,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  greetingCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginTop: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
      },
      default: { elevation: 1 },
    }),
  },
  greetingText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    flex: 1,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 8,
  },
});
