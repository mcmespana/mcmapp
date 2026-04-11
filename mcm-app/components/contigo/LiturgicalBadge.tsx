import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Chip } from 'heroui-native';
import liturgicalCalendar from '@/assets/calendario-liturgico.json';

interface LiturgicalBadgeProps {
  dateStr: string; // YYYY-MM-DD
}

type HeroUIColor = "default" | "primary" | "secondary" | "success" | "warning" | "danger";

export function getLiturgicalInfo(dateStr: string) {
  const [year, month, day] = dateStr.split('-');
  const calYear = liturgicalCalendar[year as keyof typeof liturgicalCalendar];
  if (!calYear) return { color: 'success' as HeroUIColor, name: 'Tiempo Ordinario', hex: '#3A7D44' };

  // Check special dates first
  const specialDate = calYear.fechas_especiales?.find((d: any) => d.fecha === dateStr);
  if (specialDate) {
    let color: HeroUIColor = 'default';
    let hex = '#F5F5F5';
    if (specialDate.id === 'pentecostes' || specialDate.id.includes('ramos') || specialDate.id.includes('viernes_santo') || specialDate.id.includes('apostol')) {
      color = 'danger';
      hex = '#C41E3A';
    } else if (specialDate.id === 'miercoles_ceniza') {
      color = 'secondary';
      hex = '#6B3FA0';
    }
    return { color, name: specialDate.nombre, hex };
  }

  // Check Gaudete / Laetare
  if (calYear.domingos_adviento?.[2] === dateStr || calYear.domingos_cuaresma?.[3] === dateStr) {
    return { color: 'warning' as HeroUIColor, name: calYear.domingos_adviento?.[2] === dateStr ? 'Adviento (Gaudete)' : 'Cuaresma (Laetare)', hex: '#D4A0A7' };
  }

  // Find the season
  for (const tiempo of calYear.tiempos) {
    if (dateStr >= tiempo.inicio && dateStr <= tiempo.fin) {
      let color: HeroUIColor = 'success';
      let hex = '#3A7D44';
      if (tiempo.id === 'adviento' || tiempo.id === 'cuaresma') {
        color = 'secondary';
        hex = '#6B3FA0';
      } else if (tiempo.id === 'navidad' || tiempo.id === 'pascua') {
        color = 'default';
        hex = '#F5F5F5';
      } else if (tiempo.id === 'semana_santa') {
        color = 'danger';
        hex = '#C41E3A';
      }
      return { color, name: tiempo.nombre, hex };
    }
  }

  return { color: 'success' as HeroUIColor, name: 'Tiempo Ordinario', hex: '#3A7D44' };
}

export function LiturgicalBadge({ dateStr }: LiturgicalBadgeProps) {
  const [info, setInfo] = useState(() => getLiturgicalInfo(dateStr));

  useEffect(() => {
    setInfo(getLiturgicalInfo(dateStr));
  }, [dateStr]);

  return (
    <Chip
      size="sm"
      variant="solid"
      color={info.color}
      style={{ marginTop: 4, elevation: 1 }}
    >
      <Chip.Label style={{ fontWeight: '700' }}>
        {info.name}
      </Chip.Label>
    </Chip>
  );
}
