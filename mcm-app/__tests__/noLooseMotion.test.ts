/**
 * Trinquete de movimiento: muelles y duraciones escritos a mano.
 *
 * `constants/animations.ts` define `durations`, `reaEasings`, `motionEasings`
 * y `springs`, y `design.md` §6 pide usarlos ("bouncy solo para celebración").
 * Igual que con los colores (`noNewMagicNumbers.test.ts`), un documento no
 * frena a nadie; este test sí. Hay deuda de partida, así que en vez de
 * prohibir de golpe pone un TOPE que solo puede bajar.
 *
 * El motivo de que exista: los muelles a mano (`stiffness`/`damping`) con
 * ζ≈0,5 se colaron en el toast, la barra de subrayado o el reproductor
 * flotante —UI funcional que botaba como una celebración— precisamente porque
 * cada uno era un literal que nadie comparaba con nada.
 *
 * Si esto te ha salido en rojo:
 *
 *   · Has AÑADIDO un `withSpring` sin token → pásale `springs.settle` (sin
 *     rebote, el de casi todo), `springs.snap` (tras un gesto; añade
 *     `velocity`) o `springs.sheet`. Si de verdad necesitas otro, escríbelo en
 *     la forma de Apple (`{ duration: MI_MS, dampingRatio }`, con la duración
 *     en una constante con nombre), que también cuenta como bueno — pero
 *     piénsalo dos veces.
 *   · Has AÑADIDO un `Animated.spring` de core → no hay token de muelle para
 *     core: usa `Animated.timing` con `durations.*` y `easings.*` (p.ej.
 *     `easings.sheet`), como la apertura de BottomSheet o la entrada de
 *     OTAUpdatingOverlay.
 *   · Has AÑADIDO un `duration: <número>` → usa `durations.quick/base/slow/
 *     hero`. Si ninguno encaja (un bucle de respiración de 4 s, por ejemplo),
 *     sácalo a una constante con nombre en tu fichero: `duration: BREATH_MS`
 *     no cuenta, porque ya dice qué es.
 *   · Has QUITADO alguno → gracias: baja el tope al número que diga el error,
 *     en el mismo commit.
 *
 * **No subas un tope por código tuyo.** La única excepción es un MERGE de
 * varias ramas que tocaban animaciones a la vez (como el pulido de octubre de
 * 2026: web, Home/notificaciones, calendario/fotos, hoja…): ahí el número
 * real puede quedar por DEBAJO del tope por más del margen. Entonces se pone
 * el tope al valor que diga el error y se cuenta en el commit del merge. Si
 * tras el merge queda por ENCIMA, alguna rama añadió literales: se arreglan,
 * no se sube el tope.
 *
 * Fuera del recuento, a propósito:
 *   · `constants/` (los tokens se definen ahí; ni siquiera se recorre).
 *   · Carismochito (decisión del usuario: easter egg festivo, rebota a
 *     propósito) y `components/preview-channel/` (el laboratorio de testers,
 *     con su palanca gigante y su muelle propio).
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const DIRS = ['app', 'components', 'hooks', 'contexts'];

function isExcluded(rel: string): boolean {
  return (
    /carismochito/i.test(rel) || rel.includes(`preview-channel${path.sep}`)
  );
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function sources(): { rel: string; src: string }[] {
  const out: { rel: string; src: string }[] = [];
  for (const dir of DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
      const rel = path.relative(ROOT, file);
      if (isExcluded(rel)) continue;
      out.push({ rel, src: fs.readFileSync(file, 'utf8') });
    }
  }
  return out;
}

/**
 * Texto de los argumentos de la llamada que empieza en `open` (el índice del
 * paréntesis de apertura), contando paréntesis anidados.
 */
function callArgs(src: string, open: number): string {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return src.slice(open + 1, i);
    }
  }
  return src.slice(open + 1);
}

/**
 * Muelles sin token en un fuente:
 *   · `withSpring(...)` cuyos argumentos no mencionan `springs.` ni llevan
 *     `dampingRatio` (incluye el `withSpring(x)` pelado, que usa el muelle
 *     por defecto de Reanimated, con rebote).
 *   · Cualquier `Animated.spring(` de core: no hay token para él.
 */
function countLooseSprings(src: string): number {
  let n = 0;
  for (const m of src.matchAll(/\bwithSpring\(/g)) {
    const args = callArgs(src, m.index! + m[0].length - 1);
    if (!/\bsprings\./.test(args) && !/\bdampingRatio\b/.test(args)) n++;
  }
  n += [...src.matchAll(/\bAnimated\.spring\(/g)].length;
  return n;
}

const LOOSE_DURATION = /\bduration: *\d+/g;

function countLooseDurations(src: string): number {
  return [...src.matchAll(LOOSE_DURATION)].length;
}

/**
 * Topes actuales (2026-10-17, rama del pulido de animación). Bajar SIEMPRE
 * que se migre algo; no subir nunca (ver arriba la excepción de los merges).
 */
const SPRING_BUDGET = 5;
const DURATION_BUDGET = 58;
/**
 * Cuánto puede quedar el recuento por debajo del tope sin obligar a bajarlo.
 * Más corto que en los colores porque aquí los números son pequeños.
 */
const SPRING_SLACK = 2;
const DURATION_SLACK = 10;

function report(counter: (src: string) => number): {
  total: number;
  worst: string;
} {
  const byFile: [string, number][] = [];
  let total = 0;
  for (const { rel, src } of sources()) {
    const hits = counter(src);
    if (hits > 0) {
      total += hits;
      byFile.push([rel, hits]);
    }
  }
  byFile.sort((a, b) => b[1] - a[1]);
  const worst = byFile
    .slice(0, 8)
    .map(([f, k]) => `  ${f}: ${k}`)
    .join('\n');
  return { total, worst };
}

describe('el contador de muelles distingue token de literal', () => {
  it('cuenta los muelles a mano y el de por defecto', () => {
    expect(
      countLooseSprings('withSpring(1, { stiffness: 90, damping: 11 })'),
    ).toBe(1);
    expect(countLooseSprings('x.set(withSpring(0));')).toBe(1);
    expect(countLooseSprings('Animated.spring(v, { tension: 120 })')).toBe(1);
  });

  it('no cuenta los muelles con token ni los de forma de Apple', () => {
    expect(countLooseSprings('withSpring(1, springs.settle)')).toBe(0);
    expect(
      countLooseSprings('withSpring(0, { ...springs.snap, velocity: v })'),
    ).toBe(0);
    expect(
      countLooseSprings('withSpring(1, { duration: 300, dampingRatio: 1 })'),
    ).toBe(0);
  });

  it('lee los argumentos aunque vayan en varias líneas o anidados', () => {
    const src = `
      t.set(
        withSpring(interpolate(a, [0, 1], [2, 3]), {
          stiffness: 60,
          damping: 10,
        }),
      );
      u.set(withSpring(f(g(1)), springs.settle));
    `;
    expect(countLooseSprings(src)).toBe(1);
  });
});

describe('no se añade movimiento a mano', () => {
  it('muelles: no crecen los que van sin token de springs.*', () => {
    const { total, worst } = report(countLooseSprings);
    if (total > SPRING_BUDGET) {
      throw new Error(
        `${total} muelles sin token y el tope es ${SPRING_BUDGET}.\n` +
          `Usa springs.settle / springs.snap / springs.sheet de ` +
          `constants/animations.ts (y en Animated de core, Animated.timing ` +
          `con easings.*).\nLos ficheros con más:\n${worst}`,
      );
    }
    if (SPRING_BUDGET - total > SPRING_SLACK) {
      throw new Error(
        `Hay ${total} muelles sin token y el tope sigue en ` +
          `${SPRING_BUDGET}: baja SPRING_BUDGET a ${total} en este commit.`,
      );
    }
  });

  it('duraciones: no crecen los `duration: <número>`', () => {
    const { total, worst } = report(countLooseDurations);
    if (total > DURATION_BUDGET) {
      throw new Error(
        `${total} duraciones a mano y el tope es ${DURATION_BUDGET}.\n` +
          `Usa durations.quick/base/slow/hero de constants/animations.ts, o ` +
          `una constante con nombre si ninguna encaja.\n` +
          `Los ficheros con más:\n${worst}`,
      );
    }
    if (DURATION_BUDGET - total > DURATION_SLACK) {
      throw new Error(
        `Hay ${total} duraciones a mano y el tope sigue en ` +
          `${DURATION_BUDGET}: baja DURATION_BUDGET a ${total} en este commit.`,
      );
    }
  });
});
