# Contrato de datos MCM Panel ↔ MCM App (revisado y alineado)

> Este documento es la **respuesta de la MCM App** al contrato propuesto por el
> MCM Panel. Recoge: (1) lo que la app procesa hoy de verdad, (2) las
> correcciones que el Panel debe aplicar (campos/valores equivocados en el
> contrato original), y (3) los cambios que ya se han hecho en la app para
> tolerar el formato del Panel.
>
> Fecha: 2026-06-02 · App v2.0.0 · Fuente de verdad: código de `mcm-app/`.

---

## TL;DR — qué tiene que cambiar el Panel

1. **Rutas (`internalRoute`)**: varias de las configuradas NO existen. Lista real
   más abajo. La app ahora aplica alias, pero conviene corregir el Panel.
   - `/(tabs)/actividades` ❌ → no existe (las actividades/eventos viven en `/(tabs)/mas`)
   - `/(tabs)/jubileo` ❌ → no existe (Jubileo es un evento dentro de `/(tabs)/mas`)
   - `/(tabs)/albums` ❌ → la galería es **`/(tabs)/fotos`**
   - `/(tabs)/wordle` ❌ → es **`/wordle`** (ruta raíz, y además Wordle está dormido)
2. **`/pushTokens`**: el contrato inventa `userType` y `delegacion` con valores
   (`joven`/`responsable`/`"Castellón"`) que **no existen**. Los campos reales son
   `profileType`, `delegationId` y, sobre todo, **`topics[]`** (la clave de
   segmentación). Detalle y valores válidos abajo.
3. **Botones de acción**: la app ahora soporta **hasta 3 botones** (`data.actionButtons`,
   array). Sigue aceptando el objeto único `data.actionButton` (legacy) por
   compatibilidad. **Formato canónico recomendado: `actionButtons` (array)**, cada
   elemento `{ text, url, isInternal }`. Ver §3.
   **Descripción extendida (`data.bodyLong`)**: NUEVO campo opcional de texto largo
   que la app muestra en el modal de detalle (scrollable); si no viene, usa `body`
   como fallback. Recomendado ≤2000 chars. Ver §3.bis.
4. **`categoryId`**: la app solo registra categorías iOS `general`, `eventos`,
   `fotos`. Mandar `evento`/`actividad`/`cantoral`/`jubileo`/`urgente` como
   `categoryId` no aporta botones (se ignora). Conviene **desacoplar** `categoryId`
   (solo iOS action buttons) de `data.category` (etiqueta de negocio).
5. **Imagen en iOS**: **no hay Notification Service Extension**. `richContent.image`
   + `mutableContent` NO pintan imagen en la notificación del sistema iOS. La imagen
   solo se ve dentro de la app (modal de detalle) vía `data.imageUrl`. En Android sí
   se ve. Mantener `data.imageUrl` siempre.

---

## 1. Recepción de notificaciones

Listeners en `mcm-app/notifications/usePushNotifications.ts`:

- `addNotificationReceivedListener` — app en **foreground**: guarda la notificación
  en AsyncStorage y refresca el badge. El handler global
  (`NotificationHandler.ts`) suprime el banner del sistema en foreground para evitar
  duplicados; solo suena + actualiza el badge del icono.
- `addNotificationResponseReceivedListener` — **tap** del usuario: resuelve la ruta,
  navega con Expo Router y marca como leída.

`data.id` es **crítico**: se usa como ID estable para deduplicar. Si no llega, la
app genera un hash de `título|cuerpo` (peor dedup). **Manténganlo siempre.**

## 2. Navegación (`internalRoute`)

Sí, se lee `data.internalRoute` y se navega con `router.navigate(...)`. La app
**normaliza** la ruta antes de navegar (`utils/notificationRoutes.ts`), tolerando
rutas desnudas (`cancionero`), el grupo `(tabs)` y un **mapa de alias** para las
rutas heredadas del Panel.

### (a) Lista DEFINITIVA de rutas válidas

| `internalRoute`                 | Destino                  |
| ------------------------------- | ------------------------ |
| `/(tabs)/index`                 | Inicio (Home)            |
| `/(tabs)/cancionero`            | Cantoral                 |
| `/(tabs)/calendario`            | Calendario               |
| `/(tabs)/fotos`                 | Fotos / álbumes          |
| `/(tabs)/mas`                   | Más (hub de eventos)     |
| `/(tabs)/contigo`               | Contigo (si el perfil lo tiene) |
| `/(tabs)/contigo/evangelio`     | Evangelio del día        |
| `/(tabs)/contigo/oracion`       | Oración                  |
| `/(tabs)/contigo/revision`      | Revisión                 |
| `/(tabs)/contigo/bookmarks`     | Favoritos                |
| `/(tabs)/visitapapa`            | Visita del Papa (si activo) |
| `/notifications`                | Centro de notificaciones |
| `/wordle`                       | Wordle (dormido — no usar) |

> Ojo: la visibilidad de tabs como `contigo`, `visitapapa` o `cancionero` depende
> del **perfil** del usuario (`/profileConfig`). Si una notificación apunta a una tab
> que ese perfil no tiene, la navegación puede no llevar a ningún sitio. Para algo
> universal, usa `/(tabs)/index`, `/(tabs)/calendario`, `/(tabs)/fotos` o `/(tabs)/mas`.

### Alias que la app traduce automáticamente (compatibilidad)

| Lo que manda el Panel  | A dónde va realmente |
| ---------------------- | -------------------- |
| `/(tabs)/actividades`  | `/(tabs)/mas`        |
| `/(tabs)/jubileo`      | `/(tabs)/mas`        |
| `/(tabs)/albums`       | `/(tabs)/fotos`      |
| `/(tabs)/wordle`       | `/wordle`            |
| `/(tabs)/notifications`| `/notifications`     |

### ¿"jubileo" sigue existiendo como ruta propia?

No. Jubileo (y cualquier evento/actividad) **ya no es una tab**. Vive dentro del
stack de **"Más"** (`app/screens/EventHomeScreen.tsx`), al que se llega navegando a
`/(tabs)/mas` y seleccionando el evento (param `eventId`, p. ej. `jubileo`,
`visitapapa26`). En Firebase los eventos están bajo `activities/<nombre>/` (y el
legacy `jubileo/`).

### Deep link a UNA actividad/evento concreto (`data.eventId`)

**Disponible desde 2026-07-07.** El Panel puede enviar `data.eventId` con el id
del evento en el registry de la app (`constants/events.ts`), p. ej. `jubileo` o
`visitapapa26` (el mismo id que el sufijo del topic `event-<id>`). Al tocar la
notificación, la app abre el **hub de ese evento**:

- Evento con tab propia (p. ej. `visitapapa26` → `visitapapa`) → abre su tab.
- Evento sin tab propia (p. ej. Jubileo, archivado) → abre "Más".
- Id no registrado en la app → se ignora y se cae al comportamiento normal
  (centro de notificaciones o `internalRoute`).

`data.eventId` **tiene prioridad** sobre `internalRoute` cuando resuelve.
Además, el modal de detalle in-app muestra un botón "Ir a <evento>". El evento
debe existir en `constants/events.ts` (crear el nodo en `/activities` NO basta,
ver regla de oro 5 en `mcmpanel/CLAUDE.md`). Implementación app:
`utils/notificationEventRoute.ts`. En el composer del panel: opción "🎉 Abrir un
evento…" del selector de acción al tocar.

## 3. Categorías / botones de acción

### (b) Categorías iOS registradas (`setNotificationCategoryAsync`)

`mcm-app/notifications/NotificationHandler.ts` (solo iOS):

| `categoryId` | Botón (identifier → título) | Al pulsar navega a |
| ------------ | --------------------------- | ------------------ |
| `general`    | `view` → "Ver"              | `/notifications`   |
| `eventos`    | `view_event` → "Ver Evento" | `/(tabs)/calendario` |
| `fotos`      | `view_photos` → "Ver Fotos" | `/(tabs)/fotos`    |

**Recomendación (mejora del Panel):** `categoryId` solo sirve para los **botones de
acción del sistema iOS**. No lo igualéis a la categoría de negocio. Mandad:

- `categoryId` ∈ `{ general, eventos, fotos }` **solo** cuando queráis esos botones
  nativos. Cualquier otro id se ignora (sin error).
- La categoría de negocio va en `data.category` (etiqueta, ver §6).

> Nota: el contrato manda `evento` (singular); la categoría iOS registrada es
> `eventos` (plural). Si queréis el botón "Ver Evento", usad `eventos`.

### `actionButtons` — varios botones (hasta 3)

La app soporta **hasta 3 botones de acción** por notificación. El formato canónico
recomendado es el array `data.actionButtons`:

```jsonc
"data": {
  "actionButtons": [
    {
      "text": "Apuntarme",
      "url": "https://mcmespana.com/inscripcion", // o ruta interna: "/(tabs)/fotos"
      "isInternal": false                          // true = navega dentro de la app
    },
    { "text": "Ver fechas", "url": "/(tabs)/calendario", "isInternal": true }
  ]
}
```

Reglas que aplica la app (`utils/notificationRoutes.ts` → `extractActionButtons`):

- **Máximo 3** botones (`MAX_ACTION_BUTTONS`). Si mandáis más, se usan los 3 primeros.
- Cada botón necesita **`url`** (los que no la tengan se descartan).
- `text` por defecto `"Ver"` si falta. `isInternal` se **infiere** si no viene:
  interno cuando la `url` NO empieza por `http(s)://`.
- **Render**: en la tarjeta, un chip por botón; en el modal, botones apilados (el
  1.º primario, los siguientes secundarios).

**Compatibilidad (legacy):** sigue aceptándose el objeto único `data.actionButton`
(equivale a un array de uno). Si llegan **ambos**, se combinan y se deduplica por
`url|text`. Para envíos nuevos, **usad siempre `actionButtons` (array)**, aunque sea
de un solo botón.

`internalRoute` (sección asociada) y `actionButtons` (CTA explícitos) son
complementarios — ver `NOTIFICACIONES.md` §"Arquitectura de botones y navegación".

> ⚠️ Estos botones son **in-app** (tarjeta + modal del centro de notificaciones).
> Los botones de la notificación del **sistema iOS** dependen de las *categorías*
> pre-registradas (`categoryId`, ver tabla arriba) y NO se pueden generar
> dinámicamente desde el payload.

## 3.bis. Texto del cuerpo: `body` y `bodyLong` (descripción extendida)

La app maneja dos campos de texto para el cuerpo:

| Campo          | Dónde se ve                          | Límite recomendado |
| -------------- | ------------------------------------ | ------------------ |
| `body`         | Push + tarjeta (recortada a 2 líneas) | 200 chars (como hoy) |
| `bodyLong`     | Solo modal de detalle (scrollable)   | ~2000 chars (blando) |

Comportamiento en la app (`app/notifications.tsx`):

- El modal de detalle muestra **`bodyLong` si existe; si no, `body`** (fallback).
- La **tarjeta** sigue mostrando siempre `body` (corto). `bodyLong` NUNCA se usa en
  la tarjeta ni en la push del sistema.
- `bodyLong` respeta saltos de línea (`\n`). No se renderiza HTML/BBCode (texto plano).

Dónde mandarlo:

- **Recomendado**: incluid `bodyLong` en `data.bodyLong` **y** en el registro de
  Firebase `/notifications/{id}`. Así está disponible tanto en foreground (desde la
  push) como al abrir desde Firebase.
- **Si el texto fuese muy largo** (cerca de reventar el payload ~4 KB de APNs/FCM):
  podéis mandar `bodyLong` **solo en Firebase** y omitirlo del `data` de la push. La
  app lo recupera igualmente del registro de Firebase (la deduplicación rellena
  `bodyLong` desde ahí aunque no viniera en la push). El `body` corto sí debe ir
  siempre en la push.

> ¿Por qué un tope blando de ~2000 y no "ilimitado"? Porque `data` cuenta contra el
> límite de ~4 KB del payload de la push. 2000 chars deja margen de sobra. En la UI
> no hay tope (es scroll), y Firebase admite strings enormes.

## 4. Imagen

- **Android**: la imagen de `richContent.image` se muestra en la notificación del
  sistema automáticamente. ✅
- **iOS**: **NO** hay Notification Service Extension configurada. `mutableContent` +
  `richContent.image` **no** adjuntan imagen a la notificación del sistema. La imagen
  solo aparece **dentro de la app** (modal de detalle) leyendo **`data.imageUrl`**. ⚠️
- **Acción**: enviad siempre `data.imageUrl` (es lo que usa la app). Añadir NSE en
  iOS es una mejora futura (requiere build nativo, no OTA).

## 5. Icono (`data.icon`)

Se usa **solo dentro de la app**: la tarjeta del centro de notificaciones pinta
`data.icon` como miniatura. iOS/Android no lo usan en la notificación del SO. Es
opcional.

## 6. Categoría de negocio (`data.category`)

Se **guarda** y, desde 2026-07-07, la app pinta un **chip de color con icono** en
la tarjeta del centro de notificaciones y en el modal de detalle (helper
`utils/notificationCategory.ts`). No rechaza valores desconocidos.

**Cuándo se ve el chip:** solo para las categorías con significado propio. La
categoría `general`, la ausente y cualquier valor desconocido **no** pintan chip
(para no llenar la lista de ruido). Es puramente visual: no filtra ni agrupa
todavía.

Vocabulario que entiende el tipo de la app (`types/notifications.ts`):
`general`, `eventos`, `cancionero`, `fotos`, `urgente`, `mantenimiento`,
`celebraciones`. De estas, pintan chip todas menos `general`.

> El contrato usaba `evento`/`actividad`/`jubileo`/`cantoral`. Para no divergir,
> recomendamos converger al vocabulario de arriba (p. ej. `eventos` en vez de
> `evento`, `cancionero` en vez de `cantoral`). Como es solo una etiqueta sin efecto
> visual todavía, no es bloqueante. Colorear/iconizar por categoría queda como mejora.

## 7. Registro de tokens (`/pushTokens`)

### (d) Campos que la app guarda HOY por dispositivo

`mcm-app/services/pushNotificationService.ts` → `buildTokenData`:

```jsonc
"/pushTokens/token_<tokenSaneado>": {
  "token": "ExponentPushToken[...]",
  "platform": "ios" | "android" | "web",
  "registeredAt": "2026-06-02T10:00:00.000Z",
  "lastActive":   "2026-06-02T10:05:00.000Z",  // heartbeat cada 5 min → activos 24h/7d
  "appVersion": "2.0.0",
  "deviceInfo": { "model": "...", "osVersion": "..." },
  "profileType": "familia" | "monitor" | "miembro" | null,
  "delegationId": "mcm-castellon" | ... | null,
  "topics": ["general", "eventos", "familias", "mcm-castellon"]
}
```

> La clave del nodo es el **propio token saneado** (`token_<...>`), no un deviceId
> aleatorio. Así una reinstalación no deja tokens huérfanos.

### Corrección al contrato (el Panel está equivocado aquí)

| Contrato (incorrecto) | Real en la app | Notas |
| --------------------- | -------------- | ----- |
| `userType: "joven"\|"responsable"` | `profileType: "familia"\|"monitor"\|"miembro"\|null` | otros valores |
| `delegacion: "Castellón"` | `delegationId: "mcm-castellon"` (slug) | es un **id**, no el nombre |
| — | `topics: string[]` | **campo clave de segmentación** (no estaba en el contrato) |

**Cómo segmentar (recomendado): usad `topics`.** Es un array **pre-computado** =
union de los `notificationTopics` del perfil + el `notificationTopic` de la
delegación + los topics `event-<id>` de los **eventos a los que el usuario se ha
suscrito** (opt-in, ver §7.bis). Segmentad con "el array `topics` contiene X".
Ejemplos:

- Todos → `general`
- Solo monitores → `monitores`
- Solo Castellón → `mcm-castellon`
- Familias de Madrid → `familias` **y** `mcm-madrid`
- Suscritos al Jubileo → `event-jubileo`

**Valores válidos de `profileType`:** `familia`, `monitor`, `miembro`.

**Valores válidos de `delegationId`** (de `firebase-seed/profileConfig.json`):
`mcm-espana`, `mcm-benicarlo-vinaros`, `mcm-burriana`, `mcm-caravaca`,
`mcm-castellon`, `mcm-espinardo`, `mcm-granada`, `mcm-lalcora`, `mcm-madrid`,
`mcm-nules`, `mcm-onda`, `mcm-quintanar`, `mcm-vila-real`, `mcm-villacanas`,
`mcm-zaragoza`, `internacional`.

**Topics conocidos** (`constants/profileCatalog.ts`): `general`, `eventos`,
`familias`, `monitores`, `miembros`, `mcm-castellon`, `mcm-madrid` (las delegaciones
añaden el suyo dinámicamente).

> Dispositivos antiguos / sin onboarding tendrán `profileType: null`,
> `delegationId: null`, `topics: []` (o `["general"]`). Si filtráis por topic y un
> token no lo tiene, no le llega: para envíos masivos, segmentad por `general` o
> tratad "sin topic" como "todos" según convenga.

## 7.bis. Suscripción a eventos (topics `event-<id>`)

**Problema que resuelve:** hasta ahora, un aviso de un evento concreto (Jubileo,
un encuentro, un retiro…) salía al topic `eventos`, que **todos** los onboarded
tienen → le llegaba a todo el mundo. Ahora la app permite **suscribirse opt-in a
un evento**.

**Cómo funciona en la app:**

- En el hub de cada evento (`EventHomeScreen`) hay una **campana** de
  suscripción. La primera vez que se abre un evento, además, se ofrece
  suscribirse con una tarjeta ("¿Recibir avisos de este evento?").
- Al suscribirse, la app añade el topic **`event-<eventId>`** al array
  `topics` de `/pushTokens/{id}` (p. ej. `event-jubileo`). Al desuscribirse, lo
  quita. El cambio se escribe en Firebase **al instante** (no espera al
  heartbeat).
- El `eventId` es el **id del evento en el registry de la app**
  (`constants/events.ts`) — el mismo que ya usáis como nodo en Firebase: para
  Jubileo es `jubileo`; para eventos del panel es el nombre bajo
  `activities/<nombre>` (p. ej. `activities/evento2027` → `event-evento2027`).

**Qué tiene que hacer el Panel:**

1. **Para avisar de un evento concreto, segmentad por `event-<id>`**, NO por
   `eventos`. Ej.: aviso del Jubileo → `topics array-contains 'event-jubileo'`.
   Así solo le llega a los suscritos.
2. El topic `eventos`/`general` queda para avisos **transversales** ("hay
   novedades en la app"), no para un evento puntual.
3. En el composer, junto al selector de perfil/delegación, añadid un **selector
   de evento** que fije el topic `event-<id>`. Combinable con perfil/delegación
   (intersección o unión, a vuestro criterio).
4. **Recuento de suscritos**: contad los tokens de `/pushTokens` cuyo `topics`
   contenga `event-<id>`. (Opcional: la app puede mantener un índice inverso
   `/eventSubscriptions/{eventId}/{tokenId}` si os hace falta un contador barato
   — pedidlo y se añade.)

> Convención del id de topic: `event-` + `eventId` tal cual (kebab/slug). No
> añadáis prefijos `activities/`; el id del evento ya es el slug final.

## 7.ter. Filtrado del historial in-app por `audience`

La app pinta el nodo `/notifications` completo en el centro de notificaciones (la
campana), no solo lo que llegó como push a ESE dispositivo. Para que un aviso
segmentado ("solo monitores de Madrid") **no** lo vea cualquiera que abra la
campana, la app filtra cada registro contra el usuario actual usando el objeto
`audience` que el Panel ya guarda en el registro (`/notifications/<id>.audience`,
ver `api/_lib/push.ts → dispatchNotification`).

- El match replica exactamente la semántica de envío del Panel
  (`mcmpanel/src/lib/audience.ts → tokenMatchesAudience`): 4 ejes
  (`todos`/`perfiles`/`delegaciones`/`eventId`) combinados con `match`
  (`all` = AND, `any` = OR). El "usuario" es `profileType` + `delegationId` +
  la unión de `notificationTopics` (perfil/delegación) y los topics
  `event-<id>` de las suscripciones opt-in — la MISMA metadata que se guarda en
  `/pushTokens`. Así, un registro visible en la campana es exactamente uno que
  ese dispositivo habría recibido como push.
- **Registro sin `audience` (o con `audience: null` / sin ejes activos) → visible
  para todos.** Esto preserva el histórico anterior a la segmentación.
- **Qué debe hacer el Panel:** seguir escribiendo `audience` en el registro tal
  cual hasta ahora. Ningún cambio nuevo. Si algún día se envía sin `audience`,
  el aviso se considera "para todos" en la campana.
- Implementación app: `utils/notificationAudience.ts` (lógica pura + tests en
  `__tests__/notificationAudience.test.ts`), aplicada en
  `contexts/NotificationsContext.tsx` (lista visible **y** contador del badge).

## 8. (c) Channels Android

Solo uno, creado en runtime (`usePushNotifications.ts`):

| `channelId` | Nombre              | Importancia |
| ----------- | ------------------- | ----------- |
| `default`   | "Notificaciones MCM" | `MAX` (heads-up) |

El Panel puede (a futuro) mandar `channelId`, pero hoy solo existe `default`. Crear
channels por prioridad/tipo (p. ej. `urgente`) es una mejora futura (ver §Mejoras).

## 9. Prioridad

La app **no** lee `priority` para configurar nada por notificación. En Android el
"heads-up" lo decide la **importancia del channel** (`MAX`), así que **todas** salen
como heads-up independientemente de `priority`. `priority` (top-level) sí lo usa Expo
para la **velocidad de entrega** (FCM). Para diferenciar visualmente `high` vs
`normal` haría falta channels separados (mejora futura).

> Detalle menor: el tipo de la app usaba `high|normal|low`; Expo/top-level usa
> `default|normal|high`. Mantened `default|normal|high` en el campo top-level.

---

## (e) Resumen: qué procesa la app y qué ignora

| Campo del payload        | ¿Se procesa? | Cómo |
| ------------------------ | ------------ | ---- |
| `title` / `body`         | ✅ | Notificación + tarjeta (body recortado a 2 líneas) |
| `data.bodyLong`          | ✅ | Descripción extendida en el modal de detalle (scroll); fallback a `body` |
| `sound`                  | ✅ | Sonido (foreground y SO) |
| `priority` (top-level)   | 🟡 | Solo entrega (FCM). Display fijo por channel MAX |
| `categoryId`             | 🟡 | Solo iOS, ids `general`/`eventos`/`fotos`; resto ignorado |
| `richContent.image`      | 🟡 | Android sí; **iOS no** (sin NSE) |
| `mutableContent`         | 🟡 | iOS lo ignora en la práctica (sin NSE) |
| `data.id`                | ✅ | **Crítico**: dedup / marca leído |
| `data.internalRoute`     | ✅ | Navegación (con normalización + alias) |
| `data.eventId`           | ✅ | Deep link al hub del evento (prioritario sobre internalRoute) |
| `data.actionButtons[]`   | ✅ | **Hasta 3** CTA en tarjeta + modal (formato recomendado) |
| `data.actionButton`      | ✅ | Legacy (un botón) → se trata como array de uno |
| `data.imageUrl`          | ✅ | Imagen en el modal de detalle in-app |
| `data.icon`              | ✅ | Miniatura en la tarjeta in-app |
| `data.category`          | ✅ | Chip de color + icono en tarjeta y modal (salvo `general`) |
| `data.priority`          | ❌ | No se usa (usad el top-level) |

✅ procesa · 🟡 parcial/limitado · ❌ ignora

---

## Cambios ya aplicados en la app (esta entrega)

- `utils/notificationRoutes.ts` (nuevo): `normalizeNotificationRoute()` con mapa de
  **alias** para rutas heredadas del Panel, y `extractActionButton()` que acepta
  `actionButton` (objeto) **y** `actionButtons` (array).
- `notifications/usePushNotifications.ts`: usa ambos helpers; **fix** del action iOS
  `view` que apuntaba a `/(tabs)/notifications` (inexistente) → `/notifications`.
- `services/pushNotificationService.ts`: el historial de Firebase normaliza
  `actionButtons[]` → `actionButton`.
- `app/notifications.tsx`: la normalización de rutas (chips/navegación) usa el helper
  compartido (alias incluidos).
- Tests: `__tests__/notificationRoutes.test.ts`.

Todo es **JS puro → compatible con OTA** (sin código nativo, sin `[skip-ota]`).

## Mejoras futuras sugeridas (requieren build nativo o trabajo nuevo)

1. **NSE iOS** para imagen en la notificación del sistema (`richContent.image`). Nativo → `[skip-ota]`.
2. **Deep link a un evento concreto** (`/(tabs)/mas` + `eventId` por parámetro de ruta).
3. **Channels Android por tipo/prioridad** (`urgente`, `eventos`) para heads-up/sonido diferenciados.
4. **Usar `data.category`** para color/icono/agrupación en el centro de notificaciones.
