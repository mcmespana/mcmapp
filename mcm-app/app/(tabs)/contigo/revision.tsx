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
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTabScroll } from '@/components/tabs/useTabScroll';
import { useTabBarClearance } from '@/hooks/useTabBarClearance';
import { h } from '@/utils/haptics';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useSuppressCarismochito } from '@/hooks/useSuppressCarismochito';
import { useContigoHabits } from '@/hooks/useContigoHabits';
import {
  HABITS,
  WARM_DARK,
  WARM_LIGHT,
  warm,
} from '@/components/contigo/theme';
import { BreathingPhase } from '@/components/contigo/BreathingPhase';
import { CelebrationAnimation } from '@/components/contigo/CelebrationAnimation';
import { DateNavigator } from '@/components/contigo/DateNavigator';
import { useAuth } from '@/contexts/AuthContext';
import {
  syncContigoRevision,
  fetchContigoRevisions,
} from '@/utils/authHelpers';
import { styles } from '@/components/contigo/revisionStyles';
import colors from '@/constants/colors';
import { durations, springs } from '@/constants/animations';
import {
  carryGratefulText,
  gratefulItemsToSave,
  padListItems,
  revisionHasContent,
  stepDotWidth,
  type RevisionMode,
} from '@/utils/contigoRevision';

const REVISION_STORAGE = '@contigo_revision_';

type Mode = RevisionMode;

const STEP_NAMES = ['Agradecer', 'Revisar'] as const;

/** Las dos formas de agradecer. Fuera del componente: no cambian. */
const GRATEFUL_MODES = [
  {
    value: 'list' as const,
    label: 'Lista',
    icon: 'format-list-bulleted' as const,
  },
  { value: 'free' as const, label: 'Texto libre', icon: 'notes' as const },
];

export default function RevisionScreen() {
  useSuppressCarismochito();
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
  const { todayStr, setRevisionDone, isRevisionDone } = useContigoHabits();

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
  // Como en oración: el día ya tiene examen guardado (el registro de hábitos es
  // síncrono, así que el aviso sale a la vez que se rellenan los campos).
  const hasEntry = isRevisionDone(selDate);
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
        setItems(padListItems(g));
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

  // La háptica y el tope de «siguiente» los pone `DateNavigator`.
  const changeDate = (next: string) => {
    setSelDate(next);
    setStep(0);
    setSaved(false);
    setPhase('review'); // skip breathing on date nav
  };

  // Un día en blanco no cuenta como examen hecho (ni racha, ni celebración).
  const canSave = revisionHasContent({ mode, items, singleGrat, revText });

  const handleSave = async () => {
    if (!canSave) return;
    const revisionData = {
      date: selDate,
      type: 'grateful' as const,
      grateful: {
        mode,
        items: gratefulItemsToSave(mode, items, singleGrat),
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

  const isLastStep = step === totalSteps - 1;
  // En el último paso no se puede guardar un día en blanco.
  const blocked = isLastStep && !canSave;
  const nextLabel = !isLastStep
    ? 'Continuar'
    : hasEntry
      ? 'Actualizar revisión'
      : 'Guardar revisión';

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
            <DateNavigator
              variant="header"
              date={selDate}
              todayStr={todayStr}
              onChange={changeDate}
              maxDate={todayStr}
            />
          ),
          ...(Platform.OS === 'ios' &&
          parseInt(String(Platform.Version), 10) < 26
            ? { headerBlurEffect: 'systemChromeMaterial' as const }
            : {}),
        }}
      />
      <LinearGradient
        colors={W.bgGradient}
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
          Agradecer y revisar
        </Text>
      </View>

      {/* ── Step indicator ── */}
      <View style={styles.stepRow}>
        {Array.from({ length: totalSteps }).map((_, i) => (
          <StepDot
            key={i}
            width={stepDotWidth(i, step)}
            color={
              i < step
                ? W.accent
                : i === step
                  ? purple
                  : isDark
                    ? 'rgba(255,255,255,0.12)'
                    : 'rgba(0,0,0,0.10)'
            }
          />
        ))}
      </View>
      <Text style={[styles.stepLabel, { color: W.textSec }]}>
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
            {hasEntry && !saved ? (
              <View
                style={[styles.entryBanner, { backgroundColor: W.greenLight }]}
              >
                <MaterialIcons name="check-circle" size={16} color={W.green} />
                <Text style={[styles.entryBannerText, { color: W.green }]}>
                  Ya hiciste el examen de este día — puedes modificarlo
                </Text>
              </View>
            ) : null}
            <Animated.View
              key={step}
              entering={FadeIn.duration(durations.base)}
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
            <View>
              {blocked ? (
                <Text style={[styles.blockedHint, { color: W.textSec }]}>
                  Escribe al menos una cosa para guardar
                </Text>
              ) : null}
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
                  disabled={blocked}
                  accessibilityRole="button"
                  accessibilityLabel={nextLabel}
                  accessibilityState={{ disabled: blocked }}
                  style={[{ flex: 1 }, blocked && styles.nextBtnBlocked]}
                >
                  <LinearGradient
                    colors={HABITS.revision.grad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.nextBtn}
                  >
                    <View style={styles.nextBtnInner}>
                      {isLastStep ? (
                        <MaterialIcons
                          name="check"
                          size={18}
                          color={colors.white}
                        />
                      ) : null}
                      <Text style={styles.nextBtnText}>{nextLabel}</Text>
                      {isLastStep ? null : (
                        <MaterialIcons
                          name="arrow-forward"
                          size={18}
                          color={colors.white}
                        />
                      )}
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
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

/**
 * Un punto del indicador de pasos. El ancho se alarga con un muelle sin rebote
 * y el color se funde: antes saltaba de golpe mientras el cuerpo hacía un
 * fundido. Con «reducir movimiento» asigna el valor directamente.
 */
function StepDot({ width, color }: { width: number; color: string }) {
  const reducedMotion = useReducedMotion();
  const animatedStyle = useAnimatedStyle(() =>
    reducedMotion
      ? { width, backgroundColor: color }
      : {
          width: withSpring(width, springs.settle),
          backgroundColor: withTiming(color, { duration: durations.quick }),
        },
  );
  return <Animated.View style={[styles.stepDot, animatedStyle]} />;
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

      {/* Al cambiar de forma el texto viaja con quien escribe: solo se guarda
          el modo activo y antes lo escrito en el otro se perdía en silencio. */}
      <SegmentedControl
        options={GRATEFUL_MODES}
        value={mode}
        onChange={(next) => {
          const carried = carryGratefulText(next, items, singleGrat);
          setItems(carried.items);
          setSingleGrat(carried.singleGrat);
          setMode(next);
        }}
        accentColor={purple}
        accessibilityLabel="Forma de agradecer"
        style={styles.modeSwitch}
      />

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
                <MaterialIcons name="remove" size={18} color={W.textSec} />
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
