# Sistema de Notificaciones Push — MCM App

> Documento consolidado. Reemplaza a: `NOTIS_APP_MEJORAS.md`, `NOTIS_DEVELOP_BACKEND.md`, `NOTIS_GUIA_PRUEBAS.md`, `PANEL_NOTIFICACIONES_NEXTJS.md`

---

## Estado actual (mayo 2026)

### Lo que funciona (cliente)
- Permisos de notificaciones (solicitud al arrancar)
- Registro de token Expo Push en Firebase (`/pushTokens/{deviceId}`)
- Heartbeat `lastActive` cada 5 minutos
- Handler de foreground (sonido, alerta, categorías iOS)
- Almacenamiento local de notificaciones recibidas (AsyncStorage, max 100)
- Pantalla de notificaciones con lista, leído/no-leído, swipe, pull-to-refresh
- Badge de no-leídas en icono de campana (Home) — **actualización en tiempo real via NotificationsContext**
- Deep linking al tocar notificación desde bandeja del sistema (usa `internalRoute`)
- Fix de IDs: `data?.id || notification.request.identifier` (aplicado)
- **Suscripción en tiempo real a Firebase** via `NotificationsContext` (usa `subscribeToNotifications()`)
- **Contador foreground**: badge se actualiza al instante cuando llega notificación con app abierta
- **Vista detalle**: modal completo con body, imagen, botones de acción (pageSheet en iOS)
- **Marcar como leída individual**: botón checkmark en cada tarjeta (usa TouchableOpacity de gesture-handler para funcionar dentro de Swipeable)
- **Marcar todas como leídas**: botón done-all en header de la pantalla de notificaciones
- **Categorías iOS action buttons**: `actionIdentifier` mapeado a rutas (view→notifications, view_event→calendario, view_photos→fotos)
- **Auto-inicialización de primer uso**: al registrarse, solo las 3 notificaciones más recientes (últimos 4 meses) quedan como no leídas; el resto se marca automáticamente como leídas

### Backend (panel admin)
- **Repositorio**: `mcmespana/mcmpanel` — en desarrollo
- El cliente de la app está **completamente listo** para recibir y mostrar notificaciones
- El backend solo necesita: enviar via Expo Push API + guardar en Firebase `/notifications/{id}`
- Ver Fase 2 más abajo para la especificación completa del backend

---

## Arquitectura actual del cliente

```
app/_layout.tsx
├── import '../notifications/NotificationHandler'   ← Side-effect: configura handler foreground
├── <NotificationsProvider>                          ← Contexto: suscripción real-time, unreadCount
│   └── usePushNotifications()                       ← Hook: permisos, token, listeners, heartbeat
│
├── contexts/NotificationsContext.tsx                 ← Contexto: subscribeToNotifications, badge
├── notifications/NotificationHandler.ts             ← Configuración global + categorías iOS
├── notifications/usePushNotifications.ts            ← Lifecycle + iOS action button routing
├── services/pushNotificationService.ts              ← Capa de datos: Firebase + AsyncStorage
├── hooks/useUnreadNotificationsCount.ts             ← Badge: delega a NotificationsContext
├── types/notifications.ts                           ← Tipos TypeScript
└── app/notifications.tsx                            ← Pantalla (real-time, detalle modal, mark all)
```

### Firebase paths
```
/pushTokens/{deviceId}         ← Token, plataforma, lastActive, appVersion
/notifications/{notificationId} ← Historial de notificaciones enviadas
```

---

## Plan para completar el sistema

### Fase 1: Mejoras del cliente — COMPLETADA (marzo 2026)

Todo implementado:
- `contexts/NotificationsContext.tsx` — suscripción real-time a Firebase, badge en foreground
- `app/notifications.tsx` — reescrita con modal de detalle, botones marcar leída, rediseño de tarjetas
- `notifications/usePushNotifications.ts` — routing de iOS action buttons (`actionIdentifier`)
- `services/pushNotificationService.ts` — `markAllNotificationsAsRead()` batch, `initializeNewUserReadStatus()`
- `hooks/useUnreadNotificationsCount.ts` — simplificado, delega a NotificationsContext

---

## Contenido de texto: `body` y `bodyLong`

Una notificación tiene dos campos de texto para el cuerpo:

- **`body`** (obligatorio, corto): es lo que viaja en la push y lo que se ve en la
  **tarjeta** del centro de notificaciones (recortado a 2 líneas). El MCM Panel lo
  limita a **200 caracteres**.
- **`bodyLong`** (opcional, largo): descripción **extendida** que se muestra en el
  **modal de detalle** al abrir la notificación. El modal es **scrollable**, así que
  admite texto largo (respeta saltos de línea `\n`).

**Fallback:** el modal muestra `bodyLong` si existe; si no, usa `body`. Es decir, una
notificación sin `bodyLong` se comporta como siempre.

**Límites:** en la app no hay límite duro (scroll). En el panel se recomienda un tope
blando de **~2000 caracteres** para `bodyLong`. Motivo: el payload de una push
(APNs/FCM) está limitado a ~4 KB y `data` cuenta contra ese límite. Como la app
**también lee la notificación completa desde Firebase** (`/notifications/{id}`), el
texto largo puede ir solo a Firebase si en algún caso superase ese tope; la app lo
mostrará igualmente al abrir (la deduplicación rellena `bodyLong` desde el registro
de Firebase aunque no viniera en la push).

```json
{
  "title": "Convivencia de fin de curso",
  "body": "Apúntate antes del viernes. Plazas limitadas.",
  "bodyLong": "Este año la convivencia será en la casa de espiritualidad de...\n\nHorario:\n- 10:00 Llegada\n- 11:00 Oración\n...\n\nQué llevar: saco, ropa cómoda...",
  "internalRoute": "/(tabs)/calendario"
}
```

---

## Arquitectura de botones y navegación

### `internalRoute` — Destino de la notificación

El campo `internalRoute` representa **la sección de la app a la que va asociada** la notificación.

**Comportamiento:**
- **Desde la bandeja del sistema** (tap en push notification): navega directamente a la ruta, sin modal.
- **Desde la pantalla de notificaciones** (tap en tarjeta): abre el modal de detalle. El modal muestra un botón "Ir a [Sección]" que lleva a esa ruta.
- En la tarjeta de la lista: se muestra un chip pequeño con el nombre de la sección (ej. "→ Calendario") como indicador visual (no es tappable).

**Rutas disponibles:**
```
/(tabs)/calendario     → chip "Calendario"
/(tabs)/fotos          → chip "Fotos"
/(tabs)/cancionero     → chip "Cantoral"
/(tabs)/mas            → chip "Más"
/(tabs)/index          → chip "Inicio"
/wordle                → chip "Wordle"
```

**Cuándo usarlo:** Cuando la notificación tiene relación directa con una sección. Ej: "Hay nuevas fotos del retiro" → `internalRoute: "/(tabs)/fotos"`.

---

### `actionButtons` — Botones de acción explícitos (hasta 3)

El campo `actionButtons` es un **array de call-to-actions explícitos** (de 1 a 3),
cada uno con texto personalizado que puede llevar a:
- Una URL externa (se abre en el navegador)
- Una ruta interna de la app

```json
"actionButtons": [
  { "text": "Apuntarme", "url": "https://mcmespana.com/inscripcion", "isInternal": false },
  { "text": "Ver fechas", "url": "/(tabs)/calendario", "isInternal": true }
]
```

**Comportamiento:**
- **En la tarjeta de la lista**: cada botón se muestra como un chip azul pequeño
  (tappable). Al pulsarlo navega directamente a la URL/ruta sin abrir el modal.
- **En el modal de detalle**: se apilan como botones CTA. El **primero** destaca en
  estilo primario (relleno); los siguientes van en estilo secundario (borde).

**Máximo:** 3 botones (`MAX_ACTION_BUTTONS` en `utils/notificationRoutes.ts`). Si el
panel manda más, la app usa los 3 primeros e ignora el resto.

**Cuándo usarlo:** Cuando la notificación tiene una o varias acciones específicas
nombradas, distintas de simplemente "ir a una sección". Ej: "Apuntarme" + "Ver fechas",
"Sí asistiré" + "No puedo", "Leer artículo".

#### Compatibilidad: `actionButton` (singular, legacy)

El formato antiguo de **un solo botón** sigue soportado:

```json
"actionButton": { "text": "Ver artículo", "url": "https://ejemplo.com/articulo", "isInternal": false }
```

La app lo trata como un array de un elemento. Si llegan **ambos** (`actionButton` +
`actionButtons`), se combinan y se deduplica por `url|text`. El formato recomendado
para nuevos envíos es **`actionButtons` (array)**, aunque sea de un solo botón.

> ⚠️ **iOS / Android — botones en la notificación del sistema:** estos botones se
> renderizan **dentro de la app** (tarjeta + modal del centro de notificaciones).
> Los botones en la propia notificación del sistema iOS dependen de *categorías*
> pre-registradas (`categoryId` → `general`/`eventos`/`fotos`, 1 botón cada una) y
> NO se pueden definir dinámicamente desde el payload. Para varios botones nativos
> haría falta registrar nuevas categorías en la app (build nativo). Ver §3 del
> contrato.

---

### Combinación de ambos

Una notificación puede tener los dos:
- `internalRoute` indica la sección asociada (botón "Ir a X" en el modal)
- `actionButtons` tiene los CTA explícitos (chips en tarjeta + botones CTA en modal)

**Ejemplo:**
```json
{
  "title": "¡Nuevas canciones en el cantoral!",
  "body": "Hemos añadido 5 canciones nuevas de Adviento.",
  "internalRoute": "/(tabs)/cancionero",
  "actionButtons": [
    { "text": "Ver novedades", "url": "https://mcmespana.com/novedades", "isInternal": false },
    { "text": "Escuchar", "url": "https://open.spotify.com/...", "isInternal": false }
  ]
}
```
→ En la tarjeta: chip "Cantoral" + chips tappables "Ver novedades" y "Escuchar"
→ En el modal: botón "Ir a Cantoral" + botón CTA "Ver novedades" (primario) + "Escuchar" (secundario)

---

### Sin ninguno de los dos

Si no hay `internalRoute` ni `actionButtons`, la notificación solo muestra título, cuerpo y fecha. El modal sigue siendo accesible tocando la tarjeta.

Al tocar la push desde la bandeja del sistema, la app abre el centro de
notificaciones y **despliega automáticamente esa notificación en grande**
(deep-link interno `/notifications?openId=<id>`). Para que el `openId` haga
match con la notificación correcta, el panel **debe** enviar `data.id` con el
mismo ID que la notificación tiene en Firebase (ver "Abrir la notificación en
grande" más abajo).

### Abrir la notificación en grande (deep-link al detalle)

Para que al pulsar una push se abra directamente esa notificación en su vista
de detalle dentro de la app:

1. **Envía siempre `data.id`** con el ID de la notificación en Firebase
   (`notifications/<id>`). La app lo usa como identificador estable y como
   `openId` del deep-link.
2. **No pongas `internalRoute`** (o ponlo a `/notifications`) si lo que quieres
   es que la notificación se abra "en grande" en el centro de notificaciones.
   Si pones otra `internalRoute`, la app navegará a esa sección en su lugar.

Con esto, tocar la notificación abre `/notifications?openId=<id>` y la app
despliega el detalle de esa notificación automáticamente.

---

### Flujo completo de interacción

```
Usuario recibe push notification
└── Toca desde bandeja del sistema
    ├── Tiene internalRoute (≠ /notifications) → navega directamente a esa sección
    └── Sin internalRoute (o internalRoute = /notifications)
        → abre el centro de notificaciones Y despliega esa notificación
          concreta en grande (deep-link /notifications?openId=<id>)

Usuario abre pantalla de notificaciones
└── Ve lista de tarjetas
    ├── Toca tarjeta → abre modal de detalle (siempre)
    │   ├── Modal muestra body completo + imagen (si hay)
    │   ├── Botón "Ir a [Sección]" (si hay internalRoute)
    │   └── Botones CTA apilados, hasta 3 (si hay actionButtons)
    ├── Toca chip de actionButton en tarjeta → navega directamente (sin modal)
    ├── Toca ✓ en tarjeta → marca como leída sin abrir modal
    └── Swipe derecha → marca como leída sin abrir modal
```

### Fase 2: Backend (panel admin) — EN DESARROLLO en `mcmespana/mcmpanel`
Panel de administración en `mcmespana/mcmpanel` para enviar notificaciones:

#### Estructura propuesta
```
mcmpanel/                       ← Repositorio mcmespana/mcmpanel
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
    "bodyLong": "Descripción extendida opcional (se ve scrollable en el detalle)...",
    "icon": "https://...",
    "imageUrl": "https://...",
    "actionButtons": [
      { "text": "Ver más", "url": "https://...", "isInternal": false },
      { "text": "Calendario", "url": "/(tabs)/calendario", "isInternal": true }
    ]
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
- Formulario: título (80 chars max), body (200 chars), **descripción detallada opcional `bodyLong` (~2000 chars, scrollable en la app)**, categoría, prioridad, icono URL, imagen URL, ruta interna, **hasta 3 botones de acción** (texto + URL/ruta + interno/externo cada uno)
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
/(tabs)/index               Inicio
/(tabs)/cancionero          Cantoral (según perfil)
/(tabs)/calendario          Calendario
/(tabs)/fotos               Galería de fotos (NO "albums")
/(tabs)/mas                 Más opciones (hub de eventos: Jubileo, etc.)
/(tabs)/contigo             Contigo (según perfil)
/(tabs)/contigo/evangelio   Evangelio del día
/(tabs)/contigo/oracion     Oración
/(tabs)/contigo/revision    Revisión
/(tabs)/contigo/bookmarks   Favoritos
/(tabs)/visitapapa          Visita del Papa (según perfil)
/notifications              Pantalla de notificaciones (raíz, NO bajo tabs)
/wordle                     Juego Wordle (dormido, no usar)
```

Notas:

- `jubileo`, `actividades` y `albums` **NO** son rutas propias. Jubileo y las
  actividades viven dentro de `/(tabs)/mas` (`EventHomeScreen`); la galería es
  `/(tabs)/fotos`. La app aplica **alias automáticos** para estos casos — ver
  `utils/notificationRoutes.ts`.
- La visibilidad de algunas tabs depende del **perfil** (`/profileConfig`). Para
  destinos universales usa `index`, `calendario`, `fotos` o `mas`.
- **Contrato completo con el MCM Panel** (campos del payload, `/pushTokens`,
  segmentación, correcciones): ver `docs/contratos/NOTIFICACIONES_CONTRATO.md`.

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
- [ ] Aparece en pantalla de notificaciones (real-time, sin pull-to-refresh)
- [ ] Badge de no-leídas se muestra y se actualiza en foreground
- [ ] Swipe para marcar como leída funciona
- [ ] Deep linking funciona al tocar (si tiene `internalRoute`)
- [ ] Modal de detalle muestra body completo, imagen y botón de acción
- [ ] Botón "Marcar todas como leídas" funciona (icono done-all en header)
- [ ] iOS action buttons (view, view_event, view_photos) navegan correctamente

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
| Badge no se actualiza | Error en NotificationsContext | Verificar que `NotificationsProvider` envuelve `_layout.tsx`, revisar logs de `subscribeToNotifications` |
| Historial vacío | Firebase rules, ID mismatch | Verificar `.read: true` en `/notifications`, verificar IDs |
| Navegación no funciona | Ruta inválida, tab desactivada | Verificar ruta existe, verificar perfil activo en Firebase |

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
