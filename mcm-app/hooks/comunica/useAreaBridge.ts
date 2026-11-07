// hooks/comunica/useAreaBridge.ts
//
// Lo llama `ComunicaAreaProvider` (plan 08): publica su cola para la raíz de
// la app (registro del móvil y aviso local de listas sin subir) y refresca sus
// consultas cuando llega un aviso del área con la app abierta. Ver
// `services/comunica/bridge.ts`.

import { useEffect } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { onComunicaNotice, setActiveOutbox } from '@/services/comunica/bridge';
import type { Outbox } from '@/services/comunica/outbox';
import { queriesForNotice } from '@/utils/comunica/noticeRoutes';
import { areaKey } from './useAreaQuery';

export function useAreaBridge(qc: QueryClient, outbox: Outbox | null): void {
  useEffect(() => {
    setActiveOutbox(outbox);
    return () => setActiveOutbox(null);
  }, [outbox]);

  useEffect(
    () =>
      onComunicaNotice((n) => {
        for (const key of queriesForNotice(n)) {
          void qc.invalidateQueries({ queryKey: areaKey(key) });
        }
      }),
    [qc],
  );
}
