// services/comunica/legacy.ts
//
// El salto a la web del plugin, sin que se note (plan 10 §2): para lo poco que
// no es nativo, se pide al servidor un PASE de 2 minutos y se abre esa página
// dentro de la app, con cabecera nativa y la sesión ya puesta.
//
// El pase nunca se guarda ni se registra (ni en Sentry): va de aquí a la
// pantalla por un hueco en memoria y se consume una vez.

import { getComunicaApi } from './index';
import type { Destination } from './links';

export interface LegacyOpen {
  url: string;
  title: string;
}

let pending: LegacyOpen | null = null;

/** Lo recoge `web.tsx` al montar. Se consume una sola vez. */
export function consumeLegacyOpen(): LegacyOpen | null {
  const p = pending;
  pending = null;
  return p;
}

export function setLegacyOpen(open: LegacyOpen): void {
  pending = open;
}

/**
 * Pide el pase y deja la página lista para `web.tsx`. Devuelve `false` si no
 * se ha podido (sin red, por ejemplo): la pantalla lo dice.
 */
export async function prepareLegacy(
  destination: Destination,
  title: string,
  profileId?: string,
): Promise<boolean> {
  try {
    const pass = await getComunicaApi().webPass({ ...destination, profileId });
    setLegacyOpen({ url: pass.url, title });
    return true;
  } catch {
    return false;
  }
}
