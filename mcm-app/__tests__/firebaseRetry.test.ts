import { withRetry } from '@/hooks/useFirebaseData';

// Los reintentos esperan de verdad (0,4 s y 1,2 s). Con timers falsos el test
// es instantáneo y además comprueba que la espera existe.
jest.useFakeTimers();

/** Ejecuta `promise` dejando correr todos los temporizadores pendientes. */
async function runAllTimers<T>(promise: Promise<T>): Promise<T> {
  const settled = promise.then(
    (value) => ({ ok: true as const, value }),
    (error) => ({ ok: false as const, error }),
  );
  // Varias vueltas: cada reintento programa su propio setTimeout.
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
    jest.runOnlyPendingTimers();
  }
  const result = await settled;
  if (!result.ok) throw result.error;
  return result.value;
}

describe('withRetry', () => {
  it('no reintenta si va bien a la primera', async () => {
    const run = jest.fn().mockResolvedValue(undefined);
    await runAllTimers(withRetry(run));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('reintenta y se queda con el primer intento que funcione', async () => {
    const run = jest
      .fn()
      .mockRejectedValueOnce(new Error('red intermitente'))
      .mockResolvedValue(undefined);
    await runAllTimers(withRetry(run));
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('aguanta dos fallos seguidos', async () => {
    const run = jest
      .fn()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockResolvedValue(undefined);
    await runAllTimers(withRetry(run));
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('se rinde tras tres intentos y propaga el error', async () => {
    // Rendirse importa: si no, un nodo caído dejaría promesas colgadas para
    // siempre y `inflight` nunca se limpiaría.
    const run = jest.fn().mockRejectedValue(new Error('sin red'));
    await expect(runAllTimers(withRetry(run))).rejects.toThrow('sin red');
    expect(run).toHaveBeenCalledTimes(3);
  });
});
