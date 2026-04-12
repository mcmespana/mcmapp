import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, TouchableOpacity, Animated, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from 'heroui-native';
import * as Haptics from 'expo-haptics';
import { useContigoHabits, Emotion } from '@/hooks/useContigoHabits';
import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { radii, shadows } from '@/constants/uiStyles';
import { hexAlpha } from '@/utils/colorUtils';
import { LiturgicalBadge, getLiturgicalInfo } from '@/components/contigo/LiturgicalBadge';
import { CelebrationAnimation } from '@/components/contigo/CelebrationAnimation';

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

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const DURATION_BUCKETS = [
  { id: '1', label: '< 2 min', val: 1 },
  { id: '3', label: '2-5 min', val: 3 },
  { id: '8', label: '5-10 min', val: 8 },
  { id: '13', label: '10-15 min', val: 13 },
  { id: '16', label: '+15 min', val: 16 },
  { id: 'custom', label: 'Personalizado', val: 'custom' },
] as const;

function formatDateDisplay(dateStr: string) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return `${days[date.getDay()]}, ${d} de ${MONTHS[m - 1]}`;
}

function addDays(dateStr: string, offset: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + offset);
  const ny = date.getFullYear();
  const nm = String(date.getMonth() + 1).padStart(2, '0');
  const nd = String(date.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

export default function OracionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  const warm = isDark ? WARM.dark : WARM.light;

  const { setPrayerDone, todayStr, getRecord } = useContigoHabits();

  const [selectedDate, setSelectedDate] = useState(
    todayStr || new Date().toISOString().split('T')[0],
  );

  const record = getRecord(selectedDate);
  const liturgicalInfo = getLiturgicalInfo(selectedDate);

  const [emotion, setEmotion] = useState<Emotion | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [showCheck, setShowCheck] = useState(false);

  useEffect(() => {
    const currRecord = getRecord(selectedDate);
    setEmotion(currRecord?.prayerEmotion || null);
    
    if (currRecord?.prayerDone && currRecord?.prayerDurationMinutes) {
      setDuration(currRecord.prayerDurationMinutes);
      setIsCustom(![1, 3, 8, 13, 16].includes(currRecord.prayerDurationMinutes));
    } else {
      setDuration(null);
      setIsCustom(false);
    }
  }, [selectedDate, getRecord]);

  const handleDecrease = () => {
    setDuration((prev) => {
      const val = prev || 15;
      return val > 1 ? val - 1 : 1;
    });
  };

  const handleIncrease = () => {
    setDuration((prev) => {
      const val = prev || 15;
      return val < 120 ? val + 1 : 120;
    });
  };

  const changeDate = (offset: number) => {
    setSelectedDate(addDays(selectedDate, offset));
  };

  const handleSave = async () => {
    if (!duration) {
      Alert.alert('Tiempo requerido', 'Por favor, selecciona o anota el tiempo dedicado a tu rato de oración.');
      return;
    }

    let durationEnum: any = 'more_than_15';
    if (duration < 1) durationEnum = 'less_than_1';
    else if (duration <= 4) durationEnum = '2_to_4';
    else if (duration <= 10) durationEnum = '5_to_10';
    else if (duration <= 15) durationEnum = '10_to_15';

    await setPrayerDone(selectedDate, durationEnum, emotion, duration);

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 100);
      setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 250);
    }

    setShowCheck(true);
    setTimeout(() => {
      setShowCheck(false);
    }, 2000);
  };

  const getConsistencyGrid = () => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const targetDate = new Date(y, m - 1, d);
    const currentMonth = targetDate.getMonth();
    const currentYear = targetDate.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const grid = [];
    for (let i = 1; i <= Math.max(35, daysInMonth); i++) {
      if (i > daysInMonth) {
        grid.push({ day: i, isGhost: true });
        continue;
      }

      const dateObj = new Date(currentYear, currentMonth, i);
      const dateStr = dateObj.toISOString().split('T')[0];
      const dayRecord = getRecord(dateStr);
      const isSelectedDay = dateStr === selectedDate;

      let bg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
      if (dayRecord?.prayerDone && dayRecord.prayerEmotion) {
        const e = EMOTIONS.find((e) => e.id === dayRecord.prayerEmotion);
        if (e) bg = e.color;
      }

      grid.push({
        day: i,
        isGhost: false,
        bg,
        isSelectedDay,
      });
    }
    return { grid, monthIdx: currentMonth };
  };

  const liturgicalAccent =
    liturgicalInfo.hex === '#F5F5F5'
      ? isDark
        ? '#888888'
        : '#999999'
      : liturgicalInfo.hex;

  const monthGridData = getConsistencyGrid();

  return (
    <View style={[styles.container, { backgroundColor: warm.surface }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Floating Header */}
      <View
        pointerEvents="box-none"
        style={[
          styles.floatingHeader,
          {
            paddingTop: Math.max(insets.top, 16),
            backgroundColor: isDark
              ? 'rgba(28, 26, 23, 0.85)'
              : 'rgba(254, 251, 245, 0.85)',
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={[
            styles.frostedBtn,
            {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.05)',
            },
          ]}
        >
          <MaterialIcons name="arrow-back-ios-new" size={20} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Mi Rato de Oración
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 80 }]}>
        {/* Navigation */}
        <View
          style={[
            styles.dateNav,
            {
              backgroundColor: isDark
                ? hexAlpha(liturgicalAccent, '10')
                : hexAlpha(liturgicalAccent, '08'),
              borderColor: isDark
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(0,0,0,0.04)',
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => changeDate(-1)}
            style={[
              styles.dateNavBtn,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
            ]}
          >
            <MaterialIcons name="chevron-left" size={26} color={theme.text} />
          </TouchableOpacity>

          <View style={styles.dateDisplay}>
            <Text style={[styles.dateText, { color: theme.text }]}>
              {formatDateDisplay(selectedDate)}
            </Text>
            <View style={styles.badgeRow}>
              <LiturgicalBadge dateStr={selectedDate} />
            </View>
          </View>

          <TouchableOpacity
            onPress={() => changeDate(1)}
            style={[
              styles.dateNavBtn,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
            ]}
          >
            <MaterialIcons name="chevron-right" size={26} color={theme.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.mainContent}>
          {record?.prayerDone && (
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={{ backgroundColor: isDark ? 'rgba(163,189,49,0.15)' : 'rgba(58,125,68,0.1)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 100 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: isDark ? '#A3BD31' : '#3A7D44' }}>
                  Día completado. Puedes modificar tu registro.
                </Text>
              </View>
            </View>
          )}

          {/* Emotion */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              ¿Cómo te sientes hoy?
            </Text>
            <View style={styles.emotionRow}>
              {EMOTIONS.map((emo) => {
                const isSelected = emotion === emo.id;
                return (
                  <TouchableOpacity activeOpacity={0.7}
                    key={emo.id}
                    onPress={() => setEmotion(emo.id)}
                    style={[styles.emotionItem, !isSelected && styles.emotionItemInactive]}
                  >
                    <View
                      style={[
                        styles.emotionCircle,
                        { backgroundColor: emo.color },
                        isSelected && {
                          borderColor: warm.accent,
                          borderWidth: 2,
                          transform: [{ scale: 1.15 }],
                        },
                      ]}
                    >
                      <MaterialIcons name={emo.icon as any} size={28} color={emo.iconColor} />
                    </View>
                    <Text style={[styles.emotionLabel, { color: isDark ? '#ccc' : warm.warmGray }]}>
                      {emo.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Time */}
          <View style={styles.durationWrapper}>
            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 16 }]}>
              Tiempo dedicado
            </Text>
            <View style={styles.bucketRow}>
              {DURATION_BUCKETS.map((b) => {
                const isActive = isCustom ? b.id === 'custom' : duration === b.val;
                return (
                  <TouchableOpacity
                    key={b.id}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (b.id === 'custom') {
                        setIsCustom(true);
                        if (!duration) setDuration(15);
                      } else {
                        setIsCustom(false);
                        setDuration(b.val as number);
                      }
                    }}
                    style={[
                      styles.bucketItem,
                      { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
                      isActive && { backgroundColor: warm.accent, borderColor: warm.accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.bucketText,
                        { color: isDark ? '#ccc' : warm.warmGray },
                        isActive && { color: '#FFFFFF', fontWeight: '700' },
                      ]}
                    >
                      {b.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {isCustom && (
              <View
                style={[
                  styles.durationCard,
                  {
                    marginTop: 16,
                    backgroundColor: emotion
                      ? hexAlpha(EMOTIONS.find((e) => e.id === emotion)?.color || warm.accent, '15')
                      : isDark
                        ? 'rgba(255,255,255,0.03)'
                        : 'rgba(0,0,0,0.02)',
                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  },
                ]}
              >
                <Text style={styles.durationLabel}>Minutos exactos</Text>
                <View style={styles.durationControls}>
                  <TouchableOpacity activeOpacity={0.7} onPress={handleDecrease} style={styles.durationBtn}>
                    <MaterialIcons name="remove" size={28} color={warm.accent} />
                  </TouchableOpacity>
                  <View style={styles.durationValueRow}>
                    <Text style={[styles.durationValue, { color: theme.text }]}>{duration}</Text>
                    <Text style={[styles.durationUnit, { color: warm.warmGray }]}>min</Text>
                  </View>
                  <TouchableOpacity activeOpacity={0.7} onPress={handleIncrease} style={styles.durationBtn}>
                    <MaterialIcons name="add" size={28} color={warm.accent} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Save Button */}
          <View style={styles.trackerContainer}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSave}
              style={[
                styles.trackerBtn,
                record?.prayerDone
                  ? {
                      backgroundColor: isDark ? 'rgba(163,189,49,0.12)' : 'rgba(58,125,68,0.08)',
                      borderColor: isDark ? 'rgba(163,189,49,0.25)' : 'rgba(58,125,68,0.18)',
                      borderWidth: 1,
                    }
                  : { backgroundColor: warm.accent },
              ]}
            >
              <View style={styles.trackerContent}>
                <MaterialIcons
                  name={record?.prayerDone ? 'check-circle' : 'favorite'}
                  size={22}
                  color={record?.prayerDone ? (isDark ? '#A3BD31' : '#3A7D44') : '#FFFFFF'}
                />
                <Text
                  style={[
                    styles.trackerText,
                    record?.prayerDone
                      ? { color: isDark ? '#A3BD31' : '#3A7D44' }
                      : { color: '#FFFFFF' },
                  ]}
                >
                  {record?.prayerDone ? '¡Actualizar mi Rato de oración!' : 'Guardar Rato de Oración'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Grid */}
          <View style={styles.consistencySection}>
            <Text style={[styles.consistencyTitle, { color: theme.text }]}>Resumen del mes</Text>
            <View
              style={[
                styles.consistencyCard,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                },
              ]}
            >
              <View style={styles.grid}>
                {monthGridData.grid.map((item, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.gridDot,
                      { backgroundColor: item.bg, opacity: item.isGhost ? 0 : 1 },
                      item.isSelectedDay && [styles.gridDotToday, { borderColor: warm.accent }],
                    ]}
                  />
                ))}
              </View>
              <View style={styles.gridLabels}>
                <Text style={styles.gridLabelText}>1 de {MONTHS[monthGridData.monthIdx]}</Text>
                <Text style={styles.gridLabelText}>Fin de {MONTHS[monthGridData.monthIdx]}</Text>
              </View>
            </View>
          </View>

        </View>
      </ScrollView>

      {/* Celebration burst animation */}
      <CelebrationAnimation visible={showCheck} isDark={isDark} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 50,
  },
  frostedBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    paddingBottom: 80,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderWidth: 1,
    borderRadius: radii.xl,
    marginHorizontal: 16,
    marginBottom: 24,
    ...shadows.sm,
  },
  dateNavBtn: {
    padding: 10,
    borderRadius: 14,
  },
  dateDisplay: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    textTransform: 'capitalize',
    textAlign: 'center',
  },
  badgeRow: { marginTop: 8 },
  mainContent: { paddingHorizontal: 16 },
  section: { marginBottom: 32 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  emotionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  emotionItem: { alignItems: 'center', gap: 8 },
  emotionItemInactive: { opacity: 0.4 },
  emotionCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  emotionLabel: { fontSize: 12, fontWeight: '600' },
  durationWrapper: { marginBottom: 32 },
  durationCard: {
    borderRadius: radii.xl,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
  },
  durationLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 20,
    color: '#8B7E6E',
  },
  durationControls: { flexDirection: 'row', alignItems: 'center', gap: 32 },
  durationBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(150,150,150,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bucketRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: 8,
  },
  bucketItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  bucketText: {
    fontSize: 14,
    fontWeight: '600',
  },
  durationValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  durationValue: { fontSize: 60, fontWeight: '800', lineHeight: 68 },
  durationUnit: { fontSize: 18, fontWeight: '600' },
  trackerContainer: { marginBottom: 32, alignItems: 'center' },
  trackerBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 100,
    alignItems: 'center',
    ...shadows.sm,
  },
  trackerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  trackerText: { fontSize: 16, fontWeight: '700', marginLeft: 10 },
  consistencySection: { marginBottom: 16 },
  consistencyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, paddingHorizontal: 8 },
  consistencyCard: {
    borderRadius: radii.xl,
    padding: 24,
    borderWidth: 1,
    ...shadows.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  gridDot: { width: 18, height: 18, borderRadius: 9 },
  gridDotToday: { borderWidth: 2, transform: [{ scale: 1.3 }] },
  gridLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, paddingHorizontal: 8 },
  gridLabelText: { fontSize: 12, fontWeight: '500', color: '#94a3b8' },
});
