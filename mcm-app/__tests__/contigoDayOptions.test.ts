/**
 * `getDayOptions`: qué se ofrece al tocar un día en Contigo. La regla que se
 * blinda: un día pasado ofrece SIEMPRE oración y revisión (para poder
 * apuntar lo que se olvidó), y un día futuro solo el evangelio.
 */
import { getDayOptions } from '@/components/contigo/DayActionSheet';

const TODAY = '2026-10-03';
const keys = (date: string, rec: any = null) =>
  getDayOptions(date, rec, TODAY).map((o) => o.key);

describe('getDayOptions', () => {
  it('un día pasado vacío ofrece las tres cosas, en orden fijo', () => {
    expect(keys('2026-09-30')).toEqual(['evangelio', 'oracion', 'revision']);
  });

  it('hoy también', () => {
    expect(keys(TODAY)).toEqual(['evangelio', 'oracion', 'revision']);
  });

  it('un día futuro solo deja leer el evangelio', () => {
    expect(keys('2026-10-04')).toEqual(['evangelio']);
  });

  it('marca como hecho lo que se hizo y cambia el texto', () => {
    const opts = getDayOptions(
      '2026-09-30',
      {
        date: '2026-09-30',
        readingDone: false,
        prayerDone: true,
        timestamp: 1,
      } as any,
      TODAY,
    );
    const oracion = opts.find((o) => o.key === 'oracion')!;
    const revision = opts.find((o) => o.key === 'revision')!;
    expect(oracion.recorded).toBe(true);
    expect(oracion.subtitle).toMatch(/Ver cómo fue/);
    expect(revision.recorded).toBe(false);
    expect(revision.subtitle).toMatch(/Hacer la revisión/);
  });
});
