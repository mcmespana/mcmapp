// La hoja de salud que abre la marca «Alergia o tratamiento» (plan 05, tarea
// 7; el globo de `js/stic-pasar-lista.js` l.1744-1840). Se pide al abrir, solo
// con conexión, y nunca se guarda en el móvil (`useHealth`, `persist: false`).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Skeleton } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useHealth } from '@/hooks/comunica/useGrupos';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import {
  HEALTH_EMPTY,
  HEALTH_ERROR,
  HEALTH_LABEL,
  HEALTH_OFFLINE,
  isOfflineError,
} from './healthCopy';

interface Props {
  person: { id: string; firstName: string; lastName: string } | null;
  onClose: () => void;
}

export default function HealthSheet({ person, onClose }: Props) {
  return (
    <BottomSheet
      visible={!!person}
      onClose={onClose}
      title={person ? `${person.firstName} ${person.lastName}` : ''}
    >
      {person ? <HealthBody personId={person.id} /> : <View />}
    </BottomSheet>
  );
}

export function HealthBody({ personId }: { personId: string }) {
  const t = useComunicaTheme();
  const q = useHealth(personId, true);
  let body: React.ReactNode;
  if (q.data) {
    body =
      q.data.items.length === 0 ? (
        <Text style={[styles.note, { color: t.textSecondary }]}>
          {HEALTH_EMPTY}
        </Text>
      ) : (
        q.data.items.map((i, n) => (
          <View key={`${i.kind}-${n}`} style={styles.item}>
            <Text style={[styles.label, { color: t.textSecondary }]}>
              {HEALTH_LABEL[i.kind]}
            </Text>
            <Text style={[styles.value, { color: t.text }]}>{i.text}</Text>
          </View>
        ))
      );
  } else if (q.error) {
    body = (
      <Text style={[styles.note, { color: t.textSecondary }]}>
        {isOfflineError(q.error) ? HEALTH_OFFLINE : HEALTH_ERROR}
      </Text>
    );
  } else {
    body = (
      <View
        style={styles.skeleton}
        accessible
        accessibilityLabel="Cargando"
        accessibilityState={{ busy: true }}
      >
        <Skeleton
          style={[styles.line, styles.long, { backgroundColor: t.separator }]}
        />
        <Skeleton
          style={[styles.line, styles.short, { backgroundColor: t.separator }]}
        />
      </View>
    );
  }
  return <View style={styles.body}>{body}</View>;
}

const styles = StyleSheet.create({
  body: { gap: 12, paddingBottom: 16 },
  item: { gap: 2 },
  label: { ...typography.caption, fontWeight: '600' },
  value: { ...typography.body },
  note: { ...typography.body },
  skeleton: { gap: 10 },
  line: { height: 14, borderRadius: radii.sm },
  long: { width: '80%' },
  short: { width: '50%' },
});
