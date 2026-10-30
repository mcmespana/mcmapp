/**
 * Guardar una lista (`useRollSave`, revisión B hallazgo 1): no se pierden
 * marcas ni al salir con «Guardar» (el `save` registrado al principio manda el
 * borrador del momento) ni al corregir mientras sube (lo tocado después de
 * encolar sobrevive a que se aplique la subida).
 */
import React, { useCallback, useState } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import { areaKey } from '@/hooks/comunica/useAreaQuery';
import { createFakeServer } from '@/services/comunica/fake';
import { createOutbox } from '@/services/comunica/outbox';
import { memoryBackend, setStorageBackend } from '@/services/comunica/storage';
import type { RollWrite, RollWriteResult } from '@/services/comunica/contract';
import { useRollSave } from '@/hooks/comunica/useRollSave';
import { draftFrom, type RollDraft } from '@/utils/comunica/rollDraft';

const SATURDAY = '2026-10-24T15:00:00Z';

async function setup({ hold = false } = {}) {
  setStorageBackend(memoryBackend());
  const fake = createFakeServer({ latencyMs: 0, clock: SATURDAY });
  const c1 = fake.data.groups.find((g) => g.code === 'C1')!;
  const sid = fake.data.sessions.find(
    (x) => x.date === '2026-10-17' && x.stage === 'com',
  )!.id;
  const roll = await fake.getRoll(sid, c1.id);
  const sent: RollWrite[] = [];
  let release: () => void = () => {};
  const gate = hold
    ? new Promise<void>((r) => {
        release = r;
      })
    : Promise.resolve();
  const outbox = createOutbox({
    personId: 'p1',
    schedule: () => {},
    handlers: {
      roll: async (e) => {
        const body = { ...(e.payload as RollWrite), clientId: e.clientId };
        sent.push(body);
        await gate;
        return fake.saveRoll(e.meta.sessionId, e.meta.groupId, body);
      },
    },
  });
  const qc = new QueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(
    () => {
      // Como la pantalla: la lista sale de la caché (la optimista y la
      // releída la sustituyen).
      const { data: current } = useQuery({
        queryKey: areaKey(['pasar-lista', 'roll', sid, c1.id]),
        queryFn: async () => roll,
        initialData: roll,
        staleTime: Infinity,
      });
      const [state, setState] = useState<{ d: RollDraft }>({
        d: draftFrom(roll),
      });
      const resetTo = useCallback(
        (next: RollDraft) => setState({ d: next }),
        [],
      );
      const api = useRollSave({
        outbox,
        roll: current,
        group: c1,
        draft: state.d,
        resetTo,
        refetch: async () => {},
      });
      const mark = (id: string, m: RollDraft['marks'][string]) =>
        setState((s) => ({ d: { ...s.d, marks: { ...s.d.marks, [id]: m } } }));
      return { ...api, draft: state.d, mark };
    },
    { wrapper },
  );
  return { hook, outbox, sent, release, roll, fake };
}

describe('useRollSave', () => {
  it('el «Guardar» registrado al principio manda TODAS las marcas de después', async () => {
    const { hook, outbox, sent, roll } = await setup();
    // Lo que capturaría el `beforeRemove` registrado con la primera marca.
    const firstSave = hook.result.current.save;
    const ids = roll.entries.map((e) => e.person.id);
    for (const id of ids) {
      await act(async () => hook.result.current.mark(id, 'yes'));
    }
    expect(hook.result.current.save).toBe(firstSave);
    await act(async () => {
      await firstSave('save');
      await outbox.flush();
    });
    expect(Object.keys(sent[0].marks)).toHaveLength(ids.length);
    // Y al aplicarse, no se borra nada: todo vino.
    expect(Object.values(hook.result.current.draft.marks)).toEqual(
      ids.map(() => 'yes'),
    );
    expect(hook.result.current.outcome?.ok).toBe(true);
  });

  it('lo corregido mientras sube se queda en el borrador al aplicarse', async () => {
    const { hook, outbox, sent, release, roll } = await setup({ hold: true });
    const [a, b, c] = roll.entries.map((e) => e.person.id);
    await act(async () => {
      hook.result.current.mark(a, 'yes');
      hook.result.current.mark(b, 'yes');
    });
    let flushed: Promise<void> = Promise.resolve();
    await act(async () => {
      await hook.result.current.save('save');
      flushed = outbox.flush();
    });
    expect(outbox.get(`roll:${roll.session.id}:${roll.groupId}`)?.status).toBe(
      'sending',
    );
    // Mientras dice «Guardando…»: b pasa a «No vino» y se marca a c.
    await act(async () => {
      hook.result.current.mark(b, 'no_unjustified');
      hook.result.current.mark(c, 'yes');
    });
    await act(async () => {
      release();
      await flushed;
    });
    expect(sent).toHaveLength(1);
    const q = outbox.get(`roll:${roll.session.id}:${roll.groupId}`);
    expect((q?.result as RollWriteResult).roll.entries[1].mark).toBe('yes');
    const d = hook.result.current.draft.marks;
    expect(d[a]).toBe('yes');
    expect(d[b]).toBe('no_unjustified');
    expect(d[c]).toBe('yes');
  });

  it('sin nada que escribir no encola; dejar a cero una lista pasada sí', async () => {
    const { hook, outbox, sent, roll } = await setup();
    await act(async () => {
      expect(await hook.result.current.save('save')).toBe(false);
    });
    expect(hook.result.current.outcome?.text).toMatch(/No has marcado a nadie/);
    const [a] = roll.entries.map((e) => e.person.id);
    await act(async () => hook.result.current.mark(a, 'yes'));
    await act(async () => {
      await hook.result.current.save('save');
      await outbox.flush();
    });
    // La lista ya está pasada (en la caché del hook, la optimista): se quita
    // la única marca y se guarda.
    await act(async () => hook.result.current.mark(a, null));
    await act(async () => {
      expect(await hook.result.current.save('save')).toBe(true);
      await outbox.flush();
    });
    expect(sent[1].marks).toEqual({ [a]: null });
  });
});
