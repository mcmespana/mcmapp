/**
 * `npm run panuelo:subir` (`scripts/panuelo-subir.js`): sube UNA pieza del
 * catálogo sin poder borrar las demás. Aquí se prueba lo que decide escribir
 * (`planUpload`, puro); la CLI de Firebase no se llama.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseArgs, planUpload } = require('../scripts/panuelo-subir.js');

const piece = (name: string, extra: Record<string, unknown> = {}) => ({
  kind: 'chapa',
  name,
  look: { kind: 'chapa', bg: '#ffffff' },
  ...extra,
});
const SEED = {
  'chapa-a': piece('A'),
  'chapa-b': piece('B'),
  'chapa-pascua': piece('Pascua', {
    grant: { type: 'attendance', events: ['evt-1'] },
  }),
};
const NOW = 1_800_000_000_000;

describe('panuelo:subir', () => {
  it('escribe solo la hoja de esa pieza y la fecha, nunca el catálogo entero', () => {
    const plan = planUpload(SEED, ['chapa-pascua'], {}, NOW);
    expect(plan.errors).toEqual([]);
    expect(plan.writes).toEqual([
      { path: '/panuelo/data/items/chapa-pascua', value: SEED['chapa-pascua'] },
      { path: '/panuelo/updatedAt', value: NOW },
    ]);
  });

  it('avisa si va a sustituir una distinta, y de lo que hay arriba y no en el repo', () => {
    const plan = planUpload(
      SEED,
      ['chapa-a', 'chapa-b'],
      { 'chapa-a': piece('A'), 'chapa-b': piece('Otra'), 'del-panel': {} },
      NOW,
    );
    expect(plan.notes).toEqual([
      '«chapa-a» ya está igual en Firebase (se vuelve a escribir igual).',
      '«chapa-b» ya existe en Firebase y es distinta: se va a SUSTITUIR.',
      'En Firebase hay piezas que no están en el repo (no se tocan): del-panel.',
    ]);
    // Lo de arriba que no está en el repo no se escribe ni se borra.
    expect(plan.writes.map((w: { path: string }) => w.path)).not.toContain(
      '/panuelo/data/items/del-panel',
    );
  });

  it('no sube nada si un id no existe o no es un id', () => {
    const plan = planUpload(SEED, ['chapa-a', 'no-esta', '../data'], {}, NOW);
    expect(plan.errors).toHaveLength(2);
    expect(plan.writes).toEqual([
      { path: '/panuelo/data/items/chapa-a', value: SEED['chapa-a'] },
    ]);
  });

  it('se niega a subir una pieza por asistencia mal hecha', () => {
    const bad = {
      sin: piece('Sin', { grant: { type: 'attendance', events: [] } }),
      cambiable: piece('C', {
        tradeable: true,
        grant: { type: 'attendance', events: ['e'] },
      }),
    };
    expect(planUpload(bad, ['sin', 'cambiable'], null, NOW).errors).toEqual([
      '«sin»: una pieza por asistencia necesita `events`.',
      '«cambiable»: una pieza por asistencia no puede ser `tradeable`.',
    ]);
  });

  it('sin ids, pide uno', () => {
    expect(planUpload(SEED, [], null, NOW).errors).toEqual([
      'Di qué pieza subir: su id.',
    ]);
  });

  it('lee las opciones', () => {
    expect(
      parseArgs(['a', '--dry-run', 'b', 'a', '--project', 'p', '--yes']),
    ).toEqual({
      ids: ['a', 'b'],
      dryRun: true,
      yes: true,
      exportOnly: false,
      project: 'p',
      instance: null,
    });
    expect(() => parseArgs(['--borrar-todo'])).toThrow('Opción desconocida');
  });
});
