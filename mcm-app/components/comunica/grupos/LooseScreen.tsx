// Quien no está en ningún grupo (plan 05, reglas 11 y 12; `mis_grupos.php`
// l.209-258): «Sin grupo · N personas», la explicación (una para
// coordinación, otra para el resto) y, a coordinación, «Vincular» en cada
// fila, siempre (aquí no hay interruptor). Las filas NO abren la ficha: así
// lo hace el plugin (pregunta abierta 2 del plan).

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import EmptyState from '@/components/ui/EmptyState';
import typography from '@/constants/typography';
import type { ParticipantRow } from '@/services/comunica/contract';
import { useGroups } from '@/hooks/comunica/usePasarLista';
import { usePeople } from '@/hooks/comunica/useGrupos';
import { useMe } from '@/hooks/comunica/useMe';
import { useOutbox } from '@/hooks/comunica/useOutbox';
import {
  ageLabel,
  compareByLastName,
  personsLabel,
} from '@/utils/comunica/people';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import PersonMarks, { marksA11y } from '../comun/PersonMarks';
import PersonRow from '../comun/PersonRow';
import Section from '../comun/Section';
import SyncBadge from '../comun/SyncBadge';
import UploadStatus, { type UploadState } from '../comun/UploadStatus';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import AssignSheet from './AssignSheet';
import { LinkButton } from './GruposIndexScreen';
import HealthSheet from './HealthSheet';
import {
  ASSIGN_FORBIDDEN,
  CLOSED_SEASON,
  LOOSE_EXPLAIN_COORDINATION,
  LOOSE_EXPLAIN_OTHERS,
} from './copy';

export default function LooseScreen() {
  const people = usePeople();
  return (
    <>
      <Stack.Screen options={{ title: 'Sin grupo', headerLargeTitle: false }} />
      {/* Los estados, dentro de `AreaScreen` (cabecera de iOS y barra). */}
      <AreaScreen onRefresh={() => people.refetch()}>
        <AreaState query={people} skeleton="list">
          {(d) => <Body data={d} generatedAt={people.generatedAt} />}
        </AreaState>
      </AreaScreen>
    </>
  );
}

function Body({
  data,
  generatedAt,
}: {
  data: NonNullable<ReturnType<typeof usePeople>['data']>;
  generatedAt: string | null;
}) {
  const t = useComunicaTheme();
  const groups = useGroups();
  const { me, isCoordination } = useMe();
  const { entries, outbox } = useOutbox();
  const [assignFor, setAssignFor] = useState<ParticipantRow | null>(null);
  const [healthFor, setHealthFor] = useState<ParticipantRow | null>(null);

  const byPerson = useMemo(
    () =>
      new Map(
        entries
          .filter((e) => e.kind === 'membership-group')
          .map((e) => [e.meta.personId, e] as const),
      ),
    [entries],
  );
  // Lo vinculado (en la cola o ya subido) se queda en la lista con su estado
  // hasta salir: así se ve que ha ido bien.
  const loose = useMemo(
    () =>
      data.people
        .filter((p) => !p.groupId || byPerson.has(p.id))
        .sort(compareByLastName),
    [data.people, byPerson],
  );
  const stillLoose = loose.filter((p) => {
    const e = byPerson.get(p.id);
    return !e || e.status === 'failed' || e.status === 'stuck';
  }).length;
  const groupName = (gid: string) => {
    const g = groups.data?.groups.find((x) => x.id === gid);
    return g ? [g.code, g.name].filter(Boolean).join(' · ') : '';
  };

  return (
    <>
      <View style={styles.head}>
        <Text
          style={[styles.title, { color: t.text }]}
          accessibilityRole="header"
        >
          Sin grupo · {personsLabel(stillLoose)}
        </Text>
        {data.seasonClosed ? (
          <Text style={[styles.body, { color: t.textSecondary }]}>
            {CLOSED_SEASON}
          </Text>
        ) : stillLoose > 0 ? (
          <Text style={[styles.body, { color: t.textSecondary }]}>
            {isCoordination ? LOOSE_EXPLAIN_COORDINATION : LOOSE_EXPLAIN_OTHERS}
          </Text>
        ) : null}
      </View>
      {loose.length === 0 && !data.seasonClosed ? (
        <EmptyState
          icon="check-circle"
          title="Todo el mundo está en un grupo. Nada que revisar."
          titleColor={t.text}
          compact
        />
      ) : null}
      {loose.length > 0 ? (
        <Section>
          {loose.map((p) => {
            const e = byPerson.get(p.id);
            const done = e && e.status !== 'failed' && e.status !== 'stuck';
            return (
              <PersonRow
                key={p.id}
                person={p}
                subtitleLead={
                  done
                    ? {
                        text: groupName(e.meta.groupId),
                        color: t.chip('positive').text,
                        background: t.chip('positive').background,
                      }
                    : {
                        text: 'Sin grupo',
                        color: t.chip('warning').text,
                        background: t.chip('warning').background,
                      }
                }
                subtitle={[p.schoolLevel?.label, ageLabel(p.age)]
                  .filter(Boolean)
                  .join(' · ')}
                marksLabel={marksA11y(p.badges)}
                below={
                  <>
                    <PersonMarks
                      badges={p.badges}
                      onHealth={
                        me?.canSeeHealth ? () => setHealthFor(p) : undefined
                      }
                    />
                    {e ? (
                      <View style={styles.upload}>
                        <UploadStatus
                          state={e.status as UploadState}
                          onRetry={() => void outbox?.retry(e.key)}
                        />
                        {e.status === 'failed' &&
                        e.error?.code === 'forbidden' ? (
                          <Text
                            style={[styles.caption, { color: t.warningText }]}
                          >
                            {ASSIGN_FORBIDDEN}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                  </>
                }
                accessibilityActions={
                  isCoordination && !done && p.unassignedMembershipId
                    ? [{ name: 'assign', label: 'Vincular a un grupo' }]
                    : undefined
                }
                onAccessibilityAction={() => setAssignFor(p)}
                right={
                  isCoordination && !done && p.unassignedMembershipId ? (
                    <LinkButton
                      label="Vincular"
                      onPress={() => setAssignFor(p)}
                    />
                  ) : null
                }
              />
            );
          })}
        </Section>
      ) : null}
      <View style={styles.foot}>
        <SyncBadge generatedAt={generatedAt} />
      </View>
      <AssignSheet
        person={assignFor}
        groups={groups.data?.groups ?? []}
        onClose={() => setAssignFor(null)}
      />
      <HealthSheet person={healthFor} onClose={() => setHealthFor(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  head: { gap: 8 },
  title: { ...typography.h2 },
  body: { ...typography.subhead },
  caption: { ...typography.caption },
  upload: { gap: 2, marginTop: 4 },
  foot: { alignItems: 'center' },
});
