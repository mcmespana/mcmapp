// utils/splashGate.ts
//
// Quién y cuándo quita el splash nativo.
//
// Sin esto, expo-router lo quita solo en cuanto la navegación está lista, que
// es el PRIMER render de `app/_layout.tsx`. Y ese render todavía no sabe si
// toca la bienvenida (HelloWave) — lo dice AsyncStorage un instante después —,
// así que en cada arranque se veía splash → destello del 🌐 sobre un fondo de
// otro color → app.
//
// Ahora el layout retiene el splash (`holdSplash`, a nivel de módulo, antes
// del primer render) y lo suelta él (`releaseSplash`) cuando ya tiene algo que
// pintar. Como retener el splash y que algo falle por el camino dejaría la app
// COLGADA en él, `holdSplash` arma además un temporizador de seguridad que lo
// suelta pase lo que pase.

import * as SplashScreen from 'expo-splash-screen';
import { logger } from '@/utils/logger';

/**
 * Tope de seguridad. AsyncStorage responde en decenas de milisegundos; si en
 * este tiempo nadie ha soltado el splash es que algo se ha roto (un provider
 * que revienta, una promesa que no vuelve), y es mejor enseñar lo que haya
 * —incluida la pantalla de error— que dejar al usuario mirando el logo.
 */
export const SPLASH_SAFETY_MS = 3000;

let released = false;
let safetyTimer: ReturnType<typeof setTimeout> | null = null;

/** Suelta el splash nativo. Idempotente: solo actúa la primera vez. */
export function releaseSplash(): void {
  if (released) return;
  released = true;
  if (safetyTimer) {
    clearTimeout(safetyTimer);
    safetyTimer = null;
  }
  SplashScreen.hideAsync().catch((e) => {
    logger.warn('[splash] hideAsync falló', e);
  });
}

/**
 * Retiene el splash hasta que se llame a `releaseSplash` o venza
 * `SPLASH_SAFETY_MS`. Llamar a nivel de módulo, sin `await`: dentro de un
 * componente llegaría tarde.
 */
export function holdSplash(safetyMs: number = SPLASH_SAFETY_MS): void {
  if (released || safetyTimer) return;
  SplashScreen.preventAutoHideAsync().catch(() => {
    // Ya oculto o sin módulo nativo (web, tests): no hay nada que retener.
  });
  safetyTimer = setTimeout(() => {
    safetyTimer = null;
    if (!released) logger.warn('[splash] soltado por el tope de seguridad');
    releaseSplash();
  }, safetyMs);
}

/** Solo para tests: vuelve al estado inicial del módulo. */
export function __resetSplashGateForTests(): void {
  released = false;
  if (safetyTimer) clearTimeout(safetyTimer);
  safetyTimer = null;
}
