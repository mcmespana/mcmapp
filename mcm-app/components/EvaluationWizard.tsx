import { logger } from '@/utils/logger';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  SlideInLeft,
  SlideInRight,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import colors, { Colors } from '@/constants/colors';
import { getBrightness } from '@/components/ui/glass';
import { useColorScheme } from '@/hooks/useColorScheme';
import { h } from '@/utils/haptics';
import type { EvaluationConfig } from '@/constants/evaluation';
import WizardButton from '@/components/evaluation/WizardButton';
import WelcomePhase from '@/components/evaluation/WelcomePhase';
import QuestionInput from '@/components/evaluation/QuestionInput';
import SuccessPhase from '@/components/evaluation/SuccessPhase';
import { createWizardStyles } from '@/components/evaluation/wizardStyles';

export type EvaluationAnswers = Record<
  string,
  number | string | boolean | string[]
>;

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
 * Las fases (bienvenida, input de pregunta, éxito) y los controles (botón,
 * escala) viven en `components/evaluation/`.
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

  const setAnswer = (id: string, value: number | string | boolean | string[]) =>
    setAnswers((prev) => ({ ...prev, [id]: value }));

  /** Alterna una opción en una pregunta `multi` (respuesta = array). */
  const toggleMulti = (id: string, optionValue: string) =>
    setAnswers((prev) => {
      const current = Array.isArray(prev[id]) ? (prev[id] as string[]) : [];
      const next = current.includes(optionValue)
        ? current.filter((v) => v !== optionValue)
        : [...current, optionValue];
      return { ...prev, [id]: next };
    });

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
        } else if (q.type === 'multi') {
          // Solo guardamos el array si tiene alguna opción marcada.
          if (Array.isArray(v) && v.length > 0) cleaned[q.id] = v;
        } else if (v !== undefined) {
          cleaned[q.id] = v;
        }
      }
      await onSubmit(cleaned);
      await AsyncStorage.setItem(doneKey, '1');
      h.formSuccess();
      setDone(true);
    } catch (e) {
      logger.error('Error enviando evaluación', e);
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
      : currentQ?.type === 'scale'
        ? typeof currentVal === 'number' // 0 es respuesta válida (p. ej. NPS)
        : currentQ?.type === 'text'
          ? !!String(currentVal ?? '').trim()
          : currentQ?.type === 'multi'
            ? Array.isArray(currentVal) && currentVal.length > 0
            : currentVal !== undefined;
  const canContinue = !currentQ || currentQ.optional || currentAnswered;
  const isLast = step === total - 1;

  const Entering = dir === 'back' ? SlideInLeft : SlideInRight;
  const styles = createWizardStyles(isDark);

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
        thanksTitle={config.thanksTitle}
        thanksBody={config.thanksBody}
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

      {step < 0 ? (
        <WelcomePhase
          title={config.title}
          intro={config.intro}
          total={total}
          accent={accentReadable}
          theme={theme}
        />
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

              <QuestionInput
                question={currentQ!}
                value={currentVal}
                theme={theme}
                accent={accentReadable}
                isDark={isDark}
                starColor={starColor}
                onAnswer={setAnswer}
                onToggleMulti={toggleMulti}
              />
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
