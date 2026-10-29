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
import { setReporter } from '@/utils/logger';

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

  it('sin red no es un fallo: sigue pendiente, sin gastar intentos, y sube al volver', async () => {
    const offline = new ComunicaApiError('network', 'sin red');
    const handler = jest.fn().mockRejectedValue(offline);
    const { box, scheduled } = setup(handler);
    await box.enqueue({ key: 'k', kind: 'roll', payload: {}, clientId: 'c' });
    await box.flush();
    for (let i = 0; i < MAX_ATTEMPTS + 2; i++) await box.wake();
    expect(box.get('k')).toMatchObject({ status: 'pending', attempts: 0 });
    expect(box.get('k')?.error).toBeUndefined();
    expect(scheduled.length).toBeGreaterThan(0);
    // Vuelve la red: `wake` la sube ya, sin esperar al reintento programado.
    handler.mockResolvedValueOnce({});
    await box.wake();
    expect(box.get('k')?.status).toBe('applied');
  });

  it('un 401 no cuenta para el límite de 5', async () => {
    const handler = jest
      .fn()
      .mockRejectedValue(new ComunicaApiError('unauthenticated', 'no', 401));
    const { box } = setup(handler);
    await box.enqueue({ key: 'k', kind: 'roll', payload: {}, clientId: 'c' });
    for (let i = 0; i < MAX_ATTEMPTS + 2; i++) await box.wake();
    expect(handler.mock.calls.length).toBeGreaterThan(MAX_ATTEMPTS);
    expect(box.get('k')).toMatchObject({ status: 'pending', attempts: 0 });
  });

  it('un fallo de la app no se toma por red: failed sin reintento', async () => {
    const errors: unknown[][] = [];
    setReporter({ error: (...a) => errors.push(a) });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const handler = jest
      .fn()
      .mockRejectedValue(new TypeError('x is undefined'));
    const { box, advance, scheduled } = setup(handler);
    await box.enqueue({ key: 'k', kind: 'roll', payload: {}, clientId: 'c' });
    await box.flush();
    advance(60 * 60_000);
    await box.wake();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(scheduled).toHaveLength(0);
    expect(box.get('k')).toMatchObject({
      status: 'failed',
      error: { code: 'internal', auto: false },
    });
    expect(errors.length).toBeGreaterThan(0);
    setReporter(null);
    jest.restoreAllMocks();
  });

  it('un rechazo definitivo no se reenvía al volver a abrir la app', async () => {
    const handler = jest
      .fn()
      .mockRejectedValue(new ComunicaApiError('forbidden', 'no', 403));
    const { box } = setup(handler);
    await box.enqueue({ key: 'k', kind: 'roll', payload: {}, clientId: 'c' });
    await box.flush();
    expect(handler).toHaveBeenCalledTimes(1);
    // Al cerrar y abrir, lo guardado pasa por JSON (Infinity → null).
    const again = createOutbox({ personId: 'p1', handlers: { roll: handler } });
    await again.load();
    await again.flush();
    await again.wake();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(again.get('k')?.status).toBe('failed');
  });

  it('si el móvil no deja guardar, la entrada no se queda «subiendo»', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const be = memoryBackend();
    setStorageBackend({
      ...be,
      setItem: () => Promise.reject(new Error('disco lleno')),
    });
    const handler = jest.fn().mockResolvedValue({});
    const { box } = setup(handler);
    await box.enqueue({ key: 'k', kind: 'roll', payload: {}, clientId: 'c' });
    await box.flush();
    expect(box.get('k')?.status).toBe('applied');
    jest.restoreAllMocks();
  });
});

describe('la cola al salir (dispose)', () => {
  beforeEach(() => setStorageBackend(memoryBackend()));

  it('un reintento programado tras salir no sube ni resucita el cajón', async () => {
    const be = memoryBackend();
    setStorageBackend(be);
    const handler = jest
      .fn()
      .mockRejectedValueOnce(crmDown())
      .mockResolvedValue({});
    const scheduled: (() => void)[] = [];
    const cancelled: number[] = [];
    let t = 1000;
    const box = createOutbox({
      personId: 'A',
      handlers: { roll: handler },
      now: () => t,
      schedule: (fn) => {
        scheduled.push(fn);
        return () => cancelled.push(scheduled.length);
      },
    });
    await box.enqueue({ key: 'k', kind: 'roll', payload: {}, clientId: 'c' });
    await box.flush();
    expect(scheduled).toHaveLength(1);
    // Salir: se apaga ANTES de borrar.
    box.dispose();
    await clearAll();
    expect(cancelled).toHaveLength(1);
    // Aunque el temporizador saltara igualmente:
    t += 10_000;
    scheduled[0]();
    await box.flush();
    await box.wake();
    await box.enqueue({ key: 'k2', kind: 'roll', payload: {}, clientId: 'd' });
    await new Promise((r) => setTimeout(r, 5));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(be.dump()).toEqual({});
  });

  it('lo que contesta una subida en vuelo tras salir no se escribe ni se anuncia', async () => {
    const be = memoryBackend();
    setStorageBackend(be);
    let release: (v: unknown) => void = () => {};
    const handler = jest.fn(() => new Promise((r) => (release = r)));
    const onApplied = jest.fn();
    const box = createOutbox({
      personId: 'A',
      handlers: { roll: handler },
      onApplied,
    });
    await box.enqueue({ key: 'k', kind: 'roll', payload: {}, clientId: 'c' });
    await new Promise((r) => setTimeout(r, 0));
    expect(handler).toHaveBeenCalledTimes(1);
    box.dispose();
    await clearAll();
    release({ ok: true });
    await new Promise((r) => setTimeout(r, 5));
    expect(onApplied).not.toHaveBeenCalled();
    expect(be.dump()).toEqual({});
    expect(box.disposed).toBe(true);
  });
});
