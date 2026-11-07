/**
 * `splitTabsForBar` — el reparto barra/overflow del que depende TODA la
 * navegación a tabs. No tenía tests propios y es la premisa de
 * `utils/tabNavigation.ts`.
 */
import {
  MAX_TAB_BAR_ITEMS,
  TABS_CONFIG,
  splitTabsForBar,
} from '@/constants/tabsCatalog';

const ALL_NAMES = TABS_CONFIG.map((t) => t.name);
const names = (tabs: { name: string }[]) => tabs.map((t) => t.name);

function subsets(list: string[]): Set<string>[] {
  const out: Set<string>[] = [];
  for (let mask = 0; mask < 1 << list.length; mask++) {
    const set = new Set<string>();
    list.forEach((n, i) => {
      if (mask & (1 << i)) set.add(n);
    });
    out.push(set);
  }
  return out;
}
const ALL_SUBSETS = subsets(ALL_NAMES);

describe('reparto', () => {
  it('sin overflow si caben todos', () => {
    const visible = new Set(ALL_NAMES.slice(0, MAX_TAB_BAR_ITEMS));
    const { mainTabs, overflowTabs } = splitTabsForBar(visible);
    expect(overflowTabs).toEqual([]);
    expect(mainTabs).toHaveLength(MAX_TAB_BAR_ITEMS);
  });

  it('con overflow, "Más" va SIEMPRE el último de la barra', () => {
    const { mainTabs } = splitTabsForBar(new Set(ALL_NAMES));
    expect(names(mainTabs).at(-1)).toBe('mas');
  });

  it('el orden lo manda TABS_CONFIG, no el orden del perfil', () => {
    const alReves = new Set([...ALL_NAMES].reverse());
    expect(names(splitTabsForBar(alReves).mainTabs)).toEqual(
      names(splitTabsForBar(new Set(ALL_NAMES)).mainTabs),
    );
  });

  it('ignora nombres que no están en TABS_CONFIG', () => {
    const conBasura = new Set([...ALL_NAMES, 'inventado', 'otro']);
    const { mainTabs, overflowTabs } = splitTabsForBar(conBasura);
    for (const name of [...names(mainTabs), ...names(overflowTabs)]) {
      expect(ALL_NAMES).toContain(name);
    }
  });

  it('perfil vacío → nada, sin reventar', () => {
    expect(splitTabsForBar(new Set())).toEqual({
      mainTabs: [],
      overflowTabs: [],
    });
  });
});

describe('invariantes sobre los 256 perfiles posibles', () => {
  it('barra + overflow = exactamente los tabs visibles, sin repetir ni perder', () => {
    for (const visible of ALL_SUBSETS) {
      const { mainTabs, overflowTabs } = splitTabsForBar(visible);
      const juntos = [...names(mainTabs), ...names(overflowTabs)];
      expect(new Set(juntos).size).toBe(juntos.length); // sin duplicados
      // Con "mas" en el perfil no se pierde ninguno. Sin "mas" y con overflow,
      // splitTabsForBar recorta a propósito (no hay dónde enseñarlos).
      if (visible.has('mas') || visible.size <= MAX_TAB_BAR_ITEMS) {
        expect(new Set(juntos)).toEqual(
          new Set(ALL_NAMES.filter((n) => visible.has(n))),
        );
      }
    }
  });

  it('la barra nunca excede el tope', () => {
    for (const visible of ALL_SUBSETS) {
      expect(splitTabsForBar(visible).mainTabs.length).toBeLessThanOrEqual(
        MAX_TAB_BAR_ITEMS,
      );
    }
  });

  it('"mas" nunca cae en overflow', () => {
    for (const visible of ALL_SUBSETS) {
      expect(names(splitTabsForBar(visible).overflowTabs)).not.toContain('mas');
    }
  });

  it('si hay overflow, la barra está llena (no se desperdicia hueco)', () => {
    for (const visible of ALL_SUBSETS) {
      const { mainTabs, overflowTabs } = splitTabsForBar(visible);
      if (overflowTabs.length > 0) {
        expect(mainTabs).toHaveLength(MAX_TAB_BAR_ITEMS);
      }
    }
  });

  it('es estable: dos llamadas con el mismo perfil dan lo mismo', () => {
    for (const visible of ALL_SUBSETS) {
      expect(names(splitTabsForBar(visible).mainTabs)).toEqual(
        names(splitTabsForBar(new Set(visible)).mainTabs),
      );
    }
  });

  it('los tabs de la barra son siempre un prefijo del orden de TABS_CONFIG (+ "mas")', () => {
    for (const visible of ALL_SUBSETS) {
      if (!visible.has('mas')) continue;
      const { mainTabs } = splitTabsForBar(visible);
      const sinMas = names(mainTabs).filter((n) => n !== 'mas');
      const esperados = ALL_NAMES.filter(
        (n) => visible.has(n) && n !== 'mas',
      ).slice(0, sinMas.length);
      expect(sinMas).toEqual(esperados);
    }
  });
});
