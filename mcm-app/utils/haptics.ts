import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const isNative = Platform.OS !== 'web';

export const h = {
  tap: () =>
    isNative &&
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),

  select: () =>
    isNative &&
    (Platform.OS === 'ios'
      ? Haptics.selectionAsync().catch(() => {})
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})),

  add: () =>
    isNative &&
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),

  remove: () =>
    isNative &&
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {}),

  success: () =>
    isNative &&
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    ),

  error: () =>
    isNative &&
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
      () => {},
    ),

  toggle: () =>
    isNative &&
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch(() => {}),

  menuOpen: () =>
    isNative &&
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),

  menuClose: () =>
    isNative &&
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),

  navigate: () =>
    isNative &&
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),

  formSuccess: () => {
    if (!isNative) return;
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
