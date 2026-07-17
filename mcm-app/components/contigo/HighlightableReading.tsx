import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput } from 'react-native';
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
  /** Modo subrayar: muestra la capa de selección nativa. */
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
 * - Modo lectura: `Text` con spans de color pastel; `selectable` para el
 *   gesto nativo básico de copiar.
 * - Modo subrayar: el texto se muestra COMO un `TextInput` multilínea de solo
 *   lectura (una única capa — nada de superposiciones que se desalineen). El
 *   sistema da la selección nativa completa: asas de arrastre, lupa y menú de
 *   copiar / herramientas de escritura de iOS. `onSelectionChange` entrega el
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

  // Altura del TextInput multilínea: seguimos el tamaño de su contenido para
  // que crezca como un texto normal dentro del scroll.
  const [inputHeight, setInputHeight] = useState<number | undefined>(undefined);

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

  if (penMode) {
    return (
      <TextInput
        style={[
          styles.base,
          styles.input,
          textStyle,
          { minHeight: lineHeight, height: inputHeight },
        ]}
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
        onContentSizeChange={(e) =>
          setInputHeight(Math.ceil(e.nativeEvent.contentSize.height))
        }
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
    );
  }

  return (
    <Text selectable style={[styles.base, textStyle]}>
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
  input: {
    padding: 0,
    paddingTop: 0,
    margin: 0,
    textAlignVertical: 'top',
    backgroundColor: 'transparent',
  },
});
