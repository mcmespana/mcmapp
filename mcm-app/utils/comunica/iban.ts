// utils/comunica/iban.ts
//
// El IBAN (plan 14; `js/iban.js` del plugin y `sticpa_iban_is_valid()`): dos letras, dos cifras y de 11 a 30 caracteres; uno español, 24; y el resto
// 1 módulo 97. Se limpia (espacios y guiones fuera, mayúsculas) antes de mirarlo. Es el MISMO cálculo que hace el servidor: aquí solo evita ir y volver con
// uno que se sabe mal. NUNCA se escribe en un log, una caché ni una cola.

export const normalizeIban = (v: unknown): string =>
  String(v ?? '')
    .replace(/[\s-]+/g, '')
    .toUpperCase();

export function isValidIban(raw: unknown): boolean {
  const iban = normalizeIban(raw);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith('ES') && iban.length !== 24) return false;
  const moved = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const c of moved) {
    const digits = /[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c;
    for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
}

/**
 * Países cuyo IBAN admite una domiciliación SEPA (`sticpa_fp_sepa_countries()` del plugin, 05/11/2026): un IBAN de otro sitio (Brasil) pasa el módulo 97 pero el
 * banco rechaza el recibo. Solo lo pide la forma de pago; la inscripción sigue con `isValidIban`.
 */
export const SEPA_COUNTRIES: readonly string[] = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'IS',
  'LI',
  'NO',
  'CH',
  'GB',
  'GI',
  'GG',
  'JE',
  'IM',
  'MC',
  'SM',
  'VA',
  'AD',
];

/** ¿Un IBAN válido (módulo 97) y de un país SEPA? */
export const isSepaIban = (raw: unknown): boolean =>
  isValidIban(raw) && SEPA_COUNTRIES.includes(normalizeIban(raw).slice(0, 2));

/** Agrupado de cuatro en cuatro al escribir: «ES91 2100 0418 4502 0005 1332». */
export function formatIban(raw: string): string {
  return (
    normalizeIban(raw)
      .slice(0, 34)
      .match(/.{1,4}/g)
      ?.join(' ') ?? ''
  );
}

/**
 * El IBAN tapado que se enseña: «ES93 •••• 8644» (los cuatro primeros, un hueco y los cuatro últimos). Con ocho caracteres o menos no hay nada que dejar a la
 * vista: «••••». Es el MISMO formato que el del servidor (`ibanMasked`); la app solo lo calcula para el servidor falso y para los tests: el IBAN entero nunca
 * sale de quien lo escribe.
 */
export function maskIban(raw: string): string {
  const iban = normalizeIban(raw);
  if (iban === '') return '';
  if (iban.length <= 8) return '••••';
  return `${iban.slice(0, 4)} •••• ${iban.slice(-4)}`;
}
