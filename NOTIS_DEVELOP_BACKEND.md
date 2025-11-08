# Desarrollo Backend - Sistema de Notificaciones Push

## 📋 Índice

1. [Problema Crítico: Sincronización de IDs](#problema-crítico-sincronización-de-ids)
2. [Estructura de Datos en Firebase](#estructura-de-datos-en-firebase)
3. [Implementación del Backend](#implementación-del-backend)
4. [Configuración de Expo Push API](#configuración-de-expo-push-api)
5. [Credenciales y Certificados](#credenciales-y-certificados)
6. [Mejoras Necesarias en el Backend](#mejoras-necesarias-en-el-backend)
7. [Flujo Completo de Envío](#flujo-completo-de-envío)

---

## 🚨 Problema Crítico: Sincronización de IDs

### El Problema

Actualmente existe un **desajuste crítico** entre el ID de la notificación en Firebase y el ID que usa Expo cuando se recibe la notificación push:

- **Backend:** Crea un UUID v4 y lo guarda en Firebase como `notificationId`
- **Expo Push API:** Genera su propio `identifier` para la notificación
- **App Móvil:** Usa `notification.request.identifier` de Expo, que **NO coincide** con el `notificationId` de Firebase

### Solución Requerida

El backend **DEBE** enviar el `notificationId` de Firebase en el campo `data.id` del mensaje de Expo, y usar ese mismo ID como `identifier` en el mensaje. Esto permite que:

1. La app pueda identificar qué notificación de Firebase corresponde a cada notificación recibida
2. Las notificaciones se puedan marcar como leídas correctamente
3. Se pueda sincronizar el estado entre Firebase y el dispositivo

---

## 📊 Estructura de Datos en Firebase

### 1. Tokens de Dispositivos

**Ubicación:** `/pushTokens/{deviceId}`

```typescript
interface DeviceToken {
  token: string;               // "ExponentPushToken[xxxxxx]"
  platform: 'ios' | 'android' | 'web';
  registeredAt: string;        // ISO timestamp
  lastActive: string;          // ISO timestamp
  appVersion?: string;         // "1.0.1"
  deviceInfo?: {
    model?: string;
    osVersion?: string;
  };
}
```

**Ejemplo en Firebase:**
```json
{
  "pushTokens": {
    "device_1736950800000_abc123": {
      "token": "ExponentPushToken[xxxxxxxxxxxxxx]",
      "platform": "android",
      "registeredAt": "2025-01-15T10:30:00.000Z",
      "lastActive": "2025-01-15T15:45:00.000Z",
      "appVersion": "1.0.1",
      "deviceInfo": {
        "model": "Pixel 7",
        "osVersion": "14"
      }
    }
  }
}
```

### 2. Historial de Notificaciones

**Ubicación:** `/notifications/{notificationId}`

```typescript
interface NotificationData {
  id: string;                  // UUID v4 (DEBE coincidir con identifier de Expo)
  title: string;               // Título de la notificación
  body: string;                // Descripción/mensaje
  icon?: string;               // URL pública de imagen PNG/JPG
  imageUrl?: string;           // URL de imagen grande (opcional)

  actionButton?: {
    text: string;              // "Ver más", "Abrir", etc.
    url: string;               // URL de destino
    isInternal: boolean;       // true = navegación interna, false = abrir navegador
  };

  createdAt: string;           // ISO timestamp
  sentAt?: string;             // ISO timestamp (se actualiza después del envío)
  category?: NotificationCategory;
  priority?: 'high' | 'normal' | 'low';
  internalRoute?: string;      // "/(tabs)/calendario", "/notifications", etc.
  data?: Record<string, any>;  // Datos adicionales
}
```

**Ejemplo en Firebase:**
```json
{
  "notifications": {
    "550e8400-e29b-41d4-a716-446655440000": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Nueva actividad en el calendario",
      "body": "Se ha añadido el retiro de enero. ¡No te lo pierdas!",
      "icon": "https://firebasestorage.googleapis.com/.../calendar-icon.png",
      "imageUrl": "https://firebasestorage.googleapis.com/.../retiro-banner.jpg",
      "actionButton": {
        "text": "Ver calendario",
        "url": "/(tabs)/calendario",
        "isInternal": true
      },
      "createdAt": "2025-01-15T12:00:00.000Z",
      "sentAt": "2025-01-15T12:05:00.000Z",
      "category": "eventos",
      "priority": "high",
      "internalRoute": "/(tabs)/calendario"
    }
  }
}
```

---

## 🔧 Implementación del Backend

### Paso 1: Instalar Dependencias

```bash
npm install firebase-admin uuid
npm install --save-dev @types/uuid
```

### Paso 2: Configurar Variables de Entorno

Revisa si te faltarán varialbes de entorno para poder trabajar 
### Paso 3: Inicializar Firebase Admin
Revisa si tienes acceso completo a la base de datos de firebase sin problema

### Paso 4: Tipos TypeScript
Te dejo algunas sugerencias sobre como sería esta parte. Decide tu mismo si esto es importante o no.
Crear `types/notifications.ts`:

```typescript
// types/notifications.ts
export interface NotificationData {
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
  createdAt: string;
  sentAt?: string;
  category?: 'general' | 'eventos' | 'cancionero' | 'fotos' | 'urgente' | 'mantenimiento' | 'celebraciones';
  priority?: 'high' | 'normal' | 'low';
  internalRoute?: string;
  data?: Record<string, any>;
}

export interface DeviceToken {
  token: string;
  platform: 'ios' | 'android' | 'web';
  registeredAt: string;
  lastActive: string;
  appVersion?: string;
  deviceInfo?: {
    model?: string;
    osVersion?: string;
  };
}

// Mensaje para Expo Push API
export interface ExpoMessage {
  to: string;
  sound: 'default' | null;
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
  categoryId?: string;
  identifier?: string;  // ⚠️ CRÍTICO: Usar el notificationId de Firebase
}
```

### Paso 5: API Route para Enviar Notificaciones

Ejemplo de como podría ser el archivo de enviar notificaciones, pero decide tu mismo si es el más adecuado en tu caso.

```typescript
// app/api/notifications/send/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { NotificationData, DeviceToken, ExpoMessage } from '@/types/notifications';

export async function POST(request: Request) {
  try {
    const notificationInput = await request.json();

    // Validación básica
    if (!notificationInput.title || !notificationInput.body) {
      return NextResponse.json(
        { error: 'Title and body are required' },
        { status: 400 }
      );
    }

    // 1. Crear objeto de notificación completo con UUID
    const notificationId = uuidv4(); // ⚠️ Este ID se usará como identifier en Expo
    const notification: NotificationData = {
      id: notificationId, // ⚠️ CRÍTICO: Este ID debe coincidir con identifier
      title: notificationInput.title,
      body: notificationInput.body,
      icon: notificationInput.icon,
      imageUrl: notificationInput.imageUrl,
      actionButton: notificationInput.actionButton,
      createdAt: new Date().toISOString(),
      category: notificationInput.category || 'general',
      priority: notificationInput.priority || 'normal',
      internalRoute: notificationInput.internalRoute,
      data: notificationInput.data,
    };

    // 2. Guardar notificación en Firebase (historial)
    await db.ref(`notifications/${notificationId}`).set(notification);

    // 3. Obtener todos los tokens de dispositivos
    const tokensSnapshot = await db.ref('pushTokens').once('value');
    const tokensData = tokensSnapshot.val();

    if (!tokensData) {
      return NextResponse.json(
        { error: 'No hay dispositivos registrados' },
        { status: 404 }
      );
    }

    // 4. Preparar tokens para envío
    const tokens: string[] = Object.values(tokensData).map(
      (device: any) => device.token
    );

    console.log(`📤 Enviando a ${tokens.length} dispositivos`);

    // 5. Preparar mensajes para Expo Push API
    // ⚠️ CRÍTICO: Usar notificationId como identifier y en data.id
    const messages: ExpoMessage[] = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title: notification.title,
      body: notification.body,
      identifier: notificationId, // ⚠️ CRÍTICO: Usar el ID de Firebase
      data: {
        id: notificationId, // ⚠️ CRÍTICO: También en data para compatibilidad
        icon: notification.icon,
        imageUrl: notification.imageUrl,
        actionButton: notification.actionButton,
        category: notification.category,
        priority: notification.priority,
        internalRoute: notification.internalRoute,
        ...notification.data,
      },
      badge: 1,
      priority: notification.priority === 'high' ? 'high' : 'default',
      categoryId: notification.category,
    }));

    // 6. Enviar en chunks de 100 (límite de Expo)
    const chunks = chunkArray(messages, 100);
    const results = [];
    let successfulCount = 0;
    let failedCount = 0;

    for (const chunk of chunks) {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error de Expo Push API:', errorText);
        throw new Error(`Error enviando a Expo Push Service: ${errorText}`);
      }

      const result = await response.json();
      results.push(...result.data);

      // Contar éxitos y fallos
      result.data.forEach((r: any) => {
        if (r.status === 'ok') {
          successfulCount++;
        } else {
          failedCount++;
          console.error('Error en token:', r.message);
        }
      });
    }

    // 7. Limpiar tokens inválidos de Firebase
    // Si Expo devuelve un error de token inválido, eliminarlo de Firebase
    const invalidTokens: string[] = [];
    results.forEach((result: any, index: number) => {
      if (result.status === 'error') {
        const errorMessage = result.message || '';
        // Tokens inválidos comunes: DeviceNotRegistered, InvalidCredentials
        if (errorMessage.includes('DeviceNotRegistered') || 
            errorMessage.includes('InvalidCredentials') ||
            errorMessage.includes('InvalidToken')) {
          invalidTokens.push(tokens[index]);
        }
      }
    });

    // Eliminar tokens inválidos de Firebase
    if (invalidTokens.length > 0) {
      console.log(`🗑️ Eliminando ${invalidTokens.length} tokens inválidos`);
      const tokensSnapshot = await db.ref('pushTokens').once('value');
      const tokensData = tokensSnapshot.val();
      
      for (const [deviceId, deviceData] of Object.entries(tokensData as Record<string, DeviceToken>)) {
        if (invalidTokens.includes(deviceData.token)) {
          await db.ref(`pushTokens/${deviceId}`).remove();
          console.log(`🗑️ Token eliminado: ${deviceId}`);
        }
      }
    }

    // 8. Actualizar timestamp de envío
    await db.ref(`notifications/${notificationId}/sentAt`).set(
      new Date().toISOString()
    );

    console.log(`✅ Enviadas: ${successfulCount}, ❌ Fallidas: ${failedCount}`);

    return NextResponse.json({
      success: true,
      notificationId,
      sent: tokens.length,
      successful: successfulCount,
      failed: failedCount,
      invalidTokensRemoved: invalidTokens.length,
      results: results,
    });

  } catch (error: any) {
    console.error('Error enviando notificaciones:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Función auxiliar para dividir arrays
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
```

### Paso 6: API Route para Obtener Estadísticas
Un ejemplo de como podría ser, pero decide tu mism ocual es la mejor forma.

Crear `app/api/notifications/stats/route.ts`:

```typescript
// app/api/notifications/stats/route.ts
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';

export async function GET() {
  try {
    // Obtener tokens
    const tokensSnapshot = await db.ref('pushTokens').once('value');
    const tokensData = tokensSnapshot.val() || {};
    const tokens = Object.values(tokensData);

    // Obtener notificaciones
    const notificationsSnapshot = await db.ref('notifications').once('value');
    const notificationsData = notificationsSnapshot.val() || {};
    const notifications = Object.values(notificationsData);

    // Estadísticas de dispositivos
    const deviceStats = {
      total: tokens.length,
      ios: tokens.filter((t: any) => t.platform === 'ios').length,
      android: tokens.filter((t: any) => t.platform === 'android').length,
      web: tokens.filter((t: any) => t.platform === 'web').length,
    };

    // Última actividad
    const activeLastDay = tokens.filter((t: any) => {
      const lastActive = new Date(t.lastActive);
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return lastActive > dayAgo;
    }).length;

    const activeLastWeek = tokens.filter((t: any) => {
      const lastActive = new Date(t.lastActive);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return lastActive > weekAgo;
    }).length;

    return NextResponse.json({
      devices: deviceStats,
      activeLastDay,
      activeLastWeek,
      totalNotificationsSent: notifications.length,
    });

  } catch (error: any) {
    console.error('Error obteniendo estadísticas:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

---

## 🎯 Configuración de Expo Push API

### Requisitos

1. **Project ID de EAS:** Ya está configurado en `app.json`:
   ```json
   {
     "extra": {
       "eas": {
         "projectId": "aa9f2d3a-b74a-4169-bad4-e851015e30c6"
       }
     }
   }
   ```

2. **Credenciales iOS (APNs):** Ver sección [Credenciales y Certificados](#credenciales-y-certificados)

3. **Credenciales Android (FCM):** Ver sección [Credenciales y Certificados](#credenciales-y-certificados)

### Límites de Expo Push API

- **Rate Limit:** 3500 requests/minuto por proyecto
- **Chunk Size:** Máximo 100 mensajes por request
- **Tamaño del mensaje:** Máximo 4KB por notificación

---

## 🔐 Credenciales y Certificados

### iOS (APNs - Apple Push Notification Service)

#### Opción 1: Usar EAS Build (Recomendado) - ES LA QUE USAMOS

1. **Configurar credenciales en EAS:**
   ```bash
   eas credentials
   ```
   - Selecciona tu proyecto
   - Selecciona iOS
   - Sigue las instrucciones para subir tu certificado APNs

2. **EAS manejará automáticamente:**
   - Certificado de desarrollo
   - Certificado de producción
   - Actualización automática cuando expire


### Android (FCM - Firebase Cloud Messaging)

#### Configuración Automática con EAS

1. **EAS Build maneja automáticamente:**
   - Google Services JSON
   - FCM Server Key
   - No requiere configuración manual

2. **Verificar en Firebase Console:**
   - Ve a [Firebase Console](https://console.firebase.google.com/)
   - Selecciona tu proyecto
   - Project Settings > Cloud Messaging
   - Verifica que esté configurado el servidor FCM

### Web (Service Workers)

Las notificaciones web funcionan automáticamente con Expo sin configuración adicional, pero requieren:
- HTTPS (obligatorio para service workers)
- Permisos del usuario
- Navegador compatible (Chrome, Firefox, Safari, Edge)

---

## 🚀 Mejoras Necesarias en el Backend

### 1. **Limpieza Automática de Tokens Inválidos**

Ya implementado en el código de ejemplo, pero asegúrate de que:
- Los tokens inválidos se eliminen automáticamente
- Se registren en logs para debugging
- Se notifique al administrador si hay muchos tokens inválidos

### 2. **Programación de Notificaciones**

Permitir programar notificaciones para enviarse en el futuro:

```typescript
interface ScheduledNotification extends NotificationData {
  scheduledFor: string; // ISO timestamp
  timezone?: string;
}

// Usar un cron job o servicio de cola (Bull, RabbitMQ, etc.)
// para enviar notificaciones programadas
```

### 3. **Notificaciones Segmentadas**

Permitir enviar notificaciones a grupos específicos:

```typescript
interface NotificationSegment {
  platform?: 'ios' | 'android' | 'web';
  appVersion?: string;
  lastActive?: 'day' | 'week' | 'month' | 'all';
}
```


### 6. **Validación de URLs de Imágenes**

Validar que las URLs de iconos e imágenes sean accesibles antes de enviar:

```typescript
async function validateImageUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok && response.headers.get('content-type')?.startsWith('image/');
  } catch {
    return false;
  }
}
```

---

## 📱 Flujo Completo de Envío

### 1. Usuario Abre la App Móvil

```
App Móvil:
  ├─ Solicita permisos de notificaciones
  ├─ Obtiene Expo Push Token
  └─ Guarda token en Firebase /pushTokens/{deviceId}
```

### 2. Admin Crea Notificación en el Panel

```
Panel de control del administrador
  ├─ Llena formulario con título, mensaje, etc.
  └─ Click en "Enviar"
```

### 3. Backend Procesa el Envío

```
Backend:
  ├─ Genera UUID v4 (notificationId)
  ├─ Crea objeto NotificationData
  ├─ Guarda en Firebase /notifications/{notificationId}
  ├─ Lee todos los tokens de /pushTokens
  ├─ Prepara mensajes para Expo Push API
  │  └─ ⚠️ Usa notificationId como identifier y en data.id
  ├─ Envía a Expo Push API en chunks de 100
  ├─ Procesa resultados
  ├─ Elimina tokens inválidos
  └─ Actualiza sentAt en Firebase
```

### 4. Expo Distribuye

```
Expo Push Service:
  ├─ Recibe mensajes
  ├─ Envía a APNs (iOS)
  ├─ Envía a FCM (Android)
  └─ Envía a Service Workers (Web)
```

### 5. Dispositivos Reciben

```
App Móvil:
  ├─ Recibe notificación push
  ├─ Extrae identifier (que es el notificationId de Firebase)
  ├─ Extrae data.id (también el notificationId)
  ├─ Guarda en AsyncStorage con ese ID
  ├─ Si tiene internalRoute, navega al tocar
  └─ Si tiene actionButton, muestra el botón
```

### 6. Usuario Ve Historial

```
Pantalla de Notificaciones:
  ├─ Carga notificaciones de Firebase
  ├─ Carga notificaciones locales
  ├─ Combina y elimina duplicados por ID
  ├─ Muestra notificaciones sin leer
  └─ Permite marcar como leída
```

---

## ✅ Checklist de Implementación

### Backend MCM Panel - NO TOMES LOS  NOMBRES ARCHIVOS COMO ALGO DEFINITIVO, SOLO COMO UNA REFERENCIA

- [ ] Instalar dependencias (`firebase-admin`, `uuid`)
- [ ] Configurar variables de entorno (`.env.local`)
- [ ] Crear `lib/firebase-admin.ts`
- [ ] Crear `types/notifications.ts`
- [ ] Crear API route `/api/notifications/send`
  - [ ] Usar `notificationId` como `identifier` en Expo
  - [ ] Incluir `notificationId` en `data.id`
  - [ ] Limpiar tokens inválidos automáticamente
  - [ ] Manejar errores correctamente
- [ ] Crear API route
- [ ] Crear página del panel 
- [ ] Configurar reglas de seguridad en Firebase
- [ ] (Opcional) Implementar programación de notificaciones
- [ ] (Opcional) Implementar segmentación
- [ ] (Opcional) Implementar analytics

### Firebase

- [ ] Verificar estructura de datos en Realtime Database
- [ ] Configurar reglas de seguridad
- [ ] Verificar que los tokens se guarden correctamente
- [ ] Verificar que las notificaciones se guarden correctamente

### Credenciales

- [ ] Configurar credenciales iOS (APNs) en EAS
- [ ] Verificar credenciales Android (FCM) en EAS
- [ ] Verificar que las credenciales no expiren pronto

### Testing

- [ ] Probar envío de notificación desde el panel
- [ ] Verificar que los IDs coincidan
- [ ] Verificar que las notificaciones lleguen a los dispositivos
- [ ] Verificar que se guarden en Firebase
- [ ] Verificar que aparezcan en la pantalla de notificaciones
- [ ] Verificar que se puedan marcar como leídas

---

## 🔍 Debugging

### Problemas Comunes

1. **Las notificaciones no llegan:**
   - Verificar que los tokens estén en Firebase
   - Verificar que las credenciales estén configuradas
   - Verificar logs de Expo Push API
   - Verificar que la app tenga permisos

2. **Los IDs no coinciden:**
   - Verificar que el backend use `notificationId` como `identifier`
   - Verificar que el backend incluya `notificationId` en `data.id`
   - Verificar logs de la app móvil

3. **Tokens inválidos:**
   - Los tokens se eliminan automáticamente
   - Verificar logs del backend
   - Verificar que los dispositivos estén registrados

4. **Notificaciones no aparecen en el historial:**
   - Verificar que se guarden en Firebase
   - Verificar que la app cargue desde Firebase
   - Verificar que los IDs coincidan

---

## 📚 Referencias

- [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/)
- [Expo Push API](https://docs.expo.dev/push-notifications/sending-notifications/)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Firebase Realtime Database](https://firebase.google.com/docs/database)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [EAS Credentials](https://docs.expo.dev/app-signing/managed-credentials/)

---

## 🎯 Puntos Críticos a Recordar

1. **⚠️ SIEMPRE usar `notificationId` como `identifier` en Expo**
2. **⚠️ SIEMPRE incluir `notificationId` en `data.id`**
3. **⚠️ Limpiar tokens inválidos automáticamente**
4. **⚠️ Validar URLs de imágenes antes de enviar**
5. **⚠️ Manejar errores correctamente**
6. **⚠️ Registrar todo en logs para debugging**

---

## 📝 Notas Finales

- El sistema está diseñado para ser escalable y manejar miles de dispositivos
- Los tokens se limpian automáticamente cuando son inválidos
- Las notificaciones se guardan en Firebase para historial
- Los IDs deben coincidir entre Firebase y Expo para que funcione correctamente
- El panel debe tener autenticación en producción
- Considerar implementar rate limiting para prevenir abuso

