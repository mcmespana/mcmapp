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
//   · Degradado de marca (azul → violeta → magenta): SOLO en la acción
//     principal de cada pantalla, a través de `AreaPrimaryButton`. Un test
//     (`__tests__/comunica/territorio.test.ts`) impide usarlo en otro sitio.
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

/** El degradado de marca, solo para `AreaPrimaryButton`. */
export const BRAND_GRADIENT = ComunicaColors.gradient;

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
    /** Texto e icono sobre el degradado de la acción principal. */
    onGradient: '#fff',
    /** Fondo suave de los avisos ámbar («Te faltan 2 listas»). */
    warningSoft: hexAlpha(ToastColors.warning, isDark ? '33' : '1F'),
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
