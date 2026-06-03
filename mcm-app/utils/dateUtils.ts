// utils/dateUtils.ts
// Parseo robusto de las fechas del horario. Los datos de Firebase pueden venir
// en dos formatos: ISO/parseable por `Date` (p.ej. "2026-06-06") o en español
// "6 de junio". Esta utilidad cubre ambos para que el selector de fechas y la
// lógica de "día más cercano" usen exactamente el mismo criterio.

const MONTHS: { [key: string]: number } = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

/**
 * Convierte la cadena de fecha del horario en un `Date` (hora a medianoche).
 * Devuelve `null` si no se puede interpretar.
 */
export function parseHorarioDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;

  // 1) Formato español "6 de junio"
  const parts = dateStr.toLowerCase().trim().split(' de ');
  if (parts.length === 2) {
    const day = parseInt(parts[0], 10);
    const monthIndex = MONTHS[parts[1].trim()];
    if (!isNaN(day) && monthIndex !== undefined) {
      const currentYear = new Date().getFullYear();
      let year = currentYear;
      const testDate = new Date(year, monthIndex, day);
      const today = new Date();
      // Si la fecha ya pasó hace más de 6 meses, asumimos el año siguiente.
      if (
        testDate < today &&
        today.getTime() - testDate.getTime() > 6 * 30 * 24 * 60 * 60 * 1000
      ) {
        year = currentYear + 1;
      }
      return new Date(year, monthIndex, day);
    }
  }

  // 2) Cualquier formato que `Date` sepa parsear (ISO, "2026-06-06", etc.)
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }

  return null;
}

/**
 * Índice del día más cercano a HOY (hoy o el próximo futuro). Si todos los días
 * ya pasaron, devuelve el último.
 */
export function getClosestDateIndex(
  data: { fecha?: string }[] | null | undefined,
): number {
  if (!data || data.length === 0) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let closestFutureIndex = -1;
  let minFutureDistance = Number.MAX_SAFE_INTEGER;
  let closestPastIndex = -1;
  let minPastDistance = Number.MAX_SAFE_INTEGER;

  for (let i = 0; i < data.length; i++) {
    const eventDate = parseHorarioDate(data[i]?.fecha);
    if (!eventDate) continue;

    const distance = eventDate.getTime() - today.getTime();
    if (distance >= 0) {
      if (distance < minFutureDistance) {
        minFutureDistance = distance;
        closestFutureIndex = i;
      }
    } else if (-distance < minPastDistance) {
      minPastDistance = -distance;
      closestPastIndex = i;
    }
  }

  if (closestFutureIndex >= 0) return closestFutureIndex;
  if (closestPastIndex >= 0) return closestPastIndex;
  return data.length - 1;
}
