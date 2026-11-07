/**
 * Lógica pura de la barra de pestañas flotante:
 * - `splitTabsForBar`: qué tabs caben en la barra y cuáles caen a MasHome.
 * - `selectedIndexFor`: qué tab se marca según la ruta actual.
 *
 * Se testea aquí porque son las dos piezas que deciden qué ve el usuario en la
 * barra y no se pueden comprobar sin dispositivo de otra forma.
 */
import {
  TABS_CONFIG,
  MAX_TAB_BAR_ITEMS,
  splitTabsForBar,
} from '@/constants/tabsCatalog';
import { hrefForTab, selectedIndexFor } from '@/utils/tabRoutes';

const allNames = TABS_CONFIG.map((tab) => tab.name);

describe('splitTabsForBar', () => {
  it('no recorta nada si caben todos', () => {
    const visible = new Set(allNames.slice(0, MAX_TAB_BAR_ITEMS));
    const { mainTabs, overflowTabs } = splitTabsForBar(visible);

    expect(mainTabs).toHaveLength(MAX_TAB_BAR_ITEMS);
    expect(overflowTabs).toEqual([]);
  });

  it('respeta el orden de TABS_CONFIG, no el del perfil', () => {
    const visible = new Set(['mas', 'index', 'cancionero']);
    const { mainTabs } = splitTabsForBar(visible);

    expect(mainTabs.map((tab) => tab.name)).toEqual([
      'index',
      'cancionero',
      'mas',
    ]);
  });

  it('deja "mas" siempre el último de la barra y manda el resto a overflow', () => {
    const { mainTabs, overflowTabs } = splitTabsForBar(new Set(allNames));

    expect(mainTabs).toHaveLength(MAX_TAB_BAR_ITEMS);
    expect(mainTabs[mainTabs.length - 1].name).toBe('mas');
    expect(overflowTabs.length).toBe(allNames.length - MAX_TAB_BAR_ITEMS);
    expect(overflowTabs.map((tab) => tab.name)).not.toContain('mas');
  });

  it('sin "mas" visible recorta sin más', () => {
    const visible = new Set(allNames.filter((name) => name !== 'mas'));
    const { mainTabs, overflowTabs } = splitTabsForBar(visible);

    expect(mainTabs).toHaveLength(MAX_TAB_BAR_ITEMS);
    expect(overflowTabs).toHaveLength(visible.size - MAX_TAB_BAR_ITEMS);
  });
});

describe('hrefForTab', () => {
  it('mapea index a la raíz del grupo', () => {
    expect(hrefForTab('index')).toBe('/');
    expect(hrefForTab('cancionero')).toBe('/cancionero');
  });
});

describe('selectedIndexFor', () => {
  const { mainTabs } = splitTabsForBar(new Set(allNames));
  const indexOf = (name: string) =>
    mainTabs.findIndex((tab) => tab.name === name);

  it('marca el tab de la ruta exacta', () => {
    expect(selectedIndexFor(mainTabs, '/')).toBe(indexOf('index'));
    expect(selectedIndexFor(mainTabs, '/cancionero')).toBe(
      indexOf('cancionero'),
    );
  });

  it('marca el tab también en rutas anidadas', () => {
    expect(selectedIndexFor(mainTabs, '/contigo/evangelio')).toBe(
      indexOf('contigo'),
    );
  });

  it('no confunde la raíz con cualquier otra ruta', () => {
    expect(selectedIndexFor(mainTabs, '/cancionero/detalle')).not.toBe(
      indexOf('index'),
    );
  });

  it('cae en "Más" cuando la ruta es un tab que no está en la barra', () => {
    const overflowName = splitTabsForBar(new Set(allNames)).overflowTabs[0]
      ?.name;
    expect(overflowName).toBeDefined();
    expect(selectedIndexFor(mainTabs, `/${overflowName}`)).toBe(indexOf('mas'));
  });
});
