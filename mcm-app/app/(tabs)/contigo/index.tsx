import React, { useCallback } from 'react';
import { ScrollView, View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import { ContigoToolCard } from '@/components/contigo/ContigoToolCard';
import { LiturgicalBadge } from '@/components/contigo/LiturgicalBadge';
import { useContigoHabits } from '@/hooks/useContigoHabits';
import { useDailyReadings } from '@/hooks/useDailyReadings';
import spacing from '@/constants/spacing';
import { hexAlpha } from '@/utils/colorUtils';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

// ── Contigo Theme Colors ──
const CONTIGO = {
  light: {
    accent: '#B8860B',       // Dorado oscuro
    accentSoft: '#FFF8E7',   // Crema dorado
    surface: '#FEFBF5',      // Fondo cálido
    surfaceEnd: '#F5EFE3',   // Gradiente final
    warmGray: '#6B6560',     // Texto secundario
    titleColor: '#3D3225',   // Marrón cálido para título
    subtitleColor: '#8B7E6E',// Marrón suave para subtítulo
  },
  dark: {
    accent: '#DAA520',       // Goldenrod
    accentSoft: '#2A2112',   // Fondo oscuro cálido
    surface: '#1C1A17',      // Fondo oscuro
    surfaceEnd: '#0F0E0C',   // Gradiente final oscuro
    warmGray: '#A09A94',     // Texto secundario dark
    titleColor: '#F5EFE3',   // Crema para título
    subtitleColor: '#A09A94',// Gris cálido para subtítulo
  },
};

export default function ContigoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  const contigo = isDark ? CONTIGO.dark : CONTIGO.light;

  const { todayStr, todayRecord, getStreak, reloadRecords } = useContigoHabits();
  const { readings, isLoading } = useDailyReadings(todayStr);

  useFocusEffect(
    useCallback(() => {
      reloadRecords();
    }, [])
  );

  const readingDone = todayRecord?.readingDone;
  const prayerDone = todayRecord?.prayerDone;
  const prayerStreak = getStreak('prayer');
  const readingStreak = getStreak('reading');

  // Warm, serene gradient — no reds!
  const bgGradient = isDark
    ? [contigo.surface, contigo.surfaceEnd, '#000000'] as const
    : [contigo.surface, contigo.surfaceEnd, '#F0EBE0'] as const;

  // Format today's date nicely
  const today = new Date();
  const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const MONTHS = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  const dateStr = `${DAYS[today.getDay()]}, ${today.getDate()} de ${MONTHS[today.getMonth()]}`;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={bgGradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl * 2,
          paddingHorizontal: spacing.md,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text style={[styles.title, { color: contigo.titleColor }]}>
                Contigo
              </Text>
              <Text style={[styles.subtitle, { color: contigo.subtitleColor }]}>
                Propuestas para la oración de cada día
              </Text>
            </View>
            <TouchableOpacity
               onPress={() => router.push('/contigo/bookmarks')}
               style={[
                 styles.bookmarkBtn,
                 { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }
               ]}
            >
               <MaterialIcons name="bookmarks" size={22} color={contigo.accent} />
            </TouchableOpacity>
          </View>
          <View style={styles.dateRow}>
            <Text style={[styles.dateText, { color: contigo.warmGray }]}>
              {dateStr}
            </Text>
            <LiturgicalBadge dateStr={todayStr} />
          </View>
        </View>

        {/* ── Tool Cards ── */}
        <View style={styles.content}>
          {/* Evangelio del Día */}
          <ContigoToolCard
            title="Evangelio del Día"
            icon="menu-book"
            subtitle={
              isLoading
                ? 'Cargando lecturas...'
                : readings?.evangelio?.cita || 'Ver las lecturas de hoy'
            }
            statusText={readingDone ? 'Leído hoy' : 'Pendiente hoy'}
            statusIcon={
              readingDone ? 'check-circle' : 'radio-button-unchecked'
            }
            statusColor={
              readingDone
                ? isDark
                  ? '#A3BD31'
                  : '#3A7D44'
                : contigo.warmGray
            }
            accentColor={contigo.accent}
            onPress={() => router.push('/(tabs)/contigo/evangelio')}
          />

          {/* Mi Rato de Oración */}
          <ContigoToolCard
            title="Mi Rato de Oración"
            icon="self-improvement"
            subtitle="Registra tu momento de oración personal"
            statusText={prayerDone ? 'Registrado hoy' : 'Pendiente hoy'}
            statusIcon={
              prayerDone ? 'check-circle' : 'radio-button-unchecked'
            }
            statusColor={
              prayerDone
                ? isDark
                  ? '#A3BD31'
                  : '#3A7D44'
                : contigo.warmGray
            }
            accentColor={isDark ? '#E8A838' : '#C4922A'}
            onPress={() => {
              // Future: router.push('/screens/OracionScreen')
            }}
            badge={
              prayerStreak > 0 ? (
                <View
                  style={[
                    styles.streakBadge,
                    {
                      backgroundColor: isDark
                        ? hexAlpha('#DAA520', '20')
                        : hexAlpha('#B8860B', '12'),
                    },
                  ]}
                >
                  <Text style={styles.streakEmoji}>🔥</Text>
                  <Text
                    style={[
                      styles.streakText,
                      {
                        color: isDark ? '#DAA520' : '#8B6914',
                      },
                    ]}
                  >
                    {prayerStreak} días
                  </Text>
                </View>
              ) : null
            }
          />

          {/* Revisión del Día — placeholder */}
          <ContigoToolCard
            title="Revisión del Día"
            icon="search"
            subtitle="Examen de conciencia diario"
            statusText="Próximamente"
            statusIcon="schedule"
            statusColor={contigo.warmGray}
            accentColor={isDark ? '#A09A94' : '#8B7E6E'}
            disabled={true}
          />

        </View>

        {/* ── Weekly Streak Summary — always visible ── */}
        {
          <View
            style={[
              styles.streakSummary,
              {
                backgroundColor: isDark
                  ? 'rgba(218,165,32,0.08)'
                  : 'rgba(184,134,11,0.06)',
                borderColor: isDark
                  ? 'rgba(218,165,32,0.15)'
                  : 'rgba(184,134,11,0.10)',
              },
            ]}
          >
            <View style={styles.streakSummaryHeader}>
              <MaterialIcons
                name="local-fire-department"
                size={20}
                color={contigo.accent}
              />
              <Text
                style={[
                  styles.streakSummaryTitle,
                  { color: contigo.accent },
                ]}
              >
                Tu constancia
              </Text>
            </View>
            <View style={styles.streakSummaryRow}>
              <View style={styles.streakItem}>
                <Text style={[styles.streakNumber, { color: theme.text }]}>
                  {readingStreak}
                </Text>
                <Text
                  style={[
                    styles.streakLabel,
                    { color: contigo.warmGray },
                  ]}
                >
                  {readingStreak === 1 ? 'día' : 'días'} leyendo
                </Text>
              </View>
              <View style={styles.streakItem}>
                <Text style={[styles.streakNumber, { color: theme.text }]}>
                  {prayerStreak}
                </Text>
                <Text
                  style={[
                    styles.streakLabel,
                    { color: contigo.warmGray },
                  ]}
                >
                  {prayerStreak === 1 ? 'día' : 'días'} orando
                </Text>
              </View>
            </View>
          </View>
        }
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    marginBottom: spacing.xl,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  dateText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
    marginTop: 4,
  },
  content: {
    gap: 0, // Cards themselves have marginBottom
  },
  // Streak badge (inline on prayer card)
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 100,
  },
  streakEmoji: {
    fontSize: 12,
  },
  streakText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '700',
  },
  // Bottom streak summary
  streakSummary: {
    marginTop: spacing.lg,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  streakSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  streakSummaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  streakSummaryRow: {
    flexDirection: 'row',
    gap: 32,
  },
  streakItem: {
    alignItems: 'center',
  },
  streakNumber: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  streakLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  bookmarkBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});