/**
 * Test de vigencia del calendario litúrgico recortado (Plan 011).
 *
 * `assets/calendario-liturgico.json` es una ventana rodante de 5 años
 * (generada por `npm run liturgical:window` desde `-completo.json`), no la
 * tabla completa 2025-2100. Este test es el candado contra que esa ventana
 * caduque en silencio: si el año actual (o el siguiente) ya no está dentro,
 * significa que hace falta regenerarla.
 */
import liturgicalCalendar from '@/assets/calendario-liturgico.json';
import { getLiturgicalInfo } from '@/components/contigo/LiturgicalBadge';

describe('ventana del calendario litúrgico', () => {
  it('contiene el año actual y el siguiente — si falla, ejecuta `npm run liturgical:window` y commitea el resultado', () => {
    const currentYear = String(new Date().getFullYear());
    const nextYear = String(new Date().getFullYear() + 1);
    const years = Object.keys(liturgicalCalendar);

    expect(years).toContain(currentYear);
    expect(years).toContain(nextYear);
  });

  it('getLiturgicalInfo de una fecha de Adviento del año en curso devuelve un tiempo real', () => {
    const currentYear = String(new Date().getFullYear());
    const cal = (liturgicalCalendar as any)[currentYear];
    const adviento = cal.tiempos.find((t: any) => t.id === 'adviento');

    const info = getLiturgicalInfo(adviento.inicio);

    expect(info.name).not.toBe('Tiempo Ordinario');
    expect(info.name).toBe(adviento.nombre);
  });

  it('getLiturgicalInfo de una fecha fuera de la ventana devuelve el fallback sin lanzar', () => {
    expect(() => getLiturgicalInfo('2099-06-15')).not.toThrow();
    const info = getLiturgicalInfo('2099-06-15');
    expect(info.name).toBe('Tiempo Ordinario');
  });
});
