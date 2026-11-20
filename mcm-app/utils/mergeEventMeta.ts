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
import { isSafeHeroSvg } from '@/utils/eventHeroSvg';

/**
 * Forma del nodo `activities/<id>/_meta` tal cual lo escribe el panel (plano,
 * NO `{ updatedAt, data }`). Todos los campos son opcionales.
 */
export interface RemoteEventMeta {
  status?: string;
  title?: string;
  tintColor?: string;
  bannerText?: string;
  /**
   * Logo del evento (URL https de una imagen PNG/JPG/WebP; SVG no: la `Image`
   * de RN no lo pinta). Sustituye al emblema de estrellitas del hub. Lo sube el
   * panel (Actividades → metadatos del evento) a Firebase Storage.
   */
  heroImageUrl?: string;
  /**
   * Logo dibujado con código (SVG como texto). Se usa si no hay `heroImageUrl`.
   * Solo se admite SVG «seguro» (`utils/eventHeroSvg.ts`).
   */
  heroSvg?: string;
  updatedAt?: string;
}

const isHttpsUrl = (v: unknown): v is string =>
  typeof v === 'string' && /^https:\/\/\S+$/.test(v.trim());

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
 * - `heroImageUrl`: URL `https://…` (otro esquema o texto suelto se ignora).
 * - `heroSvg`: SVG seguro; la imagen subida tiene prioridad sobre él.
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
  // Logo remoto: la imagen subida manda sobre el SVG, y los dos sobre el
  // `heroImage` del registry (si no, un evento con logo en el código no podría
  // cambiarse desde el panel).
  if (isHttpsUrl(meta.heroImageUrl)) {
    merged.heroImage = { uri: meta.heroImageUrl.trim() };
    merged.heroSvg = undefined;
  } else if (isSafeHeroSvg(meta.heroSvg)) {
    merged.heroSvg = meta.heroSvg.trim();
    merged.heroImage = undefined;
  }
  if (meta.status === 'active' || meta.status === 'archived') {
    merged.status = meta.status;
  }

  return merged;
}
