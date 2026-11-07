import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const isNative = Platform.OS !== 'web';
const isAndroid = Platform.OS === 'android';

const { AndroidHaptics } = Haptics;

/**
 * Háptica del SISTEMA en Android (`View.performHapticFeedback`), no el
 * `Vibrator`.
 *
 * `impactAsync` y `notificationAsync` en Android se simulan con el motor de
 * vibración: un zumbido, no el clic seco que hace el sistema al pulsar una
 * tecla o abrir un menú. La propia doc de expo-haptics desaconseja el
 * `Vibrator` para esto y remite a `performAndroidHapticsAsync`, que además
 * respeta el ajuste «Respuesta táctil» del teléfono.
 *
 * Varios tipos son de Android 11+ (`Confirm`, `Reject`, `Gesture_End`) o 14+
 * (`Segment_Tick`): en un teléfono más viejo la promesa se rechaza, y entonces
 * se reintenta con `fallback`, que tiene que ser uno de los que existen en
 * todas las versiones (`Context_Click`, `Clock_Tick`, `Virtual_Key`,
 * `Long_Press`, `Keyboard_Tap`).
 */
function android(
  type: Haptics.AndroidHaptics,
  fallback: Haptics.AndroidHaptics = AndroidHaptics.Context_Click,
): Promise<void> {
  return Haptics.performAndroidHapticsAsync(type).catch(() =>
    type === fallback
      ? undefined
      : Haptics.performAndroidHapticsAsync(fallback).catch(() => {}),
  );
}

function impact(
  style: Haptics.ImpactFeedbackStyle,
  androidType: Haptics.AndroidHaptics,
): Promise<void> | undefined {
  if (!isNative) return;
  if (isAndroid) return android(androidType);
  return Haptics.impactAsync(style).catch(() => {});
}

function notify(
  type: Haptics.NotificationFeedbackType,
  androidType: Haptics.AndroidHaptics,
): Promise<void> | undefined {
  if (!isNative) return;
  if (isAndroid) return android(androidType, AndroidHaptics.Long_Press);
  return Haptics.notificationAsync(type).catch(() => {});
}

export const h = {
  tap: () =>
    impact(Haptics.ImpactFeedbackStyle.Light, AndroidHaptics.Context_Click),

  select: () => {
    if (!isNative) return;
    if (isAndroid)
      return android(AndroidHaptics.Segment_Tick, AndroidHaptics.Clock_Tick);
    return Haptics.selectionAsync().catch(() => {});
  },

  add: () =>
    impact(Haptics.ImpactFeedbackStyle.Medium, AndroidHaptics.Virtual_Key),

  remove: () =>
    impact(Haptics.ImpactFeedbackStyle.Rigid, AndroidHaptics.Gesture_End),

  success: () =>
    notify(Haptics.NotificationFeedbackType.Success, AndroidHaptics.Confirm),

  error: () =>
    notify(Haptics.NotificationFeedbackType.Error, AndroidHaptics.Reject),

  /**
   * Tope alcanzado: el gesto era válido pero no se puede ir más allá (cejilla
   * por debajo de 0, por ejemplo). Un golpe seco y corto, distinto del `select`
   * de un paso que SÍ ha ocurrido — si no, el usuario no distingue "ha bajado"
   * de "no puede bajar más".
   */
  limit: () =>
    notify(Haptics.NotificationFeedbackType.Warning, AndroidHaptics.Reject),

  toggle: () =>
    impact(Haptics.ImpactFeedbackStyle.Rigid, AndroidHaptics.Clock_Tick),

  menuOpen: () =>
    impact(Haptics.ImpactFeedbackStyle.Medium, AndroidHaptics.Virtual_Key),

  menuClose: () =>
    impact(Haptics.ImpactFeedbackStyle.Light, AndroidHaptics.Context_Click),

  navigate: () =>
    impact(Haptics.ImpactFeedbackStyle.Light, AndroidHaptics.Context_Click),

  /**
   * Envío de formulario completado. En iOS, tres golpes que crecen; en Android
   * UNO solo (`Confirm`): encadenar vibraciones ahí es un zumbido largo, y el
   * patrón de confirmación del sistema ya dice "hecho".
   */
  formSuccess: () => {
    if (!isNative) return;
    if (isAndroid) {
      android(AndroidHaptics.Confirm, AndroidHaptics.Long_Press);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTimeout(
      () =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
      100,
    );
    setTimeout(
      () =>
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {}),
      250,
    );
  },

  // --- Carismochito (easter egg) ---
  // Se quedan con el Vibrator también en Android a propósito: aquí el zumbido
  // festivo ES el efecto, no un clic de interfaz.
  /** Golpe seco al detectar el agitado del móvil. */
  shake: () =>
    isNative &&
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}),

  /** Secuencia festiva al ACTIVAR el modo carismochito. */
  carismoOn: () => {
    if (!isNative) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setTimeout(
      () =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}),
      90,
    );
    setTimeout(
      () =>
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {}),
      220,
    );
  },

  /** Doble golpe rígido al DESACTIVAR el modo carismochito. */
  carismoOff: () => {
    if (!isNative) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {});
    setTimeout(
      () =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
      110,
    );
  },
};
