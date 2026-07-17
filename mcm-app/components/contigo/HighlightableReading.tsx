import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  computeSpans,
  highlightBg,
  type HighlightRange,
} from '@/utils/highlightRanges';

export interface ReadingSelection {
  start: number;
  end: number;
}

interface HighlightableReadingProps {
  /** Texto CANÓNICO de la lectura (ver normalizeReadingText). */
  text: string;
  /** Rangos subrayados (offsets sobre el texto canónico). */
  ranges: HighlightRange[];
  /** Modo subrayar: monta la capa de selección nativa. */
  penMode: boolean;
  /** Selección nativa actual (null si no hay o es vacía). */
  onSelectionChange?: (sel: ReadingSelection | null) => void;
  color: string;
  fontSize: number;
  lineHeight: number;
  fontFamily?: string;
  isDark: boolean;
}

/**
 * Lectura con subrayados pastel y selección NATIVA de verdad.
 *
 * - Modo lectura: `Text` con spans de color; `selectable` para el gesto
 *   nativo básico de copiar.
 * - Modo subrayar: se superpone un `TextInput` multilínea de solo lectura con
 *   el MISMO texto y métricas pero glifos transparentes. El sistema pinta la
 *   selección nativa (asas de arrastre, lupa, menú de copiar / herramientas de
 *   escritura de iOS) sobre el texto visible, y `onSelectionChange` nos da el
 *   inicio y el fin exactos para subrayar.
 */
export function HighlightableReading({
  text,
  ranges,
  penMode,
  onSelectionChange,
  color,
  fontSize,
  lineHeight,
  fontFamily,
  isDark,
}: HighlightableReadingProps) {
  const spans = useMemo(() => computeSpans(text, ranges), [text, ranges]);

  // Al salir del modo subrayar (o desmontar), la selección deja de existir.
  const onSelRef = useRef(onSelectionChange);
  onSelRef.current = onSelectionChange;
  useEffect(() => {
    if (!penMode) onSelRef.current?.(null);
    return () => onSelRef.current?.(null);
  }, [penMode]);

  const textStyle = {
    color,
    fontSize,
    lineHeight,
    ...(fontFamily ? { fontFamily } : {}),
  } as const;

  return (
    <View>
      <Text selectable={!penMode} style={[styles.base, textStyle]}>
        {spans.map((s, i) =>
          s.color ? (
            <Text
              key={i}
              style={{ backgroundColor: highlightBg(s.color, isDark) }}
            >
              {s.text}
            </Text>
          ) : (
            <Text key={i}>{s.text}</Text>
          ),
        )}
      </Text>

      {penMode ? (
        <TextInput
          style={[styles.base, styles.selectionLayer, textStyle]}
          value={text}
          multiline
          scrollEnabled={false}
          // iOS: UITextView de solo lectura sigue siendo seleccionable con
          // asas nativas. Android necesita editable para poder seleccionar;
          // el valor controlado + sin teclado impide cualquier edición real.
          editable={Platform.OS === 'android'}
          showSoftInputOnFocus={false}
          caretHidden
          onChangeText={() => {}}
          autoCorrect={false}
          spellCheck={false}
          onSelectionChange={(e) => {
            const { start, end } = e.nativeEvent.selection;
            onSelRef.current?.(
              end > start
                ? { start: Math.min(start, end), end: Math.max(start, end) }
                : null,
            );
          }}
          accessibilityLabel="Selecciona el texto que quieres subrayar"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    fontWeight: '400',
    letterSpacing: 0,
    ...(Platform.OS === 'android'
      ? { includeFontPadding: false as const }
      : {}),
  },
  selectionLayer: {
    ...StyleSheet.absoluteFillObject,
    // Glifos invisibles: solo se ve la selección nativa del sistema por
    // encima del texto real de debajo.
    color: 'transparent',
    padding: 0,
    paddingTop: 0,
    margin: 0,
    textAlignVertical: 'top',
    backgroundColor: 'transparent',
  },
});
