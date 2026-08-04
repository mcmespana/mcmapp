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

export default useTabBarClearance;
