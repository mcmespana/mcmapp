import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { PressableFeedback, useToast } from 'heroui-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  useContigoHabits,
  PrayerDuration,
  Emotion,
} from '@/hooks/useContigoHabits';

// ── Contigo Theme Colors ──
const CONTIGO = {
  light: {
    surface: '#FBF8FF', // matching design bg-surface
    surfaceContainerLow: '#F3F2FF', // matching design
    surfaceContainerLowest: '#FFFFFF',
    primary: '#253883', // using primary-container color as base primary for headers
    primaryFixed: '#DDE1FF',
    accent: '#B8860B', // we keep some accent for legacy, but let's map mostly to design colors
    textOnSurface: '#001355',
    textOnSurfaceVariant: '#454651',
    outlineVariant: '#C5C5D3',
    surfaceTint: '#4759A5',
  },
  dark: {
    // approximating a dark mode based on the light mode palette
    surface: '#1A1B23',
    surfaceContainerLow: '#2A2A38',
    surfaceContainerLowest: '#23232F',
    primary: '#AEC0FF',
    primaryFixed: '#3F4D8C',
    accent: '#DAA520',
    textOnSurface: '#E3E2E6',
    textOnSurfaceVariant: '#C4C6D0',
    outlineVariant: '#44474F',
    surfaceTint: '#B8C4FF',
  },
};

export default function OracionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = isDark ? CONTIGO.dark : CONTIGO.light;

  const [selectedDate, setSelectedDate] = useState(new Date());

  // Daily log state
  const [duration, setDuration] = useState<PrayerDuration | null>(null);
  const [emotion, setEmotion] = useState<Emotion | null>(null);

  const { setPrayerDone, getRecord } = useContigoHabits();
  const toast = useToast();

  const handlePrevDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  // Format date like "Hoy, 14 de marzo" or "Ayer, 13 de marzo"
  const getFormattedDate = (date: Date) => {
    const today = new Date();
    const isToday =
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

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

    let prefix = '';
    if (isToday) prefix = 'Hoy, ';
    else if (isYesterday) prefix = 'Ayer, ';

    return `${prefix}${date.getDate()} de ${MONTHS[date.getMonth()]}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* ── Top AppBar ── */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 16,
            borderBottomColor: theme.outlineVariant + '33', // 33 for some alpha
            backgroundColor: isDark
              ? 'rgba(26,27,35,0.7)'
              : 'rgba(255,255,255,0.7)',
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <PressableFeedback
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color={theme.primary} />
          </PressableFeedback>
          <Text style={[styles.headerTitle, { color: theme.primary }]}>
            Mi Rato de Oración
          </Text>
        </View>
        <View style={styles.profileContainer}>
          <View
            style={[
              styles.profilePlaceholder,
              { backgroundColor: theme.primaryFixed },
            ]}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 80 }, // extra padding for bottom tab bar simulation if needed
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Date Navigator ── */}
        <View
          style={[
            styles.dateNavigator,
            { backgroundColor: theme.surfaceContainerLow },
          ]}
        >
          <PressableFeedback
            onPress={handlePrevDay}
            style={styles.dateNavButton}
          >
            <MaterialIcons
              name="chevron-left"
              size={24}
              color={theme.primary}
            />
          </PressableFeedback>
          <View style={styles.dateTextContainer}>
            <Text style={[styles.dateText, { color: theme.textOnSurface }]}>
              {getFormattedDate(selectedDate)}
            </Text>
          </View>
          <PressableFeedback
            onPress={handleNextDay}
            style={styles.dateNavButton}
          >
            <MaterialIcons
              name="chevron-right"
              size={24}
              color={theme.primary}
            />
          </PressableFeedback>
        </View>

        {/* ── Section 1: Daily Log ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>
              ¿Cuánto tiempo has dedicado hoy?
            </Text>
            <Text
              style={[
                styles.sectionSubtitle,
                { color: theme.textOnSurfaceVariant },
              ]}
            >
              Lo importante no es la duración, pero te puede ayudar registrarlo.
            </Text>
          </View>

          {/* Duration Chips */}
          <View style={styles.chipsContainer}>
            {(
              [
                'less_than_1',
                '2_to_4',
                '5_to_10',
                '10_to_15',
                'more_than_15',
              ] as PrayerDuration[]
            ).map((d) => {
              const labels: Record<PrayerDuration, string> = {
                less_than_1: '< 1 min',
                '2_to_4': '2–4 min',
                '5_to_10': '5–10 min',
                '10_to_15': '10–15 min',
                more_than_15: '> 15 min',
              };
              const isSelected = duration === d;
              return (
                <PressableFeedback
                  key={d}
                  onPress={() => setDuration(d)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected
                        ? theme.primary
                        : theme.surfaceContainerLowest,
                      borderColor: isSelected
                        ? theme.primary
                        : theme.outlineVariant + '4D', // 30% opacity
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: isSelected
                          ? '#FFFFFF'
                          : theme.textOnSurfaceVariant,
                      },
                    ]}
                  >
                    {labels[d]}
                  </Text>
                </PressableFeedback>
              );
            })}
          </View>

          {/* Emotion Selector */}
          <View style={styles.emotionSection}>
            <Text style={[styles.emotionTitle, { color: theme.primary }]}>
              ¿Cómo te has sentido en la oración?
            </Text>
            <View style={styles.emotionGrid}>
              {(
                ['joy', 'sadness', 'anger', 'fear', 'disgust'] as Emotion[]
              ).map((e) => {
                const config: Record<
                  Emotion,
                  { emoji: string; label: string; color: string }
                > = {
                  joy: { emoji: '😊', label: 'Alegría', color: '#FCD200' },
                  sadness: { emoji: '😢', label: 'Tristeza', color: '#31AADF' },
                  anger: { emoji: '😠', label: 'Enfado', color: '#E15C62' },
                  fear: { emoji: '😨', label: 'Miedo', color: '#6B3FA0' },
                  disgust: { emoji: '🤢', label: 'Rechazo', color: '#3A7D44' },
                };
                const isSelected = emotion === e;
                return (
                  <PressableFeedback
                    key={e}
                    onPress={() => setEmotion(e)}
                    style={[
                      styles.emotionButton,
                      {
                        backgroundColor: theme.surfaceContainerLowest,
                        borderColor: isSelected
                          ? config[e].color
                          : 'transparent',
                        borderWidth: 2,
                      },
                    ]}
                  >
                    <Text style={styles.emotionEmoji}>{config[e].emoji}</Text>
                    <Text
                      style={[styles.emotionLabel, { color: config[e].color }]}
                    >
                      {config[e].label}
                    </Text>
                  </PressableFeedback>
                );
              })}
            </View>
          </View>

          {/* Save Button */}
          <PressableFeedback
            onPress={async () => {
              if (!duration || !emotion) {
                toast.show({
                  label: 'Por favor, selecciona duración y emoción.',
                  variant: 'danger',
                });
                return;
              }
              const year = selectedDate.getFullYear();
              const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
              const day = String(selectedDate.getDate()).padStart(2, '0');
              const dateStr = `${year}-${month}-${day}`;

              await setPrayerDone(dateStr, duration, emotion);
              toast.show({
                label: 'Momento guardado con éxito',
                variant: 'success',
              });
            }}
            style={[styles.saveButton, { backgroundColor: theme.primary }]}
          >
            <Text style={styles.saveButtonText}>Guardar Momento</Text>
          </PressableFeedback>
        </View>

        {/* ── Section 2: History & Stats ── */}
        <View style={styles.section}>
          <View style={styles.historyHeader}>
            <Text
              style={[
                styles.sectionTitle,
                { color: theme.primary, marginBottom: 0 },
              ]}
            >
              Tu camino este mes
            </Text>
            <View
              style={[
                styles.monthBadge,
                { backgroundColor: theme.primaryFixed },
              ]}
            >
              <Text style={[styles.monthBadgeText, { color: theme.primary }]}>
                {selectedDate.toLocaleDateString('es-ES', {
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
            </View>
          </View>

          {/* Mini Calendar */}
          <View
            style={[
              styles.calendarContainer,
              {
                backgroundColor: theme.surfaceContainerLowest,
                borderColor: theme.outlineVariant + '33',
              },
            ]}
          >
            <View style={styles.calendarGrid}>
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => (
                <Text
                  key={day}
                  style={[styles.dayLabel, { color: theme.outlineVariant }]}
                >
                  {day}
                </Text>
              ))}

              {/* Calculate days in month and starting weekday */}
              {(() => {
                const year = selectedDate.getFullYear();
                const month = selectedDate.getMonth();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday

                // Adjust to make Monday the first day
                let startDayOffset = firstDay === 0 ? 6 : firstDay - 1;

                const cells = [];

                // Empty cells for previous month
                for (let i = 0; i < startDayOffset; i++) {
                  cells.push(
                    <View key={`empty-${i}`} style={styles.calendarCell} />,
                  );
                }

                // Days of the month
                for (let day = 1; day <= daysInMonth; day++) {
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const record = getRecord(dateStr);
                  const isSelected = day === selectedDate.getDate();

                  let dotColor = null;
                  if (record?.prayerDone && record.prayerEmotion) {
                    const emotionColors: Record<Emotion, string> = {
                      joy: '#FCD200',
                      sadness: '#31AADF',
                      anger: '#E15C62',
                      fear: '#6B3FA0',
                      disgust: '#3A7D44',
                    };
                    dotColor = emotionColors[record.prayerEmotion];
                  }

                  cells.push(
                    <View key={day} style={styles.calendarCell}>
                      {isSelected && (
                        <View
                          style={[
                            styles.selectedDayBg,
                            {
                              borderColor: theme.primary + '33',
                              backgroundColor: theme.primary + '0D',
                            },
                          ]}
                        />
                      )}
                      <Text
                        style={[
                          styles.calendarDayText,
                          {
                            color: isSelected
                              ? theme.primary
                              : theme.textOnSurface,
                          },
                          isSelected && { fontWeight: 'bold' },
                        ]}
                      >
                        {day}
                      </Text>
                      {dotColor && (
                        <View
                          style={[
                            styles.calendarDot,
                            { backgroundColor: dotColor },
                          ]}
                        />
                      )}
                    </View>,
                  );
                }

                return cells;
              })()}
            </View>
          </View>

          {/* Stats Row */}
          {(() => {
            // Calculate stats for the current month
            const year = selectedDate.getFullYear();
            const month = selectedDate.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            let prayerCount = 0;
            let totalMinutesApprox = 0;
            const emotionCounts: Record<Emotion, number> = {
              joy: 0,
              sadness: 0,
              anger: 0,
              fear: 0,
              disgust: 0,
            };

            for (let day = 1; day <= daysInMonth; day++) {
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const record = getRecord(dateStr);

              if (record?.prayerDone) {
                prayerCount++;

                if (record.prayerDuration) {
                  if (record.prayerDuration === 'less_than_1')
                    totalMinutesApprox += 1;
                  else if (record.prayerDuration === '2_to_4')
                    totalMinutesApprox += 3;
                  else if (record.prayerDuration === '5_to_10')
                    totalMinutesApprox += 7.5;
                  else if (record.prayerDuration === '10_to_15')
                    totalMinutesApprox += 12.5;
                  else if (record.prayerDuration === 'more_than_15')
                    totalMinutesApprox += 20;
                }

                if (record.prayerEmotion) {
                  emotionCounts[record.prayerEmotion]++;
                }
              }
            }

            // Format total time
            const hours = Math.floor(totalMinutesApprox / 60);
            const mins = Math.floor(totalMinutesApprox % 60);
            const timeStr = hours > 0 ? `~${hours}h ${mins}m` : `~${mins}m`;

            // Find most frequent emotion
            let topEmotion: Emotion | null = null;
            let maxCount = 0;
            Object.entries(emotionCounts).forEach(([e, count]) => {
              if (count > maxCount) {
                maxCount = count;
                topEmotion = e as Emotion;
              }
            });

            const emotionDisplay: Record<Emotion, string> = {
              joy: '😊 Alegría',
              sadness: '😢 Tristeza',
              anger: '😠 Enfado',
              fear: '😨 Miedo',
              disgust: '🤢 Rechazo',
            };

            return (
              <View style={styles.statsGrid}>
                <View
                  style={[
                    styles.statCard,
                    { backgroundColor: theme.surfaceContainerLow },
                  ]}
                >
                  <Text
                    style={[
                      styles.statLabel,
                      { color: theme.textOnSurfaceVariant },
                    ]}
                  >
                    Progreso
                  </Text>
                  <Text style={[styles.statValue, { color: theme.primary }]}>
                    {prayerCount}/{daysInMonth} Días
                  </Text>
                </View>
                <View
                  style={[
                    styles.statCard,
                    { backgroundColor: theme.surfaceContainerLow },
                  ]}
                >
                  <Text
                    style={[
                      styles.statLabel,
                      { color: theme.textOnSurfaceVariant },
                    ]}
                  >
                    Tiempo
                  </Text>
                  <Text style={[styles.statValue, { color: theme.primary }]}>
                    {timeStr}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statCard,
                    { backgroundColor: theme.surfaceContainerLow },
                  ]}
                >
                  <Text
                    style={[
                      styles.statLabel,
                      { color: theme.textOnSurfaceVariant },
                    ]}
                  >
                    Emoción
                  </Text>
                  <Text
                    style={[styles.statValue, { color: theme.primary }]}
                    numberOfLines={1}
                  >
                    {topEmotion ? emotionDisplay[topEmotion] : '-'}
                  </Text>
                </View>
              </View>
            );
          })()}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 50,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backButton: {
    padding: 4,
    borderRadius: 20,
  },
  headerTitle: {
    fontFamily: 'Manrope-Bold', // Replace with the app's standard bold font if different
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  profileContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  profilePlaceholder: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  dateNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 48,
  },
  dateNavButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  dateTextContainer: {
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    fontWeight: '700',
  },
  section: {
    marginBottom: 48,
  },
  sectionHeader: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emotionSection: {
    marginBottom: 32,
  },
  emotionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  emotionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  emotionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 16,
  },
  emotionEmoji: {
    fontSize: 30,
    marginBottom: 8,
  },
  emotionLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  saveButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  monthBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  monthBadgeText: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  calendarContainer: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayLabel: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  calendarCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  calendarDayText: {
    fontSize: 12,
  },
  calendarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    position: 'absolute',
    bottom: 4,
  },
  selectedDayBg: {
    ...StyleSheet.absoluteFillObject,
    margin: 4,
    borderRadius: 8,
    borderWidth: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    gap: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontFamily: 'Manrope-Bold',
    fontSize: 16,
    fontWeight: '800',
  },
});
