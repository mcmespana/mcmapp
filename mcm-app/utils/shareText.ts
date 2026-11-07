import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { logger } from '@/utils/logger';

/**
 * Compartir un texto sin que falle en silencio.
 *
 * En web, `Share.share` de react-native-web solo funciona si el navegador
 * tiene Web Share (`navigator.share`); si no —Firefox y Chrome de escritorio—
 * devuelve una promesa RECHAZADA. Nadie la capturaba: la acción «Compartir»
 * parecía muerta y dejaba un `unhandledrejection`. Aquí, sin Web Share, se
 * copia al portapapeles y se avisa, que es lo que ya hacía la playlist.
 */

export type ShareTextOutcome = 'shared' | 'copied' | 'dismissed' | 'failed';

export interface ShareTextOptions {
  /** Aviso breve para la persona; normalmente `(label) => toast.show({ label })`. */
  notify?: (label: string) => void;
  /** Aviso cuando se ha copiado en vez de compartir. */
  copiedLabel?: string;
  /**
   * En escritorio (web, Windows, macOS) copiar SIEMPRE, aunque el navegador
   * tenga Web Share. Para textos largos que se van a pegar en otro sitio.
   */
  copyOnDesktop?: boolean;
}

const DEFAULT_COPIED_LABEL = 'Copiado al portapapeles';
const FAILED_LABEL = 'No se pudo compartir';

function isDesktopLike(): boolean {
  const os: string = Platform.OS;
  return os === 'web' || os === 'windows' || os === 'macos';
}

function hasWebShare(): boolean {
  return (
    typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  );
}

/** El usuario cerró la hoja de compartir: no es un error. */
function isAbort(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

async function copy(
  message: string,
  { notify, copiedLabel = DEFAULT_COPIED_LABEL }: ShareTextOptions,
): Promise<ShareTextOutcome> {
  try {
    await Clipboard.setStringAsync(message);
    notify?.(copiedLabel);
    return 'copied';
  } catch (error) {
    logger.warn('[shareText] no se pudo copiar', error);
    notify?.(FAILED_LABEL);
    return 'failed';
  }
}

export async function shareText(
  message: string,
  options: ShareTextOptions = {},
): Promise<ShareTextOutcome> {
  const desktop = isDesktopLike();
  const web = Platform.OS === 'web';
  // Windows/macOS nativos no tienen hoja de compartir útil: se copia.
  if (desktop && (options.copyOnDesktop || !web || !hasWebShare())) {
    return copy(message, options);
  }
  try {
    const result = await Share.share({ message });
    return result?.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch (error) {
    if (isAbort(error)) return 'dismissed';
    // En web, si Web Share falla por otra cosa (permisos, contexto no
    // seguro…), copiar sigue siendo mejor que nada.
    if (web) return copy(message, options);
    logger.warn('[shareText] no se pudo compartir', error);
    options.notify?.(FAILED_LABEL);
    return 'failed';
  }
}
