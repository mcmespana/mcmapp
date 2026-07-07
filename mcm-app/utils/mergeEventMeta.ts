// utils/mergeEventMeta.ts
//
// B1 del PLAN_INTEGRACIONES: el MCM Panel edita por evento `title`, `tintColor`,
// `bannerText` y `status` en `activities/<id>/_meta`, pero la app usaba solo el
// registry hardcodeado (`constants/events.ts`) y lo ignoraba. Este helper puro
// mergea ese `_meta` remoto sobre la `EventConfig` local, de modo que el panel
// pueda cambiar el título/color/banner o archivar un evento SIN publicar una
// versión nueva de la app.
//
// Retrocompatible: si el `_meta` remoto falta o trae campos vacíos/ inválidos,
// se conserva el valor del registry. Crear un evento 100% nuevo sigue
// requiriendo registrarlo en `events.ts` (las `sections` y pantallas son código).

import type { EventConfig } from '@/constants/events';

/**
 * Forma del nodo `activities/<id>/_meta` tal cual lo escribe el panel (plano,
 * NO `{ updatedAt, data }`). Todos los campos son opcionales.
 */
export interface RemoteEventMeta {
  status?: string;
  title?: string;
  tintColor?: string;
  bannerText?: string;
  updatedAt?: string;
}

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

const isHexColor = (v: unknown): v is string =>
  typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim());

/**
 * Mergea el `_meta` remoto sobre la config local del evento. Solo pisa un campo
 * cuando el remoto trae un valor válido; si no, conserva el del registry.
 *
 * - `title` / `bannerText`: string no vacío.
 * - `tintColor`: hex `#RRGGBB` válido (un color inválido rompería la UI).
 * - `status`: solo `'active'` o `'archived'`.
 */
export function mergeEventMeta(
  base: EventConfig,
  meta?: RemoteEventMeta | null,
): EventConfig {
  if (!meta || typeof meta !== 'object') return base;

  const merged: EventConfig = { ...base };

  if (isNonEmptyString(meta.title)) merged.title = meta.title.trim();
  if (isNonEmptyString(meta.bannerText)) {
    merged.bannerText = meta.bannerText.trim();
  }
  if (isHexColor(meta.tintColor)) merged.tintColor = meta.tintColor.trim();
  if (meta.status === 'active' || meta.status === 'archived') {
    merged.status = meta.status;
  }

  return merged;
}
