// Espacio que hay que dejar libre al final de una pantalla para que la barra
// de pestañas flotante no tape el contenido.
//
// Antes del cambio a barra flotante esto no existía y cada pantalla llevaba su
// `paddingBottom` a ojo (100, 120, 140…) casi siempre detrás de un
// `Platform.OS === 'ios' &&`: en Android no hacía falta porque la barra era
// opaca y ocupaba layout. Ahora flota sobre el contenido en AMBAS plataformas,
// así que el hueco hay que reservarlo siempre.
//
// En web sigue la barra clásica de expo-router, que ocupa su propio sitio, por
// lo que devuelve 0.

import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_CLEARANCE } from '@/constants/spacing';

/**
 * @param extra Espacio adicional por encima del hueco de la barra (por ejemplo
 *   si la pantalla tiene además un FAB o una barra de acciones flotante).
 */
export function useTabBarClearance(extra = 0): number {
  const insets = useSafeAreaInsets();

  if (Platform.OS === 'web') return extra;

  return TAB_BAR_CLEARANCE + insets.bottom + extra;
}

/**
 * `paddingBottom` del final de una lista o scroll que va bajo la barra de
 * pestañas: en nativo, el hueco de la barra (que ya trae su respiro); en web,
 * donde la barra ocupa su propio sitio, el padding normal de la pantalla.
 *
 * Existe porque el patrón que había —`Platform.OS === 'ios' ? 100 : 24`— es
 * de cuando la barra de Android era opaca: desde que flota en las dos
 * plataformas, en Android dejaba el último elemento debajo de la barra, sin
 * poder pulsarlo. (Y el 100 de iOS se quedaba corto: la barra va levantada el
 * safe-area inferior.)
 */
export function tabBarPaddingBottom(
  os: string,
  insetBottom: number,
  webPadding: number,
): number {
  return os === 'web' ? webPadding : TAB_BAR_CLEARANCE + insetBottom;
}

/** Hook de `tabBarPaddingBottom` para la plataforma y el safe-area actuales. */
export function useTabBarPaddingBottom(webPadding: number): number {
  const insets = useSafeAreaInsets();
  return tabBarPaddingBottom(Platform.OS, insets.bottom, webPadding);
}

export default useTabBarClearance;
