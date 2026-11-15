/**
 * El recordatorio de pasar lista que manda coordinación (15/11/2026): los 100
 * mensajes, a quién se puede avisar, lo que se le dice a quien lo manda y el
 * servidor falso (solo coordinación, solo sus grupos, 10 minutos por grupo).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createFakeServer } from '@/services/comunica/fake';
import { ComunicaApiError } from '@/services/comunica/client';
import {
  ROLL_REMINDER_MESSAGE_MAX,
  RollReminderWrite,
  type StageStrip,
} from '@/services/comunica/contract';
import {
  cleanReminder,
  defaultReminderSelection,
  loadReminderTone,
  randomReminder,
  remindableIds,
  REMINDER_MESSAGES,
  reminderIsValid,
  reminderResultText,
  saveReminderTone,
} from '@/utils/comunica/rollReminders';

const CLIENT = (n: number) =>
  `6a1f3c20-7d4e-4b8a-9c2d-${String(n).padStart(12, '0')}`;

describe('los mensajes', () => {
  it('son 100: 50 con guasa y 50 serios, sin repetir', () => {
    expect(REMINDER_MESSAGES.funny).toHaveLength(50);
    expect(REMINDER_MESSAGES.serious).toHaveLength(50);
    const all = [...REMINDER_MESSAGES.funny, ...REMINDER_MESSAGES.serious];
    expect(new Set(all).size).toBe(100);
  });

  it('cada uno cabe en el aviso, en una línea y tal cual se manda', () => {
    for (const m of [
      ...REMINDER_MESSAGES.funny,
      ...REMINDER_MESSAGES.serious,
    ]) {
      expect(m.length).toBeLessThanOrEqual(ROLL_REMINDER_MESSAGE_MAX);
      expect(cleanReminder(m)).toBe(m);
      expect(reminderIsValid(m)).toBe(true);
    }
  });

  it('al azar, del tono pedido y distinto del que ya se ve', () => {
    const first = REMINDER_MESSAGES.funny[0];
    expect(randomReminder('funny', undefined, () => 0)).toBe(first);
    expect(randomReminder('funny', first, () => 0)).toBe(
      REMINDER_MESSAGES.funny[1],
    );
    expect(REMINDER_MESSAGES.serious).toContain(
      randomReminder('serious', undefined, () => 0.999999),
    );
  });

  it('a mano: una línea, algo escrito y 120 como mucho', () => {
    expect(cleanReminder('  Máquina,\n pasa   lista ')).toBe(
      'Máquina, pasa lista',
    );
    expect(reminderIsValid('   ')).toBe(false);
    expect(reminderIsValid('x'.repeat(120))).toBe(true);
    expect(reminderIsValid('x'.repeat(121))).toBe(false);
    const body = { clientId: CLIENT(1), groupIds: ['g'], message: 'a' };
    expect(RollReminderWrite.safeParse(body).success).toBe(true);
    expect(
      RollReminderWrite.safeParse({ ...body, message: 'x'.repeat(121) })
        .success,
    ).toBe(false);
    expect(RollReminderWrite.safeParse({ ...body, groupIds: [] }).success).toBe(
      false,
    );
  });

  it('el tono se queda guardado en el móvil (gracioso si no hay nada)', async () => {
    await AsyncStorage.clear();
    expect(await loadReminderTone()).toBe('funny');
    await saveReminderTone('serious');
    expect(await loadReminderTone()).toBe('serious');
  });
});

describe('a quién se avisa', () => {
  const row = (id: string, cells: StageStrip['rows'][number]['cells'], n = 1) =>
    ({
      group: { id, code: id, name: id },
      monitors: Array.from({ length: n }, (_, i) => ({
        id: `${id}-m${i}`,
        name: 'M',
      })),
      headcount: null,
      cells,
    }) as StageStrip['rows'][number];
  const strips = [
    {
      stage: 'mic',
      sessions: [],
      rows: [
        row('falta', ['taken', null]),
        row('aldia', ['taken', 'taken']),
        row('pasada', [null, 'taken']),
        row('sinmonis', ['taken', null], 0),
      ],
    },
  ] as unknown as StageStrip[];

  it('solo a grupos con monitores vinculados', () => {
    expect(remindableIds(strips)).toEqual(['falta', 'aldia', 'pasada']);
  });

  it('salen marcados los que tienen la última lista sin pasar', () => {
    expect(defaultReminderSelection(strips)).toEqual(['falta']);
  });
});

describe('lo que se le dice a quien lo manda', () => {
  const r = (monitors: number, reached: number, recent: string[] = []) => ({
    clientId: CLIENT(2),
    status: 'applied' as const,
    monitors,
    reached,
    recent,
  });

  it('a todos, a algunos, a ninguno', () => {
    expect(reminderResultText(r(7, 7))).toEqual({
      ok: true,
      text: 'Aviso enviado a los 7 monitores',
    });
    expect(reminderResultText(r(1, 1)).text).toBe('Aviso enviado a su monitor');
    expect(reminderResultText(r(7, 5)).text).toBe(
      'Aviso enviado a 5 de 7 monitores (el resto no tiene la app con avisos)',
    );
    expect(reminderResultText(r(3, 0))).toEqual({
      ok: false,
      text: 'Ninguno de esos monitores tiene la app con los avisos activados.',
    });
  });

  it('dice los grupos que se han saltado por recién avisados', () => {
    expect(reminderResultText(r(2, 2, ['a'])).text).toBe(
      'Aviso enviado a los 2 monitores. A 1 grupo ya se le avisó hace menos de 10 minutos.',
    );
    expect(reminderResultText(r(0, 0, ['a', 'b']))).toEqual({
      ok: false,
      text: 'A 2 grupos ya se les avisó hace menos de 10 minutos. Espera un poco.',
    });
  });
});

describe('el servidor falso', () => {
  const server = (patch = {}) =>
    createFakeServer({
      latencyMs: 0,
      clock: '2026-10-24T15:00:00Z',
      ...patch,
    });
  const code = (p: Promise<unknown>) =>
    p.then(
      () => 'ok',
      (e: ComunicaApiError) => e.code,
    );

  it('coordinación avisa a sus grupos; el mismo clientId no repite y a los 10 minutos deja otra vez', async () => {
    const s = server({ persona: 'coordination' });
    const mine = (await s.getCoordinationSummary()).mine.flatMap((x) =>
      x.rows.filter((row) => row.monitors.length > 0),
    );
    const ids = mine.slice(0, 2).map((row) => row.group.id);
    const body = { clientId: CLIENT(3), groupIds: ids, message: 'Pasa lista' };
    const out = await s.sendRollReminders(body);
    expect(out.recent).toEqual([]);
    expect(out.monitors).toBeGreaterThan(0);
    expect(await s.sendRollReminders(body)).toEqual(out);
    const again = await s.sendRollReminders({ ...body, clientId: CLIENT(4) });
    expect(again.recent).toEqual(ids);
    expect(again.monitors).toBe(0);
  });

  it('solo coordinación, solo grupos de su alcance y con el cuerpo en regla', async () => {
    const s = server({ persona: 'coordination' });
    const gid = (await s.getCoordinationSummary()).mine[0].rows[0].group.id;
    const body = {
      clientId: CLIENT(5),
      groupIds: [gid],
      message: 'Pasa lista',
    };
    expect(
      await code(s.sendRollReminders({ ...body, groupIds: ['no-existe'] })),
    ).toBe('forbidden');
    expect(await code(s.sendRollReminders({ ...body, message: ' ' }))).toBe(
      'validation',
    );
    s.setControls({ persona: 'monitor' });
    expect(await code(s.sendRollReminders(body))).toBe('forbidden');
    s.setControls({ persona: 'accompaniment' });
    expect(await code(s.sendRollReminders(body))).toBe('forbidden');
  });
});
