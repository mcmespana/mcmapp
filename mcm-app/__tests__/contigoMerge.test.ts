/**
 * Tests del helper puro de fusión de hábitos de CONTIGO
 * (utils/contigoMerge.ts) — extraído del Plan 004 (hidratación de hábitos
 * al iniciar sesión en un dispositivo nuevo).
 */
import { mergeContigoHabits } from '@/utils/contigoMerge';
import type { DayRecord } from '@/hooks/useContigoHabits';

const record = (
  date: string,
  overrides: Partial<DayRecord> = {},
): DayRecord => ({
  date,
  readingDone: false,
  prayerDone: false,
  timestamp: 1,
  ...overrides,
});

describe('mergeContigoHabits', () => {
  it('local vacío + remoto con 3 fechas → expone las 3, sin re-subir nada', () => {
    const remote = {
      '2026-07-16': record('2026-07-16', { readingDone: true }),
      '2026-07-17': record('2026-07-17', {
        readingDone: true,
        prayerDone: true,
      }),
      '2026-07-18': record('2026-07-18', { revisionDone: true }),
    };

    const { merged, datesToResync } = mergeContigoHabits({}, remote);

    expect(Object.keys(merged).sort()).toEqual([
      '2026-07-16',
      '2026-07-17',
      '2026-07-18',
    ]);
    expect(merged).toEqual(remote);
    expect(datesToResync).toEqual([]);
  });

  it('remoto vacío + local con datos → conserva local y marca para re-subir', () => {
    const local = { '2026-07-18': record('2026-07-18', { readingDone: true }) };
    const { merged, datesToResync } = mergeContigoHabits(local, {});
    expect(merged).toEqual(local);
    expect(datesToResync).toEqual(['2026-07-18']);
  });

  it('gana el registro con más hábitos marcados, sin importar el origen', () => {
    const local = {
      '2026-07-18': record('2026-07-18', { readingDone: true }),
    };
    const remote = {
      '2026-07-18': record('2026-07-18', {
        readingDone: true,
        prayerDone: true,
        revisionDone: true,
      }),
    };
    const { merged, datesToResync } = mergeContigoHabits(local, remote);
    expect(merged['2026-07-18']).toEqual(remote['2026-07-18']);
    expect(datesToResync).toEqual([]);
  });

  it('a igualdad de marcados, gana el local y no se re-sube (ya está en sync)', () => {
    const local = {
      '2026-07-18': record('2026-07-18', { readingDone: true, timestamp: 999 }),
    };
    const remote = {
      '2026-07-18': record('2026-07-18', { readingDone: true, timestamp: 1 }),
    };
    const { merged, datesToResync } = mergeContigoHabits(local, remote);
    expect(merged['2026-07-18']).toEqual(local['2026-07-18']);
    expect(datesToResync).toEqual([]);
  });

  it('un remoto desactualizado nunca "desmarca" progreso local reciente', () => {
    const local = {
      '2026-07-18': record('2026-07-18', {
        readingDone: true,
        prayerDone: true,
      }),
    };
    const remote = {
      '2026-07-18': record('2026-07-18', { readingDone: true }),
    };
    const { merged, datesToResync } = mergeContigoHabits(local, remote);
    expect(merged['2026-07-18'].prayerDone).toBe(true);
    expect(datesToResync).toEqual(['2026-07-18']);
  });
});
