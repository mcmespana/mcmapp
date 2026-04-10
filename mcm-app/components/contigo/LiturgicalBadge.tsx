import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Chip } from 'heroui-native';
import liturgicalCalendar from '@/assets/calendario-liturgico.json';

interface LiturgicalBadgeProps {
  dateStr: string; // YYYY-MM-DD
}

export function getLiturgicalInfo(dateStr: string) {
  const [year, month, day] = dateStr.split('-');
  const calYear = liturgicalCalendar[year as keyof typeof liturgicalCalendar];
  if (!calYear) return { color: '#3A7D44', name: 'Tiempo Ordinario', hex: '#3A7D44' };

  // Check special dates first
  const specialDate = calYear.fechas_especiales?.find((d: any) => d.fecha === dateStr);
  if (specialDate) {
    let color = '#F5F5F5'; // Default for feasts is white
    let hex = '#F5F5F5';
    if (specialDate.id === 'pentecostes' || specialDate.id.includes('ramos') || specialDate.id.includes('viernes_santo') || specialDate.id.includes('apostol')) {
      color = '#C41E3A'; // Rojo
      hex = '#C41E3A';
    } else if (specialDate.id === 'miercoles_ceniza') {
      color = '#6B3FA0'; // Morado
      hex = '#6B3FA0';
    }
    return { color, name: specialDate.nombre, hex };
  }

  // Check Gaudete / Laetare
  if (calYear.domingos_adviento?.[2] === dateStr || calYear.domingos_cuaresma?.[3] === dateStr) {
    return { color: '#D4A0A7', name: calYear.domingos_adviento?.[2] === dateStr ? 'Adviento (Gaudete)' : 'Cuaresma (Laetare)', hex: '#D4A0A7' };
  }

  // Find the season
  for (const tiempo of calYear.tiempos) {
    if (dateStr >= tiempo.inicio && dateStr <= tiempo.fin) {
      let hex = '#3A7D44';
      if (tiempo.id === 'adviento' || tiempo.id === 'cuaresma') {
        hex = '#6B3FA0';
      } else if (tiempo.id === 'navidad' || tiempo.id === 'pascua') {
        hex = '#F5F5F5';
      } else if (tiempo.id === 'semana_santa') {
        hex = '#C41E3A'; // Rojo usually
      }
      return { color: hex, name: tiempo.nombre, hex };
    }
  }

  return { color: '#3A7D44', name: 'Tiempo Ordinario', hex: '#3A7D44' };
}

export function LiturgicalBadge({ dateStr }: LiturgicalBadgeProps) {
  const [info, setInfo] = useState(() => getLiturgicalInfo(dateStr));

  useEffect(() => {
    setInfo(getLiturgicalInfo(dateStr));
  }, [dateStr]);

  const isLight = info.hex === '#F5F5F5';

  return (
    <Chip
      style={{ backgroundColor: info.hex, borderWidth: isLight ? 1 : 0, borderColor: '#e5e5e5' }}
      className={`px-3 py-1 mt-1 rounded-full items-center justify-center`}
      variant="flat"
    >
      <Text className={`font-semibold text-xs ${isLight ? 'text-black' : 'text-white'}`}>
        {info.name}
      </Text>
    </Chip>
  );
}
