// Sentry en la WEB: apagado y sin SDK.
//
// Metro resuelve `@/utils/sentry` a este fichero al empaquetar para web (por
// el sufijo `.web.ts`, igual que `PlatformTabsLayout.web.tsx`). En iOS y
// Android sigue mandando `utils/sentry.ts`.
//
// Por qué: `@sentry/react-native` en web arrastra `@sentry/browser`,
// `@sentry/react` y las integraciones de Replay y Feedback — unos 865 KB del
// bundle web (el 10,8 %), se configurase o no el DSN. La web se usa sobre
// todo para preparar canciones en el ordenador y no hace falta su reporte de
// errores (decisión del usuario, 2026-10-16). Aquí no se importa NADA de
// Sentry: el `logger` sigue imprimiendo en consola y nadie le engancha un
// reporter.
//
// Misma API pública que `utils/sentry.ts` (lo comprueba
// `__tests__/sentryWeb.test.ts`): si algún día se añade una exportación allí,
// hay que añadir su versión vacía aquí o el bundle web no compila.

/** En web Sentry nunca está activo. */
export const isSentryEnabled = false;

/** No hace nada: en web no se arranca Sentry. */
export function initSentry(): void {}

/** Devuelve el componente raíz tal cual. */
export function wrapRoot(
  Root: React.ComponentType<Record<string, unknown>>,
): React.ComponentType<Record<string, unknown>> {
  return Root;
}
