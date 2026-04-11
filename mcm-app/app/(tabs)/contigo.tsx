import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import colors, { Colors } from '@/constants/colors';
import { ContigoToolCard } from '@/components/contigo/ContigoToolCard';
import { LiturgicalBadge } from '@/components/contigo/LiturgicalBadge';
import { useContigoHabits } from '@/hooks/useContigoHabits';
import { useDailyReadings } from '@/hooks/useDailyReadings';
import spacing from '@/constants/spacing';
import { hexAlpha } from '@/utils/colorUtils';
import { LinearGradient } from 'expo-linear-gradient';

export default function ContigoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  
  const { todayStr, todayRecord, getStreak } = useContigoHabits();
  const { readings, isLoading } = useDailyReadings(todayStr);

  const readingDone = todayRecord?.readingDone;
  const prayerDone = todayRecord?.prayerDone;
  
  const prayerStreak = getStreak('prayer');

  // Warm, passionate gradient
  const bgGradient = isDark 
    ? ['#2D1115', '#1A0B0E', '#000000'] as const
    : ['#FFF0F0', '#FFE4E6', '#FDF2F8'] as const;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={bgGradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
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
        <View style={styles.header}>
          <Text style={[styles.title, { color: isDark ? '#FFF' : '#881337' }]}>
            Contigo
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? 'rgba(255,255,255,0.7)' : '#BE123C' }]}>
            Propuestas para la oración de cada día
          </Text>
        </View>

        <View style={styles.content}>
          <ContigoToolCard
            title="Evangelio del Día"
            icon="menu-book"
            subtitle={isLoading ? 'Cargando lecturas...' : (readings?.evangelio?.cita || 'Ver las lecturas de hoy')}
            badge={<LiturgicalBadge dateStr={todayStr} />}
            statusText={readingDone ? 'Leído hoy' : 'Pendiente hoy'}
            statusIcon={readingDone ? 'check-circle' : 'radio-button-unchecked'}
            statusColor={readingDone ? (isDark ? '#A3BD31' : '#3A7D44') : (isDark ? 'rgba(255,255,255,0.5)' : theme.icon)}
            accentColor={isDark ? '#FCA5A5' : '#E11D48'}
            onPress={() => router.push('/screens/EvangelioScreen')}
          />

          <ContigoToolCard
            title="Mi Rato de Oración"
            icon="self-improvement"
            subtitle="Registra tu momento de oración personal"
            statusText={prayerDone ? 'Registrado hoy' : 'Pendiente hoy'}
            statusIcon={prayerDone ? 'check-circle' : 'radio-button-unchecked'}
            statusColor={prayerDone ? (isDark ? '#A3BD31' : '#3A7D44') : (isDark ? 'rgba(255,255,255,0.5)' : theme.icon)}
            accentColor={isDark ? '#FDBA74' : '#EA580C'}
            onPress={() => {
              // Future implementation
            }}
            badge={
              prayerStreak > 0 ? (
                <View style={[styles.streakBadge, { backgroundColor: isDark ? 'rgba(252, 165, 165, 0.2)' : 'rgba(225, 29, 72, 0.15)' }]}>
                  <Text style={styles.streakEmoji}>🔥</Text>
                  <Text style={[styles.streakText, { color: isDark ? '#FECDD3' : '#9F1239' }]}>
                    {prayerStreak} días
                  </Text>
                </View>
              ) : null
            }
          />

          <ContigoToolCard
            title="Revisión del Día"
            icon="search"
            subtitle="Examen de conciencia diario"
            statusText="Próximamente"
            statusIcon="schedule"
            statusColor={isDark ? 'rgba(255,255,255,0.5)' : theme.icon}
            accentColor={isDark ? '#FDA4AF' : '#E11D48'}
            disabled={true}
          />
        </View>
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
    marginBottom: spacing.xl + 8,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1.2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  content: {
    gap: spacing.sm,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  streakEmoji: {
    fontSize: 14,
  },
  streakText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '800',
  },
});