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
import {
  DEFAULT_FONT_SIZE_EM,
  type SongSettings,
} from '@/contexts/SettingsContext';
import { CHORUS_STYLES, type ChorusStyle } from '@/utils/songSheetLayout';
import { UIColors } from '@/constants/colors';
import type { SheetPalette } from '@/components/song-sheet/sheetKit';
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
  /** Cómo se ve la hoja (estribillo, números, aire). Sin definir, no sale. */
  view?: SheetViewOptions;
}

export type SheetViewPatch = Partial<
  Pick<SongSettings, 'chorusStyle' | 'chorusLabel' | 'verseNumbers' | 'airy'>
>;

export interface SheetViewOptions {
  /** La canción tiene estribillo: se ofrecen sus variantes y la etiqueta. */
  hasChorus: boolean;
  /** La canción lleva números de estrofa. */
  hasVerseNumbers: boolean;
  chorusStyle: ChorusStyle;
  chorusLabel: boolean;
  verseNumbers: boolean;
  airy: boolean;
  onChange: (patch: SheetViewPatch) => void;
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
  view,
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
    <BottomSheet visible={visible} onClose={onClose} title="Letra y vista">
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

        {/* ━━━━━━━━━━━━━━ VISTA ━━━━━━━━━━━━━━ */}
        {view && <ViewCard palette={p} view={view} />}

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

/** Las variantes del estribillo dibujadas en pequeño, como se verán. */
function ChorusPreview({ id, color }: { id: ChorusStyle; color: string }) {
  const bold = id !== 'raya';
  const caps = id === 'mayus' || id === 'clasico';
  const bar = id === 'raya' || id === 'negrita' || id === 'mayus';
  return (
    <View
      style={[
        styles.chorusPreview,
        bar && styles.chorusPreviewBar,
        id === 'sangrado' && styles.chorusPreviewIndent,
      ]}
    >
      <Text
        style={[
          styles.chorusPreviewText,
          { color, fontWeight: bold ? '800' : '400' },
        ]}
      >
        {caps ? 'AA' : 'Aa'}
      </Text>
    </View>
  );
}

/**
 * Cómo se ve la hoja: variante del estribillo, su etiqueta, los números de
 * estrofa y el aire entre bloques. Todo se aplica en vivo (sin recargar).
 */
function ViewCard({
  palette: p,
  view,
}: {
  palette: SheetPalette;
  view: SheetViewOptions;
}) {
  const toggles: {
    key: string;
    icon: keyof typeof MaterialIcons.glyphMap;
    name: string;
    on: boolean;
    patch: SheetViewPatch;
  }[] = [];
  if (view.hasChorus) {
    toggles.push({
      key: 'label',
      icon: 'label-outline',
      name: 'Etiqueta',
      on: view.chorusLabel,
      patch: { chorusLabel: !view.chorusLabel },
    });
  }
  if (view.hasVerseNumbers) {
    toggles.push({
      key: 'nums',
      icon: 'format-list-numbered',
      name: 'Números',
      on: view.verseNumbers,
      patch: { verseNumbers: !view.verseNumbers },
    });
  }
  toggles.push({
    key: 'airy',
    icon: 'format-line-spacing',
    name: 'Más aire',
    on: view.airy,
    patch: { airy: !view.airy },
  });
  return (
    <SheetCard palette={p} label="Vista">
      {view.hasChorus && (
        <>
          <Text style={[styles.subLabel, { color: p.label }]}>Estribillo</Text>
          <View style={styles.chipWrap} accessibilityRole="radiogroup">
            {CHORUS_STYLES.map((c) => {
              const isActive = c.id === view.chorusStyle;
              const color = isActive ? p.active.fg : p.text;
              return (
                <PressableFeedback
                  key={c.id}
                  style={[
                    styles.fontChip,
                    styles.gridChip,
                    valueBoxStyle(p, isActive),
                  ]}
                  onPress={() => {
                    if (isActive) return;
                    h.select();
                    view.onChange({ chorusStyle: c.id });
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={`Estribillo: ${c.name}`}
                >
                  <PressableFeedback.Highlight />
                  <ChorusPreview id={c.id} color={color} />
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
                    {c.name}
                  </Text>
                </PressableFeedback>
              );
            })}
          </View>
        </>
      )}
      <View style={styles.fontGrid}>
        {toggles.map((t) => (
          <PressableFeedback
            key={t.key}
            style={[styles.fontChip, valueBoxStyle(p, t.on)]}
            onPress={() => {
              h.toggle();
              view.onChange(t.patch);
            }}
            accessibilityRole="switch"
            accessibilityState={{ checked: t.on }}
            accessibilityLabel={t.name}
          >
            <PressableFeedback.Highlight />
            <MaterialIcons
              name={t.icon}
              size={22}
              color={t.on ? p.active.fg : p.text}
            />
            <Text
              style={[
                styles.fontChipLabel,
                {
                  color: t.on ? p.active.fg : p.textSecondary,
                  fontWeight: t.on ? '700' : '500',
                },
              ]}
              numberOfLines={1}
            >
              {t.name}
            </Text>
          </PressableFeedback>
        ))}
      </View>
    </SheetCard>
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
  subLabel: {
    ...typography.micro,
    fontWeight: '600',
    marginBottom: -spacing.xs,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  // Tres por fila: cinco variantes no caben en una a ancho de móvil.
  gridChip: {
    flexGrow: 0,
    flexBasis: '30%',
  },
  chorusPreview: {
    height: 26,
    justifyContent: 'center',
  },
  chorusPreviewBar: {
    borderLeftWidth: 3,
    borderLeftColor: UIColors.accentYellow,
    paddingLeft: spacing.xs,
  },
  chorusPreviewIndent: {
    paddingLeft: spacing.sm,
  },
  chorusPreviewText: {
    ...typography.h3,
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
