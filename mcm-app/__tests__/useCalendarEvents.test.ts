/**
 * Tests de `hooks/useCalendarEvents.ts`: aritmética de expansión multi-día
 * (Plan 003) y parseo del ICS (fechas/horas, incluida la normalización de
 * UTC → local cuando el feed emite `Z`).
 */
import { addDaysISO, parseICS } from '@/hooks/useCalendarEvents';

describe('addDaysISO', () => {
  it('suma días dentro del mismo mes', () => {
    expect(addDaysISO('2026-07-01', 1)).toBe('2026-07-02');
  });

  it('cruza fin de mes', () => {
    expect(addDaysISO('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('cruza fin de año', () => {
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('resta días (usado para el ajuste de DTEND exclusivo)', () => {
    expect(addDaysISO('2026-04-17', -1)).toBe('2026-04-16');
  });
});

describe('expansión de rango multi-día (aritmética de calendario pura)', () => {
  function expandRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    for (let cur = startDate; cur <= endDate; cur = addDaysISO(cur, 1)) {
      dates.push(cur);
    }
    return dates;
  }

  it('rango normal sin DST: 3 días exactos', () => {
    expect(expandRange('2026-07-01', '2026-07-03')).toEqual([
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
    ]);
  });

  it('cambio de hora de primavera (28 mar → 2 abr): sin duplicados ni huecos', () => {
    expect(expandRange('2026-03-28', '2026-04-02')).toEqual([
      '2026-03-28',
      '2026-03-29',
      '2026-03-30',
      '2026-03-31',
      '2026-04-01',
      '2026-04-02',
    ]);
  });

  it('cambio de hora de otoño (24 oct → 27 oct): sin duplicados ni huecos', () => {
    expect(expandRange('2026-10-24', '2026-10-27')).toEqual([
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
    ]);
  });
});

describe('parseICS', () => {
  it('evento de un día (VALUE=DATE) sin endDate → isSingleDay', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Evento suelto',
      'DTSTART;VALUE=DATE:20260417',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    const [ev] = parseICS(ics);
    expect(ev.startDate).toBe('2026-04-17');
    expect(ev.isAllDay).toBe(true);
    expect(ev.isSingleDay).toBe(true);
    expect(ev.endDate).toBeUndefined();
  });

  it('evento de día completo multi-día: DTEND exclusivo se ajusta un día atrás', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Retiro',
      'DTSTART;VALUE=DATE:20260328',
      'DTEND;VALUE=DATE:20260402',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    const [ev] = parseICS(ics);
    expect(ev.startDate).toBe('2026-03-28');
    expect(ev.endDate).toBe('2026-04-01');
    expect(ev.isSingleDay).toBe(false);
  });

  it('DTSTART con hora en UTC (Z) se normaliza a fecha/hora local', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Con hora UTC',
      'DTSTART:20260315T220000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    const [ev] = parseICS(ics);
    // 22:00 UTC del 15 de marzo → hora local (getters locales del entorno de test)
    const expectedLocal = new Date(Date.UTC(2026, 2, 15, 22, 0));
    const expectedDate = `${expectedLocal.getFullYear()}-${String(expectedLocal.getMonth() + 1).padStart(2, '0')}-${String(expectedLocal.getDate()).padStart(2, '0')}`;
    const expectedTime = `${String(expectedLocal.getHours()).padStart(2, '0')}:${String(expectedLocal.getMinutes()).padStart(2, '0')}`;
    expect(ev.startDate).toBe(expectedDate);
    expect(ev.startTime).toBe(expectedTime);
    expect(ev.isAllDay).toBeFalsy();
  });

  it('DTSTART flotante (sin Z, sin TZID) no se convierte', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Hora flotante',
      'DTSTART:20260315T220000',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    const [ev] = parseICS(ics);
    expect(ev.startDate).toBe('2026-03-15');
    expect(ev.startTime).toBe('22:00');
  });
});
