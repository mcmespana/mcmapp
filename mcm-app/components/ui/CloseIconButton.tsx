import React from 'react';
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/useThemeColor';
import { hexAlpha } from '@/utils/colorUtils';

interface CloseIconButtonProps {
  onPress: () => void;
  /** Diameter of the circular button (icon scales to ~60%). Defaults to 32. */
  size?: number;
  /** Optional override for the icon color. Defaults to theme `icon`. */
  iconColor?: string;
  /** Optional override for the background tint. Defaults to a subtle theme-aware fill. */
  backgroundColor?: string;
  /** Accessibility label. Defaults to "Cerrar". */
  accessibilityLabel?: string;
  style?: ViewStyle;
}

/**
 * Canonical close button using `MaterialIcons name="close"`.
 *
 * Replaces the previous use of HeroUI Native's `CloseButton`, whose
 * built-in icon font failed to render correctly on native builds (the
 * glyph fell back to a red "U"-shaped placeholder). MaterialIcons is
 * already bundled in the app and works identically across iOS, Android
 * and web.
 */
export default function CloseIconButton({
  onPress,
  size = 32,
  iconColor,
  backgroundColor,
  accessibilityLabel = 'Cerrar',
  style,
}: CloseIconButtonProps) {
  const themeIcon = useThemeColor({}, 'icon');
  const fg = iconColor ?? themeIcon;
  const bg = backgroundColor ?? hexAlpha(themeIcon, '14');

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[
        styles.btn,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
        },
        style,
      ]}
    >
      <MaterialIcons name="close" size={Math.round(size * 0.62)} color={fg} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        // Web hover/click feedback handled by activeOpacity; cursor is set
        // by RN-web automatically for pressables.
      },
    }),
  },
});
