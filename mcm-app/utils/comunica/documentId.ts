// utils/comunica/documentId.ts
//
// El número de documento (`validateId` del plugin, `js/stic-utils.js` l. 279-308): NIF y NIE con su letra, CIF con su dígito de control; cualquier otro
// tipo (pasaporte…), libre. Es el MISMO cálculo que hace el servidor (`comunicaMiddleware:src/app/document-id.ts`): aquí solo evita ir y volver con un
// número que se sabe mal; la última palabra la tiene siempre el servidor.

const LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';

export function isValidDni(v: string): boolean {
  const s = v.trim().toUpperCase();
  const nie = /^[XYZ]\d{7}[A-Z]$/.test(s);
  if (!nie && !/^\d{5,8}[A-Z]$/.test(s)) return false;
  const digits = nie
    ? String('XYZ'.indexOf(s[0])) + s.slice(1, 8)
    : s.slice(0, -1);
  return LETTERS[Number(digits) % 23] === s[s.length - 1];
}

export function isValidCif(v: string): boolean {
  const s = v.trim().toUpperCase();
  if (!/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(s)) return false;
  const d = s.slice(1, 8).split('').map(Number);
  const even = d[1] + d[3] + d[5];
  const odd = [d[0], d[2], d[4], d[6]]
    .map((n) => n * 2)
    .reduce((a, n) => a + Math.floor(n / 10) + (n % 10), 0);
  const control = (10 - ((even + odd) % 10)) % 10;
  const last = s[8];
  const asLetter = 'JABCDEFGHI'[control];
  if ('KPQRSNW'.includes(s[0])) return last === asLetter;
  if ('ABEH'.includes(s[0])) return last === String(control);
  return last === String(control) || last === asLetter;
}

/** `type` es la opción del contrato (`nif`, `nie`, `cif`, `passport`). */
export function isValidDocument(type: string | null, number: string): boolean {
  if (type === 'nif' || type === 'nie') return isValidDni(number);
  if (type === 'cif') return isValidCif(number);
  return number.trim() !== '';
}
