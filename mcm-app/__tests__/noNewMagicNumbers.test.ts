/**
 * Trinquete de números mágicos: colores y tamaños de letra escritos a mano.
 *
 * `design.md` dice que los colores salen de `constants/colors.ts` y que no se
 * escriben hex en componentes. Un documento no impide que nadie lo haga; este
 * test sí — y como hay una deuda de partida que no se salda en un día, en vez
 * de prohibirlos de golpe pone un TOPE que solo puede bajar.
 *
 * Si esto te ha salido en rojo:
 *
 *   · Has AÑADIDO un color a mano → no lo hagas. Añádelo a
 *     `constants/colors.ts` con nombre semántico, o usa `themeColors(isDark)`
 *     si lo que quieres es un par claro/oscuro (que es lo que suele ser).
 *   · Has AÑADIDO un `fontSize` a mano → usa `typography.*`. La escala cubre
 *     de 10 a 34; si tu tamaño no está, es que estás inventando un nivel.
 *   · Has AÑADIDO un `borderRadius` a mano → usa `radii.*`. Si dudas entre dos
 *     escalones, da igual cuál: coge el de la tabla de `design.md` §5.
 *   · Has QUITADO alguno → gracias: baja el número de abajo al que diga el
 *     error, en el mismo commit.
 *
 * Nunca subas los topes. Ese es el trato entero.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');

/**
 * Blanco y negro puros. Escribir `'#fff'` es tan claro como `colors.white` y
 * no induce a error, así que no cuentan.
 */
const ALLOWED = new Set(['#fff', '#ffffff', '#000', '#000000']);

const COLOR_LITERAL = /'(#[0-9a-fA-F]{3,8})'/g;

/**
 * Ficheros que DEFINEN tokens. Ahí el hex es el sitio correcto: son la fuente.
 * `constants/` entero queda fuera por no estar en los directorios que se miran.
 */
const TOKEN_FILES = new Set(['components/contigo/theme.ts']);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function countIn(relDir: string): {
  total: number;
  byFile: [string, number][];
} {
  const byFile: [string, number][] = [];
  let total = 0;
  for (const file of walk(path.join(ROOT, relDir))) {
    const rel = path.relative(ROOT, file);
    if (TOKEN_FILES.has(rel)) continue;
    const src = fs.readFileSync(file, 'utf8');
    const hits = [...src.matchAll(COLOR_LITERAL)].filter(
      (m) => !ALLOWED.has(m[1].toLowerCase()),
    ).length;
    if (hits > 0) {
      total += hits;
      byFile.push([rel, hits]);
    }
  }
  byFile.sort((a, b) => b[1] - a[1]);
  return { total, byFile };
}

/**
 * Tope actual. Bajar SIEMPRE que se migre algo; no subir nunca.
 *
 * Histórico: 1.363 hex en total antes de la unificación de agosto de 2026.
 */
const BUDGET = {
  app: 231,
  components: 436,
};

describe('no se añaden colores a mano', () => {
  it.each(Object.entries(BUDGET))(
    '%s se mantiene en su tope o por debajo',
    (dir, budget) => {
      const { total, byFile } = countIn(dir);
      if (total > budget) {
        const worst = byFile
          .slice(0, 5)
          .map(([f, n]) => `  ${f}: ${n}`)
          .join('\n');
        throw new Error(
          `${dir}/ tiene ${total} colores a mano y el tope es ${budget}.\n` +
            `Usa un token de constants/colors.ts (o themeColors(isDark) si es ` +
            `un par claro/oscuro).\nLos ficheros con más:\n${worst}`,
        );
      }
      // Si has migrado de más, baja el tope en este mismo commit: un tope que
      // se queda muy por encima de la realidad deja de proteger nada.
      expect(total).toBeGreaterThan(budget - 25);
    },
  );

  it('components/ui/ no gana colores nuevos: es lo que todo lo demás copia', () => {
    // Estos componentes son agnósticos de paleta por contrato (reciben el color
    // por prop). Lo que queda son paletas locales con nombre —el confeti de
    // `CelebrationBurst`, los tramos de `ProgressRing`— no colores de UI.
    const { total } = countIn('components/ui');
    expect(total).toBeLessThanOrEqual(36);
  });
});

/**
 * Tope de `fontSize` escritos a mano.
 *
 * Histórico: 666 antes de ampliar la escala en agosto de 2026 → 321. La escala
 * vieja solo declaraba siete tamaños y los más usados del repo (12, 14, 11, 17,
 * 18) no estaban: un token que no cubre tu caso no se usa, se rodea.
 *
 * Lo que queda son sobre todo tamaños con peso propio declarado al lado, que
 * hay que migrar uno a uno porque ahí el spread sí puede cambiar el render.
 */
const FONT_SIZE_BUDGET = {
  app: 93,
  components: 228,
};

const INLINE_FONT_SIZE = /fontSize: \d+/g;

describe('no se añaden tamaños de letra a mano', () => {
  it.each(Object.entries(FONT_SIZE_BUDGET))(
    '%s se mantiene en su tope o por debajo',
    (dir, budget) => {
      let total = 0;
      const byFile: [string, number][] = [];
      for (const file of walk(path.join(ROOT, dir))) {
        const hits = [
          ...fs.readFileSync(file, 'utf8').matchAll(INLINE_FONT_SIZE),
        ].length;
        if (hits > 0) {
          total += hits;
          byFile.push([path.relative(ROOT, file), hits]);
        }
      }
      if (total > budget) {
        byFile.sort((a, b) => b[1] - a[1]);
        const worst = byFile
          .slice(0, 5)
          .map(([f, n]) => `  ${f}: ${n}`)
          .join('\n');
        throw new Error(
          `${dir}/ tiene ${total} fontSize a mano y el tope es ${budget}.\n` +
            `Usa typography.* (h0/h1/h2/h3/title/body/button/subhead/caption/` +
            `footnote/micro/overline).\nLos ficheros con más:\n${worst}`,
        );
      }
      expect(total).toBeGreaterThan(budget - 25);
    },
  );
});

/**
 * Tope de `borderRadius` escritos a mano.
 *
 * Histórico: 300 antes de colapsar la escala en agosto de 2026 → 122. Lo que
 * queda son valores que NO están en la escala (10, 3, 6, 100, 5, 2, 13, 26…) y
 * que hay que mirar uno a uno: unos son decorativos de un sitio concreto y
 * otros son un escalón inventado que debería caer al de al lado.
 */
const RADIUS_BUDGET = {
  app: 17,
  components: 105,
};

const INLINE_RADIUS = /borderRadius: \d+/g;

describe('no se añaden radios a mano', () => {
  it.each(Object.entries(RADIUS_BUDGET))(
    '%s se mantiene en su tope o por debajo',
    (dir, budget) => {
      let total = 0;
      for (const file of walk(path.join(ROOT, dir))) {
        total += [...fs.readFileSync(file, 'utf8').matchAll(INLINE_RADIUS)]
          .length;
      }
      expect(total).toBeLessThanOrEqual(budget);
      expect(total).toBeGreaterThan(budget - 25);
    },
  );
});
