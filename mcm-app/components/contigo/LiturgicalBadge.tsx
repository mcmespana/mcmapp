import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import liturgicalCalendar from '@/assets/calendario-liturgico.json';
import { getBrightness } from '@/components/ui/glass';
import { useColorScheme } from '@/hooks/useColorScheme';

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
      hex: '#3A7D44',
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
      hex: '#D4A0A7',
    };
  }

  // Find the season
  for (const tiempo of calYear.tiempos) {
    if (dateStr >= tiempo.inicio && dateStr <= tiempo.fin) {
      let color: ChipColor = 'success';
      let hex = '#3A7D44';
      if (tiempo.id === 'adviento' || tiempo.id === 'cuaresma') {
        color = 'accent';
        hex = '#6B3FA0';
      } else if (tiempo.id === 'navidad' || tiempo.id === 'pascua') {
        // 'warning' (golden) renders readable in both light and dark mode;
        // 'default' renders with dark foreground text that's invisible on dark backgrounds.
        color = 'warning';
        hex = '#D4A070';
      } else if (tiempo.id === 'semana_santa') {
        color = 'danger';
        hex = '#C41E3A';
      }
      return { color, name: tiempo.nombre, hex };
    }
  }

  return {
    color: 'success' as ChipColor,
    name: 'Tiempo Ordinario',
    hex: '#3A7D44',
  };
}

export function LiturgicalBadge({ dateStr }: LiturgicalBadgeProps) {
  const [info, setInfo] = useState(() => getLiturgicalInfo(dateStr));
  const isDark = useColorScheme() === 'dark';

  useEffect(() => {
    setInfo(getLiturgicalInfo(dateStr));
  }, [dateStr]);

  // Tiempo Ordinario: SIN color de fondo, solo texto (legible en claro y
  // oscuro). El resto de tiempos sí llevan su color litúrgico de fondo con
  // texto auto-contrastado.
  const isOrdinary = /ordinario/i.test(info.name);

  if (isOrdinary) {
    return (
      <View style={styles.pillPlain}>
        <Text
          style={[styles.label, { color: isDark ? '#FFFFFF' : '#1C1C1E' }]}
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
