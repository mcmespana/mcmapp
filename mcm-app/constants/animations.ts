// constants/animations.ts
// Tokens canónicos de animación: duraciones y easings.
// Centraliza los magic numbers que estaban repartidos por la app
// (Toast 300ms, SongListItem 250ms, BreathingPhase 2100ms, etc.).

import { Easing } from 'react-native';
import { Easing as ReaEasing } from 'react-native-reanimated';

export const durations = {
  /** Microinteracciones, hover, press (web). */
  quick: 150,
  /** Transiciones estándar de UI (fade de fondo, toggle de selección). */
  base: 250,
  /** Toast show/hide, modales. */
  slow: 300,
  /** Loops largos: breathing, splash, ping. */
  hero: 800,
} as const;

export const easings = {
  /** Default de RN (sin curva personalizada) — para transiciones discretas. */
  standard: Easing.inOut(Easing.ease),
  /** Curva cúbica suave — para animaciones contemplativas (Contigo breathing). */
  cubic: Easing.inOut(Easing.cubic),
  /** Curva con rebote sutil — para confirmaciones (celebration burst). */
  bouncy: Easing.bezier(0.2, 0.8, 0.3, 1),
  /** Salida acelerada — para elementos que desaparecen. */
  exit: Easing.in(Easing.cubic),
} as const;

/**
 * Las MISMAS curvas, en la versión de Reanimated.
 *
 * Son dos módulos `Easing` distintos y **no son intercambiables**: el de
 * `react-native` es una función normal de JS y no se puede ejecutar dentro de
 * un worklet en el hilo de UI, que es justo donde corre `withTiming`. Se
 * mantienen aquí, al lado, para que una animación migrada conserve exactamente
 * la curva que tenía.
 */
export const reaEasings = {
  standard: ReaEasing.inOut(ReaEasing.ease),
  cubic: ReaEasing.inOut(ReaEasing.cubic),
  bouncy: ReaEasing.bezier(0.2, 0.8, 0.3, 1),
  exit: ReaEasing.in(ReaEasing.cubic),
} as const;

/**
 * Curvas y muelles canónicos de la skill `animate-expo` (Emil Kowalski).
 *
 * Las built-in de Reanimated son tan flojas como las de CSS; estas bézier son
 * las que la skill fija para UI. Se añaden AL LADO de `reaEasings` en vez de
 * sustituirlo para no cambiar el "feel" de lo que ya está afinado.
 *
 * Regla: nunca `ease-in` en un elemento que ENTRA o se mueve en pantalla
 * (retrasa justo el instante que el usuario está mirando). En una salida que
 * se va de pantalla sí vale acelerar — eso es `reaEasings.exit`.
 */
export const motionEasings = {
  /** Ease-out fuerte: entradas y salidas de UI. Default. */
  out: ReaEasing.bezier(0.23, 1, 0.32, 1),
  /** Movimiento/morph dentro de pantalla. */
  inOut: ReaEasing.bezier(0.77, 0, 0.175, 1),
  /** La curva de los sheets de iOS. */
  sheet: ReaEasing.bezier(0.32, 0.72, 0, 1),
} as const;

/**
 * Muelles en la forma de dos parámetros de Apple (`duration` + `dampingRatio`),
 * NO en mass/stiffness/damping. Úsalos siempre que un dedo haya intervenido:
 * un muelle arrastra la velocidad del gesto a través de una interrupción,
 * una curva de timing la reinicia.
 */
export const springs = {
  /** Asentar sin rebote. */
  settle: { duration: 400, dampingRatio: 1 },
  /** Volver a sitio tras un drag (pásale además `velocity`). */
  snap: { duration: 400, dampingRatio: 0.8 },
  /** Sheet / drawer. */
  sheet: { duration: 300, dampingRatio: 0.8 },
} as const;
