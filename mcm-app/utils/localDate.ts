/**
 * `YYYY-MM-DD` en hora LOCAL del dispositivo (nunca UTC). `toISOString()`
 * convierte a UTC antes de cortar la fecha, así que en España (UTC+1/+2)
 * cualquier hora entre medianoche y la 1-2 de la madrugada local cae en el
 * día ANTERIOR según UTC — "hoy" quedaba desplazado un día en Home,
 * Calendario y la fecha de las reflexiones. Extraído de la función
 * equivalente ya usada en `hooks/useContigoHabits.ts`.
 */
export function localISO(d: Date = new Date()): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}
