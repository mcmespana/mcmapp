/**
 * Tests de `utils/carismochitoGate.ts` — el interruptor general de
 * Carismochito (`global.carismochito` en `/profileConfig` + modo tester).
 *
 * Lo que se protege es que un valor raro o ausente NUNCA abra Carismochito a
 * todo el mundo: el defecto es "alpha" (solo probadores), y el cierre total
 * (`off`) gana incluso al modo tester.
 */
import {
  isCarismochitoAvailable,
  parseCarismochitoFlag,
} from '@/utils/carismochitoGate';

describe('parseCarismochitoFlag', () => {
  it('reconoce los tres valores', () => {
    expect(parseCarismochitoFlag('off')).toBe('off');
    expect(parseCarismochitoFlag('alpha')).toBe('alpha');
    expect(parseCarismochitoFlag('all')).toBe('all');
  });

  it('lo ausente o raro cae en "alpha", nunca en "all"', () => {
    expect(parseCarismochitoFlag(undefined)).toBe('alpha');
    expect(parseCarismochitoFlag(null)).toBe('alpha');
    expect(parseCarismochitoFlag('ALL')).toBe('alpha');
    expect(parseCarismochitoFlag(true)).toBe('alpha');
    expect(parseCarismochitoFlag(1)).toBe('alpha');
  });
});

describe('isCarismochitoAvailable', () => {
  it('off: cerrado para todos, también para el modo tester', () => {
    expect(isCarismochitoAvailable({ flag: 'off', testerMode: true })).toBe(
      false,
    );
    expect(isCarismochitoAvailable({ flag: 'off', testerMode: false })).toBe(
      false,
    );
  });

  it('alpha: solo con el modo tester encendido', () => {
    expect(isCarismochitoAvailable({ flag: 'alpha', testerMode: true })).toBe(
      true,
    );
    expect(isCarismochitoAvailable({ flag: 'alpha', testerMode: false })).toBe(
      false,
    );
  });

  it('all: para todo el mundo, haya o no modo tester', () => {
    expect(isCarismochitoAvailable({ flag: 'all', testerMode: false })).toBe(
      true,
    );
    expect(isCarismochitoAvailable({ flag: 'all', testerMode: true })).toBe(
      true,
    );
  });
});
