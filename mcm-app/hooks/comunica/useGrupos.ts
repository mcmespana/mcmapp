// Lecturas y escrituras de Grupos y fichas (plan 05 «Datos»).
//
//   · `people`, un grupo y la ficha se guardan en el móvil (sin la salud ni
//     los datos personales, que van en sus propias rutas con `persist: false`
//     y solo se piden con conexión).
//   · Las escrituras (aviso, pañuelo, vincular) van por la cola: la pantalla
//     las enseña al momento con su `UploadStatus`.
//   · Con conexión se precargan las fichas y fotos de TUS grupos, de cuatro en
//     cuatro: el sábado sin cobertura se abren sin haberlas visitado.

import { useCallback, useEffect } from 'react';
import {
  onlineManager,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { getComunicaApi } from '@/services/comunica';
import type { ComunicaApi } from '@/services/comunica/client';
import type {
  GroupDetail,
  GroupsResponse,
  NoticeWrite,
  PeopleIndex,
  SetScarf,
} from '@/services/comunica/contract';
import { prefetchPhotos } from '@/services/comunica/photos';
import { useArea } from '@/components/comunica/comun/ComunicaAreaProvider';
import { madridDay } from '@/utils/comunica/madrid';
import { uuidV4 } from '@/utils/comunica/uuid';
import { areaKey, STALE, useAreaQuery } from './useAreaQuery';

export const GRUPOS_KEYS = {
  people: ['grupos', 'people'],
  group: (gid: string) => ['grupos', 'group', gid],
  person: (pid: string) => ['grupos', 'person', pid],
  personal: (pid: string) => ['grupos', 'personal', pid],
  health: (pid: string) => ['grupos', 'health', pid],
} as const;

/** Lo que nunca se guarda vive en memoria un minuto. */
const SECRET_GC_MS = 60_000;

export function usePeople() {
  return useAreaQuery({
    key: GRUPOS_KEYS.people,
    fetch: () => getComunicaApi().getPeople(),
    staleTime: STALE.structure,
  });
}

/**
 * Un grupo. Mientras llega, los chavales salen al instante de `people` y el
 * grupo de `/v1/groups` (los monitores, en esqueleto: `isPlaceholderData`).
 */
export function useGroupDetail(groupId: string) {
  const qc = useQueryClient();
  return useAreaQuery({
    key: GRUPOS_KEYS.group(groupId),
    fetch: () => getComunicaApi().getGroupDetail(groupId),
    staleTime: STALE.structure,
    enabled: !!groupId,
    placeholderData: () =>
      groupPlaceholder(
        qc.getQueryData<PeopleIndex>(areaKey(GRUPOS_KEYS.people)),
        qc.getQueryData<GroupsResponse>(areaKey(['pasar-lista', 'groups'])),
        groupId,
      ),
  });
}

export function groupPlaceholder(
  people: PeopleIndex | undefined,
  groups: GroupsResponse | undefined,
  groupId: string,
): GroupDetail | undefined {
  const g = groups?.groups.find((x) => x.id === groupId);
  if (!people || !g) return undefined;
  // `monitorNames` no es de `GroupSummary`: fuera.
  const { monitorNames: _monitorNames, ...group } = g;
  return {
    generatedAt: people.generatedAt,
    group,
    monitors: [],
    participants: people.people.filter((p) => p.groupId === groupId),
  };
}

export function useParticipant(personId: string) {
  return useAreaQuery({
    key: GRUPOS_KEYS.person(personId),
    fetch: () => getComunicaApi().getPerson(personId),
    staleTime: STALE.state,
    enabled: !!personId,
  });
}

/** Los datos personales: nunca en el móvil, solo con conexión. */
export function usePersonal(personId: string, enabled: boolean) {
  return useAreaQuery({
    key: GRUPOS_KEYS.personal(personId),
    fetch: () => getComunicaApi().getPersonal(personId),
    persist: false,
    gcTime: SECRET_GC_MS,
    staleTime: 0,
    enabled: enabled && !!personId,
    retry: false,
  });
}

/** La salud: solo con `canSeeHealth`, solo con conexión, nunca en el móvil. */
export function useHealth(personId: string, enabled: boolean) {
  return useAreaQuery({
    key: GRUPOS_KEYS.health(personId),
    fetch: () => getComunicaApi().getHealth(personId),
    persist: false,
    gcTime: SECRET_GC_MS,
    staleTime: 0,
    enabled: enabled && !!personId,
    retry: false,
  });
}

// ── Escrituras (por la cola) ────────────────────────────────────────────────

export const outboxKeys = {
  assign: (membershipId: string) => `membership-group:${membershipId}`,
  scarf: (personId: string) => `scarf:${personId}`,
  notice: (clientId: string) => `notice:${clientId}`,
};

export function useGruposWrites() {
  const { outbox } = useArea();
  const assignGroup = useCallback(
    async (input: {
      membershipId: string;
      personId: string;
      groupId: string;
    }) => {
      await outbox?.enqueue({
        key: outboxKeys.assign(input.membershipId),
        kind: 'membership-group',
        clientId: uuidV4(),
        payload: { groupId: input.groupId },
        meta: { ...input },
      });
    },
    [outbox],
  );
  const setScarf = useCallback(
    async (personId: string, scarf: SetScarf) => {
      await outbox?.enqueue({
        key: outboxKeys.scarf(personId),
        kind: 'scarf',
        clientId: uuidV4(),
        payload: { scarf },
        meta: { personId },
      });
    },
    [outbox],
  );
  const createNotice = useCallback(
    async (personId: string, body: Omit<NoticeWrite, 'clientId'>) => {
      const clientId = uuidV4();
      await outbox?.enqueue({
        key: outboxKeys.notice(clientId),
        kind: 'notice',
        clientId,
        payload: body,
        meta: { personId },
      });
    },
    [outbox],
  );
  return { assignGroup, setScarf, createNotice };
}

/** Hoy en Madrid, el tope de «Cuándo» de un aviso. */
export const todayMadrid = (now: Date) => madridDay(now);

// ── Precarga ────────────────────────────────────────────────────────────────

const POOL = 4;

async function inPool<T>(items: readonly T[], fn: (x: T) => Promise<unknown>) {
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item).catch(() => {});
    }
  };
  await Promise.all(Array.from({ length: POOL }, worker));
}

/**
 * Fichas y fotos de TUS grupos, para abrirlas luego sin cobertura. Las guarda
 * la caché por persona (la ficha va sin salud ni datos personales).
 */
export async function prefetchMyFichas(
  qc: QueryClient,
  api: ComunicaApi,
): Promise<number> {
  const groups = await qc.fetchQuery({
    queryKey: areaKey(['pasar-lista', 'groups']),
    queryFn: () => api.getGroups(),
    staleTime: STALE.structure,
    meta: { persist: true },
  });
  const ids: string[] = [];
  const photos: string[] = [];
  await inPool(groups.myGroupIds, async (gid) => {
    const detail = await qc.fetchQuery({
      queryKey: areaKey(GRUPOS_KEYS.group(gid)),
      queryFn: () => api.getGroupDetail(gid),
      staleTime: STALE.structure,
      meta: { persist: true },
    });
    for (const p of detail.participants) {
      ids.push(p.id);
      if (p.photoUrl) photos.push(p.photoUrl);
    }
  });
  await inPool(ids, (pid) =>
    qc.prefetchQuery({
      queryKey: areaKey(GRUPOS_KEYS.person(pid)),
      queryFn: () => api.getPerson(pid),
      staleTime: STALE.state,
      meta: { persist: true },
    }),
  );
  for (let i = 0; i < photos.length; i += POOL) {
    await prefetchPhotos(
      photos.slice(i, i + POOL).map((u) => api.photoSource(u)),
    );
  }
  return ids.length;
}

/** Monta la precarga una vez por persona y solo con conexión. */
export function usePrefetchMyFichas(enabled: boolean) {
  const qc = useQueryClient();
  const personId = useArea().session.me?.personId ?? null;
  useEffect(() => {
    if (!enabled || !personId || !onlineManager.isOnline()) return;
    void prefetchMyFichas(qc, getComunicaApi()).catch(() => {});
  }, [enabled, personId, qc]);
}
