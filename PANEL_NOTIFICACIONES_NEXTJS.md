# Documentación del Panel de Notificaciones Push - Next.js

## Contexto

Este documento describe la implementación del panel de administración de notificaciones push para la aplicación MCM. El panel está construido en Next.js y permite enviar notificaciones push a todos los dispositivos registrados, con soporte para notificaciones enriquecidas, navegación interna, y botones de acción.

---

## Estructura de datos en Firebase

### 1. Tokens de dispositivos

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

**Ejemplo:**
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
    },
    "device_1736951234567_def456": {
      "token": "ExponentPushToken[yyyyyyyyyyyyyy]",
      "platform": "ios",
      "registeredAt": "2025-01-15T11:00:00.000Z",
      "lastActive": "2025-01-15T15:50:00.000Z",
      "appVersion": "1.0.1"
    }
  }
}
```

---

### 2. Historial de notificaciones

**Ubicación:** `/notifications/{notificationId}`

```typescript
interface NotificationData {
  id: string;                  // UUID v4
  title: string;               // Título de la notificación
  body: string;                // Descripción/mensaje
  icon?: string;               // URL pública de imagen PNG/JPG
  imageUrl?: string;           // URL de imagen grande (opcional)

  actionButton?: {
    text: string;              // "Ver más", "Abrir", etc.
    url: string;               // URL de destino
    isInternal: boolean;       // true = navegación interna, false = navegador
  };

  createdAt: string;           // ISO timestamp
  sentAt?: string;             // ISO timestamp
  category?: 'general' | 'eventos' | 'cancionero' | 'fotos' | 'urgente' | 'mantenimiento' | 'celebraciones';
  priority?: 'high' | 'normal' | 'low';
  internalRoute?: string;      // "/(tabs)/calendario", "/notifications", etc.
  data?: Record<string, any>;  // Datos adicionales
}
```

**Ejemplo:**
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
    },
    "660e8400-e29b-41d4-a716-446655440001": {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "title": "Nuevas fotos disponibles",
      "body": "Se han añadido fotos del encuentro del fin de semana",
      "icon": "https://firebasestorage.googleapis.com/.../photos-icon.png",
      "actionButton": {
        "text": "Ver fotos",
        "url": "/(tabs)/fotos",
        "isInternal": true
      },
      "createdAt": "2025-01-14T18:00:00.000Z",
      "sentAt": "2025-01-14T18:05:00.000Z",
      "category": "fotos",
      "priority": "normal",
      "internalRoute": "/(tabs)/fotos"
    }
  }
}
```

---

## Rutas internas disponibles

La app móvil utiliza Expo Router. Estas son las rutas internas que puedes usar en `internalRoute`:

### Tabs principales:
- `/(tabs)/index` - Inicio
- `/(tabs)/cancionero` - Cantoral
- `/(tabs)/calendario` - Calendario
- `/(tabs)/fotos` - Galería de fotos
- `/(tabs)/comunica` - Comunica
- `/(tabs)/mas` - Más opciones

### Otras rutas:
- `/notifications` - Pantalla de notificaciones
- `/wordle` - Juego Wordle

**Nota:** Si no hay ruta interna específica, la notificación simplemente abre la app.

---

## Formato de iconos

### Iconos (`icon` field):
- **Formato:** PNG o JPG
- **Tamaño recomendado:** 192x192px (mínimo 96x96px)
- **Formato:** Cuadrado con esquinas redondeadas opcional
- **Alojamiento:** Debe ser una URL pública accesible (Firebase Storage, CDN, etc.)
- **NO usar:** Emojis, SVG, o rutas locales

### Imágenes grandes (`imageUrl` field):
- **Formato:** PNG o JPG
- **Tamaño recomendado:** 1024x512px (formato landscape)
- **Uso:** Para notificaciones enriquecidas con imagen destacada
- **Opcional:** Solo úsalo si quieres mostrar una imagen grande en la notificación

### Sugerencias de iconos por categoría:
- **general:** Icono de la app MCM
- **eventos:** Icono de calendario
- **cancionero:** Icono de nota musical
- **fotos:** Icono de cámara/galería
- **urgente:** Icono de alerta/campana
- **mantenimiento:** Icono de herramientas
- **celebraciones:** Icono de confetti/celebración

---

## Implementación del Panel Next.js

### Paso 1: Instalar dependencias

```bash
npm install firebase-admin uuid
npm install --save-dev @types/uuid
```

---

### Paso 2: Configurar variables de entorno

Crear archivo `.env.local`:

```env
# Firebase Admin SDK
FIREBASE_PROJECT_ID=mcmappconsolacion
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@mcmappconsolacion.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://mcmappconsolacion-default-rtdb.europe-west1.firebasedatabase.app

# Opcional: Para autenticación del panel
ADMIN_USERNAME=admin
ADMIN_PASSWORD=tu_password_seguro
```

**Importante:** Obtén la clave privada desde Firebase Console:
1. Ve a Project Settings > Service Accounts
2. Click en "Generate new private key"
3. Descarga el JSON
4. Copia el valor de `private_key` (incluye los `\n`)

---

### Paso 3: Inicializar Firebase Admin

Crear `lib/firebase-admin.ts`:

```typescript
// lib/firebase-admin.ts
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL!,
  });
}

export const db = admin.database();
export default admin;
```

---

### Paso 4: Tipos TypeScript

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
}

export interface ExpoMessage {
  to: string;
  sound: 'default' | null;
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
  categoryId?: string;
}
```

---

### Paso 5: API Route para enviar notificaciones

Crear `app/api/notifications/send/route.ts`:

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

    // 1. Crear objeto de notificación completo
    const notificationId = uuidv4();
    const notification: NotificationData = {
      id: notificationId,
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
    const messages: ExpoMessage[] = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title: notification.title,
      body: notification.body,
      data: {
        id: notification.id,
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
        console.error('Error de Expo Push API:', await response.text());
        throw new Error('Error enviando a Expo Push Service');
      }

      const result = await response.json();
      results.push(...result.data);
    }

    // 7. Actualizar timestamp de envío
    await db.ref(`notifications/${notificationId}/sentAt`).set(
      new Date().toISOString()
    );

    // 8. Analizar resultados
    const successful = results.filter((r: any) => r.status === 'ok').length;
    const failed = results.filter((r: any) => r.status === 'error').length;

    console.log(`✅ Enviadas: ${successful}, ❌ Fallidas: ${failed}`);

    return NextResponse.json({
      success: true,
      notificationId,
      sent: tokens.length,
      successful,
      failed,
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

---

### Paso 6: API Route para obtener estadísticas

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

    return NextResponse.json({
      devices: deviceStats,
      activeLastDay,
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

### Paso 7: Componente del Panel (UI)

Crear `app/admin/notifications/page.tsx`:

```typescript
// app/admin/notifications/page.tsx
'use client';

import { useState, useEffect } from 'react';

interface Stats {
  devices: {
    total: number;
    ios: number;
    android: number;
    web: number;
  };
  activeLastDay: number;
  totalNotificationsSent: number;
}

export default function NotificationsPanel() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [icon, setIcon] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [category, setCategory] = useState<string>('general');
  const [priority, setPriority] = useState<string>('normal');
  const [internalRoute, setInternalRoute] = useState('');

  // Botón de acción
  const [hasActionButton, setHasActionButton] = useState(false);
  const [actionButtonText, setActionButtonText] = useState('');
  const [actionButtonUrl, setActionButtonUrl] = useState('');
  const [actionButtonIsInternal, setActionButtonIsInternal] = useState(true);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  // Cargar estadísticas
  useEffect(() => {
    fetch('/api/notifications/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(console.error);
  }, []);

  const sendNotification = async () => {
    setLoading(true);
    setResult(null);

    try {
      const payload: any = {
        title,
        body,
        category,
        priority,
      };

      if (icon) payload.icon = icon;
      if (imageUrl) payload.imageUrl = imageUrl;
      if (internalRoute) payload.internalRoute = internalRoute;

      if (hasActionButton && actionButtonText && actionButtonUrl) {
        payload.actionButton = {
          text: actionButtonText,
          url: actionButtonUrl,
          isInternal: actionButtonIsInternal,
        };
      }

      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        // Limpiar formulario
        setTitle('');
        setBody('');
        setIcon('');
        setImageUrl('');
        setInternalRoute('');
        setActionButtonText('');
        setActionButtonUrl('');
        setHasActionButton(false);
      }
    } catch (error) {
      setResult({ error: 'Error al enviar notificación' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Panel de Notificaciones Push</h1>

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{stats.devices.total}</div>
            <div className="text-sm text-gray-600">Dispositivos totales</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats.activeLastDay}</div>
            <div className="text-sm text-gray-600">Activos (24h)</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {stats.devices.ios} / {stats.devices.android}
            </div>
            <div className="text-sm text-gray-600">iOS / Android</div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{stats.totalNotificationsSent}</div>
            <div className="text-sm text-gray-600">Notificaciones enviadas</div>
          </div>
        </div>
      )}

      {/* Formulario */}
      <div className="bg-white shadow-md rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold mb-4">Nueva Notificación</h2>

        {/* Título */}
        <div>
          <label className="block mb-2 font-medium text-gray-700">
            Título *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Ej: Nueva actividad en el calendario"
            maxLength={50}
          />
          <p className="text-xs text-gray-500 mt-1">{title.length}/50 caracteres</p>
        </div>

        {/* Cuerpo */}
        <div>
          <label className="block mb-2 font-medium text-gray-700">
            Mensaje *
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={4}
            placeholder="Escribe el mensaje de la notificación..."
            maxLength={200}
          />
          <p className="text-xs text-gray-500 mt-1">{body.length}/200 caracteres</p>
        </div>

        {/* Categoría y Prioridad */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-2 font-medium text-gray-700">Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="general">General</option>
              <option value="eventos">Eventos</option>
              <option value="cancionero">Cancionero</option>
              <option value="fotos">Fotos</option>
              <option value="urgente">Urgente</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="celebraciones">Celebraciones</option>
            </select>
          </div>

          <div>
            <label className="block mb-2 font-medium text-gray-700">Prioridad</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="low">Baja</option>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
            </select>
          </div>
        </div>

        {/* Icono e Imagen */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-2 font-medium text-gray-700">
              URL del icono (opcional)
            </label>
            <input
              type="url"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
              placeholder="https://ejemplo.com/icono.png"
            />
            <p className="text-xs text-gray-500 mt-1">192x192px PNG/JPG recomendado</p>
          </div>

          <div>
            <label className="block mb-2 font-medium text-gray-700">
              URL de imagen grande (opcional)
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
              placeholder="https://ejemplo.com/banner.jpg"
            />
            <p className="text-xs text-gray-500 mt-1">1024x512px landscape recomendado</p>
          </div>
        </div>

        {/* Ruta interna */}
        <div>
          <label className="block mb-2 font-medium text-gray-700">
            Ruta interna (opcional)
          </label>
          <select
            value={internalRoute}
            onChange={(e) => setInternalRoute(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">-- Sin navegación --</option>
            <option value="/(tabs)/index">Inicio</option>
            <option value="/(tabs)/calendario">Calendario</option>
            <option value="/(tabs)/fotos">Fotos</option>
            <option value="/(tabs)/cancionero">Cancionero</option>
            <option value="/(tabs)/comunica">Comunica</option>
            <option value="/notifications">Notificaciones</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            La app navegará a esta pantalla al tocar la notificación
          </p>
        </div>

        {/* Botón de acción */}
        <div className="border-t pt-4">
          <div className="flex items-center mb-3">
            <input
              type="checkbox"
              id="hasActionButton"
              checked={hasActionButton}
              onChange={(e) => setHasActionButton(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="hasActionButton" className="font-medium text-gray-700">
              Añadir botón de acción
            </label>
          </div>

          {hasActionButton && (
            <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Texto del botón
                </label>
                <input
                  type="text"
                  value={actionButtonText}
                  onChange={(e) => setActionButtonText(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  placeholder='Ej: "Ver más", "Abrir", "Ir al calendario"'
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  URL de destino
                </label>
                <input
                  type="text"
                  value={actionButtonUrl}
                  onChange={(e) => setActionButtonUrl(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  placeholder="/(tabs)/calendario o https://..."
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isInternal"
                  checked={actionButtonIsInternal}
                  onChange={(e) => setActionButtonIsInternal(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="isInternal" className="text-sm text-gray-700">
                  Navegación interna (dentro de la app)
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Botón de envío */}
        <button
          onClick={sendNotification}
          disabled={loading || !title || !body}
          className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? 'Enviando...' : `Enviar a ${stats?.devices.total || 0} dispositivos`}
        </button>

        {/* Resultado */}
        {result && (
          <div
            className={`p-4 rounded-lg ${
              result.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
            }`}
          >
            {result.error ? (
              <p className="text-red-700 font-medium">{result.error}</p>
            ) : (
              <div className="text-green-700">
                <p className="font-bold mb-2">✅ Notificación enviada correctamente</p>
                <div className="text-sm space-y-1">
                  <p>• Enviadas a: {result.sent} dispositivos</p>
                  <p>• Exitosas: {result.successful}</p>
                  {result.failed > 0 && <p>• Fallidas: {result.failed}</p>}
                  <p className="text-xs text-gray-600 mt-2">ID: {result.notificationId}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## Campos importantes del formulario

### Campos obligatorios:
1. **title** (string, max 50 chars) - Título de la notificación
2. **body** (string, max 200 chars) - Mensaje/descripción

### Campos opcionales pero importantes:
3. **category** (select) - Categoría para organización y priorización
4. **priority** (select: low/normal/high) - Prioridad de entrega
5. **icon** (URL string) - Icono PNG/JPG 192x192px
6. **imageUrl** (URL string) - Imagen grande 1024x512px
7. **internalRoute** (select) - Ruta interna donde navegar al tocar
8. **actionButton** (objeto opcional):
   - **text** (string) - Texto del botón
   - **url** (string) - URL de destino
   - **isInternal** (boolean) - true = navegación interna, false = abrir navegador

---

## Flujo completo

### 1. Usuario abre la app móvil
- Se solicitan permisos de notificaciones
- Se obtiene el Expo Push Token
- Se guarda en Firebase `/pushTokens/{deviceId}`

### 2. Admin crea notificación en el panel
- Llena el formulario con todos los campos
- Click en "Enviar"

### 3. Backend procesa el envío
- Crea el objeto NotificationData con un UUID
- Lo guarda en `/notifications/{notificationId}` (historial)
- Lee todos los tokens de `/pushTokens`
- Envía a Expo Push API en chunks de 100
- Actualiza `sentAt` en la notificación

### 4. Expo distribuye
- Expo Push Service envía a APNs (iOS) y FCM (Android)

### 5. Dispositivos reciben
- La app guarda localmente en AsyncStorage
- Si tiene `internalRoute`, navega al tocar
- Si tiene `actionButton`, muestra el botón

### 6. Usuario ve historial
- Abre pantalla `/notifications` en la app
- Ve notificaciones de Firebase + historial local
- Puede tocar para navegar o ver detalles

---

## Testing del panel

### 1. Test con dispositivo real:
```bash
# En la app móvil, busca en logs:
🥳 Expo Push Token: ExponentPushToken[xxxxxx]

# Ese token se guardará automáticamente en Firebase
```

### 2. Envía desde el panel:
- Llena título y mensaje
- Selecciona categoría "general"
- Click "Enviar"

### 3. Verifica:
- La notificación debe aparecer en el dispositivo
- Debe guardarse en Firebase `/notifications/{id}`
- Debe aparecer en la pantalla de notificaciones de la app

---

## Reglas de seguridad Firebase

```json
{
  "rules": {
    "pushTokens": {
      ".read": false,
      "$deviceId": {
        ".write": true,
        ".read": false
      }
    },
    "notifications": {
      ".read": true,
      ".write": false
    }
  }
}
```

**Nota:** El panel usa Firebase Admin SDK que tiene permisos completos, ignorando estas reglas.

---

## Checklist de implementación

- [ ] Instalar dependencias (firebase-admin, uuid)
- [ ] Configurar variables de entorno (.env.local)
- [ ] Crear lib/firebase-admin.ts
- [ ] Crear types/notifications.ts
- [ ] Crear API route /api/notifications/send
- [ ] Crear API route /api/notifications/stats
- [ ] Crear página app/admin/notifications/page.tsx
- [ ] Subir iconos a Firebase Storage u otro CDN
- [ ] Probar con dispositivo real
- [ ] Configurar reglas de seguridad en Firebase
- [ ] (Opcional) Añadir autenticación al panel

---

## Notas finales

- La app móvil ya está lista para recibir todas estas notificaciones
- Los iconos DEBEN ser URLs públicas accesibles
- Las rutas internas son las de Expo Router (ver lista arriba)
- El historial se guarda automáticamente en Firebase y localmente
- Los usuarios pueden ver el historial en la pantalla /notifications
- Deep linking funciona automáticamente con `internalRoute`
