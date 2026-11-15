// El pañuelo que dice Comunica: `mcm.scarf` de los datos de la propia persona.
//
// La ruta `/panuelo` es de la raíz y el `QueryClient` del área vive en el
// layout de la pestaña Comunica, así que aquí NO se pueden usar sus hooks
// (`useMe`, `useProfileDetails`…). Lo que sí es de módulo, y sirve fuera, es la
// capa de servicios: `getComunicaApi()` ya trae la sesión puesta y la sesión
// restaurada del móvil se lee sin red (`initSession`).
//
// - Solo se pide al abrir el pañuelo (un `GET /v1/me/profiles` y un
//   `GET /v1/profiles/:self/details`), nunca al arrancar la app.
// - De QUIÉN: de `profiles.self`, la ficha de la propia persona, NO de la
//   «ficha activa» del área. El pañuelo es de quien ha entrado: un padre que
//   está viendo a su hija en el área sigue teniendo su pañuelo, y los datos de
//   un hijo ni traen `mcm` (el servidor solo lo da a la audiencia `member`).
// - Es un dato personal (`persist: false` en el contrato): no se guarda; el
//   color elegido ya vive en el estado del pañuelo.
// - Sin servidor, sin sesión, sin red o con error: `null`, y el pañuelo sigue
//   como siempre con lo guardado y los colores a mano. Nunca bloquea nada.

import { useEffect, useState } from 'react';

import { getComunicaApi, isComunicaApiAvailable } from '@/services/comunica';
import {
  getSessionState,
  initSession,
  subscribeSession,
} from '@/services/comunica/session';
import { logger } from '@/utils/logger';

/** `mcm.scarf` crudo de la persona (`red`, `none`, `cross`…), o `null`. */
export async function readOwnScarf(): Promise<string | null> {
  if (!isComunicaApiAvailable()) return null;
  const api = getComunicaApi();
  await initSession();
  if (getSessionState().status !== 'signedIn') return null;
  const profiles = await api.getMyProfiles();
  const details = await api.getProfileDetails(profiles.self.id);
  return details.mcm?.scarf ?? null;
}

export function usePanueloScarf(enabled = true): string | null {
  const [scarf, setScarf] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = () => {
      readOwnScarf()
        .then((value) => {
          if (!cancelled) setScarf(value);
        })
        .catch((err) => logger.info('[Pañuelo] sin pañuelo de Comunica:', err));
    };
    load();
    // Si la sesión acaba de restaurarse o se inicia mientras la pantalla está
    // abierta, se vuelve a mirar; si se cierra, se olvida.
    let last = getSessionState().status;
    const stop = subscribeSession(() => {
      const status = getSessionState().status;
      if (status === last) return;
      last = status;
      if (status === 'signedIn') load();
      else if (!cancelled) setScarf(null);
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [enabled]);

  return scarf;
}
