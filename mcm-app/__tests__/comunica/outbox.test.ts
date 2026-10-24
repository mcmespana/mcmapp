import {
  createOutbox,
  MAX_ATTEMPTS,
  backoffMs,
} from '@/services/comunica/outbox';
import { ComunicaApiError } from '@/services/comunica/client';
import {
  clearAll,
  memoryBackend,
  readDrawer,
  setStorageBackend,
} from '@/services/comunica/storage';

const crmDown = () => new ComunicaApiError('crm_unavailable', 'caído', 503);

function setup(handler: jest.Mock) {
  let t = 1_000_000;
  const scheduled: (() => void)[] = [];
  const applied: string[] = [];
  const box = createOutbox({
    personId: 'p1',
    handlers: { roll: handler },
    now: () => t,
    schedule: (fn) => scheduled.push(fn),
    onApplied: (e) => applied.push(e.clientId),
  });
  return { box, advance: (ms: number) => (t += ms), scheduled, applied };
}

describe('cola de escrituras', () => {
  beforeEach(() => setStorageBackend(memoryBackend()));

  it('gana la última por clave y sube sola', async () => {
    const handler = jest.fn().mockResolvedValue({ ok: true });
    const { box, applied } = setup(handler);
    await box.enqueue({
      key: 'roll:s:g',
      kind: 'roll',
      payload: 1,
      clientId: 'a',
    });
    await box.enqueue({
      key: 'roll:s:g',
      kind: 'roll',
      payload: 2,
      clientId: 'b',
    });
    await box.flush();
    expect(box.entries().filter((e) => e.key === 'roll:s:g')).toHaveLength(1);
    expect(applied).toContain('b');
    expect(box.get('roll:s:g')?.status).toBe('applied');
  });

  it('reintenta con el MISMO clientId y se atasca a los 5', async () => {
    const handler = jest.fn().mockRejectedValue(crmDown());
    const { box, advance } = setup(handler);
    await box.enqueue({ key: 'k', kind: 'roll', payload: {}, clientId: 'c1' });
    await box.flush();
    expect(box.get('k')?.status).toBe('failed');
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      advance(backoffMs(i));
      await box.flush();
    }
    expect(box.get('k')?.status).toBe('stuck');
    expect(new Set(handler.mock.calls.map((c) => c[0].clientId))).toEqual(
      new Set(['c1']),
    );
    // Atascada no sube sola…
    advance(60 * 60_000);
    await box.flush();
    expect(handler).toHaveBeenCalledTimes(MAX_ATTEMPTS);
    // …pero «Reintentar» a mano sí.
    handler.mockResolvedValueOnce({});
    await box.retry('k');
    expect(box.get('k')?.status).toBe('applied');
  });

  it('validation no se reintenta: failed con el motivo', async () => {
    const handler = jest
      .fn()
      .mockRejectedValue(
        new ComunicaApiError('validation', 'futuro', 422, 'session_in_future'),
      );
    const { box, advance } = setup(handler);
    await box.enqueue({ key: 'k', kind: 'roll', payload: {}, clientId: 'c' });
    await box.flush();
    advance(60 * 60_000);
    await box.flush();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(box.get('k')).toMatchObject({
      status: 'failed',
      error: { code: 'validation', reason: 'session_in_future', auto: false },
    });
  });

  it('se guarda en el móvil, se recupera al abrir y se borra al salir', async () => {
    const handler = jest.fn().mockRejectedValue(crmDown());
    const { box } = setup(handler);
    await box.enqueue({
      key: 'k',
      kind: 'roll',
      payload: { x: 1 },
      clientId: 'c',
      meta: { label: 'C1' },
    });
    await box.flush();
    const again = createOutbox({ personId: 'p1', handlers: {} });
    await again.load();
    expect(again.get('k')).toMatchObject({
      payload: { x: 1 },
      meta: { label: 'C1' },
    });
    // Otra persona no lo ve.
    const other = createOutbox({ personId: 'p2', handlers: {} });
    await other.load();
    expect(other.entries()).toHaveLength(0);
    await clearAll();
    expect(await readDrawer('p1', 'outbox')).toBeNull();
  });

  it('descartar la quita', async () => {
    const handler = jest
      .fn()
      .mockRejectedValue(new ComunicaApiError('forbidden', 'no', 403));
    const { box } = setup(handler);
    await box.enqueue({ key: 'k', kind: 'roll', payload: {}, clientId: 'c' });
    await box.flush();
    await box.discard('k');
    expect(box.entries()).toHaveLength(0);
  });
});
