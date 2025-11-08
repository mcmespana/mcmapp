// types/notifications.ts

/**
 * Estructura de una notificación completa en Firebase
 * Esta es la estructura que el panel de administración creará
 */
export interface NotificationData {
  id: string; // UUID generado por el panel
  title: string; // Título de la notificación
  body: string; // Descripción/mensaje de la notificación
  icon?: string; // URL de la imagen del icono (PNG/JPG, debe ser accesible públicamente)
  imageUrl?: string; // URL de imagen grande opcional (para notificaciones ricas)

  // Configuración del botón de acción (opcional)
  actionButton?: {
    text: string; // Texto del botón, ej: "Ver más", "Abrir", "Ir a calendario"
    url: string; // URL de destino
    isInternal: boolean; // true = navegación interna, false = abrir navegador
  };

  // Metadata
  createdAt: string; // ISO timestamp de cuándo se creó
  sentAt?: string; // ISO timestamp de cuándo se envió (puede ser programada)
  category?: NotificationCategory; // Categoría para organización
  priority?: 'high' | 'normal' | 'low'; // Prioridad de entrega

  // Para notificaciones internas (deep linking)
  internalRoute?: string; // Ruta dentro de la app, ej: "/calendario", "/(tabs)/fotos"

  // Data adicional que puede usar la app
  data?: Record<string, any>;
}

/**
 * Categorías de notificaciones para organización
 */
export type NotificationCategory =
  | 'general'      // Anuncios generales
  | 'eventos'      // Eventos y calendario
  | 'cancionero'   // Nuevas canciones o actualizaciones
  | 'fotos'        // Nuevos álbumes de fotos
  | 'urgente'      // Notificaciones urgentes/importantes
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
}

/**
 * Estructura para el historial de notificaciones recibidas (local en el dispositivo)
 */
export interface ReceivedNotification {
  id: string;
  title: string;
  body: string;
  icon?: string;
  imageUrl?: string;
  actionButton?: {
    text: string;
    url: string;
    isInternal: boolean;
  };
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
