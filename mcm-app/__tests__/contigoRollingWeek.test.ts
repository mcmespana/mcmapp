import { getRollingDays, weekdayLetter } from '@/components/contigo/theme';

describe('getRollingDays', () => {
  it('devuelve 7 días terminando HOY (no de lunes a domingo)', () => {
    // 2026-08-07 es viernes.
    expect(getRollingDays('2026-08-07', 7)).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
    ]);
  });

  it('cruza el cambio de mes sin saltarse días', () => {
    expect(getRollingDays('2026-03-02', 4)).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ]);
  });

  it('el último elemento es siempre el día dado', () => {
    const days = getRollingDays('2026-01-01');
    expect(days).toHaveLength(7);
    expect(days[days.length - 1]).toBe('2026-01-01');
    expect(days[0]).toBe('2025-12-26');
  });
});

describe('weekdayLetter', () => {
  it('usa la semana española empezando en lunes', () => {
    expect(weekdayLetter('2026-08-03')).toBe('L'); // lunes
    expect(weekdayLetter('2026-08-07')).toBe('V'); // viernes
    expect(weekdayLetter('2026-08-09')).toBe('D'); // domingo
  });
});
