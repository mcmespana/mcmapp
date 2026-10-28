// «Ver como…» (plan 11; el desplegable de `sticpa_profile_switcher_html`):
// los hijos con su marca en el que se está viendo, uno mismo al final y
// «Ver todos los perfiles…», que lleva a la pantalla grande. Elegir aquí
// cambia la persona y, según la pantalla, se queda o vuelve a la portada
// (`useSwitchProfile`).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import {
  useActiveProfile,
  useSwitchProfile,
} from '@/hooks/comunica/useActiveProfile';
import type { ProfileRef } from '@/services/comunica/contract';
import { h } from '@/utils/haptics';
import { selfLabel, shortName } from '@/utils/comunica/profiles';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import ProfileInitial from './ProfileInitial';

function Option({
  profile,
  label,
  selected,
  onPress,
}: {
  profile: ProfileRef;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useComunicaTheme();
  return (
    <PressableFeedback
      onPress={() => {
        h.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={styles.row}
    >
      <ProfileInitial profile={profile} selected={selected} />
      <Text
        style={[
          styles.label,
          { color: t.text, fontWeight: selected ? '600' : '400' },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {selected ? (
        <IconSymbol
          name="checkmark.circle.fill"
          size={20}
          color={t.accentText}
        />
      ) : null}
      <PressableFeedback.Highlight />
    </PressableFeedback>
  );
}

export default function ProfileSwitcherSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const active = useActiveProfile();
  const switchTo = useSwitchProfile();
  const self = active.self;
  const pick = (pid: string) => {
    onClose();
    switchTo(pid);
  };
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Ver como…">
      <View style={styles.list}>
        {active.children.map((c) => (
          <Option
            key={c.id}
            profile={c}
            label={shortName(c)}
            selected={c.id === active.pid}
            onPress={() => pick(c.id)}
          />
        ))}
        {self ? (
          <View
            style={[styles.selfWrap, { borderTopColor: t.separator }]}
            key="self"
          >
            <Option
              profile={self}
              label={selfLabel(self)}
              selected={active.viewingSelf}
              onPress={() => pick(self.id)}
            />
          </View>
        ) : null}
        <PressableFeedback
          onPress={() => {
            h.tap();
            onClose();
            router.push('/comunica/perfiles');
          }}
          accessibilityRole="button"
          style={styles.all}
        >
          <Text style={[styles.allText, { color: t.accentText }]}>
            Ver todos los perfiles…
          </Text>
          <IconSymbol name="chevron.right" size={16} color={t.accentText} />
          <PressableFeedback.Highlight />
        </PressableFeedback>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingVertical: 6,
  },
  label: { ...typography.body, flex: 1 },
  selfWrap: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4 },
  all: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    marginTop: 4,
  },
  allText: { ...typography.button },
});
