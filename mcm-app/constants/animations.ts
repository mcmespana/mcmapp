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
