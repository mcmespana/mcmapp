// «Eventos que gestionas» (plan 18): los eventos de los que Comunica Tools te
// ha nombrado gestor/a. Hoy (en marcha) y próximos arriba, cada uno con
// «llegados/inscritos»; los pasados del último mes, ABAJO Y PLEGADOS
// («Pasados (3)», sin peso: ya no se trabaja en ellos, pero a veces se
// consultan). Tocar uno abre su check-in.
//
// La clasificación la hace la app con la fecha de hoy: lo guardado sigue bien
// al día siguiente sin cobertura.

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PressableFeedback } from 'heroui-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import typography from '@/constants/typography';
import { comunicaNow } from '@/services/comunica';
import type { ManagedEventSummary } from '@/services/comunica/contract';
import { useManagedEvents } from '@/hooks/comunica/managedEvents';
import { useFlushOutboxOnMount, useOutbox } from '@/hooks/comunica/useOutbox';
import { h } from '@/utils/haptics';
import {
  arrivedOf,
  classifyManaged,
  unsentCount,
} from '@/utils/comunica/checkin';
import { eventDates } from '@/utils/comunica/events';
import { madridDay } from '@/utils/comunica/madrid';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import DateCapsule from '../comun/DateCapsule';
import RecordCard from '../comun/RecordCard';
import Section from '../comun/Section';
import SyncBadge from '../comun/SyncBadge';
import { useComunicaTheme } from '../comun/useComunicaTheme';

export function useOpenCheckin() {
  const router = useRouter();
  return (eventId: string) =>
    router.push({
      pathname: '/comunica/gestion/[eventId]',
      params: { eventId },
    });
}

/** El evento de hoy: la tarjeta entera abre el check-in. */
export function ManagedTodayCard({ event }: { event: ManagedEventSummary }) {
  const open = useOpenCheckin();
  const dates = eventDates(event);
  return (
    <RecordCard
      kicker={{ label: 'En marcha', tone: 'accent' }}
      title={event.name}
      lines={[[dates, event.delegation.name].join(' · '), arrivedOf(event)]}
      cta="Hacer el check-in"
      day={event.startDate}
      onPress={() => open(event.id)}
      accessibilityLabel={`En marcha: ${event.name}, ${dates}, ${arrivedOf(event)}. Hacer el check-in`}
    />
  );
}

function ManagedRow({
  event,
  muted,
  queued,
}: {
  event: ManagedEventSummary;
  muted?: boolean;
  /** Cambios de este evento que aún no han subido. */
  queued: number;
}) {
  const t = useComunicaTheme();
  const open = useOpenCheckin();
  const dates = eventDates(event);
  const line = [dates, arrivedOf(event)].join(' · ');
  return (
    <PressableFeedback
      onPress={() => {
        h.tap();
        open(event.id);
      }}
      accessibilityRole="button"
      accessibilityLabel={[
        event.name,
        line,
        queued > 0 ? `${queued} sin subir` : null,
      ]
        .filter(Boolean)
        .join(', ')}
      style={styles.row}
    >
      <DateCapsule day={event.startDate} tone={muted ? 'neutral' : 'brand'} />
      <View style={styles.body}>
        <Text
          style={[styles.title, { color: muted ? t.textSecondary : t.text }]}
          numberOfLines={2}
        >
          {event.name}
        </Text>
        <Text style={[styles.sub, { color: t.textSecondary }]}>{line}</Text>
        {queued > 0 ? (
          <Text style={[styles.sub, { color: t.warningText }]}>
            {queued === 1
              ? '1 cambio sin subir'
              : `${queued} cambios sin subir`}
          </Text>
        ) : null}
      </View>
      <IconSymbol name="chevron.right" size={16} color={t.textMuted} />
      <PressableFeedback.Highlight />
    </PressableFeedback>
  );
}

/** «Pasados (3)»: plegado, en gris, al final. */
function PastFold({
  count,
  children,
}: {
  count: number;
  children: React.ReactNode;
}) {
  const t = useComunicaTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.past}>
      <PressableFeedback
        onPress={() => {
          h.toggle();
          setOpen((o) => !o);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Pasados, ${count}`}
        style={styles.pastHead}
      >
        <Text style={[styles.pastTitle, { color: t.textSecondary }]}>
          Pasados ({count})
        </Text>
        <IconSymbol
          name={open ? 'chevron.up' : 'chevron.down'}
          size={14}
          color={t.textMuted}
        />
      </PressableFeedback>
      {open ? children : null}
    </View>
  );
}

export default function ManagedEventsScreen() {
  const t = useComunicaTheme();
  const q = useManagedEvents();
  const { entries } = useOutbox();
  useFlushOutboxOnMount();
  const today = madridDay(comunicaNow());
  const buckets = useMemo(
    () => classifyManaged(q.data?.events ?? [], today),
    [q.data, today],
  );

  return (
    <AreaScreen onRefresh={() => q.refetch()}>
      <AreaState
        query={q}
        skeleton="cards"
        empty={{
          title: 'Ahora mismo no gestionas ningún evento.',
          subtitle:
            'Te nombran gestor/a de un evento desde Comunica Tools. Los que acabaron hace más de un mes ya no salen.',
          isEmpty: (d) => d.events.length === 0,
        }}
        forbidden={{ title: 'No gestionas ningún evento.' }}
      >
        {(data) => (
          <>
            <Text style={[styles.intro, { color: t.textSecondary }]}>
              El check-in de los eventos que te han encargado. Se guarda en
              Comunica Tools: lo que marques aquí se ve allí, y al revés.
            </Text>

            {buckets.today.length > 0 ? (
              <Section title="Hoy" bare>
                {buckets.today.map((e) => (
                  <ManagedTodayCard key={e.id} event={e} />
                ))}
              </Section>
            ) : null}

            {buckets.upcoming.length > 0 ? (
              <Section title="Próximos">
                {buckets.upcoming.map((e) => (
                  <ManagedRow
                    key={e.id}
                    event={e}
                    queued={unsentCount(entries, e.id)}
                  />
                ))}
              </Section>
            ) : null}

            {buckets.today.length === 0 && buckets.upcoming.length === 0 ? (
              <Text style={[styles.intro, { color: t.textSecondary }]}>
                No tienes ningún evento hoy ni más adelante.
              </Text>
            ) : null}

            {buckets.past.length > 0 ? (
              <PastFold count={buckets.past.length}>
                <Section>
                  {buckets.past.map((e) => (
                    <ManagedRow
                      key={e.id}
                      event={e}
                      muted
                      queued={unsentCount(entries, e.id)}
                    />
                  ))}
                </Section>
              </PastFold>
            ) : null}

            <View style={styles.footer}>
              <SyncBadge generatedAt={data.generatedAt} />
            </View>
          </>
        )}
      </AreaState>
    </AreaScreen>
  );
}

const styles = StyleSheet.create({
  intro: { ...typography.subhead },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  body: { flex: 1, gap: 2 },
  title: { ...typography.body, fontWeight: '600' },
  sub: { ...typography.caption },
  footer: { alignItems: 'center' },
  past: { gap: 8 },
  pastHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 4,
    alignSelf: 'flex-start',
  },
  pastTitle: { ...typography.subhead, fontWeight: '600' },
});
