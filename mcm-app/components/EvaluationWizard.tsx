import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  SlideInLeft,
  SlideInRight,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import StarRating from '@/components/StarRating';
import colors, { Colors } from '@/constants/colors';
import { getBrightness } from '@/components/ui/glass';
import { useColorScheme } from '@/hooks/useColorScheme';
import { hexAlpha } from '@/utils/colorUtils';
import { h } from '@/utils/haptics';
import type { EvaluationConfig } from '@/constants/evaluation';

export type EvaluationAnswers = Record<string, number | string | boolean>;

interface EvaluationWizardProps {
  config: EvaluationConfig;
  /** Color de acento del evento (se usa para estrellas y detalles). */
  accentColor: string;
  /** Clave de AsyncStorage anti-duplicado (cache local rápida). */
  doneKey: string;
  onSubmit: (answers: EvaluationAnswers) => Promise<void>;
  /**
   * Comprueba en Firebase si este dispositivo ya envió la evaluación. Si
   * devuelve true, se bloquea el reenvío. Debe ser estable (useCallback).
   */
  checkSubmitted?: () => Promise<boolean>;
}

/**
 * Evaluación tipo onboarding: una fase por pregunta, con barra de progreso,
 * transiciones animadas entre fases y una pantalla final de agradecimiento.
 * Sin dependencias nuevas (Reanimated ya está en el proyecto).
 */
export default function EvaluationWizard({
  config,
  accentColor,
  doneKey,
  onSubmit,
  checkSubmitted,
}: EvaluationWizardProps) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];

  // Acento legible para botones/estructura (el tint del evento puede ser muy
  // claro, p.ej. amarillo, e ilegible sobre blanco). Las estrellas mantienen
  // su color dorado clásico.
  const accentReadable =
    getBrightness(accentColor) > 170
      ? isDark
        ? colors.secondary
        : colors.primary
      : accentColor;
  const starColor = colors.warning;

  const questions = config.questions;
  const total = questions.length;

  // step: -1 = bienvenida; 0..total-1 = preguntas
  const [step, setStep] = useState(-1);
  const [dir, setDir] = useState<'forward' | 'back'>('forward');
  const [answers, setAnswers] = useState<EvaluationAnswers>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState<boolean | null>(null);

  // Comprobación anti-reenvío: primero la cache local (rápida) y, si no, se
  // consulta Firebase (por deviceId). Así una persona no puede volver a enviar
  // la evaluación aunque no haya iniciado sesión.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const local = (await AsyncStorage.getItem(doneKey)) === '1';
        if (local) {
          if (active) setAlreadyDone(true);
          return;
        }
        const remote = checkSubmitted ? await checkSubmitted() : false;
        if (remote) await AsyncStorage.setItem(doneKey, '1');
        if (active) setAlreadyDone(remote);
      } catch {
        if (active) setAlreadyDone(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [doneKey, checkSubmitted]);

  // Barra de progreso animada (0..1).
  const progress = useSharedValue(0);
  useEffect(() => {
    const value = step < 0 ? 0 : (step + 1) / total;
    progress.value = withTiming(value, {
      duration: 380,
      easing: Easing.out(Easing.cubic),
    });
  }, [step, total, progress]);
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const setAnswer = (id: string, value: number | string | boolean) =>
    setAnswers((prev) => ({ ...prev, [id]: value }));

  const goNext = () => {
    h.select();
    setDir('forward');
    setStep((s) => s + 1);
  };
  const goBack = () => {
    h.tap();
    setDir('back');
    setStep((s) => s - 1);
  };

  const exit = () => navigation.goBack();

  const finish = async () => {
    setSubmitting(true);
    try {
      const cleaned: EvaluationAnswers = {};
      for (const q of questions) {
        const v = answers[q.id];
        if (q.type === 'text') {
          const t = String(v ?? '').trim();
          if (t) cleaned[q.id] = t;
        } else if (v !== undefined) {
          cleaned[q.id] = v;
        }
      }
      await onSubmit(cleaned);
      await AsyncStorage.setItem(doneKey, '1');
      h.formSuccess();
      setDone(true);
    } catch (e) {
      console.error('Error enviando evaluación', e);
      h.tap();
      setSubmitting(false);
    }
  };

  // ── Validación de la fase actual ──
  const currentQ = step >= 0 ? questions[step] : null;
  const currentVal = currentQ ? answers[currentQ.id] : undefined;
  const currentAnswered =
    currentQ?.type === 'stars'
      ? typeof currentVal === 'number' && currentVal > 0
      : currentQ?.type === 'text'
        ? !!String(currentVal ?? '').trim()
        : currentVal !== undefined;
  const canContinue = !currentQ || currentQ.optional || currentAnswered;
  const isLast = step === total - 1;

  const Entering = dir === 'back' ? SlideInLeft : SlideInRight;
  const styles = createStyles(isDark);

  // Mientras comprobamos si ya evaluó (cache local + Firebase) mostramos un
  // loader breve para no enseñar la bienvenida y saltar a "ya evaluado".
  if (!done && alreadyDone === null) {
    return (
      <View
        style={[
          styles.root,
          styles.loadingWrap,
          { backgroundColor: theme.background },
        ]}
      >
        <ActivityIndicator size="large" color={accentReadable} />
      </View>
    );
  }

  // ── Pantalla de agradecimiento (envío hecho o ya evaluado antes) ──
  // No hay opción de reenviar: una persona solo puede evaluar una vez.
  if (done || alreadyDone) {
    return (
      <SuccessPhase
        accent={accentReadable}
        theme={theme}
        insets={insets}
        justSubmitted={done}
        onDone={exit}
      />
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      {/* Top bar: progreso + cerrar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        {step >= 0 ? (
          <Pressable onPress={goBack} hitSlop={12} style={styles.backBtn}>
            <MaterialIcons
              name="arrow-back-ios"
              size={16}
              color={accentReadable}
            />
            <Text style={[styles.backLabel, { color: accentReadable }]}>
              Atrás
            </Text>
          </Pressable>
        ) : (
          <View style={{ width: 60 }} />
        )}

        <View style={styles.progressArea}>
          {step >= 0 && (
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { backgroundColor: accentReadable },
                  progressStyle,
                ]}
              />
            </View>
          )}
        </View>

        <Pressable
          onPress={exit}
          hitSlop={12}
          style={styles.closeBtn}
          accessibilityLabel="Cerrar"
          accessibilityRole="button"
        >
          <MaterialIcons name="close" size={22} color={theme.icon} />
        </Pressable>
      </View>

      {/* Bienvenida */}
      {step < 0 ? (
        <Animated.View
          key="welcome"
          entering={FadeIn.duration(420)}
          style={styles.welcomeWrap}
        >
          <Animated.View
            entering={FadeIn.duration(560).easing(
              Easing.bezier(0.34, 1.56, 0.64, 1),
            )}
            style={[
              styles.welcomeIcon,
              { backgroundColor: hexAlpha(accentReadable, '18') },
            ]}
          >
            <MaterialIcons
              name="rate-review"
              size={40}
              color={accentReadable}
            />
          </Animated.View>
          <Animated.Text
            entering={FadeInUp.delay(120).duration(420)}
            style={[styles.welcomeTitle, { color: theme.text }]}
          >
            {config.title || 'Evalúa la actividad'}
          </Animated.Text>
          {config.intro ? (
            <Animated.Text
              entering={FadeInUp.delay(200).duration(420)}
              style={[styles.welcomeBody, { color: theme.icon }]}
            >
              {config.intro}
            </Animated.Text>
          ) : null}
          <Animated.Text
            entering={FadeInUp.delay(280).duration(420)}
            style={[styles.welcomeMeta, { color: theme.icon }]}
          >
            {total} {total === 1 ? 'pregunta' : 'preguntas'} · 2 min
          </Animated.Text>
        </Animated.View>
      ) : (
        // Fase de pregunta
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={20}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.phaseScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              key={`q${step}`}
              entering={Entering.duration(340).easing(
                Easing.bezier(0.22, 1, 0.36, 1),
              )}
            >
              <Text style={[styles.stepCount, { color: accentReadable }]}>
                {step + 1} / {total}
              </Text>
              <Text style={[styles.question, { color: theme.text }]}>
                {currentQ!.label}
                {!currentQ!.optional ? (
                  <Text style={{ color: accentReadable }}> *</Text>
                ) : null}
              </Text>

              {currentQ!.type === 'stars' && (
                <View style={styles.starsWrap}>
                  <StarRating
                    value={typeof currentVal === 'number' ? currentVal : 0}
                    onChange={(n) => setAnswer(currentQ!.id, n)}
                    color={starColor}
                    size={46}
                  />
                </View>
              )}

              {currentQ!.type === 'text' && (
                <TextInput
                  value={typeof currentVal === 'string' ? currentVal : ''}
                  onChangeText={(t) => setAnswer(currentQ!.id, t)}
                  placeholder={currentQ!.placeholder}
                  placeholderTextColor={theme.icon}
                  multiline
                  textAlignVertical="top"
                  maxLength={1000}
                  autoFocus
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      backgroundColor: isDark ? '#2C2C2E' : '#fff',
                      borderColor: String(currentVal ?? '').trim()
                        ? hexAlpha(accentReadable, '90')
                        : hexAlpha(theme.icon, '35'),
                    },
                  ]}
                />
              )}

              {currentQ!.type === 'yesno' && (
                <View style={styles.yesnoRow}>
                  {[
                    { key: true, label: 'Sí', icon: 'thumb-up' as const },
                    { key: false, label: 'No', icon: 'thumb-down' as const },
                  ].map((opt) => {
                    const selected = currentVal === opt.key;
                    return (
                      <Pressable
                        key={opt.label}
                        onPress={() => setAnswer(currentQ!.id, opt.key)}
                        style={[
                          styles.yesnoBtn,
                          {
                            borderColor: selected
                              ? accentReadable
                              : hexAlpha(theme.icon, '30'),
                            backgroundColor: selected
                              ? hexAlpha(accentReadable, '15')
                              : 'transparent',
                          },
                        ]}
                      >
                        <MaterialIcons
                          name={opt.icon}
                          size={22}
                          color={selected ? accentReadable : theme.icon}
                        />
                        <Text
                          style={[
                            styles.yesnoText,
                            { color: selected ? accentReadable : theme.icon },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* Footer: botón principal */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
        {step < 0 ? (
          <WizardButton
            label="Empezar"
            color={accentReadable}
            onPress={goNext}
          />
        ) : isLast ? (
          <WizardButton
            label={submitting ? 'Enviando…' : 'Enviar evaluación'}
            color={accentReadable}
            disabled={!canContinue || submitting}
            loading={submitting}
            onPress={finish}
          />
        ) : (
          <WizardButton
            label={canContinue && !currentAnswered ? 'Saltar' : 'Continuar'}
            color={accentReadable}
            disabled={!canContinue}
            onPress={goNext}
          />
        )}
      </View>
    </View>
  );
}

// ─── Botón con animación de pulsación ────────────────────────────────
function WizardButton({
  label,
  onPress,
  color,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  color: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View style={aStyle}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPressIn={() => (scale.value = withTiming(0.97, { duration: 90 }))}
        onPressOut={() => (scale.value = withTiming(1, { duration: 140 }))}
        onPress={onPress}
        style={[
          btnStyles.btn,
          {
            backgroundColor: disabled ? hexAlpha(color, '45') : color,
            shadowColor: color,
            shadowOpacity: disabled ? 0 : 0.3,
          },
        ]}
      >
        <Text style={btnStyles.label}>{label}</Text>
        {!loading && (
          <MaterialIcons name="arrow-forward" size={18} color="#fff" />
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── Pantalla de agradecimiento ──────────────────────────────────────
function SuccessPhase({
  accent,
  theme,
  insets,
  justSubmitted,
  onDone,
}: {
  accent: string;
  theme: (typeof Colors)['light'];
  insets: { top: number; bottom: number };
  justSubmitted: boolean;
  onDone: () => void;
}) {
  const scale = useSharedValue(0);
  const ripple = useSharedValue(0);
  useEffect(() => {
    scale.value = withSpring(1, { damping: 9, stiffness: 140 });
    ripple.value = withDelay(
      250,
      withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.out(Easing.ease) }),
        -1,
        false,
      ),
    );
  }, [scale, ripple]);
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: 0.4 * (1 - ripple.value),
    transform: [{ scale: 1 + ripple.value * 1.7 }],
  }));

  return (
    <View
      style={[
        successStyles.root,
        {
          backgroundColor: theme.background,
          paddingTop: insets.top + 28,
          paddingBottom: insets.bottom + 28,
        },
      ]}
    >
      <View style={successStyles.iconWrap}>
        <Animated.View
          style={[
            successStyles.ripple,
            { backgroundColor: hexAlpha(accent, '22') },
            rippleStyle,
          ]}
        />
        <Animated.View
          style={[
            successStyles.iconCircle,
            { backgroundColor: hexAlpha(accent, '15') },
            iconStyle,
          ]}
        >
          <MaterialIcons name="celebration" size={52} color={accent} />
        </Animated.View>
      </View>

      <Animated.Text
        entering={FadeInDown.delay(150).duration(420)}
        style={[successStyles.title, { color: theme.text }]}
      >
        {justSubmitted ? '¡Gracias de corazón!' : '¡Ya nos lo has contado!'}
      </Animated.Text>
      <Animated.Text
        entering={FadeInDown.delay(220).duration(420)}
        style={[successStyles.sub, { color: theme.icon }]}
      >
        {justSubmitted
          ? 'Hemos recibido tu evaluación. Nos ayuda muchísimo a mejorar 🙌'
          : 'Ya enviaste tu evaluación. ¡Gracias por tu ayuda!'}
      </Animated.Text>

      <Animated.View
        entering={FadeInUp.delay(320).duration(420)}
        style={successStyles.cta}
      >
        <WizardButton label="Hecho" color={accent} onPress={onDone} />
      </Animated.View>
    </View>
  );
}

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    root: { flex: 1 } as ViewStyle,
    loadingWrap: {
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 6,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      width: 60,
    },
    backLabel: { fontSize: 14, fontWeight: '600' },
    closeBtn: { width: 32, alignItems: 'flex-end' },
    progressArea: { flex: 1, justifyContent: 'center' },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
    },
    progressFill: { height: '100%', borderRadius: 3 },
    // Bienvenida
    welcomeWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      gap: 12,
    },
    welcomeIcon: {
      width: 92,
      height: 92,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    welcomeTitle: {
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.5,
      textAlign: 'center',
    },
    welcomeBody: {
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
      maxWidth: 320,
    },
    welcomeMeta: {
      fontSize: 13,
      fontWeight: '600',
      marginTop: 4,
      opacity: 0.8,
    },
    // Pregunta
    phaseScroll: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 28,
      paddingVertical: 24,
    },
    stepCount: {
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 1,
      marginBottom: 10,
    },
    question: {
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.4,
      lineHeight: 30,
      marginBottom: 24,
    },
    starsWrap: { alignItems: 'flex-start' },
    input: {
      borderWidth: 1.5,
      borderRadius: 16,
      padding: 16,
      fontSize: 16,
      minHeight: 130,
      lineHeight: 23,
    },
    yesnoRow: { flexDirection: 'row', gap: 12 },
    yesnoBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 16,
      borderRadius: 16,
      borderWidth: 1.5,
    },
    yesnoText: { fontSize: 16, fontWeight: '700' },
    // Footer
    footer: {
      paddingHorizontal: 24,
      paddingTop: 10,
    },
  });

const btnStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 4,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});

const successStyles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconWrap: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  ripple: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 10,
  },
  sub: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: 32,
  },
  cta: { width: '100%', maxWidth: 360, gap: 6 },
});
