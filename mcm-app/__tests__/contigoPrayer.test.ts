import type { DayRecord } from '@/contexts/ContigoHabitsContext';
import {
  lastPrayerMinutes,
  prayerCalendarCellSize,
  prayerDurationEnum,
  stepPrayerMinutes,
} from '@/utils/contigoPrayer';

const rec = (date: string, extra: Partial<DayRecord> = {}): DayRecord => ({
  date,
  readingDone: false,
  prayerDone: true,
  timestamp: 0,
  ...extra,
});

describe('stepPrayerMinutes', () => {
  it('sube de cinco en cinco', () => {
    expect(stepPrayerMinutes(15, 1)).toBe(20);
    expect(stepPrayerMinutes(20, 1)).toBe(25);
  });

  it('baja de cinco en cinco', () => {
    expect(stepPrayerMinutes(20, -1)).toBe(15);
    expect(stepPrayerMinutes(10, -1)).toBe(5);
  });

  it('desde un valor suelto salta al múltiplo más cercano', () => {
    expect(stepPrayerMinutes(13, 1)).toBe(15);
    expect(stepPrayerMinutes(13, -1)).toBe(10);
    expect(stepPrayerMinutes(1, 1)).toBe(5);
    expect(stepPrayerMinutes(16, 1)).toBe(20);
  });

  it('no baja de un minuto ni sube de 120, y lo dice devolviendo el mismo', () => {
    expect(stepPrayerMinutes(5, -1)).toBe(1);
    expect(stepPrayerMinutes(1, -1)).toBe(1);
    expect(stepPrayerMinutes(115, 1)).toBe(120);
    expect(stepPrayerMinutes(120, 1)).toBe(120);
  });

  it('con pulsación mantenida llega a 120 sin pasarse', () => {
    let v = 15;
    for (let i = 0; i < 50; i++) v = stepPrayerMinutes(v, 1);
    expect(v).toBe(120);
  });
});

describe('lastPrayerMinutes', () => {
  it('es null sin ninguna oración con minutos', () => {
    expect(lastPrayerMinutes({})).toBeNull();
    expect(lastPrayerMinutes({ '2026-10-01': rec('2026-10-01') })).toBeNull();
  });

  it('coge los minutos del día más reciente, no del último insertado', () => {
    expect(
      lastPrayerMinutes({
        '2026-10-10': rec('2026-10-10', { prayerDurationMinutes: 20 }),
        '2026-10-02': rec('2026-10-02', { prayerDurationMinutes: 8 }),
        '2026-10-05': rec('2026-10-05', { prayerDurationMinutes: 13 }),
      }),
    ).toBe(20);
  });

  it('ignora los días sin oración hecha', () => {
    expect(
      lastPrayerMinutes({
        '2026-10-10': rec('2026-10-10', {
          prayerDone: false,
          prayerDurationMinutes: 30,
        }),
        '2026-10-02': rec('2026-10-02', { prayerDurationMinutes: 8 }),
      }),
    ).toBe(8);
  });
});

describe('prayerDurationEnum', () => {
  it('«< 2 min» ya no se guarda como 2_to_4', () => {
    expect(prayerDurationEnum(1)).toBe('less_than_1');
  });

  it('cada pastilla cae en su tramo', () => {
    expect(prayerDurationEnum(3)).toBe('2_to_4');
    expect(prayerDurationEnum(8)).toBe('5_to_10');
    expect(prayerDurationEnum(13)).toBe('10_to_15');
    expect(prayerDurationEnum(16)).toBe('more_than_15');
  });

  it('los límites siguen las etiquetas', () => {
    expect(prayerDurationEnum(2)).toBe('2_to_4');
    expect(prayerDurationEnum(5)).toBe('5_to_10');
    expect(prayerDurationEnum(10)).toBe('5_to_10');
    expect(prayerDurationEnum(15)).toBe('10_to_15');
    expect(prayerDurationEnum(120)).toBe('more_than_15');
  });
});

describe('prayerCalendarCellSize', () => {
  it('con el móvil sale del ancho real de la ventana', () => {
    expect(prayerCalendarCellSize(390, 500)).toBe(41);
    expect(prayerCalendarCellSize(360, 500)).toBe(36);
  });

  it('se sigue al ensanchar y al estrechar la ventana', () => {
    expect(prayerCalendarCellSize(320, 500)).toBeLessThan(
      prayerCalendarCellSize(390, 500),
    );
  });

  it('en pantalla ancha topa en el ancho máximo de contenido', () => {
    expect(prayerCalendarCellSize(1400, 500)).toBe(
      prayerCalendarCellSize(500, 500),
    );
  });

  it('siete celdas y seis huecos siempre caben en la tarjeta', () => {
    for (const w of [320, 375, 414, 500, 800]) {
      const cell = prayerCalendarCellSize(w, 500);
      const card = Math.min(w, 500) - 72;
      expect(cell * 7 + 30).toBeLessThanOrEqual(card);
    }
  });
});
