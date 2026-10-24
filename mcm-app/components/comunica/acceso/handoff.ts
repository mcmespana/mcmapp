// Lo que pasa de una pantalla de entrar a la siguiente (plan 02): el correo o
// el DNI, el correo enmascarado al que se mandó el código, y —para «¿Quién
// eres?»— el código y los nombres de las fichas. Va EN MEMORIA, nunca en los
// parámetros de la URL: en web la URL se queda en el historial del navegador,
// y un DNI con su código o los nombres de tres menores no pintan nada ahí.
//
// La URL solo lleva una llave opaca (`?k=`). Si la llave no está (la pestaña
// se ha recargado, o el enlace se ha copiado), la pantalla lo dice y manda a
// empezar otra vez. Se olvida todo al entrar.

import type { PersonChoice, VerifyRequest } from '@/services/comunica/contract';

export interface CodeHandoff {
  via: 'email' | 'dni';
  value: string;
  sentTo?: string;
}

export interface ChooseHandoff {
  body: VerifyRequest;
  choices: PersonChoice[];
}

const store = new Map<string, unknown>();

const newKey = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

function put(value: unknown): string {
  const k = newKey();
  store.set(k, value);
  return k;
}

export const putCodeHandoff = (h: CodeHandoff) => put({ kind: 'code', ...h });
export const putChooseHandoff = (h: ChooseHandoff) =>
  put({ kind: 'choose', ...h });

/** La entrega de `acceso-codigo`, o `null` si la llave no vale. */
export function getCodeHandoff(k: string | undefined): CodeHandoff | null {
  const v = k ? (store.get(k) as { kind?: string } | undefined) : undefined;
  if (!v || v.kind !== 'code') return null;
  const { via, value, sentTo } = v as CodeHandoff & { kind: string };
  return { via, value, sentTo };
}

/** La entrega de `acceso-elegir`, o `null` si la llave no vale. */
export function getChooseHandoff(k: string | undefined): ChooseHandoff | null {
  const v = k ? (store.get(k) as { kind?: string } | undefined) : undefined;
  if (!v || v.kind !== 'choose') return null;
  const { body, choices } = v as ChooseHandoff & { kind: string };
  return { body, choices };
}

/** Al entrar (o salir), se olvida todo. */
export function clearAccessHandoffs(): void {
  store.clear();
}
