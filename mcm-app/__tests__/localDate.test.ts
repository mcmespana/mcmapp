/**
 * Tests de `localISO` — bug UTC en "hoy" (Home/Calendario/Reflexiones).
 *
 * `toISOString()` convierte a UTC antes de cortar la fecha, así que en
 * España (UTC+1/+2) la medianoche local se ve como el día anterior. Estos
 * tests construyen `Date` con los getters LOCALES (`new Date(y, m, d, h, min)`)
 * para que el resultado sea el mismo en cualquier zona horaria del runner.
 */
import { localISO } from '@/utils/localDate';

describe('localISO', () => {
  it('formatea una fecha de mediodía', () => {
    expect(localISO(new Date(2026, 6, 18, 12, 0))).toBe('2026-07-18');
  });

  it('no se desplaza al día anterior a las 00:30 locales (el bug de toISOString)', () => {
    expect(localISO(new Date(2026, 6, 18, 0, 30))).toBe('2026-07-18');
  });

  it('rellena con ceros mes y día de un dígito', () => {
    expect(localISO(new Date(2026, 0, 5, 10, 0))).toBe('2026-01-05');
  });

  it('respeta el cambio de mes (31 de enero → 1 de febrero)', () => {
    const d = new Date(2026, 0, 31, 23, 0);
    d.setDate(d.getDate() + 1);
    expect(localISO(d)).toBe('2026-02-01');
  });

  it('usa new Date() por defecto sin argumentos', () => {
    expect(localISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
