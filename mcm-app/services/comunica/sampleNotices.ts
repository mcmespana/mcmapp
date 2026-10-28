// services/comunica/sampleNotices.ts
//
// «Simular aviso» del Laboratorio Alpha (plan 08): el `data` de cada tipo de
// aviso con ids de los datos inventados del servidor falso (un grupo de la
// persona con la que se ha entrado y su última sesión), para programarlo como
// aviso LOCAL y probar a dónde lleva sin servidor de verdad.

import type { ComunicaPushData } from './contract';
import type { FakeServer } from './fake';
import { getSessionState } from './session';
import { madridDay } from '@/utils/comunica/madrid';
import { uuidV4 } from '@/utils/comunica/uuid';

export function sampleNoticeData(
  fake: FakeServer,
  type: ComunicaPushData['type'],
  now: Date = new Date(),
): ComunicaPushData {
  const base = {
    source: 'comunica',
    v: 1,
    id: `comunica:${uuidV4()}`,
    type,
  } as const;
  if (type === 'outbox_pending') return base;
  const { data } = fake;
  const personId =
    getSessionState().me?.personId ??
    data.personas[fake.controls.persona].personId;
  const me = data.people.find((p) => p.id === personId);
  const groups = data.groups.filter((g) => g.delegationId === me?.delegationId);
  const group =
    groups.find((g) => g.monitorIds.includes(personId)) ?? groups[0];
  if (!group) return base;
  if (type === 'group_changed') return { ...base, groupId: group.id };
  const today = madridDay(now);
  const session = data.sessions
    .filter(
      (s) =>
        s.kind === 'weekly' &&
        s.stage === group.stage &&
        s.delegationId === group.delegationId &&
        s.date <= today,
    )
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  return {
    ...base,
    groupId: group.id,
    ...(session ? { sessionId: session.id } : {}),
  };
}
