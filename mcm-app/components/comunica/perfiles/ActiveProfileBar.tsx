// «Viendo a · Lucía ▾» (plan 11): arriba de cada pantalla de familias, solo si hay hijos. Abre «Ver como…». `scope` y `section` dicen a dónde se va
// al cambiar (FAM-a8): una compartida se queda; una personal, a la portada.

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import {
  useActiveProfile,
  useProfileScope,
} from '@/hooks/comunica/useActiveProfile';
import {
  selfLabel,
  shortName,
  type FamilySection,
  type ProfileScope,
} from '@/utils/comunica/profiles';
import { h } from '@/utils/haptics';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import ProfileSwitcherSheet from './ProfileSwitcherSheet';

export default function ActiveProfileBar({
  scope = 'personal',
  section = null,
}: {
  scope?: ProfileScope;
  section?: FamilySection | null;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { ready, profiles, active, isSelf } = useActiveProfile();
  const switchProfile = useProfileScope(scope, section);
  const [open, setOpen] = useState(false);
  // Sin hijos no hay a quién cambiar: la barra no se pinta.
  if (!ready || !profiles || !active || profiles.children.length === 0)
    return null;
  const who = isSelf ? selfLabel(profiles.self) : shortName(active);
  return (
    <>
      <PressableFeedback
        onPress={() => {
          h.tap();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Viendo a ${who}. Cambiar de persona`}
        style={[
          styles.bar,
          { backgroundColor: t.card, borderColor: t.separator },
        ]}
      >
        <View style={styles.text}>
          <Text style={[styles.caption, { color: t.textSecondary }]}>
            Viendo a
          </Text>
          <Text style={[styles.who, { color: t.text }]} numberOfLines={1}>
            {who}
          </Text>
        </View>
        <IconSymbol name="chevron.down" size={18} color={t.textMuted} />
        <PressableFeedback.Highlight />
      </PressableFeedback>
      <ProfileSwitcherSheet
        visible={open}
        profiles={profiles}
        activeId={active.id}
        onChoose={switchProfile}
        onSeeAll={() => router.push('/comunica/perfiles')}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.pillFull,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  text: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexShrink: 1 },
  caption: { ...typography.caption },
  who: { ...typography.title, flexShrink: 1 },
});
