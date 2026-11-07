// Seguimiento automático de pantallas.
//
// La alternativa era llamar a `trackEvent('pantalla_vista')` en cada una de las
// ~20 pantallas de la app. Eso envejece fatal: alguien añade una pantalla, se
// le olvida la llamada, y el dato queda cojo sin que nadie se entere. Aquí se
// engancha una sola vez, en el layout raíz, y cubre TODA la app —incluidas las
// pantallas que aún no existen— porque escucha la ruta de expo-router.
//
// También es el sitio donde se arranca Aptabase y donde se mantiene al día el
// perfil que acompaña a cada evento.

import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { normalizeRoute } from '@/constants/analyticsEvents';
import { useUserProfile } from '@/contexts/UserProfileContext';
import {
  initAnalytics,
  setAnalyticsProfile,
  trackEvent,
} from '@/utils/analytics';

export function useScreenTracking(): void {
  const pathname = usePathname();
  const { profile, loading } = useUserProfile();

  // Última ruta registrada. Evita duplicar el evento cuando `usePathname`
  // vuelve a emitir el mismo valor (pasa al cambiar params o al remontar).
  const lastRoute = useRef<string | null>(null);
  const bootstrapped = useRef(false);

  // El perfil se lee de AsyncStorage, o sea que al montar todavía no está.
  // Nada se manda hasta que llega: si no, los primeros eventos de cada sesión
  // saldrían siempre como `sin_perfil` y la segmentación quedaría sesgada.
  const ready = !loading;

  // Estos tres efectos se ejecutan en orden de declaración, así que cuando
  // `ready` pasa a true el perfil ya está puesto antes de arrancar Aptabase y
  // antes del primer evento.
  useEffect(() => {
    if (!ready) return;
    setAnalyticsProfile({
      perfil: profile.profileType ?? 'sin_perfil',
      delegacion: profile.delegationId ?? 'sin_delegacion',
    });
  }, [ready, profile.profileType, profile.delegationId]);

  useEffect(() => {
    if (!ready || bootstrapped.current) return;
    bootstrapped.current = true;
    initAnalytics();
    trackEvent('app_abierta');
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const route = normalizeRoute(pathname);
    if (route === lastRoute.current) return;
    lastRoute.current = route;
    trackEvent('pantalla_vista', { ruta: route });
  }, [ready, pathname]);
}
