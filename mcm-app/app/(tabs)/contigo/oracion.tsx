import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, PressableFeedback, useToast } from 'heroui-native';
import { BlurView } from 'expo-blur';
import { useContigoHabits, Emotion } from '@/hooks/useContigoHabits';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { radii, shadows } from '@/constants/uiStyles';
import { hexAlpha } from '@/utils/colorUtils';

const EMOTIONS = [
  {
    id: 'joy',
    label: 'Alegría',
    icon: 'sentiment-satisfied',
    color: '#fde68a',
    iconColor: '#ca8a04',
  },
  {
    id: 'sadness',
    label: 'Tristeza',
    icon: 'sentiment-dissatisfied',
    color: '#bfdbfe',
    iconColor: '#1d4ed8',
  },
  {
    id: 'anger',
    label: 'Enojo',
    icon: 'sentiment-very-dissatisfied',
    color: '#fecaca',
    iconColor: '#b91c1c',
  },
  {
    id: 'fear',
    label: 'Miedo',
    icon: 'mood-bad',
    color: '#e9d5ff',
    iconColor: '#7e22ce',
  },
  {
    id: 'disgust',
    label: 'Disgusto',
    icon: 'sick',
    color: '#bbf7d0',
    iconColor: '#15803d',
  },
] as const;

export default function OracionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  const { setPrayerDone, todayRecord, todayStr, getRecord } =
    useContigoHabits();
  const { toast } = useToast();

  const [emotion, setEmotion] = useState<Emotion | null>(
    todayRecord?.prayerEmotion || null,
  );
  const [duration, setDuration] = useState<number>(
    todayRecord?.prayerDurationMinutes || 15,
  );

  const handleDecrease = () => {
    if (duration > 1) {
      setDuration((prev) => prev - 1);
    }
  };

  const handleIncrease = () => {
    if (duration < 120) {
      setDuration((prev) => prev + 1);
    }
  };

  const handleSave = () => {
    if (!emotion) {
      toast.show({
        label: 'Selecciona una emoción',
        variant: 'danger',
      });
      return;
    }

    // Map numerical duration to enum for legacy support if needed
    let durationEnum: any = 'more_than_15';
    if (duration < 1) durationEnum = 'less_than_1';
    else if (duration <= 4) durationEnum = '2_to_4';
    else if (duration <= 10) durationEnum = '5_to_10';
    else if (duration <= 15) durationEnum = '10_to_15';

    setPrayerDone(todayStr, durationEnum, emotion, duration);
    toast.show({
      label: '¡Rato de oración guardado!',
      variant: 'success',
    });
    router.back();
  };

  // Generate calendar grid for consistency
  const getConsistencyGrid = () => {
    // Basic representation of a month: 35 dots (5 weeks * 7 days)
    // To match the UI precisely, we can use the current month
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // For simplicity of visual match, just build an array of days
    const grid = [];
    for (let i = 1; i <= Math.max(35, daysInMonth); i++) {
      if (i > daysInMonth) {
        grid.push({ day: i, isGhost: true });
        continue;
      }

      const dateObj = new Date(currentYear, currentMonth, i);
      const dateStr = dateObj.toISOString().split('T')[0];
      const record = getRecord(dateStr);
      const isToday = dateStr === todayStr;

      let bg = isDark ? '#333' : '#f3f4f6';
      if (record?.prayerDone && record.prayerEmotion) {
        const e = EMOTIONS.find((e) => e.id === record.prayerEmotion);
        if (e) bg = e.color;
      }

      grid.push({
        day: i,
        isGhost: false,
        bg,
        isToday,
      });
    }
    return grid;
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? '#101422' : '#fdfbf7' },
      ]}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <PressableFeedback
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <MaterialIcons
            name="arrow-back"
            size={24}
            color={isDark ? '#fff' : '#334155'}
          />
        </PressableFeedback>
        <Text
          style={[styles.headerTitle, { color: isDark ? '#fff' : '#334155' }]}
        >
          Mi Rato de Oración
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Emotion Selector */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              { color: isDark ? '#fff' : '#334155' },
            ]}
          >
            ¿Cómo te sientes hoy?
          </Text>
          <View style={styles.emotionRow}>
            {EMOTIONS.map((emo) => {
              const isSelected = emotion === emo.id;
              return (
                <PressableFeedback
                  key={emo.id}
                  onPress={() => setEmotion(emo.id)}
                  style={[
                    styles.emotionItem,
                    !isSelected && styles.emotionItemInactive,
                  ]}
                >
                  <View
                    style={[
                      styles.emotionCircle,
                      { backgroundColor: emo.color },
                      isSelected && {
                        borderColor: '#0f32bd',
                        borderWidth: 2,
                        transform: [{ scale: 1.1 }],
                      },
                    ]}
                  >
                    <MaterialIcons
                      name={emo.icon as any}
                      size={28}
                      color={emo.iconColor}
                    />
                  </View>
                  <Text
                    style={[
                      styles.emotionLabel,
                      { color: isDark ? '#ccc' : '#334155' },
                    ]}
                  >
                    {emo.label}
                  </Text>
                </PressableFeedback>
              );
            })}
          </View>
        </View>

        {/* Duration Input */}
        <View style={styles.durationWrapper}>
          <View
            style={[
              styles.durationCard,
              {
                backgroundColor: emotion
                  ? hexAlpha(
                      EMOTIONS.find((e) => e.id === emotion)?.color || '#fff',
                      '15',
                    )
                  : isDark
                    ? '#1a1d2e'
                    : '#ffffff',
              },
            ]}
          >
            <Text style={styles.durationLabel}>Tiempo de Oración</Text>
            <View style={styles.durationControls}>
              <PressableFeedback
                onPress={handleDecrease}
                style={styles.durationBtn}
              >
                <MaterialIcons name="remove" size={28} color="#0f32bd" />
              </PressableFeedback>
              <View style={styles.durationValueRow}>
                <Text
                  style={[
                    styles.durationValue,
                    { color: isDark ? '#fff' : '#334155' },
                  ]}
                >
                  {duration}
                </Text>
                <Text
                  style={[
                    styles.durationUnit,
                    { color: isDark ? '#94a3b8' : '#94a3b8' },
                  ]}
                >
                  min
                </Text>
              </View>
              <PressableFeedback
                onPress={handleIncrease}
                style={styles.durationBtn}
              >
                <MaterialIcons name="add" size={28} color="#0f32bd" />
              </PressableFeedback>
            </View>
          </View>
        </View>

        {/* Save Button */}
        <Button onPress={handleSave} style={styles.saveBtn}>
          <Button.Label style={styles.saveBtnText}>Guardar</Button.Label>
        </Button>

        {/* Consistency Grid */}
        <View style={styles.consistencySection}>
          <Text
            style={[
              styles.consistencyTitle,
              { color: isDark ? '#fff' : '#334155' },
            ]}
          >
            Tu mes de consistencia
          </Text>
          <View
            style={[
              styles.consistencyCard,
              { backgroundColor: isDark ? '#1a1d2e' : '#ffffff' },
            ]}
          >
            <View style={styles.grid}>
              {getConsistencyGrid().map((item, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.gridDot,
                    { backgroundColor: item.bg, opacity: item.isGhost ? 0 : 1 },
                    item.isToday && styles.gridDotToday,
                  ]}
                />
              ))}
            </View>
            <View style={styles.gridLabels}>
              <Text style={styles.gridLabelText}>1 de Nov</Text>
              <Text style={styles.gridLabelText}>30 de Nov</Text>
            </View>
          </View>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(150,150,150,0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  section: {
    marginTop: 16,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  emotionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  emotionItem: {
    alignItems: 'center',
    gap: 8,
  },
  emotionItemInactive: {
    opacity: 0.4,
  },
  emotionCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  emotionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  durationWrapper: {
    marginBottom: 32,
  },
  durationCard: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    ...shadows.sm,
  },
  durationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 24,
  },
  durationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
  },
  durationBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(150,150,150,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  durationValue: {
    fontSize: 64,
    fontWeight: '800',
    lineHeight: 70,
  },
  durationUnit: {
    fontSize: 20,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#0f32bd',
    borderRadius: 100,
    paddingVertical: 16,
    marginBottom: 32,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  consistencySection: {
    marginBottom: 16,
  },
  consistencyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  consistencyCard: {
    borderRadius: 24,
    padding: 24,
    ...shadows.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  gridDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  gridDotToday: {
    borderWidth: 2,
    borderColor: '#0f32bd',
    transform: [{ scale: 1.25 }],
  },
  gridLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    paddingHorizontal: 8,
  },
  gridLabelText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94a3b8',
  },
});
