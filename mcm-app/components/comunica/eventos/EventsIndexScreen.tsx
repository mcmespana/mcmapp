// «Eventos»: elegir en qué evento pasar lista (plan 07;
// `single_stic_pasar_lista_evento.php` sin `evento`).
//
//   · Arriba, lo que quedó en el móvil sin subir.
//   · Hoy (tarjetas), «Próximos» (el más cercano arriba) y «Ya pasados este
//     curso» (el más reciente arriba; también se marcan). Lo clasifica la app
//     con la fecha de hoy: lo guardado sigue bien al día siguiente sin red.
//   · Con más de 8, buscador.
//   · Precarga las listas de hoy y de los dos días siguientes.

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import EmptyState from '@/components/ui/EmptyState';
import typography from '@/constants/typography';
import { comunicaNow } from '@/services/comunica';
import { useEvents, usePrefetchEventRolls } from '@/hooks/comunica/events';
import { useFlushOutboxOnMount, useOutbox } from '@/hooks/comunica/useOutbox';
import {
  classifyEvents,
  EVENTS_SEARCH_FROM,
  fold,
} from '@/utils/comunica/events';
import { madridDay } from '@/utils/comunica/madrid';
import AreaScreen from '../comun/AreaScreen';
import AreaState from '../comun/AreaState';
import NavRow from '../comun/NavRow';
import SearchField from '../comun/SearchField';
import Section from '../comun/Section';
import SyncBadge from '../comun/SyncBadge';
import { useComunicaTheme } from '../comun/useComunicaTheme';
import { EventListRow, TodayEventCard } from './EventCards';

export default function EventsIndexScreen() {
  const t = useComunicaTheme();
  const router = useRouter();
  const q = useEvents();
  const { pending } = useOutbox();
  const [query, setQuery] = useState('');
  const today = madridDay(comunicaNow());
  useFlushOutboxOnMount();
  usePrefetchEventRolls(q.data?.events);

  const buckets = useMemo(() => {
    const needle = fold(query);
    const events = (q.data?.events ?? []).filter(
      (e) => !needle || fold(e.name).includes(needle),
    );
    return classifyEvents(events, today);
  }, [q.data, query, today]);
  const total = q.data ? classifyEvents(q.data.events, today).count : 0;
  const queued = pending.filter((e) => e.kind === 'event-roll');

  return (
    <AreaScreen onRefresh={() => q.refetch()}>
      <AreaState
        query={q}
        skeleton="cards"
        empty={{
          title: 'Tu delegación no tiene eventos este curso.',
          subtitle: 'Las sesiones de los sábados están en Pasar lista.',
          isEmpty: (d) => classifyEvents(d.events, today).count === 0,
        }}
      >
        {(data) => (
          <>
            <Text style={[styles.season, { color: t.textSecondary }]}>
              Curso {data.season}
            </Text>

            {queued.length > 0 ? (
              <Section
                warning
                title={
                  queued.length === 1
                    ? 'Tienes una lista guardada solo en el móvil'
                    : `Tienes ${queued.length} listas guardadas solo en el móvil`
                }
              >
                {queued.map((e) => (
                  <NavRow
                    key={e.key}
                    title={e.meta.label}
                    subtitle={
                      e.status === 'stuck' || e.status === 'failed'
                        ? 'No se ha podido enviar'
                        : 'Se enviará sola al volver la cobertura'
                    }
                    onPress={() =>
                      router.push({
                        pathname: '/comunica/eventos/[eventId]',
                        params: { eventId: e.meta.eventId },
                      })
                    }
                  />
                ))}
              </Section>
            ) : null}

            {total >= EVENTS_SEARCH_FROM ? (
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder="Buscar un evento…"
              />
            ) : null}

            {buckets.today.length > 0 ? (
              <Section title="Hoy" bare>
                {buckets.today.map((c) => (
                  <TodayEventCard key={c.event.id} item={c} />
                ))}
              </Section>
            ) : null}

            {buckets.upcoming.length > 0 ? (
              <Section title="Próximos">
                {buckets.upcoming.map((c) => (
                  <EventListRow key={c.event.id} event={c.event} />
                ))}
              </Section>
            ) : null}

            {buckets.past.length > 0 ? (
              <Section title="Ya pasados este curso">
                {buckets.past.map((c) => (
                  <EventListRow key={c.event.id} event={c.event} muted />
                ))}
              </Section>
            ) : null}

            {buckets.count === 0 && query ? (
              <EmptyState
                icon="search-off"
                title="Ningún evento se llama así."
                titleColor={t.text}
                compact
              />
            ) : null}

            <View style={styles.footer}>
              <SyncBadge generatedAt={q.generatedAt} />
            </View>
          </>
        )}
      </AreaState>
    </AreaScreen>
  );
}

const styles = StyleSheet.create({
  season: { ...typography.subhead },
  footer: { alignItems: 'center' },
});
