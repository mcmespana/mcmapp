// La hoja «Filtros» del check-in (plan 18): cómo agrupar la lista y lo que
// afina lo que se ve (con nota, con o sin habitación, un papel, una
// delegación). Arriba de la lista solo quedan el buscador y los chips de la
// llegada; esto se abre con «Filtros», que lleva el número de lo puesto.
//
// Cada opción se aplica al momento (se ve detrás, en la cuenta de los chips);
// «Quitar filtros» lo deja todo como al entrar.

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { h } from '@/utils/haptics';
import {
  GROUP_BY_LABEL,
  refineCount,
  type CheckinGroupBy,
  type CheckinRefine,
  type refineOptions,
} from '@/utils/comunica/checkin';
import { useComunicaTheme } from '../comun/useComunicaTheme';

interface Props {
  visible: boolean;
  onClose: () => void;
  groupBys: CheckinGroupBy[];
  groupBy: CheckinGroupBy;
  onGroupBy: (g: CheckinGroupBy) => void;
  refine: CheckinRefine;
  onRefine: (r: CheckinRefine) => void;
  options: ReturnType<typeof refineOptions>;
  hasRooms: boolean;
}

/** Una opción de la hoja: pastilla que se elige (una por grupo). */
function Pill({
  label,
  count,
  selected,
  onPress,
}: {
  label: string;
  count?: number;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useComunicaTheme();
  const chip = t.chip(selected ? 'accent' : 'neutral');
  return (
    <PressableFeedback
      onPress={() => {
        h.select();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={count !== undefined ? `${label}, ${count}` : label}
      style={[
        styles.pill,
        {
          backgroundColor: selected ? chip.background : t.card,
          borderColor: selected ? t.accentText : t.cardBorder,
        },
      ]}
    >
      {selected ? (
        <IconSymbol name="checkmark" size={14} color={t.accentText} />
      ) : null}
      <Text style={[styles.pillLabel, { color: t.text }]}>
        {label}
        {count !== undefined ? (
          <Text style={{ color: t.textSecondary }}> {count}</Text>
        ) : null}
      </Text>
      <PressableFeedback.Highlight />
    </PressableFeedback>
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const t = useComunicaTheme();
  return (
    <View style={styles.group} accessibilityRole="radiogroup">
      <Text
        accessibilityRole="header"
        style={[styles.label, { color: t.textSecondary }]}
      >
        {title}
      </Text>
      <View style={styles.pills}>{children}</View>
    </View>
  );
}

export default function CheckinFiltersSheet({
  visible,
  onClose,
  groupBys,
  groupBy,
  onGroupBy,
  refine,
  onRefine,
  options,
  hasRooms,
}: Props) {
  const t = useComunicaTheme();
  const set = (patch: CheckinRefine) => onRefine({ ...refine, ...patch });
  const dirty = refineCount(refine) > 0 || groupBy !== 'name';
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Filtros"
      headerRight={
        dirty ? (
          <PressableFeedback
            onPress={() => {
              h.remove();
              onRefine({});
              onGroupBy('name');
            }}
            accessibilityRole="button"
            style={styles.clear}
          >
            <Text style={[styles.clearText, { color: t.accentText }]}>
              Quitar
            </Text>
          </PressableFeedback>
        ) : undefined
      }
    >
      <ScrollView contentContainerStyle={styles.body}>
        <Group title="Agrupar por">
          {groupBys.map((g) => (
            <Pill
              key={g}
              label={GROUP_BY_LABEL[g]}
              selected={groupBy === g}
              onPress={() => onGroupBy(g)}
            />
          ))}
        </Group>

        <Group title="Nota">
          <Pill
            label="Todas"
            selected={!refine.note}
            onPress={() => set({ note: undefined })}
          />
          <Pill
            label="Con nota"
            count={options.note}
            selected={!!refine.note}
            onPress={() => set({ note: true })}
          />
        </Group>

        {hasRooms ? (
          <Group title="Habitación">
            <Pill
              label="Todas"
              selected={!refine.room}
              onPress={() => set({ room: undefined })}
            />
            <Pill
              label="Sin habitación"
              count={options.withoutRoom}
              selected={refine.room === 'without'}
              onPress={() => set({ room: 'without' })}
            />
            <Pill
              label="Con habitación"
              count={options.withRoom}
              selected={refine.room === 'with'}
              onPress={() => set({ room: 'with' })}
            />
          </Group>
        ) : null}

        {options.roles.length > 1 ? (
          <Group title="Papel">
            <Pill
              label="Todos"
              selected={!refine.role}
              onPress={() => set({ role: undefined })}
            />
            {options.roles.map((o) => (
              <Pill
                key={o.key}
                label={o.label}
                count={o.count}
                selected={refine.role === o.key}
                onPress={() => set({ role: o.key })}
              />
            ))}
          </Group>
        ) : null}

        {options.delegations.length > 1 ? (
          <Group title="Delegación">
            <Pill
              label="Todas"
              selected={refine.delegation === undefined}
              onPress={() => set({ delegation: undefined })}
            />
            {options.delegations.map((o) => (
              <Pill
                key={o.key || 'none'}
                label={o.label}
                count={o.count}
                selected={refine.delegation === o.key}
                onPress={() => set({ delegation: o.key })}
              />
            ))}
          </Group>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 20, paddingBottom: 16 },
  group: { gap: 8 },
  label: { ...typography.sectionLabel },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  pillLabel: { ...typography.subhead, fontWeight: '600' },
  clear: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
  clearText: { ...typography.button },
});
