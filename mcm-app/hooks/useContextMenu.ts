import { useMemo } from 'react';
import { Platform } from 'react-native';

const LONG_PRESS_DELAY = 400;

type WebContextMenuEvent = {
  preventDefault?: () => void;
};

interface ContextMenuProps {
  onLongPress?: () => void;
  delayLongPress?: number;
  onContextMenu?: (e: WebContextMenuEvent) => void;
}

/**
 * Returns props to spread onto a pressable so it shows a contextual menu
 * via long-press on native and via right-click on web. Pass `undefined`
 * to disable.
 *
 * ```tsx
 * const ctx = useContextMenu(() => openMenu(song));
 * <TouchableOpacity onPress={...} {...ctx} />
 * ```
 */
export function useContextMenu(
  handler: (() => void) | undefined,
): ContextMenuProps {
  return useMemo(() => {
    if (!handler) return {};
    if (Platform.OS === 'web') {
      return {
        onContextMenu: (e: WebContextMenuEvent) => {
          e?.preventDefault?.();
          handler();
        },
      };
    }
    return { onLongPress: handler, delayLongPress: LONG_PRESS_DELAY };
  }, [handler]);
}
