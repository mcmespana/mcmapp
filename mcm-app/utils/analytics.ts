// Analítica de uso con Aptabase.
//
// Por qué Aptabase y no otra: no guarda ningún identificador persistente del
// dispositivo ni del usuario. Lo único que agrupa los eventos es un `sessionId`
// aleatorio que se genera al arrancar y caduca a la hora de inactividad, así
// que no hay forma de seguir a nadie entre sesiones ni de reconstruir un
// historial personal. Para una app con menores en el público eso no es un
// detalle menor, es el motivo de la elección.
//
// Mismo patrón que Sentry: **sin `EXPO_PUBLIC_APTABASE_KEY` no se envía nada**
// y todas las funciones son no-ops. Así el binario puede llevar el SDK y se
// decide después, por OTA, si se empieza a medir.
//
// Lo que se manda va TODO por `constants/analyticsEvents.ts`: nombres y
// propiedades tipados, lista cerrada. Ver allí las reglas.

import {
  init as aptabaseInit,
  trackEvent as aptabaseTrack,
} from '@aptabase/react-native';
import Constants from 'expo-constants';

import type {
  AnalyticsBaseProps,
  AnalyticsEventName,
  AnalyticsEvents,
} from '@/constants/analyticsEvents';
import { logger } from '@/utils/logger';

/**
 * App Key de Aptabase, con el formato `A-<REGION>-<id>`. La región va dentro
 * de la propia clave: `A-EU-…` manda a los servidores europeos.
 */
const APP_KEY = process.env.EXPO_PUBLIC_APTABASE_KEY ?? '';

/** Host propio, solo si algún día se autoaloja (claves `A-SH-…`). */
const SELF_HOSTED_HOST = process.env.EXPO_PUBLIC_APTABASE_HOST;

/** ¿Está la analítica configurada en esta build? */
export const isAnalyticsEnabled = APP_KEY.length > 0;

let started = false;

/**
 * Propiedades comunes de cada evento. Aptabase no tiene "propiedades de
 * usuario", así que se adjuntan a mano. Son categorías gruesas (perfil y
 * delegación), nunca datos de una persona concreta.
 */
let baseProps: AnalyticsBaseProps = {
  perfil: 'sin_perfil',
  delegacion: 'sin_delegacion',
};

/**
 * Arranca Aptabase. Idempotente y silenciosa sin clave. Se llama una vez al
 * montar la app (ver `hooks/useScreenTracking.ts`).
 */
export function initAnalytics(): void {
  if (started || !isAnalyticsEnabled) return;
  started = true;

  try {
    aptabaseInit(APP_KEY, {
      // El SDK lee la versión de su propio módulo nativo; se la damos nosotros
      // desde el manifiesto para no depender de él (y para que en web, donde
      // no hay módulo nativo, también salga bien).
      appVersion: Constants.expoConfig?.version ?? '0.0.0',
      // La web es una PWA de verdad, no un experimento: interesa medirla igual.
      enableWeb: true,
      ...(SELF_HOSTED_HOST ? { host: SELF_HOSTED_HOST } : {}),
    });
  } catch (error) {
    started = false;
    logger.warn('[analytics] no se pudo inicializar:', error);
  }
}

/**
 * Actualiza el perfil y la delegación que acompañan a los eventos. Se llama
 * cuando el perfil del usuario cambia (onboarding, cambio manual).
 */
export function setAnalyticsProfile(props: Partial<AnalyticsBaseProps>): void {
  baseProps = { ...baseProps, ...props };
}

/**
 * Registra un evento. El tipo obliga a que el nombre esté en el catálogo y a
 * que las propiedades sean las suyas — un evento inventado no compila.
 *
 * Nunca lanza: una analítica no puede tumbar una pantalla.
 */
export function trackEvent<E extends AnalyticsEventName>(
  name: E,
  // Los eventos sin propiedades propias no aceptan segundo argumento; los que
  // sí las tienen lo exigen. Se traduce en que olvidarse una propiedad —o
  // inventarse una— es un error de compilación, no un dato silenciosamente mal.
  ...rest: keyof AnalyticsEvents[E] extends never
    ? []
    : [props: AnalyticsEvents[E]]
): void {
  if (!isAnalyticsEnabled || !started) return;
  try {
    aptabaseTrack(name, { ...baseProps, ...(rest[0] ?? {}) });
  } catch (error) {
    logger.warn('[analytics] evento descartado:', name, error);
  }
}
