import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useContigoHabits, Emotion } from '@/hooks/useContigoHabits';
import colors, { Colors } from '@/constants/colors';
import Animated from 'react-native-reanimated';
import { useTabScroll } from '@/components/tabs/useTabScroll';
import { useColorScheme } from '@/hooks/useColorScheme';
import { hexAlpha } from '@/utils/colorUtils';
import {
  LiturgicalBadge,
  getLiturgicalInfo,
} from '@/components/contigo/LiturgicalBadge';
import { CelebrationAnimation } from '@/components/contigo/CelebrationAnimation';
import { styles } from '@/components/contigo/oracionStyles';
import { WARM_DARK, WARM_LIGHT } from '@/components/contigo/theme';
import { radii } from '@/constants/uiStyles';

// ── Screen geometry ──
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_CONTENT_W = 500;
// Cap at MAX_CONTENT_W so calendar cells stay compact on web / wide screens
const effectiveW = Math.min(SCREEN_WIDTH, MAX_CONTENT_W);
// 7 cells + 6 gaps of 5px, inside card (20px padding each side) inside screen (16px padding each side)
const CELL_SIZE = Math.floor((effectiveW - 72 - 30) / 7);

// ── Warm palette (aligned with redesign tokens) ──
const WARM = {
  light: {
    accent: WARM_LIGHT.accent,
    accentGlow: 'rgba(196,146,42,0.28)',
    bg1: WARM_LIGHT.bg,
    bg2: WARM_LIGHT.bgDeep,
    bg3: '#EDE4D3',
    surface: 'rgba(255,252,245,0.90)',
    border: 'rgba(196,146,42,0.10)',
    borderSubtle: 'rgba(0,0,0,0.06)',
    warmGray: '#7A6E64',
    title: '#3D3225',
  },
  dark: {
    accent: WARM_DARK.accent,
    accentGlow: 'rgba(218,165,32,0.25)',
    bg1: WARM_DARK.bg,
    bg2: '#131210',
    bg3: '#0A0907',
    surface: 'rgba(28,26,23,0.92)',
    border: 'rgba(218,165,32,0.10)',
    borderSubtle: 'rgba(255,255,255,0.07)',
    warmGray: '#A09A94',
    title: WARM_DARK.text,
  },
};

// ── Emotions ──
const EMOTIONS = [
  {
    id: 'joy',
    label: 'Alegría',
    icon: 'sentiment-satisfied',
    color: '#FDE68A',
    iconColor: '#CA8A04',
  },
  {
    id: 'sadness',
    label: 'Tristeza',
    icon: 'sentiment-dissatisfied',
    color: '#BFDBFE',
    iconColor: '#1D4ED8',
  },
  {
    id: 'anger',
    label: 'Enfado',
    icon: 'sentiment-very-dissatisfied',
    color: '#FECACA',
    iconColor: '#B91C1C',
  },
  {
    id: 'fear',
    label: 'Miedo',
    icon: 'mood-bad',
    color: '#E9D5FF',
    iconColor: '#7E22CE',
  },
  {
    id: 'disgust',
    label: 'Disgusto',
    icon: 'sick',
    color: '#BBF7D0',
    iconColor: '#15803D',
  },
] as const;

// ── Duration options ──
const DURATION_BUCKETS = [
  { id: '1', label: '< 2 min', val: 1 },
  { id: '3', label: '2–5 min', val: 3 },
  { id: '8', label: '5–10 min', val: 8 },
  { id: '13', label: '10–15 min', val: 13 },
  { id: '16', label: '+15 min', val: 16 },
  { id: 'custom', label: 'Personalizado', val: 'custom' },
] as const;

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
const MONTHS_CAP = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

// ── Helpers ──
function formatDateDisplay(dateStr: string) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const days = [
    'Domingo',
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
  ];
  return `${days[date.getDay()]}, ${d} de ${MONTHS[m - 1]}`;
}

function addDays(dateStr: string, offset: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + offset);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

/** Returns calendar cells for the month of selectedDate.
 *  null = empty offset slot, number = day of month */
function buildCalendar(selectedDate: string): {
  cells: (number | null)[];
  year: number;
  month: number;
  daysInMonth: number;
} {
  const [y, m] = selectedDate.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDay = new Date(y, m - 1, 1).getDay();
  const offset = (firstDay + 6) % 7; // Monday-first

  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);
  return { cells, year: y, month: m, daysInMonth };
}

/** Duraciones que tienen botón propio; cualquier otra es "personalizada". */
const PRESET_MINUTES = [1, 3, 8, 13, 16];

/**
 * Cómo debe arrancar el formulario para lo que ya hubiera guardado ese día.
 * Se usa tanto al montar la pantalla como al cambiar de día, para que las dos
 * situaciones no puedan separarse.
 */
function prayerFormFor(
  rec:
    | {
        prayerEmotion?: string;
        prayerDone?: boolean;
        prayerDurationMinutes?: number;
      }
    | null
    | undefined,
): {
  emotion: Emotion | null;
  duration: number | null;
  isCustom: boolean;
} {
  const minutes =
    rec?.prayerDone && rec?.prayerDurationMinutes
      ? rec.prayerDurationMinutes
      : null;
  return {
    emotion: (rec?.prayerEmotion as Emotion) || null,
    duration: minutes,
    isCustom: minutes !== null && !PRESET_MINUTES.includes(minutes),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
export default function OracionScreen() {
  // Subruta de Contigo: se registra con la clave del tab (gana el último
  // montado), así el re-tap sube el scroll de la pantalla que se está viendo.
  const { scrollRef, onScroll, contentPaddingBottom } = useTabScroll('contigo');
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  const warm = isDark ? WARM.dark : WARM.light;

  const { setPrayerDone, todayStr, getRecord } = useContigoHabits();

  const params = useLocalSearchParams<{ date?: string }>();
  const initialDate = useMemo(() => {
    if (params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
      return params.date;
    }
    return todayStr || new Date().toISOString().split('T')[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const record = getRecord(selectedDate);
  const liturgicalInfo = getLiturgicalInfo(selectedDate);

  const initialForm = prayerFormFor(record);
  const [emotion, setEmotion] = useState<Emotion | null>(initialForm.emotion);
  const [duration, setDuration] = useState<number | null>(initialForm.duration);
  const [isCustom, setIsCustom] = useState(initialForm.isCustom);
  const [showCheck, setShowCheck] = useState(false);

  // El formulario se rellena con lo ya guardado SOLO al cambiar de día: si se
  // resincronizara en cada render, borraría lo que el usuario está eligiendo.
  // Se ajusta DURANTE el render (el patrón que documenta React para "cambiar
  // estado cuando cambia una prop") en vez de con un efecto, así no hay un
  // render intermedio con el formulario del día anterior.
  const [lastDate, setLastDate] = useState(selectedDate);
  if (selectedDate !== lastDate) {
    setLastDate(selectedDate);
    const next = prayerFormFor(getRecord(selectedDate));
    setEmotion(next.emotion);
    setDuration(next.duration);
    setIsCustom(next.isCustom);
  }

  const handleDecrease = () => setDuration((p) => Math.max(1, (p || 15) - 1));
  const handleIncrease = () => setDuration((p) => Math.min(120, (p || 15) + 1));

  const changeDate = (offset: number) =>
    setSelectedDate(addDays(selectedDate, offset));

  const handleSave = async () => {
    if (!duration) {
      Alert.alert(
        'Tiempo requerido',
        'Selecciona o anota el tiempo dedicado a tu rato de oración.',
      );
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
      setTimeout(
        () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
        100,
      );
      setTimeout(
        () =>
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
        250,
      );
    }

    setShowCheck(true);
    setTimeout(() => setShowCheck(false), 2800);
  };

  const liturgicalAccent =
    liturgicalInfo.hex === '#F5F5F5'
      ? isDark
        ? '#888888'
        : '#999999'
      : liturgicalInfo.hex;

  // Calendar data
  const calData = useMemo(() => buildCalendar(selectedDate), [selectedDate]);
  const { cells, year, month, daysInMonth } = calData;

  // Count days prayed this month (fast, no memo needed)
  let prayedThisMonth = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (getRecord(ds)?.prayerDone) prayedThisMonth++;
  }

  const bgColors = isDark
    ? ([warm.bg1, warm.bg2, warm.bg3] as const)
    : ([warm.bg1, warm.bg2, warm.bg3] as const);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Header NATIVO: back button del sistema (con el efecto "gota" de iOS)
          + título. Sustituye al antiguo floating header custom. headerTransparent
          deja ver el degradado cálido; en iOS<26 el blur replica el efecto
          esmerilado que tenía la barra flotante. */}
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: 'Mi Rato de Oración',
          headerTransparent: true,
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
          headerTintColor: warm.title,
          headerTitleStyle: {
            color: warm.title,
            fontWeight: '700',
            fontSize: 17,
          },
          ...(Platform.OS === 'ios' &&
          parseInt(String(Platform.Version), 10) < 26
            ? { headerBlurEffect: 'systemChromeMaterial' as const }
            : {}),
        }}
      />

      {/* Warm gradient background */}
      <LinearGradient
        colors={bgColors}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        pointerEvents="none"
      />

      {/* ── Scroll content ── */}
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: contentPaddingBottom },
          {
            // El header nativo es transparente y flota sobre el contenido,
            // así que reservamos su altura (≈44 iOS / 56 Android + safe-area).
            paddingTop: insets.top + (Platform.OS === 'android' ? 68 : 56),
            maxWidth: MAX_CONTENT_W,
            width: '100%',
            alignSelf: 'center',
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Date navigation ── */}
        <View
          style={[
            styles.dateNavCard,
            {
              backgroundColor: isDark
                ? hexAlpha(liturgicalAccent, '12')
                : hexAlpha(liturgicalAccent, '09'),
              borderColor: isDark
                ? 'rgba(255,255,255,0.05)'
                : 'rgba(0,0,0,0.05)',
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => changeDate(-1)}
            style={[
              styles.navBtn,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.09)'
                  : 'rgba(0,0,0,0.06)',
              },
            ]}
            accessibilityLabel="Día anterior"
          >
            <MaterialIcons name="chevron-left" size={26} color={theme.text} />
          </TouchableOpacity>

          <View style={styles.dateCenter}>
            <Text style={[styles.dateText, { color: theme.text }]}>
              {formatDateDisplay(selectedDate)}
            </Text>
            <View style={{ marginTop: 8 }}>
              <LiturgicalBadge dateStr={selectedDate} />
            </View>
          </View>

          <TouchableOpacity
            onPress={() => changeDate(1)}
            style={[
              styles.navBtn,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.09)'
                  : 'rgba(0,0,0,0.06)',
              },
            ]}
            accessibilityLabel="Día siguiente"
          >
            <MaterialIcons name="chevron-right" size={26} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* ── Completed banner ── */}
        {record?.prayerDone && (
          <View
            style={[
              styles.completedBanner,
              {
                backgroundColor: isDark
                  ? 'rgba(163,189,49,0.10)'
                  : 'rgba(58,125,68,0.07)',
                borderColor: isDark
                  ? 'rgba(163,189,49,0.22)'
                  : 'rgba(58,125,68,0.16)',
              },
            ]}
          >
            <MaterialIcons
              name="check-circle"
              size={15}
              color={isDark ? colors.green : WARM_LIGHT.green}
            />
            <Text
              style={[
                styles.completedText,
                { color: isDark ? colors.green : WARM_LIGHT.green },
              ]}
            >
              Día completado — puedes modificar tu registro
            </Text>
          </View>
        )}

        {/* ── Sections ── */}
        <View style={styles.sectionsStack}>
          {/* ── Emotion selector ── */}
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: warm.surface, borderColor: warm.border },
            ]}
          >
            <Text style={[styles.sectionLabel, { color: warm.warmGray }]}>
              ¿CÓMO HA IDO TU ORACIÓN?
            </Text>
            <View style={styles.emotionRow}>
              {EMOTIONS.map((emo) => {
                const isSelected = emotion === emo.id;
                return (
                  <TouchableOpacity
                    key={emo.id}
                    activeOpacity={0.72}
                    onPress={() => setEmotion(emo.id)}
                    style={[
                      styles.emotionItem,
                      !isSelected && styles.emotionDimmed,
                    ]}
                  >
                    <View
                      style={[
                        styles.emotionCircle,
                        { backgroundColor: emo.color },
                        isSelected && {
                          borderWidth: 2.5,
                          borderColor: warm.accent,
                          transform: [{ scale: 1.1 }],
                          shadowColor: warm.accent,
                          shadowOffset: { width: 0, height: 3 },
                          shadowOpacity: 0.38,
                          shadowRadius: 8,
                          elevation: 6,
                        },
                      ]}
                    >
                      <MaterialIcons
                        name={emo.icon as any}
                        size={30}
                        color={emo.iconColor}
                      />
                    </View>
                    <Text
                      style={[
                        styles.emotionLabel,
                        {
                          color: isSelected ? warm.accent : warm.warmGray,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {emo.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Duration picker ── */}
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: warm.surface, borderColor: warm.border },
            ]}
          >
            <Text style={[styles.sectionLabel, { color: warm.warmGray }]}>
              TIEMPO DEDICADO
            </Text>

            <View style={styles.bucketGrid}>
              {DURATION_BUCKETS.map((b) => {
                const isActive = isCustom
                  ? b.id === 'custom'
                  : duration === b.val;
                return (
                  <TouchableOpacity
                    key={b.id}
                    activeOpacity={0.72}
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
                      styles.bucketPill,
                      {
                        backgroundColor: isActive ? warm.accent : 'transparent',
                        borderColor: isActive
                          ? warm.accent
                          : isDark
                            ? 'rgba(255,255,255,0.11)'
                            : 'rgba(0,0,0,0.09)',
                        shadowColor: isActive ? warm.accent : 'transparent',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: isActive ? 0.32 : 0,
                        shadowRadius: 6,
                        elevation: isActive ? 3 : 0,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.bucketText,
                        {
                          color: isActive
                            ? '#FFFFFF'
                            : isDark
                              ? '#C0B8AF'
                              : warm.warmGray,
                          fontWeight: isActive ? '700' : '500',
                        },
                      ]}
                    >
                      {b.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom duration stepper */}
            {isCustom && (
              <View
                style={[
                  styles.customCard,
                  {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.025)',
                    borderColor: warm.border,
                  },
                ]}
              >
                <Text style={[styles.customLabel, { color: warm.warmGray }]}>
                  MINUTOS EXACTOS
                </Text>
                <View style={styles.stepperRow}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleDecrease}
                    style={[
                      styles.stepperBtn,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.07)'
                          : 'rgba(0,0,0,0.05)',
                        borderColor: warm.border,
                      },
                    ]}
                  >
                    <MaterialIcons
                      name="remove"
                      size={26}
                      color={warm.accent}
                    />
                  </TouchableOpacity>

                  <View style={styles.stepperValueRow}>
                    <Text style={[styles.stepperNumber, { color: theme.text }]}>
                      {duration}
                    </Text>
                    <Text
                      style={[styles.stepperUnit, { color: warm.warmGray }]}
                    >
                      min
                    </Text>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleIncrease}
                    style={[
                      styles.stepperBtn,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.07)'
                          : 'rgba(0,0,0,0.05)',
                        borderColor: warm.border,
                      },
                    ]}
                  >
                    <MaterialIcons name="add" size={26} color={warm.accent} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* ── Save button ── */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSave}
            style={[
              styles.saveBtnWrap,
              record?.prayerDone
                ? {
                    backgroundColor: isDark
                      ? 'rgba(163,189,49,0.09)'
                      : 'rgba(58,125,68,0.07)',
                    borderWidth: 1.5,
                    borderColor: isDark
                      ? 'rgba(163,189,49,0.28)'
                      : 'rgba(58,125,68,0.20)',
                  }
                : {
                    shadowColor: warm.accent,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.38,
                    shadowRadius: 14,
                    elevation: 6,
                  },
            ]}
          >
            {record?.prayerDone ? (
              <View style={styles.saveBtnInner}>
                <MaterialIcons
                  name="check-circle"
                  size={22}
                  color={isDark ? colors.green : WARM_LIGHT.green}
                />
                <Text
                  style={[
                    styles.saveBtnText,
                    { color: isDark ? colors.green : WARM_LIGHT.green },
                  ]}
                >
                  Actualizar mi rato de oración
                </Text>
              </View>
            ) : (
              <LinearGradient
                colors={['#E8A838', WARM_LIGHT.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.saveBtnGradient}
              >
                <MaterialIcons name="favorite" size={22} color="#FFFFFF" />
                <Text style={[styles.saveBtnText, { color: '#FFFFFF' }]}>
                  Guardar rato de oración
                </Text>
              </LinearGradient>
            )}
          </TouchableOpacity>

          {/* ── Monthly calendar ── */}
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: warm.surface, borderColor: warm.border },
            ]}
          >
            {/* Calendar header */}
            <View style={styles.calHeader}>
              <View>
                <Text style={[styles.sectionLabel, { color: warm.warmGray }]}>
                  TU MES
                </Text>
                <Text style={[styles.calMonthTitle, { color: warm.title }]}>
                  {MONTHS_CAP[month - 1]} {year}
                </Text>
              </View>
              <View
                style={[
                  styles.statBadge,
                  {
                    backgroundColor: isDark
                      ? hexAlpha(warm.accent, '18')
                      : hexAlpha(warm.accent, '12'),
                  },
                ]}
              >
                <MaterialIcons name="favorite" size={12} color={warm.accent} />
                <Text style={[styles.statText, { color: warm.accent }]}>
                  {prayedThisMonth}{' '}
                  {prayedThisMonth === 1 ? 'día rezado' : 'días rezados'}
                </Text>
              </View>
            </View>

            {/* Weekday headers */}
            <View style={styles.weekdayRow}>
              {WEEKDAYS.map((d) => (
                <View
                  key={d}
                  style={[styles.weekdayCell, { width: CELL_SIZE }]}
                >
                  <Text style={[styles.weekdayText, { color: warm.warmGray }]}>
                    {d}
                  </Text>
                </View>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={styles.calGrid}>
              {cells.map((day, idx) => {
                // Empty offset slot
                if (day === null) {
                  return (
                    <View
                      key={`e${idx}`}
                      style={{ width: CELL_SIZE, height: CELL_SIZE }}
                    />
                  );
                }

                const ds = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const rec = getRecord(ds);
                const isToday = ds === todayStr;
                const isSelected = ds === selectedDate && !isToday;
                const isFuture = ds > todayStr;

                const emotionColor =
                  rec?.prayerDone && rec?.prayerEmotion
                    ? EMOTIONS.find((e) => e.id === rec.prayerEmotion)?.color
                    : null;

                let cellBg = 'transparent';
                if (rec?.prayerDone) {
                  cellBg = emotionColor || hexAlpha(warm.accent, '32');
                } else if (!isFuture) {
                  cellBg = isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.04)';
                }

                return (
                  <TouchableOpacity
                    key={ds}
                    activeOpacity={0.7}
                    onPress={() => setSelectedDate(ds)}
                    style={[
                      styles.calCell,
                      {
                        width: CELL_SIZE,
                        height: CELL_SIZE,
                        borderRadius: radii.sm,
                        backgroundColor: cellBg,
                        borderWidth: isToday ? 2 : isSelected ? 1.5 : 0,
                        borderColor: isToday
                          ? warm.accent
                          : isSelected
                            ? isDark
                              ? 'rgba(255,255,255,0.28)'
                              : 'rgba(0,0,0,0.20)'
                            : 'transparent',
                        opacity: isFuture ? 0.22 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        rec?.prayerDone ? styles.calDayDone : styles.calDay,
                        {
                          color: rec?.prayerDone
                            ? isDark
                              ? '#2D2008'
                              : '#3D3225'
                            : isToday
                              ? warm.accent
                              : isFuture
                                ? isDark
                                  ? 'rgba(255,255,255,0.3)'
                                  : 'rgba(0,0,0,0.22)'
                                : isDark
                                  ? 'rgba(255,255,255,0.55)'
                                  : 'rgba(0,0,0,0.45)',
                          fontWeight:
                            isToday || rec?.prayerDone ? '700' : '400',
                        },
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Emotion legend */}
            <View
              style={[
                styles.legendWrap,
                {
                  borderTopColor: isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(0,0,0,0.05)',
                },
              ]}
            >
              {EMOTIONS.map((emo) => (
                <View key={emo.id} style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: emo.color }]}
                  />
                  <Text style={[styles.legendText, { color: warm.warmGray }]}>
                    {emo.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Animated.ScrollView>

      {/* Celebration overlay */}
      <CelebrationAnimation visible={showCheck} isDark={isDark} />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
