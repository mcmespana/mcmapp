import {
  HORARIO_LEGACY_KEY,
  chooseHorarioKey,
  horarioKey,
  horarioNombre,
  horarioTints,
  parseCachedSheets,
  sheetsFromProbes,
} from '@/utils/eventHorarios';

const probe = (n: number, extra: object = {}) => ({
  n,
  exists: true,
  hidden: false,
  nombre: `Horario de prueba ${n}`,
  ...extra,
});

describe('horarios múltiples de un evento', () => {
  it('las claves son horario1, horario2…', () => {
    expect(horarioKey(1)).toBe('horario1');
    expect(horarioKey(3)).toBe('horario3');
  });

  describe('horarioNombre', () => {
    it('usa meta.nombre si es texto, recortado', () => {
      expect(horarioNombre(2, '  Pre-monitores 1 ')).toBe('Pre-monitores 1');
    });
    it('sin nombre útil, «Horario N»', () => {
      expect(horarioNombre(2, undefined)).toBe('Horario 2');
      expect(horarioNombre(2, '   ')).toBe('Horario 2');
      expect(horarioNombre(2, 42)).toBe('Horario 2');
      expect(horarioNombre(2, null)).toBe('Horario 2');
    });
  });

  describe('sheetsFromProbes', () => {
    it('devuelve los que existen, en orden numérico, con su nombre', () => {
      const sheets = sheetsFromProbes([
        probe(3, { nombre: 'Pre-monitores 2' }),
        probe(1, { nombre: 'Curso Despierta' }),
        probe(2, { nombre: 'Pre-monitores 1' }),
      ]);
      expect(sheets).toEqual([
        { key: 'horario1', nombre: 'Curso Despierta' },
        { key: 'horario2', nombre: 'Pre-monitores 1' },
        { key: 'horario3', nombre: 'Pre-monitores 2' },
      ]);
    });

    it('ignora los que no existen y los ocultos', () => {
      const sheets = sheetsFromProbes([
        probe(1),
        probe(2, { hidden: true }),
        probe(3, { exists: false }),
        probe(4),
      ]);
      expect(sheets.map((s) => s.key)).toEqual(['horario1', 'horario4']);
    });

    it('admite huecos en la numeración', () => {
      const sheets = sheetsFromProbes([
        probe(1),
        probe(2, { exists: false }),
        probe(3),
      ]);
      expect(sheets.map((s) => s.key)).toEqual(['horario1', 'horario3']);
    });

    it('sin ninguno, lista vacía (evento de horario único)', () => {
      expect(sheetsFromProbes([probe(1, { exists: false })])).toEqual([]);
    });
  });

  describe('chooseHorarioKey', () => {
    const sheets = [
      { key: 'horario1', nombre: 'A' },
      { key: 'horario2', nombre: 'B' },
    ];
    it('respeta lo elegido si sigue existiendo', () => {
      expect(chooseHorarioKey(sheets, 'horario2')).toBe('horario2');
    });
    it('si lo elegido ya no existe o no hay elección, el primero', () => {
      expect(chooseHorarioKey(sheets, 'horario9')).toBe('horario1');
      expect(chooseHorarioKey(sheets, null)).toBe('horario1');
    });
    it('sin horarios numerados, el horario único de siempre', () => {
      expect(chooseHorarioKey([], null)).toBe(HORARIO_LEGACY_KEY);
      expect(chooseHorarioKey([], 'horario2')).toBe('horario');
    });
  });

  describe('parseCachedSheets', () => {
    it('lee una lista bien formada', () => {
      const raw = JSON.stringify([{ key: 'horario1', nombre: 'A' }]);
      expect(parseCachedSheets(raw)).toEqual([
        { key: 'horario1', nombre: 'A' },
      ]);
    });
    it('descarta basura, JSON roto y null', () => {
      expect(parseCachedSheets(null)).toBeNull();
      expect(parseCachedSheets('no es json')).toBeNull();
      expect(parseCachedSheets('{"a":1}')).toBeNull();
      expect(parseCachedSheets('[{"key":1}]')).toBeNull();
    });
    it('una lista vacía es válida (evento de horario único)', () => {
      expect(parseCachedSheets('[]')).toEqual([]);
    });
  });

  describe('color de cada horario', () => {
    it('sheetsFromProbes recoge meta.color solo si es #RRGGBB', () => {
      const sheets = sheetsFromProbes([
        probe(1, { color: '#0f7f85' }),
        probe(2, { color: 'rojo' }),
        probe(3),
      ]);
      expect(sheets[0].color).toBe('#0F7F85');
      expect(sheets[1].color).toBeUndefined();
      expect(sheets[2].color).toBeUndefined();
    });

    it('horarioTints: el primero es el del evento y el resto combinan', () => {
      const sheets = sheetsFromProbes([probe(1), probe(2), probe(3)]);
      const tints = horarioTints('#F07C2B', sheets);
      expect(tints[0]).toBe('#F07C2B');
      expect(new Set(tints).size).toBe(3);
    });

    it('horarioTints respeta el color puesto a mano', () => {
      const sheets = sheetsFromProbes([
        probe(1),
        probe(2, { color: '#123456' }),
      ]);
      expect(horarioTints('#F07C2B', sheets)[1]).toBe('#123456');
    });

    it('la caché admite el color y rechaza uno mal formado', () => {
      expect(
        parseCachedSheets(
          '[{"key":"horario1","nombre":"A","color":"#ABCDEF"}]',
        ),
      ).toEqual([{ key: 'horario1', nombre: 'A', color: '#ABCDEF' }]);
      expect(
        parseCachedSheets('[{"key":"horario1","nombre":"A","color":"azul"}]'),
      ).toBeNull();
    });
  });
});
