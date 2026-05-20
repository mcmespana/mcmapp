import { useEffect, useId, useRef } from 'react';
import { useOverlayStack } from '@/contexts/OverlayStackContext';

/**
 * Registers the calling overlay in the global stack while `isOpen` is true.
 * When Esc is pressed and this overlay sits on top, `onClose` fires.
 *
 * No-op on native — Esc is a desktop/web concept. The Modal's
 * `onRequestClose` handles Android back-button separately.
 */
export function useEscapeToClose(isOpen: boolean, onClose: () => void): void {
  const id = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const { push, pop } = useOverlayStack();

  useEffect(() => {
    if (!isOpen) return;
    push({ id, onClose: () => onCloseRef.current() });
    return () => pop(id);
  }, [isOpen, id, push, pop]);
}
