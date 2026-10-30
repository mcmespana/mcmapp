// utils/comunica/uuid.ts
//
// UUID v4 para el `clientId` de las escrituras (plan 00 §2): lo genera el
// móvil y se conserva entre reintentos, así el servidor no duplica. No es un
// secreto ni un identificador de nadie: basta con que no se repita.

export function uuidV4(rand: () => number = Math.random): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (rand === Math.random && typeof c?.randomUUID === 'function') {
    return c.randomUUID();
  }
  const hex = Array.from({ length: 32 }, () =>
    Math.floor(rand() * 16).toString(16),
  );
  hex[12] = '4';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
