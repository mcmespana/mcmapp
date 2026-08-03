import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import type { TextStyle } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTabScroll } from '@/components/tabs/useTabScroll';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { h } from '@/utils/haptics';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useContigoHabits } from '@/hooks/useContigoHabits';
import {
  warm,
  offsetDate,
  formatDateLong,
  WARM_DARK,
  WARM_LIGHT,
} from '@/components/contigo/theme';
import { BreathingPhase } from '@/components/contigo/BreathingPhase';
import { CelebrationAnimation } from '@/components/contigo/CelebrationAnimation';
import { useAuth } from '@/contexts/AuthContext';
import {
  syncContigoRevision,
  fetchContigoRevisions,
} from '@/utils/authHelpers';

const REVISION_STORAGE = '@contigo_revision_';

type Mode = 'list' | 'free';

const STEP_NAMES = ['Agradecer', 'Revisar'] as const;

// Tipografía ÚNICA para todo lo que el usuario escribe (los tres campos de los
// dos pasos). Antes la lista de gratitud usaba la fuente del sistema y los
// textos largos serif, así que cada paso se veía de un tipo distinto.
const WRITING_FONT: TextStyle = {
  fontFamily: Platform.OS === 'ios' ? 'Palatino' : 'serif',
  fontSize: 16,
  // Android mete un padding vertical fantasma en TextInput que descuadra el
  // centrado; con esto el texto queda donde toca en ambas plataformas.
  includeFontPadding: false,
};

export default function RevisionScreen() {
  // Subruta de Contigo: se registra con la clave del tab (gana el último
  // montado), así el re-tap sube el scroll de la pantalla que se está viendo.
  const { scrollRef, onScroll } = useTabScroll('contigo');
  // El footer va en el flujo (no flota), así que el hueco de la barra flotante
  // lo reserva ÉL — no el contenido del scroll. Sin esto los botones quedaban
  // justo debajo de las pestañas.
  const tabClearance = useTabBarClearance();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scheme = useColorScheme();
  const { user: authUser } = useAuth();
  const isDark = scheme === 'dark';
  const W = warm(isDark);
  const purple = isDark ? WARM_DARK.purple : WARM_LIGHT.purple;
  const { width: windowWidth } = useWindowDimensions();
  // iPad / large tablet / desktop web — cap content width.
  const isWide = windowWidth >= 720;
  const wideWrapperStyle = isWide
    ? {
        width: '100%' as const,
        maxWidth: windowWidth >= 1100 ? 760 : 640,
        alignSelf: 'center' as const,
      }
    : undefined;

  const params = useLocalSearchParams<{ date?: string }>();
  const { todayStr, setRevisionDone } = useContigoHabits();

  // If we arrive with a `date` param (from the calendar tap), skip the
  // breathing intro and open that day's review directly.
  const initialDate = useMemo(
    () =>
      params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
        ? params.date
        : todayStr,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const cameFromCalendar = !!params.date;

  const [phase, setPhase] = useState<'breathing' | 'review'>(
    cameFromCalendar ? 'review' : 'breathing',
  );
  const [selDate, setSelDate] = useState(initialDate);
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // Step state
  const [mode, setMode] = useState<Mode>('list');
  const [items, setItems] = useState<string[]>(['', '', '']);
  const [singleGrat, setSingleGrat] = useState('');
  const [revText, setRevText] = useState('');

  const totalSteps = 2;

  // Aplica un registro de revisión (local o hidratado de RTDB) al formulario.
  // Mode is read from the saved record (no inference from array shape).
  const applyRevisionData = useCallback((raw: string) => {
    try {
      const data = JSON.parse(raw);
      const savedMode: Mode = data?.grateful?.mode === 'free' ? 'free' : 'list';
      setMode(savedMode);
      const g: string[] = Array.isArray(data?.grateful?.items)
        ? data.grateful.items
        : [];
      if (savedMode === 'free') {
        setSingleGrat(g[0] || '');
        setItems(['', '', '']);
      } else {
        setItems(g.length >= 3 ? g : [...g, ...Array(3 - g.length).fill('')]);
        setSingleGrat('');
      }
      setRevText(data?.grateful?.revision || '');
    } catch {}
  }, []);

  // Carga la entrada guardada del día seleccionado: local primero; si no hay
  // nada local y hay sesión, hidrata desde RTDB (multi-dispositivo /
  // reinstalación). Gana el que exista; el local nunca se pisa con remoto.
  useEffect(() => {
    if (!selDate) return;
    let mounted = true;
    (async () => {
      const raw = await AsyncStorage.getItem(REVISION_STORAGE + selDate).catch(
        () => null,
      );
      if (raw) {
        applyRevisionData(raw);
        return;
      }
      setItems(['', '', '']);
      setSingleGrat('');
      setRevText('');
      setMode('list');

      if (!authUser) return;
      const remote = await fetchContigoRevisions(authUser.uid);
      const remoteRecord = remote[selDate];
      if (!remoteRecord || !mounted) return;
      const remoteRaw = JSON.stringify({ ...remoteRecord, ts: Date.now() });
      await AsyncStorage.setItem(REVISION_STORAGE + selDate, remoteRaw).catch(
        () => {},
      );
      if (mounted) applyRevisionData(remoteRaw);
    })();
    return () => {
      mounted = false;
    };
  }, [selDate, authUser, applyRevisionData]);

  // Cleanup any pending "go back after celebration" timer on unmount or
  // when the user navigates away manually before it fires.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideCelebrationTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  useEffect(() => {
    return () => {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
      if (hideCelebrationTimer.current) {
        clearTimeout(hideCelebrationTimer.current);
        hideCelebrationTimer.current = null;
      }
    };
  }, []);

  const navigateDate = (delta: number) => {
    const next = offsetDate(selDate, delta);
    if (next > todayStr) return;
    h.select();
    setSelDate(next);
    setStep(0);
    setSaved(false);
    setPhase('review'); // skip breathing on date nav
  };

  const handleSave = async () => {
    const revisionData = {
      date: selDate,
      type: 'grateful' as const,
      grateful: {
        mode,
        items: mode === 'list' ? items.filter((g) => g.trim()) : [singleGrat],
        revision: revText,
      },
    };
    try {
      await AsyncStorage.setItem(
        REVISION_STORAGE + selDate,
        JSON.stringify({ ...revisionData, ts: Date.now() }),
      );
      if (authUser) {
        syncContigoRevision(authUser.uid, selDate, revisionData);
      }
    } catch {}
    // Always mark the habit done — the streak / heatmap / week strip should
    // reflect any saved reflection, even retroactive ones.
    await setRevisionDone(selDate, true);
    // Se celebra SIEMPRE que se guarda una revisión, sea de hoy o retroactiva:
    // el hábito se marca igual, así que la recompensa debe ser la misma.
    setShowCelebration(true);
    h.formSuccess();
    if (hideCelebrationTimer.current) {
      clearTimeout(hideCelebrationTimer.current);
    }
    hideCelebrationTimer.current = setTimeout(() => {
      hideCelebrationTimer.current = null;
      setShowCelebration(false);
    }, 2200);
    setSaved(true);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    // Se sale DESPUÉS de que la celebración termine, no a mitad de burst.
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      router.back();
    }, 2100);
  };

  const handleNext = () => {
    if (step < totalSteps - 1) {
      h.tap();
      setStep(step + 1);
    } else {
      handleSave();
    }
  };

  const isToday = selDate === todayStr;
  const isFutureDisabled = selDate >= todayStr;

  const bgColors = useMemo(
    () =>
      isDark
        ? (['#1A1712', '#100F0C'] as const)
        : (['#FBF7F1', '#F0E8D8'] as const),
    [isDark],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 52 }]}>
      {/* Header NATIVO: cerrar (izq) + navegador de fechas como título custom
          (‹ fecha ›) dentro de la barra nativa. */}
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerShadowVisible: false,
          headerTintColor: W.text,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ padding: 6 }}
              accessibilityLabel="Cerrar"
            >
              <MaterialIcons name="close" size={22} color={W.text} />
            </TouchableOpacity>
          ),
          headerTitle: () => (
            <View style={styles.navTitle}>
              <TouchableOpacity
                onPress={() => navigateDate(-1)}
                style={styles.dateStepperBtn}
                hitSlop={10}
                accessibilityLabel="Día anterior"
              >
                <MaterialIcons
                  name="chevron-left"
                  size={20}
                  color={W.textSec}
                />
              </TouchableOpacity>
              <Text
                style={[styles.navTitleText, { color: W.text }]}
                numberOfLines={1}
              >
                {isToday ? 'Hoy' : formatDateLong(selDate)}
              </Text>
              <TouchableOpacity
                onPress={() => navigateDate(1)}
                disabled={isFutureDisabled}
                style={[
                  styles.dateStepperBtn,
                  { opacity: isFutureDisabled ? 0.25 : 1 },
                ]}
                hitSlop={10}
                accessibilityLabel="Día siguiente"
              >
                <MaterialIcons
                  name="chevron-right"
                  size={20}
                  color={W.textSec}
                />
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
        colors={bgColors}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
      />

      {/* Pill (subtítulo movido al cuerpo desde el header) */}
      <View style={styles.pillRow}>
        <Text
          style={[styles.pillText, { color: purple }]}
          accessibilityLabel="Revisión: agradecer y revisar"
        >
          ✦ EXAMEN ESTILO &apos;AGRADECER Y REVISAR&apos;
        </Text>
      </View>

      {/* ── Step indicator ── */}
      <View style={styles.stepRow}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.stepDot,
              {
                width: i === step ? 26 : i < step ? 12 : 7,
                backgroundColor:
                  i < step
                    ? W.accent
                    : i === step
                      ? purple
                      : isDark
                        ? 'rgba(255,255,255,0.12)'
                        : 'rgba(0,0,0,0.10)',
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.stepLabel, { color: W.textMuted }]}>
        Paso {step + 1} de {totalSteps} · {STEP_NAMES[step]}
      </Text>

      {/* ── Body ── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={80}
      >
        <Animated.ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ padding: 20, paddingBottom: 28 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={wideWrapperStyle}>
            <Animated.View
              key={step}
              entering={FadeIn.duration(220)}
              exiting={FadeOut.duration(120)}
            >
              {step === 0 ? (
                <GratefulStep
                  isDark={isDark}
                  mode={mode}
                  setMode={setMode}
                  items={items}
                  setItems={setItems}
                  singleGrat={singleGrat}
                  setSingleGrat={setSingleGrat}
                />
              ) : (
                <RevisarStep
                  isDark={isDark}
                  text={revText}
                  setText={setRevText}
                />
              )}
            </Animated.View>
          </View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>

      {/* ── Footer ── */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: isDark
              ? 'rgba(26,23,18,0.92)'
              : 'rgba(251,247,241,0.92)',
            borderTopColor: W.border,
            paddingBottom: Math.max(tabClearance, insets.bottom + 12),
          },
        ]}
      >
        <View style={wideWrapperStyle}>
          {saved ? (
            <Animated.View
              entering={FadeIn.duration(220)}
              style={styles.savedRow}
            >
              <MaterialIcons name="check-circle" size={22} color={W.green} />
              <Text style={[styles.savedText, { color: W.green }]}>
                Revisión guardada
              </Text>
            </Animated.View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {step > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    h.tap();
                    setStep(step - 1);
                  }}
                  style={[
                    styles.backBtn,
                    {
                      borderColor: W.border,
                    },
                  ]}
                  accessibilityLabel="Paso anterior"
                >
                  <MaterialIcons
                    name="arrow-back"
                    size={20}
                    color={W.textSec}
                  />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleNext}
                activeOpacity={0.85}
                style={{ flex: 1 }}
              >
                <LinearGradient
                  colors={['#8B5CF6', '#6D28D9']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.nextBtn}
                >
                  <Text style={styles.nextBtnText}>
                    {step < totalSteps - 1
                      ? 'Continuar →'
                      : '✓ Guardar revisión'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {phase === 'breathing' && (
        <BreathingPhase onDone={() => setPhase('review')} />
      )}

      <CelebrationAnimation visible={showCelebration} isDark={isDark} />
    </View>
  );
}

// ── Step 1: Agradecer ─────────────────────────────────────────────────
function GratefulStep({
  isDark,
  mode,
  setMode,
  items,
  setItems,
  singleGrat,
  setSingleGrat,
}: {
  isDark: boolean;
  mode: Mode;
  setMode: (m: Mode) => void;
  items: string[];
  setItems: (v: string[]) => void;
  singleGrat: string;
  setSingleGrat: (v: string) => void;
}) {
  const W = warm(isDark);
  const purple = isDark ? WARM_DARK.purple : WARM_LIGHT.purple;
  return (
    <View>
      <Text style={[styles.h2, { color: W.text }]}>Recorre tu día</Text>
      <Text style={[styles.helpText, { color: W.textSec }]}>
        Y mientras lo haces, recuerda aquello por lo que estás agradecido/a
      </Text>

      <View style={styles.modeRow}>
        {(
          [
            { id: 'list' as Mode, label: 'Lista' },
            { id: 'free' as Mode, label: 'Texto libre' },
          ] as const
        ).map(({ id, label }) => {
          const active = mode === id;
          return (
            <TouchableOpacity
              key={id}
              onPress={() => {
                if (!active) h.select();
                setMode(id);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.modeChip,
                {
                  borderColor: active ? purple : W.border,
                  backgroundColor: active
                    ? isDark
                      ? 'rgba(167,139,250,0.14)'
                      : 'rgba(124,58,237,0.08)'
                    : 'transparent',
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: active ? purple : W.textMuted,
                }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {mode === 'list' ? (
        <View style={{ gap: 10 }}>
          {items.map((g, i) => {
            const filled = !!g.trim();
            return (
              <View
                key={i}
                style={[
                  styles.gratRow,
                  {
                    borderColor: filled ? purple + '55' : W.border,
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.02)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.gratStar,
                    { color: filled ? purple : W.textMuted },
                  ]}
                >
                  ✦
                </Text>
                <TextInput
                  value={g}
                  onChangeText={(v) => {
                    const next = [...items];
                    next[i] = v;
                    setItems(next);
                  }}
                  placeholder="Gracias, Jesús por..."
                  placeholderTextColor={W.textMuted}
                  accessibilityLabel={`Agradecimiento ${i + 1}`}
                  style={[styles.gratInput, { color: W.text }]}
                />
              </View>
            );
          })}
          <View style={styles.listActions}>
            <TouchableOpacity
              onPress={() => {
                h.add();
                setItems([...items, '']);
              }}
              style={[styles.addBtn, { borderColor: W.border }]}
              accessibilityRole="button"
            >
              <MaterialIcons name="add" size={18} color={W.textSec} />
              <Text style={[styles.listActionText, { color: W.textSec }]}>
                Añadir otro
              </Text>
            </TouchableOpacity>
            {items.length > 3 && (
              <TouchableOpacity
                onPress={() => {
                  h.remove();
                  setItems(items.slice(0, -1));
                }}
                style={[styles.removeBtn, { borderColor: W.border }]}
                accessibilityRole="button"
                accessibilityLabel="Quitar el último agradecimiento"
              >
                <MaterialIcons name="remove" size={18} color={W.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <TextInput
          value={singleGrat}
          onChangeText={setSingleGrat}
          placeholder="Gracias, Jesús por..."
          placeholderTextColor={W.textMuted}
          multiline
          textAlignVertical="top"
          style={[
            styles.textarea,
            {
              color: W.text,
              borderColor: W.border,
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(0,0,0,0.02)',
            },
          ]}
        />
      )}
    </View>
  );
}

// ── Step 2: Revisar ───────────────────────────────────────────────────
function RevisarStep({
  isDark,
  text,
  setText,
}: {
  isDark: boolean;
  text: string;
  setText: (v: string) => void;
}) {
  const W = warm(isDark);
  return (
    <View>
      <Text style={[styles.h2, { color: W.text }]}>
        Aquellas cosas que no han ido tan bien...
      </Text>
      <Text style={[styles.helpText, { color: W.textSec }]}>
        Quizá te hayas equivocado en alguna cosa o no te hayas sentido demasiado
        bien. Escríbelo aquí y recupéralo en otro momento para revisarlo mejor
      </Text>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Tengo que revisarme..."
        placeholderTextColor={W.textMuted}
        multiline
        textAlignVertical="top"
        style={[
          styles.textarea,
          {
            color: W.text,
            borderColor: W.border,
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.04)'
              : 'rgba(0,0,0,0.02)',
            minHeight: 220,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    position: 'relative',
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Close X is pulled out of the flow and pinned to the left edge so the
  // date-stepper can sit centered as a single, breathable unit.
  headerBtnAbs: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  dateStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '70%',
  },
  dateStepperBtn: {
    width: 28,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  navTitleText: {
    fontSize: 16,
    fontWeight: '700',
    maxWidth: 200,
  },
  dateCenter: {
    alignItems: 'center',
    paddingHorizontal: 6,
    minWidth: 160,
  },
  dateTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  dateSub: { fontSize: 10, marginTop: 1 },
  pillRow: { alignItems: 'center', paddingTop: 10 },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  stepRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 14,
    paddingBottom: 6,
  },
  stepDot: { height: 4, borderRadius: 2 },
  stepLabel: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginTop: 2,
  },

  h2: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 6,
    lineHeight: 26,
  },
  helpText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 18,
  },
  modeRow: { flexDirection: 'row', gap: 6, marginBottom: 18 },
  modeChip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // La fila ES la caja: el borde y el fondo viven aquí, y la estrella y el
  // input son hermanos centrados en flex. Antes la estrella iba absoluta con un
  // `lineHeight: 50` a mano y el texto quedaba descuadrado.
  gratRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    gap: 10,
  },
  gratStar: {
    fontSize: 13,
    fontWeight: '800',
    includeFontPadding: false,
  },
  gratInput: {
    flex: 1,
    ...WRITING_FONT,
    // Sin esto Android reserva su propio padding vertical y el texto se va
    // hacia arriba dentro de la caja.
    paddingVertical: 0,
  },
  listActions: { flexDirection: 'row', gap: 10 },
  listActionText: { fontSize: 14, fontWeight: '600' },
  removeBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  textarea: {
    minHeight: 200,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    ...WRITING_FONT,
    lineHeight: 26,
  },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  savedRow: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  savedText: { fontSize: 16, fontWeight: '700' },
  backBtn: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'white',
    letterSpacing: -0.2,
  },
});
