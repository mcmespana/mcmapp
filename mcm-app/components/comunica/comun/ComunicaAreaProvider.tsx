// El motor del área nativa, montado en el `_layout` de la pestaña (plan 01).
// No en la raíz de la app: así no toca al resto y se va con el interruptor.
//
//   · `QueryClient` propio. Refresca lo que está en pantalla al volver la app y
//     al recuperar la conexión.
//   · La sesión (plan 02): se lee al montar.
//   · La caché, guardada en el móvil POR PERSONA: al entrar se recupera (sin
//     cobertura se ve lo de la última vez) y se va guardando. Solo las
//     consultas con `persist: true` (`ROUTES` del contrato), y NUNCA las de
//     salud ni datos personales aunque alguien las marque. Si no cabe, se
//     sacrifican las fichas más viejas, no la caché entera; si el móvil no
//     deja escribir, se queda lo de la vez anterior.
//   · La cola de escrituras de esa persona, que sube al encolar, al
//     reconectar, al volver la app y al abrir una pantalla del área. Sabe
//     subir listas (plan 04), avisos, pañuelos y vincular a un grupo (plan 05),
//     y la lista de monitores, reuniones, seguimientos y la sesión de hoy
//     (plan 06).
//     Se crea al entrar y se APAGA (`dispose`) al salir o cambiar de persona:
//     ni reintentos ni escrituras de A después.

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { AppState, Platform } from 'react-native';
import * as Network from 'expo-network';
import {
  focusManager,
  hydrate,
  onlineManager,
  QueryClient,
  QueryClientProvider,
  type DehydratedState,
} from '@tanstack/react-query';
import {
  getComunicaApi,
  getFakeServer,
  isComunicaApiAvailable,
} from '@/services/comunica';
import type {
  DeviceRegistration,
  FollowUpsResponse,
  FollowUpWrite,
  FollowUpWriteResult,
  MeetingWrite,
  MonitorsRollWrite,
  EventRollWrite,
  NoticeWrite,
  NoticeWriteResult,
  ParticipantProfile,
  PeopleIndex,
  RollWrite,
  RollWriteResult,
  SetScarf,
} from '@/services/comunica/contract';
import { createOutbox, type Outbox } from '@/services/comunica/outbox';
import {
  getSessionState,
  initSession,
  onSessionEnd,
  subscribeSession,
  type SessionState,
} from '@/services/comunica/session';
import { readDrawer, writeDrawer } from '@/services/comunica/storage';
import { dehydrateArea, fitForStorage } from '@/services/comunica/persist';
import { areaKey } from '@/hooks/comunica/useAreaQuery';
import { useAreaBridge } from '@/hooks/comunica/useAreaBridge';
import { logger } from '@/utils/logger';

export function createAreaQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Lo guardado se queda: sin cobertura, se sigue viendo.
        gcTime: 24 * 60 * 60_000,
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
        networkMode: 'offlineFirst',
      },
      mutations: { networkMode: 'offlineFirst' },
    },
  });
}

let wired = false;
function wireManagers() {
  if (wired || Platform.OS === 'web') return;
  wired = true;
  focusManager.setEventListener((setFocused) => {
    const sub = AppState.addEventListener('change', (s) =>
      setFocused(s === 'active'),
    );
    return () => sub.remove();
  });
  onlineManager.setEventListener((setOnline) => {
    const sub = Network.addNetworkStateListener((s) =>
      setOnline(!!s.isConnected),
    );
    return () => sub.remove();
  });
}

/** Cada cuánto, como mucho, se guarda la caché en el móvil. */
const PERSIST_DEBOUNCE_MS = 1_000;

/** ¿Sigue dentro esta persona? Lo de otra (o de nadie) no se guarda. */
const stillSignedIn = (personId: string) => {
  const s = getSessionState();
  return s.status === 'signedIn' && s.me?.personId === personId;
};

interface AreaContextValue {
  session: SessionState;
  outbox: Outbox | null;
  /** Se ha recuperado ya lo guardado de esta persona. */
  restored: boolean;
}

const AreaContext = createContext<AreaContextValue>({
  session: { status: 'loading', me: null },
  outbox: null,
  restored: false,
});

export const useArea = () => useContext(AreaContext);

const noop = () => () => {};

export default function ComunicaAreaProvider({
  children,
  client,
}: {
  children: React.ReactNode;
  client?: QueryClient;
}) {
  const [qc] = useState(() => client ?? createAreaQueryClient());
  const available = isComunicaApiAvailable();
  const session = useSyncExternalStore(
    available ? subscribeSession : noop,
    getSessionState,
  );
  const personId =
    session.status === 'signedIn' ? (session.me?.personId ?? null) : null;
  const [restoredFor, setRestoredFor] = useState<string | null>(null);

  useEffect(() => wireManagers(), []);

  useEffect(() => {
    if (!available) return;
    getComunicaApi(); // configura la sesión
    void initSession();
  }, [available]);

  // Con el servidor falso, tocar un mando (el reloj, sin conexión…) vuelve a
  // pedir lo que hay en pantalla.
  useEffect(() => {
    if (!available) return;
    const fake = getFakeServer();
    if (!fake) return;
    return fake.subscribe(() => {
      qc.invalidateQueries({ queryKey: ['comunica'] });
    });
  }, [qc, available]);

  // La caché de ESTA persona: se recupera al entrar y se guarda al cambiar.
  useEffect(() => {
    qc.clear();
    if (!personId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      timer = null;
    };
    // Al salir, se para ANTES de que se borre nada (no espera a React).
    const offEnd = onSessionEnd(stop);
    readDrawer<DehydratedState>(personId, 'queries')
      .then((saved) => {
        if (cancelled) return;
        if (saved) {
          try {
            hydrate(qc, saved);
          } catch (e) {
            logger.warn('[comunica] caché ilegible', e);
          }
        }
        setRestoredFor(personId);
      })
      .catch((e) => logger.warn('[comunica] caché ilegible', e));
    const unsub = qc.getQueryCache().subscribe(() => {
      if (timer || cancelled) return;
      timer = setTimeout(() => {
        timer = null;
        if (cancelled || !stillSignedIn(personId)) return;
        try {
          // `writeDrawer` no lanza: si no cabe, se queda lo de antes.
          void writeDrawer(
            personId,
            'queries',
            fitForStorage(dehydrateArea(qc)),
          );
        } catch (e) {
          logger.warn('[comunica] no se ha podido guardar la caché', e);
        }
      }, PERSIST_DEBOUNCE_MS);
    });
    return () => {
      stop();
      offEnd();
      unsub();
    };
  }, [qc, personId]);

  // La cola de esta persona: se crea al entrar (sin efectos: solo memoria) y
  // se apaga al salir o cambiar de persona (abajo).
  const outbox = useMemo<Outbox | null>(() => {
    if (!personId) return null;
    return createOutbox({
      personId,
      handlers: {
        roll: (e) =>
          getComunicaApi().saveRoll(
            e.meta.sessionId,
            e.meta.groupId,
            // El `clientId` es el de la entrada: el mismo en cada reintento.
            { ...(e.payload as RollWrite), clientId: e.clientId },
          ),
        // Grupos y fichas (plan 05).
        notice: (e) =>
          getComunicaApi().createNotice(e.meta.personId, {
            ...(e.payload as Omit<NoticeWrite, 'clientId'>),
            clientId: e.clientId,
          }),
        scarf: (e) =>
          getComunicaApi().setScarf(e.meta.personId, {
            scarf: (e.payload as { scarf: SetScarf }).scarf,
            clientId: e.clientId,
          }),
        'membership-group': (e) =>
          getComunicaApi().assignGroup(e.meta.membershipId, {
            groupId: (e.payload as { groupId: string }).groupId,
            clientId: e.clientId,
          }),
        // Coordinación (plan 06).
        'monitors-roll': (e) =>
          getComunicaApi().saveMonitorsRoll(e.meta.sessionId, {
            ...(e.payload as Omit<MonitorsRollWrite, 'clientId'>),
            clientId: e.clientId,
          }),
        meeting: (e) =>
          getComunicaApi().createMeeting({
            ...(e.payload as Omit<MeetingWrite, 'clientId'>),
            clientId: e.clientId,
          }),
        'follow-up': (e) =>
          getComunicaApi().createFollowUp(e.meta.monitorId, {
            ...(e.payload as Omit<FollowUpWrite, 'clientId'>),
            clientId: e.clientId,
          }),
        'session-today': (e) =>
          getComunicaApi().createSessionToday(e.meta.eventId, {
            clientId: e.clientId,
          }),
        // Pasar lista en un evento (plan 07): el día viaja en el payload, así
        // que lo que sube mañana crea la sesión de HOY.
        'event-roll': (e) =>
          getComunicaApi().saveEventRoll(e.meta.eventId, {
            ...(e.payload as Omit<EventRollWrite, 'clientId'>),
            clientId: e.clientId,
          }),
        // Avisos en el móvil (plan 08): el alta de este móvil.
        device: (e) =>
          getComunicaApi().registerDevice({
            ...(e.payload as Omit<DeviceRegistration, 'clientId'>),
            clientId: e.clientId,
          }),
      },
      onApplied: (e, result) => {
        if (e.kind === 'roll') {
          const res = result as RollWriteResult;
          qc.setQueryData(
            areaKey(['pasar-lista', 'roll', e.meta.sessionId, e.meta.groupId]),
            res.roll,
          );
          void qc.invalidateQueries({
            queryKey: areaKey(['pasar-lista', 'today']),
          });
        }
        // Lo subido se pone en la caché al momento (sin esperar a releer) y
        // luego se relee: la pantalla no parpadea entre «Subida» y lo nuevo.
        const personKey = areaKey(['grupos', 'person', e.meta.personId]);
        if (e.kind === 'notice') {
          const { notice } = result as NoticeWriteResult;
          qc.setQueryData<ParticipantProfile>(personKey, (old) =>
            old && !old.notices.some((n) => n.id === notice.id)
              ? { ...old, notices: [...old.notices, notice] }
              : old,
          );
          void qc.invalidateQueries({ queryKey: personKey });
        }
        if (e.kind === 'scarf') {
          const { scarf } = e.payload as { scarf: SetScarf };
          qc.setQueryData<ParticipantProfile>(personKey, (old) =>
            old ? { ...old, scarf } : old,
          );
          void qc.invalidateQueries({ queryKey: personKey });
        }
        // Coordinación: lo que diga el servidor es la verdad (la lista de
        // monitores NO se verifica comparando con lo de antes, plan 06 §3).
        if (e.kind === 'monitors-roll' || e.kind === 'session-today') {
          void qc.invalidateQueries({ queryKey: areaKey(['coordination']) });
          void qc.invalidateQueries({
            queryKey: areaKey(['pasar-lista', 'today']),
          });
        }
        if (e.kind === 'meeting') {
          void qc.invalidateQueries({ queryKey: areaKey(['coordination']) });
          void qc.invalidateQueries({
            queryKey: areaKey(['pasar-lista', 'today']),
          });
        }
        if (e.kind === 'follow-up') {
          const { item } = result as FollowUpWriteResult;
          const key = areaKey(['coordination', 'monitor', e.meta.monitorId]);
          qc.setQueryData<FollowUpsResponse>([...key, 'followUps'], (old) =>
            old && !old.items.some((x) => x.id === item.id)
              ? { ...old, items: [item, ...old.items] }
              : old,
          );
          void qc.invalidateQueries({ queryKey: [...key, 'followUps'] });
        }
        if (e.kind === 'event-roll') {
          void qc.invalidateQueries({
            queryKey: areaKey(['events', e.meta.eventId, 'roll']),
          });
        }
        if (e.kind === 'membership-group') {
          void qc.invalidateQueries({
            queryKey: areaKey(['coordination', 'home']),
          });
          const { groupId } = e.payload as { groupId: string };
          qc.setQueryData<PeopleIndex>(
            areaKey(['grupos', 'people']),
            (old) =>
              old && {
                ...old,
                people: old.people.map((p) =>
                  p.unassignedMembershipId === e.meta.membershipId
                    ? { ...p, groupId, unassignedMembershipId: undefined }
                    : p,
                ),
              },
          );
          void qc.invalidateQueries({ queryKey: areaKey(['grupos']) });
          void qc.invalidateQueries({
            queryKey: areaKey(['pasar-lista', 'groups']),
          });
        }
      },
    });
  }, [qc, personId]);

  useEffect(() => {
    if (!outbox) return;
    const box = outbox;
    // Salir la apaga en el acto, antes de borrar el móvil.
    const offEnd = onSessionEnd(() => box.dispose());
    box
      .load()
      .then(() => box.wake())
      .catch((e) => logger.warn('[comunica] cola ilegible', e));
    const offOnline = onlineManager.subscribe((online) => {
      if (online) void box.wake();
    });
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void box.wake();
    });
    return () => {
      offEnd();
      offOnline();
      sub.remove();
      box.dispose();
    };
  }, [outbox]);

  // Avisos (plan 08): la cola para la raíz y refrescar al llegar un aviso.
  useAreaBridge(qc, outbox);

  const value = useMemo(
    () => ({
      session,
      outbox,
      restored: !!personId && restoredFor === personId,
    }),
    [session, outbox, personId, restoredFor],
  );

  return (
    <QueryClientProvider client={qc}>
      <AreaContext.Provider value={value}>{children}</AreaContext.Provider>
    </QueryClientProvider>
  );
}
