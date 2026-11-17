/**
 * Letra grande del sistema (gente mayor con el zoom de letra alto).
 *
 * Dos reglas que se pueden romper sin enterarse:
 *  - Con la letra NORMAL (o la «grande» de Android, 1.15) no cambia nada: el
 *    cambio de maqueta del onboarding solo se activa desde ×1.2.
 *  - El título «MCM App» de la cabecera nativa lleva techo de escala (con la
 *    letra al ×2 no cabía en la barra), y ese techo nunca baja de ×1.3
 *    (`design.md` §4).
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

import HomeBrand from '@/components/home/HomeBrand';
import {
  CHROME_MAX_FONT_SCALE,
  LARGE_TEXT_FONT_SCALE,
  appScaledTextCap,
  isLargeText,
} from '@/hooks/useLargeText';
import {
  renderSongDocument,
  systemFontScalePercent,
} from '@/utils/songDocument';

jest.mock('@/components/home/HomeLogo', () => () => null);

describe('isLargeText', () => {
  it('la letra normal y la «grande» de Android no cuentan como grande', () => {
    expect(isLargeText(1)).toBe(false);
    expect(isLargeText(1.15)).toBe(false);
  });

  it('desde «muy grande» (Android 1.3, iOS XXL 1.24) sí', () => {
    expect(isLargeText(LARGE_TEXT_FONT_SCALE)).toBe(true);
    expect(isLargeText(1.24)).toBe(true);
    expect(isLargeText(1.3)).toBe(true);
    expect(isLargeText(2)).toBe(true);
  });
});

describe('techo de escala del texto de cromo', () => {
  it('no capa por debajo de ×1.3 (design.md §4)', () => {
    expect(CHROME_MAX_FONT_SCALE).toBeGreaterThanOrEqual(1.3);
  });

  it('el título «MCM App» de la cabecera lo lleva', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <HomeBrand
          carismoActive={false}
          isDark={false}
          onCarismoPress={() => {}}
        />,
      );
    });
    const title = tree.root
      .findAllByType(Text)
      .find((t) => t.props.children === 'MCM App');
    expect(title).toBeDefined();
    expect(title!.props.maxFontSizeMultiplier).toBe(CHROME_MAX_FONT_SCALE);
  });
});

describe('tamaño de letra de la app × escala del sistema', () => {
  it('con la app al ×1 no capa por debajo de ×2', () => {
    expect(appScaledTextCap(1)).toBe(2);
  });

  it('con la app al ×2 el sistema se queda en ×1.3 (nunca menos)', () => {
    expect(appScaledTextCap(2)).toBe(CHROME_MAX_FONT_SCALE);
  });
});

describe('hoja de canción y escala del sistema', () => {
  it('se acota a [80 %, 200 %] y sin dato queda al 100 %', () => {
    expect(systemFontScalePercent(undefined)).toBe(100);
    expect(systemFontScalePercent(1)).toBe(100);
    expect(systemFontScalePercent(1.3)).toBe(130);
    expect(systemFontScalePercent(3.1)).toBe(200);
    expect(systemFontScalePercent(0.5)).toBe(80);
  });

  it('la hoja lleva la escala en su CSS', () => {
    const doc = renderSongDocument('{title: Prueba}\n[C]Hola', {
      style: {
        fontSize: 1,
        fontFamily: 'serif',
        isDark: false,
        chordsVisible: true,
        topPadding: 0,
        bottomPadding: 0,
      } as never,
      currentTranspose: 0,
      notation: 'ES',
      systemFontScale: 1.5,
    });
    expect(doc.html).toContain('html { font-size: 150%; }');
  });
});
