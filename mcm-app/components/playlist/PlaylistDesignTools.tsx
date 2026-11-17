/**
 * Ayudas para MONTAR la playlist, pequeñas y a mano en «Tu selección» con
 * canciones: las lecturas del próximo domingo (con los cantos que encajan),
 * la misa propuesta para ese domingo (con la lista vacía sale entera, en
 * `SundayPlanCard`) y el historial de lo cantado por el coro.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { MaterialIcons } from '@/components/ui/icons';
import { SungLegend } from '@/components/playlist/SungDots';
import { KeyPillColors, themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useChoirHistory } from '@/hooks/useChoirHistory';
import { useColorScheme } from '@/hooks/useColorScheme';
import { h } from '@/utils/haptics';
import { openCantoral } from '@/utils/cantoralNavigation';

export default function PlaylistDesignTools({
  onOpenSunday,
}: {
  onOpenSunday: () => void;
}) {
  const isDark = useColorScheme() === 'dark';
  const theme = themeColors(isDark);
  const sung = useChoirHistory();
  const onBg = isDark ? KeyPillColors.bgDark : KeyPillColors.bgLight;

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <PressableFeedback
          onPress={() => {
            h.tap();
            onOpenSunday();
          }}
          style={[styles.chip, { backgroundColor: theme.backgroundSunken }]}
          accessibilityRole="button"
          accessibilityLabel="Lecturas del domingo y cantos que encajan"
        >
          <MaterialIcons name="menu-book" size={16} color={theme.link} />
          <Text style={[styles.chipText, { color: theme.link }]}>
            Lecturas del domingo
          </Text>
        </PressableFeedback>
        <PressableFeedback
          onPress={() => {
            h.tap();
            openCantoral('SundaySongs');
          }}
          style={[styles.chip, { backgroundColor: theme.backgroundSunken }]}
          accessibilityRole="button"
          accessibilityLabel="Cantos propuestos para el domingo"
        >
          <MaterialIcons name="event" size={16} color={theme.link} />
          <Text style={[styles.chipText, { color: theme.link }]}>
            Cantos del domingo
          </Text>
        </PressableFeedback>
        {sung.available ? (
          <PressableFeedback
            onPress={() => {
              h.toggle();
              sung.setEnabled(!sung.enabled);
            }}
            style={[
              styles.chip,
              {
                backgroundColor: sung.enabled ? onBg : theme.backgroundSunken,
                borderColor: sung.enabled ? theme.link : 'transparent',
              },
            ]}
            accessibilityRole="switch"
            accessibilityState={{ checked: sung.enabled }}
            accessibilityLabel="Historial de lo cantado por el coro"
          >
            <MaterialIcons
              name="history"
              size={16}
              color={sung.enabled ? theme.link : theme.textSecondary}
            />
            <Text
              style={[
                styles.chipText,
                { color: sung.enabled ? theme.link : theme.textSecondary },
              ]}
            >
              Historial
            </Text>
          </PressableFeedback>
        ) : null}
      </View>
      {sung.enabled ? <SungLegend /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 20,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.md - spacing.xs,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipText: { ...typography.caption, fontWeight: '600' },
});
