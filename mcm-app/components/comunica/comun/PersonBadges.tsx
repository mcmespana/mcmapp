// Marcas de una persona: salud (sin decir cuál), sin fotos y no se va solo.
// Iconos pequeños con su etiqueta para lectores de pantalla.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import type { PersonBadges as Badges } from '@/services/comunica/contract';
import { useComunicaTheme } from './useComunicaTheme';

const ICON_SIZE = 16;

export function badgesLabel(b: Badges): string {
  return [
    b.healthNote && 'tiene una nota de salud',
    b.noPhotos && 'sin fotos',
    b.notHomeAlone && 'no se va solo',
  ]
    .filter(Boolean)
    .join(', ');
}

export default function PersonBadges({ badges }: { badges: Badges }) {
  const t = useComunicaTheme();
  const label = badgesLabel(badges);
  if (!label) return null;
  return (
    <View style={styles.row} accessible accessibilityLabel={label}>
      {badges.healthNote ? (
        <IconSymbol
          name="cross.case.fill"
          size={ICON_SIZE}
          color={t.warningIcon}
        />
      ) : null}
      {badges.noPhotos ? (
        <IconSymbol name="eye.slash" size={ICON_SIZE} color={t.textSecondary} />
      ) : null}
      {badges.notHomeAlone ? (
        <IconSymbol
          name="figure.and.child.holdinghands"
          size={ICON_SIZE}
          color={t.textSecondary}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
