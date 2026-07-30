import { useMemo } from 'react';
import { useResolvedProfileConfig } from '@/hooks/useResolvedProfileConfig';
import { useActiveMeta } from '@/contexts/ActiveEventContext';
import { isEventArchived } from '@/constants/events';

/**
 * Tabs que el usuario debe ver realmente: los `tabs` del perfil resuelto
 * (`/profileConfig` en Firebase) MENOS el tab del evento en curso si ese
 * evento está archivado.
 *
 * El "archivar" del panel MCM escribe `activities/<id>/_meta.status =
 * 'archived'`; sin este filtro el tab del evento seguía en la barra porque su
 * visibilidad dependía sólo de la lista `tabs` del perfil, y archivar no hacía
 * nada visible en la app.
 *
 * Lo consumen `app/(tabs)/_layout.tsx` (barra de tabs) y `MasHomeScreen`
 * (tarjetas de overflow en iOS), para que el tab no reaparezca como tarjeta.
 */
export function useVisibleTabs(): Set<string> {
  const resolved = useResolvedProfileConfig();
  const { activeEvent } = useActiveMeta();

  const archivedTabId =
    isEventArchived(activeEvent) && activeEvent.tabId
      ? activeEvent.tabId
      : undefined;

  return useMemo(() => {
    const visible = new Set(resolved.tabs);
    if (archivedTabId) visible.delete(archivedTabId);
    return visible;
  }, [resolved.tabs, archivedTabId]);
}
