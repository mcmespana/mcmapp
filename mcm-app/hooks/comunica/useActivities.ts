// hooks/comunica/useActivities.ts
//
// Los eventos de familias (plan 13), siempre del PERFIL QUE SE VE: la clave
// lleva el pid (`useProfileQuery`), así que cambiar de hijo recarga con el
// otro sin mezclar nada y volver es instantáneo.
//
//   ['comunica', 'activities', pid]                 → el listado
//   ['comunica', 'activities', pid, eventId]        → la ficha
//   ['comunica', 'activities', pid, 'slug', slug]   → la ficha por slug (no se guarda)
//
// Sin datos personales en la ficha: se guarda para abrir rápido. Familias
// funcionan con conexión (decisión `offline`); la caché solo abre rápido.

import { useCallback } from 'react';
import { getComunicaApi } from '@/services/comunica';
import type { PhotoSource } from '@/services/comunica/client';
import { useActiveProfile } from './useActiveProfile';
import { useProfileQuery } from './useProfileQuery';

/** 2 minutos: el plazo y las plazas cambian, pero no a cada segundo. */
export const ACTIVITIES_STALE = 2 * 60_000;

export function useActivities() {
  return useProfileQuery({
    block: 'activities',
    route: 'profileEvents',
    load: (pid) => getComunicaApi().getActivities(pid),
    staleTime: ACTIVITIES_STALE,
  });
}

export function useActivity(eventId: string | undefined) {
  return useProfileQuery({
    block: 'activities',
    rest: [eventId ?? '-'],
    route: 'profileEvent',
    load: (pid) => getComunicaApi().getActivity(pid, eventId!),
    staleTime: ACTIVITIES_STALE,
    enabled: !!eventId,
  });
}

export function useActivityBySlug(slug: string | undefined, enabled = true) {
  return useProfileQuery({
    block: 'activities',
    rest: ['slug', slug ?? '-'],
    route: 'profileEventBySlug',
    load: (pid) => getComunicaApi().getActivityBySlug(pid, slug!),
    staleTime: ACTIVITIES_STALE,
    persist: false,
    enabled: enabled && !!slug,
  });
}

/**
 * Cómo pedir un archivo de ESTE evento con la sesión del perfil que se ve
 * (cartel, imágenes del cuerpo, PDF). Ninguna pantalla construye URLs.
 */
export function useEventFileSource(eventId: string) {
  const { pid } = useActiveProfile();
  return useCallback(
    (documentId: string): PhotoSource | null =>
      pid ? getComunicaApi().eventFileSource(pid, eventId, documentId) : null,
    [pid, eventId],
  );
}
