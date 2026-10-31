// hooks/comunica/useAreaQuery.ts
//
// Toda lectura del área pasa por aquí (plan 01 §2): TanStack Query sobre el
// cliente de `services/comunica/`, con la clave siempre bajo `['comunica', …]`,
// lo guardado pintado al instante y el refresco por detrás.
//
// Qué se guarda en el móvil lo dice el CONTRATO: con `route`, el `persist` de
// `ROUTES` (la salud y los datos personales, `false`). `ComunicaAreaProvider`
// solo guarda las consultas con `meta.persist === true` y, además, nunca las
// de salud ni datos personales. Sin `route`, se guarda salvo `persist: false`.

import { useSyncExternalStore } from 'react';
import { useQuery, type QueryKey } from '@tanstack/react-query';
import { isComunicaApiError } from '@/services/comunica/client';
import {
  PROFILE_PATH_PREFIX,
  ROUTES,
  type RouteName,
} from '@/services/comunica/contract';
import {
  getWorkingDelegation,
  subscribeWorkingDelegation,
  TEAM_BLOCKS,
} from '@/services/comunica/delegation';
import { isProfileKey } from './profileKeys';

export const STALE = {
  /** Estructura: grupos, personas. */
  structure: 12 * 60 * 60_000,
  /** Estado: listas, hoy. */
  state: 5 * 60_000,
} as const;

interface Options<T> {
  /** Sin el prefijo: `['pasar-lista', 'groups']`. */
  key: QueryKey;
  fetch: () => Promise<T>;
  /** La ruta del contrato que se lee: de ahí sale si se guarda. */
  route?: RouteName;
  /** Solo para apagar el guardado (nunca enciende lo que `route` no deja). */
  persist?: boolean;
  staleTime?: number;
  enabled?: boolean;
  /** Cuánto se queda en memoria sin nadie mirando (la salud: 1 min). */
  gcTime?: number;
  /** Lo que se enseña mientras llega (los chavales de `people` en un grupo). */
  placeholderData?: () => T | undefined;
  /** Reintentar o no (lo que solo vale con conexión, no). */
  retry?: boolean;
}

/**
 * La clave de una consulta del área. Las de equipo llevan la delegación de
 * trabajo si no es la de la ficha (`['comunica', 'd:<id>', …]`, plan 17):
 * cambiar de delegación no mezcla cachés ni enseña un instante lo de la otra.
 */
export const areaKeyIn = (key: QueryKey, d: string | null): QueryKey =>
  d && typeof key[0] === 'string' && TEAM_BLOCKS.includes(key[0])
    ? ['comunica', `d:${d}`, ...key]
    : ['comunica', ...key];

/**
 * La de ahora. ⚠️ En el cuerpo de un componente, NO: el compilador de React
 * la cree pura y guarda el resultado aunque cambie la delegación (pasó: la
 * portada se quedaba en la de antes). Ahí, `areaKeyIn(key, useWorkingDelegation())`.
 * En callbacks y efectos (`setQueryData`, `invalidateQueries`), sí.
 */
export const areaKey = (key: QueryKey): QueryKey =>
  areaKeyIn(key, getWorkingDelegation());

/** La delegación de trabajo, para repintar al cambiarla. */
export function useWorkingDelegation(): string | null {
  return useSyncExternalStore(
    subscribeWorkingDelegation,
    getWorkingDelegation,
    getWorkingDelegation,
  );
}

/**
 * Una ruta de familias (`/v1/profiles/:pid/…`, plan 11) solo con su clave de
 * familia (`[bloque, pid, …]`, la de `useProfileQuery`): si no, lo de un hijo
 * acabaría en la caché de otro. Falla en voz alta, en desarrollo y en tests.
 */
export function assertProfileKey(route: RouteName | undefined, key: QueryKey) {
  if (
    route &&
    ROUTES[route].path.startsWith(PROFILE_PATH_PREFIX) &&
    !isProfileKey(key)
  ) {
    throw new Error(
      `[comunica] La ruta ${route} es de familias: su clave lleva el pid (useProfileQuery).`,
    );
  }
}

export function useAreaQuery<T extends { generatedAt: string }>({
  key,
  fetch,
  route,
  persist = true,
  staleTime = STALE.state,
  enabled = true,
  gcTime,
  placeholderData,
  retry = true,
}: Options<T>) {
  assertProfileKey(route, key);
  // Al cambiar de delegación, la clave cambia y se repinta con la otra caché.
  const delegation = useWorkingDelegation();
  const query = useQuery<T, Error, T>({
    queryKey: areaKeyIn(key, delegation),
    queryFn: fetch,
    staleTime,
    enabled,
    meta: { persist: persist && (route ? ROUTES[route].persist : true) },
    gcTime,
    // `T` es siempre un objeto (una respuesta), nunca una función: el guarda
    // de tipos de TanStack no lo puede saber con un genérico.
    placeholderData: placeholderData as never,
    // Solo se reintenta lo que tiene sentido reintentar (red, CRM caído); un
    // 403 o una forma rota no se arreglan insistiendo.
    retry: (count, error) =>
      retry && count < 2 && isComunicaApiError(error) && error.retryable,
  });
  return { ...query, generatedAt: query.data?.generatedAt ?? null };
}
