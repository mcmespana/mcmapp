/**
 * Tests de la costura de escrituras (`services/firebaseWrites.ts`).
 *
 * Contexto (plan `plans/014-firebase-writes-service-seam.md`): las escrituras de
 * UI estaban repartidas por ~10 archivos repitiendo el ritual completo, y
 * ninguna se beneficiaba del `withRetry` que sí tiene `useFirebaseData` — un
 * reporte de bug enviado con el wifi flojo se perdía con un toast y sin
 * reintento.
 *
 * El test que de verdad importa es el de **idempotencia**: reintentar un
 * `push` + `set` sería incorrecto si la key se regenerara en cada intento
 * (duplicaría la entrada). `pushWithRetry` genera la key una vez y reintenta
 * solo el `set`.
 */
import { push, set } from 'firebase/database';
import { pushWithRetry, setWithRetry } from '@/services/firebaseWrites';

// El backoff de `withRetry` son esperas reales de 0,4 s y 1,2 s. Con timers
// falsos el test no las paga; `advanceTimersByTimeAsync` deja además correr las
// microtareas entre intentos.
let keyCounter = 0;

beforeEach(() => {
  // `mockReset` y no `clearAllMocks`: este último NO borra las
  // implementaciones, así que un `mockRejectedValue` de un test se filtraba a
  // los siguientes.
  (set as jest.Mock).mockReset();
  (set as jest.Mock).mockResolvedValue(undefined);
  (push as jest.Mock).mockReset();
  (push as jest.Mock).mockImplementation(() => ({
    key: `mock-key-${++keyCounter}`,
  }));
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

/** Deja avanzar los dos backoffs de `withRetry` (0,4 s + 1,2 s). */
const runOutBackoff = async () => {
  await jest.advanceTimersByTimeAsync(400);
  await jest.advanceTimersByTimeAsync(1200);
};

describe('pushWithRetry', () => {
  it('a la primera: un push, un set, y devuelve la key', async () => {
    const promise = pushWithRetry('app/feedback/bug', { text: 'hola' });
    await runOutBackoff();

    await expect(promise).resolves.toMatch(/^mock-key-/);
    expect(push).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledTimes(1);
  });

  it('si el set falla y luego funciona, la key NO se regenera', async () => {
    // El centinela de idempotencia: un push, dos sets sobre la MISMA key.
    (set as jest.Mock)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined);

    const promise = pushWithRetry('app/feedback/bug', { text: 'hola' });
    await runOutBackoff();
    await expect(promise).resolves.toMatch(/^mock-key-/);

    expect(push).toHaveBeenCalledTimes(1); // ← una sola key
    expect(set).toHaveBeenCalledTimes(2);
    // Los dos intentos escriben sobre la misma referencia y el mismo valor.
    const [refA, valA] = (set as jest.Mock).mock.calls[0];
    const [refB, valB] = (set as jest.Mock).mock.calls[1];
    expect(refA).toBe(refB);
    expect(valA).toEqual(valB);
  });

  it('si falla siempre, relanza tras agotar los reintentos', async () => {
    (set as jest.Mock).mockRejectedValue(new Error('sin red'));

    const promise = pushWithRetry('app/feedback/bug', { text: 'hola' });
    const assertion = expect(promise).rejects.toThrow('sin red');
    await runOutBackoff();
    await assertion;

    expect(push).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledTimes(3); // intento + 2 reintentos
  });

  it('las claves undefined no llegan a RTDB', async () => {
    const promise = pushWithRetry('app/feedback/bug', {
      text: 'hola',
      nota: undefined,
      anidado: { a: 1, b: undefined },
    });
    await runOutBackoff();
    await promise;

    const written = (set as jest.Mock).mock.calls[0][1];
    expect(written).not.toHaveProperty('nota');
    expect(written.anidado).not.toHaveProperty('b');
    expect(written.text).toBe('hola');
    expect(written.anidado.a).toBe(1);
  });
});

describe('setWithRetry', () => {
  it('escribe una vez en el camino feliz', async () => {
    const promise = setWithRetry('app/config/algo', { valor: 1 });
    await runOutBackoff();
    await promise;

    expect(set).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it('reintenta y acaba escribiendo', async () => {
    (set as jest.Mock)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(undefined);

    const promise = setWithRetry('app/config/algo', { valor: 1 });
    await runOutBackoff();
    await promise;

    expect(set).toHaveBeenCalledTimes(2);
  });

  it('relanza si no hay manera', async () => {
    (set as jest.Mock).mockRejectedValue(new Error('sin red'));

    const promise = setWithRetry('app/config/algo', { valor: 1 });
    const assertion = expect(promise).rejects.toThrow('sin red');
    await runOutBackoff();
    await assertion;
  });
});
