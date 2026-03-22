// app/screens/DailyReviewScreen.tsx — Revisión del Día (Examen)
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  Easing,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/colors';
import brand from '@/constants/colors';
import spacing from '@/constants/spacing';
import { radii, shadows } from '@/constants/uiStyles';
import typography from '@/constants/typography';
import {
  REVIEW_STEPS,
  CLOSING_TEXT,
  INTRO_TEXT,
} from '@/constants/reviewSteps';
import type { ReviewStepConfig } from '@/constants/reviewSteps';
import { useDailyReview } from '@/hooks/useDailyReview';
import type { ReviewStep } from '@/hooks/useDailyReview';

// ── Color palette for the review ──
const REVIEW_COLORS = {
  primary: '#1B3A5C', // Deep navy
  primaryLight: '#2A5A8C',
  accent: '#D4A843', // Warm gold
  accentLight: '#F5E6C4',
  bg: '#F7F9FC',
  bgDark: '#1C1C2E',
  cardBg: '#FFFFFF',
  cardBgDark: '#2A2A3C',
  textPrimary: '#1B3A5C',
  textSecondary: '#5A6B7D',
  textLight: '#FFFFFF',
  progressTrack: '#E8EDF2',
  progressTrackDark: '#3A3A4C',
  tagBg: '#EDF2F7',
  tagBgSelected: '#1B3A5C',
  tagBgDark: '#3A3A4C',
  tagBgSelectedDark: '#4A6FA5',
  breatheCircle: '#D4A843',
  success: '#4CAF50',
} as const;

// Total phases: intro(0) + pause(1) + 5 steps(2-6) + closing(7)
const TOTAL_PHASES = 8;

interface Props {
  onClose: () => void;
  initialDate?: string;
}

function getTodayDate(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function formatDateSpanish(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];
  return `${d} de ${months[m - 1]} del ${y}`;
}

export default function DailyReviewScreen({ onClose, initialDate }: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const { saveReview } = useDailyReview();

  const date = initialDate ?? getTodayDate();
  const [phase, setPhase] = useState(0); // 0=intro, 1=pause, 2-6=steps, 7=closing
  const [stepData, setStepData] = useState<ReviewStep>({});

  // Pause screen state
  const [pauseComplete, setPauseComplete] = useState(false);
  const [debugTapCount, setDebugTapCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(10);

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const breatheAnim = useRef(new Animated.Value(0.6)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Tag selection state per step
  const [selectedTags, setSelectedTags] = useState<Record<number, string[]>>(
    {},
  );
  const [textInputs, setTextInputs] = useState<Record<number, string>>({});

  const colors = isDark
    ? {
        bg: REVIEW_COLORS.bgDark,
        card: REVIEW_COLORS.cardBgDark,
        text: '#FFFFFF',
        textSecondary: '#A0AEC0',
        tag: REVIEW_COLORS.tagBgDark,
        tagSelected: REVIEW_COLORS.tagBgSelectedDark,
        progressTrack: REVIEW_COLORS.progressTrackDark,
        input: '#3A3A4C',
        inputBorder: '#4A4A5C',
      }
    : {
        bg: REVIEW_COLORS.bg,
        card: REVIEW_COLORS.cardBg,
        text: REVIEW_COLORS.textPrimary,
        textSecondary: REVIEW_COLORS.textSecondary,
        tag: REVIEW_COLORS.tagBg,
        tagSelected: REVIEW_COLORS.tagBgSelected,
        progressTrack: REVIEW_COLORS.progressTrack,
        input: '#FFFFFF',
        inputBorder: '#E2E8F0',
      };

  // Breathe animation for pause screen
  useEffect(() => {
    if (phase !== 1) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breatheAnim, {
          toValue: 0.6,
          duration: 4000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, breatheAnim]);

  // Countdown for pause screen
  useEffect(() => {
    if (phase !== 1 || pauseComplete) return;
    if (secondsLeft <= 0) {
      setPauseComplete(true);
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, secondsLeft, pauseComplete]);

  // Progress animation
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: phase / (TOTAL_PHASES - 1),
      duration: 400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [phase, progressAnim]);

  const animateTransition = useCallback(
    (next: number) => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -30,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setPhase(next);
        slideAnim.setValue(30);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start();
      });
    },
    [fadeAnim, slideAnim],
  );

  const handleContinue = useCallback(() => {
    if (phase < TOTAL_PHASES - 1) {
      // Save step data before transitioning
      if (phase >= 2 && phase <= 6) {
        const stepIdx = phase - 2;
        const step = REVIEW_STEPS[stepIdx];
        const updated = { ...stepData };

        if (stepIdx === 0) {
          updated.presencia = textInputs[stepIdx] || '';
        } else if (stepIdx === 1) {
          updated.gracias_tags = selectedTags[stepIdx] || [];
          updated.gracias_texto = textInputs[stepIdx] || '';
        } else if (stepIdx === 2) {
          updated.perdon_tags = selectedTags[stepIdx] || [];
          updated.perdon_texto = textInputs[stepIdx] || '';
        } else if (stepIdx === 3) {
          updated.conocimiento_texto = textInputs[stepIdx] || '';
        } else if (stepIdx === 4) {
          updated.manana_texto = textInputs[stepIdx] || '';
        }
        setStepData(updated);
      }
      animateTransition(phase + 1);
    }
  }, [phase, stepData, selectedTags, textInputs, animateTransition]);

  const handleFinish = useCallback(async () => {
    // Save closing text and persist review
    const finalData = {
      ...stepData,
      cierre_texto: textInputs[5] || '',
    };
    await saveReview(date, finalData);
    onClose();
  }, [stepData, textInputs, saveReview, date, onClose]);

  const handleDebugTap = useCallback(() => {
    const newCount = debugTapCount + 1;
    setDebugTapCount(newCount);
    if (newCount >= 6) {
      setPauseComplete(true);
      setDebugTapCount(0);
    }
  }, [debugTapCount]);

  const toggleTag = useCallback(
    (stepIdx: number, tag: string) => {
      setSelectedTags((prev) => {
        const current = prev[stepIdx] || [];
        const isSelected = current.includes(tag);
        return {
          ...prev,
          [stepIdx]: isSelected
            ? current.filter((t) => t !== tag)
            : [...current, tag],
        };
      });
    },
    [],
  );

  const updateText = useCallback((stepIdx: number, text: string) => {
    setTextInputs((prev) => ({ ...prev, [stepIdx]: text }));
  }, []);

  // ── Render Intro ──
  const renderIntro = () => (
    <View style={s.centeredContent}>
      <MaterialIcons
        name="visibility"
        size={48}
        color={REVIEW_COLORS.accent}
        style={{ marginBottom: spacing.lg }}
      />
      <Text style={[s.introTitle, { color: colors.text }]}>
        Revisión del día
      </Text>
      <Text style={[s.introSubtitle, { color: REVIEW_COLORS.accent }]}>
        Consolación
      </Text>
      <Text style={[s.introBody, { color: colors.textSecondary }]}>
        {INTRO_TEXT}
      </Text>
      <View style={{ flex: 1 }} />
      <TouchableOpacity
        style={s.primaryButton}
        onPress={() => animateTransition(1)}
        activeOpacity={0.8}
      >
        <Text style={s.primaryButtonText}>Continuar</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Render Pause ──
  const renderPause = () => {
    const scale = breatheAnim;
    return (
      <View style={s.centeredContent}>
        <Text style={[s.pauseTitle, { color: colors.text }]}>
          Para un momento…
        </Text>
        <Text style={[s.pauseSubtitle, { color: colors.textSecondary }]}>
          Respira profundamente
        </Text>

        <TouchableOpacity
          onPress={handleDebugTap}
          activeOpacity={1}
          style={s.breatheContainer}
        >
          <Animated.View
            style={[
              s.breatheCircle,
              {
                transform: [{ scale }],
                opacity: breatheAnim.interpolate({
                  inputRange: [0.6, 1],
                  outputRange: [0.4, 0.15],
                }),
              },
            ]}
          />
          <Animated.View
            style={[
              s.breatheCircleInner,
              {
                transform: [{ scale }],
              },
            ]}
          >
            <Text style={s.breatheText}>
              {secondsLeft > 0 ? secondsLeft : ''}
            </Text>
          </Animated.View>
        </TouchableOpacity>

        <Text style={[s.breatheHint, { color: colors.textSecondary }]}>
          {pauseComplete
            ? '¡Listo! Puedes continuar'
            : 'Tómate un momento de calma...'}
        </Text>

        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={[
            s.primaryButton,
            !pauseComplete && s.buttonDisabled,
          ]}
          onPress={() => pauseComplete && animateTransition(2)}
          activeOpacity={pauseComplete ? 0.8 : 1}
          disabled={!pauseComplete}
        >
          <Text
            style={[
              s.primaryButtonText,
              !pauseComplete && s.buttonTextDisabled,
            ]}
          >
            Continuar
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Render Step ──
  const renderStep = (step: ReviewStepConfig) => {
    const stepIdx = step.number - 1;
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.stepScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.stepHeader}>
            <View style={s.stepNumberBadge}>
              <Text style={s.stepNumberText}>{step.number}</Text>
            </View>
            <MaterialIcons
              name={step.icon as any}
              size={28}
              color={REVIEW_COLORS.accent}
            />
          </View>

          <Text style={[s.stepQuote, { color: REVIEW_COLORS.accent }]}>
            {step.quote}
          </Text>

          <Text style={[s.stepDescription, { color: colors.textSecondary }]}>
            {step.description}
          </Text>

          {step.hasTags && step.tags && (
            <View style={s.tagsSection}>
              <Text style={[s.tagsSectionTitle, { color: colors.text }]}>
                {step.number === 2
                  ? 'Soy todo DON de Dios (1Cor 4,7)'
                  : step.number === 3
                    ? 'Pido perdón…'
                    : ''}
              </Text>
              <View style={s.tagsContainer}>
                {step.tags.map((tag) => {
                  const isSelected = (selectedTags[stepIdx] || []).includes(
                    tag,
                  );
                  return (
                    <TouchableOpacity
                      key={tag}
                      style={[
                        s.tag,
                        {
                          backgroundColor: isSelected
                            ? colors.tagSelected
                            : colors.tag,
                        },
                      ]}
                      onPress={() => toggleTag(stepIdx, tag)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          s.tagText,
                          {
                            color: isSelected
                              ? REVIEW_COLORS.textLight
                              : colors.text,
                          },
                        ]}
                      >
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {step.hasTextInput && (
            <View style={s.textInputSection}>
              <TextInput
                style={[
                  s.textInput,
                  {
                    backgroundColor: colors.input,
                    borderColor: colors.inputBorder,
                    color: colors.text,
                  },
                ]}
                placeholder={step.textPlaceholder}
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={textInputs[stepIdx] || ''}
                onChangeText={(text) => updateText(stepIdx, text)}
              />
            </View>
          )}
        </ScrollView>

        <View style={s.bottomBar}>
          <TouchableOpacity
            style={s.primaryButton}
            onPress={handleContinue}
            activeOpacity={0.8}
          >
            <Text style={s.primaryButtonText}>Continuar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  };

  // ── Render Closing ──
  const renderClosing = () => (
    <View style={s.centeredContent}>
      <MaterialIcons
        name="auto-awesome"
        size={48}
        color={REVIEW_COLORS.accent}
        style={{ marginBottom: spacing.lg }}
      />
      <Text style={[s.closingTitle, { color: colors.text }]}>
        Finalmente, me despido
      </Text>
      <Text style={[s.closingBody, { color: colors.textSecondary }]}>
        Te doy gracias por todo lo vivido y termino con una sencilla oración…
      </Text>
      <Text style={[s.closingPrayer, { color: REVIEW_COLORS.accent }]}>
        {CLOSING_TEXT}
      </Text>

      <TextInput
        style={[
          s.textInput,
          {
            backgroundColor: colors.input,
            borderColor: colors.inputBorder,
            color: colors.text,
            marginTop: spacing.lg,
            width: '100%',
          },
        ]}
        placeholder="Añade una nota final si quieres..."
        placeholderTextColor={colors.textSecondary}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        value={textInputs[5] || ''}
        onChangeText={(text) => updateText(5, text)}
      />

      <View style={{ flex: 1 }} />

      {/* Music placeholder */}
      <TouchableOpacity
        style={s.musicButton}
        activeOpacity={0.7}
        onPress={() => {
          // Future: open Spotify playlist or play background music
        }}
      >
        <MaterialIcons
          name="music-note"
          size={20}
          color={REVIEW_COLORS.accent}
        />
        <Text style={[s.musicButtonText, { color: REVIEW_COLORS.accent }]}>
          Escuchar música
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.primaryButton, { backgroundColor: REVIEW_COLORS.success }]}
        onPress={handleFinish}
        activeOpacity={0.8}
      >
        <MaterialIcons
          name="check"
          size={20}
          color="#FFFFFF"
          style={{ marginRight: 8 }}
        />
        <Text style={s.primaryButtonText}>Terminar revisión</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Main render ──
  const renderPhase = () => {
    if (phase === 0) return renderIntro();
    if (phase === 1) return renderPause();
    if (phase >= 2 && phase <= 6) return renderStep(REVIEW_STEPS[phase - 2]);
    if (phase === 7) return renderClosing();
    return null;
  };

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.backButton}>
          <MaterialIcons name="chevron-left" size={28} color={colors.text} />
        </TouchableOpacity>
        {phase >= 1 && (
          <Text style={[s.headerDate, { color: colors.textSecondary }]}>
            {formatDateSpanish(date)}
          </Text>
        )}
        {/* Music toggle placeholder */}
        <TouchableOpacity style={s.musicToggle} onPress={() => {}}>
          <MaterialIcons
            name="music-off"
            size={22}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      {phase >= 1 && (
        <View
          style={[s.progressBar, { backgroundColor: colors.progressTrack }]}
        >
          <Animated.View
            style={[
              s.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      )}

      {/* Content */}
      <Animated.View
        style={[
          s.contentContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {renderPhase()}
      </Animated.View>
    </SafeAreaView>
  );
}

// ── Styles ──
const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    padding: 4,
  },
  headerDate: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
  musicToggle: {
    padding: 4,
  },
  progressBar: {
    height: 4,
    marginHorizontal: spacing.xl,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: REVIEW_COLORS.accent,
    borderRadius: 2,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },

  // ── Centered content (intro, pause, closing) ──
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: spacing.lg,
  },

  // ── Intro ──
  introTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  introSubtitle: {
    fontSize: 22,
    fontStyle: 'italic',
    fontWeight: '300',
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  introBody: {
    fontSize: 18,
    lineHeight: 28,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },

  // ── Pause ──
  pauseTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  pauseSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  breatheContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  breatheCircle: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: REVIEW_COLORS.breatheCircle,
  },
  breatheCircleInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: REVIEW_COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: REVIEW_COLORS.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
      },
      default: { elevation: 8 },
    }),
  },
  breatheText: {
    fontSize: 36,
    fontWeight: '200',
    color: '#FFFFFF',
  },
  breatheHint: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  // ── Steps ──
  stepScrollContent: {
    paddingBottom: 100,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: 12,
  },
  stepNumberBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: REVIEW_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  stepQuote: {
    fontSize: 20,
    fontStyle: 'italic',
    fontWeight: '600',
    marginBottom: spacing.md,
    lineHeight: 28,
  },
  stepDescription: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },

  // ── Tags ──
  tagsSection: {
    marginBottom: spacing.md,
  },
  tagsSectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  tag: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    minWidth: 80,
    alignItems: 'center',
  },
  tagText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // ── Text input ──
  textInputSection: {
    marginTop: spacing.sm,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 100,
  },

  // ── Bottom bar ──
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },

  // ── Buttons ──
  primaryButton: {
    backgroundColor: REVIEW_COLORS.primary,
    paddingVertical: 16,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    width: '100%',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#B0BEC5',
    opacity: 0.6,
  },
  buttonTextDisabled: {
    color: '#E0E0E0',
  },

  // ── Closing ──
  closingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  closingBody: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  closingPrayer: {
    fontSize: 18,
    fontWeight: '600',
    fontStyle: 'italic',
    textAlign: 'center',
  },

  // ── Music button ──
  musicButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: REVIEW_COLORS.accent,
    marginBottom: spacing.md,
  },
  musicButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
