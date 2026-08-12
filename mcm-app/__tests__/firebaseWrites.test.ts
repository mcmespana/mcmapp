/**
 * Tests de `services/firebaseWrites.ts` (Plan 014): las primitivas comunes
 * que dan reintento (`withRetry`) a las escrituras de UI, sin lógica de
 * dominio. El caso 2 fija el contrato de idempotencia: `push()` genera la
 * key UNA sola vez, aunque `set()` se reintente varias.
 */
import { push, set } from 'firebase/database';
import { pushWithRetry, setWithRetry } from '@/services/firebaseWrites';

jest.useFakeTimers();

/** Ejecuta `promise` dejando correr todos los temporizadores pendientes
 *  (mismo patrón que `__tests__/firebaseRetry.test.ts`). */
async function runAllTimers<T>(promise: Promise<T>): Promise<T> {
  const settled = promise.then(
    (value) => ({ ok: true as const, value }),
    (error) => ({ ok: false as const, error }),
  );
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
    jest.runOnlyPendingTimers();
  }
  const result = await settled;
  if (!result.ok) throw result.error;
  return result.value;
}

beforeEach(() => {
  jest.clearAllMocks();
  (set as jest.Mock).mockResolvedValue(undefined);
});

describe('pushWithRetry', () => {
  it('éxito: un solo push, un solo set, devuelve la key', async () => {
    const key = await runAllTimers(
      pushWithRetry('app/feedback/bug', { text: 'hola' }),
    );

    expect(push).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledTimes(1);
    expect(key).toEqual(expect.any(String));
  });

  it('set falla una vez y luego funciona: push se llama UNA vez, set dos (no regenera key)', async () => {
    (set as jest.Mock).mockRejectedValueOnce(new Error('red intermitente'));

    await runAllTimers(pushWithRetry('app/feedback/bug', { text: 'hola' }));

    expect(push).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledTimes(2);
    // Ambas llamadas a set() deben apuntar a la MISMA ref (mismo objeto
    // devuelto por push()), no una ref nueva por intento.
    const [refA] = (set as jest.Mock).mock.calls[0];
    const [refB] = (set as jest.Mock).mock.calls[1];
    expect(refA).toBe(refB);
  });

  it('fallo definitivo: relanza tras agotar reintentos', async () => {
    (set as jest.Mock).mockRejectedValue(new Error('sin red'));

    await expect(
      runAllTimers(pushWithRetry('app/feedback/bug', { text: 'hola' })),
    ).rejects.toThrow('sin red');
  });

  it('undefined en el payload no llega al set()', async () => {
    await runAllTimers(
      pushWithRetry('app/feedback/bug', { text: 'hola', extra: undefined }),
    );

    const written = (set as jest.Mock).mock.calls[0][1];
    expect(written).not.toHaveProperty('extra');
    expect(written.text).toBe('hola');
  });
});

describe('setWithRetry', () => {
  it('éxito: un solo set, sin push', async () => {
    await runAllTimers(setWithRetry('app/config', { enabled: true }));

    expect(push).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledTimes(1);
  });

  it('reintenta hasta funcionar', async () => {
    (set as jest.Mock).mockRejectedValueOnce(new Error('boom'));

    await runAllTimers(setWithRetry('app/config', { enabled: true }));

    expect(set).toHaveBeenCalledTimes(2);
  });
});
