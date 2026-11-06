import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PressableFeedback } from 'heroui-native';
import BottomSheet from '@/components/BottomSheet';
import AppPrimaryButton from '@/components/ui/AppPrimaryButton';
import { MaterialIcons } from '@/components/ui/icons';
import { themeColors } from '@/constants/colors';
import spacing from '@/constants/spacing';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { CalendarConfig } from '@/hooks/useCalendarConfigs';
import { hexAlpha } from '@/utils/colorUtils';
import { h } from '@/utils/haptics';

interface Props {
  visible: boolean;
  onClose: () => void;
  calendars: CalendarConfig[];
  /** Un booleano por calendario, en el mismo orden que `calendars`. */
  active: boolean[];
  onToggle: (index: number) => void;
}

/**
 * «Calendarios activos»: qué calendarios se ven en el mes y en la agenda.
 * Sustituye a la fila de chips que había bajo el mes. Cada toque se guarda en
 * el momento (`toggleCalendarVisibility` escribe en el almacenamiento), así que
 * «Listo» solo cierra la hoja.
 */
export default function ActiveCalendarsSheet({
  visible,
  onClose,
  calendars,
  active,
  onToggle,
}: Props) {
  const isDark = useColorScheme() === 'dark';
  const roles = themeColors(isDark);
  const activeCount = active.filter(Boolean).length;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Calendarios activos"
      dragFromContent
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.subtitle, { color: roles.textSecondary }]}>
          Elige los calendarios que quieres ver. Se guarda solo.
        </Text>

        <View
          style={[
            styles.list,
            { backgroundColor: roles.card, borderColor: roles.separator },
          ]}
        >
          {calendars.map((cal, idx) => {
            const on = !!active[idx];
            return (
              <PressableFeedback
                key={cal.id ?? idx}
                onPress={() => {
                  h.toggle();
                  onToggle(idx);
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={cal.name}
                style={[
                  styles.row,
                  idx > 0 && {
                    borderTopColor: roles.separator,
                    borderTopWidth: StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: on ? cal.color : roles.separator },
                  ]}
                />
                <Text
                  style={[
                    styles.name,
                    {
                      color: on ? roles.text : roles.textSecondary,
                      fontWeight: on ? '600' : '400',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {cal.name}
                </Text>
                <View
                  style={[
                    styles.check,
                    on
                      ? { backgroundColor: cal.color, borderColor: cal.color }
                      : { borderColor: hexAlpha(roles.textSecondary, '80') },
                  ]}
                >
                  {on && <MaterialIcons name="check" size={14} color="#fff" />}
                </View>
              </PressableFeedback>
            );
          })}
        </View>

        {activeCount === 0 && (
          <Text style={[styles.warning, { color: roles.textSecondary }]}>
            Ningún calendario activo: no verás eventos.
          </Text>
        )}

        <AppPrimaryButton label="Listo" onPress={onClose} style={styles.done} />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  content: { padding: spacing.md, paddingBottom: spacing.lg },
  subtitle: { ...typography.subhead, marginBottom: spacing.md },
  list: {
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  dot: { width: 12, height: 12, borderRadius: radii.pillFull },
  name: { ...typography.body, flex: 1 },
  check: {
    width: 22,
    height: 22,
    borderRadius: radii.pillFull,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warning: { ...typography.footnote, marginTop: spacing.sm },
  done: { marginTop: spacing.lg },
});
