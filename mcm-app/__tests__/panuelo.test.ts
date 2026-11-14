import { createHash } from 'crypto';

import { DEFAULT_PANUELO_CATALOG } from '@/constants/panueloCatalog';
import { PANUELO_GLYPHS } from '@/constants/panueloGlyphs';
import type { PanueloCatalog, PanueloUserState } from '@/types/panuelo';
import {
  EMPTY_PANUELO,
  buildCollection,
  grantItem,
  hashPanueloCode,
  isTradeable,
  mergePanuelo,
  moveItem,
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
