// hooks/comunica/useActiveProfile.tsx
//
// La persona que se está viendo (plan 11, familias): uno mismo o un hijo. Es la pieza que usan TODAS las pantallas de familias (planes 12-16):
// de ella salen el `pid` de las consultas (`/v1/profiles/:pid/…`), la audiencia y los textos.
//
//   · `useMyProfiles()` lee quién es quién (`GET /v1/me/profiles`): se guarda en el móvil (solo nombres de los propios hijos) y se borra al salir.
//   · `ActiveProfileProvider` (en el layout del área) decide a quién se ve al abrir (`initialProfile`, lógica pura) y recuerda la elección por
//     persona en el almacén (`profile`: un id y un booleano). Si el hijo recordado ya no viene en la lista, se vuelve a aplicar la tabla.
//   · `useProfileScope(scope, section)` dice a dónde se va al cambiar de persona sin volver a la portada (FAM-a8).
//
// El servidor es quien comprueba cada `pid` en cada petición: esto solo elige qué se pide, nunca concede acceso.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { getComunicaApi } from '@/services/comunica';
import type { MyProfiles, ProfileRef } from '@/services/comunica/contract';
import { readDrawer, writeDrawer } from '@/services/comunica/storage';
import {
  audienceFor,
  initialProfile,
  switchDestination,
  type ActiveChoice,
  type Audience,
  type FamilySection,
  type ProfileScope,
} from '@/utils/comunica/profiles';
import { STALE, areaKey, useAreaQuery } from './useAreaQuery';
import { useMe } from './useMe';

export const PROFILES_KEY = ['perfiles'] as const;

/** Quién es quién: quien ha entrado y sus hijos. Si el CRM no contesta, error: nunca una lista vacía inventada. */
export function useMyProfiles(enabled = true) {
  return useAreaQuery({
    key: [...PROFILES_KEY],
    route: 'myProfiles',
    fetch: () => getComunicaApi().getMyProfiles(),
    staleTime: STALE.state,
    enabled,
  });
}

/** «¿A quién ves?»: al abrirla se vuelve a mirar quiénes son los míos (`fresh=1`), y aparece el hijo recién vinculado. */
export function useRefreshProfiles() {
  const qc = useQueryClient();
  return useCallback(async () => {
    const fresh = await getComunicaApi().getMyProfiles({ fresh: true });
    qc.setQueryData(areaKey([...PROFILES_KEY]), fresh);
    return fresh;
  }, [qc]);
}

export interface ActiveProfile {
  /** Hay con qué decidir: la persona, sus hijos y lo recordado ya se han leído. */
  ready: boolean;
  /** Quién ha entrado y sus hijos (`undefined` mientras llega). */
  profiles: MyProfiles | undefined;
  /** A quién se ve: ella misma o uno de sus hijos. */
  active: ProfileRef | null;
  isSelf: boolean;
  audience: Audience;
  /** ¿Eligió a quién ver alguna vez? (decide el «hay que elegir» de los enlaces, FAM-a1). */
  chosen: boolean;
  /** Solo familiar con varios hijos que no ha elegido nunca: antes de nada, «¿A quién quieres ver?». */
  mustPick: boolean;
  /** Cambia a quién se ve (uno mismo o un hijo de la lista); cuenta como elegido. Un id que no es de la lista no hace nada. */
  setActive: (id: string) => void;
}

const FALLBACK: ActiveProfile = {
  ready: false,
  profiles: undefined,
  active: null,
  isSelf: true,
  audience: 'member',
  chosen: false,
  mustPick: false,
  setActive: () => {},
};

const ActiveProfileContext = createContext<ActiveProfile>(FALLBACK);

export function ActiveProfileProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { me } = useMe();
  const personId = me?.personId ?? null;
  const profilesQuery = useMyProfiles(!!me);
  const profiles = profilesQuery.data;
  // Lo recordado y lo elegido van con la persona a la que pertenecen: si otra entra en el mismo móvil, lo de la anterior ya no cuenta y no hay que
  // «resetear» nada con un efecto.
  const [loaded, setLoaded] = useState<{
    personId: string;
    value: ActiveChoice | null;
  } | null>(null);
  const [pickedBy, setPickedBy] = useState<{
    personId: string;
    value: ActiveChoice;
  } | null>(null);
  /** Lo recordado: `undefined` mientras se lee, `null` si no hay nada. */
  const remembered =
    personId && loaded?.personId === personId ? loaded.value : undefined;
  const picked =
    personId && pickedBy?.personId === personId ? pickedBy.value : null;

  useEffect(() => {
    if (!personId) return;
    let cancelled = false;
    void readDrawer<ActiveChoice>(personId, 'profile').then((saved) => {
      if (cancelled) return;
      const value =
        saved && typeof saved.activeId === 'string'
          ? { activeId: saved.activeId, chosen: !!saved.chosen }
          : null;
      setLoaded({ personId, value });
    });
    return () => {
      cancelled = true;
    };
  }, [personId]);

  const initial = useMemo(
    () =>
      me && profiles && remembered !== undefined
        ? initialProfile(me, profiles.children, remembered)
        : null,
    [me, profiles, remembered],
  );

  // Lo elegido ahora manda; si ya no es válido (el hijo dejó de venir), se vuelve a la tabla.
  const { current, mustPick } = useMemo(() => {
    const stillValid =
      !!picked &&
      !!profiles &&
      (picked.activeId === profiles.self.id ||
        profiles.children.some((c) => c.id === picked.activeId));
    const choice: ActiveChoice | null = stillValid
      ? picked
      : initial
        ? { activeId: initial.activeId, chosen: initial.chosen }
        : null;
    return { current: choice, mustPick: !stillValid && !!initial?.mustPick };
  }, [picked, profiles, initial]);

  const setActive = useCallback(
    (id: string) => {
      if (!personId || !profiles) return;
      if (
        id !== profiles.self.id &&
        !profiles.children.some((c) => c.id === id)
      )
        return;
      const next = { activeId: id, chosen: true };
      setPickedBy({ personId, value: next });
      void writeDrawer(personId, 'profile', next);
    },
    [personId, profiles],
  );

  const value = useMemo<ActiveProfile>(() => {
    if (!me || !profiles || !current) return { ...FALLBACK, profiles };
    const active =
      current.activeId === profiles.self.id
        ? profiles.self
        : (profiles.children.find((c) => c.id === current.activeId) ??
          profiles.self);
    return {
      ready: true,
      profiles,
      active,
      isSelf: active.id === profiles.self.id,
      audience: audienceFor(me, active.id),
      chosen: current.chosen,
      mustPick,
      setActive,
    };
  }, [me, profiles, current, mustPick, setActive]);

  return (
    <ActiveProfileContext.Provider value={value}>
      {children}
    </ActiveProfileContext.Provider>
  );
}

/** La persona que se ve (y a quién cambiar). Fuera del proveedor, un valor «no listo». */
export const useActiveProfile = (): ActiveProfile =>
  useContext(ActiveProfileContext);

/**
 * Cada pantalla de familias dice si es de nadie (`shared`: lista de eventos, ficha de un evento, calendario) o de la persona (`personal`: una
 * inscripción, un pago, unos datos). `switchProfile` cambia de persona y, si esa pantalla no vale para la nueva (una personal, o una sección que su
 * audiencia no tiene), vuelve a la portada; si vale, se queda y recarga con el `pid` nuevo (las claves de consulta llevan el `pid`).
 */
export function useProfileScope(
  scope: ProfileScope,
  section: FamilySection | null,
) {
  const { profiles, setActive } = useActiveProfile();
  const { me } = useMe();
  const router = useRouter();
  return useCallback(
    (id: string) => {
      if (!me || !profiles) return;
      setActive(id);
      if (switchDestination(scope, section, audienceFor(me, id)) === 'home')
        router.replace('/comunica');
    },
    [me, profiles, setActive, scope, section, router],
  );
}
