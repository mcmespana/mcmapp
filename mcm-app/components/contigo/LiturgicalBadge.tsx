import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { themeColors } from '@/constants/colors';
import typography from '@/constants/typography';
import { radii } from '@/constants/uiStyles';
import { onColor } from '@/utils/colorUtils';
import { getLiturgicalInfo } from '@/utils/liturgicalDay';

interface LiturgicalBadgeProps {
  dateStr: string; // YYYY-MM-DD
}

// La lógica del día litúrgico vive en `utils/liturgicalDay.ts` (la comparte el
// cantoral); aquí se reexporta para no tocar a quien ya importa de este fichero.
export { getLiturgicalInfo } from '@/utils/liturgicalDay';

export function LiturgicalBadge({ dateStr }: LiturgicalBadgeProps) {
  // Estado DERIVADO de la fecha: se calcula, no se guarda en estado y se
  // sincroniza con un efecto (eso obligaba a un render de más en cada cambio de
  // día, y es lo que señala `react-hooks/set-state-in-effect`).
  const info = useMemo(() => getLiturgicalInfo(dateStr), [dateStr]);
  const isDark = useColorScheme() === 'dark';

  // Tiempo Ordinario: SIN color de fondo, solo texto (legible en claro y
  // oscuro). El resto de tiempos sí llevan su color litúrgico de fondo con
  // texto auto-contrastado.
  const isOrdinary = /ordinario/i.test(info.name);

  if (isOrdinary) {
    return (
      <View style={styles.pillPlain}>
        <Text
          style={[styles.label, { color: themeColors(isDark).text }]}
          numberOfLines={1}
        >
          {info.name}
        </Text>
      </View>
    );
  }

  const textColor = onColor(info.hex);

  return (
    <View style={[styles.pill, { backgroundColor: info.hex }]}>
      <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
        {info.name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pillFull,
    alignSelf: 'flex-start',
  },
  pillPlain: {
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '700',
    ...typography.footnote,
  },
});
