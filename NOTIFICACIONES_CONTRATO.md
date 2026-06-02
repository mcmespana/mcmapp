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
3. **Botón de acción**: el contrato manda `data.actionButtons` (array). La app usa
   `actionButton` (objeto con `isInternal`). La app ya **acepta ambos**, pero el
   formato canónico recomendado es el objeto singular con `isInternal`.
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

### Deep link a UNA actividad concreta

**Hoy no hay** un deep link estable tipo `/(tabs)/mas/evento/<id>`. El destino
navegable es `/(tabs)/mas`. Abrir directamente un evento por `id/slug` requeriría
trabajo nuevo en la app (registrar una ruta con parámetro y propagar `eventId`).
Si el Panel lo necesita, lo dejamos como mejora pendiente — ver §"Mejoras".

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

### `actionButtons` vs `actionButton`

La app trabaja con un **único** `actionButton`:

```jsonc
"data": {
  "actionButton": {
    "text": "Ver novedades",
    "url": "https://mcmespana.com/x",   // o ruta interna: "/(tabs)/fotos"
    "isInternal": false                  // true = navega dentro de la app
  }
}
```

La app **ya acepta también** `data.actionButtons: [{ text, url }]` (usa el primer
elemento) e infiere `isInternal` (interno si la `url` no empieza por `http`). Aun así,
**el formato canónico recomendado es el objeto singular con `isInternal` explícito.**

`internalRoute` (sección asociada) y `actionButton` (CTA explícito) son
complementarios — ver `NOTIFICACIONES.md` §"Arquitectura de botones y navegación".

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

Se **guarda** en la notificación local, pero **hoy no dispara** color/icono/filtro/
agrupación en la UI (es una etiqueta a futuro). No rechaza valores desconocidos.

Vocabulario que entiende el tipo de la app (`types/notifications.ts`):
`general`, `eventos`, `cancionero`, `fotos`, `urgente`, `mantenimiento`,
`celebraciones`.

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
delegación. Segmentad con "el array `topics` contiene X". Ejemplos:

- Todos → `general`
- Solo monitores → `monitores`
- Solo Castellón → `mcm-castellon`
- Familias de Madrid → `familias` **y** `mcm-madrid`

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
| `title` / `body`         | ✅ | Notificación + tarjeta |
| `sound`                  | ✅ | Sonido (foreground y SO) |
| `priority` (top-level)   | 🟡 | Solo entrega (FCM). Display fijo por channel MAX |
| `categoryId`             | 🟡 | Solo iOS, ids `general`/`eventos`/`fotos`; resto ignorado |
| `richContent.image`      | 🟡 | Android sí; **iOS no** (sin NSE) |
| `mutableContent`         | 🟡 | iOS lo ignora en la práctica (sin NSE) |
| `data.id`                | ✅ | **Crítico**: dedup / marca leído |
| `data.internalRoute`     | ✅ | Navegación (con normalización + alias) |
| `data.actionButton`      | ✅ | CTA en tarjeta + modal |
| `data.actionButtons[]`   | ✅ | Aceptado (usa el primero) → mapeado a `actionButton` |
| `data.imageUrl`          | ✅ | Imagen en el modal de detalle in-app |
| `data.icon`              | ✅ | Miniatura en la tarjeta in-app |
| `data.category`          | 🟡 | Se guarda; sin efecto visual todavía |
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
