# Plan — Live Activities (iOS) y su equivalente en Android

> **Por qué hacen falta `expo-widgets` y `@expo/ui` aunque esto «no sea un
> widget».** En iOS, Apple obliga a que una Live Activity viva dentro de una
> _extensión de widgets_ (es la misma pieza técnica que los widgets de la
> pantalla de inicio), y `expo-widgets` es la librería oficial de Expo que crea
> esa extensión y la arranca desde JS. `@expo/ui` es con lo que se **dibuja**
> lo que sale en la pantalla de bloqueo y en la Dynamic Island.

> Objetivo: una **base nativa común** para tener algo de la app «vivo» en la
> pantalla de bloqueo (iOS: Live Activity + Dynamic Island; Android:
> notificación fija) y **dos usos** encima:
>
> - **Uso A — «La sesión de hoy»** (monitores; lo que más importa): un
>   **coordinador de etapa** publica en la app la sesión de hoy (título, horas
>   y un **enlace o un documento**) y **a todos los monitores de sus grupos**
>   les sale la Live Activity; al tocarla, se abre el **PDF**, que la app ya se
>   ha bajado y guarda para abrirlo sin red. Se acabó buscarlo en WhatsApp.
> - **Uso B — «Horario del evento»**: durante un encuentro o retiro, «ahora» y
>   «siguiente» del horario en la pantalla de bloqueo. Local, sin servidor.
>
> Escrito el 2026-11-16; **rehecho el mismo día** con las respuestas del
> usuario (el Uso A pasa de «cada monitor pega su enlace» a «coordinación
> publica para todos»). **Estado: 🔵 propuesta, decisiones contestadas salvo
> las 🔒 nuevas del final.** Todo lo de iOS es nativo (build de tienda, commit
> `[skip-ota]`); lo que es solo JS se marca.

---

## 0. Resumen

1. **Librería iOS: `expo-widgets ~58.0.28` + `@expo/ui ~58.0.28`** (oficiales
   de Expo, versionadas con el SDK). Crean la extensión y el App Group en el
   prebuild y **son las mismas que servirán para los widgets de Contigo**.
   Hoy no están instaladas (en el `package-lock.json` solo salen como
   dependencias _opcionales_ de `expo-router` y del preset de Babel).
2. **Android: sin paquete nuevo.** Notificación local fija (`sticky`) de
   `expo-notifications`. _Live Updates_ de Android 16: **más adelante**
   (contestado).
3. **Uso A**: coordinación publica «la sesión de hoy» en **Comunica** (el
   middleware), con el mismo patrón que «Recordar que pasen lista»
   (`RollReminderSheet` → `POST /v1/coordination/roll-reminders`): elige
   grupos de su alcance y a sus monitores les llega. La app de cada monitor
   **convierte el enlace en PDF y se lo baja** (Google Docs/Slides/Sheets
   públicos, Drive, PDF directo); si no puede, abre el enlace tal cual.
4. **Cómo «les sale a todos»**, en dos escalones:
   - **(a) mínimo**: push normal «Sesión de hoy: tócala para tenerla a mano»
     (Expo Push, el que ya usa el middleware) que al tocarla abre la app, baja
     el PDF y arranca la actividad; **y arranque automático al abrir la app**
     si hay una sesión publicada vigente.
   - **(b) después: push-to-start real**: la Live Activity aparece sola en la
     pantalla de bloqueo sin abrir la app. **Es viable con `expo-widgets` 58**
     (`addPushToStartTokenListener`, iOS 17.2+), pero exige que el servidor
     hable **directamente con APNs** con una clave `.p8` (Expo Push no sirve).
5. **Que el monitor pegue su propio enlace** queda como opción secundaria,
   local, sin servidor.
6. **Expo 58 ya está hecho**: `main` está en SDK 58 desde el 31/10 y la 2.5.1
   (SDK 58) está publicada en las tiendas. **No falta nada para empezar**; esto
   va en la **siguiente build de tienda** (2.6.0, con `runtimeVersion` nueva).
   Detalle en §7.

---

## 1. Lo que hay hoy en el repo y condiciona el plan

| Pieza                                                                                                                                                                                                                               | Qué implica                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mcm-app/package.json`: `expo ~58.0.22`, RN 0.88.1; `app.json`: `version`/`runtimeVersion` 2.5.1                                                                                                                                    | El SDK 58 ya está en `main` y en tiendas. Las librerías se eligen para **58**.                                                                                                                                                                                                          |
| `services/comunica/contract.ts`: `Me.roles` (`monitor` · `coordination` · `accompaniment` · `member` · `guardian`) y `Me.scope` (`'delegation'` o `{ stages, segments }`)                                                           | El middleware ya sabe **quién coordina qué etapa**. Es lo que decide quién puede publicar y a quién le llega. Firebase no lo sabe.                                                                                                                                                      |
| `components/comunica/coordinacion/SummaryScreen.tsx` + `RollReminderSheet.tsx` → `POST /v1/coordination/roll-reminders` (`RollReminderWrite { clientId, groupIds ≤ 60, message ≤ 120 }`, respuesta `{ monitors, reached, recent }`) | **El patrón exacto** «coordinación → todos los monitores de sus grupos»: coordinación elige grupos de su alcance en el Resumen, el servidor comprueba el alcance (403 si no), busca los monitores, mira sus móviles y manda el aviso; contesta a cuántos ha llegado. El Uso A lo copia. |
| `POST /v1/devices` / `DELETE /v1/devices/:id` (área nativa, plan 08)                                                                                                                                                                | El middleware ya guarda **un token de Expo Push por móvil y persona** y ya manda pushes. El escalón (a) no necesita nada nuevo de push; el (b) añade un token más por móvil.                                                                                                            |
| `docs/funcionalidades/NOTIFICACIONES.md`                                                                                                                                                                                            | Las push de la app van por **Expo Push API** (que por debajo usa APNs/FCM con las credenciales que gestiona EAS, `eas credentials`). **Para push-to-start de una Live Activity hay que hablar con APNs directamente** (§5.4).                                                           |
| `services/comunica/contract.ts`: `SessionSummary {id, eventId, date, startsAt, endsAt, kind}` y `Meeting {session, name, durationHours, rollCall}`                                                                                  | Una sesión trae nombre y horas, **ningún material**. Sirve para **rellenar título y horas** al publicar.                                                                                                                                                                                |
| `services/comunica/uploads.ts` + `POST /v1/me/documents`                                                                                                                                                                            | El middleware ya acepta ficheros subidos desde el móvil (títulos y certificados). Subir un PDF de sesión es el mismo mecanismo.                                                                                                                                                         |
| `services/comunica/eventFiles.ts` + `components/comunica/documentos/FileViewerScreen.tsx`                                                                                                                                           | Visor propio: PDF en WebView (iOS), imagen con `expo-image`. **Borra la copia al cerrarse** (documentos sensibles). El Uso A necesita una copia que **persista** hasta el fin de la sesión: carpeta propia y opción «no borres».                                                        |
| `expo-file-system`, `expo-clipboard`, `expo-document-picker`, `expo-intent-launcher`, `expo-web-browser`, `expo-sharing`                                                                                                            | Todo ya instalado: descargar, pegar, elegir fichero y abrir PDF en Android no necesita paquetes nuevos.                                                                                                                                                                                 |
| `plugins/withNotificationServiceExtension.js` + `targets/notification-service/`                                                                                                                                                     | Ya hay **una extensión iOS** (la NSE). Bundle id nuevo ⇒ perfil nuevo ⇒ **EAS pregunta por terminal la primera vez**. `app.json` → `extra.eas.build.experimental.ios.appExtensions` la lista a mano.                                                                                    |
| `eas.json`: `EXPO_NO_CAPABILITY_SYNC=1`                                                                                                                                                                                             | EAS **no** da de alta capacidades en Apple: el **App Group** se crea a mano en el portal (Fase 0).                                                                                                                                                                                      |
| `app.json` → `scheme: "mcmapp"`; `app/+native-intent.ts`                                                                                                                                                                            | El toque en la actividad abre `mcmapp://…`. Hoy cualquier `file://`/`content://` va al cantoral (`.mcm`): hay que separar los PDF si se hace «Abrir con…» (opción secundaria).                                                                                                          |
| `app/screens/HorarioScreen.tsx`, `firebase-seed/eventos/jubileo-2025/jubileo-horario.json`                                                                                                                                          | Horario: `[{ fecha, titulo, eventos: [{ hora: "08:40", nombre, lugar?, icono? }] }]`, sin hora de fin y con `"??"` posibles. Base del Uso B.                                                                                                                                            |
| `notifications/usePushNotifications.ts` (`data.internalRoute`)                                                                                                                                                                      | Patrón para que un push abra una ruta interna. El push del Uso A lo usa; la notificación fija de Android **no** entra en el buzón.                                                                                                                                                      |

---

## 2. Librerías: comparación y elección

Comprobado el 2026-11-16 contra npm y la documentación (no de memoria).

| Opción                                                                              | Versión hoy                         | iOS (Live Activity)                                                                                                                                                                                                                                         | Android                                         | Encaje                                                                                            |
| ----------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **[`expo-widgets`](https://docs.expo.dev/versions/v58.0.0/sdk/widgets/)** (Expo) ⭐ | `58.0.28`; recomendado `~58.0.28`   | ✅ `createLiveActivity(name, layout)` → `start(props, url?, staleDate?)`, `update`, `end`, `getInstances()`, `getPushToken()`, `addPushTokenListener`, **`addPushToStartTokenListener` (push-to-start, iOS 17.2+)**. Layout en TSX con `@expo/ui/swift-ui`. | Solo widgets de inicio. Nada de notificaciones. | Versionada con el SDK. El plugin crea target + App Group. Misma pieza que los widgets de Contigo. |
| [Voltra](https://www.use-voltra.dev/) (Callstack)                                   | `2.4.0`                             | ✅ completo, con push y canales                                                                                                                                                                                                                             | ✅ notificaciones _ongoing_ + Live Updates      | Versionado propio. **Plan B** si `expo-widgets` falla en la Fase 0.                               |
| [`expo-live-activity`](https://github.com/software-mansion-labs/expo-live-activity) | `0.4.2`, **deprecada (1-jun-2026)** | Remite a `expo-widgets`                                                                                                                                                                                                                                     | —                                               | ❌                                                                                                |
| [`@bacons/apple-targets`](https://github.com/EvanBacon/expo-apple-targets)          | `5.0.0`                             | Solo crea el target; Swift a mano                                                                                                                                                                                                                           | —                                               | No compensa.                                                                                      |

### Elegida: `expo-widgets` (+ `@expo/ui`) en iOS; `expo-notifications` en Android

- **Va con el SDK** (`expo install --fix` la sube). Voltra no.
- **Abre la puerta a los widgets de Contigo** con el mismo plugin y App Group.
- **Android no necesita librería**: la notificación `sticky` de
  `expo-notifications` es solo JS.

Lo que hay que saber de `expo-widgets` (doc de SDK 58):

- El layout es una función TSX con la directiva `'widget'` que se compila aparte
  y corre aislada: **sin hooks, sin imports, sin nada de fuera de la función**.
  Todo llega por `props`. ⇒ Guardarraíl en test.
- Regiones: `banner` (bloqueo), `compactLeading`, `compactTrailing`, `minimal`
  y las expandidas de la Dynamic Island. En iOS 17+ la raíz necesita
  `containerBackground`.
- `enablePushNotifications` (por defecto `false`) añade el entitlement
  `aps-environment` y `ExpoWidgets_EnablePushNotifications` al `Info.plist`.
  Solo hace falta para el escalón (b).
- La doc no menciona `NSSupportsLiveActivities`: se pone a mano en `app.json`.
- **Lo que la doc NO aclara** (se comprueba en la Fase 0 con un iPhone): cómo
  lleva su enlace una actividad **arrancada por push** (el `url` de `start()`
  solo existe al arrancar desde la app). Plan: que el layout ponga el enlace
  él mismo a partir de un `id` de `props` (`widgetURL`/`Link` de `@expo/ui`) y
  que, si eso no funciona en la Dynamic Island, el toque abra la app en
  `mcmapp://a-mano` sin `id` y la app abra la sesión vigente.

Límites de Apple ([ActivityKit](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities)):

- Una Live Activity **solo se arranca con la app en primer plano, o por
  push-to-start (iOS 17.2+)**.
- Vive hasta **8 h** activa (+ hasta 4 h en el bloqueo). `props` ≤ **4 KB**.
- El toque **solo abre la propia app**: nunca Google Docs ni Safari directo.
- El usuario puede desactivarlas en Ajustes: comprobarlo antes de prometer.
- Sin la app corriendo no se puede actualizar ni terminar en local: solo
  `staleDate` y el tope de 8 h. La cuenta atrás nativa sí avanza sola.

---

## 3. Arquitectura

```
COORDINACIÓN (app)                         MIDDLEWARE (comunicaMiddleware)
Resumen → «Sesión de hoy»  ──POST──►  /v1/coordination/session-materials
  título, horas, grupos,               · comprueba alcance (como roll-reminders)
  enlace o PDF subido                  · guarda en Supabase (+ el PDF en Storage)
                                       · (a) Expo Push a los monitores de esos grupos
                                       · (b) push-to-start por APNs (.p8), iOS 17.2+
                                                     │
MONITOR (app) ◄──────────────────────────────────────┘
  · al tocar el push, o al abrir la app: GET /v1/me/session-materials
  · services/aMano/: baja el PDF (enlace → PDF), copia en documentDirectory/a-mano/
  · services/liveActivity/: arranca la actividad (iOS) o la notificación fija (Android)
  · toque en la actividad: mcmapp://a-mano?id=… → app/a-mano.tsx → abre el PDF (sin red)
```

### 3.1 Dónde se guarda «la sesión de hoy»: middleware vs. Firebase

|                        | **Middleware de Comunica** ⭐                                                                              | Firebase (RTDB + Storage)                                                                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ¿Quién puede publicar? | Ya lo sabe: `Me.roles` + `Me.scope` del CRM, y ya lo comprueba en `roll-reminders` (403 fuera de alcance). | No lo sabe. El uid de Firebase no es la ficha del CRM; habría que copiar roles y alcances a Firebase y mantenerlos al día, o abrir la escritura a cualquiera con sesión. |
| ¿A quién le llega?     | Ya sabe qué monitores lleva cada grupo y qué móviles tienen (`/v1/devices`).                               | No sabe quién es monitor de qué grupo.                                                                                                                                   |
| Avisos                 | Ya manda Expo Push a monitores.                                                                            | Habría que montar el envío en `functions/`.                                                                                                                              |
| Fichero                | Ya acepta subidas (`POST /v1/me/documents`); Supabase Storage.                                             | Firebase Storage no está en uso en la app (otra pieza, otras reglas).                                                                                                    |
| Sesión del monitor     | Hace falta sesión de Comunica (los monitores la tienen: pasan lista ahí).                                  | Haría falta login de la app.                                                                                                                                             |
| Coste                  | Trabajo en **otro repo** (endpoints + tabla + almacenamiento).                                             | Trabajo aquí, pero reinventando permisos que ya existen.                                                                                                                 |

**Recomendación: el middleware.** Es lo más simple que **respeta quién puede
publicar**, porque los papeles y los grupos ya viven ahí y el envío a
monitores ya está hecho para los recordatorios de lista. Firebase solo
convendría si el middleware no pudiera tocarse, y entonces cualquiera con
sesión podría publicar.

### 3.2 Contrato propuesto (para `services/comunica/contract.ts` y el middleware)

```ts
// Una sesión publicada por coordinación.
SessionMaterial = {
  id: Id,
  title: string,                 // ≤ 60, «Sesión C2 · La confianza»
  startsAt: string, endsAt: string, // ISO con zona (Madrid)
  groupIds: Id[],                // a quién va (dentro del alcance de quien publica)
  source:
    | { kind: 'link', url: string, docKind: 'gdoc' | 'gslides' | 'gsheet' | 'drive' | 'pdf' | 'link' }
    | { kind: 'file', fileId: Id, name: string, size: number },
  publishedBy: { name: string }, publishedAt: string,
}

POST   /v1/coordination/session-materials   { clientId, title, startsAt, endsAt, groupIds, source }
       → WriteResult & { material, monitors, reached }      // como roll-reminders
POST   /v1/coordination/session-materials/file  (multipart, como /v1/me/documents) → { fileId }
PATCH  /v1/coordination/session-materials/:id   (corregir hora o enlace; vuelve a avisar solo si se pide)
DELETE /v1/coordination/session-materials/:id
GET    /v1/me/session-materials                 // las vigentes para mis grupos (hoy y mañana)
GET    /v1/session-materials/:id/file           // binario, con sesión; solo si va a uno de mis grupos
```

- **No va por la cola** (como los recordatorios): hace falta red y la
  respuesta dice a cuántos ha llegado. `clientId` estable entre reintentos.
- Límite de envío como `roll-reminders` (no repetir aviso a un grupo en 10 min).
- Vigente = `now < endsAt` y `startsAt` es hoy o mañana (Madrid). Se borra sola
  a los 7 días.

### 3.3 Enlace → PDF (en el móvil de cada monitor)

`utils/aMano/pdfUrl.ts` (puro, con tests) traduce el enlace:

| Enlace                                                   | URL de descarga                                             | Funciona si…                                |
| -------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------- |
| `docs.google.com/document/d/<ID>/…`                      | `https://docs.google.com/document/d/<ID>/export?format=pdf` | El documento es «cualquiera con el enlace»  |
| `docs.google.com/presentation/d/<ID>/…`                  | `…/presentation/d/<ID>/export/pdf`                          | Ídem                                        |
| `docs.google.com/spreadsheets/d/<ID>/…`                  | `…/spreadsheets/d/<ID>/export?format=pdf`                   | Ídem                                        |
| `drive.google.com/file/d/<ID>/…` (un PDF subido a Drive) | `https://drive.google.com/uc?export=download&id=<ID>`       | Ídem, y el fichero es PDF                   |
| `https://…/algo.pdf` o respuesta `application/pdf`       | La misma                                                    | Siempre                                     |
| Cualquier otra cosa                                      | —                                                           | No se convierte: se abre el enlace tal cual |

- Descarga con `expo-file-system` (ya instalado) a
  `documentDirectory/a-mano/<id>.pdf`. **Se comprueba que lo bajado es un PDF**
  (cabecera `%PDF`): un documento privado devuelve la página de login de
  Google, y eso **no** se guarda.
- **Si no se puede** (privado, sin red, formato raro): se guarda el enlace y
  al tocar la actividad se abre tal cual (`Linking.openURL`: la app de Google
  si está, si no el navegador). La pantalla lo dice: «No se ha podido guardar
  el PDF; se abrirá el enlace».
- **Comprobación al publicar**: el móvil de coordinación hace la misma
  conversión antes de enviar y, si no sale un PDF, avisa: «Este documento no
  es público: los monitores no podrán tenerlo sin red. Compártelo como
  "cualquiera con el enlace" o sube el PDF».
- **Fichero subido**: se baja de `GET /v1/session-materials/:id/file` con la
  sesión de Comunica (patrón de `eventFiles.ts`), a la misma carpeta.
- La copia se borra cuando la sesión deja de estar vigente y no está en
  «recientes». La copia **no** se borra al cerrar el visor.

### 3.4 Qué viaja a la Live Activity (nada sensible)

```jsonc
{
  "id": "<id de la sesión>", // para el enlace de vuelta
  "title": "Sesión C2 · La confianza", // ≤ 60
  "docLabel": "La confianza.pdf", // solo el nombre visible
  "docKind": "pdf", // pdf | doc | slides | sheet | link
  "offline": true, // ¿hay copia local?
  "startsAt": 1763290800000,
  "endsAt": 1763298000000,
}
```

La URL, la ruta del fichero y los tokens **no viajan nunca** a la actividad ni
al enlace: la app los saca de su almacén por `id`.

### 3.5 Deep link de vuelta

- iOS: `start(props, 'mcmapp://a-mano?id=<id>', staleDate)`. Android:
  `data.internalRoute = '/a-mano?id=<id>'`.
- `app/+native-intent.ts`: `mcmapp://a-mano?…` no es de Comunica y pasa tal cual
  a `app/a-mano.tsx` (ruta raíz, hermana de `panuelo.tsx`). Test en
  `redirectSystemPath`.
- `app/a-mano.tsx` **no exige sesión de Comunica para abrir lo ya bajado**: el
  monitor puede estar en un campamento sin cobertura.

### 3.6 Dónde se abre el documento

| Origen                             | Dónde se abre                                                                                                                           | Sin red       |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| PDF (convertido, directo o subido) | iOS: `FileViewerScreen` en modo «no borres». Android: visor del sistema con `expo-intent-launcher` (la WebView de Android no pinta PDF) | ✅            |
| Enlace que no se pudo convertir    | `Linking.openURL` (app de Google o navegador)                                                                                           | ❌ (se avisa) |

### 3.7 Android

| Uso | Android ≤ 15                                                                                                                                                                          | Android 16+                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| A   | Notificación local `sticky`, canal `a-mano` de importancia baja, sin sonido; toque → `/a-mano?id=`; acción «Terminar». Se pone al tocar el push o al abrir la app (igual que en iOS). | Igual. _Live Updates_ (la píldora) **más adelante** (contestado). |
| B   | Notificación `sticky` con «Ahora · Siguiente», se reescribe al abrir la app.                                                                                                          | Igual.                                                            |

Sin _foreground service_. Android no tiene un equivalente de push-to-start;
la alternativa (que un push de datos ponga la notificación fija con la app
cerrada, con la tarea en segundo plano de `expo-notifications`) se prueba como
espiga en la Fase A3 y solo se usa si funciona con la app cerrada.

---

## 4. Uso A — «La sesión de hoy»

### 4.1 Lo que hace coordinación

1. Entrada: en el **Resumen de grupos** (`SummaryScreen`), junto a la campana
   de «Recordar que pasen lista», un botón **«Sesión de hoy»**. Lo ve quien
   puede mandar recordatorios (mismo criterio; ver 🔒 1). También desde
   `MeetingsScreen` para las reuniones de programación.
2. Hoja `components/aMano/PublicarSesionSheet.tsx` (mismo patrón que
   `RollReminderSheet`):
   - **Grupos**: los de su alcance, todos marcados por defecto («todos los
     monitores de tu etapa»), se pueden quitar.
   - **Título** y **horas**: rellenas desde la sesión del día de esos grupos
     (`SessionSummary.startsAt/endsAt`); editables.
   - **Material**: «Pegar enlace» (`expo-clipboard`) o «Subir PDF»
     (`expo-document-picker`, sube por la ruta de fichero). Comprobación de
     §3.3 con aviso si el enlace no es público.
   - «Publicar» → respuesta «Le ha llegado a 14 de 16 monitores» (como el
     recordatorio).
3. Puede corregir (otra hora, otro enlace) o retirar la sesión. Retirar
   termina la actividad en los móviles la próxima vez que abran la app.

### 4.2 Lo que ve cada monitor

- **Escalón (a)** (primera build):
  - Llega el push «Sesión de hoy: La confianza. Tócala para tenerla a mano».
    Al tocarlo: la app abre `/a-mano?id=…`, baja el PDF, arranca la Live
    Activity (o la notificación fija en Android) y enseña el documento.
  - **Arranque automático al abrir la app**: un componente de fondo
    (`AManoBackground`, junto a `ComunicaBackground` en `app/_layout.tsx`) mira
    `GET /v1/me/session-materials` al volver a primer plano; si hay una
    vigente que aún no está puesta y el monitor no la ha quitado, la baja y la
    arranca. Así basta con abrir la app una vez esa mañana.
  - Si la quita («Terminar»), no vuelve a arrancarse sola esa sesión.
- **Escalón (b)** (cuando se haga): la actividad aparece sola en la pantalla
  de bloqueo de los iPhone con iOS 17.2+, sin abrir la app. **El PDF se baja
  al tocarla** (ese primer toque necesita red; luego queda guardado). Para
  quien abra la app antes, ya estará bajado por el arranque automático.

Layout (iOS): icono por tipo de documento, `title`, «PDF guardado» o «Abre
el enlace», y a la derecha «termina en 1:12» con cuenta atrás nativa.
Dynamic Island compacta: icono y cuenta atrás; mínima: el icono. Colores de
Comunica copiados **literalmente** dentro del layout (no puede importar).

**Caducidad**: `staleDate = endsAt` → «Terminada · toca para cerrar». Al
volver la app a primer plano, si `now > endsAt`, se termina. Una sola
actividad «a mano» a la vez: la nueva sustituye a la anterior.

### 4.3 Opción secundaria: el monitor pega su propio enlace

Para quien no tenga coordinación que publique, o para algo suyo: en Más (y en
la sesión de su grupo en `ComunicaHome`), «Llevar a mano» → hoja con título,
horas y «Pegar enlace» / «Elegir PDF». Mismo almacén, misma conversión, misma
actividad; **sin servidor** y solo en su móvil. Comparte todo el código de la
Fase A1; solo añade la hoja local.

«Recibir el PDF desde WhatsApp con _Abrir con…_» (tipo de documento PDF en
`app.json`, separar `.pdf` de `.mcm` en `+native-intent.ts`) queda para
después de ver si hace falta: con la publicación de coordinación, el monitor ya
no tiene que buscar el PDF.

### 4.4 Lo que NO hace

- No guarda el material en el CRM ni lo enseña a familias.
- No es un repositorio de materiales: una sesión publicada caduca a los 7 días.

---

## 5. Uso B — «Horario del evento» (local, contestado)

### 5.1 Cómo se actualiza

**Local**: la app calcula «ahora/siguiente» y hace `update` cada vez que corre.
Layout que **no miente aunque se quede viejo**: horas absolutas
(«17:00 Eucaristía»), cuenta atrás nativa hasta el siguiente, `staleDate =
next.at` (pasada esa hora, se quita la etiqueta «ahora» y queda la lista con
horas). Caduca a las 8 h; al abrir la app se renueva. El push por canal de
difusión (iOS 18+) queda fuera.

### 5.2 Lógica (solo JS, testeable)

`utils/liveActivity/horarioNowNext.ts`: `(dias, ahora) → { now, next, later[] }`.
Día por `fecha` (hora local del evento); ignora horas no parseables (`"??"`)
para el cálculo sin perderlas en `later`; último del día → «Fin del día ·
mañana 08:40…»; recorte a 4 KB.

### 5.3 Arranque

Interruptor «Ver en la pantalla de bloqueo» en `HorarioScreen` (solo con el
evento en curso). Se para al terminar el último día o con el interruptor.

### 5.4 Servidor para push-to-start (escalón b del Uso A)

- **Cliente**: `enablePushNotifications: true` en el plugin; al arrancar, si
  `isPushToStartEligibleDevice()` (iOS 17.2+), `addPushToStartTokenListener`
  da el token; se manda al middleware junto al de Expo
  (`POST /v1/devices { …, liveActivityStartToken }`). El token rota: se vuelve
  a mandar cuando cambie.
- **Servidor** (middleware, que es quien sabe a quién va): al publicar, por
  cada móvil con ese token, `POST https://api.push.apple.com/3/device/<token>`
  por HTTP/2 con `apns-push-type: liveactivity`,
  `apns-topic: com.familiaconsolacion.mcmapp.push-type.liveactivity`,
  `apns-priority: 10` y un JWT ES256 firmado con una **clave `.p8`** del
  portal de Apple (variable secreta en Vercel). Cuerpo con
  `event: "start"`, `attributes-type`, `attributes`, `content-state` (las
  `props` de §3.4) y **`alert` obligatorio** (sin él, Apple tira el arranque).
  Token que devuelve 410 / `BadDeviceToken` se borra.
- **Expo Push no sirve** para esto: no manda el tipo `liveactivity`. La push
  normal (escalón a) sigue saliendo por Expo a todos, también a Android y a
  iPhone viejos.
- Al iPhone sin iOS 17.2 o sin token le llega solo el push normal del escalón
  (a): nunca se queda sin aviso.
- Detalle de extremo a extremo: blog de Expo «Live Activities with Expo, end
  to end» (1-oct-2026, en Fuentes).

---

## 6. Fases

Cada fase en su commit; las que añaden nativo, con `[skip-ota]`. El JS que
importe `expo-widgets` comprueba que el módulo nativo existe
(`requireOptionalNativeModule`) para que una OTA a binarios viejos no
crashee.

### Fase 0 — Base nativa (iOS + Android)

- **Modelo: Opus.**
- **Archivos**: `package.json` (`npx expo install expo-widgets @expo/ui`);
  `app.json`: plugin `["expo-widgets", { "groupIdentifier":
"group.com.familiaconsolacion.mcmapp", "enablePushNotifications": false }]`
  **después** de `./plugins/withNotificationServiceExtension`,
  `ios.infoPlist.NSSupportsLiveActivities: true`, la extensión en
  `extra.eas.build.experimental.ios.appExtensions`, `version`/`runtimeVersion`
  → 2.6.0; `widgets/` con un layout «hola»;
  `services/liveActivity/{index,ios,android,index.web}.ts` (API común
  `start/update/end/getActive/areEnabled`); canal Android `a-mano`.
- **Comprobaciones** (`npx expo prebuild -p ios --clean` en el Mac): dos
  extensiones (NSE + widgets) con su bundle id; App Group en los dos
  `.entitlements`; `NSSupportsLiveActivities` en el `Info.plist`; la NSE sigue
  enlazando. **Espiga**: un layout con `widgetURL` desde `props` y comprobar
  que el toque abre `mcmapp://a-mano?id=…` desde el bloqueo y desde la Dynamic
  Island (lo necesitará el escalón b).
- **Apple Developer**: alta a mano del App Group en los dos identificadores
  (`EXPO_NO_CAPABILITY_SYNC=1`); la primera build pregunta el perfil de la
  extensión. La lanza el usuario.
- **Tests**: guardarraíl `__tests__/liveActivityLayouts.test.ts` (directiva
  `'widget'`, sin `import`, sin identificadores de módulo); `services/liveActivity`
  con el módulo mockeado (web = no-op; sin módulo = `areEnabled() === false`).
- **Dispositivo**: build de desarrollo en un iPhone real; arrancar y terminar
  la de prueba; la NSE sigue funcionando (push con imagen).

### Fase A0 — Middleware: «sesión de hoy» (`comunicaMiddleware`, otro repo)

- **Modelo: Opus.** Encargo con §3.2 tal cual.
- Tabla `session_materials` en Supabase, ficheros en Supabase Storage,
  comprobación de alcance y búsqueda de monitores **reutilizando la de
  `roll-reminders`**, Expo Push con `data.internalRoute = '/a-mano?id=…'`,
  límite de repetición, borrado a los 7 días. Tests del middleware.
- En **este** repo: el contrato en `services/comunica/contract.ts` y el
  servidor falso (`services/comunica/fake/`) con dos sesiones de ejemplo, para
  que A1 se haga y se pruebe sin esperar al servidor real.

### Fase A1 — Uso A, escalón (a)

- **Modelo: Sonnet.**
- **Archivos**: `utils/aMano/pdfUrl.ts` (puro); `services/aMano/{store,files}.ts`
  (+ `.web.ts`): vigentes, recientes, copias; `components/aMano/PublicarSesionSheet.tsx`
  y su botón en `SummaryScreen` (y `MeetingsScreen`); `app/a-mano.tsx`;
  `components/aMano/AManoBackground.tsx` montado en `app/_layout.tsx`;
  opción «no borrar» en `FileViewerScreen`; exclusión de la notificación fija
  del buzón en `notifications/usePushNotifications.ts`; layout
  `widgets/SesionDeHoy.tsx`; **opción secundaria** «Llevar a mano» local en
  Más y en `ComunicaHome`; entrada escondida tras el **Laboratorio Alpha** la
  primera build (contestado); `docs/funcionalidades/SESION_DE_HOY.md`;
  CHANGELOG.
- **Tests**: `pdfUrl` (Docs, Slides, Sheets, Drive, PDF directo, `http` no,
  otros); comprobación `%PDF` (una página HTML no se guarda); store (vigente,
  caducada, quitada no vuelve, recientes ≤ 5, copias huérfanas);
  `redirectSystemPath('mcmapp://a-mano?id=x')`; la hoja de publicar con el
  servidor falso (grupos por defecto, aviso de enlace privado, «Le ha llegado
  a N»); el fondo (arranca una vez, no con la sesión quitada, no sin
  Laboratorio).
- **Dispositivo**: iPhone con Dynamic Island y otro sin ella; Android 13+.
  Coordinación publica → al monitor le llega el push → toca → actividad + PDF.
  **Modo avión** y tocar la actividad: abre el PDF. Enlace privado: se abre el
  enlace. Abrir la app sin tocar el push: arranca sola.

### Fase A2 — Uso A, escalón (b): push-to-start

- **Modelo: Opus** (APNs y tokens).
- **App**: `enablePushNotifications: true` (nativo, `[skip-ota]`), registro del
  token de push-to-start en `POST /v1/devices`, `getInstances()` y el listener
  de tokens por actividad al arrancar para adoptar las que llegaron por push.
- **Middleware**: emisor APNs con `.p8` (§5.4), limpieza de tokens muertos.
- **Apple**: crear (o reutilizar, si se tiene descargada) una clave APNs
  `.p8` en el portal; guardarla como secreto en Vercel con su Key ID y el Team
  ID `5P53S6QB23`. Ojo: los tokens dependen del entorno (`development` vs
  `production`): la build de desarrollo usa el host _sandbox_ de APNs.
- **Dispositivo**: iPhone con iOS 17.2+ con la app cerrada; publicar; la
  actividad aparece sola; tocarla abre la sesión. iPhone con iOS < 17.2:
  llega solo el push normal.

### Fase A3 (más adelante) — Android: Live Updates y espiga sin app

- Live Updates de Android 16 con un módulo local pequeño (patrón
  `modules/highlight-menu/`) y la espiga de §3.7. **Más adelante** (contestado).

### Fase B — Horario del evento

- **Modelo: Sonnet.** `utils/liveActivity/horarioNowNext.ts`, layout
  `widgets/HorarioEvento.tsx`, interruptor en `HorarioScreen`, `update` al
  volver a primer plano, notificación fija Android, sección en
  `docs/funcionalidades/EVENTOS.md`.
- **Tests**: `horarioNowNext` con el seed del Jubileo (`"??"`, último del día,
  cambio de día, fuera de rango), recorte a 4 KB.
- **Dispositivo**: móvil bloqueado 2 h; la cuenta atrás y el estado caducado
  dicen la verdad; abrir la app salta de franja.

### Lo que NO entra

- Widgets de Contigo (aparcados). Cuando se retomen: **mismo plugin y mismo
  App Group** (y actualizar `PLAN_WIDGET_CONTIGO.md`, que aún habla de
  `@bacons/apple-targets`).
- Share extension para recibir PDFs desde WhatsApp.

---

## 7. Build, versión y tiendas

### Estado real de Expo 58 (comprobado el 2026-11-16)

- `main` está en **Expo 58** (`expo ~58.0.22`, RN 0.88.1) desde la migración
  del 29-31/10 (CHANGELOG: «Expo 58…» del 29/10 y los arreglos tras la
  primera build de TestFlight del 31/10).
- La **2.5.1** (SDK 58) está **compilada y en las tiendas**: el 07/11 se subió
  la versión mínima a 2.5.1 y la ficha de la App Store ya la sirve
  (CHANGELOG 2026-11-07 18:00 y 2026-11-08). `runtimeVersion` 2.5.1.
- `docs/planes/PLAN_EXPO_58.md` **está desactualizado**: dice que falta la
  build de TestFlight y el merge, pero ya se hizo todo. Por su propia regla
  debería haberse borrado (y su fila de `docs/planes/README.md`). No se toca
  desde este plan; queda anotado para quien cierre la tarea.
- **Qué falta para empezar este plan: nada del SDK.** Solo lo propio: instalar
  `expo-widgets`/`@expo/ui` (Fase 0), el App Group en el portal de Apple y que
  esto vaya en la **siguiente build de tienda**, la **2.6.0** con
  `runtimeVersion` 2.6.0. Lo que no es nativo (la Fase A0 en el middleware, el
  contrato, el servidor falso, `pdfUrl`, el almacén, la hoja de publicar, la
  notificación fija de Android y la lógica del Uso B) se puede hacer ya.

### Paquetes y config nativa nuevos

| Paquete / config                           | Fase | Plataforma |
| ------------------------------------------ | ---- | ---------- |
| `expo-widgets ~58.0.28`                    | 0    | iOS        |
| `@expo/ui ~58.0.28`                        | 0    | iOS        |
| `enablePushNotifications: true` del plugin | A2   | iOS        |
| Módulo local de Live Updates               | A3   | Android    |

La notificación fija de Android (A1 y B) es **solo JS** sobre
`expo-notifications`.

### Requisitos de tienda

- iOS: `NSSupportsLiveActivities = YES` en el target principal; App Group en
  los dos; `aps-environment` ya lo pone `expo-notifications`. Live Activities
  desde iOS 16.2 (push-to-start desde 17.2): proteger con `areEnabled()` si el
  `IPHONEOS_DEPLOYMENT_TARGET` es menor. En App Review, la actividad tiene
  principio y fin y la arranca el usuario o una acción de coordinación que le
  afecta: nota de revisión «coordinación publica la sesión del día y los
  monitores la tienen en la pantalla de bloqueo».
- Android: `POST_NOTIFICATIONS` ya se pide. Sin servicio en primer plano.
- Política de privacidad: el material (enlace o PDF de la sesión) pasa por el
  servidor de Comunica, que ya trata datos de monitores. Añadir una línea si
  la política enumera los tipos de documentos.

---

## 🔒 Decisiones del usuario

### Contestadas (2026-11-16)

1. **Desde dónde se arranca**: desde Comunica y desde Más; la primera build,
   escondido en el **Laboratorio Alpha**. ✅
2. **De dónde sale el documento**: **coordinación de etapa lo publica** (enlace
   o documento) y les llega a todos los monitores de sus grupos; la app baja
   el PDF. Que el monitor pegue el suyo queda como opción secundaria. ✅
3. **«Abrir con…» / share extension**: queda para después; con la publicación
   ya no es lo principal. ✅
4. **Uso B**: local. ✅
5. **Live Updates de Android 16**: más adelante. ✅
6. **Push-to-start**: después del escalón (a), si es viable. **Lo es**
   (`expo-widgets` 58, iOS 17.2+), con emisor APNs propio en el middleware y
   clave `.p8` en Vercel: es la Fase A2. ✅

### Nuevas (hacen falta antes de la Fase A0)

1. **¿Quién puede publicar la sesión de hoy?** Recomiendo: **los mismos que
   pueden mandar «Recordar que pasen lista»** (coordinación, sobre los grupos
   de su alcance). Acompañamiento no, salvo que lo pidáis.
2. **¿Cuándo llega el aviso?** Recomiendo: **solo al publicar** en la primera
   versión; el arranque automático al abrir la app cubre al que lo vio tarde.
   Un segundo aviso programado («empieza en 30 min») pide un cron en el
   middleware: solo si se echa en falta.

---

## Fuentes (consultadas el 2026-11-16)

- `expo-widgets`, referencia SDK 58 (push-to-start con
  `addPushToStartTokenListener`, «Remote start requires iOS 17.2 or later»,
  cabeceras `apns-push-type: liveactivity` y `apns-topic
<bundle>.push-type.liveactivity`, `enablePushNotifications`; versión
  recomendada `~58.0.28`): <https://docs.expo.dev/versions/v58.0.0/sdk/widgets/>
- Expo, «Live Activities with Expo, end to end: client and backend» (1-oct-2026;
  `isPushToStartEligibleDevice`, JWT ES256 con clave `.p8`, HTTP/2 a
  `api.push.apple.com`, `alert` obligatorio en el arranque, tokens 410):
  <https://expo.dev/blog/live-activities-with-expo-end-to-end-client-and-backend>
- Expo, «Home screen widgets and Live Activities in Expo»:
  <https://expo.dev/blog/home-screen-widgets-and-live-activities-in-expo>
- Apple, ActivityKit: <https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities>
- Voltra: <https://www.use-voltra.dev/> · npm `voltra@2.4.0`.
- `expo-live-activity` (deprecada): <https://github.com/software-mansion-labs/expo-live-activity>
- `@bacons/apple-targets@5.0.0`: <https://github.com/EvanBacon/expo-apple-targets>
- Android 16, Live Updates: <https://developer.android.com/about/versions/16/features/progress-centric-notifications>
