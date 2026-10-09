import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { h } from '@/utils/haptics';
import BottomSheet from './BottomSheet';
import {
  HoldStepButton,
  SheetCard,
  sheetPalette,
  useValueFeedback,
  valueBoxStyle,
} from '@/components/song-sheet/sheetKit';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { useColorScheme } from '@/hooks/useColorScheme';
import { convertChord, type Notation } from '@/utils/chordNotation';
import { transposeKey } from '@/utils/transposeKey';

interface Props {
  visible: boolean;
  onClose: () => void;
  currentTranspose: number;
  onSetTranspose: (value: number) => void;
  /**
   * Tonalidad original de la canción (`{key:}` del cantoral). Con ella la hoja
   * habla en tonos —«Re → Mi»— y no solo en semitonos, que es como piensa
   * quien toca. Sin ella, cae a «+2 semitonos» como antes.
   */
  songKey?: string;
  notation?: Notation;
  /** Cejilla original de la canción (del cantoral). */
  originalCapo?: number;
  /** Override de cejilla para esta sesión/playlist. null = sin override. */
  currentCapoOverride?: number | null;
  onSetCapoOverride?: (capo: number | null) => void;
}

const semitonesLabel = (n: number) =>
  `${n > 0 ? '+' : ''}${n} ${Math.abs(n) === 1 ? 'semitono' : 'semitonos'}`;

export default function TransposeBottomSheet({
  visible,
  onClose,
  currentTranspose,
  onSetTranspose,
  songKey,
  notation = 'ES',
  originalCapo,
  currentCapoOverride,
  onSetCapoOverride,
}: Props) {
  const isDark = useColorScheme() === 'dark';
  const p = sheetPalette(isDark);

  const showCapoSection = onSetCapoOverride !== undefined;
  const isCapoOverridden =
    currentCapoOverride !== null && currentCapoOverride !== undefined;
  const baseCapo = originalCapo ?? 0;
  const effectiveCapo = isCapoOverridden
    ? (currentCapoOverride as number)
    : baseCapo;
  const isTransposed = currentTranspose !== 0;

  /** Nombre del tono a `n` semitonos del original, en la notación elegida. */
  const keyAt = (n: number) =>
    songKey
      ? convertChord(transposeKey(songKey.toUpperCase(), n), notation)
      : '';

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

  const tone = useValueFeedback(currentTranspose);
  const capo = useValueFeedback(effectiveCapo);

  const setCapo = (next: number) => {
    if (!onSetCapoOverride || next < 0) return;
    h.select();
    onSetCapoOverride(next === baseCapo ? null : next);
  };
  /** Cejilla al mínimo: no se puede bajar más, pero se avisa. */
  const capoBlocked = () => {
    h.limit();
    capo.nudge();
  };

  const currentKey = keyAt(currentTranspose);
  const originalKey = keyAt(0);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Ajustes de canción">
      <View style={styles.container}>
        {/* ━━━━━━━━━━━━━━ TONO ━━━━━━━━━━━━━━ */}
        <SheetCard
          palette={p}
          label="Tono"
          status={isTransposed ? semitonesLabel(currentTranspose) : 'Original'}
          statusActive={isTransposed}
          onReset={() => {
            h.tap();
            onSetTranspose(0);
          }}
          resetLabel="Volver al tono original"
        >
          <View style={styles.row}>
            <HoldStepButton
              palette={p}
              onStep={() => stepTone(-1)}
              accessibilityLabel={
                songKey
                  ? `Bajar un semitono, a ${keyAt(currentTranspose - 1)}`
                  : 'Bajar un semitono'
              }
            >
              <Text style={[styles.stepGlyph, { color: p.text }]}>−</Text>
              {songKey ? (
                <Text
                  style={[styles.stepKey, { color: p.textSecondary }]}
                  numberOfLines={1}
                >
                  {keyAt(currentTranspose - 1)}
                </Text>
              ) : null}
            </HoldStepButton>

            <Animated.View
              style={[
                styles.valueBox,
                valueBoxStyle(p, isTransposed),
                tone.style,
              ]}
              accessibilityLiveRegion="polite"
              accessibilityLabel={
                songKey
                  ? isTransposed
                    ? `Tono ${currentKey}, original ${originalKey}`
                    : `Tono original, ${originalKey}`
                  : isTransposed
                    ? semitonesLabel(currentTranspose)
                    : 'Tono original'
              }
            >
              <Animated.Text
                style={[
                  styles.valueMain,
                  tone.popStyle,
                  { color: isTransposed ? p.active.fg : p.text },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {songKey
                  ? currentKey
                  : isTransposed
                    ? `${currentTranspose > 0 ? '+' : ''}${currentTranspose}`
                    : 'Original'}
              </Animated.Text>
              <Text
                style={[
                  styles.valueCaption,
                  { color: isTransposed ? p.active.fg : p.label },
                ]}
                numberOfLines={1}
              >
                {songKey
                  ? isTransposed
                    ? `Original: ${originalKey}`
                    : 'Tono original'
                  : isTransposed
                    ? Math.abs(currentTranspose) === 1
                      ? 'semitono'
                      : 'semitonos'
                    : ' '}
              </Text>
            </Animated.View>

            <HoldStepButton
              palette={p}
              onStep={() => stepTone(1)}
              accessibilityLabel={
                songKey
                  ? `Subir un semitono, a ${keyAt(currentTranspose + 1)}`
                  : 'Subir un semitono'
              }
            >
              <Text style={[styles.stepGlyph, { color: p.text }]}>+</Text>
              {songKey ? (
                <Text
                  style={[styles.stepKey, { color: p.textSecondary }]}
                  numberOfLines={1}
                >
                  {keyAt(currentTranspose + 1)}
                </Text>
              ) : null}
            </HoldStepButton>
          </View>
          <Text style={[styles.hint, { color: p.label }]}>
            Mantén pulsado para ir rápido
          </Text>
        </SheetCard>

        {/* ━━━━━━━━━━━━━━ CEJILLA ━━━━━━━━━━━━━━ */}
        {showCapoSection && (
          <SheetCard
            palette={p}
            label="Cejilla"
            status={
              baseCapo > 0
                ? `Original: ${baseCapo}`
                : isCapoOverridden
                  ? 'Original: sin cejilla'
                  : 'Sin cejilla'
            }
            statusActive={isCapoOverridden}
            onReset={() => {
              h.tap();
              onSetCapoOverride!(null);
            }}
            resetLabel="Volver a la cejilla original"
          >
            <View style={styles.row}>
              <HoldStepButton
                palette={p}
                onStep={() => setCapo(effectiveCapo - 1)}
                onBlocked={capoBlocked}
                disabled={effectiveCapo <= 0}
                accessibilityLabel="Bajar la cejilla un traste"
              >
                <MaterialIcons
                  name="remove"
                  size={26}
                  color={effectiveCapo <= 0 ? p.disabled : p.text}
                />
              </HoldStepButton>

              <Animated.View
                style={[
                  styles.valueBox,
                  valueBoxStyle(p, isCapoOverridden),
                  capo.style,
                ]}
                accessibilityLiveRegion="polite"
              >
                <Animated.Text
                  style={[
                    styles.valueMainSmall,
                    capo.popStyle,
                    { color: isCapoOverridden ? p.active.fg : p.text },
                  ]}
                >
                  {effectiveCapo === 0
                    ? 'Sin cejilla'
                    : `Traste ${effectiveCapo}`}
                </Animated.Text>
                {isCapoOverridden ? (
                  <Text style={[styles.valueCaption, { color: p.active.fg }]}>
                    Cambiada
                  </Text>
                ) : null}
              </Animated.View>

              <HoldStepButton
                palette={p}
                onStep={() => setCapo(effectiveCapo + 1)}
                accessibilityLabel="Subir la cejilla un traste"
              >
                <MaterialIcons name="add" size={26} color={p.text} />
              </HoldStepButton>
            </View>
          </SheetCard>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.xs,
    // El safe-area inferior lo reserva ya el `BottomSheet`; esto es el aire
    // visual entre la última fila y ese borde.
    paddingBottom: spacing.md,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepGlyph: {
    ...typography.h2,
    lineHeight: 26,
  },
  stepKey: {
    ...typography.micro,
    fontWeight: '600',
    marginTop: 1,
  },
  valueBox: {
    flex: 1,
    height: 64,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  valueMain: {
    ...typography.h2,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  valueMainSmall: {
    ...typography.title,
    fontWeight: '700',
  },
  valueCaption: {
    ...typography.overline,
    marginTop: 2,
  },
  hint: {
    ...typography.micro,
    textAlign: 'center',
    marginTop: -4,
  },
});
