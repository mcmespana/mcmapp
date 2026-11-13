// El pañuelo virtual de una persona: qué piezas tiene, cuáles lleva cosidas y
// de qué color es el pañuelo.
//
// Es un hook y no un contexto a propósito: solo lo usan la pantalla del
// pañuelo y el panel del laboratorio, así que no hay nada que cargar al
// arrancar la app. Dos montajes a la vez no se dan (el laboratorio se cierra
// antes de abrir la pantalla).
//
// Persistencia, igual que la colección de Carismochitos: AsyncStorage siempre
// y `users/{uid}/panuelo` además cuando hay sesión. Las piezas se SUMAN entre
// el móvil y la nube; el color y la colocación son del último que los tocó
// (`mergePanuelo`).
//
// Documentación: `docs/funcionalidades/PANUELO.md`.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_PANUELO_CATALOG } from '@/constants/panueloCatalog';
import { useAuth } from '@/contexts/AuthContext';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import type {
  PanueloCatalog,
  PanueloColor,
  PanueloItemDef,
  PanueloUserState,
  PanueloVia,
} from '@/types/panuelo';
import { trackEvent } from '@/utils/analytics';
import {
  clearPanuelo,
  fetchPanuelo,
  syncPanueloItem,
  syncPanueloLayout,
} from '@/utils/authHelpers';
import { logger } from '@/utils/logger';
import {
  EMPTY_PANUELO,
  grantItem,
  mergePanuelo,
  moveItem,
  pendingAutoGrants,
  placeItem,
  redeemCode,
  rotateItem,
  sanitizeCatalog,
  sanitizeUserState,
  setPanueloColor,
  unplaceItem,
  type RedeemResult,
} from '@/utils/panuelo';

export const PANUELO_STATE_KEY = '@panuelo_state';
/** Las piezas que ya se le han presentado a la persona en ESTE móvil. */
export const PANUELO_SEEN_KEY = '@panuelo_seen';

/** Cuánto se espera antes de subir la colocación: arrastrar no es escribir. */
const LAYOUT_SYNC_DELAY_MS = 1200;

export interface PanueloValue {
  /** Ya se ha leído lo guardado en el móvil. */
  ready: boolean;
  catalog: PanueloCatalog;
  state: PanueloUserState;
  /**
   * Piezas que se tienen y todavía no se han presentado (recién conseguidas,
   * o repartidas desde el Panel mientras la app estaba cerrada).
   */
  unseen: string[];
  /** Marca una pieza como presentada. */
  markSeen: (id: string) => void;
  setColor: (color: PanueloColor) => void;
  /** Cose la pieza en el primer hueco libre. */
  place: (id: string) => void;
  /** La descose: vuelve a la colección, no se pierde. */
  unplace: (id: string) => void;
  move: (id: string, u: number, v: number) => void;
  rotate: (id: string, degrees: number) => void;
  /** Canjea un código. Si abre una pieza nueva, la añade y la cose. */
  redeem: (code: string) => RedeemResult;
  /** Solo laboratorio: darse piezas de muestra. */
  grantDemo: (ids: string[]) => void;
  /** Solo laboratorio: empezar de cero (móvil y nube). */
  reset: () => Promise<void>;
}

export function usePanuelo(): PanueloValue {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  // El catálogo: el del Panel si lo hay; si no (sin red la primera vez, o el
  // nodo aún sin crear), el de muestra que va con la app.
  const { data: remoteCatalog } = useFirebaseData<PanueloCatalog>(
    'panuelo',
    'panuelo_catalog',
    sanitizeCatalog,
  );
  const catalog = useMemo(
    () =>
      remoteCatalog && Object.keys(remoteCatalog).length > 0
        ? remoteCatalog
        : DEFAULT_PANUELO_CATALOG,
    [remoteCatalog],
  );

  const [state, setState] = useState<PanueloUserState>(EMPTY_PANUELO);
  const [seen, setSeen] = useState<Record<string, true>>({});
  const [localLoaded, setLocalLoaded] = useState(false);

  // Fuente de verdad síncrona: dos gestos seguidos parten cada uno del
  // resultado del anterior, no de un `state` cerrado en un render viejo.
  const stateRef = useRef<PanueloUserState>(EMPTY_PANUELO);
  const seenRef = useRef<Record<string, true>>({});
  const uidRef = useRef(uid);
  useEffect(() => {
    uidRef.current = uid;
  }, [uid]);
  const layoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback((next: PanueloUserState) => {
    stateRef.current = next;
    setState(next);
    AsyncStorage.setItem(PANUELO_STATE_KEY, JSON.stringify(next)).catch((err) =>
      logger.warn('[Pañuelo] no se pudo guardar:', err),
    );
  }, []);

  const persistSeen = useCallback((next: Record<string, true>) => {
    seenRef.current = next;
    setSeen(next);
    AsyncStorage.setItem(
      PANUELO_SEEN_KEY,
      JSON.stringify(Object.keys(next)),
    ).catch(() => {});
  }, []);

  const scheduleLayoutSync = useCallback(() => {
    if (layoutTimer.current) clearTimeout(layoutTimer.current);
    layoutTimer.current = setTimeout(() => {
      layoutTimer.current = null;
      const current = uidRef.current;
      if (current) syncPanueloLayout(current, stateRef.current);
    }, LAYOUT_SYNC_DELAY_MS);
  }, []);

  // Al salir de la pantalla, lo pendiente se sube ya.
  useEffect(
    () => () => {
      if (!layoutTimer.current) return;
      clearTimeout(layoutTimer.current);
      const current = uidRef.current;
      if (current) syncPanueloLayout(current, stateRef.current);
    },
    [],
  );

  /** Aplica un cambio de colocación o de color y lo guarda (móvil y nube). */
  const applyLayout = useCallback(
    (change: (s: PanueloUserState, now: number) => PanueloUserState) => {
      const next = change(stateRef.current, Date.now());
      if (next === stateRef.current) return;
      persist(next);
      scheduleLayoutSync();
    },
    [persist, scheduleLayoutSync],
  );

  /** Añade piezas a la colección y las cose. Devuelve las que eran nuevas. */
  const award = useCallback(
    (items: PanueloItemDef[], via: PanueloVia): string[] => {
      const now = Date.now();
      let next = stateRef.current;
      const fresh: string[] = [];
      for (const item of items) {
        if (next.items[item.id]) continue;
        next = placeItem(grantItem(next, item.id, via, now), item.id, now);
        fresh.push(item.id);
        trackEvent('panuelo_pieza_conseguida', { clase: item.kind, via });
      }
      if (fresh.length === 0) return fresh;
      persist(next);
      const current = uidRef.current;
      if (current) {
        for (const id of fresh) syncPanueloItem(current, id, next.items[id]);
        scheduleLayoutSync();
      }
      return fresh;
    },
    [persist, scheduleLayoutSync],
  );

  // Local al montar.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [storedState, storedSeen] = await Promise.all([
          AsyncStorage.getItem(PANUELO_STATE_KEY),
          AsyncStorage.getItem(PANUELO_SEEN_KEY),
        ]);
        if (!mounted) return;
        const local = sanitizeUserState(
          storedState ? JSON.parse(storedState) : null,
        );
        stateRef.current = local;
        setState(local);
        const ids: unknown = storedSeen ? JSON.parse(storedSeen) : [];
        const seenMap: Record<string, true> = {};
        if (Array.isArray(ids)) {
          for (const id of ids) if (typeof id === 'string') seenMap[id] = true;
        }
        seenRef.current = seenMap;
        setSeen(seenMap);
      } catch (err) {
        logger.warn('[Pañuelo] lo guardado en el móvil no se pudo leer:', err);
      }
      if (mounted) setLocalLoaded(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Con sesión: mezclar con la nube y subir lo que el móvil lleve de más.
  useEffect(() => {
    if (!uid || !localLoaded) return;
    let mounted = true;
    (async () => {
      const remote = await fetchPanuelo(uid);
      // Si la lectura falla no se sabe qué hay arriba: no se sube nada.
      if (!mounted || !remote) return;
      const local = stateRef.current;
      const firstTimeHere =
        Object.keys(local.items).length === 0 &&
        Object.keys(seenRef.current).length === 0;
      const { merged, upload } = mergePanuelo(local, remote);
      persist(merged);
      if (firstTimeHere) {
        // Móvil nuevo: lo que ya tenía en la nube no se le «presenta» otra
        // vez, pieza a pieza, como si lo acabara de conseguir.
        const all: Record<string, true> = {};
        for (const id of Object.keys(merged.items)) all[id] = true;
        persistSeen(all);
      }
      if (upload) {
        for (const [id, owned] of Object.entries(merged.items)) {
          if (!remote.items[id] || remote.items[id].at !== owned.at) {
            syncPanueloItem(uid, id, owned);
          }
        }
        if (merged.layoutAt > remote.layoutAt) syncPanueloLayout(uid, merged);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [uid, localLoaded, persist, persistSeen]);

  // Las piezas «para todo el mundo» se consiguen solas al abrir el pañuelo.
  useEffect(() => {
    if (!localLoaded) return;
    const pending = pendingAutoGrants(catalog, stateRef.current, Date.now());
    if (pending.length > 0) award(pending, 'all');
  }, [localLoaded, catalog, award]);

  // Una pieza repartida desde el Panel llega sin sitio: se le busca hueco.
  useEffect(() => {
    if (!localLoaded) return;
    const current = stateRef.current;
    const loose = Object.keys(current.items).filter(
      (id) => !current.layout[id] && !seenRef.current[id] && catalog[id],
    );
    if (loose.length === 0) return;
    applyLayout((s, now) =>
      loose.reduce((acc, id) => placeItem(acc, id, now), s),
    );
  }, [localLoaded, catalog, state.items, applyLayout]);

  const unseen = useMemo(
    () =>
      Object.entries(state.items)
        .filter(([id]) => !seen[id] && catalog[id])
        .sort(([, a], [, b]) => a.at - b.at)
        .map(([id]) => id),
    [state.items, seen, catalog],
  );

  const markSeen = useCallback(
    (id: string) => {
      if (seenRef.current[id]) return;
      persistSeen({ ...seenRef.current, [id]: true });
    },
    [persistSeen],
  );

  const setColor = useCallback(
    (color: PanueloColor) =>
      applyLayout((s, now) => setPanueloColor(s, color, now)),
    [applyLayout],
  );
  const place = useCallback(
    (id: string) => applyLayout((s, now) => placeItem(s, id, now)),
    [applyLayout],
  );
  const unplace = useCallback(
    (id: string) => applyLayout((s, now) => unplaceItem(s, id, now)),
    [applyLayout],
  );
  const move = useCallback(
    (id: string, u: number, v: number) =>
      applyLayout((s, now) => moveItem(s, id, u, v, now)),
    [applyLayout],
  );
  const rotate = useCallback(
    (id: string, degrees: number) =>
      applyLayout((s, now) => rotateItem(s, id, degrees, now)),
    [applyLayout],
  );

  const redeem = useCallback(
    (code: string): RedeemResult => {
      const result = redeemCode(catalog, stateRef.current, code, Date.now());
      if (result.ok && !result.already) award([result.item], 'code');
      return result;
    },
    [catalog, award],
  );

  const grantDemo = useCallback(
    (ids: string[]) => {
      const fresh = award(
        ids
          .map((id) => catalog[id])
          .filter((item): item is PanueloItemDef => !!item),
        'demo',
      );
      // De golpe y sin ceremonia: presentar quince piezas una a una cansa.
      const next = { ...seenRef.current };
      for (const id of fresh) next[id] = true;
      persistSeen(next);
    },
    [catalog, award, persistSeen],
  );

  const reset = useCallback(async () => {
    if (layoutTimer.current) clearTimeout(layoutTimer.current);
    layoutTimer.current = null;
    persist(EMPTY_PANUELO);
    persistSeen({});
    const current = uidRef.current;
    if (current) await clearPanuelo(current);
  }, [persist, persistSeen]);

  return {
    ready: localLoaded,
    catalog,
    state,
    unseen,
    markSeen,
    setColor,
    place,
    unplace,
    move,
    rotate,
    redeem,
    grantDemo,
    reset,
  };
}
