/**
 * Iconos de la cabecera del cantoral: se leen en las tres plataformas.
 *
 * En Android y en web la cabecera es una barra amarilla SÓLIDA en claro y en
 * oscuro; en iOS es transparente sobre el fondo de la pantalla. Cada pantalla
 * elegía el color de sus iconos como si todas fueran iOS, y en Android salían
 * amarillo sobre amarillo (1,0:1) o blanco sobre amarillo (1,7:1).
 */
import fs from 'fs';
import path from 'path';
import { cantoralHeaderTint } from '@/utils/cantoralHeader';
import { TabHeaderColors, themeColors } from '@/constants/colors';
import { contrastRatio } from '@/utils/colorUtils';

/** Mínimo WCAG para iconos y otros elementos no textuales. */
const NON_TEXT = 3;

describe('cantoralHeaderTint', () => {
  it.each(['android', 'web'] as const)(
    'en %s, sobre la barra amarilla, es el mismo casi negro en los dos modos',
    (os) => {
      for (const isDark of [false, true]) {
        const c = cantoralHeaderTint(isDark, os);
        expect(c).toBe(themeColors(false).headerTint);
        expect(
          contrastRatio(c, TabHeaderColors.cancionero),
        ).toBeGreaterThanOrEqual(NON_TEXT);
      }
    },
  );

  it('en iOS se lee sobre el fondo de la pantalla en cada modo', () => {
    for (const isDark of [false, true]) {
      const c = cantoralHeaderTint(isDark, 'ios');
      const t = themeColors(isDark);
      expect(contrastRatio(c, t.background)).toBeGreaterThanOrEqual(NON_TEXT);
      expect(contrastRatio(c, t.backgroundSunken)).toBeGreaterThanOrEqual(
        NON_TEXT,
      );
    }
  });
});

describe('las pantallas del cantoral no deciden el color a mano', () => {
  const ROOT = path.join(__dirname, '..');
  it.each([
    'app/(tabs)/cancionero/_layout.tsx',
    'app/screens/CategoriesScreen.tsx',
    'app/screens/SongListScreen.tsx',
    'app/screens/SongDetailScreen.tsx',
  ])('%s usa cantoralHeaderTint', (file) => {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    expect(src).toContain('cantoralHeaderTint(');
    // Los dos valores de iOS escritos a mano eran justo el fallo en Android.
    expect(src).not.toMatch(/accentYellow|#3d79b9/i);
  });
});
