/**
 * Tests de `utils/storageMutex.ts` — mutex por clave para ciclos
 * read-modify-write de AsyncStorage (Plan 006).
 */
import { withStorageLock } from '@/utils/storageMutex';

describe('withStorageLock', () => {
  it('serializa dos llamadas sobre la MISMA clave: la 2ª empieza tras acabar la 1ª', async () => {
    const events: string[] = [];

    const slow = withStorageLock('k', async () => {
      events.push('1-start');
      await new Promise((r) => setTimeout(r, 20));
      events.push('1-end');
    });
    const fast = withStorageLock('k', async () => {
      events.push('2-start');
      events.push('2-end');
    });

    await Promise.all([slow, fast]);

    expect(events).toEqual(['1-start', '1-end', '2-start', '2-end']);
  });

  it('claves distintas NO se bloquean entre sí', async () => {
    const events: string[] = [];

    const a = withStorageLock('a', async () => {
      events.push('a-start');
      await new Promise((r) => setTimeout(r, 20));
      events.push('a-end');
    });
    const b = withStorageLock('b', async () => {
      events.push('b-start');
      events.push('b-end');
    });

    await Promise.all([a, b]);

    // 'b' no espera a que termine 'a': su ciclo entero cabe antes de 'a-end'.
    expect(events.indexOf('b-end')).toBeLessThan(events.indexOf('a-end'));
  });

  it('un fn que rechaza no bloquea la siguiente sobre la misma clave; el rechazo llega a SU caller', async () => {
    const first = withStorageLock('k2', async () => {
      throw new Error('boom');
    });
    const second = withStorageLock('k2', async () => 'ok');

    await expect(first).rejects.toThrow('boom');
    await expect(second).resolves.toBe('ok');
  });
});
