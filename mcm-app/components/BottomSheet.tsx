import React from 'react';
import { StyleSheet } from 'react-native';
import { BottomSheet as HeroBottomSheet } from 'heroui-native';
import { UIColors, Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Wrapper that keeps the existing {visible, onClose, children} API
 * while delegating to HeroUI Native BottomSheet under the hood.
 *
 * The overlay is given an explicit dark backdrop so users can always
 * see the dim "scrim" behind the sheet — without it the underlying
 * screen stays at full brightness on some platforms.
 */
export default function BottomSheet({
  visible,
  onClose,
  children,
}: BottomSheetProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const bgColor = Colors[scheme ?? 'light'].background;
  const handleIndicatorColor = isDark
    ? 'rgba(255,255,255,0.25)'
    : 'rgba(0,0,0,0.18)';

  return (
    <HeroBottomSheet
      isOpen={visible}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <HeroBottomSheet.Portal>
        <HeroBottomSheet.Overlay style={styles.overlay} />
        <HeroBottomSheet.Content
          style={{ backgroundColor: bgColor }}
          handleStyle={{ backgroundColor: bgColor }}
          handleIndicatorStyle={{ backgroundColor: handleIndicatorColor }}
        >
          {children}
        </HeroBottomSheet.Content>
      </HeroBottomSheet.Portal>
    </HeroBottomSheet>
  );
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: UIColors.modalOverlay,
  },
});
