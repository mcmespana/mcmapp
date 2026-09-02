import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
  Animated,
  useAnimatedValue,
} from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { h } from '@/utils/haptics';
import { MaterialIcons } from '@expo/vector-icons';
import BottomSheet from './BottomSheet';
import { Colors, UIColors, themeColors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';
import typography from '@/constants/typography';

interface Props {
  visible: boolean;
  onClose: () => void;
  currentTranspose: number;
  onSetTranspose: (value: number) => void;
  /** Cejilla original de la canción (del cantoral). */
  originalCapo?: number;
  /** Override de cejilla para esta sesión/playlist. null = sin override. */
  currentCapoOverride?: number | null;
  onSetCapoOverride?: (capo: number | null) => void;
}

const HOLD_DELAY_MS = 380; // espera antes de empezar a repetir
const HOLD_INTERVAL_MS = 130; // cadencia de repetición manteniendo pulsado

// ⚠️ Todo lo animado de esta hoja va con el `Animated` de React Native, NO con
// Reanimated: vive dentro del `Modal` transparente de `BottomSheet`, donde los
// estilos animados de Reanimated 4 no se aplican (ver la cabecera de
// `components/BottomSheet.tsx`). El pop del valor de tono estaba con
// Reanimated y es MUY probable que no se viera nunca.

/** Feedback de pulsación: baja a 0.94 al tocar y vuelve al soltar. */
const PRESS_IN_MS = 90;
const PRESS_OUT_MS = 140;
const PRESS_SCALE = 0.94;

/** Pop de confirmación del valor central cuando cambia. */
const POP_SCALE = 1.18;

function usePressScale(enabled: boolean) {
  const scale = useAnimatedValue(1);
  const press = useCallback(
    (to: number, duration: number) => {
      if (!enabled) return;
      Animated.timing(scale, {
        toValue: to,
        duration,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    },
    [enabled, scale],
  );
  return {
    scale,
    onPressIn: () => press(PRESS_SCALE, PRESS_IN_MS),
    onPressOut: () => press(1, PRESS_OUT_MS),
  };
}

/**
 * Botón ± grande: un toque = un paso; mantener pulsado repite.
 *
 * `disabled` no lo deja MUDO: sigue avisando (`onBlocked`) para poder dar
 * háptica de tope y un meneo del valor. Un botón que no hace absolutamente
 * nada al tocarlo se lee como app colgada, no como "hasta aquí".
 */
function HoldStepButton({
  onStep,
  onBlocked,
  disabled = false,
  style,
  children,
  accessibilityLabel,
}: {
  onStep: () => void;
  onBlocked?: () => void;
  disabled?: boolean;
  style: object | object[];
  children: React.ReactNode;
  accessibilityLabel: string;
}) {
  const delayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { scale, onPressIn, onPressOut } = usePressScale(!disabled);

  const stop = () => {
    if (delayTimer.current) clearTimeout(delayTimer.current);
    if (repeatTimer.current) clearInterval(repeatTimer.current);
    delayTimer.current = null;
    repeatTimer.current = null;
  };

  useEffect(() => stop, []);
  // Si se deshabilita con el dedo encima (llegas al tope manteniendo pulsado),
  // hay que cortar la repetición o sigue latiendo contra la pared.
  useEffect(() => {
    if (disabled) stop();
  }, [disabled]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={() => {
          if (disabled) {
            onBlocked?.();
            return;
          }
          onPressIn();
          onStep();
          delayTimer.current = setTimeout(() => {
            repeatTimer.current = setInterval(onStep, HOLD_INTERVAL_MS);
          }, HOLD_DELAY_MS);
        }}
        onPressOut={() => {
          onPressOut();
          stop();
        }}
        style={[
          ...(Array.isArray(style) ? style : [style]),
          disabled && styles.stepBtnDisabled,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/**
 * Valor central: pega un pop cada vez que `token` cambia, y un meneo lateral
 * corto cuando `nudge` sube (tope alcanzado).
 */
function useValueFeedback(token: unknown) {
  const pop = useAnimatedValue(1);
  const shake = useAnimatedValue(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    pop.setValue(POP_SCALE);
    Animated.spring(pop, {
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
      tension: 260,
      friction: 9,
    }).start();
  }, [token, pop]);

  const nudge = useCallback(() => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, {
        toValue: -6,
        duration: 60,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(shake, {
        toValue: 4,
        duration: 60,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(shake, {
        toValue: 0,
        duration: 80,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [shake]);

  return {
    style: { transform: [{ translateX: shake }] },
    popStyle: { transform: [{ scale: pop }] },
    nudge,
  };
}

export default function TransposeBottomSheet({
  visible,
  onClose,
  currentTranspose,
  onSetTranspose,
  originalCapo,
  currentCapoOverride,
  onSetCapoOverride,
}: Props) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const showCapoSection = onSetCapoOverride !== undefined;
  const isCapoOverridden =
    currentCapoOverride !== null && currentCapoOverride !== undefined;
  const effectiveCapo = isCapoOverridden
    ? (currentCapoOverride as number)
    : (originalCapo ?? 0);
  const isTransposed = currentTranspose !== 0;

  // El prop puede llegar con un frame de retraso al repetir rápido; el ref
  // acumula los pasos para que cada pulsación cuente siempre.
  const transposeRef = useRef(currentTranspose);
  useEffect(() => {
    transposeRef.current = currentTranspose;
  }, [currentTranspose]);

  const stepTone = (delta: number) => {
    transposeRef.current += delta;
    h.select();
    onSetTranspose(transposeRef.current);
  };

  // Pop del valor central en cada cambio — el mismo para tono y para cejilla,
  // que antes no tenía ninguno y se sentía como el hermano pobre.
  const tone = useValueFeedback(currentTranspose);
  const capo = useValueFeedback(effectiveCapo);

  const handleCapoMinus = () => {
    if (!onSetCapoOverride) return;
    const next = effectiveCapo - 1;
    if (next < 0) return;
    h.select();
    onSetCapoOverride(next === (originalCapo ?? 0) ? null : next);
  };
  const handleCapoPlus = () => {
    if (!onSetCapoOverride) return;
    const next = effectiveCapo + 1;
    h.select();
    onSetCapoOverride(next === (originalCapo ?? 0) ? null : next);
  };
  /** Cejilla al mínimo: no se puede bajar más, pero se avisa. */
  const handleCapoBlocked = () => {
    h.limit();
    capo.nudge();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Ajustes de canción">
      <View
        style={[
          styles.container,
          {
            // El safe-area inferior lo reserva ya el `BottomSheet`; esto es el
            // aire visual entre el último botón y ese borde, que antes era 0 y
            // dejaba la cejilla pegada al canto de abajo del móvil.
            paddingBottom: 16,
          },
        ]}
      >
        {/* ━━━━━━━━━━━━━━ TONO ━━━━━━━━━━━━━━ */}
        <View style={[styles.card, isDark && styles.cardDark]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>TONO</Text>
            <View style={styles.cardValueWrap}>
              <Text style={styles.cardHint}>Mantén pulsado para ir rápido</Text>
            </View>
            <PressableFeedback
              style={[
                styles.resetIconBtn,
                !isTransposed && styles.resetIconBtnHidden,
              ]}
              onPress={() => {
                h.tap();
                onSetTranspose(0);
              }}
              isDisabled={!isTransposed}
              accessibilityLabel="Restablecer tono"
            >
              <PressableFeedback.Highlight />
              <MaterialIcons
                name="refresh"
                size={18}
                color={themeColors(isDark).textSecondary}
              />
            </PressableFeedback>
          </View>

          {/* −1 y +1 grandes y FIJOS a los lados (taps rápidos sin mirar),
              valor central con pop de confirmación. */}
          <View style={styles.toneRow}>
            <HoldStepButton
              onStep={() => stepTone(-1)}
              style={[
                styles.toneStepBtn,
                isDark ? styles.toneBtnDownDark : styles.toneBtnDown,
              ]}
              accessibilityLabel="Bajar un semitono"
            >
              <Text
                style={[
                  styles.toneStepText,
                  { color: isDark ? '#E57373' : '#C62828' },
                ]}
              >
                −1
              </Text>
            </HoldStepButton>

            <Animated.View
              style={[
                styles.toneDisplay,
                tone.style,
                isTransposed
                  ? isDark
                    ? styles.toneDisplayActiveDark
                    : styles.toneDisplayActive
                  : isDark
                    ? styles.toneDisplayDark
                    : null,
              ]}
            >
              <Animated.Text
                style={[
                  styles.toneDisplayValue,
                  tone.popStyle,
                  {
                    color: isTransposed
                      ? isDark
                        ? UIColors.accentYellow
                        : '#7A5A00'
                      : isDark
                        ? '#EBEBF0'
                        : '#1C1C1E',
                  },
                ]}
              >
                {isTransposed
                  ? `${currentTranspose > 0 ? '+' : ''}${currentTranspose}`
                  : 'Original'}
              </Animated.Text>
              <Text
                style={[
                  styles.toneDisplayCaption,
                  !isTransposed && styles.toneDisplayCaptionHidden,
                ]}
              >
                {Math.abs(currentTranspose) === 1 ? 'semitono' : 'semitonos'}
              </Text>
            </Animated.View>

            <HoldStepButton
              onStep={() => stepTone(1)}
              style={[
                styles.toneStepBtn,
                isDark ? styles.toneBtnUpDark : styles.toneBtnUp,
              ]}
              accessibilityLabel="Subir un semitono"
            >
              <Text
                style={[
                  styles.toneStepText,
                  { color: isDark ? '#81C784' : '#2E7D32' },
                ]}
              >
                +1
              </Text>
            </HoldStepButton>
          </View>
        </View>

        {/* ━━━━━━━━━━━━━━ CEJILLA ━━━━━━━━━━━━━━ */}
        {showCapoSection && (
          <View style={[styles.card, isDark && styles.cardDark]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>CEJILLA</Text>
              <View style={styles.cardValueWrap}>
                <Text
                  style={[
                    styles.cardValue,
                    {
                      color: isCapoOverridden
                        ? isDark
                          ? '#FFB74D'
                          : '#C77700'
                        : themeColors(isDark).textMuted,
                    },
                  ]}
                >
                  {isCapoOverridden
                    ? originalCapo && originalCapo > 0
                      ? `Original: ${originalCapo}`
                      : 'Original: sin cejilla'
                    : originalCapo && originalCapo > 0
                      ? `Original: ${originalCapo}`
                      : 'Sin cejilla'}
                </Text>
              </View>
              <PressableFeedback
                style={[
                  styles.resetIconBtn,
                  !isCapoOverridden && styles.resetIconBtnHidden,
                ]}
                onPress={() => {
                  h.tap();
                  onSetCapoOverride!(null);
                }}
                isDisabled={!isCapoOverridden}
                accessibilityLabel="Restablecer cejilla"
              >
                <PressableFeedback.Highlight />
                <MaterialIcons
                  name="refresh"
                  size={18}
                  color={themeColors(isDark).textSecondary}
                />
              </PressableFeedback>
            </View>

            <View style={styles.capoRow}>
              <HoldStepButton
                onStep={handleCapoMinus}
                onBlocked={handleCapoBlocked}
                disabled={effectiveCapo <= 0}
                style={[
                  styles.capoStepBtn,
                  isDark ? styles.toneBtnDownDark : styles.toneBtnDown,
                ]}
                accessibilityLabel="Bajar la cejilla un traste"
              >
                <MaterialIcons
                  name="remove"
                  size={26}
                  color={
                    effectiveCapo <= 0
                      ? isDark
                        ? '#48484A'
                        : '#C7C7CC'
                      : isDark
                        ? '#E57373'
                        : '#C62828'
                  }
                />
              </HoldStepButton>

              <Animated.View
                style={[
                  styles.capoDisplay,
                  capo.style,
                  isCapoOverridden
                    ? isDark
                      ? styles.capoDisplayOverriddenDark
                      : styles.capoDisplayOverridden
                    : isDark
                      ? styles.capoDisplayDark
                      : null,
                ]}
              >
                <Animated.Text
                  style={[
                    styles.capoDisplayValue,
                    capo.popStyle,
                    {
                      color: isCapoOverridden
                        ? isDark
                          ? UIColors.accentYellow
                          : '#7A5A00'
                        : isDark
                          ? '#EBEBF0'
                          : '#1C1C1E',
                    },
                  ]}
                >
                  {effectiveCapo === 0
                    ? 'Sin cejilla'
                    : `Cejilla ${effectiveCapo}`}
                </Animated.Text>
                <Text
                  style={[
                    styles.capoDisplayBadge,
                    !isCapoOverridden && styles.capoDisplayBadgeHidden,
                  ]}
                >
                  modificada
                </Text>
              </Animated.View>

              <HoldStepButton
                onStep={handleCapoPlus}
                style={[
                  styles.capoStepBtn,
                  isDark ? styles.toneBtnUpDark : styles.toneBtnUp,
                ]}
                accessibilityLabel="Subir la cejilla un traste"
              >
                <MaterialIcons
                  name="add"
                  size={26}
                  color={isDark ? '#81C784' : '#2E7D32'}
                />
              </HoldStepButton>
            </View>
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 4,
    gap: 12,
  },
  card: {
    backgroundColor: '#F7F7FB',
    borderRadius: radii.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  cardDark: {
    backgroundColor: Colors.dark.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 28,
  },
  cardLabel: {
    ...typography.micro,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#8E8E93',
  },
  cardValueWrap: {
    flex: 1,
    alignItems: 'center',
  },
  cardValue: {
    ...typography.caption,
    fontWeight: '600',
  },
  resetIconBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  resetIconBtnHidden: {
    opacity: 0,
  },
  cardHint: {
    ...typography.micro,
    fontWeight: '500',
    color: '#8E8E93',
  },
  toneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toneStepBtn: {
    width: 72,
    height: 60,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toneStepText: {
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  toneBtnUp: {
    backgroundColor: '#E8F5E9',
  },
  toneBtnUpDark: {
    backgroundColor: '#1B3A1B',
  },
  toneBtnDown: {
    backgroundColor: '#FFEBEE',
  },
  toneBtnDownDark: {
    backgroundColor: '#3A1B1B',
  },
  toneDisplay: {
    flex: 1,
    height: 60,
    borderRadius: radii.md,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  toneDisplayDark: {
    backgroundColor: '#1C1C1E',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  toneDisplayActive: {
    backgroundColor: '#FFF4DA',
    borderColor: UIColors.accentYellow,
  },
  toneDisplayActiveDark: {
    backgroundColor: '#3A2D0A',
    borderColor: '#7A5A00',
  },
  toneDisplayValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  toneDisplayCaption: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9D5C00',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 1,
  },
  toneDisplayCaptionHidden: {
    opacity: 0,
  },
  capoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  capoStepBtn: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.35,
  },
  capoDisplay: {
    flex: 1,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  capoDisplayDark: {
    backgroundColor: '#1C1C1E',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  capoDisplayOverridden: {
    backgroundColor: '#FFF4DA',
    borderColor: UIColors.accentYellow,
  },
  capoDisplayOverriddenDark: {
    backgroundColor: '#3A2D0A',
    borderColor: '#7A5A00',
  },
  capoDisplayValue: {
    ...typography.body,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  capoDisplayBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9D5C00',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  capoDisplayBadgeHidden: {
    opacity: 0,
  },
});
