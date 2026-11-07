// Los estados de una pantalla de Pasar Lista (cargando, vacío, error, sin
// acceso) DENTRO de `AreaScreen`, para que no queden bajo la cabecera
// transparente de iOS (revisión B, hallazgo 5). Con datos, `children` pinta su
// propia `AreaScreen` y recibe el aviso de «sin conexión» para meterlo dentro.

import React from 'react';
import { isComunicaApiError } from '@/services/comunica/client';
import AreaScreen from '../comun/AreaScreen';
import AreaState, { OfflineNotice } from '../comun/AreaState';

interface QueryLike<T> {
  data: T | undefined;
  error: unknown;
  isPending: boolean;
  refetch: () => unknown;
}

const isNetwork = (e: unknown) =>
  isComunicaApiError(e) &&
  (e.code === 'network' || e.code === 'crm_unavailable');

export default function ScreenState<T>({
  query,
  skeleton = 'list',
  empty,
  children,
}: {
  query: QueryLike<T>;
  skeleton?: 'cards' | 'list';
  empty?: { title: string; subtitle?: string; isEmpty: (data: T) => boolean };
  children: (data: T, offline: React.ReactNode) => React.ReactNode;
}) {
  const { data } = query;
  if (data !== undefined && !empty?.isEmpty(data)) {
    return (
      <>{children(data, isNetwork(query.error) ? <OfflineNotice /> : null)}</>
    );
  }
  return (
    <AreaScreen onRefresh={async () => query.refetch()}>
      <AreaState query={query} skeleton={skeleton} empty={empty}>
        {() => null}
      </AreaState>
    </AreaScreen>
  );
}
