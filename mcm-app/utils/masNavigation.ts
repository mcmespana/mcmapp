// utils/masNavigation.ts
// Simple pending-navigation store for deep-linking into the Más stack from
// outside (e.g. the Home screen quick-grid button, or una tarjeta de evento de
// la Home cuando `calendario`/`fotos` no están en la barra de pestañas y solo
// se alcanzan a través del stack de Más).
//
// Usage:
//   1. Caller sets a pending screen name (+ optional params) and then navigates
//      to the Más tab (`router.navigate('/mas')`).
//   2. MasHomeScreen reads and clears the pending screen on focus,
//      then programmatically navigates to it within the native stack.
//
// Dos salvaguardas para que un destino pendiente nunca dispare "a destiempo":
//   · CADUCIDAD: si nadie lo consume en unos segundos (porque la navegación al
//     tab no llegó a ocurrir, o el destino ya no existe), se descarta en vez de
//     quedarse esperando y saltar en la siguiente visita a "Más".
//   · SUSCRIPCIÓN: si MasHomeScreen YA está montada y con foco, `useFocusEffect`
//     no vuelve a dispararse; el listener le avisa en el acto.

import type { MasStackParamList } from '@/app/(tabs)/mas';

type PendingScreen = keyof MasStackParamList;

interface PendingNavigation {
  screen: PendingScreen;
  params?: Record<string, unknown>;
}

interface StoredNavigation extends PendingNavigation {
  /** Momento en que se guardó, para descartarlo si caduca. */
  at: number;
}

/** Margen para que el destino pendiente llegue a su pantalla. */
const PENDING_TTL_MS = 15000;

let pending: StoredNavigation | null = null;
const listeners = new Set<() => void>();

/**
 * Store the screen (and optional params) to navigate to inside the Más stack.
 *
 * @returns `true` si un suscriptor lo consumió EN EL ACTO (MasHomeScreen ya
 * estaba montada y con foco). En ese caso el llamador NO debe navegar además a
 * `/mas`: la navegación dentro del stack ya se hizo y ese `navigate` la
 * desharía volviendo a la raíz.
 */
export const setPendingMasScreen = (
  screen: PendingScreen,
  params?: Record<string, unknown>,
): boolean => {
  pending = { screen, params, at: Date.now() };
  // Copia defensiva: un listener podría desuscribirse durante el recorrido.
  [...listeners].forEach((listener) => listener());
  return pending === null;
};

/** Descarta el destino pendiente (p.ej. al navegar a otro sitio distinto). */
export const clearPendingMasScreen = (): void => {
  pending = null;
};

/**
 * Read and clear the pending navigation (one-shot).
 * Returns null if nothing is pending or si ya caducó.
 */
export const takePendingMasScreen = (): PendingNavigation | null => {
  const current = pending;
  pending = null;
  if (!current) return null;
  if (Date.now() - current.at > PENDING_TTL_MS) return null;
  return { screen: current.screen, params: current.params };
};

/**
 * Avisa cuando alguien guarda un destino pendiente. Lo usa MasHomeScreen
 * mientras tiene el foco, para el caso en que la pantalla ya esté montada y
 * enfocada (entonces `useFocusEffect` no se vuelve a ejecutar).
 */
export const subscribePendingMasScreen = (
  listener: () => void,
): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
