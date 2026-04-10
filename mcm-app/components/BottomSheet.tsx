import React from 'react';
import { BottomSheet as HeroBottomSheet } from 'heroui-native';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Wrapper that keeps the existing {visible, onClose, children} API
 * while delegating to HeroUI Native BottomSheet under the hood.
 */
export default function BottomSheet({
  visible,
  onClose,
  children,
}: BottomSheetProps) {
  return (
    <HeroBottomSheet
      isOpen={visible}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <HeroBottomSheet.Portal>
        <HeroBottomSheet.Overlay />
        <HeroBottomSheet.Content>{children}</HeroBottomSheet.Content>
      </HeroBottomSheet.Portal>
    </HeroBottomSheet>
  );
}
