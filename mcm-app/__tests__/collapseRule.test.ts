import {
  ARM_AT,
  clampOffset,
  collapseStep,
  COLLAPSE_AT,
  EXPAND_AT,
  type CollapseState,
} from '@/components/tabs/collapseRule';

/** Pantalla típica: 2000px de contenido en un viewport de 800, sin header. */
const PLAIN = { minY: 0, maxY: 1200 };
/** Pantalla con header grande: el scroll arranca en -100. */
const LARGE_HEADER = { minY: -100, maxY: 1200 };

const start = (over: Partial<CollapseState> = {}): CollapseState => ({
  anchor: 0,
  compact: false,
  interacted: true,
  ...over,
});

/** Reproduce una secuencia de offsets como si fueran fotogramas de scroll. */
function run(
  initial: CollapseState,
  bounds: { minY: number; maxY: number | null },
  offsets: number[],
): CollapseState {
  return offsets.reduce(
    (state, y) => collapseStep(state, { y, ...bounds }),
    initial,
  );
}

describe('clampOffset', () => {
  it('recorta el rebote de abajo', () => {
    expect(clampOffset({ y: 1340, ...PLAIN })).toBe(1200);
  });

  it('recorta el rebote de arriba, contando el inset del header', () => {
    expect(clampOffset({ y: -180, ...LARGE_HEADER })).toBe(-100);
  });

  it('no recorta nada si aún no se conoce el alto del contenido', () => {
    expect(clampOffset({ y: 5000, minY: 0, maxY: null })).toBe(5000);
  });

  it('no recorta cuando el contenido cabe entero en la pantalla', () => {
    // maxY negativo: no hay recorrido real, no hay nada que recortar.
    expect(clampOffset({ y: 40, minY: 0, maxY: -300 })).toBe(40);
  });
});

describe('collapseStep — compactar', () => {
  it('compacta en cuanto bajas un poco', () => {
    const next = run(start({ anchor: 400 }), PLAIN, [400 + COLLAPSE_AT + 1]);
    expect(next.compact).toBe(true);
  });

  it('no compacta con un temblor por debajo del umbral', () => {
    const next = run(start({ anchor: 400 }), PLAIN, [400 + COLLAPSE_AT - 1]);
    expect(next.compact).toBe(false);
  });
});

describe('collapseStep — expandir', () => {
  const compacted = start({ anchor: 600, compact: true });

  it('no expande con un tirón corto hacia arriba', () => {
    const next = run(compacted, PLAIN, [600 - (EXPAND_AT - 1)]);
    expect(next.compact).toBe(true);
  });

  it('expande con un tirón claro hacia arriba', () => {
    const next = run(compacted, PLAIN, [600 - (EXPAND_AT + 1)]);
    expect(next.compact).toBe(false);
  });

  it('expande siempre al llegar arriba del todo', () => {
    const next = run(compacted, PLAIN, [500, 300, 100, 0]);
    expect(next.compact).toBe(false);
  });

  it('cuenta el inset del header al decidir qué es "arriba del todo"', () => {
    const next = run(start({ anchor: -100, compact: true }), LARGE_HEADER, [
      -100 + ARM_AT,
    ]);
    expect(next.compact).toBe(false);
  });
});

describe('collapseStep — llegar al final del scroll', () => {
  it('NO expande al rebotar contra el final', () => {
    // Baja hasta el tope y sigue arrastrando: el rebote lleva el offset muy por
    // encima de maxY y luego lo devuelve. Antes eso se leía como "sube" y
    // expandía la barra justo al llegar abajo.
    const state = run(start(), PLAIN, [200, 600, 1000, 1200]);
    expect(state.compact).toBe(true);

    const bounced = run(state, PLAIN, [1280, 1340, 1310, 1240, 1200]);
    expect(bounced.compact).toBe(true);
  });

  it('tampoco expande si el rebote es más largo que el umbral de expandir', () => {
    const state = run(start(), PLAIN, [400, 900, 1200]);
    const bounced = run(state, PLAIN, [1200 + EXPAND_AT * 3, 1200]);
    expect(bounced.compact).toBe(true);
  });
});

describe('collapseStep — histéresis del ancla', () => {
  it('mide el recorrido para expandir desde el punto más bajo alcanzado', () => {
    // Bajando en varios tramos, el ancla persigue el offset; al dar la vuelta,
    // los 40px se cuentan desde ahí y no desde donde se compactó.
    const state = run(start(), PLAIN, [50, 200, 500, 800]);
    expect(state.compact).toBe(true);
    expect(state.anchor).toBe(800);

    expect(run(state, PLAIN, [800 - (EXPAND_AT - 5)]).compact).toBe(true);
    expect(run(state, PLAIN, [800 - (EXPAND_AT + 5)]).compact).toBe(false);
  });

  it('mide el recorrido para compactar desde el punto más alto alcanzado', () => {
    const state = run(
      start({ anchor: 800, compact: true }),
      PLAIN,
      [600, 400, 300],
    );
    expect(state.compact).toBe(false);
    expect(state.anchor).toBe(300);
    expect(run(state, PLAIN, [300 + COLLAPSE_AT + 1]).compact).toBe(true);
  });
});

describe('collapseStep — pantalla recién montada', () => {
  it('mantiene la barra compacta al entrar en una pantalla anidada', () => {
    // Scroller nuevo: emite su primer evento en el offset inicial y el usuario
    // todavía no ha arrastrado. La regla de "arriba = expandida" no aplica.
    const arrived: CollapseState = {
      anchor: 0,
      compact: true,
      interacted: false,
    };
    expect(run(arrived, PLAIN, [0, 0, 0]).compact).toBe(true);
    expect(run(arrived, LARGE_HEADER, [-100, -100]).compact).toBe(true);
  });

  it('vuelve a expandir arriba en cuanto el usuario arrastra de verdad', () => {
    const arrived: CollapseState = {
      anchor: 0,
      compact: true,
      interacted: false,
    };
    // `interacted` lo activa el propio `onBeginDrag` del scroller.
    const dragging = { ...arrived, interacted: true };
    expect(run(dragging, PLAIN, [0]).compact).toBe(false);
  });
});
