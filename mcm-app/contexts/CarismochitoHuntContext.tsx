// La "caza" de Carismochitos: la colección y las pantallas donde no debe
// asomarse.
//
// Vive aparte de `CarismochitoContext` a propósito: aquel es la máquina de
// estados del MODO (agitar → cuenta atrás → activo) y este es lo que pasa
// DENTRO del modo. Así cada uno se prueba solo.
//
// **Va con el interruptor de Carismochito** (`global.carismochito` en
// `/profileConfig`, ver `utils/carismochitoGate.ts`): la caza y la colección
// existen cuando Carismochito está disponible y no hay nada más que encender.
// Ya no hay un interruptor escondido propio.
//
// Persistencia: AsyncStorage siempre; `users/{uid}/carismochitos` además
// cuando hay sesión, fusionando por el máximo (ver `mergeCollections`).

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { useCarismochitoAvailable } from '@/hooks/useCarismochitoAvailable';
import {
  clearCarismochitos,
  fetchCarismochitos,
  syncCarismochitoEntry,
} from '@/utils/authHelpers';
import {
  addCatch,
  getVariant,
  mergeCollections,
  sanitizeCollection,
  type CarismochitoCollection,
  type CarismochitoVariant,
} from '@/utils/carismochitoCollection';
import { trackEvent } from '@/utils/analytics';
import { logger } from '@/utils/logger';

/**
 * Clave del antiguo interruptor escondido de la caza. Ya no se lee ni se
 * escribe; se borra del móvil al arrancar para no dejar basura.
 */
const LEGACY_HUNT_ENABLED_KEY = '@carismochito_hunt_enabled';
export const COLLECTION_KEY = '@carismochito_collection';

export interface CatchResult {
  variant: CarismochitoVariant;
  /** Cuántos de esta variante lleva, contando este. */
  count: number;
  /** Primera vez que atrapa esta variante. */
  isNew: boolean;
}

interface CarismochitoHuntValue {
  /** Ya se ha leído lo guardado en el móvil y se sabe si hay Carismochito. */
  ready: boolean;
  /** La caza y la colección están disponibles (= Carismochito disponible). */
  huntEnabled: boolean;
  collection: CarismochitoCollection;
  /** Suma una captura (local + nube). `null` si la variante no existe. */
  catchCarismochito: (variantId: string) => CatchResult | null;
  /** Empieza de cero: borra la colección local y la de la nube. */
  resetCollection: () => Promise<void>;
  /** Cambia cada vez que se pide "que aparezca ya" desde el laboratorio. */
  summonToken: number;
  summon: () => void;
  /** Hay alguna pantalla en foco que pide que no se asome. */
  suppressed: boolean;
  /** Marca una pantalla como "sin Carismochito". Devuelve cómo soltarla. */
  suppress: () => () => void;
}

const noop = () => {};

/**
 * Valor por defecto sin provider: todo apagado y sin efectos. Así una pantalla
 * que llama a `useSuppressCarismochito` se puede montar en un test suelto sin
 * la torre de providers entera.
 */
const DEFAULT_VALUE: CarismochitoHuntValue = {
  ready: true,
  huntEnabled: false,
  collection: {},
  catchCarismochito: () => null,
  resetCollection: async () => {},
  summonToken: 0,
  summon: noop,
  suppressed: false,
  suppress: () => noop,
};

const HuntContext = createContext<CarismochitoHuntValue>(DEFAULT_VALUE);

export function useCarismochitoHunt(): CarismochitoHuntValue {
  return useContext(HuntContext);
}

export function CarismochitoHuntProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const { available: huntEnabled, settled } = useCarismochitoAvailable();
  const [collection, setCollection] = useState<CarismochitoCollection>({});
  const [summonToken, setSummonToken] = useState(0);
  const [suppressCount, setSuppressCount] = useState(0);
  // La nube no se toca hasta haber leído el móvil: si no, al fusionar con una
  // colección local todavía vacía, lo que el móvil llevaba de más no se
  // subiría nunca (lo encontró el test "sube lo que este lleva de más").
  const [localLoaded, setLocalLoaded] = useState(false);

  // Fuente de verdad síncrona: dos capturas seguidas (dos toques rápidos)
  // tienen que partir cada una del resultado de la anterior, no de un
  // `collection` cerrado en un render viejo.
  const collectionRef = useRef<CarismochitoCollection>({});
  const commit = useCallback((next: CarismochitoCollection) => {
    collectionRef.current = next;
    setCollection(next);
    AsyncStorage.setItem(COLLECTION_KEY, JSON.stringify(next)).catch((err) =>
      logger.warn('[Carismochito] no se pudo guardar la colección:', err),
    );
  }, []);

  // Local al montar.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(COLLECTION_KEY);
        AsyncStorage.removeItem(LEGACY_HUNT_ENABLED_KEY).catch(noop);
        if (!mounted) return;
        const local = sanitizeCollection(stored ? JSON.parse(stored) : null);
        // Una captura hecha en el primer milisegundo no se pierde: fusionar.
        const merged = mergeCollections(local, collectionRef.current).merged;
        collectionRef.current = merged;
        setCollection(merged);
      } catch (err) {
        logger.warn('[Carismochito] colección local ilegible:', err);
      }
      if (mounted) setLocalLoaded(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Con sesión: hidratar desde la nube y subir lo que el móvil lleve de más.
  useEffect(() => {
    if (!uid || !localLoaded) return;
    let mounted = true;
    (async () => {
      const remote = await fetchCarismochitos(uid);
      if (!mounted) return;
      const { merged, toUpload } = mergeCollections(
        collectionRef.current,
        remote,
      );
      commit(merged);
      for (const id of toUpload) syncCarismochitoEntry(uid, id, merged[id]);
    })();
    return () => {
      mounted = false;
    };
  }, [uid, localLoaded, commit]);

  const catchCarismochito = useCallback(
    (variantId: string): CatchResult | null => {
      const variant = getVariant(variantId);
      if (!variant) return null;
      const isNew = !collectionRef.current[variantId];
      const next = addCatch(collectionRef.current, variantId, Date.now());
      commit(next);
      if (uid) syncCarismochitoEntry(uid, variantId, next[variantId]);
      trackEvent('carismochito_atrapado', {
        rareza: variant.rarity,
        nuevo: isNew,
      });
      return { variant, count: next[variantId].count, isNew };
    },
    [commit, uid],
  );

  const resetCollection = useCallback(async () => {
    commit({});
    if (uid) await clearCarismochitos(uid);
  }, [commit, uid]);

  const summon = useCallback(() => setSummonToken((t) => t + 1), []);

  const suppress = useCallback(() => {
    setSuppressCount((c) => c + 1);
    let released = false;
    return () => {
      // Soltar dos veces (un efecto que se limpia dos veces) no puede dejar
      // el contador en negativo y las pantallas protegidas sin proteger.
      if (released) return;
      released = true;
      setSuppressCount((c) => Math.max(0, c - 1));
    };
  }, []);

  const value = useMemo<CarismochitoHuntValue>(
    () => ({
      ready: localLoaded && settled,
      huntEnabled,
      collection,
      catchCarismochito,
      resetCollection,
      summonToken,
      summon,
      suppressed: suppressCount > 0,
      suppress,
    }),
    [
      localLoaded,
      settled,
      huntEnabled,
      collection,
      catchCarismochito,
      resetCollection,
      summonToken,
      summon,
      suppressCount,
      suppress,
    ],
  );

  return <HuntContext.Provider value={value}>{children}</HuntContext.Provider>;
}
