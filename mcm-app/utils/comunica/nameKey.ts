// utils/comunica/nameKey.ts
//
// La clave de orden por apellidos de las listas de un evento
// (`sticpa_pl_ev_clave_nombre` del plugin): sin acentos con una tabla FIJA
// (sin `Intl` ni el locale del móvil, que cambia el orden de un teléfono a
// otro) y la ñ detrás de la n, como en el diccionario.

const TABLE: Record<string, string> = {
  á: 'a',
  à: 'a',
  ä: 'a',
  â: 'a',
  ã: 'a',
  é: 'e',
  è: 'e',
  ë: 'e',
  ê: 'e',
  í: 'i',
  ì: 'i',
  ï: 'i',
  î: 'i',
  ó: 'o',
  ò: 'o',
  ö: 'o',
  ô: 'o',
  õ: 'o',
  ú: 'u',
  ù: 'u',
  ü: 'u',
  û: 'u',
  ç: 'c',
  ñ: 'n~',
  '·': '',
};

export function nameKey(last: string, first: string, full = ''): string {
  let s = `${last.trim()} ${first.trim()}`.trim();
  if (!s) s = full.trim();
  return s
    .toLowerCase()
    .replace(/l·l/g, 'll')
    .replace(/[áàäâãéèëêíìïîóòöôõúùüûçñ·]/g, (c) => TABLE[c])
    .replace(/\s+/g, ' ');
}
