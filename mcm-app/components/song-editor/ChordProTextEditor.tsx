/**
 * El ChordPro a mano, en colores (como el editor del admin del cantoral) y
 * con lo que está mal marcado: corchetes o llaves sin cerrar, estribillos sin
 * cerrar, acordes que no lo parecen. Debajo, la lista de avisos con su línea.
 *
 * Cómo se colorea un campo de texto:
 * - iOS/Android: `TextInput` admite `<Text>` como hijos con estilo propio; el
 *   texto sigue siendo editable y el cursor no se mueve.
 * - Web: el `<textarea>` no pinta partes en color, así que va transparente
 *   (se ve solo el cursor) encima de una copia coloreada con la MISMA letra,
 *   tamaño, interlineado y márgenes. Solo cambia el color, nunca la medida.
 */
import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@/components/ui/icons';
import { ChordProColors, themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';
import { h } from '@/utils/haptics';
import {
  lintChordPro,
  tokenizeLine,
  type Token,
  type TokenKind,
} from '@/utils/chordProLint';

const MONO = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, Menlo, Consolas, monospace',
});
const FONT = 15;
const LINE = 24;
const isWeb = Platform.OS === 'web';

interface Props {
  value: string;
  onChange: (text: string) => void;
}

export default function ChordProTextEditor({ value, onChange }: Props) {
  const isDark = useColorScheme() === 'dark';
  const theme = themeColors(isDark);
  const palette = isDark ? ChordProColors.dark : ChordProColors.light;
  const issues = useMemo(() => lintChordPro(value), [value]);

  const colorOf = (kind: TokenKind) =>
    kind === 'text' ? theme.text : palette[kind];

  const lines = useMemo(() => value.split('\n').map(tokenizeLine), [value]);
  const painted = lines.map((tokens, i) => (
    <React.Fragment key={i}>
      {tokens.map((t: Token, j) => (
        <Text
          key={j}
          style={[
            { color: colorOf(t.kind) },
            // En web la copia y el textarea tienen que medir igual: sin negrita.
            !isWeb && (t.kind === 'chord' || t.kind === 'section')
              ? styles.bold
              : undefined,
            t.kind === 'error' && {
              backgroundColor: palette.errorBg,
              textDecorationLine: 'underline',
              textDecorationColor: palette.error,
            },
          ]}
        >
          {t.text}
        </Text>
      ))}
      {i < lines.length - 1 ? '\n' : null}
    </React.Fragment>
  ));

  const box = [styles.box, { backgroundColor: theme.backgroundSunken }];
  const placeholder = '[Do]Letra con los a[Sol]cordes entre corchetes';

  return (
    <View style={styles.root}>
      {isWeb ? (
        <View style={box}>
          {/* La copia coloreada marca el alto; el textarea transparente va
              encima, ocupándola entera. */}
          <Text
            style={[styles.code, styles.webCopy]}
            aria-hidden
            pointerEvents="none"
          >
            {painted}
            {/* Un salto final se come una línea si no hay nada detrás. */}
            {'​'}
          </Text>
          <TextInput
            value={value}
            onChangeText={onChange}
            multiline
            autoCapitalize="sentences"
            autoCorrect={false}
            spellCheck={false}
            scrollEnabled={false}
            placeholder={placeholder}
            placeholderTextColor={theme.textMuted}
            style={[
              styles.code,
              styles.input,
              {
                color: 'transparent',
                caretColor: theme.text,
              } as object,
            ]}
            accessibilityLabel="Letra y acordes en ChordPro"
          />
        </View>
      ) : (
        <TextInput
          onChangeText={onChange}
          multiline
          autoCapitalize="sentences"
          autoCorrect={false}
          spellCheck={false}
          scrollEnabled={false}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          style={[box, styles.code, styles.native, { color: theme.text }]}
          accessibilityLabel="Letra y acordes en ChordPro"
        >
          {painted}
        </TextInput>
      )}

      {issues.length > 0 ? (
        <View
          style={[styles.issues, { backgroundColor: palette.errorBg }]}
          accessibilityRole="summary"
        >
          {issues.map((issue, i) => (
            <View key={i} style={styles.issue}>
              <Text style={[styles.issueLine, { color: palette.error }]}>
                {`L${issue.line}`}
              </Text>
              <Text style={[styles.issueText, { color: theme.text }]}>
                {issue.message}
              </Text>
            </View>
          ))}
        </View>
      ) : value.trim() ? (
        <View style={styles.ok}>
          <MaterialIcons
            name="check-circle"
            size={16}
            color={theme.textSecondary}
          />
          <Text style={[styles.okText, { color: theme.textSecondary }]}>
            Todo cerrado y en su sitio
          </Text>
        </View>
      ) : null}

      <Legend palette={palette} textColor={theme.textSecondary} />
    </View>
  );
}

/** Qué significa cada color, una vez y pequeño. */
function Legend({
  palette,
  textColor,
}: {
  palette: (typeof ChordProColors)['light' | 'dark'];
  textColor: string;
}) {
  const items: [string, string][] = [
    ['[Acorde]', palette.chord],
    ['{soc} Estribillo', palette.section],
    ['{c: Nota}', palette.comment],
    ['{arr: Arreglo}', palette.arr],
    ['Error', palette.error],
  ];
  return (
    <View style={styles.legend} accessibilityElementsHidden>
      {items.map(([label, color]) => (
        <Text key={label} style={[styles.legendItem, { color }]}>
          {label}
        </Text>
      ))}
      <Text style={[styles.legendItem, { color: textColor }]}> </Text>
    </View>
  );
}

/** Atajos para insertar lo típico al final. */
export function ChordProHelpers({
  onInsert,
}: {
  onInsert: (snippet: string) => void;
}) {
  const theme = themeColors(useColorScheme() === 'dark');
  const items: [string, string][] = [
    ['Estribillo', '\n\n{soc}\n\n{eoc}\n'],
    ['Estrofa', '\n\n{sov}\n\n{eov}\n'],
    ['Repite estribillo', '\n\n{chorus}\n'],
    ['Nota', '\n{comment: }\n'],
  ];
  return (
    <View style={styles.helpers}>
      {items.map(([label, snippet]) => (
        <PressableFeedback
          key={label}
          onPress={() => {
            h.tap();
            onInsert(snippet);
          }}
          style={[styles.helper, { backgroundColor: theme.backgroundSunken }]}
          accessibilityRole="button"
          accessibilityLabel={`Añadir ${label}`}
        >
          <MaterialIcons name="add" size={16} color={theme.link} />
          <Text style={[styles.helperText, { color: theme.link }]}>
            {label}
          </Text>
        </PressableFeedback>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  box: { borderRadius: radii.md, minHeight: 320 },
  code: {
    fontFamily: MONO,
    fontSize: FONT,
    lineHeight: LINE,
    padding: spacing.md,
  },
  webCopy: { minHeight: 320 },
  input: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    textAlignVertical: 'top',
    // El textarea de web no hereda estos ajustes de la copia: se igualan.
    ...({
      outlineStyle: 'none',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'break-word',
      backgroundColor: 'transparent',
      resize: 'none',
    } as object),
  },
  native: { textAlignVertical: 'top' },
  bold: { fontWeight: '700' },
  issues: { borderRadius: radii.md, padding: spacing.sm, gap: spacing.xs },
  issue: { flexDirection: 'row', gap: spacing.sm },
  issueLine: {
    ...typography.caption,
    fontWeight: '700',
    minWidth: 36,
    fontVariant: ['tabular-nums'],
  },
  issueText: { ...typography.caption, flex: 1 },
  ok: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  okText: { ...typography.caption },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md },
  legendItem: { fontFamily: MONO, fontSize: 12, lineHeight: 18 },
  helpers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  helper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.md - spacing.xs,
    borderRadius: radii.xl,
    alignSelf: 'flex-start',
  },
  helperText: { ...typography.caption, fontWeight: '600' },
});
