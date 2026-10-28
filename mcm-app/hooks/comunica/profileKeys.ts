// hooks/comunica/profileKeys.ts
//
// La forma de las claves de familia (plan 11): `[bloque, pid, …]`, sin el
// prefijo `comunica` (lo pone `areaKey`). Aparte de `useProfileQuery` para
// que `useAreaQuery` lo compruebe sin importarse en círculo.

import type { QueryKey } from '@tanstack/react-query';

/**
 * Los bloques de familia de la caché (el primer elemento de la clave). Cada
 * plan añade aquí el suyo; `useAreaQuery` y un test lo comprueban.
 */
export const FAMILY_BLOCKS = [
  'calendar', // 16 (y la agenda de la portada, 11)
  'documents', // 16
  'activities', // 13
  'registrations', // 14
  'signup', // 14
  'pagos', // 15
  'datos', // 12
  'salud', // 12
] as const;
export type FamilyBlock = (typeof FAMILY_BLOCKS)[number];

/** La clave de una consulta de familia, sin el prefijo `comunica`. */
export const profileKey = (
  block: FamilyBlock,
  pid: string,
  ...rest: (string | number)[]
): QueryKey => [block, pid, ...rest];

/** ¿Tiene la forma `[bloque de familia, pid, …]`? */
export const isProfileKey = (key: QueryKey): boolean =>
  typeof key[0] === 'string' &&
  (FAMILY_BLOCKS as readonly string[]).includes(key[0]) &&
  typeof key[1] === 'string' &&
  key[1].length > 0;
