// Catálogo de canales de notificación de Android.
//
// En Android 8+ el "cómo suena" una notificación (heads-up, sonido, vibración,
// luz) NO lo decide el payload: lo decide el CANAL, y el usuario puede
// silenciar cada canal por separado desde los ajustes del sistema. Hasta ahora
// la app creaba un único canal `default` con importancia MAX, así que todo
// salía igual de agresivo y silenciar el cantoral significaba silenciarlo todo.
//
// Los ids de canal son EXACTAMENTE las categorías de negocio que ya manda el
// Panel en `data.category` (`types/notifications.ts → NotificationCategory`),
// con una única traducción: `general` → `default`, que es el canal que ya
// existe en las instalaciones actuales y no conviene renombrar (el id de un
// canal es inmutable: cambiarlo crea uno nuevo y resetea los ajustes del
// usuario). Así el Panel puede mandar `channelId` sin inventarse un vocabulario
// nuevo — le vale el mismo valor que ya pone en `category`.
//
// Este módulo es PURO a propósito (no importa `expo-notifications`): el alta de
// los canales en el sistema vive en `notifications/androidChannels.ts`.

import type { NotificationCategory } from '@/types/notifications';

/** Canal al que van las notificaciones sin `channelId` (o con uno desconocido). */
export const DEFAULT_CHANNEL_ID = 'default';

/**
 * Importancia del canal, en los mismos términos que
 * `Notifications.AndroidImportance`. Se guarda como string para que este
 * catálogo no dependa de `expo-notifications` y se pueda probar suelto.
 *
 * - `max`  → heads-up (se asoma sobre lo que estés haciendo) + sonido
 * - `high` → heads-up + sonido, un punto menos insistente
 * - `default` → sonido, sin heads-up
 * - `low`  → ni sonido ni heads-up; solo aparece en la bandeja
 */
export type ChannelImportance = 'max' | 'high' | 'default' | 'low';

export interface NotificationChannelSpec {
  /** Id del canal. Es lo que el Panel manda en `channelId`. INMUTABLE. */
  id: string;
  /** Categoría de negocio del Panel que se mapea a este canal. */
  category: NotificationCategory;
  /** Nombre visible en los ajustes de Android. */
  name: string;
  /** Explicación bajo el nombre, para que se entienda qué se silencia. */
  description: string;
  importance: ChannelImportance;
  /** Color del LED de notificación. Usa la paleta de la categoría. */
  lightColor: string;
}

/**
 * El orden importa: es el que Android usa para listar los canales en los
 * ajustes de la app. Primero lo que más interesa que el usuario no silencie.
 */
export const NOTIFICATION_CHANNELS: NotificationChannelSpec[] = [
  {
    id: DEFAULT_CHANNEL_ID,
    category: 'general',
    name: 'Avisos generales',
    description: 'Anuncios y avisos de MCM que no encajan en otra categoría.',
    importance: 'max',
    lightColor: '#253883',
  },
  {
    id: 'urgente',
    category: 'urgente',
    name: 'Urgente',
    description: 'Avisos importantes que no deberías perderte.',
    importance: 'max',
    lightColor: '#C62828',
  },
  {
    id: 'eventos',
    category: 'eventos',
    name: 'Eventos y calendario',
    description: 'Convocatorias, encuentros, retiros y cambios de horario.',
    importance: 'high',
    lightColor: '#31AADF',
  },
  {
    id: 'celebraciones',
    category: 'celebraciones',
    name: 'Celebraciones',
    description: 'Cumpleaños, aniversarios y fiestas de la familia MCM.',
    importance: 'high',
    lightColor: '#9D1E74',
  },
  {
    id: 'cancionero',
    category: 'cancionero',
    name: 'Cantoral',
    description: 'Canciones nuevas y cambios en el cantoral.',
    importance: 'default',
    lightColor: '#4E8A1F',
  },
  {
    id: 'fotos',
    category: 'fotos',
    name: 'Fotos',
    description: 'Álbumes de fotos nuevos.',
    importance: 'default',
    lightColor: '#0E7490',
  },
  {
    id: 'mantenimiento',
    category: 'mantenimiento',
    name: 'Mantenimiento de la app',
    description:
      'Avisos técnicos: mantenimiento, versiones mínimas, incidencias.',
    importance: 'low',
    lightColor: '#8A6D00',
  },
];

const BY_CATEGORY = new Map(
  NOTIFICATION_CHANNELS.map((channel) => [channel.category, channel.id]),
);

const KNOWN_IDS = new Set(NOTIFICATION_CHANNELS.map((channel) => channel.id));

/**
 * Canal que le corresponde a una categoría de negocio del Panel. Cualquier
 * categoría que la app no conozca cae en `default`, para que una categoría
 * nueva en el Panel nunca haga desaparecer una notificación.
 */
export function channelIdForCategory(
  category?: NotificationCategory | string | null,
): string {
  if (!category || typeof category !== 'string') return DEFAULT_CHANNEL_ID;
  return (
    BY_CATEGORY.get(category as NotificationCategory) ?? DEFAULT_CHANNEL_ID
  );
}

/** ¿Es `id` uno de los canales que declara la app? */
export function isKnownChannelId(id: string): boolean {
  return KNOWN_IDS.has(id);
}
