import { Platform } from 'react-native';

/**
 * Opciones de cabecera TRANSPARENTE para las portadas de pestaña (Inicio, Más),
 * como la del Cantoral o Contigo: en iOS el contenido pasa por debajo y, al
 * hacer scroll, el sistema pone el cristal difuminado (iOS 26) o el material de
 * barra (iOS < 26). En Android y web la cabecera sigue siendo opaca.
 *
 * La pantalla tiene que llevar `contentInsetAdjustmentBehavior="automatic"` en
 * su scroll: así el sistema reserva la altura de la cabecera él solo (poner
 * además un `paddingTop` a mano la contaba dos veces).
 */
export function transparentHeaderOptions() {
  if (Platform.OS !== 'ios') return { headerTransparent: false };
  return {
    headerTransparent: true,
    ...(parseInt(String(Platform.Version), 10) < 26
      ? { headerBlurEffect: 'systemChromeMaterial' as const }
      : {}),
  };
}
