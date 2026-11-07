// Colección de Carismochitos: qué variantes hay, cuál sale al asomarse y cómo
// se fusiona lo que hay en el móvil con lo que hay en la nube.
//
// Todo lo de aquí es puro (sin React, sin AsyncStorage, sin Firebase): el
// azar entra por parámetro para que se pueda probar, y las fechas también.
// El estado vive en `contexts/CarismochitoHuntContext.tsx`.
//
// Forma persistida, en local (AsyncStorage) y en `users/{uid}/carismochitos`:
//
//   { "<variantId>": { "count": 3, "firstAt": 1727000000000 } }
//
// Una entrada por variante y no una lista de capturas: el tamaño no crece con
// el uso, y dos móviles de la misma persona se pueden fusionar sin conflictos.

import type { CarismochitoPaletteId } from '@/constants/colors';

export type CarismochitoRarity = 'comun' | 'poco_comun' | 'raro' | 'legendario';

export interface CarismochitoVariant {
  id: string;
  name: string;
  rarity: CarismochitoRarity;
  /** Peso relativo en el sorteo. No tienen que sumar 100. */
  weight: number;
  /**
   * `null` → el Carismochito "de verdad", el PNG de `assets/`. El resto se
   * dibuja con el vector de `CarismochitoMascot` y esta paleta.
   */
  palette: CarismochitoPaletteId | null;
  /** Una línea para la ficha de la colección. */
  hint: string;
}

/**
 * El catálogo. **El `id` es un contrato**: está escrito en el móvil de la gente
 * y en Firebase. Se pueden añadir variantes y cambiar nombres o pesos; lo que
 * no se hace es renombrar o reutilizar un `id`, o las capturas viejas pasarían
 * a contar como otra variante.
 */
export const CARISMOCHITO_VARIANTS: readonly CarismochitoVariant[] = [
  {
    id: 'clasico',
    name: 'Carismochito',
    rarity: 'comun',
    weight: 46,
    palette: null,
    hint: 'El de siempre. Se deja ver a menudo.',
  },
  {
    id: 'verde',
    name: 'Carismochito de campo',
    rarity: 'comun',
    weight: 18,
    palette: 'verde',
    hint: 'Anda por todas partes.',
  },
  {
    id: 'celeste',
    name: 'Carismochito celeste',
    rarity: 'poco_comun',
    weight: 10,
    palette: 'celeste',
    hint: 'Del color del cielo del logo.',
  },
  {
    id: 'rojo',
    name: 'Carismochito MIC',
    rarity: 'poco_comun',
    weight: 10,
    palette: 'rojo',
    hint: 'Rojo como el de los MIC.',
  },
  {
    id: 'lima',
    name: 'Carismochito COM',
    rarity: 'poco_comun',
    weight: 8,
    palette: 'lima',
    hint: 'Verde como el de los COM.',
  },
  {
    id: 'morado',
    name: 'Carismochito LC',
    rarity: 'raro',
    weight: 4,
    palette: 'morado',
    hint: 'Morado como el de los LC. Cuesta verlo.',
  },
  {
    id: 'nocturno',
    name: 'Carismochito nocturno',
    rarity: 'raro',
    weight: 3,
    palette: 'nocturno',
    hint: 'Se asoma cuando menos te lo esperas.',
  },
  {
    id: 'dorado',
    name: 'Carismochito dorado',
    rarity: 'legendario',
    weight: 1,
    palette: 'dorado',
    hint: 'Casi nadie lo ha visto.',
  },
];

export const RARITY_LABEL: Record<CarismochitoRarity, string> = {
  comun: 'Común',
  poco_comun: 'Poco común',
  raro: 'Raro',
  legendario: 'Legendario',
};

export interface CollectionEntry {
  count: number;
  /** Primera captura, en ms. */
  firstAt: number;
}

export type CarismochitoCollection = Record<string, CollectionEntry>;

const VARIANT_BY_ID = new Map(CARISMOCHITO_VARIANTS.map((v) => [v.id, v]));

export function getVariant(id: string): CarismochitoVariant | undefined {
  return VARIANT_BY_ID.get(id);
}

/**
 * Sorteo ponderado. `random` es un `Math.random` inyectable: devuelve un
 * número en [0, 1). Un valor fuera de rango (un mock mal hecho) no rompe: se
 * recorta, y siempre sale una variante.
 */
export function pickVariant(
  random: () => number = Math.random,
  variants: readonly CarismochitoVariant[] = CARISMOCHITO_VARIANTS,
): CarismochitoVariant {
  const total = variants.reduce((sum, v) => sum + Math.max(0, v.weight), 0);
  const r = Math.min(Math.max(random(), 0), 1 - Number.EPSILON);
  let target = r * total;
  for (const v of variants) {
    const w = Math.max(0, v.weight);
    if (target < w) return v;
    target -= w;
  }
  return variants[variants.length - 1];
}

/** Suma una captura. Devuelve una colección nueva; no toca la de entrada. */
export function addCatch(
  collection: CarismochitoCollection,
  variantId: string,
  now: number,
): CarismochitoCollection {
  const prev = collection[variantId];
  return {
    ...collection,
    [variantId]: prev
      ? { count: prev.count + 1, firstAt: prev.firstAt }
      : { count: 1, firstAt: now },
  };
}

/**
 * Limpia lo que venga de AsyncStorage o de Firebase: cualquiera de los dos
 * puede traer basura (una versión vieja, una edición a mano en la consola).
 * Se quedan solo las entradas con `count` entero positivo; las variantes que
 * este build no conoce SE CONSERVAN, porque pueden ser de una versión más
 * nueva de la app en otro móvil de la misma persona.
 */
export function sanitizeCollection(raw: unknown): CarismochitoCollection {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: CarismochitoCollection = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const { count, firstAt } = value as Record<string, unknown>;
    if (typeof count !== 'number' || !Number.isFinite(count)) continue;
    const c = Math.floor(count);
    if (c <= 0) continue;
    out[id] = {
      count: c,
      firstAt:
        typeof firstAt === 'number' && Number.isFinite(firstAt) ? firstAt : 0,
    };
  }
  return out;
}

/**
 * Fusiona la colección del móvil con la de la nube.
 *
 * Por variante gana el contador MÁS ALTO, no la suma: las dos copias son la
 * misma colección vista desde dos sitios, y sumar duplicaría cada captura cada
 * vez que se abre la app. Lo que se pierde con el máximo son las capturas
 * hechas en dos móviles a la vez sin conexión — aceptable para un juego.
 *
 * `toUpload` son las variantes donde lo local va por delante de la nube y hay
 * que subirlas.
 */
export function mergeCollections(
  local: CarismochitoCollection,
  remote: CarismochitoCollection,
): { merged: CarismochitoCollection; toUpload: string[] } {
  const merged: CarismochitoCollection = {};
  const toUpload: string[] = [];
  const ids = new Set([...Object.keys(local), ...Object.keys(remote)]);
  for (const id of ids) {
    const l = local[id];
    const r = remote[id];
    if (l && r) {
      const firstAt =
        l.firstAt && r.firstAt
          ? Math.min(l.firstAt, r.firstAt)
          : l.firstAt || r.firstAt;
      merged[id] = { count: Math.max(l.count, r.count), firstAt };
      if (l.count > r.count || firstAt !== r.firstAt) toUpload.push(id);
    } else if (l) {
      merged[id] = l;
      toUpload.push(id);
    } else if (r) {
      merged[id] = r;
    }
  }
  return { merged, toUpload };
}

export interface CollectionSummary {
  /** Capturas totales, contando repetidas. */
  total: number;
  /** Variantes del catálogo encontradas al menos una vez. */
  found: number;
  /** Variantes que hay en el catálogo. */
  of: number;
  complete: boolean;
}

export function summarizeCollection(
  collection: CarismochitoCollection,
  variants: readonly CarismochitoVariant[] = CARISMOCHITO_VARIANTS,
): CollectionSummary {
  let total = 0;
  let found = 0;
  for (const v of variants) {
    const n = collection[v.id]?.count ?? 0;
    total += n;
    if (n > 0) found += 1;
  }
  return {
    total,
    found,
    of: variants.length,
    complete: found === variants.length,
  };
}
