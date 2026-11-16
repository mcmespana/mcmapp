import { createHash } from 'crypto';

import { DEFAULT_PANUELO_CATALOG } from '@/constants/panueloCatalog';
import { PANUELO_GLYPHS } from '@/constants/panueloGlyphs';
import type { PanueloCatalog, PanueloUserState } from '@/types/panuelo';
import {
  EMPTY_PANUELO,
  MAX_PANUELO_HISTORY,
  archivePanuelo,
  autoArrange,
  buildCollection,
  buildMemoryCollection,
  changeStage,
  comunicaScarfColor,
  decideScarfStage,
  exampleViewerState,
  filterCollection,
  formatMonthYear,
  grantItem,
  hashPanueloCode,
  isTradeable,
  listMemories,
  memoryPieceCount,
  memoryToViewerState,
  mergePanuelo,
  moveItem,
  newMemories,
  normalizeCode,
  pendingAutoGrants,
  placeItem,
  redeemCode,
  rotateItem,
  sanitizeCatalog,
  sanitizeUserState,
  setPanueloColor,
  summarizePanuelo,
  toViewerState,
  unplaceItem,
} from '@/utils/panuelo';
import {
  PANUELO_TUTORIAL,
  PANUELO_TUTORIAL_VERSION,
} from '@/constants/panueloTutorial';
import { itemReach, placementDistance } from '@/utils/panueloPlacement';
import { isPanueloAvailable, parsePanueloFlag } from '@/utils/panueloGate';
import { sha256Hex } from '@/utils/sha256';

const NOW = 1_800_000_000_000;

const state = (over: Partial<PanueloUserState> = {}): PanueloUserState => ({
  ...EMPTY_PANUELO,
  ...over,
});

describe('sha256Hex', () => {
  it.each(['', 'abc', 'corazon-consolacion:CONSOLACION', 'pañuelo ñ € 😀'])(
    'da lo mismo que el de Node para %p',
    (text) => {
      expect(sha256Hex(text)).toBe(
        createHash('sha256').update(text, 'utf8').digest('hex'),
      );
    },
  );

  it('aguanta textos de más de un bloque', () => {
    const long = 'x'.repeat(200);
    expect(sha256Hex(long)).toBe(
      createHash('sha256').update(long).digest('hex'),
    );
  });
});

describe('el catálogo de muestra', () => {
  const items = Object.values(DEFAULT_PANUELO_CATALOG);

  it('no pierde ninguna pieza al sanearse: el seed está bien escrito', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const seed = require('@/firebase-seed/panuelo.json');
    expect(items).toHaveLength(Object.keys(seed.items).length);
  });

  it('tiene una pieza de cada clase', () => {
    const kinds = new Set(items.map((i) => i.kind));
    expect([...kinds].sort()).toEqual(
      ['chapa', 'cinta', 'medalla', 'parche', 'pin', 'pulsera'].sort(),
    );
  });

  it('los códigos que anuncia el Laboratorio abren su pieza', () => {
    const codes: Record<string, string> = {
      CONSOLACION: 'corazon-consolacion',
      PASCUA27: 'parche-pascua',
      CAMINO: 'vieira-camino',
      VERANO: 'cinta-campamento',
    };
    for (const [code, id] of Object.entries(codes)) {
      const result = redeemCode(DEFAULT_PANUELO_CATALOG, state(), code, NOW);
      expect(result).toMatchObject({ ok: true, already: false });
      expect(result.ok && result.item.id).toBe(id);
    }
  });

  it('da la chapa de bienvenida a todo el mundo', () => {
    const pending = pendingAutoGrants(DEFAULT_PANUELO_CATALOG, state(), NOW);
    expect(pending.map((i) => i.id)).toEqual(['pionero-alpha']);
  });

  it('solo usa formas que existen', () => {
    for (const item of items) {
      const look = item.look as { glyph?: string; shape?: string };
      for (const g of [look.glyph, look.shape]) {
        if (g) expect(PANUELO_GLYPHS).toHaveProperty(g);
      }
    }
  });
});

describe('sanitizeCatalog', () => {
  it('descarta lo que no se puede dibujar y se queda con lo demás', () => {
    const catalog = sanitizeCatalog({
      items: {
        buena: {
          kind: 'pin',
          name: 'Buena',
          look: { kind: 'pin', shape: 'heart', enamel: '#ff0000' },
        },
        'sin-nombre': {
          kind: 'pin',
          look: { kind: 'pin', shape: 'heart', enamel: '#ff0000' },
        },
        'forma-rara': {
          kind: 'pin',
          name: 'X',
          look: { kind: 'pin', shape: 'unicornio', enamel: '#ff0000' },
        },
        'color-raro': {
          kind: 'chapa',
          name: 'X',
          look: { kind: 'chapa', bg: 'red; background:url(x)' },
        },
        'ID CON ESPACIOS': {
          kind: 'cinta',
          name: 'X',
          look: { kind: 'cinta', colors: ['#fff'] },
        },
        'clase-nueva': { kind: 'gorra', name: 'X', look: {} },
      },
    });
    expect(Object.keys(catalog)).toEqual(['buena']);
  });

  it('no deja pasar una imagen que no sea https', () => {
    const make = (image: string) =>
      sanitizeCatalog({
        a: { kind: 'chapa', name: 'A', look: { bg: '#fff', image } },
      }).a.look;
    expect(make('https://cdn.example.org/a.webp')).toHaveProperty('image');
    expect(make('javascript:alert(1)')).not.toHaveProperty('image');
    expect(make('file:///etc/passwd')).not.toHaveProperty('image');
    expect(make('https://x.org/a.png"><script>')).not.toHaveProperty('image');
  });

  it('acota el tamaño y el largo de los textos', () => {
    const { a } = sanitizeCatalog({
      a: {
        kind: 'chapa',
        name: 'A',
        size: 9,
        look: { bg: '#fff', text: 'x'.repeat(100) },
      },
    });
    expect(a.size).toBe(1.5);
    expect((a.look as { text: string }).text).toHaveLength(24);
  });

  it('un hash que no es un sha256 deja la pieza sin forma de canjearse', () => {
    const { a } = sanitizeCatalog({
      a: {
        kind: 'cinta',
        name: 'A',
        look: { colors: ['#fff'] },
        grant: { type: 'code', hash: 'PASCUA27' },
      },
    });
    expect(a.grant).toBeUndefined();
  });

  it('con basura devuelve un catálogo vacío, no revienta', () => {
    for (const junk of [null, undefined, 3, 'x', [], { items: 7 }]) {
      expect(sanitizeCatalog(junk)).toEqual({});
    }
  });
});

describe('sanitizeUserState', () => {
  it('no deja llevar puesto lo que no se tiene', () => {
    const s = sanitizeUserState({
      color: 'blue',
      items: { a: { at: 5, via: 'code' } },
      layout: { a: { u: 0, v: 0.3, rot: 0 }, b: { u: 0, v: 0.3, rot: 0 } },
      layoutAt: 9,
    });
    expect(Object.keys(s.layout)).toEqual(['a']);
    expect(s.color).toBe('blue');
  });

  it('mete dentro del triángulo una posición que se sale', () => {
    const s = sanitizeUserState({
      items: { a: { at: 5 } },
      layout: { a: { u: 40, v: 7, rot: 725 } },
    });
    expect(Math.abs(s.layout.a.u)).toBeLessThanOrEqual(1);
    expect(s.layout.a.v).toBeLessThanOrEqual(0.9);
    expect(s.layout.a.rot).toBe(5);
  });

  it('un color que no existe es «sin elegir»', () => {
    expect(sanitizeUserState({ color: 'fucsia' }).color).toBeNull();
    expect(sanitizeUserState(null)).toEqual(EMPTY_PANUELO);
  });

  it('una pieza dada después de conseguirla ya no se tiene', () => {
    const s = sanitizeUserState({
      items: { a: { at: 5 }, b: { at: 50 } },
      layout: { a: { u: 0, v: 0.3 } },
      gone: { a: 10, b: 10 },
    });
    expect(Object.keys(s.items)).toEqual(['b']);
    expect(s.layout).toEqual({});
  });
});

describe('mergePanuelo', () => {
  const placement = { u: 0, v: 0.3, rot: 0 };

  it('suma las piezas de los dos lados y se queda la fecha más antigua', () => {
    const local = state({
      items: { a: { at: 10, via: 'code' }, b: { at: 30, via: 'all' } },
    });
    const remote = state({
      items: { b: { at: 20, via: 'manual' }, c: { at: 5, via: 'manual' } },
    });
    const { merged, upload } = mergePanuelo(local, remote);
    expect(Object.keys(merged.items).sort()).toEqual(['a', 'b', 'c']);
    expect(merged.items.b).toEqual({ at: 20, via: 'manual' });
    // `a` solo estaba en el móvil: hay que subirla.
    expect(upload).toBe(true);
  });

  it('la colocación y el color son del último que los tocó', () => {
    const local = state({
      color: 'green',
      items: { a: { at: 1, via: 'all' } },
      layout: { a: placement },
      layoutAt: 100,
    });
    const remote = state({
      color: 'yellow',
      items: { a: { at: 1, via: 'all' } },
      layout: {},
      layoutAt: 200,
    });
    expect(mergePanuelo(local, remote).merged).toMatchObject({
      color: 'yellow',
      layout: {},
      layoutAt: 200,
    });
    expect(mergePanuelo(remote, local).merged.color).toBe('yellow');
  });

  it('si la nube ya lo tiene todo, no hay nada que subir', () => {
    const same = state({ items: { a: { at: 1, via: 'all' } }, layoutAt: 5 });
    expect(mergePanuelo(same, same).upload).toBe(false);
  });

  it('lo dado en un intercambio no resucita al juntarse con la nube', () => {
    const local = state({ gone: { a: 50 } });
    const remote = state({
      items: { a: { at: 10, via: 'manual' } },
      layout: { a: placement },
      layoutAt: 20,
    });
    const { merged, upload } = mergePanuelo(local, remote);
    expect(merged.items).toEqual({});
    expect(merged.layout).toEqual({});
    expect(upload).toBe(true);
  });

  it('pero volver a conseguirla después sí cuenta', () => {
    const local = state({ gone: { a: 50 } });
    const remote = state({ items: { a: { at: 90, via: 'trade' } } });
    expect(mergePanuelo(local, remote).merged.items).toHaveProperty('a');
  });

  // PLAN_PANUELO_INTERCAMBIOS §1.1: Ana dio `a` en t=50 (la nube aún guarda
  // `a` de t=10) y la recupera en t=90. Quedarse con la fecha más antigua
  // (10) y luego quitar lo dado antes de 50 la hacía desaparecer.
  it('recuperar una pieza que se dio no la hace desaparecer (nube con la copia vieja)', () => {
    const local = state({
      items: { a: { at: 90, via: 'trade' } },
      layout: { a: placement },
      layoutAt: 95,
      gone: { a: 50 },
    });
    const remote = state({
      items: { a: { at: 10, via: 'manual' } },
      layoutAt: 20,
      gone: { a: 50 },
    });
    const { merged, upload } = mergePanuelo(local, remote);
    expect(merged.items.a).toEqual({ at: 90, via: 'trade' });
    expect(merged.layout).toHaveProperty('a');
    expect(upload).toBe(true);
    // Y al revés (un segundo móvil de Ana que aún guarde la copia vieja).
    const other = mergePanuelo(remote, local).merged;
    expect(other.items.a).toEqual({ at: 90, via: 'trade' });
  });

  it('recuperar una pieza que se dio no la hace desaparecer (nube sin la copia vieja)', () => {
    const local = state({
      items: { a: { at: 90, via: 'trade' } },
      gone: { a: 50 },
    });
    const remote = state({ gone: { a: 50 } });
    expect(mergePanuelo(local, remote).merged.items.a).toEqual({
      at: 90,
      via: 'trade',
    });
  });
});

describe('códigos', () => {
  const catalog: PanueloCatalog = sanitizeCatalog({
    abierta: {
      kind: 'cinta',
      name: 'Abierta',
      look: { colors: ['#fff'] },
      grant: { type: 'code', hash: hashPanueloCode('Pascua 27', 'abierta') },
    },
    caducada: {
      kind: 'cinta',
      name: 'Caducada',
      look: { colors: ['#fff'] },
      grant: {
        type: 'code',
        hash: hashPanueloCode('VIEJO', 'caducada'),
        to: NOW - 1,
      },
    },
    futura: {
      kind: 'cinta',
      name: 'Futura',
      look: { colors: ['#fff'] },
      grant: {
        type: 'code',
        hash: hashPanueloCode('PRONTO', 'futura'),
        from: NOW + 1,
      },
    },
  });

  it('da igual cómo se escriba: espacios, guiones, tildes y mayúsculas', () => {
    expect(normalizeCode(' pascua-27 ')).toBe('PASCUA27');
    expect(normalizeCode('Consolación')).toBe('CONSOLACION');
    for (const typed of ['PASCUA27', 'pascua 27', 'Pascua-27']) {
      expect(redeemCode(catalog, state(), typed, NOW)).toMatchObject({
        ok: true,
      });
    }
  });

  it('el mismo código en otra pieza no da el mismo hash', () => {
    expect(hashPanueloCode('X', 'a')).not.toBe(hashPanueloCode('X', 'b'));
  });

  it('dice por qué no vale', () => {
    const reason = (code: string) => {
      const r = redeemCode(catalog, state(), code, NOW);
      return r.ok ? 'ok' : r.reason;
    };
    expect(reason('   ')).toBe('empty');
    expect(reason('NADA')).toBe('unknown');
    expect(reason('VIEJO')).toBe('late');
    expect(reason('PRONTO')).toBe('early');
  });

  it('una pieza que ya se tiene no se vuelve a dar', () => {
    const owned = grantItem(state(), 'abierta', 'code', NOW);
    expect(redeemCode(catalog, owned, 'PASCUA27', NOW)).toMatchObject({
      ok: true,
      already: true,
    });
    expect(grantItem(owned, 'abierta', 'code', NOW + 5)).toBe(owned);
  });
});

describe('decorar', () => {
  const owned = grantItem(grantItem(state(), 'a', 'all', NOW), 'b', 'all', NOW);

  it('no se puede coser lo que no se tiene', () => {
    expect(placeItem(state(), 'a', NOW)).toEqual(state());
  });

  it('dos piezas no caen en el mismo hueco', () => {
    const s = placeItem(placeItem(owned, 'a', NOW), 'b', NOW + 1);
    expect(s.layout.a).not.toEqual(s.layout.b);
    expect(s.layoutAt).toBe(NOW + 1);
  });

  it('quitarla la devuelve a la caja sin perderla', () => {
    const s = unplaceItem(placeItem(owned, 'a', NOW), 'a', NOW + 1);
    expect(s.layout).toEqual({});
    expect(s.items).toHaveProperty('a');
  });

  it('moverla no la saca del triángulo, y girarla da la vuelta completa', () => {
    let s = placeItem(owned, 'a', NOW);
    s = moveItem(s, 'a', 9, 9, NOW);
    expect(s.layout.a.v).toBeLessThanOrEqual(0.9);
    for (let i = 0; i < 24; i++) s = rotateItem(s, 'a', 15, NOW);
    expect(s.layout.a.rot).toBe(0);
  });

  it('cambiar al mismo color no cuenta como cambio', () => {
    const blue = setPanueloColor(state(), 'blue', NOW);
    expect(blue.layoutAt).toBe(NOW);
    expect(setPanueloColor(blue, 'blue', NOW + 1)).toBe(blue);
  });
});

describe('lo que se enseña', () => {
  const catalog = sanitizeCatalog({
    uno: { kind: 'cinta', name: 'Uno', order: 1, look: { colors: ['#fff'] } },
    dos: { kind: 'cinta', name: 'Dos', order: 2, look: { colors: ['#fff'] } },
    secreta: {
      kind: 'cinta',
      name: 'Secreta',
      order: 3,
      secret: true,
      look: { colors: ['#fff'] },
    },
    pulsera: {
      kind: 'pulsera',
      name: 'Pulsera',
      order: 4,
      look: { colors: ['#f00', '#0f0'] },
    },
  });

  it('primero lo que se tiene; la secreta no sale hasta conseguirla', () => {
    const s = grantItem(state(), 'dos', 'code', NOW);
    expect(buildCollection(catalog, s).map((e) => e.item.id)).toEqual([
      'dos',
      'uno',
      'pulsera',
    ]);
    expect(summarizePanuelo(catalog, s)).toEqual({
      owned: 1,
      total: 3,
      placed: 0,
    });
    const withSecret = grantItem(s, 'secreta', 'manual', NOW + 1);
    expect(buildCollection(catalog, withSecret)[0].item.id).toBe('secreta');
  });

  it('al visor solo le llegan piezas cosidas, que se tienen y que existen', () => {
    const s = state({
      items: { uno: { at: 1, via: 'all' }, fantasma: { at: 1, via: 'all' } },
      layout: {
        uno: { u: 0, v: 0.2, rot: 0 },
        fantasma: { u: 0.3, v: 0.2, rot: 0 },
      },
    });
    const viewer = toViewerState(catalog, s);
    expect(viewer.color).toBe('green');
    expect(viewer.items.map((i) => i.id)).toEqual(['uno']);
  });

  it('las pulseras se intercambian; lo demás, solo si el catálogo lo dice', () => {
    expect(isTradeable(catalog.pulsera)).toBe(true);
    expect(isTradeable(catalog.uno)).toBe(false);
    expect(isTradeable({ ...catalog.uno, tradeable: true })).toBe(true);
    expect(isTradeable({ ...catalog.pulsera, tradeable: false })).toBe(false);
  });

  it('chapas comunes sí; medallas y piezas únicas nunca, diga lo que diga el catálogo', () => {
    const chapa = DEFAULT_PANUELO_CATALOG['chapa-convivencia'];
    expect(chapa.kind).toBe('chapa');
    expect(isTradeable(chapa)).toBe(true);
    expect(isTradeable({ ...chapa, rarity: 'especial' })).toBe(false);
    expect(isTradeable({ ...chapa, rarity: 'unica', tradeable: true })).toBe(
      false,
    );
    const medalla = DEFAULT_PANUELO_CATALOG['medalla-jubileo-2025'];
    expect(
      isTradeable({ ...medalla, rarity: undefined, tradeable: true }),
    ).toBe(false);
    expect(isTradeable(DEFAULT_PANUELO_CATALOG['chapa-25-aniversario'])).toBe(
      false,
    );
  });
});

describe('el interruptor', () => {
  it('ausente o raro vale alpha', () => {
    expect(parsePanueloFlag(undefined)).toBe('alpha');
    expect(parsePanueloFlag('si')).toBe('alpha');
    expect(parsePanueloFlag('all')).toBe('all');
  });

  it.each([
    ['off', false, false],
    ['off', true, false],
    ['alpha', false, false],
    ['alpha', true, true],
    ['all', false, true],
    ['all', true, true],
  ] as const)('%s con probador=%s → %s', (flag, testerMode, expected) => {
    expect(isPanueloAvailable({ flag, testerMode })).toBe(expected);
  });
});

// ── Cambio de etapa e historial ────────────────────────────────────────────

describe('cambio de etapa', () => {
  const placement = { u: 0, v: 0.3, rot: 0 };
  const dressed = (over: Partial<PanueloUserState> = {}) =>
    state({
      color: 'green',
      items: { a: { at: 5, via: 'code' }, b: { at: 6, via: 'all' } },
      layout: { a: placement },
      layoutAt: 10,
      ...over,
    });

  it('archivar guarda el color y la colocación de ahora', () => {
    const next = archivePanuelo(dressed(), NOW);
    expect(next.history).toEqual({
      [String(NOW)]: { color: 'green', at: NOW, layout: { a: placement } },
    });
    // No toca lo demás.
    expect(next.layout).toEqual({ a: placement });
    expect(next.color).toBe('green');
  });

  it('un pañuelo sin piezas cosidas no es un recuerdo', () => {
    const empty = dressed({ layout: {} });
    expect(archivePanuelo(empty, NOW)).toBe(empty);
  });

  it('sin color elegido se archiva el que se veía (verde)', () => {
    const next = archivePanuelo(dressed({ color: null }), NOW);
    expect(listMemories(next)[0].color).toBe('green');
  });

  it('el recuerdo no comparte objeto con la colocación viva', () => {
    const next = archivePanuelo(dressed(), NOW);
    expect(next.history?.[String(NOW)].layout).not.toBe(next.layout);
  });

  it('dos recuerdos en el mismo milisegundo no se pisan', () => {
    const once = archivePanuelo(dressed(), NOW);
    const twice = archivePanuelo(once, NOW);
    expect(Object.keys(twice.history ?? {})).toHaveLength(2);
  });

  it('llevándose las piezas: cambia el color, las piezas siguen donde estaban', () => {
    const next = changeStage(dressed(), 'red', true, NOW);
    expect(next.color).toBe('red');
    expect(next.layout).toEqual({ a: placement });
    expect(next.layoutAt).toBe(NOW);
    expect(listMemories(next)).toHaveLength(1);
    expect(listMemories(next)[0].color).toBe('green');
  });

  it('con el pañuelo limpio: se descosen todas pero se siguen teniendo', () => {
    const next = changeStage(dressed(), 'blue', false, NOW);
    expect(next.color).toBe('blue');
    expect(next.layout).toEqual({});
    expect(Object.keys(next.items)).toEqual(['a', 'b']);
    // Lo que llevaba queda en el recuerdo.
    expect(listMemories(next)[0].layout).toEqual({ a: placement });
  });

  it('sin piezas cosidas cambia de color pero no guarda recuerdo', () => {
    const next = changeStage(dressed({ layout: {} }), 'yellow', false, NOW);
    expect(next.color).toBe('yellow');
    expect(next.history).toBeUndefined();
  });

  it('al mismo color no hace nada (ni con el color sin elegir, que se ve verde)', () => {
    const s = dressed();
    expect(changeStage(s, 'green', true, NOW)).toBe(s);
    const unset = dressed({ color: null });
    expect(changeStage(unset, 'green', false, NOW)).toBe(unset);
  });

  it('guarda como mucho los más recientes', () => {
    let s = dressed();
    for (let i = 0; i < MAX_PANUELO_HISTORY + 3; i++) {
      s = archivePanuelo(s, NOW + i * 1000);
    }
    const list = listMemories(s);
    expect(list).toHaveLength(MAX_PANUELO_HISTORY);
    // Del más reciente al más antiguo, y se han ido los más viejos.
    expect(list[0].at).toBe(NOW + (MAX_PANUELO_HISTORY + 2) * 1000);
    expect(list[list.length - 1].at).toBe(NOW + 3000);
  });

  it('newMemories dice cuáles son los nuevos (los que hay que subir)', () => {
    const before = archivePanuelo(dressed(), NOW);
    const after = archivePanuelo(before, NOW + 5000);
    expect(newMemories(before, after).map((m) => m.at)).toEqual([NOW + 5000]);
    expect(newMemories(after, after)).toEqual([]);
  });

  it('el historial se sanea: lo mal formado se descarta y la clave manda', () => {
    const s = sanitizeUserState({
      history: {
        '100': {
          color: 'red',
          at: 999,
          layout: { a: { u: 0, v: 0.3, rot: 0 } },
        },
        '200': { color: 'fucsia', layout: {} },
        '300': 'basura',
        '400': {
          color: 'blue',
          layout: { x: { u: 'no' }, y: { u: 0, v: 40 } },
        },
      },
    });
    expect(Object.keys(s.history ?? {}).sort()).toEqual(['100', '400']);
    expect(s.history?.['100'].at).toBe(100);
    expect(s.history?.['100'].layout.a).toEqual({ u: 0, v: 0.3, rot: 0 });
    // Una colocación rota se descarta; una que se sale se mete en el triángulo.
    expect(Object.keys(s.history?.['400'].layout ?? {})).toEqual(['y']);
    expect(s.history?.['400'].layout.y.v).toBeLessThanOrEqual(0.9);
  });

  it('un recuerdo puede llevar piezas que ya no se tienen (se llevaban entonces)', () => {
    const s = sanitizeUserState({
      history: { '100': { color: 'red', layout: { a: { u: 0, v: 0.3 } } } },
    });
    expect(s.history?.['100'].layout).toHaveProperty('a');
  });

  it('al sanear se queda con los más recientes y sin historial no hay clave', () => {
    const history: Record<string, unknown> = {};
    for (let i = 1; i <= MAX_PANUELO_HISTORY + 5; i++) {
      history[String(i * 100)] = { color: 'red', layout: {} };
    }
    const s = sanitizeUserState({ history });
    expect(listMemories(s)).toHaveLength(MAX_PANUELO_HISTORY);
    expect(listMemories(s)[0].at).toBe((MAX_PANUELO_HISTORY + 5) * 100);
    expect(sanitizeUserState({ color: 'red' })).not.toHaveProperty('history');
    expect(sanitizeUserState({ history: 'no' })).not.toHaveProperty('history');
  });

  it('se conserva al ida y vuelta por Firebase', () => {
    const s = changeStage(dressed(), 'red', true, NOW);
    const back = sanitizeUserState(JSON.parse(JSON.stringify(s)));
    expect(back.history).toEqual(s.history);
  });

  describe('al juntar móvil y nube', () => {
    const memory = (at: number, color: 'red' | 'blue' = 'red') => ({
      color,
      at,
      layout: {},
    });

    it('los recuerdos de los dos lados se suman', () => {
      const local = state({ history: { '1': memory(1) } });
      const remote = state({ history: { '2': memory(2, 'blue') } });
      const { merged, upload } = mergePanuelo(local, remote);
      expect(Object.keys(merged.history ?? {}).sort()).toEqual(['1', '2']);
      // El 1 solo estaba en el móvil: hay que subirlo.
      expect(upload).toBe(true);
    });

    it('el mismo `at` no se duplica y, si la nube ya lo tiene, no hay nada que subir', () => {
      const both = state({ history: { '1': memory(1) } });
      const { merged, upload } = mergePanuelo(both, both);
      expect(listMemories(merged)).toHaveLength(1);
      expect(upload).toBe(false);
    });

    it('lo que solo tiene la nube no se pierde ni se sube de vuelta', () => {
      const remote = state({ history: { '2': memory(2) } });
      const { merged, upload } = mergePanuelo(state(), remote);
      expect(listMemories(merged)).toHaveLength(1);
      expect(upload).toBe(false);
    });

    it('sin historial en ninguno no aparece la clave', () => {
      expect(mergePanuelo(state(), state()).merged).not.toHaveProperty(
        'history',
      );
    });

    it('tras sumar también se respeta el tope', () => {
      const many = (from: number) =>
        Object.fromEntries(
          Array.from({ length: MAX_PANUELO_HISTORY }, (_, i) => {
            const at = from + i;
            return [String(at), memory(at)];
          }),
        );
      const { merged } = mergePanuelo(
        state({ history: many(100) }),
        state({ history: many(1000) }),
      );
      const list = listMemories(merged);
      expect(list).toHaveLength(MAX_PANUELO_HISTORY);
      expect(list[0].at).toBe(1000 + MAX_PANUELO_HISTORY - 1);
    });

    it('el historial sobrevive a lo dado en un intercambio', () => {
      const { merged } = mergePanuelo(
        state({ history: { '1': memory(1) }, gone: { a: 5 } }),
        state({ items: { a: { at: 1, via: 'all' } } }),
      );
      expect(listMemories(merged)).toHaveLength(1);
      expect(merged.items).toEqual({});
    });
  });
});

describe('ver un pañuelo anterior', () => {
  const catalog = sanitizeCatalog({
    chapa: { kind: 'cinta', name: 'Chapa', look: { colors: ['#fff'] } },
    pin: { kind: 'cinta', name: 'Pin', look: { colors: ['#000'] } },
  });
  const memory = {
    color: 'red' as const,
    at: NOW,
    layout: {
      chapa: { u: 0, v: 0.3, rot: 0 },
      viejo: { u: 0.1, v: 0.4, rot: 0 },
    },
  };

  it('el visor recibe el color del recuerdo y solo las piezas que siguen en el catálogo', () => {
    const viewer = memoryToViewerState(catalog, memory);
    expect(viewer.color).toBe('red');
    expect(viewer.items.map((i) => i.id)).toEqual(['chapa']);
    expect(viewer.items[0]).toMatchObject({ u: 0, v: 0.3, kind: 'cinta' });
  });

  it('cuenta solo las piezas que se pueden enseñar', () => {
    expect(memoryPieceCount(catalog, memory)).toBe(1);
  });

  it('se puede recorrer como colección, tenga o no hoy la pieza', () => {
    const entries = buildMemoryCollection(
      catalog,
      state({ items: { chapa: { at: 7, via: 'code' } } }),
      memory,
    );
    expect(entries.map((e) => e.item.id)).toEqual(['chapa']);
    expect(entries[0].placed).toBe(true);
    expect(entries[0].owned).toEqual({ at: 7, via: 'code' });
    // Sin tenerla hoy, igual se enseña (se llevaba entonces).
    expect(
      buildMemoryCollection(catalog, state(), memory)[0].owned,
    ).toBeTruthy();
  });

  it('«Hasta noviembre de 2026»', () => {
    expect(formatMonthYear(new Date(2026, 10, 15).getTime())).toBe(
      'noviembre de 2026',
    );
  });
});

describe('el filtro de la colección', () => {
  const catalog = sanitizeCatalog({
    a: { kind: 'cinta', name: 'A', look: { colors: ['#fff'] }, order: 1 },
    b: { kind: 'cinta', name: 'B', look: { colors: ['#fff'] }, order: 2 },
    c: { kind: 'cinta', name: 'C', look: { colors: ['#fff'] }, order: 3 },
  });
  const s = state({
    items: { a: { at: 2, via: 'all' }, b: { at: 1, via: 'all' } },
    layout: { a: { u: 0, v: 0.3, rot: 0 } },
  });
  const all = buildCollection(catalog, s);
  const ids = (f: 'all' | 'placed' | 'boxed') =>
    filterCollection(all, f).map((e) => e.item.id);

  it('«Todas» incluye las siluetas de las que faltan', () => {
    expect(ids('all')).toEqual(['a', 'b', 'c']);
  });
  it('«Puestas» son las que tienes y llevas cosidas', () => {
    expect(ids('placed')).toEqual(['a']);
  });
  it('«Sin poner» son las que tienes y no están cosidas, no las que faltan', () => {
    expect(ids('boxed')).toEqual(['b']);
  });
});

describe('recolocar (autoArrange)', () => {
  const catalog = sanitizeCatalog({
    pin1: {
      kind: 'pin',
      name: 'Pin',
      look: { shape: 'heart', enamel: '#fff' },
    },
    pin2: {
      kind: 'pin',
      name: 'Pin 2',
      look: { shape: 'star', enamel: '#fff' },
    },
    medalla: { kind: 'medalla', name: 'Medalla', look: { ribbon: ['#fff'] } },
    pulsera: { kind: 'pulsera', name: 'Pulsera', look: { colors: ['#fff'] } },
    caja: {
      kind: 'pin',
      name: 'Caja',
      look: { shape: 'moon', enamel: '#fff' },
    },
  });
  // Todas amontonadas en el mismo sitio y con giro.
  const piled = state({
    color: 'blue',
    items: {
      pin1: { at: 1, via: 'all' },
      pin2: { at: 2, via: 'all' },
      medalla: { at: 3, via: 'all' },
      pulsera: { at: 4, via: 'all' },
      caja: { at: 5, via: 'all' },
    },
    layout: {
      pin1: { u: 0, v: 0.5, rot: 40 },
      pin2: { u: 0, v: 0.5, rot: 90 },
      medalla: { u: 0, v: 0.5, rot: 10 },
      pulsera: { u: 0, v: 0.5, rot: 200 },
    },
    layoutAt: 5,
  });

  it('las piezas cosidas dejan de pisarse', () => {
    const next = autoArrange(piled, catalog, NOW);
    const ids = Object.keys(next.layout);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = next.layout[ids[i]];
        const b = next.layout[ids[j]];
        const reach = (id: string) =>
          itemReach(catalog[id].kind, catalog[id].size);
        expect(placementDistance(a, b)).toBeGreaterThanOrEqual(
          reach(ids[i]) + reach(ids[j]) - 1e-6,
        );
      }
    }
  });

  it('rotación a 0, `layoutAt` = ahora y solo se mueven las cosidas', () => {
    const next = autoArrange(piled, catalog, NOW);
    expect(Object.keys(next.layout).sort()).toEqual([
      'medalla',
      'pin1',
      'pin2',
      'pulsera',
    ]);
    expect(Object.values(next.layout).every((p) => p.rot === 0)).toBe(true);
    expect(next.layoutAt).toBe(NOW);
    // La de la caja sigue en la caja; el color y las piezas, intactos.
    expect(next.layout.caja).toBeUndefined();
    expect(next.color).toBe('blue');
    expect(next.items).toBe(piled.items);
  });

  it('las grandes se llevan los primeros huecos', () => {
    const next = autoArrange(piled, catalog, NOW);
    // El primer hueco bonito es (0, 0.2): se lo lleva la medalla (la más grande).
    expect(next.layout.medalla).toMatchObject({ u: 0, v: 0.2 });
  });

  it('es estable: recolocar lo recolocado da lo mismo', () => {
    const once = autoArrange(piled, catalog, NOW);
    const twice = autoArrange(once, catalog, NOW + 1);
    expect(twice.layout).toEqual(once.layout);
  });

  it('sin piezas cosidas no hace nada', () => {
    const empty = state({ items: piled.items });
    expect(autoArrange(empty, catalog, NOW)).toBe(empty);
  });

  it('una pieza que ya no está en el catálogo se recoloca con el tamaño por defecto', () => {
    const next = autoArrange(
      state({
        items: { vieja: { at: 1, via: 'all' } },
        layout: { vieja: { u: 0.9, v: 0.8, rot: 30 } },
      }),
      catalog,
      NOW,
    );
    expect(next.layout.vieja.rot).toBe(0);
  });
});

describe('el color que dice Comunica', () => {
  it('solo cuatro valores son un color', () => {
    for (const c of ['red', 'green', 'blue', 'yellow']) {
      expect(comunicaScarfColor(c)).toBe(c);
    }
    for (const c of ['none', 'cross', 'unknown', '', null, undefined, 3]) {
      expect(comunicaScarfColor(c)).toBeNull();
    }
  });

  it('sin color de Comunica se elige a mano', () => {
    for (const scarf of ['none', 'cross', 'unknown', null, undefined]) {
      expect(decideScarfStage(scarf, state({ color: 'red' }))).toEqual({
        kind: 'manual',
      });
    }
  });

  it('el mismo color: nada que hacer', () => {
    expect(decideScarfStage('blue', state({ color: 'blue' }))).toEqual({
      kind: 'same',
      color: 'blue',
    });
  });

  it('un color distinto del guardado es un cambio de etapa', () => {
    expect(decideScarfStage('red', state({ color: 'blue' }))).toEqual({
      kind: 'change',
      color: 'red',
    });
  });

  it('sin color guardado se asigna sin preguntar, lleve o no la pieza de bienvenida', () => {
    expect(decideScarfStage('yellow', state())).toEqual({
      kind: 'assign',
      color: 'yellow',
    });
    expect(
      decideScarfStage(
        'yellow',
        state({
          items: { a: { at: 1, via: 'all' } },
          layout: { a: { u: 0, v: 0.3, rot: 0 } },
        }),
      ),
    ).toEqual({ kind: 'assign', color: 'yellow' });
  });
});

describe('el tutorial (datos)', () => {
  it('cubre lo que hoy existe', () => {
    const ids = PANUELO_TUTORIAL.map((s) => s.id);
    for (const id of [
      'tu-panuelo',
      'las-piezas',
      'canjear',
      'verlas-de-cerca',
      'tu-coleccion',
      'decorarlo',
      'cambiar-de-etapa',
    ]) {
      expect(ids).toContain(id);
    }
  });

  it('los «cómo se hace» llevan 2 o 3 pasos y sus órdenes apuntan a piezas del ejemplo', () => {
    for (const s of PANUELO_TUTORIAL) {
      if (s.steps) {
        expect(s.steps.length).toBeGreaterThanOrEqual(2);
        expect(s.steps.length).toBeLessThanOrEqual(3);
      }
      const e = s.example;
      if (!e) continue;
      for (const id of [e.select, e.focus, e.reveal]) {
        if (id) expect(e.pieces).toContain(id);
      }
      // Seleccionar una pieza solo tiene sentido en modo decorar.
      if (e.select) expect(e.mode).toBe('edit');
      if (e.toColor) expect(e.toColor).not.toBe(e.color);
    }
  });

  it('son 6 o 7 pasos y lo fundido no se ha perdido', () => {
    expect(PANUELO_TUTORIAL.length).toBeGreaterThanOrEqual(6);
    expect(PANUELO_TUTORIAL.length).toBeLessThanOrEqual(7);
    const all = (id: string) => {
      const s = PANUELO_TUTORIAL.find((x) => x.id === id);
      return JSON.stringify(s).toLowerCase();
    };
    expect(all('decorarlo')).toContain('recolocar');
    expect(all('tu-coleccion')).toContain('compartir');
    expect(all('cambiar-de-etapa')).toContain('mis pañuelos');
  });

  it('los iconos de las filas existen en Material Icons', () => {
    const glyphs = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialIcons.json');
    for (const s of PANUELO_TUTORIAL) {
      for (const row of s.rows ?? []) {
        expect(glyphs[row.icon]).toBeDefined();
        expect(row.title.trim()).not.toBe('');
      }
    }
  });

  it('la versión subió con el rediseño por páginas', () => {
    expect(PANUELO_TUTORIAL_VERSION).toBeGreaterThanOrEqual(3);
  });

  it('tiene versión y secciones con id único, título y texto', () => {
    expect(PANUELO_TUTORIAL_VERSION).toBeGreaterThanOrEqual(1);
    expect(PANUELO_TUTORIAL.length).toBeGreaterThanOrEqual(5);
    const ids = PANUELO_TUTORIAL.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of PANUELO_TUTORIAL) {
      expect(s.id).toMatch(/^[a-z0-9-]+$/);
      expect(s.title.trim()).not.toBe('');
      expect(s.body.trim()).not.toBe('');
    }
  });

  it('sus ejemplos usan piezas que existen en el catálogo de muestra', () => {
    for (const s of PANUELO_TUTORIAL) {
      const used = [...(s.example?.pieces ?? []), ...(s.example?.art ?? [])];
      for (const id of used) expect(DEFAULT_PANUELO_CATALOG[id]).toBeDefined();
    }
  });

  it('el pañuelo de ejemplo se pinta con piezas cosidas y sin pisarse', () => {
    const section = PANUELO_TUTORIAL.find((s) => s.id === 'las-piezas');
    const viewer = exampleViewerState(
      DEFAULT_PANUELO_CATALOG,
      'green',
      section?.example?.pieces ?? [],
    );
    expect(viewer.color).toBe('green');
    expect(viewer.items).toHaveLength(6);
    expect(new Set(viewer.items.map((i) => `${i.u},${i.v}`)).size).toBe(6);
  });

  it('ignora piezas que no existen', () => {
    expect(
      exampleViewerState(DEFAULT_PANUELO_CATALOG, 'red', ['nada']).items,
    ).toEqual([]);
  });

  it('no promete lo que no existe (los intercambios no tienen pantalla)', () => {
    const text = PANUELO_TUTORIAL.map((s) => `${s.title} ${s.body}`)
      .join(' ')
      .toLowerCase();
    expect(text).not.toContain('intercambi');
  });
});
