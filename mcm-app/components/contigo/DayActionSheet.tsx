import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import BottomSheet from '@/components/BottomSheet';
import { useColorScheme } from '@/hooks/useColorScheme';
import { hexAlpha } from '@/utils/colorUtils';
import { h } from '@/utils/haptics';
import type { DayRecord } from '@/hooks/useContigoHabits';
import { formatDateLong, habitColor, warm, type HabitKey } from './theme';

export type DayAction = 'evangelio' | 'oracion' | 'revision';

export interface DayActionOption {
  key: DayAction;
  title: string;
  subtitle: string;
  icon: string;
  /** `false` cuando ese día no hay nada guardado y sólo se puede leer. */
  recorded: boolean;
}

/**
 * Qué se puede abrir de un día concreto, en el orden en que tiene sentido
 * ofrecerlo: primero lo que la persona escribió (revisión, oración) y siempre
 * el evangelio como fondo de armario — aunque no lo marcara, se puede leer.
 */
export function getDayOptions(
  date: string,
  rec: DayRecord | null,
): DayActionOption[] {
  const options: DayActionOption[] = [];
  if (rec?.revisionDone) {
    options.push({
      key: 'revision',
      title: 'Revisión del día',
      subtitle: 'Releer lo que anotaste',
      icon: 'search',
      recorded: true,
    });
  }
  if (rec?.prayerDone) {
    options.push({
      key: 'oracion',
      title: 'Oración',
      subtitle: 'Ver cómo fue el rato de oración',
      icon: 'self-improvement',
      recorded: true,
    });
  }
  options.push({
    key: 'evangelio',
    title: 'Evangelio',
    subtitle: rec?.readingDone
      ? 'Volver a la lectura de ese día'
      : 'Leer el evangelio de ese día',
    icon: 'menu-book',
    recorded: !!rec?.readingDone,
  });
  return options;
}

interface DayActionSheetProps {
  visible: boolean;
  onClose: () => void;
  date: string | null;
  record: DayRecord | null;
  onSelect: (action: DayAction, date: string) => void;
}

/**
 * Menú de un día del calendario / de la racha: elige qué quieres ver de ese
 * día. Cuando sólo hay una opción posible (nada guardado → evangelio), quien
 * llama abre directamente sin pasar por aquí.
 */
export default function DayActionSheet({
  visible,
  onClose,
  date,
  record,
  onSelect,
}: DayActionSheetProps) {
  const isDark = useColorScheme() === 'dark';
  const W = warm(isDark);
  const options = date ? getDayOptions(date, record) : [];

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={date ? formatDateLong(date) : 'Ese día'}
    >
      <View style={styles.list}>
        {options.map((opt) => {
          const accent = habitColor(opt.key as HabitKey, isDark);
          return (
            <TouchableOpacity
              key={opt.key}
              activeOpacity={0.75}
              onPress={() => {
                if (!date) return;
                h.navigate();
                onSelect(opt.key, date);
              }}
              style={[
                styles.row,
                { backgroundColor: W.bgCard, borderColor: W.border },
              ]}
              accessibilityRole="button"
              accessibilityLabel={opt.title}
            >
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: hexAlpha(accent, '1F') },
                ]}
              >
                <MaterialIcons
                  name={opt.icon as never}
                  size={20}
                  color={accent}
                />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: W.text }]}>
                  {opt.title}
                </Text>
                <Text style={[styles.rowSubtitle, { color: W.textMuted }]}>
                  {opt.subtitle}
                </Text>
              </View>
              {opt.recorded ? (
                <MaterialIcons name="check-circle" size={16} color={W.green} />
              ) : null}
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={W.textMuted}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
    paddingBottom: 28,
    paddingTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  rowSubtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
});
