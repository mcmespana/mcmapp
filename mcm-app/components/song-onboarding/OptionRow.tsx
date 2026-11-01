/** Una opción grande con icono, título y explicación (elige una de varias). */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@/components/ui/icons';
import {
  valueBoxStyle,
  type SheetPalette,
} from '@/components/song-sheet/sheetKit';
import { radii } from '@/constants/uiStyles';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { h } from '@/utils/haptics';

export default function OptionRow({
  palette: p,
  icon,
  title,
  desc,
  active,
  onPress,
}: {
  palette: SheetPalette;
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  desc: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <PressableFeedback
      onPress={() => {
        if (active) return;
        h.select();
        onPress();
      }}
      style={[styles.option, valueBoxStyle(p, active)]}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${title}. ${desc}`}
    >
      <PressableFeedback.Highlight />
      <MaterialIcons
        name={icon}
        size={26}
        color={active ? p.active.fg : p.text}
      />
      <View style={styles.optionText}>
        <Text
          style={[styles.optionTitle, { color: active ? p.active.fg : p.text }]}
        >
          {title}
        </Text>
        <Text style={[styles.optionDesc, { color: p.textSecondary }]}>
          {desc}
        </Text>
      </View>
      <MaterialIcons
        name={active ? 'radio-button-checked' : 'radio-button-unchecked'}
        size={22}
        color={active ? p.active.fg : p.disabled}
      />
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  optionText: { flex: 1 },
  optionTitle: { ...typography.title },
  optionDesc: { ...typography.footnote },
});
