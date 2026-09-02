/**
 * Invariantes del sistema de diseño.
 *
 * Estas reglas están escritas en `design.md` (raíz del monorepo). Un documento
 * no impide que nadie las rompa; este test sí. Cubre lo que es mecánicamente
 * comprobable:
 *
 *  1. `global.css` (tema de HeroUI) usa los MISMOS valores que
 *     `constants/colors.ts`. Es la incoherencia que ya mordió: dos capas con
 *     los mismos nombres y distintos colores.
 *  2. Los tokens no se duplican entre familias con nombres distintos.
 *  3. La escala de sombras es monótona: el nombre dice la intensidad.
 *
 * Si añades un token, añade aquí su comprobación.
 */
import fs from 'fs';
import path from 'path';

import brand, { Colors } from '@/constants/colors';
import { radii, shadows } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';

const cssPath = path.join(__dirname, '..', 'global.css');
const css = fs.readFileSync(cssPath, 'utf8');

/** `#fff` y `#ffffff` son el mismo color; el test no debe opinar de la forma. */
function normalizeHex(value: string): string {
  const v = value.trim().toLowerCase();
  return /^#[0-9a-f]{3}$/.test(v)
    ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
    : v;
}

/** Lee `--nombre: valor;` del primer bloque (`:root`, tema claro) o del oscuro. */
function cssVar(name: string, theme: 'light' | 'dark'): string {
  const block =
    theme === 'light'
      ? css.slice(0, css.indexOf(":root[data-theme='dark']"))
      : css.slice(css.indexOf(":root[data-theme='dark']"));
  const match = block.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`No existe --${name} en global.css (${theme})`);
  return normalizeHex(match[1]);
}

describe('global.css deriva de constants/colors.ts', () => {
  // El nombre de la variable es de HeroUI; el valor es nuestro. Ver la
  // cabecera de `global.css`.
  const mapping: [string, string][] = [
    ['accent', brand.primary],
    ['danger', brand.accent],
    ['success', brand.green],
    ['warning', brand.yellow],
    ['border', brand.border],
    ['focus', brand.primary],
    ['link', brand.primary],
    ['background', Colors.light.background],
    ['foreground', Colors.light.text],
    ['surface', Colors.light.card],
  ];

  it.each(mapping)('--%s vale lo que dice el token de marca', (name, value) => {
    expect(cssVar(name, 'light')).toBe(normalizeHex(value));
  });

  const darkMapping: [string, string][] = [
    ['background', Colors.dark.background],
    ['foreground', Colors.dark.text],
    ['surface', Colors.dark.background],
    ['muted', Colors.dark.icon],
    ['focus', brand.secondary],
    ['link', brand.secondary],
  ];

  it.each(darkMapping)('modo oscuro: --%s cuadra', (name, value) => {
    expect(cssVar(name, 'dark')).toBe(normalizeHex(value));
  });
});

describe('la paleta de marca no se pisa a sí misma', () => {
  it('no hay dos tokens de marca con el mismo hex y distinto nombre', () => {
    // `background` y `white` comparten `#ffffff` a propósito: uno es rol de
    // superficie y el otro es el color puro.
    const exempt = new Set(['background', 'white']);
    const seen = new Map<string, string>();
    for (const [name, value] of Object.entries(brand)) {
      if (exempt.has(name)) continue;
      const hex = normalizeHex(String(value));
      expect(seen.has(hex)).toBe(false);
      seen.set(hex, name);
    }
  });

  it('los nombres de marca son cromáticos, no de estado', () => {
    // Un token de marca que se llame como un estado vuelve a abrir la trampa
    // de `success`/`warning`/`danger`: se acaba usando por su nombre y pintando
    // lo que no es. El estado vive en ToastColors/SwipeColors.
    for (const forbidden of ['success', 'warning', 'danger', 'error']) {
      expect(Object.keys(brand)).not.toContain(forbidden);
    }
  });
});

describe('escalas ordenadas', () => {
  it('spacing es estrictamente creciente', () => {
    const values = [spacing.xs, spacing.sm, spacing.md, spacing.lg, spacing.xl];
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(new Set(values).size).toBe(values.length);
  });

  it('radii es estrictamente creciente', () => {
    const values = [
      radii.xs,
      radii.sm,
      radii.md,
      radii.lg,
      radii.xl,
      radii.full,
      radii.pillFull,
    ];
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(new Set(values).size).toBe(values.length);
  });

  it('el nombre de la sombra dice su intensidad', () => {
    // `shadows.lg` (0.3) era MÁS fuerte que `shadows.xl` (0.18): quien pedía
    // "la más marcada" se equivocaba de token. Ahora las sombras se llaman por
    // su función y este test impide que el orden se vuelva a romper.
    const elevation = (s: unknown) =>
      (s as { elevation?: number }).elevation ?? 0;
    const ladder = [
      shadows.card,
      shadows.raised,
      shadows.hero,
      shadows.overlay,
    ];
    const values = ladder.map(elevation);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });
});

/**
 * Contraste mínimo de los roles de texto.
 *
 * Esto no es celo normativo: el gris terciario estaba en 2,9:1 sobre el gris de
 * los campos y en 2,2:1 en la leyenda del cantoral —la pantalla más usada de la
 * app— y ahí es donde la gente lee, a menudo a contraluz. `design.md` §1 pone
 * la legibilidad la primera y dice que no se sacrifica; esto lo hace cumplir.
 *
 * Ojo con "arreglar" un par claro/oscuro comparando sus dos hex entre sí: son
 * deliberadamente distintos porque cada uno se mide contra SU fondo. Lo que
 * importa es la razón de contraste, que es lo que comprueba este test.
 */
function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );
  return (hi + 0.05) / (lo + 0.05);
}

describe('contraste de los roles de texto', () => {
  // 4.5:1 es el mínimo de texto normal. Los roles de texto se miden contra las
  // superficies sobre las que se pintan de verdad.
  const cases: [string, string, string][] = [
    ['claro · text sobre fondo', Colors.light.text, Colors.light.background],
    [
      'claro · textStrong sobre fondo',
      Colors.light.textStrong,
      Colors.light.background,
    ],
    [
      'claro · textSecondary sobre fondo',
      Colors.light.textSecondary,
      Colors.light.background,
    ],
    [
      'claro · textMuted sobre fondo',
      Colors.light.textMuted,
      Colors.light.background,
    ],
    [
      'claro · textMuted sobre hundido',
      Colors.light.textMuted,
      Colors.light.backgroundSunken,
    ],
    ['claro · textMuted sobre card', Colors.light.textMuted, Colors.light.card],
    ['claro · link sobre fondo', Colors.light.link, Colors.light.background],
    ['oscuro · text sobre fondo', Colors.dark.text, Colors.dark.background],
    [
      'oscuro · textStrong sobre fondo',
      Colors.dark.textStrong,
      Colors.dark.background,
    ],
    [
      'oscuro · textSecondary sobre fondo',
      Colors.dark.textSecondary,
      Colors.dark.background,
    ],
    [
      'oscuro · textMuted sobre hundido',
      Colors.dark.textMuted,
      Colors.dark.backgroundSunken,
    ],
    ['oscuro · link sobre fondo', Colors.dark.link, Colors.dark.background],
  ];

  it.each(cases)('%s llega a 4.5:1', (_label, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('el terciario oscuro sobre el fondo queda por encima de 4:1', () => {
    // 4,27:1 — la leyenda del cantoral en modo oscuro, que se pinta sobre el
    // fondo. Por debajo de 4,5 por poco, y muy por encima del 2,2 que tenía.
    // Subirlo más lo convertiría en un secundario y perdería el papel de
    // "leyenda tenue".
    expect(
      contrast(Colors.dark.textMuted, Colors.dark.background),
    ).toBeGreaterThan(4);
  });

  it('avisa de que el terciario NO vale sobre una card oscura', () => {
    // 3,48:1. Hoy no pasa nada porque en oscuro las cards se pintan con el
    // color de FONDO (ver PLAN_DISENO §H8): si algún día se les da su color
    // propio (#3A3A3C), este texto se queda corto y hay que subirlo a
    // `textSecondary`. Este test está aquí para que eso salte entonces, no
    // para que alguien lo "arregle" ahora.
    expect(contrast(Colors.dark.textMuted, Colors.dark.card)).toBeLessThan(4.5);
  });
});
