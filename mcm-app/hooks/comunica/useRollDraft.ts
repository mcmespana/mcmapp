// El borrador de una lista mientras se marca (plan 04): se guarda en el móvil
// a cada toque, por persona, y se recupera si la app se cierra a medias. Se
// borra al guardar y al salir del área.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useArea } from '@/components/comunica/comun/ComunicaAreaProvider';
import { readDrawer, writeDrawer } from '@/services/comunica/storage';
import type { RollDraft } from '@/utils/comunica/rollDraft';

type Drafts = Record<string, RollDraft & { updatedAt: number }>;

const SAVE_DEBOUNCE_MS = 300;

export function useRollDraft(key: string, initial: RollDraft) {
  const personId = useArea().session.me?.personId ?? null;
  const [draft, setDraftState] = useState<RollDraft>(initial);
  const [restored, setRestored] = useState(false);
  const touched = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!personId) return;
    let cancelled = false;
    void readDrawer<Drafts>(personId, 'drafts').then((all) => {
      const saved = all?.[key];
      if (cancelled || !saved || touched.current) return;
      setDraftState({ marks: saved.marks, notes: saved.notes });
      setRestored(true);
    });
    return () => {
      cancelled = true;
    };
  }, [personId, key]);

  const persist = useCallback(
    (next: RollDraft | null) => {
      if (!personId) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(
        async () => {
          const all = (await readDrawer<Drafts>(personId, 'drafts')) ?? {};
          if (next) all[key] = { ...next, updatedAt: Date.now() };
          else delete all[key];
          await writeDrawer(personId, 'drafts', all);
        },
        next ? SAVE_DEBOUNCE_MS : 0,
      );
    },
    [personId, key],
  );

  const setDraft = useCallback(
    (fn: (d: RollDraft) => RollDraft) => {
      touched.current = true;
      setDraftState((d) => {
        const next = fn(d);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  /** Pone el borrador a `next` y lo borra del móvil (o lo guarda si se pide). */
  const resetTo = useCallback(
    (next: RollDraft, keep = false) => {
      touched.current = true;
      setRestored(false);
      setDraftState(next);
      persist(keep ? next : null);
    },
    [persist],
  );

  return { draft, setDraft, resetTo, restored };
}
