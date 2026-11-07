// Las marcas de un chaval como pastillas de texto, bajo su nombre (plan 05,
// regla 9; `MIS-GRUPOS.md` §8 bis): como mucho «No se va solo/a», «Sin fotos»
// y «Alergia o tratamiento», en ese orden. Las decide el servidor con el «0»
// explícito; la app no las deriva.
//
// La de salud NO dice cuál ni qué, tampoco al lector de pantalla: «Alergia o
// tratamiento: ver el detalle». Tocarla abre la hoja de salud (si se da
// `onHealth`; en la lista de marcar no).
//
// Aparte va una marca MENOR, «Otras patologías» (enfermedades y otras: TEA,
// TDAH…): más pequeña y en tono celeste (info, no aviso), con el mismo icono y el mismo gesto.
// Va por separado para que un TEA no se confunda con una alergia, pero tiene
// que verse: antes de esta marca, quien solo tenía eso no llevaba ninguna.

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
  healthOther: 'Otras patologías',
} as const;

export const HEALTH_MARK_A11Y = 'Alergia o tratamiento: ver el detalle';
export const HEALTH_OTHER_A11Y = 'Otras patologías: ver el detalle';

/** ¿Hay algo de salud que ver (la marca principal o la menor)? */
export const hasHealth = (b: PersonBadges) => !!(b.healthNote || b.healthOther);

/** Lo que dice el lector de las marcas (nunca el texto de la salud). */
export function marksA11y(b: PersonBadges): string {
  return [
    b.notHomeAlone && MARK_TEXT.notHomeAlone,
    b.noPhotos && MARK_TEXT.noPhotos,
    b.healthNote && HEALTH_MARK_A11Y,
    b.healthOther && HEALTH_OTHER_A11Y,
  ]
    .filter(Boolean)
    .join(', ');
}

export const hasMarks = (b: PersonBadges) =>
  b.notHomeAlone || b.noPhotos || hasHealth(b);

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
  const info = t.chip('info');
  const pill = (text: string, tone: typeof neutral) => (
    <View style={[styles.pill, { backgroundColor: tone.background }]}>
      <Text style={[styles.text, { color: tone.text }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
  // Las de salud: con `onHealth` son botones (44 pt de área táctil DE VERDAD,
  // con la pastilla centrada dentro: con `hitSlop` se quedaba en ~40 y se metía
  // en la fila de al lado); sin él, solo una pastilla.
  const healthPill = (
    text: string,
    a11y: string,
    tone: typeof neutral,
    minor: boolean,
  ) => {
    const body = (
      <View
        style={[
          styles.pill,
          styles.health,
          { backgroundColor: tone.background },
        ]}
      >
        <IconSymbol
          name="cross.case.fill"
          size={minor ? 10 : 12}
          color={minor ? tone.text : t.warningIcon}
        />
        <Text
          style={[styles.text, minor && styles.textMinor, { color: tone.text }]}
        >
          {text}
        </Text>
      </View>
    );
    return onHealth ? (
      <PressableFeedback
        key={a11y}
        onPress={() => {
          h.select();
          onHealth();
        }}
        accessibilityRole="button"
        accessibilityLabel={a11y}
        style={styles.healthTarget}
      >
        {body}
      </PressableFeedback>
    ) : (
      <React.Fragment key={a11y}>{body}</React.Fragment>
    );
  };
  return (
    <View style={styles.row}>
      {badges.notHomeAlone ? pill(MARK_TEXT.notHomeAlone, warn) : null}
      {badges.noPhotos ? pill(MARK_TEXT.noPhotos, neutral) : null}
      {badges.healthNote
        ? healthPill(MARK_TEXT.healthNote, HEALTH_MARK_A11Y, warn, false)
        : null}
      {badges.healthOther
        ? healthPill(MARK_TEXT.healthOther, HEALTH_OTHER_A11Y, info, true)
        : null}
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
  textMinor: { fontSize: 11, lineHeight: 14 },
});
