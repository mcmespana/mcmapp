/**
 * INVARIANTES de la navegación a tabs. No casos sueltos: barridos exhaustivos.
 *
 * La navegación de la Home falló porque dependía de una combinación —perfil ×
 * plataforma × hay evento o no— que nadie había recorrido entera. Aquí se
 * recorre entera: los 2^N subconjuntos de `TABS_CONFIG` en las tres
 * plataformas, comprobando que **ningún destino alcanzable se queda sin
 * camino**.
 *
 * Y se atan las dos listas que tienen que cuadrar con la realidad:
 *   - todo espejo de `MAS_STACK_MIRROR` debe estar registrado en `mas.tsx`;
 *   - todo tab que PUEDA caer en overflow debe tener espejo (si no, en iOS es
 *     inalcanzable).
 */
import fs from 'fs';
import path from 'path';

import {
  MAS_EVENT_HUB_SCREEN,
  MAS_STACK_MIRROR,
  resolveEventScreenRoute,
  resolveTabRoute,
} from '@/utils/tabNavigation';
import type { TabRoute } from '@/utils/tabNavigation';
import {
  MAX_TAB_BAR_ITEMS,
  TABS_CONFIG,
  splitTabsForBar,
} from '@/constants/tabsCatalog';

const PLATFORMS = ['ios', 'android', 'web'] as const;
const ALL_NAMES = TABS_CONFIG.map((t) => t.name);
const EVENT = { tabName: 'visitapapa', eventId: 'visitapapa' };

/** Todos los subconjuntos de `names` (2^n). Con 8 tabs son 256. */
function subsets(names: string[]): Set<string>[] {
  const out: Set<string>[] = [];
  for (let mask = 0; mask < 1 << names.length; mask++) {
    const set = new Set<string>();
    names.forEach((name, i) => {
      if (mask & (1 << i)) set.add(name);
    });
    out.push(set);
  }
  return out;
}

const ALL_SUBSETS = subsets(ALL_NAMES);

/** Fuente de `mas.tsx`, para comprobar qué pantallas registra de verdad. */
const MAS_SOURCE = fs.readFileSync(
  path.join(__dirname, '..', 'app', '(tabs)', 'mas.tsx'),
  'utf8',
);
const EVENT_SCREENS_SOURCE = fs.readFileSync(
  path.join(__dirname, '..', 'app', 'screens', 'eventStackScreens.tsx'),
  'utf8',
);

/** ¿`mas.tsx` registra esa pantalla (directamente o vía renderEventScreens)? */
function masStackRegisters(screen: string): boolean {
  if (MAS_SOURCE.includes(`name="${screen}"`)) return true;
  return (
    MAS_SOURCE.includes('renderEventScreens') &&
    EVENT_SCREENS_SOURCE.includes(`name="${screen}"`)
  );
}

describe('las dos listas cuadran con el código real', () => {
  it('cada espejo de MAS_STACK_MIRROR está registrado en el stack de "Más"', () => {
    for (const screen of Object.values(MAS_STACK_MIRROR)) {
      expect({ screen, registrado: masStackRegisters(screen) }).toEqual({
        screen,
        registrado: true,
      });
    }
  });

  it('el hub de evento está registrado en el stack de "Más"', () => {
    expect(masStackRegisters(MAS_EVENT_HUB_SCREEN)).toBe(true);
  });

  it('cada espejo apunta a un tab que existe en TABS_CONFIG', () => {
    for (const tabName of Object.keys(MAS_STACK_MIRROR)) {
      expect(ALL_NAMES).toContain(tabName);
    }
  });

  it('TODO tab que pueda caer en overflow tiene espejo (o es el del evento)', () => {
    // Es LA invariante: en iOS un tab de overflow no tiene ruta, así que sin
    // espejo queda inalcanzable. Se comprueba sobre los 256 perfiles posibles.
    const sinEspejo = new Set<string>();
    for (const visible of ALL_SUBSETS) {
      for (const tab of splitTabsForBar(visible).overflowTabs) {
        const tieneEspejo =
          MAS_STACK_MIRROR[tab.name] !== undefined ||
          tab.name === EVENT.tabName;
        if (!tieneEspejo) sinEspejo.add(tab.name);
      }
    }
    expect([...sinEspejo]).toEqual([]);
  });
});

describe('barrido exhaustivo: 256 perfiles × 3 plataformas', () => {
  /** Un destino es alcanzable si el camino que devuelve existe de verdad. */
  function esAlcanzable(
    route: TabRoute,
    visible: Set<string>,
    platform: string,
  ): boolean {
    const { mainTabs } = splitTabsForBar(visible);
    const tieneRuta = (name: string) =>
      platform === 'ios'
        ? mainTabs.some((t) => t.name === name)
        : visible.has(name);

    if (route.via === 'tab') return tieneRuta(route.path.slice(1));
    // Por "Más": "Más" tiene que tener ruta Y la pantalla estar registrada.
    if (!tieneRuta('mas')) return false;
    return route.via === 'masRoot' ? true : masStackRegisters(route.screen);
  }

  it('sin "Más" en el perfil, el resolver no inventa: siempre intento directo', () => {
    // splitTabsForBar avisa de que sin "mas" los tabs de overflow se pierden (no
    // hay dónde enseñarlos). El resolver no puede arreglar eso, pero sí no
    // empeorarlo: manda el push directo, que en Android/web sí funciona.
    for (const platform of PLATFORMS) {
      for (const visible of ALL_SUBSETS) {
        if (visible.has('mas')) continue;
        for (const tabName of visible) {
          expect(
            resolveTabRoute(tabName, visible, { platform, eventTab: EVENT }),
          ).toEqual({ via: 'tab', path: `/${tabName}` });
        }
      }
    }
  });

  it('con "Más" en el perfil, NINGÚN tab visible se queda sin camino', () => {
    const fallos: string[] = [];
    for (const platform of PLATFORMS) {
      for (const visible of ALL_SUBSETS) {
        if (!visible.has('mas')) continue;
        for (const tabName of visible) {
          if (tabName === 'index') continue;
          const route = resolveTabRoute(tabName, visible, {
            platform,
            eventTab: EVENT,
          });
          if (!esAlcanzable(route, visible, platform)) {
            fallos.push(`${platform} · ${tabName}`);
          }
        }
      }
    }
    expect(fallos).toEqual([]);
  });

  it('el resolver NUNCA manda a "Más" cuando "Más" no tiene ruta', () => {
    for (const platform of PLATFORMS) {
      for (const visible of ALL_SUBSETS) {
        const { mainTabs } = splitTabsForBar(visible);
        const masTieneRuta =
          platform === 'ios'
            ? mainTabs.some((t) => t.name === 'mas')
            : visible.has('mas');
        if (masTieneRuta) continue;
        for (const tabName of ALL_NAMES) {
          const route = resolveTabRoute(tabName, visible, {
            platform,
            eventTab: EVENT,
          });
          expect(route.via).toBe('tab');
        }
      }
    }
  });

  it('en Android y web SIEMPRE se va directo a un tab visible', () => {
    for (const platform of ['android', 'web']) {
      for (const visible of ALL_SUBSETS) {
        for (const tabName of visible) {
          expect(
            resolveTabRoute(tabName, visible, { platform, eventTab: EVENT }),
          ).toEqual({ via: 'tab', path: `/${tabName}` });
        }
      }
    }
  });

  it('en iOS se va directo exactamente a los tabs de la barra, ni uno más', () => {
    for (const visible of ALL_SUBSETS) {
      if (!visible.has('mas')) continue;
      const { mainTabs } = splitTabsForBar(visible);
      const enBarra = new Set(mainTabs.map((t) => t.name));
      for (const tabName of visible) {
        const route = resolveTabRoute(tabName, visible, {
          platform: 'ios',
          eventTab: EVENT,
        });
        expect({ tabName, directo: route.via === 'tab' }).toEqual({
          tabName,
          directo: enBarra.has(tabName),
        });
      }
    }
  });

  it('la barra nunca pasa de MAX_TAB_BAR_ITEMS (premisa del resolver)', () => {
    for (const visible of ALL_SUBSETS) {
      expect(splitTabsForBar(visible).mainTabs.length).toBeLessThanOrEqual(
        MAX_TAB_BAR_ITEMS,
      );
    }
  });
});

describe('params', () => {
  const conEvento = new Set(ALL_NAMES);

  it('viajan intactos por la vía directa', () => {
    expect(
      resolveTabRoute('cancionero', conEvento, {
        platform: 'ios',
        params: { q: 'gloria' },
      }),
    ).toEqual({ via: 'tab', path: '/cancionero', params: { q: 'gloria' } });
  });

  it('viajan intactos por la vía de "Más"', () => {
    expect(
      resolveTabRoute('calendario', conEvento, {
        platform: 'ios',
        params: { date: '2026-12-25' },
      }),
    ).toEqual({
      via: 'masScreen',
      screen: 'Calendario',
      params: { date: '2026-12-25' },
    });
  });

  it('sin params no se inventa la clave (evita re-renders y rutas raras)', () => {
    const route = resolveTabRoute('calendario', conEvento, { platform: 'ios' });
    expect(Object.prototype.hasOwnProperty.call(route, 'params')).toBe(false);
  });

  it('el eventId del hub no lo pisa un params homónimo del llamante', () => {
    const tabs = new Set(ALL_NAMES.filter((n) => n !== EVENT.tabName));
    const route = resolveTabRoute(EVENT.tabName, tabs, {
      platform: 'ios',
      eventTab: EVENT,
      params: { foo: 'bar' },
    });
    expect(route).toEqual({
      via: 'masScreen',
      screen: MAS_EVENT_HUB_SCREEN,
      params: { eventId: 'visitapapa', foo: 'bar' },
    });
  });
});

describe('resolveEventScreenRoute — barrido', () => {
  it('siempre resuelve a un camino existente cuando hay "Más"', () => {
    for (const platform of PLATFORMS) {
      for (const visible of ALL_SUBSETS) {
        if (!visible.has('mas')) continue;
        const route = resolveEventScreenRoute(
          'Evaluacion',
          EVENT,
          visible,
          platform,
        );
        if (route.via === 'masScreen') {
          expect(masStackRegisters(route.screen)).toBe(true);
        } else {
          expect(route.path).toBe(`/${EVENT.tabName}`);
          expect(visible.has(EVENT.tabName)).toBe(true);
        }
      }
    }
  });

  it('la pantalla pedida se conserva tal cual al ir por "Más"', () => {
    const sinEvento = new Set(ALL_NAMES.filter((n) => n !== EVENT.tabName));
    for (const screen of ['Evaluacion', 'Reflexiones', 'Horario', 'Grupos']) {
      expect(resolveEventScreenRoute(screen, EVENT, sinEvento, 'ios')).toEqual({
        via: 'masScreen',
        screen,
      });
    }
  });
});
