import {
  buildSongHistory,
  describeSongHistory,
  mergeSungEntries,
  schoolYearStart,
  sungLogKey,
} from '@/utils/choirHistory';

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 16, 12).getTime(); // 16 nov 2026

describe('choirHistory', () => {
  it('el curso empieza el 1 de septiembre', () => {
    expect(new Date(schoolYearStart(NOW)).getMonth()).toBe(8);
    expect(new Date(schoolYearStart(NOW)).getFullYear()).toBe(2026);
    const march = new Date(2027, 2, 3).getTime();
    expect(new Date(schoolYearStart(march)).getFullYear()).toBe(2026);
  });

  it('cuenta las veces del curso y marca las semanas recientes', () => {
    const h = buildSongHistory(
      [
        { at: NOW - 1 * DAY, code: '1', songs: ['a.cho', 'b.cho'] },
        { at: NOW - 15 * DAY, code: '2', songs: ['a.cho'] },
        { at: new Date(2026, 5, 1).getTime(), code: '3', songs: ['a.cho'] },
      ],
      NOW,
    );
    const a = h.get('a.cho')!;
    expect(a.course).toBe(2);
    expect(a.weeks[7]).toBe(true);
    expect(a.weeks[5]).toBe(true);
    expect(a.weeks.filter(Boolean)).toHaveLength(2);
    expect(h.get('b.cho')!.course).toBe(1);
  });

  it('dos playlists el mismo día cuentan una vez', () => {
    const h = buildSongHistory(
      [
        { at: NOW - 3 * DAY, code: '1', songs: ['a.cho'] },
        { at: NOW - 3 * DAY + 1000, code: '2', songs: ['a.cho'] },
      ],
      NOW,
    );
    expect(h.get('a.cho')!.course).toBe(1);
  });

  it('las playlists antiguas solo cuentan si no tienen apunte', () => {
    const merged = mergeSungEntries(
      [{ at: NOW, code: '1', songs: ['a.cho'] }],
      [
        { at: NOW - DAY, code: '1', songs: ['viejo.cho'] },
        { at: NOW - 2 * DAY, code: '2', songs: ['b.cho'] },
      ],
    );
    expect(merged.map((e) => e.code)).toEqual(['2', '1']);
    expect(merged[1].songs).toEqual(['a.cho']);
  });

  it('la clave del apunte es día + código', () => {
    expect(sungLogKey(new Date(2026, 10, 2).getTime(), '1234')).toBe(
      '20261102-1234',
    );
  });

  it('se describe para el lector de pantalla', () => {
    expect(describeSongHistory(undefined, NOW)).toBe('Sin cantar este curso');
    expect(
      describeSongHistory(
        { course: 3, weeks: [], lastAt: NOW - 15 * DAY },
        NOW,
      ),
    ).toBe('3 veces este curso, la última hace 2 semanas');
  });
});
