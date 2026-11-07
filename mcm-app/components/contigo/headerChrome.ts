import { Platform } from 'react-native';
import { useHeaderHeight } from 'expo-router/react-navigation';

import spacing from '@/constants/spacing';
import { warm } from './theme';

/**
 * Fondo del header nativo de las pantallas de Contigo.
 *
 * Las cinco lo ponen `headerTransparent` para que se vea el degradado cálido
 * detrás, pero el fondo solo existía en iOS: en iOS < 26 lo da
 * `headerBlurEffect` y en iOS 26 lo pone el sistema (liquid glass). En Android
 * el header no tenía fondo, y al hacer scroll la lectura del evangelio, la
 * oración o la revisión pasaban por debajo del título, la flecha y el badge
 * litúrgico, todo mezclado. Android no emula blur (design.md §6): fondo
 * sólido del territorio, el mismo tono en el que arranca el degradado, así
 * que no se ve costura.
 */
export function contigoHeaderChrome(isDark: boolean) {
  if (Platform.OS === 'android') {
    return { headerStyle: { backgroundColor: warm(isDark).bg } };
  }
  if (Platform.OS === 'ios' && parseInt(String(Platform.Version), 10) < 26) {
    return { headerBlurEffect: 'systemChromeMaterial' as const };
  }
  return {};
}

/**
 * Hueco superior del contenido bajo ese header transparente: su altura REAL
 * (la mide el stack nativo) más un respiro. Antes iba a ojo
 * (`insets.top + 52/56`, o `68` en Android), y el header de Android mide 64:
 * el primer contenido arrancaba 8–12 px tapado.
 */
export function useContigoHeaderInset(): number {
  return useHeaderHeight() + spacing.sm;
}
