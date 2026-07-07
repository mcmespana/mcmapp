import React, { createContext, useContext, useMemo } from 'react';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useEventMeta } from '@/hooks/useEventMeta';
import { mergeEventMeta } from '@/utils/mergeEventMeta';
import { ACTIVE_EVENT_ID, getEvent, EventConfig } from '@/constants/events';

interface ActiveMetaData {
  activeEventId: string;
}

interface ActiveEventContextValue {
  activeEventId: string;
  activeEvent: EventConfig;
}

const defaultActiveEvent = getEvent(ACTIVE_EVENT_ID);

const ActiveEventContext = createContext<ActiveEventContextValue>({
  activeEventId: ACTIVE_EVENT_ID,
  activeEvent: defaultActiveEvent,
});

/**
 * Lee `activities/_meta` de Firebase una sola vez y propaga el evento activo
 * a toda la app. Mientras no llega el valor remoto (o sin conexión) usa el
 * `ACTIVE_EVENT_ID` hardcoded como fallback offline.
 *
 * El nodo Firebase esperado:
 *   activities/_meta/updatedAt  → timestamp
 *   activities/_meta/data       → { activeEventId: 'visitapapa26' }
 *
 * Permite al panel MCM cambiar el evento activo sin desplegar la app.
 */
export function ActiveEventProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data } = useFirebaseData<ActiveMetaData>(
    'activities/_meta',
    'activities_meta',
  );
  const activeEventId = data?.activeEventId ?? ACTIVE_EVENT_ID;

  // B1: mergea el `_meta` per-evento que edita el panel (title/tintColor/
  // bannerText/status) sobre la config del registry, para reflejar cambios del
  // panel sin publicar la app. Si el remoto falta, se conserva el registry.
  const remoteMeta = useEventMeta(activeEventId);
  const activeEvent = useMemo(
    () => mergeEventMeta(getEvent(activeEventId), remoteMeta),
    [activeEventId, remoteMeta],
  );

  return (
    <ActiveEventContext.Provider value={{ activeEventId, activeEvent }}>
      {children}
    </ActiveEventContext.Provider>
  );
}

/** Devuelve el evento activo actual, leyéndolo de Firebase si está disponible. */
export function useActiveMeta(): ActiveEventContextValue {
  return useContext(ActiveEventContext);
}
