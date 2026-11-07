import {
  addDays,
  daysBetween,
  madridDay,
  madridInstant,
  madridOffsetHours,
  madridTime,
  weekday,
} from '@/utils/comunica/madrid';

describe('utils/comunica/madrid', () => {
  it('sabe cuándo es horario de verano', () => {
    expect(madridOffsetHours(new Date('2026-07-01T12:00:00Z'))).toBe(2);
    expect(madridOffsetHours(new Date('2026-12-01T12:00:00Z'))).toBe(1);
    // 2026: el cambio de octubre es el domingo 25 a las 01:00 UTC.
    expect(madridOffsetHours(new Date('2026-10-25T00:59:00Z'))).toBe(2);
    expect(madridOffsetHours(new Date('2026-10-25T01:00:00Z'))).toBe(1);
    // 2027: el de marzo, el domingo 28.
    expect(madridOffsetHours(new Date('2027-03-28T00:59:00Z'))).toBe(1);
    expect(madridOffsetHours(new Date('2027-03-28T01:00:00Z'))).toBe(2);
  });

  it('da el día de Madrid aunque en UTC sea otro', () => {
    expect(madridDay(new Date('2026-10-23T22:30:00Z'))).toBe('2026-10-24');
    expect(madridDay(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
  });

  it('escribe instantes con su zona', () => {
    expect(madridInstant('2026-10-24', '16:30')).toBe(
      '2026-10-24T16:30:00+02:00',
    );
    expect(madridInstant('2026-11-07', '16:30')).toBe(
      '2026-11-07T16:30:00+01:00',
    );
    expect(madridTime('2026-11-07T16:30:00+01:00')).toBe('16:30');
    expect(madridTime('2026-10-24T14:30:00Z')).toBe('16:30');
  });

  it('hace aritmética de calendario', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
    expect(daysBetween('2026-10-17', '2026-10-24')).toBe(7);
    expect(daysBetween('2026-10-24', '2026-10-17')).toBe(-7);
    expect(weekday('2026-10-24')).toBe(6);
  });
});
