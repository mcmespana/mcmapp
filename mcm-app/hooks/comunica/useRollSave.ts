// hooks/comunica/useRollSave.ts
//
// Guardar una lista (plan 04 «Guardar»), fuera de la pantalla para poder
// probarlo:
//   · `save` es ESTABLE y lee siempre el borrador y la lista del último render
//     (el «Guardar» de salir con cambios se registra una vez y, si cerrara
//     sobre el borrador de entonces, mandaría solo la primera marca).
//   · Sin nada que escribir no se encola: «No has marcado a nadie…». Dejar a
//     cero una lista ya pasada sí (`desmarcar`: van las marcas quitadas).
//   · Se encola con actualización optimista de la lista y de `/today`.
//   · Cuando la cola contesta, se compara lo mandado con lo releído
//     (`checkSaved`) y el borrador pasa a lo releído, SALVO lo que no entró y
//     lo tocado después de encolar (`draftAfterApplied`).
//   · Si acaba en `failed` o `stuck`, se relee del servidor; las marcas siguen
//     en el borrador.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  GroupWithMonitors,
  RollDetail,
  RollWrite,
  RollWriteResult,
  TodayResponse,
} from '@/services/comunica/contract';
import type { Outbox } from '@/services/comunica/outbox';
import { areaKey } from '@/hooks/comunica/useAreaQuery';
import { h } from '@/utils/haptics';
import { cameLabel, groupLabel, missedLabel } from '@/utils/comunica/marks';
import {
  applyDraft,
  checkSaved,
  draftAfterApplied,
  draftFrom,
  isDirty,
  isEmptyWrite,
  toRollWrite,
  type RollDraft,
} from '@/utils/comunica/rollDraft';
import { uuidV4 } from '@/utils/comunica/uuid';

const NOT_SAVED_COPY = {
  not_in_group: 'ya no está en el grupo',
  no_registration: 'no se ha podido inscribir',
  crm_error: 'el CRM no lo ha guardado',
} as const;

export const NOTHING_MARKED =
  'No has marcado a nadie, así que no se ha guardado nada. Marca al menos a una persona, o usa «Sin registro» si no hubo sesión.';

export interface RollOutcome {
  ok: boolean;
  text: string;
}

export const rollQueueKey = (sessionId: string, groupId: string) =>
  `roll:${sessionId}:${groupId}`;

export function useRollSave({
  outbox,
  roll,
  group,
  draft,
  resetTo,
  refetch,
}: {
  outbox: Outbox | null;
  roll: RollDetail;
  group: Pick<GroupWithMonitors, 'code' | 'name'>;
  draft: RollDraft;
  /** Pone el borrador a `next`; con `keep`, lo deja guardado en el móvil. */
  resetTo: (next: RollDraft, keep?: boolean) => void;
  refetch: () => Promise<unknown>;
}) {
  const qc = useQueryClient();
  const [outcome, setOutcome] = useState<RollOutcome | null>(null);
  const handled = useRef<string | null>(null);
  const sessionId = roll.session.id;
  const groupId = roll.groupId;
  const key = rollQueueKey(sessionId, groupId);

  // Los valores del último render, para `save` y para la respuesta de la cola.
  const latest = useRef({ outbox, roll, group, draft, resetTo, refetch });
  useEffect(() => {
    latest.current = { outbox, roll, group, draft, resetTo, refetch };
  });

  useEffect(() => {
    if (!outbox) return;
    const rollKeyQ = areaKey(['pasar-lista', 'roll', sessionId, groupId]);
    const onChange = () => {
      const q = outbox.get(key);
      if (!q) return;
      if (q.status === 'applied') {
        if (handled.current === q.clientId) return;
        handled.current = q.clientId;
        const res = q.result as RollWriteResult | undefined;
        if (!res) return;
        const sent = q.payload as RollWrite;
        const missing = checkSaved(sent, res.roll, res.notSaved);
        qc.setQueryData(rollKeyQ, res.roll);
        void qc.invalidateQueries({
          queryKey: areaKey(['pasar-lista', 'today']),
        });
        const now = latest.current;
        const next = draftAfterApplied(
          draftFrom(res.roll),
          sent,
          now.draft,
          missing,
        );
        now.resetTo(next, isDirty(res.roll, next));
        if (missing.length === 0) {
          h.success();
          setOutcome({
            ok: true,
            text:
              res.rollCall.status === 'skipped'
                ? 'Guardada como «sin registro»'
                : res.status === 'queued'
                  ? 'Subida. Falta que la confirme el CRM.'
                  : `Lista guardada · ${cameLabel(res.rollCall.counts.came)}, ${missedLabel(res.rollCall.counts.missed)}`,
          });
        } else {
          h.error();
          const names = new Map(
            now.roll.entries.map((e) => [e.person.id, e.person.firstName]),
          );
          const why = res.notSaved
            .map(
              (n) =>
                `${names.get(n.personId) ?? 'Alguien'}: ${NOT_SAVED_COPY[n.reason]}`,
            )
            .join('; ');
          setOutcome({
            ok: false,
            text: `${
              missing.length === 1
                ? '1 marca no ha quedado guardada'
                : `${missing.length} marcas no han quedado guardadas`
            }${why ? ` (${why})` : ''}.`,
          });
        }
      } else if (q.status === 'failed' || q.status === 'stuck') {
        const tag = `${q.clientId}:fail`;
        if (handled.current === tag) return;
        handled.current = tag;
        // Se relee del servidor; las marcas siguen en el borrador.
        void latest.current.refetch();
      }
    };
    return outbox.subscribe(onChange);
  }, [outbox, key, sessionId, groupId, qc]);

  /** Encola la lista. `false` si no había nada que escribir (o sin cola). */
  const save = useCallback(
    async (action: 'save' | 'skip'): Promise<boolean> => {
      const { outbox: box, roll: r, draft: d, group: g } = latest.current;
      if (!box) return false;
      if (action === 'save' && isEmptyWrite(r, d)) {
        h.error();
        setOutcome({ ok: false, text: NOTHING_MARKED });
        return false;
      }
      setOutcome(null);
      // Lo que se manda, contra la lista ANTES de la actualización optimista.
      const payload =
        action === 'save'
          ? toRollWrite(d, '', r)
          : { action: 'skip' as const, marks: {}, notes: {} };
      const takenAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      const optimistic = applyDraft(r, d, action, takenAt);
      qc.setQueryData(
        areaKey(['pasar-lista', 'roll', r.session.id, r.groupId]),
        optimistic,
      );
      qc.setQueryData<TodayResponse>(areaKey(['pasar-lista', 'today']), (td) =>
        td && optimistic.roll
          ? {
              ...td,
              rollCalls: [
                ...td.rollCalls.filter(
                  (x) =>
                    !(x.sessionId === r.session.id && x.groupId === r.groupId),
                ),
                optimistic.roll,
              ],
            }
          : td,
      );
      await box.enqueue({
        key: rollQueueKey(r.session.id, r.groupId),
        kind: 'roll',
        clientId: uuidV4(),
        payload,
        meta: {
          sessionId: r.session.id,
          groupId: r.groupId,
          date: r.session.date,
          label: groupLabel(g),
        },
      });
      h.tap();
      return true;
    },
    [qc],
  );

  return { save, outcome, setOutcome, key };
}
