import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import BottomSheet from './BottomSheet';
import { Colors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';
import { h } from '@/utils/haptics';

export interface ContextMenuAction {
  key: string;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  /** Renders the row in red (delete / remove). */
  destructive?: boolean;
  disabled?: boolean;
}

interface ContextMenuSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  actions: ContextMenuAction[];
}

/**
 * Reusable long-press / right-click action sheet. Pair with `useContextMenu`
 * on the list row to open it. The selected action runs in `onCloseComplete`
 * (after the sheet is fully dismissed) so actions that present native UI —
 * Share.share(), another Modal — don't collide with this sheet on iOS.
 */
export default function ContextMenuSheet({
  visible,
  onClose,
  title,
  actions,
}: ContextMenuSheetProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  const pending = useRef<(() => void) | null>(null);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onCloseComplete={() => {
        const fn = pending.current;
        pending.current = null;
        fn?.();
      }}
      title={title}
    >
      <View style={styles.list}>
        {actions.map((action) => {
          const color = action.disabled
            ? theme.icon
            : action.destructive
              ? '#E15C62'
              : theme.text;
          return (
            <TouchableOpacity
              key={action.key}
              style={[
                styles.row,
                { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' },
                action.disabled && styles.rowDisabled,
              ]}
              activeOpacity={0.6}
              disabled={action.disabled}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={() => {
                if (action.disabled) return;
                h.tap();
                pending.current = action.onPress;
                onClose();
              }}
            >
              <MaterialIcons name={action.icon} size={22} color={color} />
              <Text style={[styles.label, { color }]}>{action.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingTop: 4,
    paddingBottom: 24,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radii.md,
  },
  rowDisabled: {
    opacity: 0.45,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
});
