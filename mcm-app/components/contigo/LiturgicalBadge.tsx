import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import liturgicalCalendar from '@/assets/calendario-liturgico.json';
import { getBrightness } from '@/components/ui/glass';
import { useColorScheme } from '@/hooks/useColorScheme';
import { LiturgicalColors, themeColors } from '@/constants/colors';

interface LiturgicalBadgeProps {
  dateStr: string; // YYYY-MM-DD
}

// Map liturgical info to HeroUI Chip colors
type ChipColor = 'accent' | 'default' | 'success' | 'warning' | 'danger';

export function getLiturgicalInfo(dateStr: string) {
  const [year] = dateStr.split('-');
  const calYear = liturgicalCalendar[year as keyof typeof liturgicalCalendar];
  if (!calYear)
    return {
      color: 'success' as ChipColor,
      name: 'Tiempo Ordinario',
      hex: LiturgicalColors.green,
    };

  // Check special dates first
  const specialDate = calYear.fechas_especiales?.find(
    (d: any) => d.fecha === dateStr,
  );
  if (specialDate) {
    let color: ChipColor = 'default';
    let hex = '#F5F5F5';
    if (
      specialDate.id === 'pentecostes' ||
      specialDate.id.includes('ramos') ||
      specialDate.id.includes('viernes_santo') ||
      specialDate.id.includes('apostol')
    ) {
      color = 'danger';
      hex = '#C41E3A';
    } else if (specialDate.id === 'miercoles_ceniza') {
      color = 'accent';
      hex = '#6B3FA0';
    }
    return { color, name: specialDate.nombre, hex };
  }

  // Check Gaudete / Laetare
  if (
    calYear.domingos_adviento?.[2] === dateStr ||
    calYear.domingos_cuaresma?.[3] === dateStr
  ) {
    return {
      color: 'warning' as ChipColor,
      name:
        calYear.domingos_adviento?.[2] === dateStr
          ? 'Adviento (Gaudete)'
          : 'Cuaresma (Laetare)',
      hex: LiturgicalColors.rose,
    };
  }

  // Find the season
  for (const tiempo of calYear.tiempos) {
    if (dateStr >= tiempo.inicio && dateStr <= tiempo.fin) {
      let color: ChipColor = 'success';
      let hex: string = LiturgicalColors.green;
      if (tiempo.id === 'adviento' || tiempo.id === 'cuaresma') {
        color = 'accent';
        hex = LiturgicalColors.purple;
      } else if (tiempo.id === 'navidad' || tiempo.id === 'pascua') {
        // 'warning' (golden) renders readable in both light and dark mode;
        // 'default' renders with dark foreground text that's invisible on dark backgrounds.
        color = 'warning';
        hex = LiturgicalColors.gold;
      } else if (tiempo.id === 'semana_santa') {
        color = 'danger';
        hex = LiturgicalColors.red;
      }
      return { color, name: tiempo.nombre, hex };
    }
  }

  return {
    color: 'success' as ChipColor,
    name: 'Tiempo Ordinario',
    hex: LiturgicalColors.green,
  };
}

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
          style={[styles.label, { color: themeColors(isDark).textStrong }]}
          numberOfLines={1}
        >
          {info.name}
        </Text>
      </View>
    );
  }

  const textColor = getBrightness(info.hex) > 160 ? '#1A1A1A' : '#FFFFFF';

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
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  pillPlain: {
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '700',
    fontSize: 12,
  },
});
