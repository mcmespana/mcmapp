/**
 * El compositor de Compartiendo, a pantalla completa: escribes ENCIMA de tu
 * tarjeta, en su color, con la letra que tendrá en el muro. Sin formulario de
 * cuatro campos: el texto en el centro y, abajo, lo que lo acompaña —el color,
 * la firma y el día—, todo opcional y ya relleno.
 *
 * Es controlado: el borrador vive en la pantalla, así que cerrar sin publicar
 * no pierde nada y al volver a abrir sigue ahí.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@/components/ui/icons';
import PressableScale from '@/components/ui/PressableScale';
import { AuthorAvatar } from '@/components/reflexiones/Avatars';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { durations } from '@/constants/animations';
import { CHROME_MAX_FONT_SCALE } from '@/hooks/useLargeText';
import { useEscapeToClose } from '@/hooks/useEscapeToClose';
import { hexAlpha, onColor } from '@/utils/colorUtils';
import { h } from '@/utils/haptics';
import {
  COMPOSER_PROMPTS,
  REFLEXION_MAX_CHARS,
  REFLEXION_SEEDS,
  REFLEXION_TONES,
  REFLEXION_TONE_LABELS,
  toneColor,
  type ReflexionTone,
} from '@/utils/reflexiones';

/** A partir de aquí se enseña cuánto queda. */
const COUNTER_FROM = 600;

interface Props {
  visible: boolean;
  onClose: () => void;
  eventTitle: string;
  text: string;
  onChangeText: (t: string) => void;
  tone: ReflexionTone;
  onChangeTone: (t: ReflexionTone) => void;
  author: string;
  onChangeAuthor: (a: string) => void;
  days: { iso: string; label: string }[];
  day: string;
  onChangeDay: (iso: string) => void;
  saving: boolean;
  /** Error al publicar: se enseña aquí (un toast quedaría debajo del modal). */
  error?: string | null;
  onPublish: () => void;
}

export default function ReflexionComposer({
  visible,
  onClose,
  eventTitle,
  text,
  onChangeText,
  tone,
  onChangeTone,
  author,
  onChangeAuthor,
  days,
  day,
  onChangeDay,
  saving,
  error,
  onPublish,
}: Props) {
  const insets = useSafeAreaInsets();
  useEscapeToClose(visible, onClose);
  const fill = toneColor(tone);
  const ink = onColor(fill);
  const soft = hexAlpha(ink, '1F');
  const canPublish = text.trim().length > 0 && !saving;

  // Una invitación distinta cada vez que se abre.
  const [promptIndex, setPromptIndex] = useState(0);
  const wasVisible = useRef(visible);
  useEffect(() => {
    if (visible && !wasVisible.current) {
      setPromptIndex((i) => (i + 1) % COMPOSER_PROMPTS.length);
    }
    wasVisible.current = visible;
  }, [visible]);

  const bg = useAnimatedStyle(() => ({
    backgroundColor: withTiming(fill, { duration: durations.base }),
  }));

  const len = text.trim().length;
  const textStyle =
    len <= 80 ? styles.inputXl : len <= 220 ? styles.inputLg : styles.inputMd;

  const inputRef = useRef<TextInputInstance>(null);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'fullScreen' : undefined}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.root, bg]}>
        <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]}>
          <PressableScale
            onPress={onClose}
            style={[styles.round, { backgroundColor: soft }]}
            accessibilityRole="button"
            accessibilityLabel="Cerrar. El borrador se guarda"
            hitSlop={6}
          >
            <MaterialIcons name="close" size={22} color={ink} />
          </PressableScale>
          <Text
            style={[styles.kicker, { color: hexAlpha(ink, 'B3') }]}
            numberOfLines={1}
            maxFontSizeMultiplier={CHROME_MAX_FONT_SCALE}
          >
            {eventTitle}
          </Text>
          <PressableScale
            onPress={() => {
              if (!canPublish) return;
              onPublish();
            }}
            disabled={!canPublish}
            style={[
              styles.publish,
              { backgroundColor: ink },
              !canPublish && styles.disabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Compartir en el muro"
            accessibilityState={{ disabled: !canPublish, busy: saving }}
          >
            {saving ? (
              <ActivityIndicator size="small" color={fill} />
            ) : (
              <MaterialIcons name="send" size={16} color={fill} />
            )}
            <Text
              style={[styles.publishText, { color: fill }]}
              maxFontSizeMultiplier={CHROME_MAX_FONT_SCALE}
            >
              Compartir
            </Text>
          </PressableScale>
        </View>

        {/* `padding` en las DOS plataformas: en Android, con la ventana en
            edge-to-edge, el sistema no redimensiona y el teclado taparía el
            color, la firma y el día (mismo caso que `EvaluationWizard`). */}
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.page}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <MaterialIcons
              name="format-quote"
              size={56}
              color={hexAlpha(ink, '4D')}
              style={styles.quote}
            />
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={onChangeText}
              placeholder={COMPOSER_PROMPTS[promptIndex]}
              placeholderTextColor={hexAlpha(ink, '8C')}
              selectionColor={ink}
              cursorColor={ink}
              multiline
              autoFocus
              maxLength={REFLEXION_MAX_CHARS}
              textAlignVertical="top"
              scrollEnabled={false}
              style={[textStyle, styles.noOutline, { color: ink }]}
              accessibilityLabel="Tu reflexión"
            />
          </ScrollView>

          <View
            style={[
              styles.tools,
              {
                borderTopColor: hexAlpha(ink, '26'),
                paddingBottom: Math.max(insets.bottom, spacing.sm),
              },
            ]}
          >
            {error ? (
              <View
                style={[styles.row, styles.error]}
                accessibilityLiveRegion="assertive"
                accessibilityRole="alert"
              >
                <MaterialIcons name="wifi-off" size={18} color={ink} />
                <Text style={[styles.errorText, { color: ink }]}>{error}</Text>
              </View>
            ) : null}
            {len === 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.row}
                keyboardShouldPersistTaps="always"
              >
                {REFLEXION_SEEDS.map((seed) => (
                  <PressableScale
                    key={seed}
                    onPress={() => {
                      h.select();
                      onChangeText(seed);
                      inputRef.current?.focus();
                    }}
                    style={[styles.chip, { backgroundColor: soft }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Empezar con: ${seed.trim()}`}
                  >
                    <Text style={[styles.chipText, { color: ink }]}>
                      {seed.trim()}
                    </Text>
                  </PressableScale>
                ))}
              </ScrollView>
            ) : null}

            <View style={[styles.row, styles.between]}>
              <View
                style={styles.tones}
                accessibilityRole="radiogroup"
                accessibilityLabel="Color de la tarjeta"
              >
                {REFLEXION_TONES.map((t) => {
                  const selected = t === tone;
                  return (
                    <PressableScale
                      key={t}
                      onPress={() => {
                        if (t !== tone) h.select();
                        onChangeTone(t);
                      }}
                      hitSlop={4}
                      style={[
                        styles.toneRing,
                        { borderColor: selected ? ink : 'transparent' },
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={REFLEXION_TONE_LABELS[t]}
                    >
                      <View
                        style={[
                          styles.toneDot,
                          {
                            backgroundColor: toneColor(t),
                            borderColor: hexAlpha(ink, '59'),
                          },
                        ]}
                      />
                    </PressableScale>
                  );
                })}
              </View>
              {len >= COUNTER_FROM ? (
                <Text style={[styles.counter, { color: hexAlpha(ink, 'B3') }]}>
                  {REFLEXION_MAX_CHARS - len}
                </Text>
              ) : null}
            </View>

            <View style={[styles.row, styles.between]}>
              <View style={[styles.sign, { backgroundColor: soft }]}>
                <AuthorAvatar
                  name={author}
                  color={hexAlpha(ink, '26')}
                  ink={ink}
                  size={28}
                />
                <TextInput
                  value={author}
                  onChangeText={onChangeAuthor}
                  placeholder="Firma (opcional)"
                  placeholderTextColor={hexAlpha(ink, '8C')}
                  selectionColor={ink}
                  cursorColor={ink}
                  style={[styles.signInput, styles.noOutline, { color: ink }]}
                  maxLength={60}
                  returnKeyType="done"
                  accessibilityLabel="Firma"
                />
              </View>
              <View
                style={styles.days}
                accessibilityRole="radiogroup"
                accessibilityLabel="Día"
              >
                {days.map((d) => {
                  const selected = d.iso === day;
                  return (
                    <PressableScale
                      key={d.iso}
                      onPress={() => onChangeDay(d.iso)}
                      style={[
                        styles.day,
                        { backgroundColor: selected ? ink : soft },
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={d.label}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          { color: selected ? fill : ink },
                        ]}
                        maxFontSizeMultiplier={CHROME_MAX_FONT_SCALE}
                      >
                        {/* «Hoy», «Ayer», «Mié»: el día de la semana, corto. */}
                        {d.label.length > 4 ? d.label.slice(0, 3) : d.label}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  // En web el campo pintaba el marco azul de foco del navegador encima de la
  // tarjeta; aquí el foco ya se ve (cursor y texto en la propia tarjeta).
  noOutline: Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {},
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    ...typography.footnote,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  publish: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
  },
  publishText: { ...typography.button, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  page: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  quote: { marginLeft: -spacing.sm, marginBottom: -spacing.sm },
  inputXl: {
    ...typography.h1,
    lineHeight: 36,
    letterSpacing: -0.5,
    minHeight: 160,
    padding: 0,
  },
  inputLg: {
    ...typography.h2,
    lineHeight: 30,
    letterSpacing: -0.3,
    minHeight: 160,
    padding: 0,
  },
  inputMd: {
    ...typography.title,
    fontWeight: '500',
    lineHeight: 26,
    minHeight: 160,
    padding: 0,
  },
  tools: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm + spacing.xs,
    gap: spacing.sm + spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  between: { justifyContent: 'space-between' },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm + spacing.xs,
    borderRadius: radii.full,
  },
  chipText: { ...typography.subhead, fontWeight: '600' },
  tones: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  toneRing: {
    width: 40,
    height: 40,
    borderRadius: radii.pillFull,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toneDot: {
    width: 28,
    height: 28,
    borderRadius: radii.pillFull,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  counter: { ...typography.footnote, fontWeight: '600' },
  error: { gap: spacing.xs + 2 },
  errorText: { ...typography.subhead, fontWeight: '600', flex: 1 },
  sign: {
    flex: 1,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.xs + 2,
    paddingRight: spacing.sm,
    borderRadius: radii.full,
  },
  signInput: {
    ...typography.subhead,
    fontWeight: '600',
    flex: 1,
    paddingVertical: spacing.sm,
  },
  days: { flexDirection: 'row', gap: spacing.xs },
  day: {
    minHeight: 40,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radii.full,
  },
  dayText: { ...typography.footnote, fontWeight: '700' },
});
