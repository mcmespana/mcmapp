import React, { createContext, useContext } from 'react';
import { useFirebaseData } from '@/hooks/useFirebaseData';
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
  const activeEvent = getEvent(activeEventId);
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
