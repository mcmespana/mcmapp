import React, { useMemo } from 'react';
import { Text, StyleSheet, type TextStyle } from 'react-native';
import { h } from '@/utils/haptics';
import { tokenizeReading, normalizeSegment } from '@/utils/readingSegments';

interface HighlightableTextProps {
  text: string;
  /** Frases actualmente subrayadas (texto). */
  highlighted: string[];
  /** Si true, tocar una frase la subraya/quita; si false, solo lectura
   *  (la selección nativa por pulsación larga sigue disponible). */
  highlightMode: boolean;
  /** Devuelve la nueva lista de frases subrayadas tras alternar una. */
  onChange: (nextHighlighted: string[]) => void;
  color: string;
  fontSize: number;
  lineHeight: number;
  fontFamily?: string;
  isDark: boolean;
  style?: TextStyle;
}

/**
 * Texto de lectura con subrayado a nivel de frase.
 *
 * El `<Text>` contenedor es `selectable`, así que la selección nativa (copiar,
 * buscar, herramientas de escritura / IA en iOS) funciona con pulsación larga.
 * En modo subrayar, un toque simple alterna el marcado de la frase.
 */
export function HighlightableText({
  text,
  highlighted,
  highlightMode,
  onChange,
  color,
  fontSize,
  lineHeight,
  fontFamily,
  isDark,
  style,
}: HighlightableTextProps) {
  const tokens = useMemo(() => tokenizeReading(text), [text]);
  const highlightedSet = useMemo(
    () => new Set(highlighted.map(normalizeSegment)),
    [highlighted],
  );

  const markerBg = isDark ? 'rgba(218,165,32,0.32)' : 'rgba(233,171,45,0.34)';

  const toggle = (segment: string) => {
    const norm = normalizeSegment(segment);
    const current = highlighted.filter((s) => normalizeSegment(s) !== norm);
    if (highlightedSet.has(norm)) {
      h.remove();
      onChange(current);
    } else {
      h.add();
      onChange([...current, segment]);
    }
  };

  return (
    <Text
      selectable
      style={[
        styles.body,
        { color, fontSize, lineHeight, ...(fontFamily ? { fontFamily } : {}) },
        style,
      ]}
    >
      {tokens.map((tok, i) => {
        const isHl = highlightedSet.has(normalizeSegment(tok.text));
        return (
          <Text
            key={i}
            onPress={highlightMode ? () => toggle(tok.text) : undefined}
            suppressHighlighting={!highlightMode}
            style={isHl ? { backgroundColor: markerBg, color } : undefined}
          >
            {tok.text}
            {tok.breakAfter ? '\n' : i < tokens.length - 1 ? ' ' : ''}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  body: {
    fontWeight: '400',
  },
});
