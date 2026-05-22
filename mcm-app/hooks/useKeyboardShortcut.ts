import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

export interface KeyboardShortcutOptions {
  /** Require ⌘ (mac) / Ctrl (other). Default: false. */
  meta?: boolean;
  /** Require Shift. Default: false. */
  shift?: boolean;
  /** Require Alt/Option. Default: false. */
  alt?: boolean;
  /** Disable the listener without removing it from the call site. Default: false. */
  disabled?: boolean;
  /** Call `e.preventDefault()` before the handler. Default: true. */
  preventDefault?: boolean;
}

type AnyKeyboardEvent = {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  preventDefault?: () => void;
  target?: { tagName?: string; isContentEditable?: boolean } | null;
};

function isTypingTarget(target: AnyKeyboardEvent['target']): boolean {
  if (!target) return false;
  const tag = target.tagName?.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return Boolean(target.isContentEditable);
}

/**
 * Registers a global keydown listener on web. No-op on native.
 *
 * `key` is matched case-insensitively against `event.key`. Pass an array to
 * match any of several keys (useful for `['+', '=']`).
 *
 * The handler is skipped when focus is inside a text input — unless
 * `meta: true`, since shortcuts like ⌘K should still work while typing.
 */
export function useKeyboardShortcut(
  key: string | string[],
  handler: (e: AnyKeyboardEvent) => void,
  options: KeyboardShortcutOptions = {},
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const {
    meta = false,
    shift = false,
    alt = false,
    disabled = false,
    preventDefault = true,
  } = options;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (disabled) return;
    if (typeof window === 'undefined') return;

    const keys = (Array.isArray(key) ? key : [key]).map((k) => k.toLowerCase());

    const onKeyDown = (e: AnyKeyboardEvent) => {
      const eventKey = (e.key || '').toLowerCase();
      if (!keys.includes(eventKey)) return;

      const metaPressed = Boolean(e.metaKey || e.ctrlKey);
      if (meta !== metaPressed) return;
      if (shift !== Boolean(e.shiftKey)) return;
      if (alt !== Boolean(e.altKey)) return;

      // Don't hijack normal typing — but ⌘-prefixed shortcuts still fire.
      if (!meta && isTypingTarget(e.target)) return;

      if (preventDefault) e.preventDefault?.();
      handlerRef.current(e);
    };

    window.addEventListener('keydown', onKeyDown as never);
    return () => window.removeEventListener('keydown', onKeyDown as never);
  }, [key, meta, shift, alt, disabled, preventDefault]);
}
