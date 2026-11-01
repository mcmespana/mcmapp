// La nota de la acción de una ficha (`stic-record-view.php` 622-662, el
// `cta_note`): por qué no se puede, o qué tienes ya, con su salida. Un título
// opcional («Esta actividad no es para ti»), el texto y, si hay, UNA acción
// secundaria («Ver otras actividades», «Ver mi inscripción»). La principal va
// en la `BottomActionBar`, nunca aquí.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { radii } from '@/constants/uiStyles';
import typography from '@/constants/typography';
import { h } from '@/utils/haptics';
import { useComunicaTheme } from '../useComunicaTheme';

interface Props {
  title?: string | null;
  text: string;
  /** `info` (un motivo) o `neutral` (un hecho: ya celebrada, ya inscrita). */
  tone?: 'info' | 'neutral' | 'positive';
  action?: { label: string; onPress: () => void } | null;
}

export default function RecordNote({
  title,
  text,
  tone = 'neutral',
  action,
}: Props) {
  const t = useComunicaTheme();
  const chip = t.chip(tone);
  return (
    <View
      style={[
        styles.box,
        { backgroundColor: tone === 'neutral' ? t.card : chip.background },
      ]}
    >
      {title ? (
        <Text style={[styles.title, { color: t.text }]}>{title}</Text>
      ) : null}
      <Text style={[styles.text, { color: t.text }]}>{text}</Text>
      {action ? (
        <PressableFeedback
          onPress={() => {
            h.tap();
            action.onPress();
          }}
          accessibilityRole="button"
          style={styles.action}
        >
          <Text style={[styles.actionLabel, { color: t.accentText }]}>
            {action.label}
          </Text>
          <IconSymbol name="chevron.right" size={14} color={t.accentText} />
        </PressableFeedback>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radii.lg, padding: 16, gap: 6 },
  title: { ...typography.title },
  text: { ...typography.body },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    alignSelf: 'flex-start',
  },
  actionLabel: { ...typography.button },
});
