// «Vincular» a quien no tiene grupo (plan 05, regla 12; `MIS-GRUPOS.md` §7):
// la hoja con los grupos —los de su curso primero—, la confirmación y a la
// cola. Solo pone grupo a una relación QUE YA EXISTE; nunca la crea.

import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import type {
  GroupWithMonitors,
  ParticipantRow,
} from '@/services/comunica/contract';
import { useGruposWrites } from '@/hooks/comunica/useGrupos';
import { h } from '@/utils/haptics';
import { groupsForLevel } from '@/utils/comunica/people';
import { confirmAction } from '../comun/confirm';
import { useComunicaTheme } from '../comun/useComunicaTheme';

interface Props {
  /** Un chaval «sin grupo» (plan 05) o un monitor sin grupo (plan 06). */
  person: Pick<
    ParticipantRow,
    'id' | 'firstName' | 'schoolLevel' | 'unassignedMembershipId'
  > | null;
  groups: readonly GroupWithMonitors[];
  onClose: () => void;
}

export default function AssignSheet({ person, groups, onClose }: Props) {
  const t = useComunicaTheme();
  const { assignGroup } = useGruposWrites();
  const options = useMemo(
    () => groupsForLevel(groups, person?.schoolLevel?.key),
    [groups, person],
  );
  const ofLevel = options.filter((o) => o.ofLevel);
  const rest = options.filter((o) => !o.ofLevel);

  const pick = async (groupId: string, label: string) => {
    if (!person?.unassignedMembershipId) return;
    const ok = await confirmAction(
      `¿Vincular a ${person.firstName} con ${label.replace(/ \(.*\)$/, '')}?`,
      'Saldrá en su lista desde ya.',
      'Vincular',
    );
    if (!ok) return;
    await assignGroup({
      membershipId: person.unassignedMembershipId,
      personId: person.id,
      groupId,
    });
    h.formSuccess();
    onClose();
  };

  const list = (items: typeof options) =>
    items.map((o, i) => (
      <PressableFeedback
        key={o.id}
        onPress={() => void pick(o.id, o.label)}
        accessibilityRole="button"
        accessibilityLabel={`Vincular con ${o.label}`}
        style={[
          styles.option,
          i > 0 && {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: t.separator,
          },
        ]}
      >
        <PressableFeedback.Highlight />
        <Text style={[styles.optionLabel, { color: t.text }]}>{o.label}</Text>
        <IconSymbol name="link" size={18} color={t.accentText} />
      </PressableFeedback>
    ));

  return (
    <BottomSheet
      visible={!!person}
      onClose={onClose}
      title={person ? `Vincular a ${person.firstName}` : ''}
    >
      <ScrollView style={styles.scroll}>
        <View style={styles.body}>
          {person?.schoolLevel ? (
            <Text style={[styles.hint, { color: t.textSecondary }]}>
              {person.firstName} está en {person.schoolLevel.label}.{' '}
              {ofLevel.length
                ? 'Arriba, los grupos de su curso.'
                : 'Ningún grupo es de su curso: elige el que toque.'}
            </Text>
          ) : null}
          {ofLevel.length ? (
            <View style={[styles.surface, { backgroundColor: t.card }]}>
              {list(ofLevel)}
            </View>
          ) : null}
          {rest.length ? (
            <>
              {ofLevel.length ? (
                <Text style={[styles.title, { color: t.textSecondary }]}>
                  Otros grupos
                </Text>
              ) : null}
              <View style={[styles.surface, { backgroundColor: t.card }]}>
                {list(rest)}
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 520 },
  body: { gap: 12, paddingBottom: 16 },
  hint: { ...typography.subhead },
  title: { ...typography.subhead, fontWeight: '600' },
  surface: { borderRadius: radii.md, overflow: 'hidden' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  optionLabel: { ...typography.body, flex: 1 },
});
