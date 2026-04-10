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

  return (
    <ScrollView 
      style={[
        styles.container, 
        { backgroundColor: theme.background }
      ]}
      contentContainerStyle={{ 
        paddingTop: insets.top + spacing.lg,
        paddingBottom: insets.bottom + spacing.xl * 2,
        paddingHorizontal: spacing.md,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>
          Contigo
        </Text>
        <Text style={[styles.subtitle, { color: theme.icon }]}>
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
          statusColor={readingDone ? (isDark ? '#A3BD31' : '#3A7D44') : theme.icon}
          accentColor={isDark ? '#E08A3C' : '#F59E0B'}
          onPress={() => router.push('/screens/EvangelioScreen')}
        />

        <ContigoToolCard
          title="Mi Rato de Oración"
          icon="self-improvement"
          subtitle="Registra tu momento de oración personal"
          statusText={prayerDone ? 'Registrado hoy' : 'Pendiente hoy'}
          statusIcon={prayerDone ? 'check-circle' : 'radio-button-unchecked'}
          statusColor={prayerDone ? (isDark ? '#A3BD31' : '#3A7D44') : theme.icon}
          accentColor={isDark ? '#31AADF' : '#0a7ea4'}
          onPress={() => {
            // Future implementation
          }}
          badge={
            prayerStreak > 0 ? (
              <View style={[styles.streakBadge, { backgroundColor: hexAlpha(colors.warning, '20') }]}>
                <Text style={styles.streakEmoji}>🔥</Text>
                <Text style={[styles.streakText, { color: isDark ? '#FCD200' : '#d97706' }]}>
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
          statusColor={theme.icon}
          accentColor={isDark ? '#6B3FA0' : '#9D1E74'}
          disabled={true}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    marginBottom: spacing.xl,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  content: {
    gap: spacing.sm,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 100,
  },
  streakEmoji: {
    fontSize: 12,
  },
  streakText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '800',
  },
});
