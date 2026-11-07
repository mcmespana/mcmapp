// «Ver como…» (plan 11, `menu.php` l. 209-276): los hijos (el activo marcado), «Yo mismo/a» y «Ver todos los perfiles…».

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import type { MyProfiles } from '@/services/comunica/contract';
import { h } from '@/utils/haptics';
import { selfLabel, shortName } from '@/utils/comunica/profiles';
import { useComunicaTheme } from '../comun/useComunicaTheme';

interface Props {
  visible: boolean;
  profiles: MyProfiles;
  activeId: string;
  onChoose: (id: string) => void;
  onSeeAll: () => void;
  onClose: () => void;
}

export default function ProfileSwitcherSheet({
  visible,
  profiles,
  activeId,
  onChoose,
  onSeeAll,
  onClose,
}: Props) {
  const t = useComunicaTheme();
  const rows = [
    ...profiles.children.map((c) => ({ id: c.id, label: shortName(c) })),
    { id: profiles.self.id, label: selfLabel(profiles.self) },
  ];
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Ver como…">
      <View accessibilityRole="radiogroup" style={styles.list}>
        {rows.map((r) => {
          const selected = r.id === activeId;
          return (
            <PressableFeedback
              key={r.id}
              onPress={() => {
                h.select();
                onClose();
                onChoose(r.id);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={r.label}
              style={[
                styles.row,
                {
                  borderColor: selected ? t.accentFill : t.separator,
                  backgroundColor: selected ? t.backgroundSunken : t.card,
                },
              ]}
            >
              <Text style={[styles.label, { color: t.text }]}>{r.label}</Text>
              {selected ? (
                <IconSymbol name="checkmark" size={18} color={t.accentText} />
              ) : null}
              <PressableFeedback.Highlight />
            </PressableFeedback>
          );
        })}
      </View>
      <PressableFeedback
        onPress={() => {
          onClose();
          onSeeAll();
        }}
        accessibilityRole="button"
        style={styles.all}
      >
        <Text style={[styles.allText, { color: t.accentText }]}>
          Ver todos los perfiles…
        </Text>
      </PressableFeedback>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8, paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    borderWidth: 1.5,
  },
  label: { ...typography.body, flex: 1, fontWeight: '600' },
  all: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  allText: { ...typography.button },
});
