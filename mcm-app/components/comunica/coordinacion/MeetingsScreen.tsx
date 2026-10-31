// components/comunica/coordinacion/MeetingsScreen.tsx
//
// Las REUNIONES DE PROGRAMACIÓN (plan 06, reglas 8 y 9;
// `single_stic_pasar_lista_reuniones.php`): las del curso, de la más reciente a
// la más antigua, con su estado en el idioma del historial de un grupo, y
// crearlas detrás de «Nueva reunión». Tocar una abre su lista de monitores.
//
// Una reunión recién creada va por la cola: se enseña arriba con su
// `UploadStatus` y no se abre su lista hasta que sube (aún no tiene id).

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import EmptyState from '@/components/ui/EmptyState';
import typography from '@/constants/typography';
import { comunicaNow } from '@/services/comunica';
import type { Meeting } from '@/services/comunica/contract';
import { useMeetings } from '@/hooks/comunica/coordination';
import { useFlushOutboxOnMount, useOutbox } from '@/hooks/comunica/useOutbox';
import { h } from '@/utils/haptics';
import { meetingMeta, meetingState } from '@/utils/comunica/meetings';
import AreaPrimaryButton from '../comun/AreaPrimaryButton';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import RecordCard from '../comun/RecordCard';
import Section from '../comun/Section';
import UploadStatus from '../comun/UploadStatus';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { FORBIDDEN_COORDINATION } from './MonitorsRollScreen';
import NewMeetingSheet from './NewMeetingSheet';

const KICKER = {
  taken: { label: 'Pasada', tone: 'positive' as const },
  skipped: { label: 'Sin registro', tone: 'neutral' as const },
  missing: { label: 'Sin pasar', tone: 'warning' as const },
  future: { label: 'Próxima', tone: 'neutral' as const },
};

export default function MeetingsScreen() {
  const q = useMeetings();
  useFlushOutboxOnMount();
  const [creating, setCreating] = useState(false);
  return (
    <>
      <Stack.Screen options={{ title: 'Reuniones de programación' }} />
      <AreaState query={q} skeleton="cards" forbidden={FORBIDDEN_COORDINATION}>
        {(data) => (
          <MeetingsList
            meetings={data.meetings}
            season={data.season}
            refetch={() => q.refetch()}
            onCreate={() => {
              h.tap();
              setCreating(true);
            }}
          />
        )}
      </AreaState>
      <NewMeetingSheet visible={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function MeetingsList({
  meetings,
  season,
  refetch,
  onCreate,
}: {
  meetings: Meeting[];
  season: string;
  refetch: () => Promise<unknown>;
  onCreate: () => void;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { pending, outbox } = useOutbox();
  const now = comunicaNow();
  const queued = pending.filter((e) => e.kind === 'meeting');

  return (
    <AreaScreen onRefresh={refetch}>
      <AreaPrimaryButton label="Nueva reunión" icon="plus" onPress={onCreate} />
      {queued.length > 0 ? (
        <Section title="Recién creadas">
          {queued.map((e) => (
            <View key={e.key} style={styles.queued}>
              <Text style={[styles.queuedName, { color: t.text }]}>
                {e.meta.name}
              </Text>
              <UploadStatus
                state={e.status}
                onRetry={() => void outbox?.retry(e.key)}
              />
            </View>
          ))}
        </Section>
      ) : null}
      {meetings.length === 0 && queued.length === 0 ? (
        <EmptyState
          icon="event"
          title="Todavía no hay reuniones este curso."
          titleColor={t.text}
          subtitleColor={t.textSecondary}
          compact
        />
      ) : (
        <Section title={`Curso ${season}`} bare>
          {meetings.map((m) => (
            <RecordCard
              key={m.session.id}
              kicker={KICKER[meetingState(m, now)]}
              title={m.name}
              day={m.session.date}
              lines={[meetingMeta(m, now)]}
              onPress={() =>
                router.push({
                  pathname: '/comunica/coordinacion/monitores',
                  params: { tipo: 'reunion', sesion: m.session.id },
                })
              }
            />
          ))}
        </Section>
      )}
    </AreaScreen>
  );
}

const styles = StyleSheet.create({
  queued: { padding: 16, gap: 4 },
  queuedName: { ...typography.body, fontWeight: '600' },
});
