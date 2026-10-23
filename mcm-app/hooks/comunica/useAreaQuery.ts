// hooks/comunica/useAreaQuery.ts
//
// Toda lectura del área pasa por aquí (plan 01 §2): TanStack Query sobre el
// cliente de `services/comunica/`, con la clave siempre bajo `['comunica', …]`,
// lo guardado pintado al instante y el refresco por detrás.
//
// `persist: false` marca lo que NUNCA toca el disco (la salud). Hoy la caché
// vive en memoria; cuando llegue `expo-sqlite` con la 2.2, el persistidor
// solo guardará las consultas con `meta.persist === true`.

import { useQuery, type QueryKey } from '@tanstack/react-query';
import { isComunicaApiError } from '@/services/comunica/client';

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
  persist?: boolean;
  staleTime?: number;
  enabled?: boolean;
}

export const areaKey = (key: QueryKey): QueryKey => ['comunica', ...key];

export function useAreaQuery<T extends { generatedAt: string }>({
  key,
  fetch,
  persist = true,
  staleTime = STALE.state,
  enabled = true,
}: Options<T>) {
  const query = useQuery({
    queryKey: areaKey(key),
    queryFn: fetch,
    staleTime,
    enabled,
    meta: { persist },
    // Solo se reintenta lo que tiene sentido reintentar (red, CRM caído); un
    // 403 o una forma rota no se arreglan insistiendo.
    retry: (count, error) =>
      count < 2 && isComunicaApiError(error) && error.retryable,
  });
  return { ...query, generatedAt: query.data?.generatedAt ?? null };
}
