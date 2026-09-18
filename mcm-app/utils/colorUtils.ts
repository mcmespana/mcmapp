/**
 * Color utilities for React Native / heroui-native.
 * heroui-native and Reanimated do NOT support 8-digit hex (#RRGGBBAA).
 * Use hexAlpha() whenever you need to add transparency to a hex color.
 */

/** Expands 3-digit hex (#RGB) to 6-digit (#RRGGBB). */
function expandHex(hex: string): string {
  if (hex.length === 4) {
    return '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  return hex;
}

/**
 * Converts a hex color + alpha byte (as 2-char hex string) to rgba().
 * Supports both 3-digit (#RGB) and 6-digit (#RRGGBB) hex input.
 *
 * @example hexAlpha('#253883', '20') → 'rgba(37, 56, 131, 0.13)'
 * @example hexAlpha('#fff', '80')    → 'rgba(255, 255, 255, 0.50)'
 */
export const hexAlpha = (hex: string, alphaHex: string): string => {
  const full = expandHex(hex);
  const r = parseInt(full.slice(1, 3), 16);
  const g = parseInt(full.slice(3, 5), 16);
  const b = parseInt(full.slice(5, 7), 16);
  const a = (parseInt(alphaHex, 16) / 255).toFixed(2);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

/**
 * Oscurece un color hex mezclándolo hacia negro.
 * @param ratio 0 = sin cambio, 1 = negro. p.ej. 0.2 → 20% más oscuro.
 * @example darkenHex('#FCD200', 0.2) → 'rgb(202, 168, 0)'
 */
export const darkenHex = (hex: string, ratio: number): string => {
  const full = expandHex(hex);
  const f = Math.max(0, Math.min(1, 1 - ratio));
  const r = Math.round(parseInt(full.slice(1, 3), 16) * f);
  const g = Math.round(parseInt(full.slice(3, 5), 16) * f);
  const b = Math.round(parseInt(full.slice(5, 7), 16) * f);
  return `rgb(${r}, ${g}, ${b})`;
};

/**
 * Color de texto legible SOBRE un fondo de color.
 *
 * Existía cinco veces, con cinco umbrales distintos de brillo puestos a ojo
 * —150, 160, 170, 175 y 200— y tres parejas de blanco/negro diferentes. La
 * misma pregunta con cinco respuestas.
 *
 * Aquí se decide por **razón de contraste real** (WCAG), no por un número
 * estimado: se calcula contra los dos candidatos y gana el que más contrasta.
 * Determinista y sin umbral que afinar.
 */
export const onColor = (background: string): string => {
  const full = expandHex(background);
  const channel = (i: number) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  const contrastWithDark = (luminance + 0.05) / (0.0114 + 0.05); // #1C1C1E
  const contrastWithLight = (1 + 0.05) / (luminance + 0.05); // #FFFFFF
  return contrastWithDark >= contrastWithLight ? '#1C1C1E' : '#FFFFFF';
};

/**
 * El MISMO color, movido hasta que se lee sobre un fondo dado.
 *
 * Conserva tono y saturación y solo toca la luminosidad: el resultado sigue
 * siendo "ese color", pero legible. Es la versión automática de lo que se hizo
 * a mano con el dorado de Contigo (`accentText`, §A3 de PLAN_DISENO), y existe
 * porque ese caso no era el único ni el último.
 *
 * El detonante: los colores de categoría de las notificaciones son UN valor
 * usado como texto en los dos modos, y medidos daban `#9D1E74` a **1,91:1**
 * sobre la card oscura, `#C62828` a 2,48 y `#0E7490` a 2,60 — cinco de seis
 * categorías ilegibles en oscuro, y dos en claro. Además el panel puede mandar
 * colores nuevos que nadie ha medido, así que una tabla de pares a mano se
 * queda corta el día que añadan una categoría.
 *
 * @param color  el color de partida (hex de 3, 6 u 8 dígitos)
 * @param background  el fondo sobre el que se va a leer
 * @param target  razón de contraste mínima; 4,5 es el mínimo de texto normal
 * @returns el color si ya cumple, o la variante más cercana que cumple. Si ni
 *   el negro ni el blanco llegan (fondo a medio camino), devuelve el de los dos
 *   que más contraste dé — que es lo que hace `onColor`.
 */
export const readableOn = (
  color: string,
  background: string,
  target = 4.5,
): string => {
  const luminance = (hex: string) => {
    const full = expandHex(hex);
    const channel = (i: number) => {
      const c = parseInt(full.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  };
  const ratio = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  if (ratio(color, background) >= target) return color;

  const full = expandHex(color);
  const [r, g, b] = [1, 3, 5].map(
    (i) => parseInt(full.slice(i, i + 2), 16) / 255,
  );
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }

  const toHex = (lightness: number) => {
    const c = (1 - Math.abs(2 * lightness - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = lightness - c / 2;
    const [r1, g1, b1] =
      h < 60
        ? [c, x, 0]
        : h < 120
          ? [x, c, 0]
          : h < 180
            ? [0, c, x]
            : h < 240
              ? [0, x, c]
              : h < 300
                ? [x, 0, c]
                : [c, 0, x];
    const byte = (v: number) =>
      Math.round((v + m) * 255)
        .toString(16)
        .padStart(2, '0')
        .toUpperCase();
    return `#${byte(r1)}${byte(g1)}${byte(b1)}`;
  };

  // Hacia dónde moverse: si el fondo es claro, oscureciendo; si es oscuro,
  // aclarando. Se prueba en pasos de 1% y se coge el PRIMERO que cumple, que
  // es el que menos se aleja del color original.
  const haciaNegro = luminance(background) > 0.18;
  for (let paso = 1; paso <= 100; paso += 1) {
    const candidato = haciaNegro
      ? Math.max(0, l - paso / 100)
      : Math.min(1, l + paso / 100);
    const hex = toHex(candidato);
    if (ratio(hex, background) >= target) return hex;
    if (candidato === 0 || candidato === 1) break;
  }

  // Ni el extremo del tono llega (pasa con fondos a media luz): se cae al
  // blanco/negro que más contraste dé.
  return onColor(background);
};

/**
 * Razón de contraste WCAG entre dos colores. 1 = idénticos, 21 = negro sobre
 * blanco. Los mínimos: **4,5** para texto normal, **3** para texto grande y
 * para elementos no textuales (iconos, bordes de control).
 *
 * Estaba calculada por dentro en `onColor`, en `readableOn` y a mano en varios
 * tests. Se saca para que quien tenga que DECIDIR pueda preguntar el número en
 * vez de estimarlo con un umbral de brillo, que es lo que llevó a tener cinco
 * umbrales distintos puestos a ojo (§A6-bis de PLAN_DISENO).
 */
export const contrastRatio = (a: string, b: string): number => {
  const lum = (hex: string) => {
    const full = expandHex(hex);
    const channel = (i: number) => {
      const c = parseInt(full.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
