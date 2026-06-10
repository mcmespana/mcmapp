// utils/masNavigation.ts
// Simple pending-navigation store for deep-linking into the Más stack from
// outside (e.g. the Home screen quick-grid button, or a Home calendar card on
// iOS where `calendario`/`fotos` are overflow tabs reachable only via the Más
// stack — they have no native tab trigger).
//
// Usage:
//   1. Caller sets a pending screen name (+ optional params) and then navigates
//      to the Más tab (`router.push('/mas')`).
//   2. MasHomeScreen reads and clears the pending screen on focus,
//      then programmatically navigates to it within the native stack.

import type { MasStackParamList } from '@/app/(tabs)/mas';

type PendingScreen = keyof MasStackParamList;

interface PendingNavigation {
  screen: PendingScreen;
  params?: Record<string, unknown>;
}

let pending: PendingNavigation | null = null;

/** Store the screen (and optional params) to navigate to inside the Más stack. */
export const setPendingMasScreen = (
  screen: PendingScreen,
  params?: Record<string, unknown>,
): void => {
  pending = { screen, params };
};

/**
 * Read and clear the pending navigation (one-shot).
 * Returns null if nothing is pending.
 */
export const takePendingMasScreen = (): PendingNavigation | null => {
  const current = pending;
  pending = null;
  return current;
};
