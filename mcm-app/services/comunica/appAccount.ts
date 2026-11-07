// Entrar en Comunica con la cuenta de la app (decisión `identidad-app`): quien
// ya ha entrado en la MCM App con Google o Apple manda su pase de Firebase y el
// servidor lo cambia por una sesión (`POST /v1/auth/app-account`), con la misma
// regla que el código: las fichas de ese correo, o «¿Quién eres?».
//
// Se intenta SOLO una vez, al abrir el acceso, mientras la persona no haya
// salido de Comunica a propósito: después de «Salir» se espera al botón, para
// que pueda entrar con otro correo, con el DNI o como otra ficha.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseAuth } from '@/utils/firebaseAuth';
import { APP_ACCOUNT_OPT_OUT_KEY as OPT_OUT_KEY } from './session';

/** El pase de Firebase de quien ha entrado en la app, o `null`. */
export async function currentAppIdToken(): Promise<string | null> {
  try {
    const u = getFirebaseAuth().currentUser;
    return u ? await u.getIdToken() : null;
  } catch {
    return null;
  }
}

/** ¿Ha salido de Comunica alguna vez? Entonces no se entra solo. */
export async function appAccountOptedOut(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(OPT_OUT_KEY)) === '1';
  } catch {
    return true;
  }
}
