import {
  defaultRecapYear,
  firstSundayOfAdvent,
  recapSeason,
} from '@/utils/contigoRecapSeason';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
const ymd = (x: Date) => [x.getFullYear(), x.getMonth() + 1, x.getDate()];

describe('temporada de «Tu año»', () => {
  it('primer domingo de Adviento', () => {
    expect(ymd(firstSundayOfAdvent(2026))).toEqual([2026, 11, 29]);
    expect(ymd(firstSundayOfAdvent(2027))).toEqual([2027, 11, 28]);
    // Navidad en domingo (2022): Adviento empieza el 27 de noviembre.
    expect(ymd(firstSundayOfAdvent(2022))).toEqual([2022, 11, 27]);
  });

  it('la semana de antes y las dos primeras de Adviento', () => {
    expect(recapSeason(d(2026, 11, 21))).toBeNull();
    expect(recapSeason(d(2026, 11, 22))?.id).toBe('adviento-2026');
    expect(recapSeason(d(2026, 12, 12))?.id).toBe('adviento-2026');
    expect(recapSeason(d(2026, 12, 13))).toBeNull();
  });

  it('la última de Adviento hasta el 21 de enero', () => {
    expect(recapSeason(d(2026, 12, 19))).toBeNull();
    expect(recapSeason(d(2026, 12, 20))).toEqual({
      id: 'navidad-2026',
      year: 2026,
    });
    expect(recapSeason(d(2027, 1, 21))).toEqual({
      id: 'navidad-2026',
      year: 2026,
    });
    expect(recapSeason(d(2027, 1, 22))).toBeNull();
  });

  it('en enero se resume el año que acaba de terminar', () => {
    expect(defaultRecapYear(d(2027, 1, 5))).toBe(2026);
    expect(defaultRecapYear(d(2027, 6, 5))).toBe(2027);
  });
});
