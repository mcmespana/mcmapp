// «Viendo a Lucía» (plan 11; `sticpa_profile_switcher_html`): arriba de las
// pantallas de familias, solo si hay a quién cambiar (tiene hijos). Entera
// abre «Ver como…». Va FUERA de los estados de carga (regla 22 de
// AREA_NATIVA_DISENO): si no, desaparece justo al cambiar.

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { radii } from '@/constants/uiStyles';
import typography from '@/constants/typography';
import { useActiveProfile } from '@/hooks/comunica/useActiveProfile';
import { h } from '@/utils/haptics';
import { selfLabel, shortName } from '@/utils/comunica/profiles';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import ProfileInitial from './ProfileInitial';
import ProfileSwitcherSheet from './ProfileSwitcherSheet';

export default function ActiveProfileBar() {
  const t = useComunicaTheme();
  const active = useActiveProfile();
  const [open, setOpen] = useState(false);
  if (!active.ready || !active.hasChildren || !active.profile) return null;
  const name = active.viewingSelf
    ? selfLabel(active.profile)
    : shortName(active.profile);
  return (
    <>
      <PressableFeedback
        onPress={() => {
          h.tap();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Viendo a ${name}`}
        accessibilityHint="Cambia a quién ves"
        style={[styles.bar, { backgroundColor: t.card }]}
      >
        <ProfileInitial profile={active.profile} selected />
        <View style={styles.body}>
          <Text style={[styles.kicker, { color: t.textSecondary }]}>
            Viendo a
          </Text>
          <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
            {name}
          </Text>
        </View>
        <Text style={[styles.change, { color: t.accentText }]}>Cambiar</Text>
        <IconSymbol name="chevron.down" size={16} color={t.accentText} />
        <PressableFeedback.Highlight />
      </PressableFeedback>
      <ProfileSwitcherSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  body: { flex: 1 },
  kicker: { ...typography.caption },
  name: { ...typography.body, fontWeight: '600' },
  change: { ...typography.subhead, fontWeight: '600' },
});
