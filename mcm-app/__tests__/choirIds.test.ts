/**
 * Tests de `utils/choirIds.ts` — la identidad de un coro.
 *
 * Lo crítico aquí es la invariante que sostiene todo el rediseño: un id de
 * coro NUNCA se puede confundir con un código de playlist de 4 dígitos, porque
 * ambos comparten el mismo nodo de sesiones (`/choirSessions/<clave>`) y las
 * mismas URLs.
 */
import {
  choirNameKey,
  isChoirId,
  makeChoirId,
  normalizeChoirName,
} from '@/utils/choirIds';
import { isValidCode } from '@/utils/playlistCodes';

describe('normalizeChoirName', () => {
  it('colapsa espacios y recorta', () => {
    expect(normalizeChoirName('  Coro   Consolación  ')).toBe(
      'Coro Consolación',
    );
  });

  it('recorta nombres kilométricos', () => {
    expect(normalizeChoirName('x'.repeat(200))).toHaveLength(60);
  });
});

describe('choirNameKey', () => {
  it('ignora mayúsculas, acentos y separadores al comparar', () => {
    const key = choirNameKey('Coro Consolación Castellón');
    expect(choirNameKey('coro  consolacion castellon')).toBe(key);
    expect(choirNameKey('CORO-CONSOLACION-CASTELLON')).toBe(key);
  });

  it('no confunde dos coros distintos', () => {
    expect(choirNameKey('Coro de Madrid')).not.toBe(
      choirNameKey('Coro de Málaga'),
    );
  });
});

describe('makeChoirId', () => {
  it('produce un id legible con sufijo', () => {
    expect(makeChoirId('Coro Consolación Castellón', 'ab12')).toBe(
      'coro-consolacion-castellon-ab12',
    );
  });

  it('sobrevive a un nombre sin letras latinas', () => {
    expect(makeChoirId('🎵🎵🎵', 'ab12')).toBe('coro-ab12');
  });

  it('no deja guiones dobles al recortar nombres largos', () => {
    const id = makeChoirId('a'.repeat(40), 'ab12');
    expect(id).not.toMatch(/--/);
    expect(isChoirId(id)).toBe(true);
  });

  it('todo id generado es válido y nunca parece un código de playlist', () => {
    for (const name of [
      'Coro A',
      'Parroquia San Juan',
      'jóvenes 2026',
      '123',
    ]) {
      const id = makeChoirId(name, 'zz99');
      expect(isChoirId(id)).toBe(true);
      expect(isValidCode(id)).toBe(false);
    }
  });
});

describe('isChoirId', () => {
  it.each(['1234', '0000', 'coro', '', 'Coro-Mayus', 'con espacio-1234'])(
    'rechaza «%s»',
    (value) => {
      expect(isChoirId(value)).toBe(false);
    },
  );

  it('acepta un id bien formado', () => {
    expect(isChoirId('consolacion-castellon-4f2a')).toBe(true);
  });
});
