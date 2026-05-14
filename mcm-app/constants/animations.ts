// constants/animations.ts
// Tokens canónicos de animación: duraciones y easings.
// Centraliza los magic numbers que estaban repartidos por la app
// (Toast 300ms, SongListItem 250ms, BreathingPhase 2100ms, etc.).

import { Easing } from 'react-native';

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
