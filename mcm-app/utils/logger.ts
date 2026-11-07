/**
 * Logger centralizado de la app.
 *
 * Sustituye a los `console.*` repartidos por el código. Centraliza el control
 * de qué se imprime según el entorno y deja un único punto de enganche para
 * reportar a un servicio externo (Sentry, etc.) cuando se integre — ver
 * `setReporter`.
 *
 * Reglas:
 * - `debug` / `info` / `log` → solo en desarrollo (`__DEV__`). En producción
 *   se silencian para no ensuciar la consola del dispositivo.
 * - `warn` / `error` → siempre se imprimen y, si hay un reporter configurado,
 *   se le reenvían (en producción es donde más interesa capturarlos).
 *
 * El API replica el de `console` (mismos nombres de método) para que la
 * migración sea un reemplazo directo.
 */

type LogArgs = unknown[];

/**
 * Enganche opcional para crash reporting. Cuando se integre Sentry (ver
 * `docs/planes/archivo/MEJORAS.md` §8.1) basta con llamar a `setReporter` una vez en
 * el arranque para que todos los `logger.warn`/`logger.error` se reporten.
 */
export interface LogReporter {
  warn?: (...args: LogArgs) => void;
  error?: (...args: LogArgs) => void;
}

let reporter: LogReporter | null = null;

export function setReporter(next: LogReporter | null): void {
  reporter = next;
}

// `__DEV__` está disponible en React Native / Expo. Lo leemos vía `globalThis`
// (en cada llamada, no al cargar el módulo) para no depender de los tipos
// globales de RN y resolver con seguridad en entornos donde no exista (p.ej.
// tests con Node).
const isDev = (): boolean =>
  (globalThis as { __DEV__?: boolean }).__DEV__ ?? false;

export const logger = {
  debug: (...args: LogArgs): void => {
    if (isDev()) console.debug(...args);
  },
  info: (...args: LogArgs): void => {
    if (isDev()) console.info(...args);
  },
  log: (...args: LogArgs): void => {
    if (isDev()) console.log(...args);
  },
  warn: (...args: LogArgs): void => {
    console.warn(...args);
    reporter?.warn?.(...args);
  },
  error: (...args: LogArgs): void => {
    console.error(...args);
    reporter?.error?.(...args);
  },
};

export default logger;
