/**
 * Coordinación (plan 06): la cola de escrituras de verdad contra el servidor
 * falso y los guardarraíles de sus pantallas.
 */
import fs from 'fs';
import path from 'path';
import { QueryClient } from '@tanstack/react-query';
import { createFakeServer } from '@/services/comunica/fake';
import { createOutbox } from '@/services/comunica/outbox';
import { ROUTES, type MonitorsRollWrite } from '@/services/comunica/contract';
import { dehydrateArea } from '@/services/comunica/persist';
import { memoryBackend, setStorageBackend } from '@/services/comunica/storage';
import { nativeHrefFor } from '@/services/comunica/links';
import {
  monitorsDraftFrom,
  monitorsMarks,
  nextMonitorMarkOnTap,
  setMonitorMark,
} from '@/utils/comunica/monitorsRoll';

const SATURDAY = '2026-10-24T15:00:00Z';
const ROOT = path.join(__dirname, '..', '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const coordFiles = fs
  .readdirSync(path.join(ROOT, 'components/comunica/coordinacion'))
  .map((f) => `components/comunica/coordinacion/${f}`);

beforeEach(() => setStorageBackend(memoryBackend()));

describe('lista de monitores con la cola de verdad', () => {
  it('manda los verdes, no manda Apoyo sin tocar y sí lo tocado', async () => {
    const s = createFakeServer({
      latencyMs: 0,
      clock: SATURDAY,
      persona: 'coordination',
    });
    const roll = await s.getMonitorsRoll({ kind: 'weekly' });
    const support = roll.rows.filter(
      (r) => r.member.unassigned?.kind === 'support',
    );
    expect(support.length).toBe(2);
    expect(support.every((r) => r.optional && r.mark === null)).toBe(true);

    // Un Apoyo vino; el otro no se toca.
    let draft = monitorsDraftFrom(roll.rows);
    const came = support[0].member.id;
    draft = setMonitorMark(draft, came, nextMonitorMarkOnTap(null, true), true);
    const body: Omit<MonitorsRollWrite, 'clientId'> = {
      kind: 'weekly',
      marks: monitorsMarks(roll.rows, draft),
    };
    expect(body.marks.some((m) => m.personId === support[1].member.id)).toBe(
      false,
    );

    const outbox = createOutbox({
      personId: 'p',
      handlers: {
        'monitors-roll': (e) =>
          s.saveMonitorsRoll(e.meta.sessionId, {
            ...(e.payload as Omit<MonitorsRollWrite, 'clientId'>),
            clientId: e.clientId,
          }),
      },
      schedule: () => undefined,
    });
    await outbox.load();
    await outbox.enqueue({
      key: `monitors-roll:${roll.session!.id}`,
      kind: 'monitors-roll',
      payload: body,
      clientId: '6a1f3c20-7d4e-4b8a-9c2d-000000000099',
      meta: { sessionId: roll.session!.id },
    });
    await outbox.flush();
    expect(outbox.get(`monitors-roll:${roll.session!.id}`)?.status).toBe(
      'applied',
    );

    // Lo que diga el servidor es la verdad: se relee.
    const after = await s.getMonitorsRoll({
      kind: 'weekly',
      session: roll.session!.id,
    });
    const mark = (id: string) => after.rows.find((r) => r.member.id === id);
    expect(mark(came)?.mark).toBe('yes');
    expect(mark(support[1].member.id)?.mark).toBeNull();
    expect(
      after.rows.filter((r) => !r.optional).every((r) => r.mark !== null),
    ).toBe(true);
    outbox.dispose();
  });
});

describe('guardarraíles de Coordinación', () => {
  it('los seguimientos nunca llegan al almacén', async () => {
    expect(ROUTES.followUps.persist).toBe(false);
    const qc = new QueryClient();
    // Aunque alguien la marcara para guardar, la clave lleva el nombre de la
    // ruta y `persist.ts` la descarta.
    await qc.fetchQuery({
      queryKey: ['comunica', 'coordination', 'monitor', 'm1', 'followUps'],
      queryFn: async () => ({ items: [{ text: 'NOTA-PRIVADA' }] }),
      meta: { persist: true },
    });
    await qc.fetchQuery({
      queryKey: ['comunica', 'coordination', 'monitor', 'm1'],
      queryFn: async () => ({ monitor: { firstName: 'Ana' } }),
      meta: { persist: true },
    });
    const saved = JSON.stringify(dehydrateArea(qc));
    expect(saved).toContain('Ana');
    expect(saved).not.toContain('NOTA-PRIVADA');
    qc.clear();
  });

  it('la lista de monitores usa la fila y la hoja de Pasar Lista', () => {
    const src = read('components/comunica/coordinacion/MonitorsRollScreen.tsx');
    expect(src).toMatch(/from '\.\.\/pasar-lista\/RollRow'/);
    expect(src).toMatch(/from '\.\.\/pasar-lista\/MarkSheet'/);
    // Ninguna otra hoja de marcas en Coordinación.
    const offenders = coordFiles.filter((f) =>
      /MARK_ORDER|MARK_HELP/.test(read(f)),
    );
    expect(offenders).toEqual([]);
  });

  it('el chip y el alcance no se explican con un «porque»', () => {
    const offenders = coordFiles.filter((f) =>
      /porque (coordinas|eres|acompañas)/i.test(read(f)),
    );
    expect(offenders).toEqual([]);
  });

  it('las páginas de Coordinación del plugin abren lo nativo', () => {
    expect(nativeHrefFor({ internalpage: 'single_stic_coordinacion' })).toEqual(
      { pathname: '/comunica/coordinacion' },
    );
    expect(
      nativeHrefFor({ internalpage: 'single_stic_pasar_lista_resumen' }),
    ).toEqual({ pathname: '/comunica/coordinacion/resumen' });
    expect(
      nativeHrefFor({
        internalpage: 'single_stic_pasar_lista_monitor',
        id: 'abcdef1234',
      }),
    ).toEqual({
      pathname: '/comunica/coordinacion/monitor/[id]',
      params: { id: 'abcdef1234' },
    });
  });
});
