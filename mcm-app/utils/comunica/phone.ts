// utils/comunica/phone.ts
//
// Un teléfono del CRM, listo para llamar y para WhatsApp (`sticpa_pl_phone`
// del plugin). Los del CRM están escritos como cada uno quiso: para llamar,
// cifras y «+»; para WhatsApp, sin «+» y con 34 delante si son 9 cifras (se
// asume España, donde están todas las delegaciones: es un supuesto, y se dice).

export interface Phone {
  /** Tal cual está escrito: es lo que se reconoce de un vistazo. */
  display: string;
  /** Para `tel:`. */
  tel: string;
  /** Para `https://wa.me/…`. */
  wa: string;
}

export function cleanPhone(raw: string | null | undefined): Phone | null {
  const display = (raw ?? '').trim();
  if (!display) return null;
  const digits = display.replace(/[^0-9+]/g, '');
  if (!digits || digits === '+') return null;
  let wa = digits.replace(/^\++/, '');
  if (!digits.startsWith('+') && wa.length === 9) wa = `34${wa}`;
  return { display, tel: digits, wa };
}

export const telUrl = (p: Phone) => `tel:${p.tel}`;
export const whatsappUrl = (p: Phone) => `https://wa.me/${p.wa}`;
export const mailtoUrl = (email: string) => `mailto:${email.trim()}`;

/**
 * ¿Se le ofrece WhatsApp al MÓVIL PROPIO del chaval? Solo con el «sí»
 * explícito de la familia: un vacío (`null`) no es un permiso.
 */
export const canWhatsappMinor = (whatsapp: boolean | null | undefined) =>
  whatsapp === true;
