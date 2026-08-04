// Alta de los canales de notificación en Android.
//
// El catálogo (qué canales hay y cómo suena cada uno) está en
// `constants/notificationChannels.ts`; aquí solo se registra en el sistema.
//
// Dos cosas que conviene tener claras de la API de Android:
//
//   - **El id de un canal es para siempre.** Una vez creado, el usuario manda:
//     el sistema IGNORA cambios posteriores de importancia, sonido o vibración.
//     Nombre y descripción sí se pueden actualizar. Borrar y recrear un canal
//     con el mismo id NO resetea nada (Android recuerda los ajustes del usuario
//     de los canales borrados), así que tampoco es una vía para "arreglarlo".
//     Conclusión: la importancia de cada canal hay que acertarla a la primera.
//   - **Crear canales no necesita permiso de notificaciones.** Se hace antes de
//     pedirlo, así los ajustes del sistema ya salen bien poblados.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  NOTIFICATION_CHANNELS,
  isKnownChannelId,
  type ChannelImportance,
} from '@/constants/notificationChannels';
import { logger } from '@/utils/logger';

const IMPORTANCE: Record<ChannelImportance, Notifications.AndroidImportance> = {
  max: Notifications.AndroidImportance.MAX,
  high: Notifications.AndroidImportance.HIGH,
  default: Notifications.AndroidImportance.DEFAULT,
  low: Notifications.AndroidImportance.LOW,
};

const VIBRATION_PATTERN = [0, 250, 250, 250];

/**
 * Crea (o actualiza el nombre/descripción de) todos los canales del catálogo, y
 * borra los que la app ya no declara. No hace nada fuera de Android.
 */
export async function syncAndroidNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    for (const channel of NOTIFICATION_CHANNELS) {
      await Notifications.setNotificationChannelAsync(channel.id, {
        name: channel.name,
        description: channel.description,
        importance: IMPORTANCE[channel.importance],
        // Los canales silenciosos no vibran: si no, "silencioso" no lo es.
        vibrationPattern:
          channel.importance === 'low' ? undefined : VIBRATION_PATTERN,
        lightColor: channel.lightColor,
      });
    }

    // Limpieza de canales de versiones anteriores: si se dejan, siguen saliendo
    // en los ajustes del sistema aunque ya no reciban nada.
    const existing = await Notifications.getNotificationChannelsAsync();
    for (const channel of existing) {
      if (!isKnownChannelId(channel.id)) {
        await Notifications.deleteNotificationChannelAsync(channel.id);
      }
    }
  } catch (e) {
    // Que falle el alta de canales no puede tumbar el registro del token: sin
    // canales las notificaciones siguen llegando (al canal por defecto que
    // crea Expo), solo que sin la separación por categoría.
    logger.error('[push] syncAndroidNotificationChannels:', e);
  }
}
