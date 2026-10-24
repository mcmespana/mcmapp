// Historial de listas de un grupo (plan 04): las sesiones celebradas, la
// última arriba, con su estado. Funciona sin cobertura (sale de lo guardado).
// Tocar una lleva a marcar esa fecha.

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import EmptyState from '@/components/ui/EmptyState';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { comunicaNow } from '@/services/comunica';
import type { RollCallSummary } from '@/services/comunica/contract';
import { useGroups, useToday } from '@/hooks/comunica/usePasarLista';
import { useOutbox } from '@/hooks/comunica/useOutbox';
import { longDay } from '@/utils/comunica/dates';
import { madridTime } from '@/utils/comunica/madrid';
import { cameLabel, groupLabel, missedLabel } from '@/utils/comunica/marks';
import { rollIndex, sessionsForGroup } from '@/utils/comunica/pasarLista';
import { sessionOptions } from '@/utils/comunica/sessions';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import Section from '../comun/Section';
import UploadStatus from '../comun/UploadStatus';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import RollStateDot from './RollStateDot';

export default function RollHistoryScreen({ groupId }: { groupId: string }) {
  const groups = useGroups();
  const today = useToday();
  const group = groups.data?.groups.find((g) => g.id === groupId);
  return (
    <>
      <Stack.Screen
        options={{
          title: group ? groupLabel(group) : 'Historial de listas',
          headerLargeTitle: false,
        }}
      />
      <AreaState query={groups} skeleton="list">
        {(g) => (
          <History
            groupId={groupId}
            data={g}
            rollCalls={today.data?.rollCalls ?? []}
            refetch={() => Promise.all([groups.refetch(), today.refetch()])}
          />
        )}
      </AreaState>
    </>
  );
}

function History({
  groupId,
  data,
  rollCalls,
  refetch,
}: {
  groupId: string;
  data: NonNullable<ReturnType<typeof useGroups>['data']>;
  rollCalls: readonly RollCallSummary[];
  refetch: () => Promise<unknown>;
}) {
  const t = useComunicaTheme();
  const router = useRouter();
  const { get } = useOutbox();
  const group = data.groups.find((g) => g.id === groupId);
  const options = useMemo(() => {
    if (!group) return [];
    const sessions = sessionsForGroup(group, data.stageEvents);
    const idx = rollIndex(rollCalls);
    const m = new Map<string, RollCallSummary>();
    sessions.forEach((s) => {
      const r = idx.get(`${s.id}:${groupId}`);
      if (r) m.set(s.id, r);
    });
    return sessionOptions(sessions, m, comunicaNow());
  }, [group, data.stageEvents, rollCalls, groupId]);

  if (!group) {
    return (
      <EmptyState
        icon="lock"
        title="No tienes acceso a esto"
        titleColor={t.text}
      />
    );
  }

  return (
    <AreaScreen onRefresh={refetch}>
      <Text
        style={[styles.title, { color: t.text }]}
        accessibilityRole="header"
      >
        Historial de listas
      </Text>
      {options.length === 0 ? (
        <EmptyState
          icon="event"
          title="Todavía no ha habido ninguna sesión."
          titleColor={t.text}
          compact
        />
      ) : (
        <Section>
          {options.map((o) => {
            const q = get(`roll:${o.session.id}:${groupId}`);
            const pending = q && q.status !== 'applied';
            const detail =
              o.state === 'taken' && o.roll
                ? `${cameLabel(o.roll.counts.came)} · ${missedLabel(o.roll.counts.missed)}`
                : o.state === 'skipped'
                  ? 'Sin registro'
                  : 'Sin pasar';
            return (
              <PressableFeedback
                key={o.session.id}
                onPress={() =>
                  router.push({
                    pathname: '/comunica/pasar-lista/[groupId]',
                    params: { groupId, sesion: o.session.id },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`${longDay(o.session.date)}, ${detail}`}
                style={styles.row}
              >
                <PressableFeedback.Highlight />
                <View style={styles.rowBody}>
                  <Text style={[styles.rowTitle, { color: t.text }]}>
                    {longDay(o.session.date)} · {madridTime(o.session.startsAt)}
                  </Text>
                  {pending && q ? (
                    <UploadStatus state={q.status} />
                  ) : (
                    <Text style={[styles.rowSub, { color: t.textSecondary }]}>
                      {detail}
                    </Text>
                  )}
                </View>
                <RollStateDot state={pending ? 'queued' : o.state} />
                <IconSymbol
                  name="chevron.right"
                  size={16}
                  color={t.textMuted}
                />
              </PressableFeedback>
            );
          })}
        </Section>
      )}
    </AreaScreen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.h2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...typography.body, fontWeight: '600' },
  rowSub: { ...typography.caption },
});
