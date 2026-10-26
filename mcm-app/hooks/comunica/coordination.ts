// Lecturas y escrituras de Coordinación (plan 06 «Datos»).
//
//   · La portada de Coordinación, el resumen, la lista de monitores, las
//     reuniones y la ficha del monitor se guardan en el móvil (por persona).
//   · Los SEGUIMIENTOS no: son lo que una persona escribió sobre otra, como la
//     salud (`persist: false`, en memoria un minuto y solo con conexión).
//   · Las escrituras (lista de monitores, reunión nueva, seguimiento, sesión
//     de hoy y vincular) van por la cola: la pantalla las enseña al momento
//     con su `UploadStatus`, y al subir se relee del servidor.

import { useCallback } from 'react';
import { getComunicaApi } from '@/services/comunica';
import type { MonitorsRollParams } from '@/services/comunica/client';
import type {
  FollowUpWrite,
  MeetingWrite,
  MonitorsRollKind,
  MonitorsRollWrite,
  Stage,
} from '@/services/comunica/contract';
import { useArea } from '@/components/comunica/comun/ComunicaAreaProvider';
import { uuidV4 } from '@/utils/comunica/uuid';
import { STALE, useAreaQuery } from './useAreaQuery';

export const COORDINATION_KEYS = {
  all: ['coordination'],
  home: ['coordination', 'home'],
  summary: ['coordination', 'summary'],
  meetings: ['coordination', 'meetings'],
  monitorsRoll: (kind: MonitorsRollKind, stage?: string, session?: string) => [
    'coordination',
    'monitors-roll',
    kind,
    stage ?? '',
    session ?? '',
  ],
  monitor: (id: string) => ['coordination', 'monitor', id],
  followUps: (id: string) => ['coordination', 'monitor', id, 'follow-ups'],
} as const;

/** Lo que nunca se guarda vive en memoria un minuto. */
const SECRET_GC_MS = 60_000;

export function useCoordination(enabled = true) {
  return useAreaQuery({
    key: COORDINATION_KEYS.home,
    fetch: () => getComunicaApi().getCoordination(),
    staleTime: STALE.state,
    enabled,
  });
}

export function useCoordinationSummary() {
  return useAreaQuery({
    key: COORDINATION_KEYS.summary,
    fetch: () => getComunicaApi().getCoordinationSummary(),
    staleTime: STALE.state,
  });
}

export function useMonitorsRoll(params: MonitorsRollParams) {
  return useAreaQuery({
    key: COORDINATION_KEYS.monitorsRoll(
      params.kind,
      params.stage,
      params.session,
    ),
    fetch: () => getComunicaApi().getMonitorsRoll(params),
    staleTime: STALE.state,
  });
}

export function useMeetings() {
  return useAreaQuery({
    key: COORDINATION_KEYS.meetings,
    fetch: () => getComunicaApi().getMeetings(),
    staleTime: STALE.state,
  });
}

export function useMonitorDetail(id: string) {
  return useAreaQuery({
    key: COORDINATION_KEYS.monitor(id),
    fetch: () => getComunicaApi().getMonitor(id),
    staleTime: STALE.state,
    enabled: !!id,
  });
}

/** Los seguimientos: nunca en el móvil, solo con conexión. */
export function useFollowUps(id: string, enabled = true) {
  return useAreaQuery({
    key: COORDINATION_KEYS.followUps(id),
    fetch: () => getComunicaApi().getFollowUps(id),
    persist: false,
    gcTime: SECRET_GC_MS,
    staleTime: 0,
    enabled: enabled && !!id,
    retry: false,
  });
}

// ── Escrituras (por la cola) ────────────────────────────────────────────────

export const coordinationOutboxKeys = {
  monitorsRoll: (sessionId: string) => `monitors-roll:${sessionId}`,
  meeting: (clientId: string) => `meeting:${clientId}`,
  followUp: (clientId: string) => `follow-up:${clientId}`,
  sessionToday: (eventId: string) => `session-today:${eventId}`,
  /** La misma que «Vincular» del plan 05: la relación es la relación. */
  assign: (membershipId: string) => `membership-group:${membershipId}`,
};

export function useCoordinationWrites() {
  const { outbox } = useArea();

  const saveMonitorsRoll = useCallback(
    async (input: {
      sessionId: string;
      body: Omit<MonitorsRollWrite, 'clientId'>;
      label: string;
      date: string;
      stage?: Stage | null;
    }) => {
      await outbox?.enqueue({
        key: coordinationOutboxKeys.monitorsRoll(input.sessionId),
        kind: 'monitors-roll',
        clientId: uuidV4(),
        payload: input.body,
        meta: {
          sessionId: input.sessionId,
          label: input.label,
          date: input.date,
          kind: input.body.kind,
          ...(input.stage ? { stage: input.stage } : {}),
        },
      });
    },
    [outbox],
  );

  /** Devuelve el `clientId`: la reunión no tiene id hasta que sube. */
  const createMeeting = useCallback(
    async (body: Omit<MeetingWrite, 'clientId'>) => {
      const clientId = uuidV4();
      await outbox?.enqueue({
        key: coordinationOutboxKeys.meeting(clientId),
        kind: 'meeting',
        clientId,
        payload: body,
        meta: { name: body.name, date: body.date, startTime: body.startTime },
      });
      return clientId;
    },
    [outbox],
  );

  const createFollowUp = useCallback(
    async (monitorId: string, body: Omit<FollowUpWrite, 'clientId'>) => {
      const clientId = uuidV4();
      await outbox?.enqueue({
        key: coordinationOutboxKeys.followUp(clientId),
        kind: 'follow-up',
        clientId,
        // El texto se queda en el móvil SOLO hasta que sube.
        payload: body,
        meta: { monitorId },
      });
      return clientId;
    },
    [outbox],
  );

  const createSessionToday = useCallback(
    async (eventId: string) => {
      await outbox?.enqueue({
        key: coordinationOutboxKeys.sessionToday(eventId),
        kind: 'session-today',
        clientId: uuidV4(),
        payload: {},
        meta: { eventId },
      });
    },
    [outbox],
  );

  /** Vincular a un monitor sin grupo: la misma escritura que el plan 05. */
  const assignMonitor = useCallback(
    async (input: {
      membershipId: string;
      personId: string;
      groupId: string;
    }) => {
      await outbox?.enqueue({
        key: coordinationOutboxKeys.assign(input.membershipId),
        kind: 'membership-group',
        clientId: uuidV4(),
        payload: { groupId: input.groupId },
        meta: { ...input, monitor: '1' },
      });
    },
    [outbox],
  );

  return {
    saveMonitorsRoll,
    createMeeting,
    createFollowUp,
    createSessionToday,
    assignMonitor,
  };
}
