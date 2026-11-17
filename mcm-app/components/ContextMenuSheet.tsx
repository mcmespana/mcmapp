import React, { useRef } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@/components/ui/icons';
import BottomSheet from './BottomSheet';
import colors, { Colors, themeColors } from '@/constants/colors';
import { radii } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';
import { h } from '@/utils/haptics';
import typography from '@/constants/typography';

/** Respiro entre cerrar esta hoja y abrir lo siguiente (otro Modal). */
const NEXT_MODAL_DELAY_MS = 250;

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
  const { height: windowHeight } = useWindowDimensions();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onCloseComplete={() => {
        const fn = pending.current;
        pending.current = null;
        if (!fn) return;
        // Si la acción abre OTRA hoja (sugerir canción, etiquetas…), en el
        // móvil hay que dejar que el Modal de esta termine de irse: abrirla en
        // el mismo instante hacía que no apareciera nada.
        if (Platform.OS === 'web') fn();
        else setTimeout(fn, NEXT_MODAL_DELAY_MS);
      }}
      title={title}
    >
      {/* Con muchas opciones (admin, coro, etiquetas…) no caben: scroll. */}
      <ScrollView
        style={{ maxHeight: windowHeight * 0.62 }}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {actions.map((action) => {
          const color = action.disabled
            ? theme.icon
            : action.destructive
              ? colors.accent
              : theme.text;
          return (
            <TouchableOpacity
              key={action.key}
              style={[
                styles.row,
                { backgroundColor: themeColors(isDark).background },
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
      </ScrollView>
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
    ...typography.body,
    fontWeight: '600',
  },
});
