/**
 * El territorio «Comunica» (decisión `territorio` = A; plan 03 §2 y
 * `design.md` §2): el acento violeta se lee en los dos modos, el degradado de
 * marca solo vive en la acción principal y los colores de dato son tokens.
 */
import fs from 'fs';
import path from 'path';

import { Colors, ComunicaColors } from '@/constants/colors';
import {
  BRAND_GRADIENT,
  comunicaTheme,
  NOTICE_FILL,
  SCARF_FILL,
} from '@/components/comunica/comun/theme';
import { contrastRatio, onColor } from '@/utils/colorUtils';

const ROOT = path.join(__dirname, '..', '..');
const walk = (d: string): string[] =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join('/');
const AREA = [
  ...walk(path.join(ROOT, 'components', 'comunica')),
  ...walk(path.join(ROOT, 'app', '(tabs)', 'comunica')),
];

describe('el acento del área', () => {
  it('es el violeta Comunica, no el morado LC', () => {
    expect(comunicaTheme(false).accentFill.toLowerCase()).toBe('#6c4b9e');
    expect(comunicaTheme(true).accentFill.toLowerCase()).toBe('#6c4b9e');
  });

  it.each([
    ['claro', false, Colors.light],
    ['oscuro', true, Colors.dark],
  ] as const)(
    'como texto llega a AA sobre fondo, hundido y card (%s)',
    (_m, isDark, roles) => {
      const t = comunicaTheme(isDark);
      for (const surface of [
        roles.background,
        roles.backgroundSunken,
        roles.card,
      ]) {
        expect(contrastRatio(t.accentText, surface)).toBeGreaterThanOrEqual(
          4.5,
        );
      }
    },
  );

  it('como relleno lleva una tinta legible encima', () => {
    const t = comunicaTheme(false);
    expect(t.onAccent.toLowerCase()).toMatch(/^#fff(fff)?$/);
    expect(contrastRatio(onColor(t.accentFill), t.accentFill)).toBeGreaterThan(
      4.5,
    );
  });
});

describe('el degradado de marca', () => {
  it('es azul → violeta → magenta y el texto blanco se lee en cada tramo', () => {
    expect(BRAND_GRADIENT.map((c) => c.toLowerCase())).toEqual([
      '#1c6fb3',
      '#6c4b9e',
      '#9d1e74',
    ]);
    for (const stop of BRAND_GRADIENT) {
      expect(contrastRatio('#FFFFFF', stop)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('solo lo pinta AreaPrimaryButton (la acción principal)', () => {
    const users = AREA.filter((f) =>
      /LinearGradient|BRAND_GRADIENT|ComunicaColors\.gradient/.test(
        fs.readFileSync(f, 'utf8'),
      ),
    )
      .map(rel)
      .filter((f) => f !== 'components/comunica/comun/theme.ts');
    expect(users).toEqual(['components/comunica/comun/AreaPrimaryButton.tsx']);
  });

  it('cada pantalla tiene como mucho UNA acción principal', () => {
    const twice = AREA.filter(
      (f) =>
        (fs.readFileSync(f, 'utf8').match(/<AreaPrimaryButton\b/g) ?? [])
          .length > 1,
    ).map(rel);
    expect(twice).toEqual([]);
  });
});

describe('los colores de dato son tokens del territorio', () => {
  it('pañuelos y avisos son los del plugin', () => {
    expect(SCARF_FILL).toBe(ComunicaColors.scarf);
    expect(NOTICE_FILL).toBe(ComunicaColors.notice);
    expect(ComunicaColors.notice[2].toLowerCase()).toBe('#c2410c');
    expect(ComunicaColors.segment).toEqual({
      com2: '#7c3aed',
      com3: '#be185d',
    });
  });

  it('el número blanco se lee dentro del aviso naranja y del rojo', () => {
    for (const n of [2, 3] as const) {
      expect(contrastRatio('#FFFFFF', NOTICE_FILL[n])).toBeGreaterThanOrEqual(
        4.5,
      );
    }
    expect(
      contrastRatio(onColor(NOTICE_FILL[1]), NOTICE_FILL[1]),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('ningún fichero del área escribe un hex a mano', () => {
    const hex = /['"]#[0-9a-fA-F]{3,8}['"]/g;
    const offenders = AREA.flatMap((f) =>
      (fs.readFileSync(f, 'utf8').match(hex) ?? [])
        .filter((m) => !/^['"]#(fff|ffffff|000|000000)['"]$/i.test(m))
        .map((m) => `${rel(f)} ${m}`),
    );
    expect(offenders).toEqual([]);
  });
});
