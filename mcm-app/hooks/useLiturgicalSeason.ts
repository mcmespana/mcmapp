import { useMemo } from 'react';
import calendarData from '@/assets/calendario-liturgico.json';

export interface LiturgicalInfo {
  seasonId: string;
  seasonName: string;
  color: string;
  colorName: string;
  specialDay: string | null;
}

const SEASON_COLORS: Record<string, { color: string; name: string }> = {
  navidad: { color: '#F5F0E8', name: 'Blanco' },
  ordinario: { color: '#3A7D44', name: 'Verde' },
  cuaresma: { color: '#6B3FA0', name: 'Morado' },
  semana_santa: { color: '#6B3FA0', name: 'Morado' },
  pascua: { color: '#F5F0E8', name: 'Blanco' },
  adviento: { color: '#6B3FA0', name: 'Morado' },
};

// Warm gradient accents per season (for UI backgrounds)
export const SEASON_GRADIENT: Record<string, string[]> = {
  navidad: ['#FFF8E1', '#FFFDE7'],
  ordinario: ['#E8F5E9', '#F1F8E9'],
  cuaresma: ['#F3E5F5', '#EDE7F6'],
  semana_santa: ['#F3E5F5', '#EDE7F6'],
  pascua: ['#FFFDE7', '#FFF8E1'],
  adviento: ['#F3E5F5', '#EDE7F6'],
};

export const SEASON_ACCENT: Record<string, string> = {
  navidad: '#D4AF37',
  ordinario: '#3A7D44',
  cuaresma: '#6B3FA0',
  semana_santa: '#C41E3A',
  pascua: '#D4AF37',
  adviento: '#6B3FA0',
};

function getYearData(year: number): any {
  return (calendarData as any)[String(year)] ?? null;
}

export function useLiturgicalSeason(dateStr: string): LiturgicalInfo {
  return useMemo(() => {
    const date = new Date(dateStr + 'T12:00:00');
    const year = date.getFullYear();

    // Check both current year and previous year (for Navidad spanning Dec-Jan)
    const yearsToCheck = [year, year - 1];

    for (const y of yearsToCheck) {
      const data = getYearData(y);
      if (!data) continue;

      // Check special dates first
      if (data.fechas_especiales) {
        for (const special of data.fechas_especiales) {
          if (special.fecha === dateStr) {
            // Find season for this date
            const season = findSeason(data, dateStr);
            const seasonId = season?.id ?? 'ordinario';
            const colorInfo = SEASON_COLORS[seasonId] ?? SEASON_COLORS.ordinario;
            return {
              seasonId,
              seasonName: season?.nombre ?? 'Tiempo Ordinario',
              color: colorInfo.color,
              colorName: colorInfo.name,
              specialDay: special.nombre,
            };
          }
        }
      }

      // Check seasons
      const season = findSeason(data, dateStr);
      if (season) {
        const colorInfo = SEASON_COLORS[season.id] ?? SEASON_COLORS.ordinario;
        return {
          seasonId: season.id,
          seasonName: season.nombre,
          color: colorInfo.color,
          colorName: colorInfo.name,
          specialDay: null,
        };
      }
    }

    return {
      seasonId: 'ordinario',
      seasonName: 'Tiempo Ordinario',
      color: SEASON_COLORS.ordinario.color,
      colorName: 'Verde',
      specialDay: null,
    };
  }, [dateStr]);
}

function findSeason(
  data: any,
  dateStr: string,
): { id: string; nombre: string } | null {
  if (!data?.tiempos) return null;
  for (const t of data.tiempos) {
    if (dateStr >= t.inicio && dateStr <= t.fin) {
      return { id: t.id, nombre: t.nombre };
    }
  }
  return null;
}
