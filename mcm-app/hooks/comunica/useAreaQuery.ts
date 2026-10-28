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

import { useQuery, type QueryKey } from '@tanstack/react-query';
import { isComunicaApiError } from '@/services/comunica/client';
import { ROUTES, type RouteName } from '@/services/comunica/contract';

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

export const areaKey = (key: QueryKey): QueryKey => ['comunica', ...key];

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
  const query = useQuery<T, Error, T>({
    queryKey: areaKey(key),
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
