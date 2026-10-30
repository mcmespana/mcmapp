// utils/comunica/notices.ts
//
// Los avisos de comportamiento de una ficha (plan 05, regla 20;
// `PASAR-LISTA-CAMPOS-CRM.md` §6 del plugin). El número NO se guarda: sale de
// ordenar por fecha y id, así que retirar el del medio renumera los demás.

import type { Notice } from '@/services/comunica/contract';

export interface NumberedNotice extends Notice {
  number: number;
  /** Aún en la cola del móvil. */
  pending?: boolean;
  /** La clave de su entrada en la cola, para su `UploadStatus`. */
  outboxKey?: string;
}

export function numberNotices(
  notices: readonly (Notice & { pending?: boolean; outboxKey?: string })[],
): NumberedNotice[] {
  return [...notices]
    .sort((a, b) =>
      a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.id < b.id ? -1 : 1,
    )
    .map((n, i) => ({ ...n, number: i + 1 }));
}

/** El tramo de la escala (1 ámbar, 2 naranja, 3 rojo); por encima, el último. */
export const noticeTier = (n: number): 1 | 2 | 3 =>
  n <= 1 ? 1 : n === 2 ? 2 : 3;

export type NoticeWarning =
  | { kind: 'next_is_exit'; limit: number }
  | { kind: 'at_limit'; count: number }
  | null;

/** El recordatorio de debajo del último aviso. */
export function noticeWarning(count: number, limit: number): NoticeWarning {
  if (count >= limit) return { kind: 'at_limit', count };
  if (count === limit - 1) return { kind: 'next_is_exit', limit };
  return null;
}

export const noticesLabel = (n: number) =>
  n === 1 ? '1 aviso' : `${n} avisos`;
