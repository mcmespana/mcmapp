// La tarjeta de una persona en «¿A quién ves?» y en «A quién tienes a tu
// cargo» (FAM-a11: la misma en los dos sitios). Inicial, nombre corto
// («Lucía Messeguer») y, si toca, «Viéndolo ahora» o «Yo». Entera es el
// toque; la acción escrita va a la derecha solo si se pide (en ancho).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import type { ProfileRef } from '@/services/comunica/contract';
import { h } from '@/utils/haptics';
import { selfLabel, shortName } from '@/utils/comunica/profiles';
import StatusChip from '../comun/StatusChip';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import ProfileInitial from './ProfileInitial';

export default function ProfileCard({
  profile,
  isSelf,
  active,
  action,
  onPress,
}: {
  profile: ProfileRef;
  isSelf: boolean;
  active: boolean;
  /** «Seguir aquí», «Elegir», «Entrar», «Ver su ficha». */
  action: string;
  onPress: () => void;
}) {
  const t = useComunicaTheme();
  const name = isSelf ? selfLabel(profile) : shortName(profile);
  const chip = active ? 'Viéndolo ahora' : isSelf ? 'Yo' : null;
  return (
    <PressableFeedback
      onPress={() => {
        h.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={[name, chip, action].filter(Boolean).join(', ')}
      style={styles.row}
    >
      <ProfileInitial profile={profile} selected={active} size={44} />
      <View style={styles.body}>
        <Text style={[styles.name, { color: t.text }]} numberOfLines={2}>
          {name}
        </Text>
        {chip ? (
          <StatusChip label={chip} tone={active ? 'accent' : 'neutral'} />
        ) : null}
      </View>
      <Text style={[styles.action, { color: t.accentText }]}>{action}</Text>
      <IconSymbol name="chevron.right" size={16} color={t.textMuted} />
      <PressableFeedback.Highlight />
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  body: { flex: 1, gap: 4, alignItems: 'flex-start' },
  name: { ...typography.body, fontWeight: '600' },
  action: { ...typography.subhead, fontWeight: '600' },
});
