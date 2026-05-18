import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BottomSheet as HeroBottomSheet } from 'heroui-native';
import { UIColors, Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

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
        {/* onPress ensures tapping the scrim dismisses the sheet */}
        <HeroBottomSheet.Overlay
          style={styles.overlay}
          onPress={onClose}
        />
        <HeroBottomSheet.Content
          style={{ backgroundColor: bgColor }}
          handleStyle={{ backgroundColor: bgColor }}
          handleIndicatorStyle={{ backgroundColor: handleIndicatorColor }}
        >
          {/* Explicit wrapper ensures dark background even when children
              don't set their own (e.g. TransposePanel, SongFontPanel) */}
          <View style={{ backgroundColor: bgColor }}>
            {children}
          </View>
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
