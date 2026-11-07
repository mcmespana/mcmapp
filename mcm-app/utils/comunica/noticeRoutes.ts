// utils/comunica/noticeRoutes.ts
//
// A dónde lleva un aviso del área al tocarlo (plan 08). Puro, sin React.
//
//   · `rollcall_due`   («¿Has pasado lista?») → marcar ese grupo en esa sesión.
//   · `group_changed`  («Novedades en tu grupo») → la ficha del grupo.
//   · `outbox_pending` («Tienes N listas sin subir») → la portada.
//   · Tipo o versión desconocidos, ids con forma rara → la portada.
//   · Con el área nativa apagada (plan 01/10) → `/comunica`, que es la WebView.
//
// LA APP NUNCA NAVEGA A UNA RUTA QUE VENGA EN EL AVISO: el destino sale de
// esta tabla. Y el destino hace sus comprobaciones de siempre (sin sesión, la
// puerta del plan 02; fuera de alcance, el 403 de `AreaState`).

import type { QueryKey } from '@tanstack/react-query';
import { ComunicaPushData } from '@/services/comunica/contract';

export type NoticeHref =
  | { pathname: '/comunica' }
  | {
      pathname: '/comunica/pasar-lista/[groupId]';
      params: { groupId: string; sesion?: string };
    }
  | { pathname: '/comunica/grupos/[groupId]'; params: { groupId: string } };

/** Todas las rutas que puede devolver `routeForComunicaNotice` (guardarraíl). */
export const NOTICE_PATHNAMES: readonly NoticeHref['pathname'][] = [
  '/comunica',
  '/comunica/pasar-lista/[groupId]',
  '/comunica/grupos/[groupId]',
];

const HOME: NoticeHref = { pathname: '/comunica' };

/** ¿Es un aviso del área? Basta con la marca: lo demás se valida después. */
export function isComunicaNotice(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { source?: unknown }).source === 'comunica'
  );
}

/** El `data` validado, o `null` si no es de esta versión o tiene algo raro. */
export function parseComunicaNotice(data: unknown): ComunicaPushData | null {
  const parsed = ComunicaPushData.safeParse(data);
  return parsed.success ? parsed.data : null;
}

export function routeForComunicaNotice(
  data: unknown,
  { nativeOn }: { nativeOn: boolean },
): NoticeHref {
  if (!nativeOn) return HOME;
  const n = parseComunicaNotice(data);
  if (!n) return HOME;
  switch (n.type) {
    case 'rollcall_due':
      return n.groupId
        ? {
            pathname: '/comunica/pasar-lista/[groupId]',
            params: {
              groupId: n.groupId,
              ...(n.sessionId ? { sesion: n.sessionId } : {}),
            },
          }
        : HOME;
    case 'group_changed':
      return n.groupId
        ? {
            pathname: '/comunica/grupos/[groupId]',
            params: { groupId: n.groupId },
          }
        : HOME;
    default:
      return HOME;
  }
}

/**
 * Qué consultas del área quedan viejas con un aviso que llega con la app
 * abierta (sin el prefijo `'comunica'`, que pone `areaKey`). Así la pantalla
 * ya lo enseña sin que nadie tenga que deslizar para refrescar.
 */
export function queriesForNotice(n: ComunicaPushData): QueryKey[] {
  switch (n.type) {
    case 'rollcall_due':
      return [
        ['pasar-lista', 'today'],
        ['pasar-lista', 'groups'],
      ];
    case 'group_changed':
      return [
        ['pasar-lista', 'today'],
        ...(n.groupId ? [['grupos', 'group', n.groupId]] : []),
        ['grupos', 'people'],
      ];
    default:
      return [];
  }
}
