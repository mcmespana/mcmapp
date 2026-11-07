import { Linking, Platform } from 'react-native';
import { logger } from '@/utils/logger';

const IOS_APP_ID = '6745557177';
const ANDROID_PACKAGE = 'com.mcmespana.mcmapp';

const STORE_URLS = {
  ios: `https://apps.apple.com/app/id${IOS_APP_ID}`,
  iosNative: `itms-apps://apps.apple.com/app/id${IOS_APP_ID}`,
  android: `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`,
  androidNative: `market://details?id=${ANDROID_PACKAGE}`,
} as const;

type StorePlatform = 'ios' | 'android';

/**
 * `Platform.OS` es 'web' cuando la app corre en el navegador (incluida la PWA
 * en un iPhone) — ahí hay que mirar el user-agent para no mandar a un usuario
 * de iOS a la Play Store.
 */
function detectStorePlatform(): StorePlatform | null {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
  }
  return null;
}

/**
 * Abre la tienda correspondiente a la plataforma actual. En nativo intenta
 * primero el esquema que abre la app de la tienda directamente (`itms-apps://`
 * / `market://`) para no dejar al usuario tirado en el navegador — si el
 * esquema no está disponible (p.ej. simulador), cae al enlace https normal.
 */
export async function openAppStore(): Promise<void> {
  const platform = detectStorePlatform();

  if (platform === 'ios') {
    try {
      await Linking.openURL(STORE_URLS.iosNative);
      return;
    } catch {
      // Sin App Store nativa disponible — probamos el enlace web.
    }
    Linking.openURL(STORE_URLS.ios).catch((e) => logger.error(e));
    return;
  }

  if (platform === 'android') {
    try {
      await Linking.openURL(STORE_URLS.androidNative);
      return;
    } catch {
      // Sin Play Store nativa disponible — probamos el enlace web.
    }
    Linking.openURL(STORE_URLS.android).catch((e) => logger.error(e));
    return;
  }

  // Plataforma no identificable (web de escritorio, etc.) — destino por defecto.
  Linking.openURL(STORE_URLS.ios).catch((e) => logger.error(e));
}
