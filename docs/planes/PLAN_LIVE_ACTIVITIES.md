# Plan — Live Activities (iOS) y su equivalente en Android

> Objetivo: una **base nativa común** para tener algo de la app «vivo» en la
> pantalla de bloqueo (iOS: Live Activity + Dynamic Island; Android:
> notificación persistente, promovida a *Live Update* en Android 16) y **dos
> usos** encima:
>
> - **Uso A — «La sesión a mano»** (monitores; lo que más importa): el monitor
>   lanza desde la app una Live Activity de su sesión o reunión; al tocarla, se
>   abre directamente el documento o PDF de la sesión. Se acabó buscarlo en
>   WhatsApp.
> - **Uso B — «Horario del evento»**: durante un encuentro o retiro, «ahora» y
>   «siguiente» del horario en la pantalla de bloqueo.
>
> Escrito el 2026-11-16. **Estado: 🔵 propuesta.** No se ejecuta hasta que el
> usuario lo pida y conteste las 🔒 del final. **Todo esto es nativo** (build
> de tienda, commit `[skip-ota]`), salvo lo que se marca como «solo JS».

---

## 0. Resumen en diez líneas

1. **Librería iOS: `expo-widgets` (oficial de Expo, `~58.0.28`)** + su
   dependencia `@expo/ui` (`~58.0.28`). Va versionada con el SDK, crea el target
   de WidgetKit y el App Group en el prebuild y **es la misma que servirá para
   los widgets de Contigo** cuando se retomen.
2. **Android, primera versión: sin paquete nuevo.** Una notificación local
   `sticky` de `expo-notifications` (ya instalado) con su canal propio. *Live
   Updates* de Android 16 (la píldora en la barra de estado) va en una fase
   opcional con un módulo local mínimo.
3. **Uso A mínimo**: el monitor pega un **enlace** (Docs/Drive/PDF) o elige un
   **fichero** del móvil; la app guarda una copia local si es PDF, lanza la
   actividad hasta la hora de fin y, al tocarla, abre el documento. Sin
   servidor.
4. **Uso B**: **local primero** (la app escribe «ahora/siguiente» cada vez que
   corre, con horas absolutas y cuenta atrás nativa para que no mienta aunque no
   se actualice). Push de ActivityKit solo si eso se queda corto.
5. Va **después de cerrar `PLAN_EXPO_58.md`** (que su build esté validada en
   TestFlight) y entra en la **siguiente build de tienda** (previsiblemente la
   2.6.0, con `runtimeVersion` nueva).

---

## 1. Lo que hay hoy en el repo y condiciona el plan

| Pieza                                                                                         | Qué implica                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mcm-app/package.json`: `expo ~58.0.22`, RN 0.88.1, `runtimeVersion` 2.5.1                     | `main` ya está en SDK 58; lo que falta de `PLAN_EXPO_58.md` es la build de TestFlight y probar en el móvil. Las librerías se eligen para **58**.                                                                                                                                                                                                                                                                                                              |
| `plugins/withNotificationServiceExtension.js` + `targets/notification-service/`               | Ya hay **un target de extensión iOS** (la NSE) añadido con un plugin propio. Su cabecera documenta lo que se va a repetir: bundle id nuevo ⇒ perfil de aprovisionamiento nuevo ⇒ **EAS pregunta por terminal la primera vez**. Y `app.json` → `extra.eas.build.experimental.ios.appExtensions` lista la NSE a mano.                                                                                                                                              |
| `eas.json`: `EXPO_NO_CAPABILITY_SYNC=1` en todos los perfiles                                 | EAS **no** sincroniza capacidades con Apple. El **App Group** (nuevo) hay que darlo de alta a mano en el portal de Apple Developer para el bundle principal y para el de la extensión, o quitar ese flag solo para esa build (ver Fase 0).                                                                                                                                                                                                                      |
| `app.json` → `scheme: "mcmapp"`; `app/+native-intent.ts`                                       | El toque en la Live Activity abre `mcmapp://…`. `redirectSystemPath` hoy reescribe enlaces de Comunica y manda **cualquier `file://`/`content://` al cantoral** (es para las playlists `.mcm`): hay que distinguir los PDF (Fase A2).                                                                                                                                                                                                                         |
| `app.json` → `CFBundleDocumentTypes` (`.mcm`) + `LSSupportsOpeningDocumentsInPlace` + `hooks/useIncomingPlaylist.ts` | Ya existe el patrón «la app aparece en *Abrir con…* para un tipo de fichero y lo recoge al arrancar». Es la vía barata para «compartir el PDF desde WhatsApp» **sin share extension**.                                                                                                                                                                                                                                                                          |
| `services/comunica/contract.ts`: `SessionSummary {id, eventId, date, startsAt, endsAt, kind}` y `Meeting {session, name, durationHours, rollCall}` | Una sesión o reunión de Comunica **trae nombre y horas, pero ningún material ni enlace**. Los únicos adjuntos del contrato son los de la ficha de evento de familias (`EventDetail.attachments`). ⇒ El documento **no puede salir de Comunica** sin tocar el servidor (ver 🔒 2). Sí sirve para **rellenar título y horas** del Uso A.                                                                                                                        |
| `components/comunica/pasar-lista/ComunicaHome.tsx` (punto 4: «el atajo: tu grupo y su sesión») y `coordinacion/MeetingsScreen.tsx` | Los dos sitios naturales para el botón «Llevar a mano»: la sesión de tu grupo y la reunión de programación.                                                                                                                                                                                                                                                                                                                                                       |
| `services/comunica/eventFiles.ts` + `components/comunica/documentos/FileViewerScreen.tsx`      | Ya hay visor propio: PDF en WebView (iOS) e imagen con `expo-image`. **Ojo**: ese visor **borra la copia al cerrarse** (es para documentos sensibles del área). El Uso A necesita una copia que **persista** hasta que acabe la sesión: carpeta y ciclo de vida propios, reutilizando el visor con una opción que no borre.                                                                                                                                      |
| Horario de un evento: `app/screens/HorarioScreen.tsx`, `firebase-seed/eventos/jubileo-2025/jubileo-horario.json` | Forma: `[{ fecha: "2025-07-29", titulo, eventos: [{ hora: "08:40", nombre, subtitulo?, lugar?, icono?, maps?, materiales? }] }]`. **Sin hora de fin** y con horas que pueden ser `"??"`. «Ahora» = el último cuya hora ya pasó; «siguiente» = el primero que no. Se lee con `useFirebaseData(getEventFirebasePath(event, 'horario'))` y el evento activo lo da `ActiveEventContext`.                                                                                 |
| `notifications/usePushNotifications.ts` (navega con `data.internalRoute`) y `utils/contigoReminders.ts` (lista cerrada `REMINDER_ROUTES`) | Patrón ya hecho para notificaciones **locales** con ruta interna. La notificación persistente de Android lo reutiliza; hay que **excluirla del buzón** de notificaciones guardadas (no es un aviso).                                                                                                                                                                                                                                                             |
| `functions/` (Cloud Functions del precacheo ICS)                                                | Si algún día el Uso B necesita push de ActivityKit, ya hay dónde poner el emisor. **Expo Push no sirve para Live Activities**: se habla con APNs directamente con una clave `.p8` (lo confirma el propio blog de Expo, ver §2).                                                                                                                                                                                                                                 |

---

## 2. Librerías: comparación y elección

Comprobado el 2026-11-16 contra el registro de npm y la documentación de cada
una (no de memoria).

| Opción                                                                                                                    | Versión hoy                                    | iOS (Live Activity)                                                                                                                                                                                        | Android                                                                                                                                                       | Encaje con el repo                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **[`expo-widgets`](https://docs.expo.dev/versions/v58.0.0/sdk/widgets/)** (Expo, oficial) ⭐                             | `58.0.28` (11-nov-2026); recomendado `~58.0.28` en la doc de SDK 58 | ✅ `createLiveActivity(name, layout)` → `start(props, url?, staleDate?)`, `update`, `end(dismissalPolicy)`, `getPushToken()`, push-to-start (iOS 17.2+). Layout en TSX con `@expo/ui/swift-ui`.              | Solo **widgets de pantalla de inicio** (`enableAndroid`). **No** hace notificaciones persistentes ni Live Updates.                                           | Versionada con el SDK (sube sola con `expo install --fix`). El plugin crea target + App Group (`group.<bundle>` por defecto). **Es la misma pieza que necesitan los widgets de Contigo**, incluso en Android. Estable desde SDK 56 según Expo.                            |
| **[Voltra](https://www.use-voltra.dev/)** (Callstack, `@use-voltra/ios-client` / `android-client`)                       | `2.4.0` (6-oct-2026), peer `expo: *`           | ✅ `startLiveActivity(variants, { activityName, deepLinkUrl, staleDate, dismissalPolicy, relevanceScore })`, `updateLiveActivity`, `stopLiveActivity`, `isLiveActivityActive`, push y canales (iOS 18).  | ✅ **Notificaciones *ongoing* con promoción a Live Updates** (`startAndroidOngoingNotification(..., { requestPromotedOngoing, deepLinkUrl })`), más widgets Glance. | Muy completa y bien documentada. Pero versionado propio (no va con el SDK), extensión con `deploymentTarget` 17.0 por defecto y un tercero más que mantener. **Plan B** si `expo-widgets` falla en la Fase 0.                                                           |
| [`expo-live-activity`](https://github.com/software-mansion-labs/expo-live-activity) (Software Mansion)                    | `0.4.2`, **deprecada y archivada (1-jun-2026)** | Remite a `expo-widgets`.                                                                                                                                                                                   | —                                                                                                                                                             | ❌ Descartada.                                                                                                                                                                                                                                                            |
| [`@bacons/apple-targets`](https://github.com/EvanBacon/expo-apple-targets)                                                | `5.0.0` (jul-2026), peer `expo >=52`           | Solo crea el **target**; el SwiftUI y el puente JS ↔ ActivityKit se escriben a mano (módulo Expo local).                                                                                                   | —                                                                                                                                                             | Máximo control, máximo código propio. Tiene sentido si se quisiera SwiftUI «de verdad»; aquí no compensa.                                                                                                                                                                 |
| `react-native-live-activities`                                                                                            | `0.1.1` (2022)                                 | Abandonada.                                                                                                                                                                                                | —                                                                                                                                                             | ❌                                                                                                                                                                                                                                                                         |

### Elegida: `expo-widgets` (+ `@expo/ui`) en iOS; `expo-notifications` en Android

Por qué:

- **Va con el SDK.** El repo acaba de pasar un salto de SDK doloroso (58); una
  librería versionada `~58.x` por Expo se actualiza con `expo install --fix` y
  la prueba Expo en cada SDK. Voltra no.
- **No cierra la puerta a los widgets, la abre.** `PLAN_WIDGET_CONTIGO.md`
  hablaba de `@bacons/apple-targets`; hoy `expo-widgets` hace widgets de iOS
  **y de Android** con el mismo plugin y el mismo target. Cuando se retomen,
  serán entradas en `widgets[]` del mismo plugin, sin segundo target ni segundo
  App Group.
- **Android no necesita librería para lo útil.** La notificación fija con
  `sticky: true` de `expo-notifications` (ya en el binario) hace el 90 % del Uso
  A en Android, y **es solo JS** (podría salir incluso por OTA). La píldora de
  Live Updates de Android 16 es un adorno que se puede añadir después con un
  módulo local de ~100 líneas de Kotlin (patrón de `modules/highlight-menu/`)
  o, si se prefiere no escribir Kotlin, con `@use-voltra/android-client`
  (🔒 5).

Lo que hay que saber de `expo-widgets` (de su doc de SDK 58):

- El layout es una función TSX con la directiva `'widget'` que **se compila
  aparte y corre en un runtime aislado dentro de la extensión**: sin hooks, sin
  estado, sin `async`, sin imports y **sin referencias a nada de fuera de la
  función** (ni constantes de módulo). Todo lo que pinte llega por `props`.
  ⇒ Guardarraíl en test (§6).
- Regiones del layout: `banner` (pantalla de bloqueo), `compactLeading`,
  `compactTrailing`, `minimal` y las expandidas de la Dynamic Island.
- En iOS 17+ la vista raíz necesita `containerBackground` con placement
  `'widget'` o sale el aviso «adopt containerBackground API».
- La doc **no menciona `NSSupportsLiveActivities`** (solo
  `NSSupportsLiveActivitiesFrequentUpdates` con `frequentUpdates`). Se pone a
  mano en `app.json` → `ios.infoPlist` y se comprueba tras el prebuild.
- Las imágenes hay que escribirlas en `widgetsDirectory` (el contenedor del App
  Group) y referenciarlas por ruta. Para estos dos usos basta con SF Symbols /
  emoji: **ninguna imagen**.

Límites de Apple que mandan sobre todo lo demás
([ActivityKit](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities)):

- Una Live Activity **solo se arranca con la app en primer plano** (o por push
  en iOS 17.2+).
- Vive **hasta 8 h activa**; después el sistema la termina y aún puede quedarse
  **hasta 4 h** en la pantalla de bloqueo. Total máximo: 12 h.
- `props` (estado + atributos) **≤ 4 KB**.
- El toque **solo abre la propia app** (su URL); no puede abrir Google Docs ni
  Safari directamente. ⇒ Siempre se pasa por la app, que abre lo que toque.
- El usuario puede desactivar las Live Activities de la app en Ajustes: hay que
  comprobarlo antes de prometer nada en la interfaz.
- Sin la app corriendo, **no hay forma local de actualizar ni de terminar** la
  actividad a una hora: solo `staleDate` (la marca como caducada, el layout lo
  lee como `isStale`) y el tope de 8 h. Los textos de cuenta atrás nativos (tipo
  `Text(timerInterval:)`) sí avanzan solos.

---

## 3. Arquitectura

```
                 ┌──────────────── app (JS) ─────────────────┐
  Pantalla  ──►  │ services/liveActivity/                    │
  «Llevar a      │   index.ts        API común: start/update/end/active
   mano»         │   ios.ts          expo-widgets (createLiveActivity)
                 │   android.ts      expo-notifications sticky (+ Live Update opcional)
                 │   index.web.ts    no-op                               │
                 │ services/aMano/store.ts  (AsyncStorage: actual + recientes)
                 │ services/aMano/files.ts  (copias persistentes de PDF) │
                 └───────────────┬───────────────────────────┬───────────┘
                                 │ props ≤ 4 KB              │ notificación local
                     ┌───────────▼──────────┐      ┌─────────▼─────────┐
                     │ iOS: extensión        │      │ Android: canal    │
                     │ WidgetKit (expo-      │      │ «a-mano» (bajo,   │
                     │ widgets) + App Group  │      │ sin sonido)       │
                     └───────────┬──────────┘      └─────────┬─────────┘
                                 │ toque: mcmapp://a-mano?id=…│ data.internalRoute
                                 └──────────────┬─────────────┘
                                   app/+native-intent.ts → app/a-mano.tsx
                                   (abre el PDF local o el enlace)
```

### 3.1 Qué viaja a la actividad (nada sensible)

Uso A (`SesionAManoProps`):

```jsonc
{
  "title": "Sesión Grupo Juveniles 2",   // ≤ 60 caracteres, lo escribe el monitor
  "docLabel": "Dinámica del perdón.pdf",  // solo el nombre visible
  "docKind": "pdf",                       // pdf | doc | sheet | slides | link
  "startsAt": 1763290800000,              // ms
  "endsAt": 1763298000000                 // ms → cuenta atrás «termina en…»
}
```

Uso B (`HorarioProps`):

```jsonc
{
  "eventTitle": "Encuentro MCM 2027",
  "now":  { "hora": "16:00", "nombre": "Actividades de bienvenida", "lugar": "Casal Loiola", "icono": "👋" },
  "next": { "hora": "17:00", "nombre": "Eucaristía de Envío", "lugar": "Casal Loiola", "icono": "⛪️", "at": 1763298000000 },
  "later": [{ "hora": "19:00", "nombre": "Salida hacia Roma" }]   // como mucho 2
}
```

**La URL, la ruta del fichero y el token no viajan nunca** a la actividad ni a
la URL del deep link: la actividad lleva un `id` local y la app resuelve el
resto desde su almacén (mismo criterio que `services/comunica/fileViewer.ts`:
«nunca en la URL»).

### 3.2 Deep link de vuelta

- iOS: `start(props, 'mcmapp://a-mano?id=<id>', staleDate)`. Android:
  `data.internalRoute = '/a-mano?id=<id>'` (más el `id` en `data`).
- `app/+native-intent.ts`: `mcmapp://a-mano?…` **no** es de Comunica
  (`classifyComunicaLink` devuelve `null`) y pasa tal cual → ruta raíz
  `app/a-mano.tsx` (hermana de `panuelo.tsx`). Se añade un test a
  `redirectSystemPath` que lo fije.
- Uso B: `mcmapp://horario` → la pantalla de horario del evento activo (la ruta
  real la da `utils/eventRoutes.ts`).
- La pantalla `a-mano` **no depende de tener sesión de Comunica**: tiene que
  abrir el PDF sin red y sin login (el monitor puede estar en un campamento sin
  cobertura).

### 3.3 Dónde se abre el documento

| Origen                                  | Dónde se abre                                                                                                               | Sin red              |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| PDF (fichero elegido, o enlace a un PDF que se descarga al crear) | **Visor dentro de la app**: iOS reutiliza `FileViewerScreen` (WebView) en modo «no borres»; Android lo abre con el visor del sistema (`expo-intent-launcher`, ya instalado), porque la WebView de Android no pinta PDF | ✅ copia en `documentDirectory/a-mano/` |
| Google Docs / Drive / Slides / Sheets   | **App externa** (`Linking.openURL`: si está la app de Google, se abre allí; si no, Safari/Chrome). Opción secundaria «Abrir aquí» con `expo-web-browser` | ❌ (lo dice la pantalla al crear) |
| Otro enlace `https://`                   | `expo-web-browser` (hoja de Safari / Custom Tab)                                                                             | ❌                    |

Las copias se borran cuando la sesión deja de estar en «recientes» (no al
cerrar el visor, como en Comunica).

### 3.4 Equivalente Android, por uso

| Uso | Android ≤ 15                                                                                                    | Android 16+                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| A   | Notificación local `sticky` (no se quita deslizando), canal `a-mano` de importancia baja, sin sonido; toque → `/a-mano?id=`; botón de acción «Terminar». | Igual, y en la fase opcional se **promueve a Live Update** (chip en la barra de estado, arriba en la pantalla de bloqueo). Requiere `POST_PROMOTED_NOTIFICATIONS` y estilo `BigText`/`Progress` con título. |
| B   | Notificación `sticky` con «Ahora · Siguiente»; se reescribe cada vez que la app corre. Espiga a probar: dejar **programadas** las notificaciones de cada franja con el mismo identificador para que se sustituyan solas (si `expo-notifications` lo respeta, Android se actualiza sin app). | Igual + Live Update con `ProgressStyle` (segmentos = franjas del día) en la fase opcional. |

Sin *foreground service*: no hace falta y evitaría la declaración de tipo de
servicio en Play.

---

## 4. Uso A — «La sesión a mano»

### 4.1 Flujo mínimo (A1)

1. Entrada: botón **«Llevar a mano»** en la tarjeta del atajo de
   `ComunicaHome` (tu grupo y su sesión) y en cada reunión de
   `MeetingsScreen`; abre una hoja con **título y horas ya rellenos** desde
   `SessionSummary.startsAt/endsAt` (o `Meeting.name` + `durationHours`).
   Además, una entrada sin Comunica en Más (ver 🔒 1).
2. En la hoja: **«Pegar enlace»** (lee el portapapeles con `expo-clipboard`,
   ya instalado, si trae un `https://`) o **«Elegir PDF»**
   (`expo-document-picker`, ya instalado; WhatsApp en iOS deja «Guardar en
   Archivos»). Si el enlace es un PDF directo, se ofrece guardarlo para tenerlo
   sin red.
3. «Empezar» → se guarda en `services/aMano/store.ts` y se lanza la actividad
   con `staleDate = endsAt`.
4. Al tocar la actividad → `app/a-mano.tsx` abre el documento al instante (sin
   pasos intermedios); dentro, «Terminar» y «Cambiar documento».
5. **Caducidad**: con `staleDate` en `endsAt` el layout pinta «Terminada · toca
   para cerrar». Al volver la app a primer plano (`AppState`) o al arrancar, si
   `now > endsAt` se termina con `dismissalPolicy` inmediata. El tope de 8 h de
   iOS cubre de sobra las reuniones (1-4 h, `MEETING_DURATIONS`). Una sola
   actividad «a mano» a la vez: empezar otra termina la anterior.

Layout (iOS):

- Pantalla de bloqueo: icono por tipo de documento, `title`, `docLabel`, y a la
  derecha «termina en 1:12» con cuenta atrás nativa.
- Dynamic Island compacta: icono a la izquierda, cuenta atrás a la derecha;
  mínima: el icono.
- Colores: los de Comunica según `design.md` (no inventar paleta; leer los
  tokens de `constants/` y copiarlos **literalmente** dentro de la función del
  layout, porque no puede importar).

### 4.2 Completo (A2)

- **Relanzar rápido**: lista «Recientes» (las 5 últimas) arriba de la hoja con
  «Volver a llevar» en un toque: mismo documento, horas recalculadas a la
  próxima sesión de ese grupo si se sabe, o «desde ahora + misma duración».
- **Recibir el PDF desde WhatsApp sin share extension**:
  - iOS: añadir `com.adobe.pdf` a `CFBundleDocumentTypes` con
    `LSHandlerRank: "Alternate"` ⇒ la app aparece en «Abrir con…» / la fila de
    apps de la hoja de compartir para PDF. `LSSupportsOpeningDocumentsInPlace`
    ya está a `true`: hay que **copiar el fichero en el acto** (el acceso al
    original es temporal).
  - Android: `intentFilters` `VIEW` con `mimeType: application/pdf` (como los
    `.mcm`). Tocar el PDF en WhatsApp ofrece la app en el selector.
  - `+native-intent.ts`: hoy `isFileUrl` → cantoral. Separar por extensión /
    MIME: `.mcm` sigue al cantoral; `.pdf` deja el fichero en un hueco en
    memoria (patrón `setPendingNativeLink`) y va a `/a-mano/nuevo`.
  - Una **share extension de verdad** (para «Compartir» con texto/enlace desde
    cualquier app) sería **otro target** y otra pieza de firma: se deja fuera
    salvo que el «Abrir con…» se quede corto (🔒 3).
- **Botón de acción** en Android («Terminar») e iOS 17+ (botón en la
  actividad con App Intent, si `expo-widgets` lo expone para Live Activities;
  si no, se omite).
- **Live Update** en Android 16 (fase opcional, §5 Fase A3).

### 4.3 Lo que NO hace (a propósito)

- No sube nada a Comunica ni al Panel: es local del móvil del monitor.
- No guarda el documento en la nube ni lo comparte con el grupo.
- El «material asociado a la sesión en Comunica» queda como **evolución**: haría
  falta un campo `materials` en `SessionSummary`/`Meeting` del contrato y que el
  servidor (middleware) lo sirva. Si se decide, la hoja solo añade una tercera
  fuente («Material de la sesión»); el resto del plan no cambia.

---

## 5. Uso B — «Horario del evento»

### 5.1 Cómo se actualiza: comparación

| Vía                                                                                       | Qué necesita                                                                                                                                                                                                                                     | Fiabilidad                                                                                                       | Coste                     |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------- |
| **Local** (la app calcula «ahora/siguiente» y hace `update` cuando corre) ⭐               | Nada más que la base.                                                                                                                                                                                                                             | Se actualiza cada vez que se abre la app (en un encuentro, muchas veces al día). Entre aperturas, **no cambia de franja**: se compensa con el diseño (abajo). | Bajo                      |
| Push por actividad (token de `getPushToken()` → servidor → APNs)                          | Guardar el token de cada móvil, un emisor con clave `.p8` en `functions/`, y mandar un push por franja **y por dispositivo**. Expo Push no lo hace.                                                                                              | Alta                                                                                                             | Alto (servidor, secretos) |
| Push a un **canal de difusión** (iOS 18+: un push por franja para todos, sin tokens)      | `enablePushNotifications`, canal creado en APNs, emisor en `functions/` con `.p8` y un cron que lea el horario de Firebase. Comprobar que `expo-widgets` lo expone (Voltra sí: `channelId`).                                                     | Alta en iOS 18+; nada en 16-17                                                                                   | Medio                     |

**Recomendación: local.** Y un layout que **no mienta aunque se quede viejo**:

- Siempre con **horas absolutas** («17:00 Eucaristía»), nunca «ahora» a secas
  sin hora.
- «Siguiente» con **cuenta atrás nativa** hasta su hora, que avanza sola.
- `staleDate = next.at`: pasada esa hora, el layout pinta la lista
  «17:00 Eucaristía · 19:00 Salida» sin la etiqueta «ahora», que sigue siendo
  verdad.
- Duración: se arranca por la mañana y caduca a las 8 h (iOS); al abrir la app
  se renueva. Si eso molesta en la práctica, se pasa al canal de difusión
  (🔒 4).

### 5.2 Lógica (solo JS, testeable)

`utils/liveActivity/horarioNowNext.ts`: `(dias, ahora) → { now, next, later[] }`

- Elige el día por `fecha` (hora de Madrid, `utils/comunica/madrid.ts` o el
  equivalente de `dateUtils`; ojo a eventos fuera de España: el horario está en
  hora local del evento).
- Ignora horas no parseables (`"??"`, vacías) para el cálculo, pero no las
  pierde en `later` si van entre dos válidas.
- Último del día: `next = null` → «Fin del día · mañana 08:40 …».
- Recorta textos para cumplir los 4 KB.

### 5.3 Arranque

- En la pantalla de horario del evento activo: interruptor «Ver en la pantalla
  de bloqueo» (solo si el evento está en curso, `fecha` de hoy dentro del
  rango).
- Opcional: ofrecerlo una vez al abrir la app el primer día del evento.
- Se para solo al terminar el último día, o con el interruptor.

---

## 6. Fases

Cada fase en su commit; todas las que añaden nativo con `[skip-ota]`. El código
JS que importe `expo-widgets` **debe** comprobar que el módulo nativo existe
(`requireOptionalNativeModule` o un `try` en el import perezoso) para que una
OTA a binarios viejos no crashee — aunque al subir la `runtimeVersion` con esta
build la cadena se corta igual.

### Fase 0 — Base nativa (iOS + Android)

- **Modelo: Opus.** Es fontanería de Xcode/EAS con dos extensiones conviviendo.
- **Archivos**:
  - `mcm-app/package.json` (`npx expo install expo-widgets @expo/ui`).
  - `mcm-app/app.json`: plugin `["expo-widgets", { "groupIdentifier":
    "group.com.familiaconsolacion.mcmapp", "enablePushNotifications": false }]`
    **después** de `./plugins/withNotificationServiceExtension`;
    `ios.infoPlist.NSSupportsLiveActivities: true`;
    `extra.eas.build.experimental.ios.appExtensions` + la entrada del target de
    widgets (`ExpoWidgetsTarget`, bundle `…mcmapp.ExpoWidgetsTarget`) con su
    entitlement de App Group; `version`/`runtimeVersion` → 2.6.0 cuando toque
    la build.
  - `mcm-app/widgets/` (o donde mande la doc): un layout «hola» para probar.
  - `mcm-app/services/liveActivity/{index,ios,android,index.web}.ts`: API común
    `start/update/end/getActive/areEnabled` (sin lógica de ningún uso).
  - Canal Android `a-mano` en el registro de canales que ya crea la app.
- **Comprobaciones**: `npx expo prebuild -p ios --clean` en el Mac: dos
  extensiones (NSE + widgets), cada una con su bundle id; el `.entitlements`
  del target principal **y** del de widgets con el App Group; `Info.plist` con
  `NSSupportsLiveActivities`. Que el plugin de la NSE siga encontrando
  `PBXTargetDependency` (lo crea él si falta; con otra extensión puede que ya
  exista).
- **Apple Developer**: con `EXPO_NO_CAPABILITY_SYNC=1`, dar de alta a mano el
  App Group y asignarlo a los dos identificadores; la primera build **pregunta
  por terminal** el perfil de la extensión nueva (como pasó con la NSE). La
  lanza el usuario.
- **Tests**: guardarraíl `__tests__/liveActivityLayouts.test.ts` que lea los
  ficheros de layout y falle si falta la directiva `'widget'`, si hay `import`
  o si el cuerpo usa identificadores de módulo (mismo espíritu que
  `tabsLayoutWebSafety`); test de `services/liveActivity` con el módulo
  mockeado (web = no-op; sin módulo nativo = `areEnabled() === false`).
- **Dispositivo**: build de desarrollo en un iPhone real (el simulador muestra
  Live Activities, pero firma y App Group solo se validan en real); arrancar y
  terminar la de prueba; la NSE sigue funcionando (mandar un push con imagen).

### Fase A1 — Uso A mínimo

- **Modelo: Sonnet.**
- **Archivos**: `services/aMano/{store,files}.ts` (+ `.web.ts`),
  `app/a-mano.tsx`, `components/aMano/NuevaSesionSheet.tsx`, layout
  `widgets/SesionAMano.tsx`, botón en `components/comunica/pasar-lista/ComunicaHome.tsx`
  y `components/comunica/coordinacion/MeetingsScreen.tsx`, opción «no borrar»
  en `FileViewerScreen`, exclusión de la notificación fija en
  `notifications/usePushNotifications.ts` (que no entre en el buzón),
  `app/_layout.tsx` (registrar la ruta y el barrido al volver a primer plano),
  `docs/funcionalidades/SESION_A_MANO.md` nuevo, CHANGELOG.
- **Tests**: store (crear, terminar, caducar, recientes ≤ 5, borrar copias
  huérfanas); clasificación de enlaces (Docs/Drive/PDF/otro, solo `https`);
  `redirectSystemPath('mcmapp://a-mano?id=x')`; barrido «si `now > endsAt`,
  terminar».
- **Dispositivo**: iPhone con Dynamic Island y otro sin ella; Android 13+ real.
  Pantalla bloqueada → tocar → abre el PDF **en modo avión**. Enlace de Google
  Docs con la app de Google instalada y sin ella. Que la actividad se marque
  caducada a la hora de fin y desaparezca al abrir la app. Que Ajustes →
  Live Activities desactivado se refleje en la hoja.

### Fase A2 — Uso A completo

- **Modelo: Sonnet** (Opus para el cambio de `+native-intent.ts` si se complica
  la convivencia con `.mcm`).
- **Archivos**: `app.json` (`CFBundleDocumentTypes` PDF, `intentFilters` PDF
  Android → nativo), `app/+native-intent.ts`, hook `useIncomingSessionFile.ts`
  (gemelo de `useIncomingPlaylist`), recientes y «volver a llevar» en la hoja,
  botón «Terminar» en la notificación Android (categorías de
  `expo-notifications`).
- **Tests**: `redirectSystemPath` con `file://…pdf`, `content://…` PDF y
  `.mcm` (que el cantoral siga igual); recalcular horas al relanzar.
- **Dispositivo**: desde WhatsApp en iPhone, «Compartir → MCM App» con un PDF; en
  Android, tocar el PDF y elegir la app. Que un `.mcm` siga abriendo el
  cantoral.

### Fase A3 (opcional) — Live Updates en Android 16

- **Modelo: Sonnet** (Kotlin pequeño).
- Módulo local `modules/live-update/` que publique la notificación con
  `setRequestPromotedOngoing(true)` y `BigText`, más
  `POST_PROMOTED_NOTIFICATIONS` en el manifiesto; o
  `@use-voltra/android-client` si se prefiere no tener Kotlin propio (🔒 5).
  Con eso, además, `timeoutAfter` para que se quite sola a la hora de fin.
- **Dispositivo**: un Android 16 real (Pixel); comprobar el ajuste por app de
  Live Updates.

### Fase B — Horario del evento

- **Modelo: Sonnet.**
- **Archivos**: `utils/liveActivity/horarioNowNext.ts`, layout
  `widgets/HorarioEvento.tsx`, interruptor en `app/screens/HorarioScreen.tsx`,
  `update` al volver a primer plano y al refrescar `useFirebaseData` del
  horario, notificación fija Android, sección en
  `docs/funcionalidades/EVENTOS.md`.
- **Tests**: `horarioNowNext` con el seed del Jubileo (`"??"`, último del día,
  cambio de día, evento de varios días, fuera de rango), recorte a 4 KB.
- **Dispositivo**: dejar el móvil bloqueado 2 h con la actividad puesta y ver que
  la cuenta atrás y el estado caducado dicen la verdad; abrir la app y ver que
  salta de franja. En Android, la espiga de notificaciones programadas que se
  sustituyen.

### Lo que NO entra

- Widgets de Contigo (aparcados por decisión del usuario). Este plan deja
  puesto lo que necesitarán: el plugin, el target y el App Group
  `group.com.familiaconsolacion.mcmapp`. **Cuando se retomen, usar ese mismo
  App Group y ese mismo plugin** (y actualizar `PLAN_WIDGET_CONTIGO.md`, que
  todavía habla de `@bacons/apple-targets`).
- Push de ActivityKit (salvo 🔒 4).

---

## 7. Build, versión y tiendas

**Todo esto requiere build nativa.** Paquetes nuevos:

| Paquete                                        | Fase   | Plataforma |
| ---------------------------------------------- | ------ | ---------- |
| `expo-widgets ~58.0.28`                        | 0      | iOS        |
| `@expo/ui ~58.0.28`                            | 0      | iOS        |
| `CFBundleDocumentTypes`/`intentFilters` PDF    | A2     | ambas (config nativa) |
| `modules/live-update/` o `@use-voltra/android-client 2.4.0` | A3 (opcional) | Android |

Lo de Android de las fases A1 y B (notificación `sticky`) es **solo JS** sobre
`expo-notifications`.

**Orden respecto a otras cosas:**

1. **Primero se cierra `PLAN_EXPO_58.md`**: su build de TestFlight valida el SDK
   58 en el móvil. Meter un target nuevo en esa misma build mezclaría dos
   fuentes de fallo (el propio `PLAN_WIDGET_CONTIGO.md` §5 paso 0 ya aplazó el
   segundo target por lo mismo).
2. Después, la **siguiente build de tienda** (previsiblemente **2.6.0**, con
   `runtimeVersion` 2.6.0): Fase 0 + A1 como mínimo; A2 y B pueden ir en la
   misma si llegan, porque la A2 solo añade config y la B es solo JS encima de
   la base.

**Requisitos de tienda:**

- iOS: `NSSupportsLiveActivities = YES` en el `Info.plist` **del target
  principal**; App Group en ambos targets; `aps-environment` ya lo pone
  `expo-notifications` (solo hace falta para push de ActivityKit). Las Live
  Activities funcionan desde iOS 16.2; comprobar el `IPHONEOS_DEPLOYMENT_TARGET`
  del SDK 58 tras el prebuild y, si es menor, proteger con `areEnabled()`. En
  App Review, una Live Activity tiene que corresponder a algo **con principio y
  fin** que el usuario ha iniciado: los dos usos lo cumplen. Buena idea añadir
  una línea a las notas de revisión («el monitor la arranca desde Comunica →
  Llevar a mano»).
- Android: `POST_NOTIFICATIONS` ya se pide (Android 13+). Live Updates (A3):
  `POST_PROMOTED_NOTIFICATIONS`, solo para actividades iniciadas por el usuario
  y con duración limitada (lo cumplen). Sin servicio en primer plano.
- Política de privacidad: no cambia (nada sale del móvil).

---

## 🔒 Decisiones del usuario

1. **¿Para quién y desde dónde se arranca «la sesión a mano»?**
   Recomiendo: **desde Comunica** (atajo de tu grupo y reuniones, que traen
   título y horas hechas) **y** una entrada simple en Más para quien no use
   Comunica. Escondido en el **Laboratorio Alpha** la primera build, como el
   pañuelo, y fuera cuando lo hayan probado dos o tres monitores.
2. **¿De dónde sale el documento?**
   Recomiendo: **enlace pegado + PDF elegido** en la primera versión (sin
   servidor). «Material asociado a la sesión en Comunica» solo si queréis
   tocar el middleware y el contrato (añadir `materials` a la sesión): es otra
   conversación.
3. **¿Recibir el PDF desde WhatsApp con «Abrir con…» o con share extension?**
   Recomiendo: **«Abrir con…»** (tipo de documento PDF, sin target nuevo, mismo
   patrón que los `.mcm`). La share extension solo si en la prueba resulta que
   WhatsApp de iPhone no ofrece la app.
4. **Uso B: ¿vale con local o queréis push?**
   Recomiendo: **local** (horas absolutas + cuenta atrás, se refresca al abrir
   la app). Push por canal de difusión (iOS 18+, Cloud Function con clave `.p8`)
   solo si en el primer encuentro se ve que se queda vieja.
5. **Android 16 Live Updates: ¿Kotlin propio o Voltra?**
   Recomiendo: **dejarlo para después** de ver A1 en uso; cuando toque,
   **módulo local** pequeño (como `highlight-menu`) antes que meter Voltra
   entero solo para eso.

---

## Fuentes (consultadas el 2026-11-16)

- `expo-widgets`, referencia SDK 58: <https://docs.expo.dev/versions/v58.0.0/sdk/widgets/> · npm `expo-widgets@58.0.28`, `@expo/ui@58.0.28`.
- Expo, «Live Activities with Expo: end-to-end client and backend» (1-oct-2026; push directo a APNs con `.p8`, no Expo Push): <https://expo.dev/blog/live-activities-with-expo-end-to-end-client-and-backend>
- Expo, «Home screen widgets and Live Activities in Expo»: <https://expo.dev/blog/home-screen-widgets-and-live-activities-in-expo>
- Voltra: <https://www.use-voltra.dev/> · iOS local: <https://www.use-voltra.dev/ios/development/managing-live-activities-locally> · plugin iOS: <https://www.use-voltra.dev/ios/api/plugin-configuration> · Android ongoing: <https://www.use-voltra.dev/android/development/managing-ongoing-notifications> · npm `voltra@2.4.0`.
- `expo-live-activity` (deprecada, archivada 1-jun-2026): <https://github.com/software-mansion-labs/expo-live-activity>
- `@bacons/apple-targets@5.0.0`: <https://github.com/EvanBacon/expo-apple-targets>
- Apple, ActivityKit: <https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities>
- Android 16, notificaciones de progreso / Live Updates: <https://developer.android.com/about/versions/16/features/progress-centric-notifications>
