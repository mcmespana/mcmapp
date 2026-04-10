// utils/masNavigation.ts
// Simple pending-navigation store for deep-linking into the Más stack from
// outside (e.g. the Home screen quick-grid button).
//
// Usage:
//   1. Caller sets a pending screen name and then navigates to the Más tab.
//   2. MasHomeScreen reads and clears the pending screen on focus,
//      then programmatically navigates to it within the native stack.

import type { MasStackParamList } from '@/app/(tabs)/mas';

type PendingScreen = keyof MasStackParamList;

let pendingScreen: PendingScreen | null = null;

/** Store the screen to navigate to inside the Más stack. */
export const setPendingMasScreen = (screen: PendingScreen): void => {
  pendingScreen = screen;
};

/**
 * Read and clear the pending screen (one-shot).
 * Returns null if nothing is pending.
 */
export const takePendingMasScreen = (): PendingScreen | null => {
  const screen = pendingScreen;
  pendingScreen = null;
  return screen;
};
