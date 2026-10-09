import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@expo/vector-icons';
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
import { DEFAULT_FONT_SIZE_EM } from '@/contexts/SettingsContext';
import { getNativeFontFamily } from '@/utils/fontUtils';
import { h } from '@/utils/haptics';

interface FontOption {
  name: string;
  cssValue: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  availableFonts: FontOption[];
  currentFontSize: number;
  currentFontFamily: string;
  onSetFontSize: (size: number) => void;
  onSetFontFamily: (family: string) => void;
}

const MIN_SIZE = 0.6;
const MAX_SIZE = 2.0;
const STEP = 0.1;
/** Sumar 0,1 en coma flotante acaba en 1,2000000000000002: se redondea. */
const round1 = (n: number) => Math.round(n * 10) / 10;

export default function SongFontBottomSheet({
  visible,
  onClose,
  availableFonts,
  currentFontSize,
  currentFontFamily,
  onSetFontSize,
  onSetFontFamily,
}: Props) {
  const isDark = useColorScheme() === 'dark';
  const p = sheetPalette(isDark);

  const defaultFamily = availableFonts[0]?.cssValue ?? currentFontFamily;
  const isSizeModified =
    Math.abs(currentFontSize - DEFAULT_FONT_SIZE_EM) > 0.001;
  const isFontModified = currentFontFamily !== defaultFamily;
  const atMin = currentFontSize <= MIN_SIZE + 0.001;
  const atMax = currentFontSize >= MAX_SIZE - 0.001;
  const percentage = Math.round((currentFontSize / DEFAULT_FONT_SIZE_EM) * 100);
  const currentFontName =
    availableFonts.find((f) => f.cssValue === currentFontFamily)?.name ??
    'Personalizada';

  // Igual que el tono: al repetir manteniendo pulsado el prop llega con un
  // frame de retraso, y sin el ref se perdían pasos.
  const sizeRef = useRef(currentFontSize);
  useEffect(() => {
    sizeRef.current = currentFontSize;
  }, [currentFontSize]);

  const size = useValueFeedback(percentage);
  const stepSize = (delta: number) => {
    const next = round1(
      Math.min(MAX_SIZE, Math.max(MIN_SIZE, sizeRef.current + delta)),
    );
    if (next === round1(sizeRef.current)) return;
    sizeRef.current = next;
    h.select();
    onSetFontSize(next);
  };
  const sizeBlocked = () => {
    h.limit();
    size.nudge();
  };

  const resetAll = () => {
    h.tap();
    onSetFontSize(DEFAULT_FONT_SIZE_EM);
    onSetFontFamily(defaultFamily);
  };

  const previewFamily = getNativeFontFamily(currentFontFamily);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Tipo de letra">
      <View style={styles.container}>
        {/* ━━━━━━━━━━━━━━ TAMAÑO ━━━━━━━━━━━━━━ */}
        <SheetCard
          palette={p}
          label="Tamaño"
          status={isSizeModified ? 'Modificado' : 'Original'}
          statusActive={isSizeModified}
          onReset={() => {
            h.tap();
            onSetFontSize(DEFAULT_FONT_SIZE_EM);
          }}
          resetLabel="Volver al tamaño original"
        >
          <View style={styles.row}>
            <HoldStepButton
              palette={p}
              onStep={() => stepSize(-STEP)}
              onBlocked={sizeBlocked}
              disabled={atMin}
              accessibilityLabel="Letra más pequeña"
            >
              <Text
                style={[
                  styles.stepA,
                  styles.stepASmall,
                  { color: atMin ? p.disabled : p.text },
                ]}
              >
                A
              </Text>
            </HoldStepButton>

            <Animated.View
              style={[
                styles.valueBox,
                valueBoxStyle(p, isSizeModified),
                size.style,
              ]}
              accessibilityLiveRegion="polite"
              accessibilityLabel={`Tamaño de letra al ${percentage} por ciento`}
            >
              <Animated.Text
                style={[
                  styles.percent,
                  size.popStyle,
                  { color: isSizeModified ? p.active.fg : p.text },
                ]}
              >
                {percentage}%
              </Animated.Text>
              {/* Muestra de verdad: la letra de la canción a su tamaño, con la
                  fuente elegida. Recortada a la caja para que no la rompa. */}
              <View style={styles.previewWrap}>
                <Text
                  style={[
                    styles.preview,
                    {
                      color: p.textSecondary,
                      transform: [
                        {
                          scale: Math.min(
                            1.4,
                            Math.max(
                              0.6,
                              currentFontSize / DEFAULT_FONT_SIZE_EM,
                            ),
                          ),
                        },
                      ],
                    },
                    previewFamily ? { fontFamily: previewFamily } : null,
                  ]}
                >
                  Aa
                </Text>
              </View>
            </Animated.View>

            <HoldStepButton
              palette={p}
              onStep={() => stepSize(STEP)}
              onBlocked={sizeBlocked}
              disabled={atMax}
              accessibilityLabel="Letra más grande"
            >
              <Text
                style={[
                  styles.stepA,
                  styles.stepALarge,
                  { color: atMax ? p.disabled : p.text },
                ]}
              >
                A
              </Text>
            </HoldStepButton>
          </View>
        </SheetCard>

        {/* ━━━━━━━━━━━━━━ FUENTE ━━━━━━━━━━━━━━ */}
        <SheetCard
          palette={p}
          label="Fuente"
          status={currentFontName}
          statusActive={isFontModified}
          onReset={() => {
            h.tap();
            onSetFontFamily(defaultFamily);
          }}
          resetLabel="Volver a la fuente original"
        >
          <View style={styles.fontGrid} accessibilityRole="radiogroup">
            {availableFonts.map((font) => {
              const isActive = font.cssValue === currentFontFamily;
              const nativeFamily = getNativeFontFamily(font.cssValue);
              const color = isActive ? p.active.fg : p.text;
              return (
                <PressableFeedback
                  key={font.cssValue}
                  style={[styles.fontChip, valueBoxStyle(p, isActive)]}
                  onPress={() => {
                    if (isActive) return;
                    h.select();
                    onSetFontFamily(font.cssValue);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={font.name}
                >
                  <PressableFeedback.Highlight />
                  <Text
                    style={[
                      styles.fontChipPreview,
                      { color },
                      nativeFamily ? { fontFamily: nativeFamily } : null,
                    ]}
                  >
                    Aa
                  </Text>
                  <Text
                    style={[
                      styles.fontChipLabel,
                      {
                        color: isActive ? p.active.fg : p.textSecondary,
                        fontWeight: isActive ? '700' : '500',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {font.name}
                  </Text>
                </PressableFeedback>
              );
            })}
          </View>
        </SheetCard>

        {(isSizeModified || isFontModified) && (
          <PressableFeedback
            style={[styles.resetAll, { backgroundColor: p.group }]}
            onPress={resetAll}
            accessibilityRole="button"
          >
            <PressableFeedback.Highlight />
            <MaterialIcons name="refresh" size={16} color={p.textSecondary} />
            <Text style={[styles.resetAllText, { color: p.textSecondary }]}>
              Restablecer todo
            </Text>
          </PressableFeedback>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // Los ± del tamaño son una «A» pequeña y una grande: dicen qué hacen sin
  // tener que leer nada, como en los lectores de iOS.
  stepA: {
    fontWeight: '700',
  },
  stepASmall: {
    ...typography.subhead,
    fontWeight: '700',
  },
  stepALarge: {
    ...typography.h2,
    fontWeight: '700',
  },
  valueBox: {
    flex: 1,
    height: 64,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  percent: {
    ...typography.h2,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  previewWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  preview: {
    ...typography.h3,
    fontWeight: '600',
  },
  fontGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  fontChip: {
    flex: 1,
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  fontChipPreview: {
    ...typography.h2,
    fontWeight: '700',
    lineHeight: 26,
  },
  fontChipLabel: {
    ...typography.micro,
    textAlign: 'center',
  },
  resetAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: radii.md,
    gap: 6,
  },
  resetAllText: {
    ...typography.caption,
    fontWeight: '600',
  },
});
