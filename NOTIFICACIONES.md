# Sistema de Notificaciones Push — MCM App

> Documento consolidado. Reemplaza a: `NOTIS_APP_MEJORAS.md`, `NOTIS_DEVELOP_BACKEND.md`, `NOTIS_GUIA_PRUEBAS.md`, `PANEL_NOTIFICACIONES_NEXTJS.md`

---

## Estado actual (marzo 2026)

### Lo que funciona (cliente)
- Permisos de notificaciones (solicitud al arrancar)
- Registro de token Expo Push en Firebase (`/pushTokens/{deviceId}`)
- Heartbeat `lastActive` cada 5 minutos
- Handler de foreground (sonido, alerta, categorías iOS)
- Almacenamiento local de notificaciones recibidas (AsyncStorage, max 100)
- Pantalla de notificaciones con lista, leído/no-leído, swipe, pull-to-refresh
- Badge de no-leídas en icono de campana (Home)
- Deep linking al tocar notificación (usa `internalRoute`)
- Fix de IDs: `data?.id || notification.request.identifier` (aplicado)

### Lo que NO funciona / falta
- **Backend/panel admin** (Next.js): no existe. No se pueden enviar notificaciones
- **Suscripción en tiempo real**: `subscribeToNotifications()` existe en el servicio pero NO se usa en `notifications.tsx` (solo carga al abrir/focus)
- **Contador foreground**: cuando llega una notificación con la app abierta, el badge no se actualiza (falta contexto compartido)
- **Vista detalle**: el body se trunca a 3 líneas, no hay pantalla para leer la notificación completa
- **Marcar todas como leídas**: no implementado
- **Categorías iOS action buttons**: definidas pero `actionIdentifier` no se inspecciona en el handler de respuesta

### Rama `origin/notificaciones`
Analizada y **descartable**. Solo tiene 1 commit sobre main con código OneSignal comentado. Todo el sistema actual (Expo Notifications + Firebase) se construyó en main y lo supera completamente. Se puede borrar la rama.

---

## Arquitectura actual del cliente

```
app/_layout.tsx
├── import '../notifications/NotificationHandler'   ← Side-effect: configura handler foreground
├── usePushNotifications()                           ← Hook: permisos, token, listeners, heartbeat
│
├── notifications/NotificationHandler.ts             ← Configuración global + categorías iOS
├── notifications/usePushNotifications.ts            ← Lifecycle completo de notificaciones
├── services/pushNotificationService.ts              ← Capa de datos: Firebase + AsyncStorage
├── hooks/useUnreadNotificationsCount.ts             ← Badge: cuenta no-leídas
├── types/notifications.ts                           ← Tipos TypeScript
└── app/notifications.tsx                            ← Pantalla de notificaciones (UI)
```

### Firebase paths
```
/pushTokens/{deviceId}         ← Token, plataforma, lastActive, appVersion
/notifications/{notificationId} ← Historial de notificaciones enviadas
```

---

## Plan para completar el sistema

### Fase 1: Mejoras del cliente (sin backend)
Estas se pueden hacer ya, mejoran la UX sin necesitar el panel:

1. **Suscripción en tiempo real en notifications.tsx**
   - Usar `subscribeToNotifications()` de `pushNotificationService.ts` en vez de cargar solo al abrir
   - Archivo: `mcm-app/app/notifications.tsx`

2. **Contexto de notificaciones para badge en tiempo real**
   - Crear `contexts/NotificationsContext.tsx`
   - Emitir evento desde `usePushNotifications.ts` cuando llega una notificación
   - `useUnreadNotificationsCount` escucha ese contexto
   - Archivos: nuevo contexto + modificar hook + modificar usePushNotifications

3. **Vista detalle de notificación**
   - Crear `app/notification-detail.tsx` (o modal expandido)
   - Al tocar una notificación sin `internalRoute`, muestra body completo + imagen + botón de acción
   - Archivo: nueva pantalla

4. **Botón "Marcar todas como leídas"** en la pantalla de notificaciones

### Fase 2: Backend (panel admin Next.js)
Crear el panel de administración para enviar notificaciones:

#### Estructura propuesta
```
panel-notificaciones/           ← Nuevo proyecto Next.js
├── app/
│   ├── admin/notifications/
│   │   └── page.tsx            ← UI: formulario + estadísticas
│   └── api/notifications/
│       ├── send/route.ts       ← Envío: Firebase + Expo Push API
│       └── stats/route.ts      ← Estadísticas de dispositivos
├── lib/
│   └── firebase-admin.ts       ← Firebase Admin SDK init
├── types/
│   └── notifications.ts        ← Tipos compartidos
└── .env.local                  ← Credenciales Firebase Admin
```

#### Dependencias
```bash
npm install firebase-admin uuid
```

#### Variables de entorno del panel
```
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_DATABASE_URL=...
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
```

#### API: Envío de notificaciones (`/api/notifications/send`)
El backend debe:
1. Generar UUID v4 como `notificationId`
2. Guardar en Firebase `/notifications/{notificationId}` con todos los campos
3. Leer todos los tokens de `/pushTokens`
4. Enviar via Expo Push API en chunks de 100 — **CRÍTICO**: incluir `notificationId` en `data.id`
5. Limpiar tokens inválidos (respuestas `DeviceNotRegistered`)
6. Actualizar `sentAt` en Firebase

#### Formato del mensaje Expo Push
```json
{
  "to": "ExponentPushToken[xxx]",
  "title": "Título",
  "body": "Cuerpo del mensaje",
  "data": {
    "id": "uuid-generado-por-el-panel",
    "category": "general",
    "priority": "normal",
    "internalRoute": "/(tabs)/cancionero",
    "icon": "https://...",
    "imageUrl": "https://...",
    "actionButton": { "text": "Ver más", "url": "https://..." }
  },
  "categoryId": "general",
  "priority": "default",
  "sound": "default"
}
```

#### API: Estadísticas (`/api/notifications/stats`)
- Total dispositivos registrados
- Activos últimas 24h / 7d
- Desglose por plataforma (iOS/Android/Web)
- Total notificaciones enviadas

#### UI del panel
- Dashboard con estadísticas
- Formulario: título (50 chars max), body (200 chars), categoría, prioridad, icono URL, imagen URL, ruta interna, botón de acción
- Autenticación simple (usuario/contraseña via env vars)
- Historial de notificaciones enviadas

### Fase 3: Mejoras opcionales
- Notificaciones programadas (scheduled sends)
- Notificaciones segmentadas (por plataforma, versión, etc.)
- Agrupación por fecha en la pantalla
- Filtros y búsqueda
- Caché optimizada

---

## Rutas internas disponibles para deep linking

```
/(tabs)/index          Inicio
/(tabs)/cancionero     Cantoral (activar feature flag primero)
/(tabs)/calendario     Calendario
/(tabs)/fotos          Galería de fotos
/(tabs)/mas            Más opciones
/notifications         Pantalla de notificaciones
/wordle                Juego Wordle
```

Nota: `/(tabs)/comunica` está desactivada actualmente.

---

## Configuración de la app (app.json)

```json
"expo-notifications": [{
  "icon": "./assets/images/adaptive-icon.png",
  "color": "#253883",
  "sounds": [],
  "mode": "production"
}]
```

- **EAS Project ID**: `aa9f2d3a-b74a-4169-bad4-e851015e30c6`
- **Canal Android**: "Notificaciones MCM" (importancia MAX)
- **Categorías iOS**: general, eventos, fotos (con action buttons)

---

## Credenciales y certificados
- **iOS APNs**: gestionado por EAS Build. Configurar con `eas credentials`
- **Android FCM**: automático con EAS Build
- **Web**: automático con HTTPS

---

## Guía de pruebas

### Enviar notificación de prueba (sin backend)
1. Arranca la app en dispositivo real
2. Copia el Expo Push Token que aparece en los logs
3. Ve a https://expo.dev/notifications
4. Pega el token, escribe título/body, envía

### Verificar en la app
- [ ] Permiso concedido al arrancar
- [ ] Token guardado en Firebase `/pushTokens/{deviceId}`
- [ ] Notificación recibida en foreground (banner/alerta)
- [ ] Notificación recibida en background (bandeja del sistema)
- [ ] Aparece en pantalla de notificaciones
- [ ] Badge de no-leídas se muestra
- [ ] Swipe para marcar como leída funciona
- [ ] Deep linking funciona al tocar (si tiene `internalRoute`)

### Plataformas
- **iOS real**: todo funciona
- **iOS simulador**: push NO funciona, solo notificaciones locales y pantalla
- **Android emulador/real**: todo funciona
- **Web**: requiere HTTPS (usar `npx expo start --tunnel`)

---

## Solución de problemas

| Problema | Causa probable | Solución |
|----------|---------------|----------|
| No obtiene token | Simulador, permisos denegados, sin projectId | Usar dispositivo real, verificar permisos, verificar `eas.projectId` en app.json |
| Notificación no llega | Credenciales APNs/FCM, token inválido | Ejecutar `eas credentials`, verificar token en Firebase |
| IDs no coinciden | Backend no envía `data.id` | Backend DEBE incluir `data.id` con el UUID de Firebase |
| Badge no se actualiza | Falta contexto compartido | Implementar `NotificationsContext` (Fase 1) |
| Historial vacío | Firebase rules, ID mismatch | Verificar `.read: true` en `/notifications`, verificar IDs |
| Navegación no funciona | Ruta inválida, tab desactivada | Verificar ruta existe, verificar feature flags |

---

## Reglas de seguridad Firebase recomendadas

```json
{
  "rules": {
    "pushTokens": {
      "$deviceId": {
        ".read": false,
        ".write": true
      }
    },
    "notifications": {
      ".read": true,
      ".write": false
    }
  }
}
```

Nota: la escritura en `/notifications` se hace desde el backend con Firebase Admin SDK (bypasa rules).
