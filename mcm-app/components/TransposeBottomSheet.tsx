import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Animated,
  Pressable,
} from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { h } from '@/utils/haptics';
import { MaterialIcons } from '@expo/vector-icons';
import BottomSheet from './BottomSheet';
import { Colors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';

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

/** Botón ±1 grande: un toque = un semitono; mantener pulsado repite. */
function HoldStepButton({
  onStep,
  style,
  children,
  accessibilityLabel,
}: {
  onStep: () => void;
  style: object | object[];
  children: React.ReactNode;
  accessibilityLabel: string;
}) {
  const delayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (delayTimer.current) clearTimeout(delayTimer.current);
    if (repeatTimer.current) clearInterval(repeatTimer.current);
    delayTimer.current = null;
    repeatTimer.current = null;
  };

  useEffect(() => stop, []);

  return (
    <Pressable
      onPressIn={() => {
        onStep();
        delayTimer.current = setTimeout(() => {
          repeatTimer.current = setInterval(onStep, HOLD_INTERVAL_MS);
        }, HOLD_DELAY_MS);
      }}
      onPressOut={stop}
      style={({ pressed }) => [
        ...(Array.isArray(style) ? style : [style]),
        pressed && { transform: [{ scale: 0.94 }], opacity: 0.85 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </Pressable>
  );
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

  // Pop del valor central en cada cambio de tono.
  const valuePop = useRef(new Animated.Value(1)).current;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    valuePop.setValue(1.18);
    Animated.spring(valuePop, {
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
      tension: 260,
      friction: 9,
    }).start();
  }, [currentTranspose, valuePop]);

  const handleCapoMinus = () => {
    if (!onSetCapoOverride) return;
    const next = effectiveCapo - 1;
    if (next < 0) return;
    onSetCapoOverride(next === (originalCapo ?? 0) ? null : next);
  };
  const handleCapoPlus = () => {
    if (!onSetCapoOverride) return;
    const next = effectiveCapo + 1;
    onSetCapoOverride(next === (originalCapo ?? 0) ? null : next);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Ajustes de canción">
      <View
        style={[
          styles.container,
          {
            paddingBottom: Platform.OS === 'web' ? 16 : 0,
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
              onPress={() => onSetTranspose(0)}
              isDisabled={!isTransposed}
              accessibilityLabel="Restablecer tono"
            >
              <PressableFeedback.Highlight />
              <MaterialIcons
                name="refresh"
                size={18}
                color={isDark ? '#AEAEB2' : '#636366'}
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

            <View
              style={[
                styles.toneDisplay,
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
                  {
                    transform: [{ scale: valuePop }],
                    color: isTransposed
                      ? isDark
                        ? '#F4C11E'
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
            </View>

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
                        : isDark
                          ? '#8E8E93'
                          : '#8E8E93',
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
                onPress={() => onSetCapoOverride!(null)}
                isDisabled={!isCapoOverridden}
                accessibilityLabel="Restablecer cejilla"
              >
                <PressableFeedback.Highlight />
                <MaterialIcons
                  name="refresh"
                  size={18}
                  color={isDark ? '#AEAEB2' : '#636366'}
                />
              </PressableFeedback>
            </View>

            <View style={styles.capoRow}>
              <PressableFeedback
                style={[
                  styles.capoStepBtn,
                  isDark ? styles.toneBtnDownDark : styles.toneBtnDown,
                  effectiveCapo <= 0 && styles.capoStepBtnDisabled,
                ]}
                onPress={() => {
                  h.select();
                  handleCapoMinus();
                }}
                isDisabled={effectiveCapo <= 0}
              >
                <PressableFeedback.Highlight />
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
              </PressableFeedback>

              <View
                style={[
                  styles.capoDisplay,
                  isCapoOverridden
                    ? isDark
                      ? styles.capoDisplayOverriddenDark
                      : styles.capoDisplayOverridden
                    : isDark
                      ? styles.capoDisplayDark
                      : null,
                ]}
              >
                <Text
                  style={[
                    styles.capoDisplayValue,
                    {
                      color: isCapoOverridden
                        ? isDark
                          ? '#F4C11E'
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
                </Text>
                <Text
                  style={[
                    styles.capoDisplayBadge,
                    !isCapoOverridden && styles.capoDisplayBadgeHidden,
                  ]}
                >
                  modificada
                </Text>
              </View>

              <PressableFeedback
                style={[
                  styles.capoStepBtn,
                  isDark ? styles.toneBtnUpDark : styles.toneBtnUp,
                ]}
                onPress={() => {
                  h.select();
                  handleCapoPlus();
                }}
              >
                <PressableFeedback.Highlight />
                <MaterialIcons
                  name="add"
                  size={26}
                  color={isDark ? '#81C784' : '#2E7D32'}
                />
              </PressableFeedback>
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
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#8E8E93',
  },
  cardValueWrap: {
    flex: 1,
    alignItems: 'center',
  },
  cardValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  resetIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  resetIconBtnHidden: {
    opacity: 0,
  },
  cardHint: {
    fontSize: 11,
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
    borderColor: '#F4C11E',
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
  capoStepBtnDisabled: {
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
    borderColor: '#F4C11E',
  },
  capoDisplayOverriddenDark: {
    backgroundColor: '#3A2D0A',
    borderColor: '#7A5A00',
  },
  capoDisplayValue: {
    fontSize: 16,
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
