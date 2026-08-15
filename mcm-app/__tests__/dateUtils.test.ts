/**
 * Tests de `parseHorarioDate` / `getClosestDateIndex` (utils/dateUtils.ts).
 *
 * Las fechas del horario llegan de Firebase en dos formatos ("6 de junio" e
 * ISO), y el selector del horario decide qué día abrir por defecto con
 * `getClosestDateIndex`. Se usa tiempo simulado (`jest.setSystemTime`) para que
 * los tests no dependan del día en que se ejecuten.
 */
import { parseHorarioDate, getClosestDateIndex } from '@/utils/dateUtils';

const HOY = new Date(2026, 5, 15, 10, 0); // 15 de junio de 2026, hora local

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(HOY);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('parseHorarioDate', () => {
  it('devuelve null sin cadena', () => {
    expect(parseHorarioDate(undefined)).toBeNull();
    expect(parseHorarioDate('')).toBeNull();
  });

  it('parsea el formato español "6 de junio"', () => {
    const d = parseHorarioDate('6 de junio');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(5);
    expect(d!.getDate()).toBe(6);
  });

  it('ignora mayúsculas y espacios sobrantes', () => {
    const d = parseHorarioDate('  20 DE Diciembre  ');
    expect(d!.getMonth()).toBe(11);
    expect(d!.getDate()).toBe(20);
  });

  it('salta al año siguiente si la fecha pasó hace más de 6 meses', () => {
    // El umbral son 180 días: desde el 1 de diciembre, "5 de enero" ya cae
    // fuera y se entiende como el enero siguiente.
    jest.setSystemTime(new Date(2026, 11, 1, 10, 0));
    const d = parseHorarioDate('5 de enero');
    expect(d!.getFullYear()).toBe(2027);
    expect(d!.getMonth()).toBe(0);
  });

  it('mantiene el año en curso si la fecha pasó hace poco', () => {
    const d = parseHorarioDate('1 de mayo');
    expect(d!.getFullYear()).toBe(2026);
  });

  it('parsea ISO y normaliza a medianoche', () => {
    const d = parseHorarioDate('2026-06-06T18:30:00');
    expect(d!.getMonth()).toBe(5);
    expect(d!.getDate()).toBe(6);
    expect(d!.getHours()).toBe(0);
    expect(d!.getMinutes()).toBe(0);
  });

  it('devuelve null con un mes inexistente', () => {
    expect(parseHorarioDate('6 de brumario')).toBeNull();
  });

  it('devuelve null con basura no parseable', () => {
    expect(parseHorarioDate('mañana por la tarde')).toBeNull();
  });
});

describe('getClosestDateIndex', () => {
  it('devuelve 0 con datos vacíos o nulos', () => {
    expect(getClosestDateIndex(null)).toBe(0);
    expect(getClosestDateIndex(undefined)).toBe(0);
    expect(getClosestDateIndex([])).toBe(0);
  });

  it('elige el día de hoy si está en la lista', () => {
    const data = [
      { fecha: '10 de junio' },
      { fecha: '15 de junio' },
      { fecha: '20 de junio' },
    ];
    expect(getClosestDateIndex(data)).toBe(1);
  });

  it('elige el futuro más próximo, no el primero de la lista', () => {
    const data = [{ fecha: '30 de junio' }, { fecha: '18 de junio' }];
    expect(getClosestDateIndex(data)).toBe(1);
  });

  it('si todo pasó, elige el pasado más reciente', () => {
    const data = [{ fecha: '1 de mayo' }, { fecha: '10 de junio' }];
    expect(getClosestDateIndex(data)).toBe(1);
  });

  it('ignora las entradas con fecha ilegible', () => {
    const data = [
      { fecha: 'sin fecha' },
      { fecha: undefined },
      { fecha: '18 de junio' },
    ];
    expect(getClosestDateIndex(data)).toBe(2);
  });

  it('devuelve el último índice si ninguna fecha es interpretable', () => {
    const data = [{ fecha: 'ayer' }, { fecha: 'pasado mañana' }];
    expect(getClosestDateIndex(data)).toBe(1);
  });
});
