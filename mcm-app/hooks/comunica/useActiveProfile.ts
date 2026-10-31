// hooks/comunica/useActiveProfile.ts
//
// LA PIEZA DE LOS PLANES DE FAMILIAS (11-16): a quién se está viendo —uno
// mismo o un hijo— y cómo se cambia. Lo da `ActiveProfileProvider`
// (`components/comunica/perfiles/`), montado en `comunica/_layout.tsx`.
//
//   const { pid, audience, ready } = useActiveProfile();
//
//   · `pid` es lo que va en `/v1/profiles/:pid/…` y en la clave de cada
//     consulta de familia (`useProfileQuery`, que ya lo pone).
//   · Cada pantalla de familia declara si es COMPARTIDA (no es de nadie: la
//     lista de eventos, la ficha de un evento, el calendario) o PERSONAL (una
//     inscripción, un pago, unos datos) con `useProfileScope`. Así, cambiar
//     de persona con `ActiveProfileBar` se queda (y recarga con el pid nuevo)
//     o vuelve a la portada (FAM-a8).
//
// Cambiar de perfil es estado del móvil: sin escrituras, sin cola.

import { createContext, useContext, useEffect, useId } from 'react';
import { useRouter } from 'expo-router';
import type { ProfileRef } from '@/services/comunica/contract';
import {
  audienceFor,
  type Audience,
  type FamilySection,
  type ProfileScope,
  switchDestination,
} from '@/utils/comunica/profiles';
import type { useMyProfiles } from './useMyProfiles';

export interface ActiveProfile {
  /**
   * Ya se sabe a quién se ve: está leída la elección guardada y han llegado
   * los perfiles (o han fallado: entonces, la persona que ha entrado).
   */
  ready: boolean;
  /** Quien se ve: el `pid` de las rutas de familia. `null` sin sesión. */
  pid: string | null;
  /** Su ficha corta (nombre y género). */
  profile: ProfileRef | null;
  /** Quien ha entrado. */
  self: ProfileRef | null;
  /** Sus hijos con relación vigente (vacío si no tiene o no se sabe). */
  children: ProfileRef[];
  /** Tiene hijos: hay selector. */
  hasChildren: boolean;
  viewingSelf: boolean;
  audience: Audience;
  /** Miembro del MCM (papel `member` o de equipo). */
  member: boolean;
  /** Se ha elegido a propósito (o solo, con un único hijo). */
  chosen: boolean;
  /**
   * Hay que elegir antes de enseñar nada de familia: solo familiar, con
   * varios hijos y sin haber elegido nunca. La portada pinta «¿A quién
   * quieres ver?» en su sitio.
   */
  mustChoose: boolean;
  /** El nombre de pila del hijo que se ve (`''` viéndose a sí mismo). */
  childFirstName: string;
  /** Elegir a quién se ve (se recuerda en el móvil, por persona). */
  choose(pid: string): void;
  /** La consulta de los perfiles, para «¿A quién ves?». */
  profilesQuery: ReturnType<typeof useMyProfiles> | null;
  /** Lo usa `useProfileScope`: la pantalla de arriba del todo manda. */
  registerScope(id: string, scope: ScreenScope): () => void;
  /** El ámbito de la pantalla de arriba (o `null`: la portada). */
  currentScope(): ScreenScope | null;
}

export interface ScreenScope {
  scope: ProfileScope;
  /** Su sección (para saber si la nueva audiencia la tiene). */
  section: FamilySection | null;
}

const NONE: ActiveProfile = {
  ready: false,
  pid: null,
  profile: null,
  self: null,
  children: [],
  hasChildren: false,
  viewingSelf: true,
  audience: 'member',
  member: false,
  chosen: false,
  mustChoose: false,
  childFirstName: '',
  choose: () => {},
  profilesQuery: null,
  registerScope: () => () => {},
  currentScope: () => null,
};

export const ActiveProfileContext = createContext<ActiveProfile>(NONE);

/** A quién se está viendo (uno mismo o un hijo). */
export function useActiveProfile(): ActiveProfile {
  return useContext(ActiveProfileContext);
}

/**
 * Lo declara cada pantalla de familia: `shared` (se queda al cambiar de
 * persona si la nueva audiencia tiene esa sección) o `personal` (vuelve a la
 * portada). Sin declarar (la portada), cambiar se queda.
 */
export function useProfileScope(
  scope: ProfileScope,
  section: FamilySection | null = null,
): void {
  const { registerScope } = useActiveProfile();
  const id = useId();
  useEffect(
    () => registerScope(id, { scope, section }),
    [registerScope, id, scope, section],
  );
}

/**
 * Cambiar de persona desde una pantalla (lo usan `ActiveProfileBar` y su
 * hoja): elige y, según el ámbito de la pantalla de arriba, se queda o vuelve
 * a la portada.
 */
export function useSwitchProfile() {
  const router = useRouter();
  const active = useActiveProfile();
  return (pid: string) => {
    if (pid === active.pid) return;
    const next = audienceFor(
      { member: active.member, hasChildren: active.hasChildren },
      pid === active.self?.id,
    );
    const screen = active.currentScope();
    active.choose(pid);
    if (
      screen &&
      switchDestination(screen.scope, screen.section, next) === 'home' &&
      router.canDismiss()
    ) {
      router.dismissAll();
    }
  };
}
