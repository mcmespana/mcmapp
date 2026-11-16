/**
 * Editor visual de acordes. La letra va en letra de ancho fijo y partida en
 * filas que caben en pantalla; cada acorde es una pastilla encima de su
 * sílaba. Con el ancho fijo, «dónde cae» es aritmética (columna × ancho de
 * letra), y por eso se puede arrastrar con el dedo y soltar con precisión.
 *
 * - Tocar la letra: acorde nuevo en esa sílaba.
 * - Arrastrar una pastilla: moverla (también a otra fila de la misma línea).
 * - Tocar una pastilla: seleccionarla (la barra de abajo la cambia, la mueve
 *   letra a letra o la quita).
 *
 * La letra NO se edita aquí (eso es la pestaña Texto): así un dedo torpe no
 * puede romper una estrofa.
 */
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { KeyPillColors, themeColors } from '@/constants/colors';
import { springs } from '@/constants/animations';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';
import { convertChord, type Notation } from '@/utils/chordNotation';
import { h } from '@/utils/haptics';
import {
  moveChord,
  parseEditorLine,
  serializeEditorLine,
  wrapRows,
  type EditorLine,
} from '@/utils/songEditor';

const MONO = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, Menlo, Consolas, monospace',
});
const FONT = 15;
const LYRIC_H = 24;
const CHORD_H = 26;
const ROW_H = LYRIC_H + CHORD_H + spacing.xs;
const SAMPLE = '0000000000000000000000000000000000000000';

export interface ChordRef {
  line: number;
  index: number;
}

interface Props {
  body: string;
  onChange: (body: string) => void;
  notation: Notation;
  selected: ChordRef | null;
  onSelect: (ref: ChordRef | null) => void;
  /** Tocar la letra: pedir un acorde para esa posición. */
  onAddAt: (line: number, pos: number) => void;
}

const SECTION_LABELS: [RegExp, string][] = [
  [/^\{\s*(soc|start_of_chorus)\b/i, 'Estribillo'],
  [/^\{\s*(sov|start_of_verse)\b/i, 'Estrofa'],
  [/^\{\s*(sob|start_of_bridge)\b/i, 'Puente'],
  [/^\{\s*chorus\b/i, 'Se repite el estribillo'],
];

function otherLabel(raw: string): string | null {
  const t = raw.trim();
  if (/^\{\s*(eoc|eov|eob|end_of_\w+)\s*\}$/i.test(t)) return null;
  for (const [rx, label] of SECTION_LABELS) if (rx.test(t)) return label;
  const comment = t.match(/^\{\s*(comment|c|ci|arr)\s*:\s*(.*)\}$/i);
  if (comment) return comment[2];
  return t;
}

export default function ChordGrid({
  body,
  onChange,
  notation,
  selected,
  onSelect,
  onAddAt,
}: Props) {
  const isDark = useColorScheme() === 'dark';
  const theme = themeColors(isDark);
  const [width, setWidth] = useState(0);
  const [charW, setCharW] = useState(0);

  const rawLines = useMemo(() => body.split('\n'), [body]);
  const lines = useMemo(() => rawLines.map(parseEditorLine), [rawLines]);
  // Una columna de margen: el ancho medido puede quedarse una décima corto y
  // la última letra de una fila llena se recortaría.
  const cols =
    charW > 0 && width > 0 ? Math.max(8, Math.floor(width / charW) - 1) : 0;

  const commit = (lineIndex: number, next: EditorLine) => {
    const out = rawLines.slice();
    out[lineIndex] = serializeEditorLine(next);
    onChange(out.join('\n'));
  };

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={styles.root}
    >
      {/* Mide el ancho de una letra en esta fuente y este tamaño. */}
      <Text
        style={[styles.lyric, styles.probe]}
        onLayout={(e) => setCharW(e.nativeEvent.layout.width / SAMPLE.length)}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {SAMPLE}
      </Text>
      {cols > 0 &&
        lines.map((line, i) => {
          if (line.kind === 'other') {
            const label = otherLabel(line.raw);
            if (label === null) return <View key={i} style={styles.gap} />;
            return (
              <Text
                key={i}
                style={[styles.other, { color: theme.textSecondary }]}
                numberOfLines={1}
              >
                {label}
              </Text>
            );
          }
          if (!line.lyrics.trim() && line.chords.length === 0) {
            return <View key={i} style={styles.gap} />;
          }
          return (
            <LyricsLine
              key={i}
              line={line}
              lineIndex={i}
              cols={cols}
              charW={charW}
              notation={notation}
              selectedIndex={selected?.line === i ? selected.index : -1}
              onSelect={onSelect}
              onAddAt={onAddAt}
              onMove={(index, pos) => {
                h.select();
                commit(i, moveChord(line, index, pos));
                onSelect({ line: i, index });
              }}
              isDark={isDark}
            />
          );
        })}
    </View>
  );
}

interface LineProps {
  line: Extract<EditorLine, { kind: 'lyrics' }>;
  lineIndex: number;
  cols: number;
  charW: number;
  notation: Notation;
  selectedIndex: number;
  onSelect: (ref: ChordRef | null) => void;
  onAddAt: (line: number, pos: number) => void;
  onMove: (index: number, pos: number) => void;
  isDark: boolean;
}

function LyricsLine({
  line,
  lineIndex,
  cols,
  charW,
  notation,
  selectedIndex,
  onSelect,
  onAddAt,
  onMove,
  isDark,
}: LineProps) {
  const theme = themeColors(isDark);
  // Una línea solo de acordes (intro) necesita sitio para ellos.
  const lyrics = line.lyrics;
  const rows = useMemo(() => wrapRows(lyrics, cols), [lyrics, cols]);

  const rowOf = (pos: number) => {
    for (let r = 0; r < rows.length; r++) {
      if (pos < rows[r].end || r === rows.length - 1) return r;
    }
    return 0;
  };

  // Dónde se pinta cada pastilla: en su columna, o empujada a la derecha si
  // pisaría a la anterior de su fila.
  const placed = useMemo(() => {
    const out: { index: number; row: number; x: number; label: string }[] = [];
    const lastEnd: number[] = rows.map(() => 0);
    line.chords
      .map((c, index) => ({ c, index }))
      .sort((a, b) => a.c.pos - b.c.pos || a.index - b.index)
      .forEach(({ c, index }) => {
        const row = rowOf(c.pos);
        const label = convertChord(c.name, notation);
        const want = (c.pos - rows[row].start) * charW;
        const x = Math.max(want, lastEnd[row]);
        lastEnd[row] = x + label.length * charW * 0.95 + spacing.md;
        out.push({ index, row, x, label });
      });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line.chords, rows, charW, notation]);

  return (
    <View style={{ height: rows.length * ROW_H }}>
      {rows.map((row, r) => (
        <Pressable
          key={r}
          style={[styles.row, { top: r * ROW_H }]}
          onPress={(e) => {
            const col = Math.round(e.nativeEvent.locationX / charW);
            const pos = Math.min(row.end, row.start + Math.max(0, col));
            onSelect(null);
            onAddAt(lineIndex, pos);
          }}
          accessibilityRole="button"
          accessibilityLabel={`Añadir acorde en: ${lyrics.slice(row.start, row.end).trim() || 'línea de acordes'}`}
        >
          <Text
            style={[styles.lyric, { color: theme.text }]}
            numberOfLines={1}
            ellipsizeMode="clip"
            allowFontScaling={false}
          >
            {lyrics.slice(row.start, row.end) || ' '}
          </Text>
        </Pressable>
      ))}
      {placed.map((p) => (
        <ChordPill
          key={`${p.index}-${line.chords[p.index].pos}-${p.label}`}
          label={p.label}
          x={p.x}
          y={p.row * ROW_H}
          selected={p.index === selectedIndex}
          isDark={isDark}
          onTap={() => {
            h.tap();
            onSelect(
              p.index === selectedIndex
                ? null
                : { line: lineIndex, index: p.index },
            );
          }}
          onDrop={(dx, dy) => {
            const row = Math.max(
              0,
              Math.min(rows.length - 1, p.row + Math.round(dy / ROW_H)),
            );
            const want =
              (line.chords[p.index].pos - rows[p.row].start) * charW + dx;
            const col = Math.max(0, Math.round(want / charW));
            const pos = Math.min(rows[row].end, rows[row].start + col);
            onMove(p.index, pos);
          }}
        />
      ))}
    </View>
  );
}

function ChordPill({
  label,
  x,
  y,
  selected,
  isDark,
  onTap,
  onDrop,
}: {
  label: string;
  x: number;
  y: number;
  selected: boolean;
  isDark: boolean;
  onTap: () => void;
  onDrop: (dx: number, dy: number) => void;
}) {
  const theme = themeColors(isDark);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const lifted = useSharedValue(0);

  const pan = Gesture.Pan()
    .minDistance(4)
    .onStart(() => {
      lifted.set(1);
    })
    .onUpdate((e) => {
      tx.set(e.translationX);
      ty.set(e.translationY);
    })
    .onEnd((e) => {
      scheduleOnRN(onDrop, e.translationX, e.translationY);
    })
    .onFinalize(() => {
      tx.set(withSpring(0, springs.snap));
      ty.set(withSpring(0, springs.snap));
      lifted.set(0);
    });
  const tap = Gesture.Tap().onEnd(() => {
    scheduleOnRN(onTap);
  });
  const gesture = Gesture.Exclusive(pan, tap);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.get() },
      { translateY: ty.get() },
      { scale: 1 + lifted.get() * 0.08 },
    ],
    zIndex: lifted.get() ? 10 : 1,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.pill,
          {
            left: x,
            top: y,
            backgroundColor: selected
              ? theme.link
              : isDark
                ? KeyPillColors.bgDark
                : KeyPillColors.bgLight,
          },
          style,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Acorde ${label}`}
        accessibilityState={{ selected }}
      >
        <Text
          style={[
            styles.pillText,
            { color: selected ? theme.background : theme.link },
          ]}
          allowFontScaling={false}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%' },
  probe: { position: 'absolute', opacity: 0, left: 0, top: 0 },
  gap: { height: spacing.md },
  other: {
    ...typography.sectionLabel,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW_H,
    justifyContent: 'flex-end',
  },
  lyric: {
    fontFamily: MONO,
    fontSize: FONT,
    lineHeight: LYRIC_H,
    height: LYRIC_H,
  },
  pill: {
    position: 'absolute',
    height: CHORD_H - 2,
    paddingHorizontal: spacing.xs + 2,
    borderRadius: radii.sm,
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'grab' } as object) : null),
  },
  pillText: {
    fontFamily: MONO,
    fontSize: FONT - 1,
    fontWeight: '700',
  },
});
