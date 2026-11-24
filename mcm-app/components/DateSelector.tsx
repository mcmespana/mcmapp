import React from 'react';
import {
  FlatList,
  View,
  Text,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { PressableFeedback } from 'heroui-native';
import { hexAlpha } from '@/utils/colorUtils';
import colors, { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import spacing from '@/constants/spacing';
import { parseHorarioDate } from '@/utils/dateUtils';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
const WEEKDAYS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

export interface DateOption {
  fecha: string;
  titulo?: string;
}

interface Props {
  dates: DateOption[];
  selectedDate: string;
  onSelectDate: (date: string, index: number) => void;
  /**
   * Relleno del día elegido (con texto blanco encima). En las pantallas de un
   * evento es el acento del evento (`eventAccentColors(tint).fill`). Por
   * defecto, el rojo MIC de siempre.
   */
  accentColor?: string;
}

export default function DateSelector({
  dates,
  selectedDate,
  onSelectDate,
  accentColor = colors.accent,
}: Props) {
  const scheme = useColorScheme();
  const { width } = useWindowDimensions();
  const styles = React.useMemo(
    () => createStyles(scheme, accentColor),
    [scheme, accentColor],
  );

  const renderItem = ({ item, index }: { item: DateOption; index: number }) => {
    const date = parseHorarioDate(item.fecha);
    const dayNum = date ? date.getDate() : item.fecha;
    const month = date ? MONTHS[date.getMonth()] : '';
    const weekday = date ? WEEKDAYS[date.getDay()] : '';
    const selected = item.fecha === selectedDate;
    return (
      <PressableFeedback
        onPress={() => onSelectDate(item.fecha, index)}
        // Sin nombre ni estado, el lector de pantalla leía tres textos
        // sueltos («7», «junio», «domingo») y no decía cuál está elegido.
        accessibilityRole="button"
        accessibilityLabel={
          date ? `${weekday} ${dayNum} de ${month}` : String(item.fecha)
        }
        accessibilityState={{ selected }}
      >
        <PressableFeedback.Scale />
        <View style={[styles.item, selected && styles.itemSelected]}>
          <Text
            style={[styles.dayNum, selected && styles.textSelected]}
            selectable
            allowFontScaling={false}
          >
            {dayNum}
          </Text>
          <View>
            <Text
              style={[styles.monthText, selected && styles.textSelectedSoft]}
              selectable
              allowFontScaling={false}
            >
              {month}
            </Text>
            <Text
              style={[styles.weekdayText, selected && styles.textSelectedSoft]}
              selectable
              allowFontScaling={false}
            >
              {weekday}
            </Text>
          </View>
        </View>
      </PressableFeedback>
    );
  };

  // En web centramos las fechas (el FlatList por defecto las alinea a la
  // izquierda). En móvil dejamos scroll horizontal normal.
  const centerOnWeb = Platform.OS === 'web' && width > 600;

  return (
    <FlatList
      data={dates}
      keyExtractor={(d) => d.fecha}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.list, centerOnWeb && styles.listCentered]}
      renderItem={renderItem}
    />
  );
}

const createStyles = (scheme: 'light' | 'dark', accent: string) => {
  const isDark = scheme === 'dark';
  const theme = Colors[scheme ?? 'light'];
  return StyleSheet.create({
    list: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      gap: spacing.sm + 2,
    },
    listCentered: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      borderRadius: radii.lg,
      backgroundColor: isDark ? '#2C2C2E' : '#F1F2F4',
      borderWidth: 1,
      borderColor: isDark ? '#3A3A3C' : '#E6E7EA',
    },
    itemSelected: {
      backgroundColor: accent,
      borderColor: accent,
      ...Platform.select({
        web: {
          // @ts-ignore
          boxShadow: `0 6px 16px ${hexAlpha(accent, '59')}`,
        },
        default: {
          shadowColor: accent,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
          elevation: 4,
        },
      }),
    },
    dayNum: {
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -1,
      color: theme.text,
      fontVariant: ['tabular-nums'],
    },
    monthText: {
      ...typography.caption,
      fontWeight: '700',
      textTransform: 'capitalize',
      color: theme.text,
      lineHeight: 16,
    },
    weekdayText: {
      ...typography.footnote,
      fontWeight: '500',
      textTransform: 'capitalize',
      color: isDark ? '#A0A0A5' : '#8A8A8E',
      lineHeight: 15,
    },
    textSelected: {
      color: colors.white,
    },
    textSelectedSoft: {
      color: 'rgba(255,255,255,0.92)',
    },
  });
};
