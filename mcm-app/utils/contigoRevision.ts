/**
 * Lógica pura del examen del día (`app/(tabs)/contigo/revision.tsx`).
 *
 * Vive aparte para poder probarla sin montar la pantalla: qué cuenta como
 * «algo escrito», cómo se arrastra el texto al cambiar de Lista a Texto libre y
 * cuánto mide cada punto del indicador de pasos.
 */

export type RevisionMode = 'list' | 'free';

/** Mínimo de casillas que enseña el modo lista. */
export const MIN_LIST_ITEMS = 3;

export interface RevisionForm {
  mode: RevisionMode;
  items: string[];
  singleGrat: string;
  revText: string;
}

/**
 * El agradecimiento que se guarda: solo el del modo activo, sin espacios y sin
 * huecos. En modo libre es UN texto (o ninguno, nunca `['']`).
 */
export function gratefulItemsToSave(
  mode: RevisionMode,
  items: string[],
  singleGrat: string,
): string[] {
  if (mode === 'list') return items.map((g) => g.trim()).filter(Boolean);
  const single = singleGrat.trim();
  return single ? [single] : [];
}

/**
 * ¿Hay algo que guardar? Un día en blanco no cuenta como examen hecho: sumaba a
 * la racha y al calendario y lanzaba la celebración sin haber escrito nada.
 * Basta con una cosa escrita en cualquiera de los dos pasos.
 */
export function revisionHasContent({
  mode,
  items,
  singleGrat,
  revText,
}: RevisionForm): boolean {
  return (
    gratefulItemsToSave(mode, items, singleGrat).length > 0 ||
    revText.trim().length > 0
  );
}

/** Rellena con casillas vacías hasta el mínimo del modo lista. */
export function padListItems(items: string[]): string[] {
  return items.length >= MIN_LIST_ITEMS
    ? items
    : [...items, ...Array(MIN_LIST_ITEMS - items.length).fill('')];
}

/**
 * Al cambiar de modo el texto viaja con la persona. Al guardar solo se
 * persiste el modo activo, así que sin esto lo escrito en Lista se perdía en
 * silencio al pasar a Texto libre (y al revés).
 *
 * Nunca pisa lo que ya hubiera en el modo de destino: solo rellena si estaba
 * vacío. De lista a libre, una casilla por línea; de libre a lista, una línea
 * por casilla.
 */
export function carryGratefulText(
  to: RevisionMode,
  items: string[],
  singleGrat: string,
): { items: string[]; singleGrat: string } {
  if (to === 'free') {
    if (singleGrat.trim()) return { items, singleGrat };
    const joined = items
      .map((g) => g.trim())
      .filter(Boolean)
      .join('\n');
    return { items, singleGrat: joined };
  }
  if (items.some((g) => g.trim())) return { items, singleGrat };
  const lines = singleGrat
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return { items: padListItems(lines), singleGrat };
}

/**
 * Ancho de cada punto del indicador de pasos: el actual se alarga, los
 * pasados quedan medianos y los que faltan, pequeños.
 */
export function stepDotWidth(index: number, current: number): number {
  if (index === current) return 26;
  return index < current ? 12 : 7;
}
