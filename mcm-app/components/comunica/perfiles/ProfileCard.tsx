// La tarjeta de una persona que se puede ver (plan 11, `single_stic_profile_selection.php`): la inicial, el nombre corto (nombre y primer apellido,
// FAM-a11), una etiqueta («Yo» en la propia, «Viéndolo ahora» solo en la activa) y la acción («Seguir aquí», «Elegir» o «Entrar»). La misma tarjeta en
// «¿A quién ves?» y en la portada de un familiar (FAM-a11).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import type { ProfileRef } from '@/services/comunica/contract';
import { h } from '@/utils/haptics';
import { shortName } from '@/utils/comunica/profiles';
import CardSurface from '../comun/CardSurface';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import ProfileInitial from './ProfileInitial';

export interface ProfileCardProps {
  profile: ProfileRef;
  /** Es quien ha entrado (no un hijo). */
  isSelf: boolean;
  /** Es a quien se ve ahora. */
  isActive: boolean;
  /** El texto de la acción; por defecto, el de «¿A quién ves?». */
  actionLabel?: string;
  onPress: () => void;
}

/** «Seguir aquí» a quien ya se ve, «Entrar» en la propia y «Elegir» en un hijo. */
export const defaultAction = (isSelf: boolean, isActive: boolean) =>
  isActive ? 'Seguir aquí' : isSelf ? 'Entrar' : 'Elegir';

/** La etiqueta de debajo del nombre, o `null`. */
export const cardTag = (isSelf: boolean, isActive: boolean) =>
  isActive
    ? isSelf
      ? 'Yo · viéndote ahora'
      : 'Viéndolo ahora'
    : isSelf
      ? 'Yo'
      : null;

export default function ProfileCard({
  profile,
  isSelf,
  isActive,
  actionLabel,
  onPress,
}: ProfileCardProps) {
  const t = useComunicaTheme();
  const name = shortName(profile);
  const tag = cardTag(isSelf, isActive);
  const action = actionLabel ?? defaultAction(isSelf, isActive);
  return (
    <CardSurface
      clip
      style={
        isActive ? [styles.active, { borderColor: t.accentFill }] : undefined
      }
    >
      <PressableFeedback
        onPress={() => {
          h.select();
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={`${name}${tag ? `, ${tag.toLowerCase()}` : ''}. ${action}`}
        style={styles.row}
      >
        <ProfileInitial profile={profile} selected={isActive} size={44} />
        <View style={styles.body}>
          <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
            {name}
          </Text>
          {tag ? (
            <Text
              style={[
                styles.tag,
                { color: isActive ? t.accentText : t.textSecondary },
              ]}
            >
              {tag}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.action, { color: t.accentText }]}>{action}</Text>
        <IconSymbol name="chevron.right" size={16} color={t.textMuted} />
        <PressableFeedback.Highlight />
      </PressableFeedback>
    </CardSurface>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  // La que se está viendo: el borde, algo más grueso, en el acento.
  active: { borderWidth: 1.5 },
  body: { flex: 1, gap: 2 },
  name: { ...typography.title },
  tag: { ...typography.caption, fontWeight: '600' },
  action: { ...typography.button },
});
