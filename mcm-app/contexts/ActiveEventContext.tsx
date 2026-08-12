import React, { createContext, useContext, useMemo } from 'react';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import { useEventsMeta } from '@/hooks/useEventMeta';
import { mergeEventMeta } from '@/utils/mergeEventMeta';
import {
  ACTIVE_EVENT_ID,
  EVENTS,
  getEvent,
  EventConfig,
} from '@/constants/events';

interface ActiveMetaData {
  activeEventId: string;
}

interface ActiveEventContextValue {
  activeEventId: string;
  activeEvent: EventConfig;
  /**
   * TODOS los eventos del registry con su `_meta` remoto ya aplicado. Lo usa
   * "Eventos pasados", que antes leía el registry en crudo y por eso ignoraba
   * lo que el panel archivara o renombrara.
   */
  events: EventConfig[];
}

const defaultActiveEvent = getEvent(ACTIVE_EVENT_ID);

const ActiveEventContext = createContext<ActiveEventContextValue>({
  activeEventId: ACTIVE_EVENT_ID,
  activeEvent: defaultActiveEvent,
  events: Object.values(EVENTS),
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
  //
  // Se piden los metadatos de TODOS los eventos del registry, no solo el
  // activo: archivar/renombrar un evento pasado desde el panel también tiene
  // que verse (antes no se veía, la lista de pasados salía del registry).
  const eventIds = useMemo(
    () => Array.from(new Set([...Object.keys(EVENTS), activeEventId])),
    [activeEventId],
  );
  const metas = useEventsMeta(eventIds);

  const activeEvent = useMemo(
    () => mergeEventMeta(getEvent(activeEventId), metas[activeEventId]),
    [activeEventId, metas],
  );

  const events = useMemo(
    () => Object.values(EVENTS).map((e) => mergeEventMeta(e, metas[e.id])),
    [metas],
  );

  const value = useMemo(
    () => ({ activeEventId, activeEvent, events }),
    [activeEventId, activeEvent, events],
  );

  return (
    <ActiveEventContext.Provider value={value}>
      {children}
    </ActiveEventContext.Provider>
  );
}

/** Devuelve el evento activo actual, leyéndolo de Firebase si está disponible. */
export function useActiveMeta(): ActiveEventContextValue {
  return useContext(ActiveEventContext);
}
