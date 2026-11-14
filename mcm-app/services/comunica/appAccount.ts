// Entrar en Comunica con la cuenta de la app (decisión `identidad-app`): quien
// ya ha entrado en la MCM App con Google o Apple manda su pase de Firebase y el
// servidor lo cambia por una sesión (`POST /v1/auth/app-account`), con la misma
// regla que el código: las fichas de ese correo, o «¿Quién eres?».
//
// Desde el 14/11/2026 (el área nativa pasa a ser la de todos) la comprobación
// se hace SOLA al abrir el acceso y la persona solo pulsa «Entrar en Comunica».
// Nunca se entra sin pulsar, salvo cuando el servidor ha cerrado una sesión que
// ya estaba abierta y la persona no había salido a propósito.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseAuth } from '@/utils/firebaseAuth';
import { getComunicaApi } from './index';
import { isComunicaApiError } from './client';
import type { Me, PersonChoice, Tokens } from './contract';
import {
  APP_ACCOUNT_OPT_OUT_KEY as OPT_OUT_KEY,
  appAccountOptOutMarked,
} from './session';

/** El pase de Firebase de quien ha entrado en la app, o `null`. Con `fresh`, uno recién pedido a Google. */
export async function currentAppIdToken(fresh = false): Promise<string | null> {
  try {
    const u = getFirebaseAuth().currentUser;
    return u ? await u.getIdToken(fresh) : null;
  } catch {
    return null;
  }
}

/** ¿Ha salido de Comunica a propósito? Entonces no se vuelve a entrar solo. */
export async function appAccountOptedOut(): Promise<boolean> {
  if (appAccountOptOutMarked()) return true;
  try {
    return (await AsyncStorage.getItem(OPT_OUT_KEY)) === '1';
  } catch {
    return true;
  }
}

/** Lo que dice el servidor de la cuenta de la app. */
export type AppAccountCheck =
  /** Lista para entrar: la sesión ya está creada, falta guardarla. */
  | { kind: 'ready'; tokens: Tokens; me: Me }
  /** El correo es de varias fichas: «¿Quién eres?». */
  | { kind: 'choose'; idToken: string; choices: PersonChoice[] }
  /** Ese correo no está en Comunica. */
  | { kind: 'no_match' }
  /** No hay cuenta de la app abierta (o Firebase no da el pase). */
  | { kind: 'no_account' }
  /** No se ha podido (sin red, el servidor, el pase): `error` dice qué. */
  | { kind: 'failed'; error: unknown };

/**
 * Comprueba la cuenta de la app contra el servidor. Si el pase no vale
 * (`bad_app_token`: caducado, o con una clave de Google que el servidor aún
 * no tenía), se pide uno nuevo a Firebase y se repite UNA vez.
 */
export async function checkAppAccount(): Promise<AppAccountCheck> {
  let idToken = await currentAppIdToken();
  if (!idToken) return { kind: 'no_account' };
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await getComunicaApi().appAccount({ idToken });
      if ('choose' in res) {
        return { kind: 'choose', idToken, choices: res.choose };
      }
      return { kind: 'ready', tokens: res, me: res.me };
    } catch (e) {
      if (isComunicaApiError(e) && e.reason === 'no_match') {
        return { kind: 'no_match' };
      }
      const badToken = isComunicaApiError(e) && e.reason === 'bad_app_token';
      if (badToken && attempt === 0) {
        const fresh = await currentAppIdToken(true);
        if (fresh) {
          idToken = fresh;
          continue;
        }
      }
      return { kind: 'failed', error: e };
    }
  }
}

/** ¿Es un fallo que se arregla solo con volver a probar (sin red, el servidor un momento)? */
export function isTransient(check: AppAccountCheck): boolean {
  if (check.kind !== 'failed') return false;
  const e = check.error;
  return !isComunicaApiError(e) || e.retryable;
}
