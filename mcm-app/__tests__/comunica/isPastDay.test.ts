import { isPastDay } from '@/utils/comunica/dates';

describe('isPastDay', () => {
  it('ayer ya es pasado; hoy y mañana, no', () => {
    expect(isPastDay('2026-11-04', '2026-11-05')).toBe(true);
    expect(isPastDay('2026-11-05', '2026-11-05')).toBe(false);
    expect(isPastDay('2026-11-06', '2026-11-05')).toBe(false);
  });
  it('cruza mes y año', () => {
    expect(isPastDay('2026-10-31', '2026-11-01')).toBe(true);
    expect(isPastDay('2025-12-31', '2026-01-01')).toBe(true);
  });
});
