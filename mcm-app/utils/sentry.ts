// Crash reporting con Sentry.
//
// Diseñado para que la app funcione EXACTAMENTE igual cuando Sentry no está
// configurado: sin `EXPO_PUBLIC_SENTRY_DSN` no se llama a `Sentry.init()` y
// todo lo demás (incluido el `wrap` del layout) es un paso a través. Así el
// binario puede llevar el SDK nativo y decidirse después, por OTA, si se
// empieza a reportar o no — que es justo lo que interesa en una build de
// tienda: el código nativo NO se puede añadir luego.
//
// Qué se reporta:
//   - Crashes nativos y excepciones de JS no capturadas (automático).
//   - `logger.error(...)` y `logger.warn(...)` de toda la app, vía el enganche
//     `setReporter` que ya existía en `utils/logger.ts`.
//   - El `ErrorBoundary` de la app, que ya llama a `logger.error`.
//
// Qué NO se reporta: nada de `logger.debug/info/log` (solo salen en dev).

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

import { logger, setReporter } from '@/utils/logger';

/**
 * DSN del proyecto de Sentry. Vacío = Sentry apagado (comportamiento por
 * defecto hasta que se configure la variable). Ver `.env.example`.
 */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? '';

/**
 * Modo verificación. Con `EXPO_PUBLIC_SENTRY_DEBUG=1`:
 *   - Sentry reporta TAMBIÉN en desarrollo (normalmente se calla, para no
 *     llenar el proyecto con nuestras propias pruebas).
 *   - Se manda un evento "ping" al arrancar, que es la forma de comprobar de
 *     una sentada que DSN, red y proyecto están bien sin tener que provocar un
 *     crash de verdad.
 * Se apaga quitando la variable. Ver `docs/desarrollo/BUILD_AGOSTO_2026.md`.
 */
const DEBUG_MODE = process.env.EXPO_PUBLIC_SENTRY_DEBUG === '1';

/**
 * `development` | `preview` | `production`. Sale del canal de EAS Update, que
 * es lo que de verdad distingue una build de otra en runtime; en dev local no
 * hay canal y se marca como `development`.
 */
function resolveEnvironment(): string {
  const channel =
    (Constants.expoConfig as { updates?: { channel?: string } } | null)?.updates
      ?.channel ??
    (
      Constants.manifest2 as {
        extra?: { expoClient?: { updates?: { channel?: string } } };
      } | null
    )?.extra?.expoClient?.updates?.channel;
  if (channel) return channel;
  return __DEV__ ? 'development' : 'production';
}

/** ¿Está Sentry configurado en esta build? */
export const isSentryEnabled = DSN.length > 0;

let started = false;

/**
 * Arranca Sentry. Idempotente y silenciosa si no hay DSN. Se invoca al final
 * de este mismo módulo: los `import` se elevan, así que la única forma de que
 * Sentry arranque ANTES que el resto del árbol de módulos es que sea un efecto
 * de cargar este fichero y que `app/_layout.tsx` lo importe el primero.
 */
export function initSentry(): void {
  if (started || !isSentryEnabled) return;
  started = true;

  Sentry.init({
    dsn: DSN,
    environment: resolveEnvironment(),
    // La versión de la app y el runtime salen del propio manifiesto; añadir el
    // release a mano aquí lo desincronizaría con el que sube el plugin al
    // compilar (los source maps dejarían de casar).
    // En dev el SDK no envía nada: no queremos ruido de nuestras pruebas.
    enabled: !__DEV__ || DEBUG_MODE,
    // Sin trazas de rendimiento: hoy solo interesan los errores, y el sampling
    // de performance es lo que dispara la cuota del plan gratuito.
    tracesSampleRate: 0,
    // El breadcrumb de cada petición de red puede arrastrar URLs con tokens.
    sendDefaultPii: false,
    attachStacktrace: true,
  });

  // Todo lo que ya pasaba por el logger central se reporta también a Sentry.
  setReporter({
    warn: (...args) => {
      Sentry.captureMessage(formatArgs(args), 'warning');
    },
    error: (...args) => {
      const error = args.find((arg) => arg instanceof Error);
      if (error) {
        Sentry.captureException(error, {
          extra: { detalle: formatArgs(args) },
        });
      } else {
        Sentry.captureMessage(formatArgs(args), 'error');
      }
    },
  });

  logger.info('[sentry] activado en', resolveEnvironment());

  if (DEBUG_MODE) {
    Sentry.captureMessage(
      `[sentry] ping de verificación (${resolveEnvironment()})`,
      'info',
    );
  }
}

/**
 * Envuelve el componente raíz. Sin DSN devuelve el componente TAL CUAL, para
 * no meter un árbol extra ni instrumentación de navegación cuando Sentry está
 * apagado.
 */
export function wrapRoot(
  Root: React.ComponentType<Record<string, unknown>>,
): React.ComponentType<Record<string, unknown>> {
  if (!isSentryEnabled) return Root;
  return Sentry.wrap(Root);
}

initSentry();

/** Aplana los argumentos de un `logger.warn/error` en un mensaje legible. */
function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
}
