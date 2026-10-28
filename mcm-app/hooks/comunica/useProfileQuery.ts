// hooks/comunica/useProfileQuery.ts
//
// Las lecturas de familias (planes 11-16): todo lo de la persona que se ve
// cuelga de `/v1/profiles/:pid/…`, y su clave lleva el pid:
//
//   ['comunica', bloque, pid, …resto]
//
// Así, cambiar de hijo no borra nada y volver es instantáneo, y lo de uno
// nunca se pinta como de otro. Úsalo SIEMPRE para una ruta de familia:
// `useAreaQuery` rechaza (lanza) una ruta `/v1/profiles/:pid` cuya clave no
// tenga esta forma, y un test lo vigila.
//
//   const q = useProfileQuery({
//     block: 'activities',
//     route: 'activities',
//     load: (pid) => getComunicaApi().getActivities(pid),
//   });
//
// Una pantalla PERSONAL (`useProfileScope('personal')`) pasa su `pid` de la
// ruta (`datos/[pid]`): si la persona cambia, se va a la portada sin pedir
// nada del hijo de antes con el de ahora.

import type { RouteName } from '@/services/comunica/contract';
import { profileKey, type FamilyBlock } from './profileKeys';
import { useActiveProfile } from './useActiveProfile';
import { useAreaQuery } from './useAreaQuery';

export {
  FAMILY_BLOCKS,
  isProfileKey,
  profileKey,
  type FamilyBlock,
} from './profileKeys';

interface Options<T> {
  block: FamilyBlock;
  /** Lo que va detrás del pid en la clave (un id de evento…). */
  rest?: (string | number)[];
  route: RouteName;
  /** Lo que se pide para ese pid (el nombre `fetch` lo vigila un guardarraíl). */
  load: (pid: string) => Promise<T>;
  /** Por defecto, el del perfil activo. Las pantallas personales, el suyo. */
  pid?: string | null;
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  persist?: boolean;
  retry?: boolean;
}

export function useProfileQuery<T extends { generatedAt: string }>({
  block,
  rest = [],
  route,
  load,
  pid: pinned,
  enabled = true,
  ...opts
}: Options<T>) {
  const active = useActiveProfile();
  const pid = pinned === undefined ? active.pid : pinned;
  return {
    ...useAreaQuery<T>({
      key: profileKey(block, pid ?? '-', ...rest),
      route,
      fetch: () => load(pid!),
      enabled: enabled && !!pid,
      ...opts,
    }),
    pid,
  };
}
