// utils/comunica/eventMap.ts
//
// A dónde lleva el botón del lugar de una ficha (plan 13): PURO. Con enlace propio (`http(s)`), ese; con una búsqueda, la app de mapas del sistema:
// Mapas en iOS (`maps.apple.com/?q=`), `geo:0,0?q=` en Android (elige la app del móvil) y Google Maps en web. Es el «que se sienta del sistema»
// frente al Google Maps fijo del plugin.

export type EventMap = { url: string } | { query: string };

export function mapHref(
  map: EventMap,
  platform: 'ios' | 'android' | 'web' | string,
): string | null {
  if ('url' in map) return /^https?:\/\//i.test(map.url) ? map.url : null;
  const q = encodeURIComponent(map.query);
  if (platform === 'ios') return `https://maps.apple.com/?q=${q}`;
  if (platform === 'android') return `geo:0,0?q=${q}`;
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/** Plazas y precio como se leen: «60 plazas», «45 €» (con coma, sin ceros de más). */
export const capacityText = (n: number | null) =>
  n && n > 0 ? `${n} plazas` : null;
export function priceText(p: number | null): string | null {
  if (!p || p <= 0) return null;
  const s = Number.isInteger(p) ? String(p) : p.toFixed(2).replace('.', ',');
  return `${s} €`;
}
