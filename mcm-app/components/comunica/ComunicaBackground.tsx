// components/comunica/ComunicaBackground.tsx
//
// Lo que el área de Comunica hace en segundo plano (plan 08). No pinta nada.
// Se monta una vez en la raíz (`app/_layout.tsx`), dentro de los providers:
//
//   · Registra el móvil en NUESTRO servidor cuando hay sesión del área,
//     permiso y token, y solo si algo cambió (`syncDeviceRegistration`). El
//     alta va por la cola de la persona, que vive en el proveedor del área: si
//     la pestaña aún no se ha abierto en este arranque, espera a que se abra.
//   · El aviso local «Tienes N listas sin subir»: se programa al irse la app a
//     segundo plano y se cancela al volver, al vaciarse la cola y al salir.
//   · Al salir del área: baja del móvil (antes del `logout`, 3 s de tope),
//     olvidar el `deviceId` y cancelar los avisos locales.
//
// Solo con el área nativa encendida (plan 01) y en iOS o Android: en web no
// hay avisos.

import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import { tryRegisterPushToken } from '@/notifications/usePushNotifications';
import { getCachedPushToken } from '@/services/pushNotificationService';
import { getComunicaApi, isComunicaApiAvailable } from '@/services/comunica';
import {
  getActiveOutbox,
  onDeviceSyncNudge,
  subscribeActiveOutbox,
} from '@/services/comunica/bridge';
import {
  installDeviceSignOut,
  syncDeviceRegistration,
} from '@/services/comunica/devices';
import {
  applyOutboxReminder,
  cancelAreaNotices,
  cancelOutboxReminder,
  readNoticePermission,
} from '@/services/comunica/localNotices';
import type { OutboxEntry } from '@/services/comunica/outbox';
import { getSessionState, subscribeSession } from '@/services/comunica/session';
import { readDrawer } from '@/services/comunica/storage';
import { useComunicaMode } from '@/hooks/comunica/useComunicaMode';
import { useNoticePrefs } from '@/hooks/comunica/useNoticePrefs';
import { unsentLists } from '@/utils/comunica/outboxReminder';
import { logger } from '@/utils/logger';

export default function ComunicaBackground() {
  const mode = useComunicaMode();
  if (Platform.OS === 'web' || !isComunicaApiAvailable()) return null;
  return mode === 'native' ? <Engine /> : null;
}

/** El token de Expo: el guardado o, si no lo hay, se pide ahora. */
async function pushToken(): Promise<string | null> {
  const cached = await getCachedPushToken();
  if (cached) return cached;
  await tryRegisterPushToken().catch(() => {});
  return getCachedPushToken();
}

function Engine() {
  const session = useSyncExternalStore(subscribeSession, getSessionState);
  const outbox = useSyncExternalStore(subscribeActiveOutbox, getActiveOutbox);
  const { prefs, loaded } = useNoticePrefs();
  // Al volver a la app se mira otra vez (permiso o token nuevos).
  const [wakes, setWakes] = useState(0);
  const personId =
    session.status === 'signedIn' ? (session.me?.personId ?? null) : null;

  // Salir: baja del móvil, olvidarlo y cancelar lo programado.
  useEffect(
    () => installDeviceSignOut(() => getComunicaApi(), cancelAreaNotices),
    [],
  );

  // «Avisos en este móvil» acaba de conseguir el permiso: se mira ya.
  useEffect(() => onDeviceSyncNudge(() => setWakes((n) => n + 1)), []);

  // El alta, por la cola de esta persona.
  useEffect(() => {
    if (!personId || !outbox || !loaded) return;
    syncDeviceRegistration({
      personId,
      platform: Platform.OS,
      appVersion: String(Constants.expoConfig?.version ?? ''),
      permitted: async () => (await readNoticePermission()) === 'granted',
      pushToken,
      prefs,
      enqueue: (input) => outbox.enqueue(input),
    }).catch((e) => logger.warn('[comunica] alta del móvil', e));
  }, [personId, outbox, loaded, prefs, wakes]);

  // El recordatorio de listas sin subir.
  useEffect(() => {
    if (!personId) return;
    const entries = async (): Promise<readonly OutboxEntry[]> =>
      getActiveOutbox()?.entries() ??
      (await readDrawer<OutboxEntry[]>(personId, 'outbox')) ??
      [];
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setWakes((n) => n + 1);
        void applyOutboxReminder('foreground', [], prefs.outboxReminder);
      } else if (state === 'background') {
        void entries().then((list) =>
          applyOutboxReminder('background', list, prefs.outboxReminder),
        );
      }
    });
    return () => sub.remove();
  }, [personId, prefs.outboxReminder]);

  // Si la cola se vacía con la app en segundo plano, fuera el recordatorio.
  useEffect(() => {
    if (!outbox) return;
    return outbox.subscribe(() => {
      if (unsentLists(outbox.entries()).count === 0) {
        void cancelOutboxReminder();
      }
    });
  }, [outbox]);

  return null;
}
