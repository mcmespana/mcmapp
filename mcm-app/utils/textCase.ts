/**
 * Mayúscula SOLO en la primera letra, que es como se escribe en español.
 *
 * Existe porque `textTransform: 'capitalize'` de React Native pone mayúscula en
 * **cada palabra**, y en español eso es una falta: los días, los meses y las
 * preposiciones van en minúscula. En una sola palabra («septiembre» →
 * «Septiembre») funciona, y por eso se colaba; en una fecha entera producía
 * «Jueves, 10 De Septiembre De 2026 A Las 14:32», que es lo que se veía en el
 * detalle de una notificación, en el Evangelio del día, en Oración y en
 * Visitas (visto el 2026-09-09 renderizando la app).
 *
 * Regla: si el texto puede tener más de una palabra, se formatea con esto y
 * NO con `textTransform`. `capitalize` solo vale para una palabra suelta (el
 * mes del selector de fechas, el día de la semana de una cabecera de sección).
 */
export function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
