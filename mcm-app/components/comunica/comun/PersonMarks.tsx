// Las marcas de un chaval como pastillas de texto, bajo su nombre (plan 05,
// regla 9; `MIS-GRUPOS.md` §8 bis): como mucho «No se va solo/a», «Sin fotos»
// y «Alergia o tratamiento», en ese orden. Las decide el servidor con el «0»
// explícito; la app no las deriva.
//
// La de salud NO dice cuál ni qué, tampoco al lector de pantalla: «Alergia o
// tratamiento: ver el detalle». Tocarla abre la hoja de salud (si se da
// `onHealth`; en la lista de marcar no).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { radii } from '@/constants/uiStyles';
import typography from '@/constants/typography';
import type { PersonBadges } from '@/services/comunica/contract';
import { h } from '@/utils/haptics';
import { useComunicaTheme } from './useComunicaTheme';

export const MARK_TEXT = {
  notHomeAlone: 'No se va solo/a',
  noPhotos: 'Sin fotos',
  healthNote: 'Alergia o tratamiento',
} as const;

export const HEALTH_MARK_A11Y = 'Alergia o tratamiento: ver el detalle';

/** Lo que dice el lector de las marcas (nunca el texto de la salud). */
export function marksA11y(b: PersonBadges): string {
  return [
    b.notHomeAlone && MARK_TEXT.notHomeAlone,
    b.noPhotos && MARK_TEXT.noPhotos,
    b.healthNote && HEALTH_MARK_A11Y,
  ]
    .filter(Boolean)
    .join(', ');
}

export const hasMarks = (b: PersonBadges) =>
  b.notHomeAlone || b.noPhotos || b.healthNote;

export default function PersonMarks({
  badges,
  onHealth,
}: {
  badges: PersonBadges;
  onHealth?: () => void;
}) {
  const t = useComunicaTheme();
  if (!hasMarks(badges)) return null;
  const neutral = t.chip('neutral');
  const warn = t.chip('warning');
  const pill = (text: string, tone: typeof neutral) => (
    <View style={[styles.pill, { backgroundColor: tone.background }]}>
      <Text style={[styles.text, { color: tone.text }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
  return (
    <View style={styles.row}>
      {badges.notHomeAlone ? pill(MARK_TEXT.notHomeAlone, warn) : null}
      {badges.noPhotos ? pill(MARK_TEXT.noPhotos, neutral) : null}
      {badges.healthNote ? (
        onHealth ? (
          // 44 pt de área táctil DE VERDAD, con la pastilla centrada dentro:
          // con `hitSlop` se quedaba en ~40 y se metía en la fila de al lado.
          <PressableFeedback
            onPress={() => {
              h.select();
              onHealth();
            }}
            accessibilityRole="button"
            accessibilityLabel={HEALTH_MARK_A11Y}
            style={styles.healthTarget}
          >
            <View
              style={[
                styles.pill,
                styles.health,
                { backgroundColor: warn.background },
              ]}
            >
              <IconSymbol
                name="cross.case.fill"
                size={12}
                color={t.warningIcon}
              />
              <Text style={[styles.text, { color: warn.text }]}>
                {MARK_TEXT.healthNote}
              </Text>
            </View>
          </PressableFeedback>
        ) : (
          <View
            style={[
              styles.pill,
              styles.health,
              { backgroundColor: warn.background },
            ]}
          >
            <IconSymbol
              name="cross.case.fill"
              size={12}
              color={t.warningIcon}
            />
            <Text style={[styles.text, { color: warn.text }]}>
              {MARK_TEXT.healthNote}
            </Text>
          </View>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  health: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  healthTarget: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
  text: { ...typography.footnote, fontWeight: '600' },
});
