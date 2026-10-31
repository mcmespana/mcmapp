// components/comunica/perfiles/ActiveProfileProvider.tsx
//
// El que sabe a quién se está viendo (plan 11). Va en `comunica/_layout.tsx`,
// dentro de `ComunicaAreaProvider` (necesita la sesión y las consultas), y da
// `useActiveProfile()` a todas las pantallas del área.
//
//   · La elección (`{ activeId, chosen }`) se guarda en el cajón `profile`
//     de la persona: sobrevive a cerrar la app y «Salir» la borra.
//   · A quién se ve al entrar, la tabla de `initialProfile`; un hijo
//     recordado que ya no viene se descarta y se vuelve a aplicar la tabla.
//   · Sin los perfiles (sin conexión la primera vez), quien ha entrado o lo
//     que eligió: el servidor vuelve a comprobar el `pid` igualmente.

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ProfileRef } from '@/services/comunica/contract';
import { readDrawer, writeDrawer } from '@/services/comunica/storage';
import {
  ActiveProfileContext,
  type ActiveProfile,
  type ScreenScope,
} from '@/hooks/comunica/useActiveProfile';
import { useMyProfiles } from '@/hooks/comunica/useMyProfiles';
import {
  audienceFor,
  firstNameOf,
  initialProfile,
  isMemberRoles,
  type ProfileChoice,
} from '@/utils/comunica/profiles';
import { useArea } from '../comun/ComunicaAreaProvider';

const isChoice = (x: unknown): x is ProfileChoice =>
  !!x &&
  typeof (x as ProfileChoice).activeId === 'string' &&
  typeof (x as ProfileChoice).chosen === 'boolean';

/** «Rosa Martín Pozo» → la ficha corta, mientras no lleguen los perfiles. */
const selfFromName = (id: string, name: string): ProfileRef => {
  const first = firstNameOf(name);
  return {
    id,
    firstName: first || null,
    lastName: name.trim().slice(first.length).trim() || null,
    gender: null,
  };
};

export default function ActiveProfileProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session } = useArea();
  const me = session.status === 'signedIn' ? session.me : null;
  const personId = me?.personId ?? null;
  const profilesQuery = useMyProfiles(!!personId);

  // La elección guardada de ESTA persona (al cambiar de persona, otra).
  const [saved, setSaved] = useState<{
    of: string;
    choice: ProfileChoice | null;
  } | null>(null);
  useEffect(() => {
    if (!personId) return;
    let cancelled = false;
    void readDrawer<unknown>(personId, 'profile').then((raw) => {
      if (!cancelled) {
        setSaved({ of: personId, choice: isChoice(raw) ? raw : null });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [personId]);
  const savedLoaded = !!personId && saved?.of === personId;
  const savedChoice = savedLoaded ? saved!.choice : null;

  const choose = useCallback(
    (pid: string) => {
      if (!personId) return;
      const choice: ProfileChoice = { activeId: pid, chosen: true };
      setSaved({ of: personId, choice });
      void writeDrawer(personId, 'profile', choice);
    },
    [personId],
  );

  // El ámbito de las pantallas montadas: manda la última (la de arriba).
  const scopes = useRef<{ id: string; scope: ScreenScope }[]>([]);
  const registerScope = useCallback((id: string, scope: ScreenScope) => {
    scopes.current = [
      ...scopes.current.filter((s) => s.id !== id),
      {
        id,
        scope,
      },
    ];
    return () => {
      scopes.current = scopes.current.filter((s) => s.id !== id);
    };
  }, []);
  const currentScope = useCallback(
    () => scopes.current.at(-1)?.scope ?? null,
    [],
  );

  const data = profilesQuery.data;
  const value = useMemo<ActiveProfile>(() => {
    const member = isMemberRoles(me?.roles ?? []);
    const self: ProfileRef | null = data
      ? data.self
      : personId && me
        ? selfFromName(personId, me.name)
        : null;
    const kids = data?.children ?? [];
    // Sin perfiles, lo elegido (el servidor comprueba el `pid` igual).
    const state = data
      ? initialProfile({ member, profiles: data, saved: savedChoice })
      : {
          activeId: savedChoice?.activeId ?? personId ?? '',
          chosen: savedChoice?.chosen ?? false,
          mustChoose: false,
        };
    const hasChildren = data
      ? kids.length > 0
      : !!me?.roles.includes('guardian');
    const viewingSelf = !self || state.activeId === self.id;
    const profile = viewingSelf
      ? self
      : (kids.find((k) => k.id === state.activeId) ?? {
          id: state.activeId,
          firstName: null,
          lastName: null,
          gender: null,
        });
    return {
      ready: savedLoaded && (data !== undefined || profilesQuery.error != null),
      pid: personId ? state.activeId || personId : null,
      profile,
      self,
      children: kids,
      hasChildren,
      viewingSelf,
      audience: audienceFor({ member, hasChildren }, viewingSelf),
      member,
      chosen: state.chosen,
      mustChoose: state.mustChoose,
      childFirstName: viewingSelf ? '' : firstNameOf(profile?.firstName),
      choose,
      profilesQuery,
      registerScope,
      currentScope,
    };
  }, [
    me,
    personId,
    data,
    savedChoice,
    savedLoaded,
    profilesQuery,
    choose,
    registerScope,
    currentScope,
  ]);

  return (
    <ActiveProfileContext.Provider value={value}>
      {children}
    </ActiveProfileContext.Provider>
  );
}
