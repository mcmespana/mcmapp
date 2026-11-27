// hooks/comunica/managedEvents.ts
//
// «Eventos que gestionas» (plan 18), en el móvil:
//   · `['managed-events']` y `['managed-events', id]`, guardadas en el móvil:
//     el evento entero es lo que se usa en la puerta, sin cobertura. No son
//     de equipo: la clave no lleva la delegación de trabajo.
//   · La ficha (`managedPerson`) se guarda como la de Grupos; la salud
//     (`managedHealth`), NUNCA: solo con conexión y un minuto en memoria.
//   · El SONDEO: con la pantalla a la vista, la app en primer plano y red,
//     cada 4,5 s se pregunta `checkins?since=` (solo Supabase, barato) y se
//     mezcla en el evento guardado. Así se ve lo que marcan otros, aquí o en
//     Comunica Tools.
//   · Marcar, anotar y cambiar de habitación van a la COLA
//     (`utils/comunica/checkin.ts`): se ven al momento, también sin
//     cobertura, y suben solos (la llegada, con su hora, `at`).
//   · Los datos personales (`managedPersonal`), como la salud: NUNCA en el
//     móvil.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { getComunicaApi } from '@/services/comunica';
import type {
  CheckinTarget,
  ManagedEventDetail,
} from '@/services/comunica/contract';
import { useArea } from '@/components/comunica/comun/ComunicaAreaProvider';
import useNetworkStatus from '@/hooks/useNetworkStatus';
import {
  CHECKIN_KIND,
  CHECKIN_NOTE_KIND,
  CHECKIN_ROOM_KIND,
  checkinQueueKey,
  cleanNote,
  effectiveCheckins,
  noteQueueKey,
  pendingByRegistration,
  planCheckin,
  rejectedEntries,
  roomQueueKey,
  withCheckins,
  type CheckinPayload,
  type NotePayload,
  type RoomPayload,
} from '@/utils/comunica/checkin';
import { roomUndoGroups } from '@/utils/comunica/rooms';
import { uuidV4 } from '@/utils/comunica/uuid';
import { areaKey, STALE, useAreaQuery } from './useAreaQuery';
import { useMe } from './useMe';
import { useOutbox } from './useOutbox';

export const MANAGED_KEYS = {
  list: ['managed-events'] as const,
  event: (id: string) => ['managed-events', id] as const,
  // El nombre de la ruta va en la clave: el guardado lo reconoce (`persist.ts`).
  person: (id: string, pid: string) =>
    ['managed-events', id, 'managedPerson', pid] as const,
  health: (id: string, pid: string) =>
    ['managed-events', id, 'managedHealth', pid] as const,
  personal: (id: string, pid: string) =>
    ['managed-events', id, 'managedPersonal', pid] as const,
};

/** Cada cuánto se pregunta por lo nuevo con la pantalla abierta (como Comunica Tools). */
export const CHECKIN_POLL_MS = 4_500;
/** Lo que nunca se guarda vive en memoria un minuto. */
const SECRET_GC_MS = 60_000;

export function useManagedEvents() {
  return useAreaQuery({
    key: MANAGED_KEYS.list,
    route: 'managedEvents',
    fetch: () => getComunicaApi().getManagedEvents(),
    staleTime: STALE.state,
  });
}

export function useManagedEvent(eventId: string) {
  return useAreaQuery({
    key: MANAGED_KEYS.event(eventId),
    route: 'managedEvent',
    fetch: () => getComunicaApi().getManagedEvent(eventId),
    staleTime: STALE.state,
    enabled: !!eventId,
  });
}

export function useManagedPerson(eventId: string, personId: string) {
  return useAreaQuery({
    key: MANAGED_KEYS.person(eventId, personId),
    route: 'managedPerson',
    fetch: () => getComunicaApi().getManagedPerson(eventId, personId),
    staleTime: STALE.state,
    enabled: !!eventId && !!personId,
  });
}

export function useManagedHealth(
  eventId: string,
  personId: string,
  enabled: boolean,
) {
  return useAreaQuery({
    key: MANAGED_KEYS.health(eventId, personId),
    route: 'managedHealth',
    fetch: () => getComunicaApi().getManagedHealth(eventId, personId),
    gcTime: SECRET_GC_MS,
    staleTime: 0,
    enabled: enabled && !!eventId && !!personId,
    retry: false,
  });
}

/** Los datos personales completos (con el documento): nunca en el móvil. */
export function useManagedPersonal(
  eventId: string,
  personId: string,
  enabled: boolean,
) {
  return useAreaQuery({
    key: MANAGED_KEYS.personal(eventId, personId),
    route: 'managedPersonal',
    fetch: () => getComunicaApi().getManagedPersonal(eventId, personId),
    gcTime: SECRET_GC_MS,
    staleTime: 0,
    enabled: enabled && !!eventId && !!personId,
    retry: false,
  });
}

/** ¿La app está en primer plano? */
function useForeground() {
  const ref = useRef(AppState.currentState !== 'background');
  const listeners = useRef(new Set<() => void>());
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      ref.current = s === 'active';
      listeners.current.forEach((l) => l());
    });
    return () => sub.remove();
  }, []);
  return { ref, listeners };
}

/**
 * El sondeo de `checkins?since=`: solo con `active` (la pantalla a la vista),
 * la app en primer plano y sin saber que no hay red. Una pregunta cada vez; si
 * falla, se vuelve a probar en la siguiente vuelta, sin avisar.
 */
export function useCheckinPolling(eventId: string, active: boolean) {
  const qc = useQueryClient();
  const online = useNetworkStatus();
  const { ref: foreground, listeners } = useForeground();
  useEffect(() => {
    if (!active || !eventId || online === false) return;
    let stopped = false;
    let inFlight = false;
    const key = areaKey(MANAGED_KEYS.event(eventId));
    const tick = async () => {
      if (stopped || inFlight || !foreground.current) return;
      const detail = qc.getQueryData<ManagedEventDetail>(key);
      if (!detail) return;
      inFlight = true;
      try {
        const res = await getComunicaApi().getManagedCheckins(
          eventId,
          detail.since,
        );
        if (stopped) return;
        qc.setQueryData<ManagedEventDetail>(key, (old) =>
          old ? withCheckins(old, res.checkins, res.since) : old,
        );
      } catch {
        // Sin red o el servidor no contesta: la siguiente vuelta lo intenta.
      } finally {
        inFlight = false;
      }
    };
    const timer = setInterval(() => void tick(), CHECKIN_POLL_MS);
    // Al volver al primer plano, sin esperar a la siguiente vuelta.
    const onChange = () => {
      if (foreground.current) void tick();
    };
    listeners.current.add(onChange);
    const set = listeners.current;
    return () => {
      stopped = true;
      clearInterval(timer);
      set.delete(onChange);
    };
  }, [qc, eventId, active, online, foreground, listeners]);
}

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

/**
 * El check-in de un evento: el estado que se pinta (servidor + cola) y las
 * dos escrituras, a la cola.
 */
export function useCheckin(
  eventId: string,
  detail: ManagedEventDetail | undefined,
) {
  const { outbox } = useArea();
  const { entries } = useOutbox();
  const { me } = useMe();
  const myName = me?.name;

  const pending = useMemo(
    () => pendingByRegistration(entries, eventId),
    [entries, eventId],
  );
  const effective = useMemo(
    () => (detail ? effectiveCheckins(detail, pending, myName) : new Map()),
    [detail, pending, myName],
  );
  const rejected = useMemo(
    () => rejectedEntries(entries, eventId),
    [entries, eventId],
  );

  const latest = useRef({ outbox, entries, detail, effective });
  useEffect(() => {
    latest.current = { outbox, entries, detail, effective };
  });

  /**
   * Saca a `ids` de las tandas de `kind` que aún no han subido (para que el
   * orden de subida no resucite lo de antes).
   */
  const unqueue = useCallback(
    async (ids: readonly string[], kind: string) => {
      const { outbox: box, entries: now } = latest.current;
      if (!box) return;
      const plan = planCheckin<{ registrationIds: string[] }>(
        now,
        eventId,
        ids,
        kind,
      );
      for (const key of plan.remove) await box.discard(key);
      for (const u of plan.update) {
        const e = now.find((x) => x.key === u.key)!;
        await box.enqueue({
          key: u.key,
          kind,
          clientId: uuidV4(),
          payload: u.payload,
          meta: e.meta,
        });
      }
    },
    [eventId],
  );

  /** Marcar a una o varias inscripciones. Devuelve si se ha apuntado. */
  const mark = useCallback(
    async (ids: readonly string[], to: CheckinTarget): Promise<boolean> => {
      const { outbox: box, detail: d } = latest.current;
      if (!box || ids.length === 0) return false;
      await unqueue(ids, CHECKIN_KIND);
      const payload: CheckinPayload = {
        registrationIds: [...ids],
        to,
        at: nowIso(),
      };
      await box.enqueue({
        key: checkinQueueKey(eventId, uuidV4()),
        kind: CHECKIN_KIND,
        clientId: uuidV4(),
        payload,
        meta: { eventId, label: d?.event.name ?? '' },
      });
      return true;
    },
    [eventId, unqueue],
  );

  /**
   * La habitación de una o varias inscripciones (`null` = sin habitación).
   * Devuelve cómo deshacerlo (cada uno a la suya de antes), o `null` si no
   * se ha apuntado.
   */
  const setRoom = useCallback(
    async (
      ids: readonly string[],
      roomId: string | null,
    ): Promise<(() => Promise<void>) | null> => {
      const { outbox: box, detail: d } = latest.current;
      if (!box || ids.length === 0) return null;
      const before = roomUndoGroups(ids, latest.current.effective);
      const put = async (list: readonly string[], to: string | null) => {
        await unqueue(list, CHECKIN_ROOM_KIND);
        const payload: RoomPayload = { registrationIds: [...list], roomId: to };
        await latest.current.outbox?.enqueue({
          key: roomQueueKey(eventId, uuidV4()),
          kind: CHECKIN_ROOM_KIND,
          clientId: uuidV4(),
          payload,
          meta: { eventId, label: d?.event.name ?? '' },
        });
      };
      await put(ids, roomId);
      return async () => {
        for (const g of before) await put(g.ids, g.roomId);
      };
    },
    [eventId, unqueue],
  );

  /** La nota de una inscripción (vacía, la borra). */
  const setNote = useCallback(
    async (registrationId: string, note: string): Promise<boolean> => {
      const { outbox: box, detail: d } = latest.current;
      if (!box) return false;
      const payload: NotePayload = { registrationId, note: cleanNote(note) };
      await box.enqueue({
        key: noteQueueKey(eventId, registrationId),
        kind: CHECKIN_NOTE_KIND,
        clientId: uuidV4(),
        payload,
        meta: { eventId, label: d?.event.name ?? '' },
      });
      return true;
    },
    [eventId],
  );

  const discardRejected = useCallback(async () => {
    const box = latest.current.outbox;
    if (!box) return;
    for (const e of rejectedEntries(latest.current.entries, eventId)) {
      await box.discard(e.key);
    }
  }, [eventId]);

  return {
    effective,
    pending,
    unsent: pending.size,
    rejected,
    mark,
    setNote,
    setRoom,
    discardRejected,
  };
}
