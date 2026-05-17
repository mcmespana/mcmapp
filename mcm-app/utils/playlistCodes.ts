/**
 * Códigos numéricos cortos usados tanto para "playlists en la nube"
 * (subir/descargar) como para "sesiones de coro" (maestro/esclavos).
 *
 * Hoy son de 4 dígitos. Para ampliar a 6 u 8 basta cambiar `CODE_LENGTH`.
 */
export const CODE_LENGTH = 4;

/** Regex que valida un código completo (exactamente N dígitos). */
export const CODE_REGEX = new RegExp(`^\\d{${CODE_LENGTH}}$`);

/** ¿Es un código bien formado? */
export function isValidCode(code: string): boolean {
  return CODE_REGEX.test(code);
}

/** Devuelve un código aleatorio de N dígitos (con padding de ceros). */
export function generateRandomCode(): string {
  const max = 10 ** CODE_LENGTH;
  const n = Math.floor(Math.random() * max);
  return String(n).padStart(CODE_LENGTH, '0');
}

/**
 * Sugerencia "fecha de hoy" como código memorable (DDMM con N=4).
 * Si N > 4 añade YY o YYYY al final hasta completar.
 */
export function todayCode(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  const base = `${dd}${mm}${yyyy}`;
  return base.slice(0, CODE_LENGTH).padEnd(CODE_LENGTH, '0');
}
