import React from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

/**
 * Tipos y helpers puros de la pantalla de Grupos. Extraído de
 * app/screens/GruposScreen.tsx para poder compartirlos entre la pantalla y sus
 * subcomponentes (tarjeta, fila de miembro, fila de resultado de búsqueda).
 */

export type MaterialIconName = React.ComponentProps<
  typeof MaterialIcons
>['name'];

export interface Grupo {
  nombre: string;
  responsable?: string;
  miembros?: string[];
  subtitulo?: string;
  mapa?: string;
}

export type Data = Record<string, Grupo[]>;

export interface SearchHit {
  categoria: string;
  grupo: Grupo;
  /** member string (or responsable). Empty when the match is the group name. */
  miembro?: string;
  /** true if the match was on the responsable. */
  isResponsable?: boolean;
  /** true if the match was on the group name itself. */
  isGroupName?: boolean;
}

/** Minúsculas + sin acentos, para comparar/buscar de forma tolerante. */
export const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** ¿El nombre coincide con el del usuario actual (comparación tolerante)? */
export function isMe(name: string | undefined | null, myName: string) {
  if (!name || !myName) return false;
  return normalize(name).includes(normalize(myName));
}
