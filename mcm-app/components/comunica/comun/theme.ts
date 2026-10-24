// components/comunica/comun/theme.ts
//
// El color del área privada nativa, en UN sitio (plan 03 §2).
//
// ⚠️ PROVISIONAL. Falta la decisión `territorio` del propietario (¿territorio
// «Comunica» con su acento y el degradado solo en la acción principal, o
// institucional puro?). Mientras tanto el área usa los tokens de la app, y
// todo lo que tiene color en `components/comunica/` y en sus pantallas sale de
// aquí: cuando se decida, se cambia este fichero y nada más.
//
// De dónde sale cada cosa, hoy:
//   · Acento: el morado LC de la pestaña Comunica (`TabHeaderColors.comunica`,
//     opaco: `brand.purple`). Como relleno, en los dos modos; como texto o
//     icono, el rol `link` (el morado no se lee en oscuro, `design.md` §3).
//   · Marcas de asistencia: los colores de sistema que ya hay (`SwipeColors`
//     de Apple para el verde y el rojo, `ToastColors.warning` para el ámbar,
//     `brand.info` para «Parcial»). Siempre como RELLENO con el icono encima en
//     `onColor()`, nunca como texto suelto. Si se decide el territorio, aquí
//     cabría una paleta propia de estados.
//   · Etapas: los colores de la marca de cada una (MIC rojo, COM verde, LC
//     morado), como el punto de color del plugin.

import brand, {
  SwipeColors,
  SystemGray,
  themeColors,
  ToastColors,
} from '@/constants/colors';
import type { SetMark, Stage } from '@/services/comunica/contract';
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

export type ChipTone =
  'neutral' | 'positive' | 'warning' | 'negative' | 'accent';

/** Roles de color del área para el modo activo. */
export function comunicaTheme(isDark: boolean) {
  const base = themeColors(isDark);
  const accentFill = brand.purple;
  return {
    ...base,
    /** Relleno de la acción principal y lo que identifica al área. */
    accentFill,
    onAccent: onColor(accentFill),
    /** Acento como texto, icono o borde: legible en los dos modos. */
    accentText: base.link,
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
