// services/comunica/bridge.ts
//
// El puente entre el motor del área (que vive en el `_layout` de la pestaña
// Comunica, `ComunicaAreaProvider`) y lo que corre en la raíz de la app
// (plan 08): las notificaciones (`usePushNotifications`) y el registro del
// móvil y el aviso local (`ComunicaBackground`).
//
//   · La cola ACTIVA: la de la persona que ha entrado, mientras el proveedor
//     está montado. Fuera de él no se crea otra (dos colas de la misma persona
//     se pisarían el cajón).
//   · Los avisos del área que llegan con la app abierta: la raíz los anuncia y
//     el proveedor refresca sus consultas (las tiene su `QueryClient`).
//
// Sin React ni nada nativo.

import type { ComunicaPushData } from './contract';
import type { Outbox } from './outbox';

let active: Outbox | null = null;
const outboxListeners = new Set<() => void>();
const noticeListeners = new Set<(n: ComunicaPushData) => void>();

export function setActiveOutbox(next: Outbox | null): void {
  if (active === next) return;
  active = next;
  outboxListeners.forEach((l) => l());
}

/** La cola de quien ha entrado, si el área está montada (y sin apagar). */
export function getActiveOutbox(): Outbox | null {
  return active && !active.disposed ? active : null;
}

export function subscribeActiveOutbox(listener: () => void): () => void {
  outboxListeners.add(listener);
  return () => {
    outboxListeners.delete(listener);
  };
}

/** Ha llegado un aviso del área con la app abierta. */
export function emitComunicaNotice(n: ComunicaPushData): void {
  noticeListeners.forEach((l) => l(n));
}

export function onComunicaNotice(
  listener: (n: ComunicaPushData) => void,
): () => void {
  noticeListeners.add(listener);
  return () => {
    noticeListeners.delete(listener);
  };
}

const syncNudges = new Set<() => void>();

/** Volver a mirar el alta del móvil ya (acaban de conceder el permiso). */
export function nudgeDeviceSync(): void {
  syncNudges.forEach((l) => l());
}

export function onDeviceSyncNudge(listener: () => void): () => void {
  syncNudges.add(listener);
  return () => {
    syncNudges.delete(listener);
  };
}

/** Solo tests. */
export function __resetBridgeForTests(): void {
  active = null;
  outboxListeners.clear();
  noticeListeners.clear();
  syncNudges.clear();
}
