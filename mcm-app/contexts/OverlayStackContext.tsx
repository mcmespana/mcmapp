import React, { createContext, useCallback, useContext, useRef } from 'react';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';

export interface OverlayEntry {
  /** Unique id (use `useId()` or any stable value). */
  id: string;
  /** Called when this overlay should close (e.g. user pressed Esc). */
  onClose: () => void;
}

interface OverlayStackContextValue {
  push: (entry: OverlayEntry) => void;
  pop: (id: string) => void;
  closeTop: () => boolean;
}

const OverlayStackContext = createContext<OverlayStackContextValue | null>(
  null,
);

/**
 * Maintains a LIFO stack of open overlays so a single global Esc handler
 * can dismiss whichever sits on top. Each `useEscapeToClose` registers
 * here when it opens and deregisters on close/unmount.
 */
export function OverlayStackProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const stackRef = useRef<OverlayEntry[]>([]);

  const push = useCallback((entry: OverlayEntry) => {
    stackRef.current = [
      ...stackRef.current.filter((e) => e.id !== entry.id),
      entry,
    ];
  }, []);

  const pop = useCallback((id: string) => {
    stackRef.current = stackRef.current.filter((e) => e.id !== id);
  }, []);

  const closeTop = useCallback(() => {
    const top = stackRef.current[stackRef.current.length - 1];
    if (!top) return false;
    top.onClose();
    return true;
  }, []);

  // Global Esc handler — closes the topmost registered overlay (web only).
  useKeyboardShortcut('Escape', () => closeTop(), { preventDefault: false });

  return (
    <OverlayStackContext.Provider value={{ push, pop, closeTop }}>
      {children}
    </OverlayStackContext.Provider>
  );
}

export function useOverlayStack(): OverlayStackContextValue {
  const ctx = useContext(OverlayStackContext);
  if (!ctx) {
    // Outside a provider (rare in tests): no-op so the hook stays safe.
    return {
      push: () => {},
      pop: () => {},
      closeTop: () => false,
    };
  }
  return ctx;
}
