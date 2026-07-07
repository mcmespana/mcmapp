// types/notifications.ts

import type { NotificationAudience } from '@/utils/notificationAudience';

/**
 * Botón de acción de una notificación: un call-to-action con texto propio que
 * abre una URL externa o navega a una ruta interna de la app.
 */
export interface NotificationActionButtonData {
  text: string; // Texto del botón, ej: "Ver más", "Abrir", "Ir a calendario"
  url: string; // URL de destino (externa) o ruta interna
  isInternal: boolean; // true = navegación interna, false = abrir navegador
}

/**
 * Estructura de una notificación completa en Firebase
 * Esta es la estructura que el panel de administración creará
 */
export interface NotificationData {
  id: string; // UUID generado por el panel
  title: string; // Título de la notificación
  body: string; // Descripción/mensaje corto (≤200 chars). Se ve en la tarjeta + push
  bodyLong?: string; // Descripción extendida opcional (scrollable en el modal de
  // detalle). Si no viene, el detalle usa `body` como fallback.
  icon?: string; // URL de la imagen del icono (PNG/JPG, debe ser accesible públicamente)
  imageUrl?: string; // URL de imagen grande opcional (para notificaciones ricas)

  // Configuración del botón de acción único (legacy — usar actionButtons)
  actionButton?: NotificationActionButtonData;

  // Botones de acción (hasta 3). Es el formato recomendado; `actionButton`
  // (singular) se mantiene por compatibilidad y equivale a un array de uno.
  actionButtons?: NotificationActionButtonData[];

  // Metadata
  createdAt: string; // ISO timestamp de cuándo se creó
  sentAt?: string; // ISO timestamp de cuándo se envió (puede ser programada)
  category?: NotificationCategory; // Categoría para organización
  priority?: 'high' | 'normal' | 'low'; // Prioridad de entrega

  // Para notificaciones internas (deep linking)
  internalRoute?: string; // Ruta dentro de la app, ej: "/calendario", "/(tabs)/fotos"

  // Segmentación de audiencia con la que el panel envió esta notificación (4
  // ejes + AND/OR). La app la usa para filtrar el historial in-app y no mostrar
  // avisos dirigidos a otros perfiles/delegaciones/eventos. Ausente o null =
  // enviada a todos (retrocompatible con el histórico).
  audience?: NotificationAudience | null;

  // Data adicional que puede usar la app
  data?: Record<string, any>;
}

/**
 * Categorías de notificaciones para organización
 */
export type NotificationCategory =
  | 'general' // Anuncios generales
  | 'eventos' // Eventos y calendario
  | 'cancionero' // Nuevas canciones o actualizaciones
  | 'fotos' // Nuevos álbumes de fotos
  | 'urgente' // Notificaciones urgentes/importantes
  | 'mantenimiento' // Avisos de mantenimiento de la app
  | 'celebraciones'; // Celebraciones, cumpleaños, etc.

/**
 * Token de dispositivo registrado en Firebase
 */
export interface DeviceToken {
  token: string; // Expo Push Token
  platform: 'ios' | 'android' | 'web';
  registeredAt: string; // ISO timestamp
  lastActive: string; // ISO timestamp de última actividad
  appVersion?: string; // Versión de la app
  deviceInfo?: {
    model?: string;
    osVersion?: string;
  };
  // Segmentación para envío de notificaciones desde mcmpanel
  profileType?: 'familia' | 'monitor' | 'miembro' | null;
  delegationId?: string | null;
  /** Unión de notificationTopics del perfil + notificationTopic de la delegación. Pre-computado para queries fáciles. */
  topics?: string[];
}

/**
 * Estructura para el historial de notificaciones recibidas (local en el dispositivo)
 */
export interface ReceivedNotification {
  id: string;
  title: string;
  body: string;
  bodyLong?: string; // Descripción extendida opcional (ver NotificationData)
  icon?: string;
  imageUrl?: string;
  actionButton?: NotificationActionButtonData; // legacy (un botón)
  actionButtons?: NotificationActionButtonData[]; // hasta 3 botones
  receivedAt: string; // ISO timestamp
  isRead: boolean;
  category?: NotificationCategory;
  internalRoute?: string;
  data?: Record<string, any>;
}

/**
 * Respuesta de la API de Expo al enviar notificaciones
 */
export interface ExpoNotificationResponse {
  data: {
    id: string;
    status: 'ok' | 'error';
    message?: string;
    details?: any;
  }[];
}
