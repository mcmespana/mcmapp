import {
  CARISMOCHITO_VARIANTS,
  addCatch,
  getVariant,
  mergeCollections,
  pickVariant,
  sanitizeCollection,
  summarizeCollection,
  type CarismochitoVariant,
} from '@/utils/carismochitoCollection';
import { CarismochitoPalettes } from '@/constants/colors';

describe('catálogo de variantes', () => {
  it('no repite ids: son la clave con la que se guarda la colección', () => {
    const ids = CARISMOCHITO_VARIANTS.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('toda paleta que nombra una variante existe de verdad', () => {
    for (const v of CARISMOCHITO_VARIANTS) {
      if (v.palette !== null) {
        expect(CarismochitoPalettes).toHaveProperty(v.palette);
      }
    }
  });

  it('el legendario es de verdad el más difícil de sacar', () => {
    const minWeight = Math.min(...CARISMOCHITO_VARIANTS.map((v) => v.weight));
    const legendary = CARISMOCHITO_VARIANTS.filter(
      (v) => v.rarity === 'legendario',
    );
    expect(legendary.length).toBeGreaterThan(0);
    for (const v of legendary) expect(v.weight).toBe(minWeight);
  });
});

describe('pickVariant', () => {
  const three: CarismochitoVariant[] = [
    { id: 'a', name: 'A', rarity: 'comun', weight: 7, palette: null, hint: '' },
    { id: 'b', name: 'B', rarity: 'raro', weight: 2, palette: null, hint: '' },
    {
      id: 'c',
      name: 'C',
      rarity: 'legendario',
      weight: 1,
      palette: null,
      hint: '',
    },
  ];

  it('reparte el azar según los pesos, incluidos los bordes', () => {
    expect(pickVariant(() => 0, three).id).toBe('a');
    expect(pickVariant(() => 0.69, three).id).toBe('a');
    expect(pickVariant(() => 0.7, three).id).toBe('b');
    expect(pickVariant(() => 0.89, three).id).toBe('b');
    expect(pickVariant(() => 0.9, three).id).toBe('c');
    expect(pickVariant(() => 0.9999, three).id).toBe('c');
  });

  it('un azar fuera de [0,1) no rompe: sigue saliendo una variante', () => {
    expect(pickVariant(() => 1, three).id).toBe('c');
    expect(pickVariant(() => 5, three).id).toBe('c');
    expect(pickVariant(() => -1, three).id).toBe('a');
    expect(pickVariant(() => NaN, three)).toBeDefined();
  });

  it('una variante con peso 0 no sale nunca', () => {
    const withZero = [{ ...three[0], weight: 0 }, three[1]];
    for (const r of [0, 0.3, 0.6, 0.99]) {
      expect(pickVariant(() => r, withZero).id).toBe('b');
    }
  });

  it('con el catálogo real, 10.000 sorteos respetan las proporciones', () => {
    let seed = 42;
    const lcg = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const hits: Record<string, number> = {};
    for (let i = 0; i < 10000; i++) {
      const id = pickVariant(lcg).id;
      hits[id] = (hits[id] ?? 0) + 1;
    }
    const total = CARISMOCHITO_VARIANTS.reduce((s, v) => s + v.weight, 0);
    for (const v of CARISMOCHITO_VARIANTS) {
      const expected = (v.weight / total) * 10000;
      // ±30% relativo o ±40 absolutos, lo que sea más holgado para los raros.
      const tol = Math.max(expected * 0.3, 40);
      expect(Math.abs((hits[v.id] ?? 0) - expected)).toBeLessThan(tol);
    }
  });
});

describe('addCatch', () => {
  it('la primera captura guarda la fecha; las siguientes solo suman', () => {
    const one = addCatch({}, 'rojo', 1000);
    expect(one).toEqual({ rojo: { count: 1, firstAt: 1000 } });
    const two = addCatch(one, 'rojo', 5000);
    expect(two.rojo).toEqual({ count: 2, firstAt: 1000 });
  });

  it('no muta la colección de entrada (React depende de ello)', () => {
    const before = { rojo: { count: 1, firstAt: 1 } };
    const frozen = Object.freeze({ ...before });
    const after = addCatch(frozen, 'rojo', 2);
    expect(frozen.rojo.count).toBe(1);
    expect(after).not.toBe(frozen);
  });
});

describe('sanitizeCollection', () => {
  it('lo que no es un objeto se queda en colección vacía', () => {
    for (const raw of [null, undefined, 'x', 3, [], true]) {
      expect(sanitizeCollection(raw)).toEqual({});
    }
  });

  it('descarta contadores inválidos y redondea los decimales hacia abajo', () => {
    expect(
      sanitizeCollection({
        ok: { count: 2, firstAt: 10 },
        cero: { count: 0, firstAt: 1 },
        negativo: { count: -3, firstAt: 1 },
        texto: { count: '4', firstAt: 1 },
        infinito: { count: Infinity, firstAt: 1 },
        decimal: { count: 2.7, firstAt: 1 },
        roto: 'hola',
      }),
    ).toEqual({
      ok: { count: 2, firstAt: 10 },
      decimal: { count: 2, firstAt: 1 },
    });
  });

  it('sin fecha válida pone 0, y conserva variantes que este build no conoce', () => {
    expect(
      sanitizeCollection({ del_futuro: { count: 1, firstAt: 'ayer' } }),
    ).toEqual({ del_futuro: { count: 1, firstAt: 0 } });
  });
});

describe('mergeCollections', () => {
  it('gana el contador más alto y NO se suman (abrir la app no duplica)', () => {
    const local = { rojo: { count: 3, firstAt: 100 } };
    const remote = { rojo: { count: 3, firstAt: 100 } };
    const { merged, toUpload } = mergeCollections(local, remote);
    expect(merged.rojo.count).toBe(3);
    expect(toUpload).toEqual([]);
  });

  it('si el móvil va por delante, hay que subirlo', () => {
    const { merged, toUpload } = mergeCollections(
      { rojo: { count: 5, firstAt: 100 } },
      { rojo: { count: 2, firstAt: 100 } },
    );
    expect(merged.rojo.count).toBe(5);
    expect(toUpload).toEqual(['rojo']);
  });

  it('si la nube va por delante (otro móvil), se baja y no se sube nada', () => {
    const { merged, toUpload } = mergeCollections(
      { rojo: { count: 1, firstAt: 100 } },
      { rojo: { count: 9, firstAt: 100 } },
    );
    expect(merged.rojo.count).toBe(9);
    expect(toUpload).toEqual([]);
  });

  it('la primera captura es la más antigua de las dos, y se corrige en la nube', () => {
    const { merged, toUpload } = mergeCollections(
      { rojo: { count: 1, firstAt: 50 } },
      { rojo: { count: 4, firstAt: 900 } },
    );
    expect(merged.rojo).toEqual({ count: 4, firstAt: 50 });
    expect(toUpload).toEqual(['rojo']);
  });

  it('una fecha que falta (0) no gana a una de verdad', () => {
    const { merged } = mergeCollections(
      { rojo: { count: 1, firstAt: 0 } },
      { rojo: { count: 1, firstAt: 700 } },
    );
    expect(merged.rojo.firstAt).toBe(700);
  });

  it('une variantes que solo están en un lado y sube solo las locales', () => {
    const { merged, toUpload } = mergeCollections(
      { rojo: { count: 1, firstAt: 1 } },
      { dorado: { count: 1, firstAt: 2 } },
    );
    expect(Object.keys(merged).sort()).toEqual(['dorado', 'rojo']);
    expect(toUpload).toEqual(['rojo']);
  });
});

describe('summarizeCollection', () => {
  it('cuenta capturas totales y variantes distintas del catálogo', () => {
    const s = summarizeCollection({
      clasico: { count: 4, firstAt: 1 },
      dorado: { count: 1, firstAt: 1 },
      del_futuro: { count: 7, firstAt: 1 },
    });
    // La desconocida no cuenta: no hay casilla donde enseñarla.
    expect(s).toEqual({
      total: 5,
      found: 2,
      of: CARISMOCHITO_VARIANTS.length,
      complete: false,
    });
  });

  it('está completa cuando se ha visto cada variante al menos una vez', () => {
    const all = Object.fromEntries(
      CARISMOCHITO_VARIANTS.map((v) => [v.id, { count: 1, firstAt: 1 }]),
    );
    expect(summarizeCollection(all).complete).toBe(true);
  });

  it('getVariant encuentra por id y no inventa las que no existen', () => {
    expect(getVariant('dorado')?.rarity).toBe('legendario');
    expect(getVariant('no-existe')).toBeUndefined();
  });
});
