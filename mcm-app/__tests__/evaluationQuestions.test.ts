import {
  CONGRESO_MC_EVALUATION,
  cleanAnswers,
  getEventEvaluationDefault,
  isEvaluationOpen,
  isQuestionAnswered,
  visibleQuestions,
  DEFAULT_EVENT_EVALUATION,
  type EvalQuestion,
} from '@/constants/evaluation';

const seed = require('../firebase-seed/eventos/congresomc26-evaluacion.json');

const Q = CONGRESO_MC_EVALUATION.questions;
const ids = (qs: EvalQuestion[]) => qs.map((q) => q.id);

describe('visibleQuestions (rutas con showIf)', () => {
  it('sin contestar solo se ve la pregunta de arranque y lo común', () => {
    expect(ids(visibleQuestions(Q, {}))).toEqual(['curso', 'practicos']);
  });

  it('ruta Pre-monitores', () => {
    expect(ids(visibleQuestions(Q, { curso: 'premonitores' }))).toEqual([
      'curso',
      'pm_valoracion',
      'pm_quedas',
      'pm_falta',
      'pm_formato',
      'pm_mat',
      'practicos',
      'pm_mejora',
    ]);
  });

  it('ruta Curso Despierta', () => {
    expect(ids(visibleQuestions(Q, { curso: 'despierta' }))).toEqual([
      'curso',
      'dp_expectativas',
      'dp_valio',
      'dp_momentos',
      'practicos',
      'dp_participacion',
      'dp_mejora',
      'dp_otra',
    ]);
  });

  it('una pregunta que cuelga de otra oculta no se ve', () => {
    const qs: EvalQuestion[] = [
      {
        id: 'a',
        type: 'single',
        label: 'A',
        options: [{ value: 'x', label: 'X' }],
      },
      {
        id: 'b',
        type: 'text',
        label: 'B',
        showIf: { questionId: 'a', equals: 'x' },
      },
      {
        id: 'c',
        type: 'text',
        label: 'C',
        showIf: { questionId: 'b', equals: 'x' },
      },
    ];
    expect(ids(visibleQuestions(qs, { a: 'y', b: 'x' }))).toEqual(['a']);
  });

  it('equals acepta varios valores y respuestas multi', () => {
    const qs: EvalQuestion[] = [
      {
        id: 'a',
        type: 'multi',
        label: 'A',
        options: [{ value: 'x', label: 'X' }],
      },
      {
        id: 'b',
        type: 'text',
        label: 'B',
        showIf: { questionId: 'a', equals: ['x', 'z'] },
      },
    ];
    expect(ids(visibleQuestions(qs, { a: ['q', 'z'] }))).toEqual(['a', 'b']);
    expect(ids(visibleQuestions(qs, { a: ['q'] }))).toEqual(['a']);
  });
});

describe('isQuestionAnswered', () => {
  const ratings = Q.find((q) => q.id === 'practicos')!;
  it('ratings exige TODOS los elementos valorados', () => {
    expect(isQuestionAnswered(ratings, undefined)).toBe(false);
    expect(isQuestionAnswered(ratings, { lugar: 5 })).toBe(false);
    const all = Object.fromEntries(
      (ratings.items ?? []).map((i) => [i.value, 4]),
    );
    expect(isQuestionAnswered(ratings, all)).toBe(true);
    expect(isQuestionAnswered(ratings, { ...all, lugar: 0 })).toBe(false);
  });

  it('scale acepta 0; stars no', () => {
    expect(isQuestionAnswered({ id: 's', type: 'scale', label: 's' }, 0)).toBe(
      true,
    );
    expect(isQuestionAnswered({ id: 's', type: 'stars', label: 's' }, 0)).toBe(
      false,
    );
  });
});

describe('cleanAnswers', () => {
  it('descarta lo de la otra ruta, textos vacíos y valoraciones a 0', () => {
    const cleaned = cleanAnswers(Q, {
      curso: 'despierta',
      dp_expectativas: 6,
      dp_valio: true,
      dp_momentos: ['dp_x'],
      practicos: { lugar: 5, albergue: 0 },
      dp_mejora: '   ',
      dp_otra: ' gracias ',
      // restos de haber elegido antes la otra ruta:
      pm_valoracion: 3,
      pm_quedas: 'texto',
    });
    expect(cleaned).toEqual({
      curso: 'despierta',
      dp_expectativas: 6,
      dp_valio: true,
      dp_momentos: ['dp_x'],
      practicos: { lugar: 5 },
      dp_otra: 'gracias',
    });
  });
});

describe('Evaluación del Congreso M+C (guardarraíl de la config)', () => {
  it('ids únicos', () => {
    const all = ids(Q);
    expect(new Set(all).size).toBe(all.length);
  });

  it('cada showIf apunta a una pregunta anterior y a una opción que existe', () => {
    Q.forEach((q, i) => {
      if (!q.showIf) return;
      const idx = Q.findIndex((x) => x.id === q.showIf!.questionId);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(i);
      const target = Q[idx];
      const wanted = ([] as string[]).concat(q.showIf.equals);
      wanted.forEach((w) =>
        expect((target.options ?? []).map((o) => o.value)).toContain(w),
      );
    });
  });

  it('single/multi traen opciones únicas, ratings trae items, maxSelect cabe', () => {
    for (const q of Q) {
      if (q.type === 'single' || q.type === 'multi') {
        const vals = (q.options ?? []).map((o) => o.value);
        expect(vals.length).toBeGreaterThan(0);
        expect(new Set(vals).size).toBe(vals.length);
        if (q.maxSelect) expect(q.maxSelect).toBeLessThanOrEqual(vals.length);
      }
      if (q.type === 'ratings')
        expect((q.items ?? []).length).toBeGreaterThan(0);
    }
  });

  it('la primera pregunta es obligatoria y solo el cierre es opcional', () => {
    expect(Q[0].optional).toBeFalsy();
    for (const q of Q) {
      if (q.optional) expect(q.section).toBe('Para terminar');
    }
  });

  it('está programada: cerrada antes del domingo 10:00 y tras el lunes', () => {
    const before = Date.UTC(2026, 10, 29, 8, 59); // 09:59 Madrid
    const during = Date.UTC(2026, 10, 29, 9, 1); // 10:01 Madrid
    const after = Date.UTC(2026, 11, 1, 0, 1); // 01:01 Madrid del martes
    expect(isEvaluationOpen(CONGRESO_MC_EVALUATION, before)).toBe(false);
    expect(isEvaluationOpen(CONGRESO_MC_EVALUATION, during)).toBe(true);
    expect(isEvaluationOpen(CONGRESO_MC_EVALUATION, after)).toBe(false);
  });

  it('el seed del panel coincide con el código', () => {
    expect(seed.data).toEqual(
      JSON.parse(JSON.stringify(CONGRESO_MC_EVALUATION)),
    );
  });

  it('el Congreso usa la suya y los demás eventos la genérica', () => {
    expect(getEventEvaluationDefault('congresomc26')).toBe(
      CONGRESO_MC_EVALUATION,
    );
    expect(getEventEvaluationDefault('visitapapa26')).toBe(
      DEFAULT_EVENT_EVALUATION,
    );
  });
});
