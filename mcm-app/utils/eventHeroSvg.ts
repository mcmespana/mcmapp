// utils/eventHeroSvg.ts
//
// Logo de un evento dibujado con código: el SVG vive como TEXTO en
// `activities/<id>/_meta.heroSvg` (Firebase) y la app lo pinta con
// `react-native-svg` (ya está en el binario: sin build nativo).
//
// Es contenido remoto que acaba en un parser, así que se valida de forma
// conservadora: se acepta solo SVG de formas y degradados, sin nada que cargue
// recursos ni ejecute código.

/** Tope de tamaño (caracteres). Un logo abstracto cabe de sobra. */
export const HERO_SVG_MAX_LENGTH = 24_000;

// Elementos y atributos que NO se admiten (carga externa, scripts, estilos).
const FORBIDDEN =
  /<\s*(script|foreignObject|image|iframe|use|style|a)\b|\bon\w+\s*=|javascript:|data:|\bhref\s*=|<!ENTITY|<!DOCTYPE/i;

/** ¿Es un SVG que se puede pintar con seguridad? */
export function isSafeHeroSvg(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const svg = value.trim();
  if (svg.length === 0 || svg.length > HERO_SVG_MAX_LENGTH) return false;
  if (!/^<svg[\s>]/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) return false;
  return !FORBIDDEN.test(svg);
}

/**
 * Sustituye `currentColor` por el color de tinta del hero, para que un mismo
 * SVG se lea sobre cualquier color de evento (claro u oscuro).
 */
export function paintHeroSvg(svg: string, color: string): string {
  return svg.replace(/currentColor/gi, color);
}
