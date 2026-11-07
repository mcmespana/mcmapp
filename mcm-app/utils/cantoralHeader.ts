import { Platform } from 'react-native';
import { UIColors, themeColors } from '@/constants/colors';

/**
 * Color de los botones (back, iconos de `headerRight`) de la cabecera del
 * cantoral.
 *
 * La cabecera NO es la misma en todas las plataformas (`app/(tabs)/cancionero/_layout.tsx`):
 *  - iOS: transparente (glass) sobre el fondo de la pantalla → amarillo del
 *    cantoral en oscuro y azul en claro.
 *  - Android y web: barra amarilla SÓLIDA en los dos modos → siempre el casi
 *    negro de `headerTint` claro, el mismo que el back del stack.
 *
 * Antes cada pantalla lo decidía a su manera y en Android salían iconos
 * amarillos o blancos sobre la barra amarilla (1,0:1 y 1,7:1: invisibles).
 */
export function cantoralHeaderTint(
  isDark: boolean,
  os: typeof Platform.OS = Platform.OS,
): string {
  if (os === 'ios') {
    return isDark ? UIColors.accentYellow : UIColors.cantoralHeaderTintLight;
  }
  return themeColors(false).headerTint;
}
