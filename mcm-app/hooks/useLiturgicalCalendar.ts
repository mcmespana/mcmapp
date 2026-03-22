// hooks/useLiturgicalCalendar.ts — Liturgical season + color for any date
import { useMemo } from 'react';
import type {
  LiturgicalInfo,
  LiturgicalYear,
  LiturgicalSeasonId,
} from '@/types/contigo';
import {
  LITURGICAL_COLORS,
  SEASON_COLOR_MAP,
  SPECIAL_DATE_COLORS,
} from '@/types/contigo';

// Import the static JSON asset
import calendarioRaw from '@/assets/calendario-liturgico.json';
const calendario = calendarioRaw as Record<string, LiturgicalYear>;

/**
 * Get liturgical info for a given date string (YYYY-MM-DD).
 * Pure function — no hooks, can be called anywhere.
 */
export function getLiturgicalInfo(dateStr: string): LiturgicalInfo {
  const year = dateStr.slice(0, 4);
  const yearData = calendario[year];

  if (!yearData) {
    return {
      season: null,
      specialDate: null,
      color: LITURGICAL_COLORS.verde.hex,
      colorName: 'Verde',
    };
  }

  // Check special dates first
  const special =
    yearData.fechas_especiales.find((d) => d.fecha === dateStr) ?? null;

  // Find the liturgical season
  const season =
    yearData.tiempos.find((t) => dateStr >= t.inicio && dateStr <= t.fin) ??
    null;

  // Determine color: special date override > adviento rosa check > season default
  let colorKey = 'verde';

  if (season) {
    colorKey = SEASON_COLOR_MAP[season.id as LiturgicalSeasonId] ?? 'verde';
  }

  // Rosa for Gaudete (3rd Sunday of Advent) and Laetare (4th Sunday of Cuaresma)
  if (yearData.domingos_adviento?.[2] === dateStr) {
    colorKey = 'rosa'; // Gaudete
  }
  if (yearData.domingos_cuaresma?.[3] === dateStr) {
    colorKey = 'rosa'; // Laetare
  }

  // Special date color override
  if (special && SPECIAL_DATE_COLORS[special.id]) {
    colorKey = SPECIAL_DATE_COLORS[special.id];
  }

  const colorInfo = LITURGICAL_COLORS[colorKey] ?? LITURGICAL_COLORS.verde;

  return {
    season,
    specialDate: special,
    color: colorInfo.hex,
    colorName: colorInfo.name,
  };
}

/**
 * Hook version — memoized for a given date string.
 */
export function useLiturgicalInfo(dateStr: string): LiturgicalInfo {
  return useMemo(() => getLiturgicalInfo(dateStr), [dateStr]);
}
