// hooks/comunica/events.ts
//
// Pasar lista en un evento (plan 07 «En el móvil»):
//   · `['comunica','events']` y `['comunica','events',id,'roll']`, guardadas
//     en el móvil: la lista del evento es lo que se usa sin cobertura.
//   · Precarga: con conexión, al pintar la portada o los eventos, se piden ya
//     las listas de los eventos de hoy y de los dos días siguientes.
//   · Guardar: a la cola (`event-roll`), optimista sobre `marksBySession`,
//     con TODAS las marcas puestas de esa lista (gana la última).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { comunicaNow, getComunicaApi } from '@/services/comunica';
import {
  ROUTES,
  type EventRoll,
  type EventRollWrite,
  type EventRollWriteResult,
  type EventSummary,
} from '@/services/comunica/contract';
import type { Outbox } from '@/services/comunica/outbox';
import useNetworkStatus from '@/hooks/useNetworkStatus';
import { h } from '@/utils/haptics';
import { shortDate } from '@/utils/comunica/sessions';
import { addDays, madridDay } from '@/utils/comunica/madrid';
import { eventsToPrefetch } from '@/utils/comunica/events';
import {
  applyEventDraft,
  eventRollQueueKey,
  toEventRollWrite,
} from '@/utils/comunica/eventRoll';
import type { RollDraft } from '@/utils/comunica/rollDraft';
import { uuidV4 } from '@/utils/comunica/uuid';
import { areaKey, useAreaQuery } from './useAreaQuery';

const EVENTS_STALE = 5 * 60_000;
/** El día de la salida la gente se apunta y se desapunta. */
const ROLL_STALE = 60_000;
/** Hoy y los dos días siguientes. */
const PREFETCH_DAYS = 2;

export const EVENT_KEYS = {
  events: ['events'] as const,
  roll: (id: string) => ['events', id, 'roll'] as const,
};

export function useEvents() {
  return useAreaQuery({
    key: EVENT_KEYS.events,
    route: 'events',
    fetch: () => getComunicaApi().getEvents(),
    staleTime: EVENTS_STALE,
  });
}

export function useEventRoll(eventId: string) {
  return useAreaQuery({
    key: EVENT_KEYS.roll(eventId),
    route: 'eventRoll',
    fetch: () => getComunicaApi().getEventRoll(eventId),
    staleTime: ROLL_STALE,
    enabled: !!eventId,
  });
}

/**
 * Pide ya las listas de los eventos de hoy y de los dos días siguientes (con
 * conexión): quien no abrió el evento antes de perder la cobertura la tiene
 * igual.
 */
export function usePrefetchEventRolls(
  events: readonly EventSummary[] | undefined,
) {
  const qc = useQueryClient();
  const online = useNetworkStatus();
  const ids = events
    ? eventsToPrefetch(
        events,
        madridDay(comunicaNow()),
        addDays(madridDay(comunicaNow()), PREFETCH_DAYS),
      ).map((e) => e.id)
    : [];
  const key = ids.join(',');
  useEffect(() => {
    if (online === false || !key) return;
    for (const id of key.split(',')) {
      void qc.prefetchQuery({
        queryKey: areaKey(EVENT_KEYS.roll(id)),
        queryFn: () => getComunicaApi().getEventRoll(id),
        staleTime: ROLL_STALE,
        meta: { persist: ROUTES.eventRoll.persist },
      });
    }
  }, [qc, online, key]);
}

export const NOTHING_MARKED_EVENT =
  'No has marcado a nadie, así que no se ha guardado nada.';

export const estanLabel = (n: number) => `${n} ${n === 1 ? 'está' : 'están'}`;
export const faltanLabel = (n: number) =>
  `${n} ${n === 1 ? 'falta' : 'faltan'}`;

export interface EventOutcome {
  ok: boolean;
  text: string;
}

/**
 * Guardar la lista de un evento. `save` es estable y lee el borrador del
 * último render (como `useRollSave`). Sin ninguna marca no se encola. Al
 * aplicarse: «Lista guardada · 12 están, 1 falta», se relee y el borrador del
 * móvil se borra (con la sesión creada, la pantalla cambia de clave sola).
 */
export function useSaveEventRoll({
  outbox,
  roll,
  sessionId,
  day,
  draft,
  resetTo,
}: {
  outbox: Outbox | null;
  roll: EventRoll;
  sessionId: string | null;
  day: string;
  draft: RollDraft;
  resetTo: (next: RollDraft, keep?: boolean) => void;
}) {
  const qc = useQueryClient();
  const [outcome, setOutcome] = useState<EventOutcome | null>(null);
  const handled = useRef<string | null>(null);
  const eventId = roll.event.id;
  const key = eventRollQueueKey(eventId, sessionId, day);
  const latest = useRef({ outbox, roll, sessionId, day, draft, resetTo });
  useEffect(() => {
    latest.current = { outbox, roll, sessionId, day, draft, resetTo };
  });

  useEffect(() => {
    if (!outbox) return;
    const onChange = () => {
      const q = outbox.get(key);
      if (!q) return;
      if (q.status === 'applied') {
        if (handled.current === q.clientId) return;
        handled.current = q.clientId;
        const res = q.result as EventRollWriteResult | undefined;
        if (!res) return;
        h.formSuccess();
        const skipped =
          res.skipped.length === 1
            ? ' (1 persona ya no está inscrita: no se ha guardado)'
            : res.skipped.length > 1
              ? ` (${res.skipped.length} personas ya no están inscritas: no se han guardado)`
              : '';
        setOutcome({
          ok: true,
          text: `Lista guardada · ${estanLabel(res.counts.came)}, ${faltanLabel(res.counts.missed)}${skipped}`,
        });
        // El borrador ya está en el servidor: fuera del móvil.
        latest.current.resetTo(latest.current.draft, false);
        void qc.invalidateQueries({
          queryKey: areaKey(EVENT_KEYS.roll(eventId)),
        });
      } else if (q.status === 'failed' || q.status === 'stuck') {
        const tag = `${q.clientId}:fail`;
        if (handled.current === tag) return;
        handled.current = tag;
        void qc.invalidateQueries({
          queryKey: areaKey(EVENT_KEYS.roll(eventId)),
        });
      }
    };
    onChange();
    return outbox.subscribe(onChange);
  }, [outbox, key, eventId, qc]);

  const save = useCallback(async (): Promise<boolean> => {
    const now = latest.current;
    if (!now.outbox) return false;
    const body = toEventRollWrite(
      now.draft,
      now.roll.people,
      now.sessionId,
      now.day,
    );
    if (Object.keys(body.marks).length === 0) {
      h.error();
      setOutcome({ ok: false, text: NOTHING_MARKED_EVENT });
      return false;
    }
    setOutcome(null);
    qc.setQueryData<EventRoll>(
      areaKey(EVENT_KEYS.roll(now.roll.event.id)),
      (old) => (old ? applyEventDraft(old, body) : old),
    );
    await now.outbox.enqueue({
      key: eventRollQueueKey(now.roll.event.id, now.sessionId, now.day),
      kind: 'event-roll',
      clientId: uuidV4(),
      payload: body satisfies Omit<EventRollWrite, 'clientId'>,
      meta: {
        eventId: now.roll.event.id,
        date: now.day,
        label: `${now.roll.event.name} · ${shortDate(now.day)}`,
      },
    });
    h.tap();
    return true;
  }, [qc]);

  return { save, outcome, key };
}
