// Una fila del check-in de un evento que se gestiona (plan 18). No es la fila
// de marcar asistencia (`RollRow`, la del CRM): aquí solo se dice si ha
// LLEGADO, con un botón grande y su deshacer, como en Comunica Tools.
//
//   · Tocar la persona abre su ficha; mantener pulsado empieza a seleccionar
//     (marcar varios a la vez). Seleccionando, tocar marca o desmarca.
//   · A la derecha: «Llega» (falta), la hora y deshacer (ha llegado) o «No
//     viene» y deshacer. Las canceladas, su estado y nada más.
//   · Junto al nombre, la habitación («Hab. 12», si el evento tiene) y el
//     icono de nota; un icono de nube si hay algo suyo sin subir.
//
// Es `memo` y recibe los callbacks por id: marcar una fila no repinta las
// otras cien.

import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { h } from '@/utils/haptics';
import { onColor } from '@/utils/colorUtils';
import {
  arrivedTime,
  roomShort,
  type CheckinRowModel,
} from '@/utils/comunica/checkin';
import PersonAvatar from '../comun/PersonAvatar';
import PersonBadges, { badgesLabel } from '../comun/PersonBadges';
import StatusChip from '../comun/StatusChip';
import { MARK_FILL } from '../comun/theme';
import { useComunicaTheme } from '../comun/useComunicaTheme';

const ARRIVE_FILL = MARK_FILL.yes;
const ARRIVE_INK = onColor(ARRIVE_FILL);

interface Props {
  row: CheckinRowModel;
  /** El evento tiene habitaciones: se enseña la de cada uno. */
  showRoom: boolean;
  /** Se enseña el texto de la nota debajo (filtro «Con nota»). */
  showNote: boolean;
  selecting: boolean;
  selected: boolean;
  onArrive: (id: string) => void;
  onUndo: (id: string) => void;
  onOpen: (id: string) => void;
  onSelect: (id: string) => void;
  onStartSelect: (id: string) => void;
}

function CheckinRow({
  row,
  showRoom,
  showNote,
  selecting,
  selected,
  onArrive,
  onUndo,
  onOpen,
  onSelect,
  onStartSelect,
}: Props) {
  const t = useComunicaTheme();
  const { reg, eff } = row;
  const id = row.id;
  const name = `${reg.firstName} ${reg.lastName}`;
  const monitor = reg.role !== 'participant';
  const time = arrivedTime(eff.arrivedAt);
  const state = row.out
    ? (row.outLabel ?? 'No va')
    : eff.status === 'in'
      ? time
        ? `Ha llegado a las ${time}`
        : 'Ha llegado'
      : eff.status === 'absent'
        ? 'No viene'
        : 'Falta';
  const label = [
    name,
    showRoom && row.room ? `habitación ${row.room.code}` : null,
    row.line,
    badgesLabel(reg.badges),
    eff.note ? `con nota: ${eff.note}` : null,
    state,
    eff.queued ? 'sin subir todavía' : null,
  ]
    .filter(Boolean)
    .join(', ');
  const markable = !row.out;

  let right: React.ReactNode = null;
  if (row.out) {
    right = <StatusChip label={state} />;
  } else if (selecting) {
    right = null;
  } else if (eff.status === 'pending') {
    right = (
      <PressableFeedback
        onPress={() => {
          h.add();
          onArrive(id);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Llega ${name}`}
        style={[styles.arrive, { backgroundColor: ARRIVE_FILL }]}
      >
        <PressableFeedback.Scale />
        <IconSymbol name="checkmark" size={18} color={ARRIVE_INK} />
        <Text style={[styles.arriveLabel, { color: ARRIVE_INK }]}>Llega</Text>
      </PressableFeedback>
    );
  } else {
    const chip = t.chip(eff.status === 'in' ? 'positive' : 'neutral');
    right = (
      <View style={styles.done}>
        <View style={[styles.doneChip, { backgroundColor: chip.background }]}>
          {eff.status === 'in' ? (
            <IconSymbol name="checkmark" size={14} color={chip.text} />
          ) : null}
          <Text style={[styles.doneText, { color: chip.text }]}>
            {eff.status === 'in' ? time || 'Está' : 'No viene'}
          </Text>
        </View>
        <PressableFeedback
          onPress={() => {
            h.remove();
            onUndo(id);
          }}
          accessibilityRole="button"
          accessibilityLabel={
            eff.status === 'in'
              ? `Deshacer la llegada de ${name}`
              : `Deshacer «No viene» de ${name}`
          }
          style={[styles.undo, { backgroundColor: t.backgroundSunken }]}
        >
          <IconSymbol
            name="arrow.uturn.backward"
            size={18}
            color={t.accentText}
          />
          <PressableFeedback.Highlight />
        </PressableFeedback>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.row,
        selected && { backgroundColor: t.chip('accent').background },
      ]}
    >
      <PressableFeedback
        onPress={() => {
          if (selecting && markable) {
            h.select();
            onSelect(id);
          } else {
            h.tap();
            onOpen(id);
          }
        }}
        onLongPress={
          markable && !selecting
            ? () => {
                h.menuOpen();
                onStartSelect(id);
              }
            : undefined
        }
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={
          selecting
            ? markable
              ? 'Toca para seleccionar'
              : undefined
            : 'Abre su ficha. Mantén pulsado para marcar a varios'
        }
        accessibilityState={selecting ? { selected } : undefined}
        accessibilityActions={
          markable && !selecting
            ? [
                eff.status === 'pending'
                  ? { name: 'arrive', label: 'Llega' }
                  : { name: 'undo', label: 'Deshacer' },
                { name: 'select', label: 'Seleccionar varios' },
              ]
            : undefined
        }
        onAccessibilityAction={(e) => {
          const a = e.nativeEvent.actionName;
          if (a === 'arrive') onArrive(id);
          else if (a === 'undo') onUndo(id);
          else if (a === 'select') onStartSelect(id);
        }}
        style={[styles.main, row.out && styles.dim]}
      >
        {selecting && markable ? (
          <IconSymbol
            name={selected ? 'checkmark.circle.fill' : 'circle'}
            size={24}
            color={selected ? t.accentText : t.textMuted}
          />
        ) : null}
        <PersonAvatar
          person={{
            id: reg.personId,
            firstName: reg.firstName,
            lastName: reg.lastName,
            photoUrl: reg.photoUrl,
          }}
          background={monitor ? t.accentFill : undefined}
          ink={monitor ? t.onAccent : undefined}
        />
        <View style={styles.body}>
          <View style={styles.nameLine}>
            <Text style={[styles.name, { color: t.text }]} numberOfLines={2}>
              <Text style={styles.first}>{reg.firstName}</Text> {reg.lastName}
            </Text>
            {showRoom && row.room ? (
              <View
                style={[
                  styles.room,
                  { backgroundColor: t.chip('info').background },
                ]}
              >
                <Text style={[styles.roomText, { color: t.text }]}>
                  {roomShort(row.room)}
                </Text>
              </View>
            ) : null}
            {eff.note ? (
              <IconSymbol name="note.text" size={16} color={t.accentText} />
            ) : null}
            {eff.queued ? (
              <IconSymbol
                name="icloud.and.arrow.up"
                size={14}
                color={t.textMuted}
              />
            ) : null}
          </View>
          {row.line || badgesLabel(reg.badges) ? (
            <View style={styles.meta}>
              {row.line ? (
                <Text
                  style={[styles.sub, { color: t.textSecondary }]}
                  numberOfLines={2}
                >
                  {row.line}
                </Text>
              ) : null}
              <PersonBadges badges={reg.badges} />
            </View>
          ) : null}
          {showNote && eff.note ? (
            <Text
              style={[styles.sub, { color: t.textSecondary }]}
              numberOfLines={3}
            >
              {eff.note}
            </Text>
          ) : null}
        </View>
        <PressableFeedback.Highlight />
      </PressableFeedback>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

export default memo(CheckinRow);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
  },
  dim: { opacity: 0.6 },
  body: { flex: 1, gap: 2 },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  name: { ...typography.body, flexShrink: 1 },
  first: { fontWeight: '600' },
  room: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radii.xs },
  roomText: { ...typography.footnote, fontWeight: '700' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sub: { ...typography.caption, flexShrink: 1 },
  right: { paddingRight: 12 },
  arrive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    minWidth: 92,
    paddingHorizontal: 14,
    borderRadius: radii.sm,
  },
  arriveLabel: { ...typography.button, fontWeight: '700' },
  done: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  doneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  doneText: { ...typography.subhead, fontWeight: '600' },
  undo: {
    width: 44,
    height: 44,
    borderRadius: radii.pillFull,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
