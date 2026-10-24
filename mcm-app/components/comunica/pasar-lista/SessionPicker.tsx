// El selector de fecha de la cabecera de marcar: «3 · 15 nov ▾». Abre una hoja
// con las sesiones celebradas, la más reciente arriba, y su estado. Con una
// sola, el dato sin control.

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { longDay } from '@/utils/comunica/dates';
import {
  ROLL_STATE_LABEL,
  type SessionOption,
} from '@/utils/comunica/sessions';
import { h } from '@/utils/haptics';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export default function SessionPicker({
  options,
  current,
  onPick,
  tint,
}: {
  options: SessionOption[];
  current: SessionOption | null;
  onPick: (sessionId: string) => void;
  /** Color del texto en la cabecera. */
  tint: string;
}) {
  const t = useComunicaTheme();
  const [open, setOpen] = useState(false);
  if (!current) return null;
  if (options.length <= 1) {
    return <Text style={[styles.label, { color: tint }]}>{current.label}</Text>;
  }
  return (
    <>
      <PressableFeedback
        onPress={() => {
          h.tap();
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Sesión ${current.label}. Cambiar de fecha`}
        hitSlop={8}
        style={styles.button}
      >
        <Text style={[styles.label, { color: tint }]}>{current.label}</Text>
        <IconSymbol name="chevron.down" size={14} color={tint} />
      </PressableFeedback>
      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Elige la fecha"
      >
        <View style={styles.list}>
          {options.map((o) => {
            const selected = o.session.id === current.session.id;
            return (
              <PressableFeedback
                key={o.session.id}
                onPress={() => {
                  h.select();
                  setOpen(false);
                  onPick(o.session.id);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.row, { borderBottomColor: t.separator }]}
              >
                <PressableFeedback.Highlight />
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: t.text }]}>
                    {o.label} · {ROLL_STATE_LABEL[o.state]}
                  </Text>
                  <Text style={[styles.rowSub, { color: t.textSecondary }]}>
                    {longDay(o.session.date, true)}
                  </Text>
                </View>
                {selected ? (
                  <IconSymbol name="checkmark" size={18} color={t.accentText} />
                ) : null}
              </PressableFeedback>
            );
          })}
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  label: { ...typography.button },
  list: { paddingBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { ...typography.body, fontWeight: '600' },
  rowSub: { ...typography.caption },
});
