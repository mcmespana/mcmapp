import { Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { logger } from '@/utils/logger';

/**
 * Mecánica de suscripción al canal `preview` de EAS Update.
 *
 * ## Por qué esto no funcionaba antes
 *
 * La versión anterior usaba `Updates.setUpdateURLAndRequestHeadersOverride()`.
 * Esa API:
 *
 *   1. **Exige `updates.disableAntiBrickingMeasures: true` en el binario.** Es
 *      config nativa (Expo.plist / AndroidManifest), así que no se puede
 *      activar por OTA: hacía falta una build de tienda que nunca llegó. Sin el
 *      flag, la llamada lanza y el toggle no hacía absolutamente nada.
 *   2. Aunque el flag estuviera, **el override de URL no surte efecto hasta que
 *      la app se cierra y se vuelve a abrir del todo** — `checkForUpdateAsync()`
 *      en la misma sesión seguía yendo a `production`.
 *   3. Desactivar las anti-bricking measures es peligroso en producción: quita
 *      la protección que garantiza que siempre se pueda publicar un update que
 *      arregle un update roto. Expo lo desaconseja explícitamente.
 *
 * ## Cómo funciona ahora
 *
 * `Updates.setUpdateRequestHeadersOverride()` (expo-updates ≥ 29, aquí 57.x)
 * sobreescribe **solo las cabeceras** de la petición de update — que es todo lo
 * que hace falta, porque el canal viaja en `expo-channel-name`. A cambio:
 *
 *   - **No necesita `disableAntiBrickingMeasures`.** Funciona en cualquier build
 *     de EAS, incluida la que ya está en las tiendas.
 *   - **Muta la configuración viva**, no solo la persistida: el
 *     `checkForUpdateAsync()` inmediatamente posterior ya va al canal nuevo.
 *   - **Se persiste en el almacenamiento nativo** (SharedPreferences / User
 *     Defaults), así que el chequeo automático que expo-updates hace al arrancar
 *     —antes de que corra una sola línea de JS— también sale por `preview`.
 *
 * Único requisito: que la build declare `expo-channel-name` entre sus cabeceras
 * embebidas. EAS Build lo hace solo a partir del `channel` de `eas.json` (los
 * cuatro perfiles lo tienen), y expo-updates rechaza el override si la clave no
 * estaba en el binario — de ahí `unsupported-build`.
 *
 * Ver `docs/funcionalidades/CANAL_PREVIEW.md`.
 */

export const PREVIEW_CHANNEL = 'preview';
export const PRODUCTION_CHANNEL = 'production';
export const CHANNEL_HEADER = 'expo-channel-name';

/** `__DEV__` leído de `globalThis` para poder simularlo en tests. */
const isDev = (): boolean =>
  (globalThis as { __DEV__?: boolean }).__DEV__ ?? false;

export type UnsupportedReason =
  /** La web no tiene expo-updates. */
  | 'web'
  /** Expo Go o dev client: los updates OTA no aplican. */
  | 'dev'
  /** Binario sin EAS Update activo. */
  | 'disabled'
  /** El binario no declara `expo-channel-name`: hace falta build nueva. */
  | 'build';

/** Resultado de aplicar el canal. Solo `ok` significa "el flag es verdad". */
export type ApplyResult =
  | { ok: true }
  | { ok: false; kind: 'unsupported'; reason: UnsupportedReason }
  | { ok: false; kind: 'error'; message: string };

/** Resultado de buscar update en el canal ya aplicado. */
export type FetchResult =
  /** Update nuevo descargado: falta reiniciar para estrenarlo. */
  | { kind: 'ready' }
  /** No hay nada nuevo que descargar en ese canal. */
  | { kind: 'up-to-date' }
  /**
   * Falló la comprobación (típicamente: sin red). El canal SÍ quedó aplicado y
   * persistido, así que en el próximo arranque se pedirá el update del canal
   * nuevo — este fallo no invalida el cambio.
   */
  | { kind: 'check-failed'; message: string };

/** ¿Puede este dispositivo/binario cambiar de canal en caliente? */
export function getUnsupportedReason(): UnsupportedReason | null {
  if (Platform.OS === 'web') return 'web';
  if (isDev()) return 'dev';
  if (!Updates.isEnabled) return 'disabled';
  if (typeof Updates.setUpdateRequestHeadersOverride !== 'function') {
    // expo-updates < 29 en el binario instalado.
    return 'build';
  }
  return null;
}

function describeError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return String(err);
}

/**
 * expo-updates lanza `ERR_UPDATES_RUNTIME_OVERRIDE` cuando la cabecera que
 * intentas sobreescribir no venía declarada en el binario. Es el caso "build
 * demasiado antigua / hecha sin canal": no hay nada que hacer desde JS.
 */
function isMissingHeaderError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  if (code === 'ERR_UPDATES_RUNTIME_OVERRIDE') return true;
  return /requestHeaders|expo-channel-name/i.test(describeError(err));
}

/**
 * Limpia el override de URL que dejaban las versiones antiguas de este módulo.
 *
 * Se persiste en el almacenamiento nativo y tiene prioridad sobre el de
 * cabeceras (de hecho, guardarlo a `null` borra la entrada entera), así que hay
 * que limpiarlo **antes** de aplicar el nuestro. En los binarios que no llevan
 * `disableAntiBrickingMeasures` la llamada lanza — que es justo el caso en el
 * que no hay nada que limpiar.
 */
export function clearLegacyUrlOverride(): void {
  try {
    Updates.setUpdateURLAndRequestHeadersOverride?.(null);
  } catch {
    // Esperado en binarios sin `disableAntiBrickingMeasures`. No hay override
    // heredado que borrar.
  }
}

/**
 * Aplica (o quita) el override de canal. Lanza si el binario no lo admite.
 *
 * `null` no significa "production": significa "vuelve al canal con el que se
 * construyó el binario". Para la app de tienda eso es `production`; para un APK
 * de preview interno, `preview`. Es el comportamiento correcto en ambos casos.
 */
export function applyChannelOverride(preview: boolean): void {
  Updates.setUpdateRequestHeadersOverride(
    preview ? { [CHANNEL_HEADER]: PREVIEW_CHANNEL } : null,
  );
}

/**
 * Deja el override nativo alineado con el flag persistido. Se llama en cada
 * arranque: es idempotente y, sobre todo, **autocura los desajustes** — si el
 * flag está apagado nos aseguramos de que no quede ningún override colgado
 * apuntando a `preview`, y si está encendido lo reafirmamos por si el binario
 * es nuevo y aún no lo tenía.
 */
export function syncChannelOverride(
  preview: boolean,
): UnsupportedReason | null {
  const unsupported = getUnsupportedReason();
  if (unsupported) return unsupported;

  clearLegacyUrlOverride();
  try {
    applyChannelOverride(preview);
    return null;
  } catch (err) {
    logger.warn('[PreviewChannel] no se pudo aplicar el canal:', err);
    return isMissingHeaderError(err) ? 'build' : 'disabled';
  }
}

/**
 * Paso 1 del cambio de canal: aplicar el override.
 *
 * Es síncrono y, si devuelve `ok`, el cambio **ya está persistido en nativo**.
 * A partir de ese momento el canal es real aunque la app se cierre de golpe, y
 * por eso el flag de AsyncStorage debe guardarse justo aquí y no al final.
 */
export function applyChannel(preview: boolean): ApplyResult {
  const unsupported = getUnsupportedReason();
  if (unsupported)
    return { ok: false, kind: 'unsupported', reason: unsupported };

  clearLegacyUrlOverride();
  try {
    applyChannelOverride(preview);
    return { ok: true };
  } catch (err) {
    logger.warn('[PreviewChannel] override rechazado por el binario:', err);
    if (isMissingHeaderError(err)) {
      return { ok: false, kind: 'unsupported', reason: 'build' };
    }
    return { ok: false, kind: 'error', message: describeError(err) };
  }
}

/**
 * Paso 2: buscar y descargar el update del canal recién aplicado.
 *
 * Funciona en la misma sesión porque el override muta la configuración viva de
 * expo-updates, no solo la persistida — esta es justamente la diferencia con la
 * API de override de URL que se usaba antes.
 */
export async function fetchFromCurrentChannel(): Promise<FetchResult> {
  try {
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return { kind: 'up-to-date' };
    const fetched = await Updates.fetchUpdateAsync();
    return fetched.isNew ? { kind: 'ready' } : { kind: 'up-to-date' };
  } catch (err) {
    logger.warn('[PreviewChannel] canal aplicado pero falló el check:', err);
    return { kind: 'check-failed', message: describeError(err) };
  }
}

/**
 * Datos de diagnóstico para enseñar en el modal. `Updates.channel` es el canal
 * **realmente en uso ahora mismo**: no refleja el override hasta que la app se
 * reinicia, y esa diferencia es exactamente lo que hay que poder ver.
 */
export function readChannelDiagnostics(): {
  activeChannel: string | null;
  runtimeVersion: string | null;
  updateId: string | null;
  isEmbeddedLaunch: boolean;
} {
  try {
    return {
      activeChannel: Updates.channel ?? null,
      runtimeVersion: Updates.runtimeVersion ?? null,
      updateId: Updates.updateId ?? null,
      isEmbeddedLaunch: Boolean(Updates.isEmbeddedLaunch),
    };
  } catch {
    return {
      activeChannel: null,
      runtimeVersion: null,
      updateId: null,
      isEmbeddedLaunch: false,
    };
  }
}

/** Reinicia la app para estrenar el bundle descargado. */
export async function restartApp(): Promise<void> {
  await Updates.reloadAsync();
}
