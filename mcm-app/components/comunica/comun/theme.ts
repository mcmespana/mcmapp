// components/comunica/comun/theme.ts
//
// El color del área privada nativa, en UN sitio (plan 03 §2). Territorio
// «Comunica» (decisión `territorio` = A, 21/10/2026; fila en `design.md` §2):
// estructura y tokens no cromáticos de la app, color del área privada web.
// Los valores viven en `ComunicaColors` (`constants/colors.ts`); aquí se decide
// qué va como relleno y qué como texto en cada modo, y nada de
// `components/comunica/` lee `brand` ni hex por su cuenta.
//
//   · Acento: el violeta Comunica. Como relleno, el mismo en los dos modos
//     (texto blanco encima); como texto, icono o borde, `accentText`, que en
//     oscuro es un violeta más claro con contraste AA sobre la card.
//   · Degradado de marca (azul → violeta → magenta): es la firma del área, como
//     en el plugin, y solo se pinta con `BrandGradient`. Dos clases:
//       - BLOQUES (`variant="block"`): la cabecera del área
//         (`BrandHeaderBackground`, en todas las pantallas), la acción
//         principal, el hero de la portada y la tarjeta destacada. Dos como
//         mucho por pantalla: la cabecera ya es uno, así que el contenido solo
//         lleva UNO más (un fichero no junta dos). Nunca dos seguidos salvo que
//         el segundo se pueda cerrar (el hero lleva su ×).
//       - MARCAS (`variant="mark"`, ≤ 72 pt): cápsula de fecha y avatar de
//         identidad. No cuentan para el tope. Nunca en las filas de una lista
//         virtualizada (`PersonRow`, `ListCell`) y nunca sobre un bloque (marca
//         sobre marca no); sí en las tarjetas de las listas cortas (eventos,
//         inscripciones, pagos), con las fechas pasadas en gris. Sin barritas
//         ni rayas de color: el propietario no las quiere (`noEdgeStripes`).
//     Decisión del propietario (28/10 y 05/11/2026): «conservar el estilo de la
//     original, adaptado al nativo». La lista blanca de quién puede pintarlo
//     está en `__tests__/comunica/territorio.test.ts`.
//   · Marcas de asistencia: los colores de sistema que ya hay (`SwipeColors`
//     de Apple para el verde y el rojo, `ToastColors.warning` para el ámbar,
//     `brand.info` para «Parcial»). Siempre como RELLENO con el icono encima en
//     `onColor()`, nunca como texto suelto.
//   · Etapas: los colores de la marca de cada una (MIC rojo, COM verde, LC
//     morado), como el punto de color del plugin; los segmentos COM II y COM
//     III, los suyos del plugin.
//   · Pañuelos y avisos: los del plugin, como tokens del territorio.

import brand, {
  ComunicaColors,
  SwipeColors,
  SystemGray,
  themeColors,
  ToastColors,
} from '@/constants/colors';
import type {
  Scarf,
  Segment,
  SetMark,
  Stage,
} from '@/services/comunica/contract';
import { hexAlpha, onColor, readableOn } from '@/utils/colorUtils';
import { compositeOver, tintedGlyph } from '@/utils/tintColors';

/** Relleno de los estados de una marca. */
export const MARK_FILL: Record<SetMark, string> = {
  yes: SwipeColors.add,
  partial: brand.info,
  no_justified: ToastColors.warning,
  no_unjustified: SwipeColors.remove,
};

/** Punto de color de cada etapa. */
export const STAGE_COLOR: Record<Stage, string> = {
  mic: brand.accent,
  com: brand.green,
  lc: brand.purple,
  apoyo: SystemGray.light.gray,
};

/** Punto de color de cada segmento del COM (verde → violeta → magenta). */
export const SEGMENT_COLOR: Record<Segment, string> = {
  com_1: brand.green,
  com_2: ComunicaColors.segment.com2,
  com_3: ComunicaColors.segment.com3,
};

/**
 * Pañuelos (plan 05): los siete del plugin. Siempre como RELLENO de un punto,
 * con el nombre escrito al lado.
 */
export const SCARF_FILL: Record<Scarf, string> = ComunicaColors.scarf;

/**
 * Escala de los avisos de comportamiento (ámbar → naranja → rojo), igual en
 * claro y en oscuro para que «el naranja» signifique siempre lo mismo. El
 * número de dentro, con `onColor()`.
 */
export const NOTICE_FILL: Record<1 | 2 | 3, string> = ComunicaColors.notice;

/** El degradado de marca. Solo lo lee `BrandGradient`. */
export const BRAND_GRADIENT = ComunicaColors.gradient;

/** Los 135° del plugin: de arriba a la izquierda a abajo a la derecha. */
export const BRAND_DIAGONAL = {
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
} as const;

/**
 * Brillo del bloque (el `::after` del hero del plugin, sin radiales: un
 * degradado lineal sale igual en iOS, Android y web). Al 15 % y no al 22 % del
 * plugin: con 22 % el blanco sobre el violeta se queda en ~4,0:1 y con 15 %
 * en ~4,7:1 (lo prueba el test del territorio).
 */
export const BRAND_SHEEN_ALPHA = 0.15;
export const BRAND_SHEEN = [
  hexAlpha('#fff', '26'),
  hexAlpha('#fff', '00'),
] as const;
/** Sombra suave abajo a la izquierda del bloque (el segundo radial del hero). */
export const BRAND_SHADE = [
  hexAlpha('#000', '00'),
  hexAlpha('#000', '1F'),
] as const;

/**
 * Velo oscuro para chips y cápsulas que van SOBRE un bloque de marca. Oscurece
 * en vez de aclarar, así el blanco de dentro siempre gana contraste.
 */
export const GRADIENT_OVERLAY = hexAlpha('#000', '2E');

export type ChipTone =
  'neutral' | 'positive' | 'warning' | 'negative' | 'accent' | 'info';

/** Roles de color del área para el modo activo. */
export function comunicaTheme(isDark: boolean) {
  const base = themeColors(isDark);
  const accentFill = ComunicaColors.accent;
  return {
    ...base,
    /** Relleno de la acción principal y lo que identifica al área. */
    accentFill,
    onAccent: onColor(accentFill),
    /** Acento como texto, icono o borde: legible en los dos modos. */
    accentText: isDark
      ? ComunicaColors.accentText.dark
      : ComunicaColors.accentText.light,
    /** Texto e icono sobre un bloque de degradado. */
    onGradient: '#fff',
    /** Tinta de un botón blanco sobre un bloque (violeta fijo, 6,7:1 sobre blanco). */
    onGradientInk: ComunicaColors.accent as string,
    /** Velo oscuro de chips y cápsulas que van sobre un bloque de marca. */
    gradientOverlay: GRADIENT_OVERLAY,
    /**
     * Borde de las tarjetas. En oscuro `separator` y `card` son el mismo gris,
     * así que la tarjeta la dibuja este borde, no la sombra.
     */
    cardBorder: isDark ? SystemGray.dark.gray3 : SystemGray.light.gray5,
    /** Relleno de un control apagado: distinto de `card` en los dos modos. */
    disabledFill: isDark ? SystemGray.dark.gray3 : SystemGray.light.gray5,
    /** Baldosa de icono en tinta suave (`.stic-dash-icon` del plugin). */
    iconTile: tintedGlyph(
      ComunicaColors.accent,
      base.card,
      isDark ? '40' : '1F',
    ),
    /** Fondo suave de los avisos ámbar («Te faltan 2 listas»). */
    // OPACO (compuesto sobre el fondo hundido): con un fondo translúcido y la
    // `elevation` de `CardSurface`, Android pinta la sombra a través del fondo y
    // salía un marco tostado con un rectángulo de esquinas duras dentro.
    warningSoft: compositeOver(
      ToastColors.warning,
      isDark ? '33' : '1F',
      base.backgroundSunken,
    ),
    warningText: isDark ? brand.yellow : base.text,
    warningIcon: ToastColors.warning,
    /** Rojo legible como texto («3 ausencias seguidas»), en los dos modos. */
    dangerText: readableOn(SwipeColors.remove, base.card),
    /** Chips: fondo suave + texto legible por tono. */
    chip(tone: ChipTone) {
      const fill =
        tone === 'positive'
          ? SwipeColors.add
          : tone === 'warning'
            ? ToastColors.warning
            : tone === 'negative'
              ? SwipeColors.remove
              : tone === 'accent'
                ? accentFill
                : tone === 'info'
                  ? brand.info
                  : null;
      if (!fill) {
        return { background: base.backgroundSunken, text: base.textSecondary };
      }
      return {
        background: hexAlpha(fill, isDark ? '40' : '24'),
        text: base.text,
      };
    },
  };
}

export type ComunicaTheme = ReturnType<typeof comunicaTheme>;
