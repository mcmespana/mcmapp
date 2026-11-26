// La hoja de salud que abre la marca «Alergia o tratamiento» (plan 05, tarea
// 7; el globo de `js/stic-pasar-lista.js` l.1744-1840). Se pide al abrir, solo
// con conexión, y nunca se guarda en el móvil (`useHealth`, `persist: false`).
// Con `eventId` es la de un inscrito de un evento que se gestiona (plan 18):
// la pide por su ruta (`useManagedHealth`), con las mismas reglas.

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Skeleton } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useHealth } from '@/hooks/comunica/useGrupos';
import { useManagedHealth } from '@/hooks/comunica/managedEvents';
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
  /** La de un inscrito de un evento que gestionas (plan 18). */
  eventId?: string;
}

export default function HealthSheet({ person, onClose, eventId }: Props) {
  // La última persona abierta se queda mientras la hoja se cierra: si no, la
  // animación de salida bajaba una hoja vacía y sin título.
  const [shown, setShown] = useState(person);
  if (person && person !== shown) setShown(person);
  return (
    <BottomSheet
      visible={!!person}
      onClose={onClose}
      title={shown ? `${shown.firstName} ${shown.lastName}` : ''}
    >
      {shown ? <HealthBody personId={shown.id} eventId={eventId} /> : <View />}
    </BottomSheet>
  );
}

export function HealthBody({
  personId,
  eventId,
}: {
  personId: string;
  eventId?: string;
}) {
  // Una ruta u otra: cada una en su componente (un hook por ruta).
  return eventId ? (
    <ManagedHealth personId={personId} eventId={eventId} />
  ) : (
    <TeamHealth personId={personId} />
  );
}

function TeamHealth({ personId }: { personId: string }) {
  return <HealthView q={useHealth(personId, true)} />;
}

function ManagedHealth({
  personId,
  eventId,
}: {
  personId: string;
  eventId: string;
}) {
  return <HealthView q={useManagedHealth(eventId, personId, true)} />;
}

function HealthView({ q }: { q: ReturnType<typeof useHealth> }) {
  const t = useComunicaTheme();
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
