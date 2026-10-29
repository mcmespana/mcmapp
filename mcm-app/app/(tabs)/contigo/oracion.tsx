import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { h } from '@/utils/haptics';
import { useContigoHabits, Emotion } from '@/hooks/useContigoHabits';
import colors, { Colors } from '@/constants/colors';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  withSpring,
} from 'react-native-reanimated';
import { useTabScroll } from '@/components/tabs/useTabScroll';
import { useColorScheme } from '@/hooks/useColorScheme';
import { hexAlpha } from '@/utils/colorUtils';
import { getLiturgicalInfo } from '@/components/contigo/LiturgicalBadge';
import { CelebrationAnimation } from '@/components/contigo/CelebrationAnimation';
import { DateNavigator } from '@/components/contigo/DateNavigator';
import { styles } from '@/components/contigo/oracionStyles';
import { HABITS, WARM_DARK, WARM_LIGHT } from '@/components/contigo/theme';
import {
  contigoHeaderChrome,
  useContigoHeaderInset,
} from '@/components/contigo/headerChrome';
import { radii } from '@/constants/uiStyles';
import { springs } from '@/constants/animations';
import { useSuppressCarismochito } from '@/hooks/useSuppressCarismochito';
import { useRepeatPress } from '@/hooks/useRepeatPress';
import {
  PRAYER_DEFAULT_MINUTES,
  lastPrayerMinutes,
  prayerCalendarCellSize,
  prayerDurationEnum,
  stepPrayerMinutes,
} from '@/utils/contigoPrayer';

// ── Screen geometry ──
// Cap at MAX_CONTENT_W so the calendar stays compact on web / wide screens. El
// lado de las celdas se calcula DENTRO de la pantalla con el ancho actual de la
// ventana (`prayerCalendarCellSize`), no una vez al cargar el módulo.
const MAX_CONTENT_W = 500;

// ── Warm palette (aligned with redesign tokens) ──
const WARM = {
  light: {
    accent: WARM_LIGHT.accent,
    accentText: WARM_LIGHT.accentText,
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
    accentText: WARM_DARK.accentText,
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

type WarmPalette = typeof WARM.light | typeof WARM.dark;

/**
 * Una emoción de «¿Cómo ha ido tu oración?». Al elegirla el círculo crece con
 * un muelle sin rebote (el rebote es solo para celebrar) y suena la háptica de
 * selección; con «reducir movimiento» pasa a la escala final directamente.
 * Es una opción de un grupo de selección única: lo dice a los lectores de
 * pantalla.
 */
function EmotionOption({
  emo,
  selected,
  warm,
  onSelect,
}: {
  emo: (typeof EMOTIONS)[number];
  selected: boolean;
  warm: WarmPalette;
  onSelect: (id: Emotion) => void;
}) {
  const reducedMotion = useReducedMotion();
  const target = selected ? 1.1 : 1;
  const circleScale = useAnimatedStyle(() => ({
    transform: [
      { scale: reducedMotion ? target : withSpring(target, springs.settle) },
    ],
  }));
  return (
    <TouchableOpacity
      activeOpacity={0.72}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={emo.label}
      onPress={() => {
        if (!selected) h.select();
        onSelect(emo.id);
      }}
      style={[styles.emotionItem, !selected && styles.emotionDimmed]}
    >
      <Animated.View
        style={[
          styles.emotionCircle,
          { backgroundColor: emo.color },
          selected && {
            borderWidth: 2.5,
            borderColor: warm.accent,
            shadowColor: warm.accent,
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.38,
            shadowRadius: 8,
            elevation: 6,
          },
          circleScale,
        ]}
      >
        <MaterialIcons name={emo.icon as any} size={30} color={emo.iconColor} />
      </Animated.View>
      <Text
        style={[
          styles.emotionLabel,
          {
            color: selected ? warm.accentText : warm.warmGray,
            fontWeight: selected ? '700' : '500',
          },
        ]}
      >
        {emo.label}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Botón de más/menos del paso a paso de minutos: un toque da un paso de cinco y
 * mantenerlo pulsado repite hasta soltar o llegar al tope.
 */
function StepperButton({
  icon,
  label,
  onStep,
  color,
  style,
}: {
  icon: 'add' | 'remove';
  label: string;
  onStep: () => boolean;
  color: string;
  style: React.ComponentProps<typeof PressableFeedback>['style'];
}) {
  const press = useRepeatPress(onStep);
  return (
    <PressableFeedback
      {...press}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={style}
    >
      <MaterialIcons name={icon} size={26} color={color} />
    </PressableFeedback>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function OracionScreen() {
  useSuppressCarismochito();
  // Subruta de Contigo: se registra con la clave del tab (gana el último
  // montado), así el re-tap sube el scroll de la pantalla que se está viendo.
  const { scrollRef, onScroll, contentPaddingBottom } = useTabScroll('contigo');
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const headerInset = useContigoHeaderInset();
  const theme = Colors[scheme ?? 'light'];
  const warm = isDark ? WARM.dark : WARM.light;

  const { setPrayerDone, todayStr, getRecord, records } = useContigoHabits();
  const { width: windowWidth } = useWindowDimensions();
  const cellSize = prayerCalendarCellSize(windowWidth, MAX_CONTENT_W);

  const params = useLocalSearchParams<{ date?: string }>();
  const initialDate = useMemo(() => {
    // Un enlace a un día futuro se queda en hoy: no se apunta oración por
    // adelantado (las flechas y el calendario tampoco dejan).
    if (params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
      return todayStr && params.date > todayStr ? todayStr : params.date;
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

  // El paso a paso («Personalizado») arranca en la última duración que se
  // apuntó, no en un 15 fijo.
  const startMinutes = useMemo(
    () => lastPrayerMinutes(records) ?? PRAYER_DEFAULT_MINUTES,
    [records],
  );

  // Con la pulsación mantenida los pasos llegan más rápido de lo que React
  // vuelve a pintar, así que el valor vigente se lleva también en una ref: dos
  // pasos seguidos parten cada uno del resultado del anterior.
  const durationRef = useRef(duration);
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  /** Un paso de cinco minutos. `false` = tope: el hook deja de repetir. */
  const nudgeDuration = (direction: 1 | -1): boolean => {
    const current = durationRef.current ?? startMinutes;
    const next = stepPrayerMinutes(current, direction);
    if (next === current) {
      h.limit();
      return false;
    }
    durationRef.current = next;
    setDuration(next);
    h.select();
    return true;
  };

  // El calendario «Tu mes» navega por meses sin mover el día elegido. Sigue al
  // día elegido cuando este cambia de mes (con las flechas de arriba).
  const [calMonth, setCalMonth] = useState(selectedDate.slice(0, 7));
  const [calFollows, setCalFollows] = useState(selectedDate);
  if (calFollows !== selectedDate) {
    setCalFollows(selectedDate);
    setCalMonth(selectedDate.slice(0, 7));
  }
  const canGoNextMonth = calMonth < todayStr.slice(0, 7);
  const changeCalMonth = (delta: number) => {
    const [y, m] = calMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (key > todayStr.slice(0, 7)) return;
    setCalMonth(key);
  };

  /** Elegir un día en el calendario: el formulario está arriba, se sube a él. */
  const pickCalendarDay = (ds: string) => {
    if (ds > todayStr) return;
    setSelectedDate(ds);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleSave = async () => {
    // El botón ya está apagado sin tiempo (y avisa debajo de «Tiempo
    // dedicado»); esto es solo la guardia. Un Alert aquí no se veía en web.
    if (!duration) return;

    await setPrayerDone(
      selectedDate,
      prayerDurationEnum(duration),
      emotion,
      duration,
    );

    h.formSuccess();

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
  const calData = useMemo(() => buildCalendar(`${calMonth}-01`), [calMonth]);
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
          ...contigoHeaderChrome(isDark),
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
            // así que reservamos su altura real.
            paddingTop: headerInset,
            maxWidth: MAX_CONTENT_W,
            width: '100%',
            alignSelf: 'center',
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Navegador de días (común a las tres pantallas de Contigo) ── */}
        {/* No se apunta oración en el futuro: «siguiente» se para en hoy. */}
        <DateNavigator
          date={selectedDate}
          todayStr={todayStr}
          onChange={setSelectedDate}
          maxDate={todayStr}
          tint={liturgicalAccent}
          style={styles.dateNav}
        />

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
            <View
              style={styles.emotionRow}
              accessibilityRole="radiogroup"
              accessibilityLabel="¿Cómo ha ido tu oración?"
            >
              {EMOTIONS.map((emo) => (
                <EmotionOption
                  key={emo.id}
                  emo={emo}
                  selected={emotion === emo.id}
                  warm={warm}
                  onSelect={setEmotion}
                />
              ))}
            </View>
          </View>

          {/* ── Duration picker ── */}
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: warm.surface, borderColor: warm.border },
            ]}
          >
            <Text
              style={[
                styles.sectionLabel,
                { color: warm.warmGray },
                !duration && styles.sectionLabelWithHint,
              ]}
            >
              TIEMPO DEDICADO
            </Text>
            {/* Sin tiempo no se puede guardar: el motivo va junto a la acción
                (un Alert no sale en web y en móvil queda lejos). */}
            {!duration ? (
              <Text style={[styles.durationHint, { color: warm.warmGray }]}>
                Elige cuánto tiempo has rezado para guardar
              </Text>
            ) : null}

            <View
              style={styles.bucketGrid}
              accessibilityRole="radiogroup"
              accessibilityLabel="Tiempo dedicado"
            >
              {DURATION_BUCKETS.map((b) => {
                const isActive = isCustom
                  ? b.id === 'custom'
                  : duration === b.val;
                return (
                  <TouchableOpacity
                    key={b.id}
                    activeOpacity={0.72}
                    accessibilityRole="radio"
                    accessibilityState={{
                      selected: isActive,
                      checked: isActive,
                    }}
                    accessibilityLabel={b.label}
                    onPress={() => {
                      if (!isActive) h.select();
                      if (b.id === 'custom') {
                        setIsCustom(true);
                        if (!duration) setDuration(startMinutes);
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
                  MINUTOS
                </Text>
                <View style={styles.stepperRow}>
                  <StepperButton
                    icon="remove"
                    label="Cinco minutos menos"
                    onStep={() => nudgeDuration(-1)}
                    color={warm.accentText}
                    style={[
                      styles.stepperBtn,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.07)'
                          : 'rgba(0,0,0,0.05)',
                        borderColor: warm.border,
                      },
                    ]}
                  />

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

                  <StepperButton
                    icon="add"
                    label="Cinco minutos más"
                    onStep={() => nudgeDuration(1)}
                    color={warm.accentText}
                    style={[
                      styles.stepperBtn,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.07)'
                          : 'rgba(0,0,0,0.05)',
                        borderColor: warm.border,
                      },
                    ]}
                  />
                </View>
              </View>
            )}
          </View>

          {/* ── Save button ── */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSave}
            disabled={!duration}
            accessibilityRole="button"
            accessibilityState={{ disabled: !duration }}
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
              // Al final: tiene que ganar a la sombra de arriba.
              !duration && styles.saveBtnBlocked,
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
                colors={HABITS.oracion.grad}
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
                <View style={styles.calMonthNav}>
                  <TouchableOpacity
                    onPress={() => changeCalMonth(-1)}
                    hitSlop={10}
                    accessibilityLabel="Mes anterior"
                  >
                    <MaterialIcons
                      name="chevron-left"
                      size={24}
                      color={warm.title}
                    />
                  </TouchableOpacity>
                  <Text style={[styles.calMonthTitle, { color: warm.title }]}>
                    {MONTHS_CAP[month - 1]} {year}
                  </Text>
                  <TouchableOpacity
                    onPress={() => changeCalMonth(1)}
                    disabled={!canGoNextMonth}
                    hitSlop={10}
                    style={{ opacity: canGoNextMonth ? 1 : 0.25 }}
                    accessibilityLabel="Mes siguiente"
                    accessibilityState={{ disabled: !canGoNextMonth }}
                  >
                    <MaterialIcons
                      name="chevron-right"
                      size={24}
                      color={warm.title}
                    />
                  </TouchableOpacity>
                </View>
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
                <MaterialIcons
                  name="favorite"
                  size={12}
                  color={warm.accentText}
                />
                <Text style={[styles.statText, { color: warm.accentText }]}>
                  {prayedThisMonth}{' '}
                  {prayedThisMonth === 1 ? 'día rezado' : 'días rezados'}
                </Text>
              </View>
            </View>

            {/* Weekday headers */}
            <View style={styles.weekdayRow}>
              {WEEKDAYS.map((d) => (
                <View key={d} style={[styles.weekdayCell, { width: cellSize }]}>
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
                      style={{ width: cellSize, height: cellSize }}
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
                    onPress={() => pickCalendarDay(ds)}
                    disabled={isFuture}
                    accessibilityLabel={`${day} de ${MONTHS[month - 1]}${
                      rec?.prayerDone ? ', rezado' : ''
                    }`}
                    style={[
                      styles.calCell,
                      {
                        width: cellSize,
                        height: cellSize,
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
                              ? warm.accentText
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
