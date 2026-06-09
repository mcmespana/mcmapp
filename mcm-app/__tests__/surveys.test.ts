import {
  isEvaluationOpen,
  mergeEvaluationConfig,
  type EvaluationConfig,
} from '@/constants/evaluation';
import { matchesAudience } from '@/constants/surveys';

const base: EvaluationConfig = {
  title: 'Test',
  questions: [{ id: 'q1', type: 'stars', label: 'Q1' }],
};

describe('isEvaluationOpen', () => {
  const NOW = 1_000_000;

  it('status open → abierta', () => {
    expect(isEvaluationOpen({ status: 'open' }, NOW)).toBe(true);
  });

  it('status draft/closed → cerrada', () => {
    expect(isEvaluationOpen({ status: 'draft' }, NOW)).toBe(false);
    expect(isEvaluationOpen({ status: 'closed' }, NOW)).toBe(false);
  });

  it('respeta la ventana opensAt/closesAt', () => {
    expect(isEvaluationOpen({ status: 'open', opensAt: NOW + 10 }, NOW)).toBe(
      false,
    );
    expect(isEvaluationOpen({ status: 'open', closesAt: NOW - 10 }, NOW)).toBe(
      false,
    );
    expect(
      isEvaluationOpen(
        { status: 'open', opensAt: NOW - 10, closesAt: NOW + 10 },
        NOW,
      ),
    ).toBe(true);
  });

  it('legacy evaluationOpen sin status', () => {
    expect(isEvaluationOpen({ evaluationOpen: true }, NOW)).toBe(true);
    expect(isEvaluationOpen({ evaluationOpen: false }, NOW)).toBe(false);
    expect(isEvaluationOpen({}, NOW)).toBe(true); // por defecto abierta
  });
});

describe('mergeEvaluationConfig', () => {
  it('sin remoto devuelve el fallback', () => {
    expect(mergeEvaluationConfig(base, null)).toBe(base);
  });

  it('remoto gana campo a campo', () => {
    const merged = mergeEvaluationConfig(base, { title: 'Nuevo' });
    expect(merged.title).toBe('Nuevo');
    expect(merged.questions).toBe(base.questions); // sin questions remotas, mantiene
  });

  it('questions remotas no vacías sustituyen', () => {
    const remoteQs = [{ id: 'r', type: 'text' as const, label: 'R' }];
    const merged = mergeEvaluationConfig(base, { questions: remoteQs });
    expect(merged.questions).toBe(remoteQs);
  });

  it('questions remotas vacías → mantiene fallback', () => {
    const merged = mergeEvaluationConfig(base, { questions: [] });
    expect(merged.questions).toBe(base.questions);
  });
});

describe('matchesAudience', () => {
  const user = {
    topics: ['general', 'monitores'],
    profileType: 'monitor',
    delegationId: 'mcm-madrid',
  };

  it('sin audiencia pasa todo el mundo', () => {
    expect(matchesAudience(undefined, user)).toBe(true);
  });

  it('topics con intersección pasa', () => {
    expect(matchesAudience({ topics: ['monitores'] }, user)).toBe(true);
  });

  it('topics sin intersección no pasa', () => {
    expect(matchesAudience({ topics: ['familias'] }, user)).toBe(false);
  });

  it('profileType filtra', () => {
    expect(matchesAudience({ profileTypes: ['monitor'] }, user)).toBe(true);
    expect(matchesAudience({ profileTypes: ['familia'] }, user)).toBe(false);
  });

  it('delegación filtra', () => {
    expect(matchesAudience({ delegationIds: ['mcm-madrid'] }, user)).toBe(true);
    expect(matchesAudience({ delegationIds: ['mcm-onda'] }, user)).toBe(false);
  });

  it('AND entre criterios definidos', () => {
    expect(
      matchesAudience(
        { profileTypes: ['monitor'], delegationIds: ['mcm-onda'] },
        user,
      ),
    ).toBe(false);
  });
});
