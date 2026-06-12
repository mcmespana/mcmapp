# Changelog — MCM App

> Registro de cambios importantes. Agentes IA: documentad aquí los cambios significativos.
> NO documentar: ajustes cosméticos, typos, refactors sin cambio funcional.

## Formato

```
## [fecha] — Descripción breve
- Qué cambió y por qué
- Archivos principales afectados
```

---

## 2026-06-11 — Sección MCM Panel en Más (solo administradores Firebase)

- **Nueva pantalla `McmPanelScreen`**: WebView que abre `mcmpanel.vercel.app`, notch violeta oscuro (`#4C1D95`) para distinguirlo visualmente del resto de pantallas.
- **Nuevo hook `useAdminStatus`**: lee `users/{uid}/isAdmin` de Firebase RTDB en tiempo real. Devuelve `true` solo si el usuario está autenticado Y tiene ese campo a `true` en la base de datos. Completamente independiente del `isAdmin` local de `SettingsContext` (ese es para editar arreglos del cantoral).
- **`MasHomeScreen`**: añade la tarjeta "MCM Panel" (violeta, icono `tune`, emoji 🎛️) al final de la lista. Solo aparece cuando `useAdminStatus().isAdmin === true` — nunca visible a usuarios no conectados o sin el flag en Firebase.
- **`mas.tsx`**: añadida ruta `McmPanel` al stack de navegación.
- Archivos: `hooks/useAdminStatus.ts` (nuevo), `app/screens/McmPanelScreen.tsx` (nuevo), `app/(tabs)/mas.tsx`, `app/screens/MasHomeScreen.tsx`

---

## 2026-06-10 — Revisión de diseño/modo oscuro + fixes de robustez

- **`useFirebaseData` tolera caché corrupta**: antes, un `JSON.parse` fallido del
  caché local abortaba también el fetch remoto (pantalla vacía permanente hasta
  borrar datos). Ahora se descarta la entrada corrupta y se continúa con la
  descarga completa. (`hooks/useFirebaseData.ts`)
- **Fix memory leak en `HorarioScreen`**: la animación del último día (fade
  recursivo vía `setTimeout` + shake inicial) seguía ejecutándose para siempre
  tras salir de la pantalla; ahora se cancelan todos los timers en el cleanup.
- **Splash de bienvenida respeta el modo oscuro**: el contenedor de la animación
  inicial tenía fondo blanco fijo y provocaba un flash blanco al abrir la app en
  oscuro. (`app/_layout.tsx`)
- **Fix error de tipos en `SocialLoginSection`**: guard `Platform.OS !== 'android'`
  redundante (Android ya hace early-return antes) que hacía fallar `tsc --noEmit`.
- Lint a cero: corregidos los 2 errores de `react/no-unescaped-entities` en
  `contigo/revision.tsx` y los avisos de Prettier pendientes (`--fix`).
- **OTA-safe** (solo JS).

## 2026-06-09 — Encuestas: banners automáticos + identidad real (auth)

- **Banners automáticos** de encuestas genéricas sin depender de push. La app lee
  un índice ligero `surveys/_index/data` (solo metadatos, no toda la colección) y
  pinta banners en la **Home** (`home-banner`), el **hub del evento**
  (`event-banner`) y **Ajustes** (`app-settings`), filtrando por `audience`, estado
  abierto/cerrado y "ya respondida". Nuevos: `hooks/useActiveSurveys.ts`,
  `components/SurveyBanner.tsx`, helpers `SurveyIndexEntry`/`normalizeSurveyIndex`/
  `filterActiveSurveys` en `constants/surveys.ts`.
- **Identidad real**: cuando el usuario tiene sesión (Google/Apple), las respuestas
  incluyen `userId` (uid) y se escribe un marcador
  `users/<uid>/surveysAnswered/<scope>` para **deduplicar entre dispositivos** (la
  misma persona no responde dos veces). Encuestas anónimas no guardan identidad.
  Nuevo `utils/surveyIdentity.ts`; integrado en las tres pantallas. Sin cambios de
  reglas (la regla `users/$uid` ya cubre el marcador).
- Integración en `app/(tabs)/index.tsx`, `app/screens/EventHomeScreen.tsx`,
  `components/SettingsBottomSheet.tsx`. Seeds: `surveys.json` ahora incluye
  `_index`. Tests ampliados (`__tests__/surveys.test.ts`). Docs actualizadas
  (`ENCUESTAS.md`, `ENCUESTAS_CONTRATO.md`, `PROMPT_MCMPANEL_ENCUESTAS.md`).
- **OTA-safe** (solo JS).

## 2026-06-09 — Sistema de encuestas: config desde Firebase + tipos nuevos + encuestas genéricas

- **Config de encuestas/evaluaciones desde Firebase** (con fallback a código). La
  app vuelve a leer preguntas, título y estado (abierto/cerrado) de Firebase, así
  el panel crea/edita encuestas y las abre/cierra **sin OTA**. Antes (commit
  `2c6db4c`) estaba solo en código.
  - Evaluación de evento: `activities/<evento>/evaluacion/data`.
  - Evaluación de la app: nuevo nodo `app/evaluationConfig/data` (separado de las
    respuestas en `app/evaluations`).
- **Nuevos tipos de pregunta** en el wizard: `scale` (escala/NPS), `single`
  (opción única/radio), `multi` (opción múltiple/checkbox), además de
  `stars`/`text`/`yesno`. Respuesta de `multi` es `string[]`.
- **Encuestas genéricas** `/surveys/<id>`: nueva pantalla `SurveyScreen` + ruta
  raíz `app/encuesta/[id].tsx` (deep link/push `/encuesta/<id>`). Soportan
  audiencia por perfil (`matchesAudience`), ventana de apertura (`status` +
  `opensAt`/`closesAt`), modo anónimo y textos de cierre/agradecimiento.
- **Estado y helpers** en `constants/evaluation.ts` (`status`, `isEvaluationOpen`,
  `mergeEvaluationConfig`, campos `thanksTitle`/`thanksBody`/`closedTitle`/…) y
  modelo genérico en `constants/surveys.ts`.
- **Reglas RTDB**: `surveys` (lectura pública, escritura solo en
  `respuestas/<deviceId>` + `updatedAt`) y `app/evaluationConfig` (lectura).
- **Seeds**: `firebase-seed/{app-evaluation-config,surveys}.json`. **Tests**:
  `__tests__/surveys.test.ts`.
- Archivos: `constants/evaluation.ts`, `constants/surveys.ts`,
  `components/EvaluationWizard.tsx`, `app/screens/{EvaluacionScreen,EvaluacionAppScreen,SurveyScreen}.tsx`,
  `app/encuesta/[id].tsx`, `app/_layout.tsx`, `app/(tabs)/index.tsx`,
  `database.rules.json`.
- Docs: `ENCUESTAS.md`, `ENCUESTAS_CONTRATO.md`, `PROMPT_MCMPANEL_ENCUESTAS.md`
  (raíz del monorepo); actualizado `EVENTOS.md`.
- **OTA-safe** (solo JS, sin dependencias nativas).

## 2026-06-09 — Playlist: drag & drop para reordenar + "Orden ajustado" por defecto

- La pantalla de playlist abre ahora **por defecto en "Orden ajustado"** (antes
  "Por categoría"); el toggle entre vistas sigue disponible.
- **Drag & drop** en nativo: long-press sobre una fila inicia el arrastre para
  reordenar (`ReorderableList`); al soltar se llama a `moveSong` del contexto
  (renumera `order` y persiste). Las flechas ↑/↓ se mantienen como alternativa
  y son el único método en web (la lista reordenable usa gestos nativos).
- **Nueva dependencia** `react-native-reorderable-list` (JS puro sobre
  `react-native-reanimated` + `react-native-gesture-handler`, ya presentes) →
  **compatible con OTA**, no requiere build.
- Cambios: `app/screens/SelectedSongsScreen.tsx` (lista reordenable +
  `DraggableManualRow`), `components/playlist/PlaylistRow.tsx` (prop
  `onLongPress`).

## 2026-06-09 — Playlist: QR para compartir/coro + contraseña al sobrescribir en la nube

- **QR de compartir**: al subir una playlist o iniciar un coro, el diálogo de
  éxito es ahora un modal con **QR del enlace universal**
  (`https://mcm.expo.app/playlist?p=XXXX` / `/coro?c=XXXX`), el código en
  grande y botones de copiar. Escaneado con la cámara del móvil abre la app
  directamente (deep links ya existentes). También hay "Ver QR" en el menú de
  acciones (sección nube si hay código subido; sección coro si hay sesión).
  Nuevo `components/playlist/ShareQrModal.tsx`.
- **Nueva dependencia** `react-native-qrcode-svg` (JS puro sobre
  `react-native-svg`, ya presente) → **compatible con OTA**, no requiere build.
- **Contraseña al sobrescribir**: subir a un código que ya existe en la nube
  pide la contraseña ("coco") antes de machacar el contenido — cubre el caso
  de re-subir una playlist descargada de otro dispositivo. Nuevo
  `components/playlist/PasswordPromptModal.tsx` (genérico).
- **Fix**: el nombre de la playlist nunca llegaba a Firebase al subirla — el
  wrapper de `onSubmit` en `SelectedSongsScreen` descartaba el `name` que
  emite `CodeInputModal`.

## 2026-06-09 — Menú de acciones de la playlist reorganizado por secciones

- El bottom-sheet de acciones de la playlist (`PlaylistActionsBottomSheet`)
  pasa de una lista plana (~12 items con separadores sueltos) a **secciones con
  cabecera**: Exportar y compartir · Playlist en la nube · Archivo · Modo coro ·
  zona de peligro (Vaciar) al final. API del componente: prop `sections`
  (`PlaylistActionSection[]`) en lugar de `actions`.
- Etiquetas más cortas al apoyarse en la cabecera de sección ("Subir playlist
  (compartir código)", "Exportar archivo (.mcm)"…).

## 2026-06-09 — Export PDF de playlists: toggles arreglados, márgenes iOS, fecha editable y pie de página

- **Fix: los toggles del modal de export ("Una canción por página" y "Mostrar
  acordes") no se veían** — el `Switch` de heroui-native se pintaba invisible
  dentro del Modal RN. Sustituidos por un toggle propio (track+thumb con
  `StyleSheet`, tamaño y colores explícitos, accesible y con háptica `h.toggle`).
  `components/playlist/ExportPdfModal.tsx`.
- **Fix márgenes en iOS**: el motor de impresión de iOS ignora el `margin` de
  `@page`; ahora `printToFileAsync` recibe tamaño A4 (595×842 pt) y `margins`
  nativos (51/45 pt ≈ 18/16 mm) — opción que expo-print solo aplica en iOS;
  Android sigue usando el `@page` del HTML. `app/screens/SelectedSongsScreen.tsx`.
- **Fecha de portada editable**: nuevo campo "Fecha en la portada" en el modal
  (texto libre, prefijado con hoy; vacío = no imprimir fecha). `printedDate`
  viaja por `PdfExportConfig` → `buildPlaylistPdfHtml`.
- **Pie de página**: nombre de la playlist (abajo-izda) y "Página N"
  (abajo-dcha) vía margin boxes de `@page`, sin pie en la portada. Soportado en
  web (Chrome ≥131) y WebView de Android; **pendiente validar en iOS** (WebKit
  no soporta margin boxes — probablemente no salga ahí). El "1 de 3" por
  canción multipágina no es viable con CSS de impresión; queda anotado en
  TODO.md. `utils/playlistPdfHtml.ts`.
- Tests nuevos: `__tests__/playlistPdfHtml.test.ts` (fecha y pie). Jest ahora
  transforma `chordsheetjs` y mockea `jspdf`/`html2canvas` igual que Metro
  (`jest.config.js`).

## 2026-06-09 — Reglas de seguridad de Firebase RTDB + despliegue automático

- Reescritas las reglas de la Realtime Database (`mcm-app/database.rules.json`)
  con cobertura completa de todos los nodos que usa la app, **separadas por
  sección y comentadas** para poder activar/desactivar partes sin romper el
  resto. Política: denegado por defecto, lectura pública solo del contenido
  público, escritura pública solo en los nodos concretos (reportes, reflexiones,
  `pushTokens`, evaluaciones, wordle, playlists/coros), `/users/$uid` solo para
  el dueño autenticado, y `notifications` solo-lectura (lo escribe el Admin SDK).
- `firebase.json` ahora incluye la clave `database` → las reglas se despliegan
  con `firebase deploy --only database`. (Antes el fichero de reglas no se
  desplegaba.)
- Nuevo workflow `.github/workflows/deploy-firebase-rules.yml`: despliega las
  reglas al mergear a `production` (solo si cambiaron), usando el secret
  `FIREBASE_SERVICE_ACCOUNT_MCMAPP`. Inerte hasta configurar el secret.
- Nueva documentación `SEGURIDAD.md` (raíz): mapa de paths, riesgos (el panel
  secreto `coco` es el punto débil), cómo desplegar y qué falta (App Check,
  migrar admin a Auth, backups…).
- Eliminado `database.rules.proposed.json` (borrador superseded; además dejaba
  `songs/data` solo-lectura, lo que habría roto el panel de edición).

## 2026-06-08 — Notificaciones: descripción extendida (`bodyLong`)

- Nuevo campo opcional **`bodyLong`** en las notificaciones: descripción larga que se
  muestra en el **modal de detalle** (scrollable, respeta saltos de línea). La
  **tarjeta** sigue usando el `body` corto. El detalle muestra `bodyLong` si existe;
  si no, cae a `body` (fallback).
- La deduplicación de la lista ahora **fusiona** `bodyLong` entre la copia local (push)
  y la de Firebase, de modo que el texto largo aparece aunque solo venga por uno de los
  dos orígenes (p. ej. si el panel lo manda solo a Firebase para no inflar el payload).
- Tipos: campo `bodyLong?` en `NotificationData` y `ReceivedNotification`.
- Archivos: `types/notifications.ts`, `app/notifications.tsx`,
  `notifications/usePushNotifications.ts`. Compatible con OTA (JS puro). El MCM Panel
  debe enviar `data.bodyLong` — ver `NOTIFICACIONES_CONTRATO.md` §3.bis.

## 2026-06-06 — Notificaciones: varios botones de acción (hasta 3)

- **Antes** una notificación solo mostraba **un** botón de acción (`actionButton`);
  el array `actionButtons` del panel se aceptaba pero solo se usaba el primer
  elemento. **Ahora** se soportan **hasta 3 botones** por notificación, tanto en la
  tarjeta del centro de notificaciones (un chip por botón) como en el modal de
  detalle (botones apilados: el 1.º primario, los siguientes secundarios).
- Nuevo `extractActionButtons()` en `utils/notificationRoutes.ts` (límite
  `MAX_ACTION_BUTTONS = 3`): acepta el array `actionButtons` y el objeto único
  `actionButton` (legacy), los combina y deduplica por `url|text`. Se conserva
  `extractActionButton()` como atajo al primer botón.
- Tipos: `NotificationActionButtonData` + campo `actionButtons[]` en
  `NotificationData` y `ReceivedNotification` (`actionButton` se mantiene por
  compatibilidad).
- Archivos: `utils/notificationRoutes.ts`, `types/notifications.ts`,
  `app/notifications.tsx`, `services/pushNotificationService.ts`,
  `notifications/usePushNotifications.ts`, `__tests__/notificationRoutes.test.ts`.
- Compatible con OTA (JS puro, sin código nativo). El MCM Panel debe enviar
  `data.actionButtons` (array) — ver `NOTIFICACIONES_CONTRATO.md` §3.

## 2026-06-07 — Evaluación: wizard tipo onboarding + ajustes de ubicación

- **Evalúa la actividad → wizard animado** (`EvaluationWizard`): una fase por
  pregunta, barra de progreso, transiciones (Reanimated, sin nuevas deps),
  bienvenida y pantalla final de agradecimiento con animación. Sustituye al
  formulario de scroll. La pantalla `Evaluacion` pasa a `headerShown: false`.
- **Preguntas en código** (`DEFAULT_EVENT_EVALUATION`): General, Organización
  MCM, Organización Visita del Papa, Convivencia, Más gustado, Mejorar,
  Comentarios. Respuestas a Firebase (`<evento>/evaluacion/respuestas`).
- **CTA "Evalúa la actividad" en la Home** encendido por código
  (`evaluationOpen`), sin depender de Firebase.
- **Evalúa la app → Ajustes**: deja de estar en el hub del evento y en la Home;
  se abre desde el panel de Ajustes como pantalla raíz (`app/evaluacion-app.tsx`).

## 2026-06-07 — Sección de Evaluación (evento + app)

- **Nueva sección "Evalúa"**: dos pantallas nuevas para recoger feedback al
  terminar un evento:
  - **Evalúa la actividad** (`EvaluacionScreen`): valoración por estrellas +
    preguntas abiertas (lo que más gustó, palabras del Papa, momento
    inolvidable, mejoras…). Las preguntas se leen de Firebase
    (`activities/<evento>/evaluacion/data`) con _fallback_ en código; las
    respuestas se escriben en `activities/<evento>/evaluacion/respuestas`.
  - **Evalúa la app** (`EvaluacionAppScreen`): valoración de la app + errores,
    utilidad e ideas. Respuestas en `app/evaluations`.
- **Banner en la Home** "Evalúa la actividad": aparece cuando el panel enciende
  `evaluationOpen` en el nodo de evaluación del evento activo y el usuario aún
  no ha evaluado (flag local en AsyncStorage). Mismo gating de perfil que el
  banner de evento.
- **Tarjetas en el hub del evento** (Visita Papa): "Evalúa la actividad" (⭐) y
  "Evalúa la app" (📝).
- **Anti-duplicado**: tras enviar, se guarda `evaluacion_done_<scope>` en
  AsyncStorage; el formulario muestra un estado de agradecimiento con opción a
  reenviar y el banner se oculta.
- **Seed Firebase**: `firebase-seed/evaluacion.json` listo para importar en
  `activities/visitapapa26/evaluacion` (incluye `evaluationOpen` y preguntas).
- Componentes nuevos: `components/StarRating.tsx`, `components/EvaluationForm.tsx`.
  Config/tipos en `constants/evaluation.ts`. Deep-link al stack de evento vía
  `utils/eventNavigation.ts`. Archivos tocados: `constants/events.ts`,
  `app/screens/eventStackScreens.tsx`, `app/(tabs)/visitapapa.tsx`,
  `app/(tabs)/index.tsx`.

## 2026-06-06 — Fix layout de Materiales

- **Materiales · tarjetas empujadas abajo / hueco enorme**: el `DateSelector`
  (un `FlatList` horizontal) iba suelto como hijo directo del contenedor flex en
  columna, así que crecía en vertical y empujaba el `ScrollView` de tarjetas al
  fondo (cortándolas). Se envuelve en una `View` (mismo patrón que
  `HorarioScreen`) para limitarlo a su altura natural. Archivo:
  `app/screens/MaterialesScreen.tsx`.

## 2026-06-06 — Tab bar iOS visible + icono verde en carismochito

- **Tab bar inferior translúcida/ilegible en iOS ≤18**: la barra nativa
  (`NativeTabs`) se vuelve transparente al llegar al final del scroll o cuando
  el contenido es una `View` estática, dejando los iconos flotando sobre el
  contenido. Se añade `disableTransparentOnScrollEdge` (mantiene el fondo en el
  borde del scroll) + `blurEffect="systemChromeMaterial"` (material adaptado al
  tema). En iOS 26+ el sistema usa liquid glass y ambos se ignoran (allí ya se
  veía bien). Archivo: `app/(tabs)/_layout.tsx`.
- **Modo carismochito · icono de la app en verde**: el cuadro-logo del header de
  la Home se tiñe de verde mientras el modo está activo. Archivo:
  `app/(tabs)/index.tsx`.

## 2026-06-06 — Fixes Android (tab bar) y mejoras en Grupos

- **Tab bar inferior tapada por la barra de navegación de Android**: en Expo 55
  Android va edge-to-edge (la app dibuja detrás de la barra del sistema). La tab
  bar tenía altura fija de 80 sin contar `insets.bottom`, por lo que en móviles
  con barra de gestos/3 botones visible quedaba parcialmente tapada. Ahora se
  suma el safe-area inferior a la altura y al padding. Archivo:
  `app/(tabs)/_layout.tsx`.
- **Grupos · bug del buscador (teclado que se escondía al escribir):** al cruzar
  el umbral de 2 caracteres la pantalla cambiaba todo su árbol de `ScrollView`
  (categorías) a `SectionList` (resultados), por lo que el buscador se
  desmontaba/remontaba y perdía el foco. Ahora vive en una barra superior
  **siempre montada**; solo cambia el contenido inferior. Se añadió
  `keyboardShouldPersistTaps`.
- **Grupos · barra de búsqueda rediseñada**: se sustituye el `SearchField` de
  heroui-native (se veía comprimido y con el texto poco legible en modo oscuro)
  por una barra propia (`TextInput`) más grande, idéntica en iOS/Android y con
  **texto blanco garantizado en oscuro**. Botón "Encuéntrame" más prominente.
- **Grupos · "Encuéntrame" con búsqueda amplia:** busca `nombre + 2 primeras
  letras del apellido` (ej. "David So"), de modo que encuentra entradas
  abreviadas como "David Sol. (Castellón)".
- **Grupos · categorías ocultas por evento**: nueva propiedad
  `hiddenGroupCategories` en `EventConfig`. La Visita del Papa oculta la
  categoría **Alojamiento** (en la cuadrícula y en la búsqueda). Archivos:
  `constants/events.ts`, `app/screens/GruposScreen.tsx`.

## 2026-06-05 — Login deshabilitado temporalmente en Android ("próximamente")

- El inicio de sesión en Android queda **temporalmente desactivado** mientras se
  reparan los proveedores nativos. En su lugar se muestra un aviso
  **"Inicio de sesión próximamente"**.
- **Onboarding**: el paso de login se **salta por completo** en Android. Los
  perfiles `monitor`/`miembro` van directos al resumen final (en iOS/web sigue
  igual). El indicador de pasos se ajusta automáticamente.
- **Menú "Más" / hoja de cuenta**: `SocialLoginSection` muestra el aviso de
  "próximamente" en lugar de los botones de Google/Apple en Android. Los usuarios
  que ya tuvieran sesión iniciada siguen viendo su cuenta (y pueden cerrar sesión).
- Archivos: `app/onboarding.tsx` (`needsLoginStep`), `components/SocialLoginSection.tsx`.

## 2026-06-05 — Fixes de calendario y notificaciones (Home + deep-link)

- **Botones de calendario de la Home arreglados en iOS**: las tarjetas de
  "Próximos eventos", el botón "Ver calendario" y el CTA de "Ir al calendario"
  no hacían nada en iOS. Causa: en iOS `calendario` (y `fotos`) son tabs
  _overflow_ sin trigger nativo (solo caben 5 en la barra), así que
  `router.push('/calendario')` no navegaba. Ahora la Home los alcanza vía el
  stack de "Más" (igual que el acceso de Fotos); en Android/Web siguen yendo al
  tab directo. El salto a fecha concreta también funciona en iOS.
- **La tarjeta de Novedades abre la última notificación "en grande"**: al tocar
  la tarjeta de la Home se abre directamente el detalle de la última
  notificación, en vez de la lista completa. La campana del header sigue
  abriendo la lista.
- **Sin título duplicado en el detalle**: el bottom sheet de notificaciones ya
  no repite el título de la notificación en su cabecera cuando se ve el detalle
  (solo queda la flecha de volver).
- **Deep-link de push → detalle de la notificación**: al tocar una notificación
  desde la bandeja del sistema, la app abre el centro de notificaciones y
  despliega esa notificación concreta (`/notifications?openId=<id>`). Si la
  notificación trae `internalRoute`, se respeta ese destino.
- Archivos: `app/(tabs)/index.tsx`, `app/(tabs)/calendario.tsx`,
  `app/notifications.tsx`, `components/NotificationsBottomSheet.tsx`,
  `notifications/usePushNotifications.ts`, `utils/masNavigation.ts`,
  `app/screens/MasHomeScreen.tsx`.

## 2026-06-05 — Fixes onboarding Android: login, botón "saltar" y toasts

- **Login con Google en Android ya no muestra error al cancelar**: al cerrar el
  selector de cuenta, `@react-native-google-signin` v13+ devuelve
  `{ type: 'cancelled' }` (o lanza `SIGN_IN_CANCELLED`). Antes se trataba como
  un fallo real y aparecía el toast "No se pudo iniciar sesión". Ahora se
  normaliza a `ERR_CANCELED` y se ignora como una cancelación normal.
  Archivo: `utils/platformAuth.native.ts`.
- **Botón "Entrar sin iniciar sesión" reubicado en zona segura**: en el paso de
  login del onboarding el enlace inferior quedaba bajo la barra de navegación de
  3 botones de Android y no se podía pulsar. Ahora respeta el safe-area inferior
  (`insets.bottom`) y se presenta como botón tipo píldora, más visible y con
  mayor área de toque. Archivo: `app/onboarding.tsx`.
- **Toasts ya no quedan ocultos bajo la barra de 3 botones en Android**: se sube
  el margen inferior mínimo del toast para garantizar que despeja la barra de
  navegación aunque el inset reportado sea 0. Archivo:
  `contexts/AppToastContext.tsx`.

## 2026-06-05 — Modo Carismochito: persistente y menos intrusivo

- **Persiste al cerrar y reabrir la app**: si el modo queda activo, se recuerda
  en AsyncStorage (`@carismochito_active`) y al volver a abrir se restaura
  **en silencio** (sin cuenta atrás, sin confeti, sin háptica). El confeti y el
  badge superior sólo aparecen en una **activación nueva** (flag
  `freshlyActivated`).
- **Badge superior efímero**: el rótulo "MODO CARISMOCHITO" se asoma unos
  segundos (~3,8 s) y se retira solo para no estorbar. Se sigue saliendo del
  modo agitando el móvil.
- **Adiós al resplandor verde inferior + mascota bailando siempre**. En su lugar,
  el carismochito **se asoma girado 90° desde un lateral** de forma esporádica
  (cada ~45–90 s, alternando lados y altura) y vuelve a esconderse. El tinte
  verde sutil de componentes heroui y barra de pestañas se mantiene.
- Archivos: `contexts/CarismochitoContext.tsx`,
  `components/CarismochitoOverlay.tsx`.

## 2026-06-04 — Modo Carismochito: ritual de agitado + rediseño visual

- **Activación por ritual de sacudidas**: ahora hace falta **agitar 5 veces**
  (dentro de una ventana de 2,5 s) para arrancar la cuenta atrás, en vez de una
  sola sacudida. **Cada sacudida vibra** (golpe háptico) y aparece una fila de
  **puntos verdes** que se van iluminando como barra de carga; si dejas de
  agitar, la carga se reinicia.
- **Nuevo efecto visual al activar** (sustituye al lavado verde de pantalla
  completa): **estallido de confeti** de ~4 s que luego deja la pantalla limpia,
  **barra inferior verde con resplandor pulsante** y el **carismochito bailando**
  asomado por encima de los iconos de las pestañas. En Android/Web la barra de
  pestañas real también se tiñe de verde mientras el modo está activo.
- Archivos: `contexts/CarismochitoContext.tsx`,
  `components/CarismochitoOverlay.tsx`,
  `components/CarismochitoChargeDots.tsx` (nuevo), `app/(tabs)/_layout.tsx`.

## 2026-06-04 — Cantoral: sistema multimedia y ficha de canción

- **Nuevo sistema multimedia en el detalle de canción**. Los campos que el admin
  ya rellenaba en Firebase (`album`, `source`, `rhythm`, `videoEmbed`,
  `youtubeLinks`, `audioLinks`) ahora **se muestran al usuario final** sin
  estorbar la lectura en directo. El FAB "tune" se queda solo con controles de
  lectura; toda la multimedia entra por **una sola puerta**.
- **Botón multimedia** (glass) en la barra superior del detalle, a la izquierda
  de "añadir", con punto rojo (accent) cuando la canción tiene material. Solo
  aparece si hay multimedia. Abre el cajón "Multimedia y ficha" con tres
  secciones: **Vídeos**, **Audios** y **Ficha**.
- **Reproductor flotante de YouTube** (estilo PiP) arrastrable que se superpone
  a la letra; botón de pantalla completa. Usa `react-native-webview` en nativo e
  `<iframe>` en web (sin dependencias nativas nuevas → publicable por OTA).
- **Audios** (Google Drive) → no se pueden embeber: se abren en el navegador con
  `expo-web-browser` + toast "Abriendo en el navegador…".
- **Indicador sutil en la lista** (▶ vídeo / 🎧 audio por fila) + leyenda junto
  al contador de canciones.
- **Nuevo campo `liturgicalTime`** (Tiempo litúrgico) en el panel de admin
  (`SecretPanelModal`) y en la ficha. Se guarda en `songs/data/.../liturgicalTime`.
- **Data plumbing**: los campos multimedia viajan ahora en los params de
  navegación a `SongDetail` (offline-friendly, igual que `content/key/capo`).
- Archivos principales: `types/songMedia.ts` (nuevo),
  `components/song-media/SongMediaSheet.tsx` (nuevo),
  `components/song-media/FloatingYouTubePlayer.tsx` (nuevo),
  `app/screens/SongDetailScreen.tsx`, `app/screens/SongListScreen.tsx`,
  `app/screens/SelectedSongsScreen.tsx`, `components/SongListItem.tsx`,
  `app/(tabs)/cancionero.tsx`, `utils/filterSongsData.ts`,
  `components/SecretPanelModal.tsx`.

## 2026-06-03 — Rediseño de la pantalla de Horario + fix del día por defecto

- **Rediseño visual del Horario** (`app/screens/HorarioScreen.tsx`,
  `components/EventItem.tsx`, `components/DateSelector.tsx`): nueva línea de
  tiempo vertical con la **hora como protagonista** (grande, en el color del
  día), tarjetas con sombra suave, ubicación en formato "pill" con icono, y
  selector de fechas con chips más legibles (día grande + mes + día de la
  semana).
- **Web — header**: el título "Horario" pasa al propio header de navegación
  (con el botón Atrás separado del borde) y se elimina el `ScreenHero`
  duplicado; el selector de fechas queda pegado al header y centrado. En
  iOS/Android se mantiene el `ScreenHero`.
- **Fix: día por defecto**. La pantalla abría en el último día en vez del más
  cercano a hoy porque el parser sólo entendía el formato español "6 de junio"
  y devolvía `null` con fechas tipo ISO ("2026-06-06"), cayendo al último día.
  Nueva utilidad `utils/dateUtils.ts` (`parseHorarioDate` + `getClosestDateIndex`)
  que entiende ambos formatos y la comparten el selector y la pantalla.
- **Header web coherente en todas las sub-pantallas de evento** (Horario,
  Materiales, Visitas, Profundiza, Grupos, Contactos, Apps): el título pasa al
  propio header de navegación (alineado a la izquierda) y se oculta el hero
  in-content (`ScreenHero` ahora acepta `hideOnWeb`). El botón "Atrás" se separa
  del borde izquierdo en web en todas las sub-pantallas. Centralizado en
  `eventScreenOptions` (`app/screens/eventStackScreens.tsx`) mediante el flag
  `webHeaderTitle`; el hub y "Compartiendo" no lo activan para no duplicar
  título. En iOS/Android no cambia nada (sigue el hero del contenido).

## 2026-06-03 — Logo "alzad la mirada" en hero de Visita Papa + mascota carismochito PNG

- **`EventConfig.heroImage`** (`constants/events.ts`): nuevo campo opcional para
  el logo/emblema del evento. El hub del evento (`EventHomeScreen`) muestra ese
  logo en el hero si está definido; si no, mantiene el emblema-placeholder.
- **Visita Papa** usa `assets/alzalamirada.png` como logo del hero.
- **Mascota carismochito**: `CarismochitoMascot` ahora carga
  `assets/carismochito.png` (el `require` estaba comentado y apuntaba a una ruta
  inexistente `assets/images/`). Si se pone a `null` vuelve la versión vectorial.
- Imágenes optimizadas: `carismochito.png` 2.1 MB → 96 KB y `alzalamirada.png`
  196 KB → 50 KB (redimensionadas + paleta de 256 colores con transparencia).
- Archivos: `constants/events.ts`, `app/screens/EventHomeScreen.tsx`,
  `components/CarismochitoMascot.tsx`, `assets/carismochito.png`,
  `assets/alzalamirada.png`.

## 2026-06-03 — Eliminación de cuenta (requisito App Store 5.1.1(v))

- **Nueva opción "Eliminar cuenta"** en la tarjeta de usuario autenticado de
  `components/SocialLoginSection.tsx` (visible en Ajustes, LoginSheet y
  onboarding). Pide confirmación (Alert en nativo, `window.confirm` en web) y
  ejecuta un borrado permanente. Cumple Guideline 5.1.1(v): toda app que
  permite crear cuenta debe permitir eliminarla desde la propia app.
- **`AuthContext.deleteAccount()`** (`contexts/AuthContext.tsx`): borra el nodo
  RTDB `users/{uid}` (perfil, delegación y datos de CONTIGO) y después la cuenta
  de Firebase Authentication con `deleteUser`. Maneja
  `auth/requires-recent-login` reautenticando con el proveedor (Google/Apple) y
  reintentando. Devuelve `'success' | 'cancelled' | 'error'`.
- **`utils/authHelpers.ts`**: nueva función `deleteUserData(uid)` que elimina
  `users/{uid}` de RTDB.
- Al eliminar la cuenta se limpia también el nombre guardado localmente.

## 2026-06-03 — Fix panel secreto del cantoral + menús contextuales en Contactos y Reflexiones

- **Fix: el "Panel Secreto" no aparecía** (`components/ReportBugsModal.tsx`).
  Al pulsar "Panel Secreto" se cerraba el bottom sheet de reporte y se abría el
  panel en el mismo tick; como `BottomSheet` usa `Modal` de RN e iOS no permite
  dos modales simultáneos, el panel nunca se montaba (no se podía introducir la
  contraseña ni, por tanto, usar el sistema de arreglos `{arr:}`). Ahora la
  apertura del panel se difiere a `onCloseComplete` (tras el `onDismiss`), como
  ya hace el resto de la app.
- **Menús contextuales (long-press) en listas** (nuevo
  `components/ContextMenuSheet.tsx` + `hooks/useContextMenu`):
  - **Contactos** (`app/screens/ContactosScreen.tsx`): long-press → Llamar /
    WhatsApp / Copiar teléfono.
  - **Reflexiones** (`app/screens/ReflexionesScreen.tsx`): long-press → Copiar /
    Compartir.
  - El nuevo `ContextMenuSheet` es reutilizable (lista de acciones con icono,
    soporte destructivo/disabled) y ejecuta la acción en `onCloseComplete` para
    no colisionar con Share/otros modales en iOS.

## [2026-06-03] — Fix: login con Google roto en nativo tras OTA

- **Causa**: las variables `EXPO_PUBLIC_GOOGLE_*` se hornean en el bundle JS, pero
  los workflows de OTA (`eas update`) solo inyectaban las `EXPO_PUBLIC_FIREBASE_*`.
  Cada OTA dejaba `GoogleSignin.configure()` con client IDs `undefined`, así que en
  iOS el diálogo de Google ni se abría (TestFlight funcionaba al instalar el build,
  que sí los traía vía `eas.json`, y se rompía tras la primera OTA encima). Android
  además nunca tuvo `webClientId` (obligatorio para el idToken).
- **Fix**:
  - `.github/workflows/ota-production.yml` y `ota-preview.yml`: añadidos
    `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` y `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` al `env`.
  - `eas.json`: añadido `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` a los 4 perfiles
    (antes solo estaba el de iOS).
  - `contexts/AuthContext.tsx`: `signInWithGoogle`/`signInWithApple` ahora
    re-lanzan los errores reales (no las cancelaciones) para que la UI muestre el
    toast de error en vez de fallar en silencio.
- **Nota web**: el `auth/unauthorized-domain` que apareció en `mcm.expo.app` era
  ajeno al repo — se había quitado el dominio de la lista de "Authorized domains"
  de Firebase Console; se volvió a añadir y quedó resuelto.

## 2026-06-03 — Modo Carismochito: tema verde, cuenta atrás con anillo, haptics y mascota que baila

- **Tema verde "de verdad" al activar** (`utils/heroUIRuntimeTheme.ts` →
  `setCarismochitoTheme`, `contexts/CarismochitoContext.tsx`): al entrar en el
  modo se tiñe la capa de componentes heroui-native con varios verdes distintos
  (accent/success/danger/warning/focus/link) reutilizando el mismo mecanismo de
  variables CSS que el modo claro/oscuro (toggle reactivo, sin tocar los ~60
  archivos que usan `colors` estático). Se restaura el tema base al salir o al
  desmontar. La capa propia (StyleSheet) se cubre con el lavado verde envolvente.
- **Cuenta atrás rediseñada** (`components/CarismochitoOverlay.tsx`): pasa a 3 s
  con un **anillo de progreso** SVG que se vacía alrededor de la mascota que
  baila, con el número dentro. Sustituye al número gigante anterior.
- **Respuesta háptica** (`utils/haptics.ts`: `shake`, `carismoOn`, `carismoOff`):
  golpe al agitar el móvil, secuencia festiva al activarse y doble golpe al
  desactivarse/cancelar.
- **Mascota carismochito que baila** (`components/CarismochitoMascot.tsx`): nuevo
  componente con baile (balanceo + salto + escala). Usa un carismochito vectorial
  de respaldo y admite un **PNG** dejándolo en `assets/images/carismochito.png` y
  descomentando una línea `require` (interruptor documentado en el archivo).
- Dependencias ya presentes: `expo-haptics`, `expo-sensors`, `expo-image`,
  `react-native-svg` (sin paquetes nativos nuevos → no requiere build de tienda).

## 2026-06-03 — Eventos: fix header transparente, botón Atrás y formulario Compartiendo

- **Header de sub-pantallas realmente transparente**
  (`app/screens/eventStackScreens.tsx`): la barra flotante se pinta ahora con el
  color de fondo de la pantalla (capa opaca) en vez de dejar un `View`
  transparente que dejaba ver el material gris translúcido nativo por detrás. La
  barra se funde con el contenido y desaparece el "doble cristal" que se veía
  bajo el botón Atrás.
- **Botón Atrás (y demás cristales) bien redondeados**
  (`components/ui/GlassSurface.ios.tsx`): el radio del contenedor se aplica
  también a la capa nativa `GlassView`/`BlurView`, evitando el borde rectangular
  que se percibía como una segunda capa.
- **Compartiendo: selector de fecha en modal centrado**
  (`app/screens/ReflexionesScreen.tsx`): se sustituye el `Dialog` de heroui
  (cuyo spinner nativo se escapaba a la esquina superior al anidarse con el
  bottom sheet) por un `Modal` nativo centrado con botón "Listo".
- **Compartiendo: se elimina "Compartir en grupo"** del formulario y se cambia
  el subtítulo del hero a "Comparte aquí una frase, pensamiento o algo que te
  llevas de estos días".
- **Visita Papa: barra de color superior en toda la sección**
  (`app/(tabs)/visitapapa.tsx`): franja del color de la sección (#FCD200) arriba
  del todo, al estilo iOS de Calendario y Fotos, sobre todo el stack del evento.
- **Compartiendo: el "+" pasa del FAB a la barra superior**
  (`components/EventActionButtons.tsx`, `ReflexionesScreen.tsx`,
  `app/(tabs)/visitapapa.tsx`, `app/(tabs)/mas.tsx`): se elimina el FAB flotante;
  al estar en Compartiendo, la barra de acciones muestra un "+" (junto a
  Ajustes) que abre el formulario vía renavegación con `openFormNonce`.
- **Compartiendo: tarjetas rediseñadas** (`ReflexionesScreen.tsx`): cada
  reflexión tiene un color generado de su id, avatar con iniciales, marca de
  cita y dos diseños alternos (fondo tintado / tarjeta limpia con barra de
  color) para dar variedad. Estado vacío amable cuando no hay reflexiones.

## 2026-06-03 — Modo Carismochito: tema verde, cuenta atrás con anillo, haptics y mascota que baila

- **Tema verde "de verdad" al activar** (`utils/heroUIRuntimeTheme.ts` →
  `setCarismochitoTheme`, `contexts/CarismochitoContext.tsx`): al entrar en el
  modo se tiñe la capa de componentes heroui-native con varios verdes distintos
  (accent/success/danger/warning/focus/link) reutilizando el mismo mecanismo de
  variables CSS que el modo claro/oscuro (toggle reactivo, sin tocar los ~60
  archivos que usan `colors` estático). Se restaura el tema base al salir o al
  desmontar. La capa propia (StyleSheet) se cubre con el lavado verde envolvente.
- **Cuenta atrás rediseñada** (`components/CarismochitoOverlay.tsx`): pasa a 3 s
  con un **anillo de progreso** SVG que se vacía alrededor de la mascota que
  baila, con el número dentro. Sustituye al número gigante anterior.
- **Respuesta háptica** (`utils/haptics.ts`: `shake`, `carismoOn`, `carismoOff`):
  golpe al agitar el móvil, secuencia festiva al activarse y doble golpe al
  desactivarse/cancelar.
- **Mascota carismochito que baila** (`components/CarismochitoMascot.tsx`): nuevo
  componente con baile (balanceo + salto + escala). Usa un carismochito vectorial
  de respaldo y admite un **PNG** dejándolo en `assets/images/carismochito.png` y
  descomentando una línea `require` (interruptor documentado en el archivo).
- Dependencias ya presentes: `expo-haptics`, `expo-sensors`, `expo-image`,
  `react-native-svg` (sin paquetes nativos nuevos → no requiere build de tienda).

## 2026-06-02 — Eventos (Visita Papa): rediseño de headers, hero, estados vacíos y FABs

- **Sub-pantallas sin header (transparente) en todas las plataformas**
  (`app/screens/eventStackScreens.tsx`, `components/ui/GlassBackButton.tsx`):
  las sub-pantallas con título grande propio (Horario, Materiales, Visitas,
  Profundiza, Grupos, Contactos, Apps y Compartiendo) ya no tienen barra de
  header; es totalmente transparente. El título del header se oculta de forma
  fiable y "Atrás" pasa a ser solo un chevron liquid-glass flotante (sin texto).
  Se corrige el doble safe-area top (hueco blanco) en `HorarioScreen`.
- **Acciones de evento como grupo segmentado glass arriba a la derecha**
  (`components/EventActionButtons.tsx`): Compartiendo + Ajustes pasan de FABs
  apilados abajo a un único grupo liquid-glass **juntos**, neutro (sin el verde),
  alineado con la fila del header — coherente con los controles del cantoral.
- **Hub del evento con hero** (`app/screens/EventHomeScreen.tsx`): hero con
  degradado del color del evento (emblema + título + subtítulo) que rellena el
  espacio superior, lema **"Alzad la mirada"** al pie. El header nativo se oculta
  cuando el hub es la raíz de la tab (sin hueco blanco) y solo aparece, con el
  chevron flotante, al abrirlo desde "Más". El emblema es un placeholder fácil
  de sustituir por el logo del encuentro.
- **Estados vacíos "Próximamente"** (`components/ui/ComingSoon.tsx` + Horario,
  Materiales, Visitas, Profundiza, Grupos, Contactos, Apps): cuando una sección
  no tiene datos en Firebase (o llegan vacíos/mal formados) se muestra un estado
  vacío elegante en vez de un esqueleto infinito. **Fix de crash en
  `ProfundizaScreen`** (`data.paginas.map` reventaba si faltaba `paginas`).
- **Compartiendo (Reflexiones)** (`app/screens/ReflexionesScreen.tsx`): título de
  pantalla propio (`ScreenHero`) al ocultarse el del header, y se corrige el
  recorte por la izquierda del formulario del bottom sheet (padding horizontal).

---

## 2026-06-02 — Notificaciones: alineación con el contrato del MCM Panel

- **Normalización de rutas + alias** (`utils/notificationRoutes.ts` nuevo,
  `notifications/usePushNotifications.ts`, `app/notifications.tsx`): el `internalRoute`
  que manda el panel se normaliza antes de navegar, con un mapa de alias para rutas
  heredadas/incorrectas (`/(tabs)/actividades`/`jubileo` → `/(tabs)/mas`,
  `/(tabs)/albums` → `/(tabs)/fotos`, `/(tabs)/wordle` → `/wordle`). **Fix**: el botón
  iOS `view` apuntaba a `/(tabs)/notifications` (ruta inexistente) → `/notifications`.
- **Botón de acción tolerante a ambos formatos** (`utils/notificationRoutes.ts`,
  `services/pushNotificationService.ts`): se acepta tanto `data.actionButton` (objeto
  canónico) como `data.actionButtons` (array del contrato del panel, se usa el primer
  elemento), infiriendo `isInternal` si no viene. Aplica al push y al historial de
  Firebase.
- **Tests** (`__tests__/notificationRoutes.test.ts`).
- **Contrato revisado** (`NOTIFICACIONES_CONTRATO.md` en raíz del monorepo): respuesta
  a las 9 preguntas del panel + correcciones (rutas reales, `/pushTokens` usa
  `profileType`/`delegationId`/`topics` —no `userType`/`delegacion`—, segmentación por
  `topics`, iOS sin NSE, channel único `default`). Sin código nativo → compatible OTA.

---

## 2026-05-29 — UI fixes: onboarding, eventos (Liquid Glass), modo oscuro login

- **Onboarding — paso de login como pantalla final/resumen** (`app/onboarding.tsx`): para perfiles con login (monitor/miembro), al iniciar sesión la pantalla de login pasa a ser el último paso y muestra el resumen (perfil + delegación) con el botón "Ir a la app" centrado verticalmente; ya no hay pantalla `success` extra en ese flujo. Quien continúa sin cuenta sigue viendo la pantalla de resumen `success`.
- **Onboarding — indicador de pasos**: el indicador de puntos (`ProgressDots`) ahora aparece en perfil, delegación y login, con un total dinámico según el perfil elegido (otros → 1, familia → 2, monitor/miembro → 3).
- **Eventos — Liquid Glass en sub-pantallas** (`app/screens/eventStackScreens.tsx`, `components/EventActionButtons.tsx`, `app/(tabs)/visitapapa.tsx`, `app/(tabs)/mas.tsx`): las sub-pantallas con `ScreenHero` (Horario, Materiales, Visitas, Profundiza, Grupos, Contactos, Apps) ocultan el título duplicado del header (queda solo la barra glass + volver). Las acciones de Ajustes y Compartiendo salen del header y se muestran como FAB glass flotantes (`EventActionButtons`) que el tab renderiza por encima del navigator.
- **Modo oscuro del login** (`components/SocialLoginSection.tsx`): el botón de Google ya no usa texto oscuro fijo (era ilegible sobre tarjeta oscura); colores de texto/borde adaptados al esquema oscuro.

---

## 2026-05-30 — Cantoral: arreglos `{arr:}` por long-press en vivo (admin)

- **Long-press para añadir arreglos** (`app/screens/SongDetailScreen.tsx`,
  `components/ArrangementInputModal.tsx`): si el usuario es admin (`isAdmin`),
  mantener pulsada una línea de la canción abre una hoja para escribir un
  arreglo. Se inserta `{arr: ...}` **encima** de esa línea, se **renderiza al
  instante** en el dispositivo y se propone a `songs/ediciones`
  (`contentOld`/`contentNew` + filename + category + timestamp,
  `status: 'arrangement'`).
- **Mapeo fila↔línea robusto y transpose-invariante** (`utils/arrangements.ts`):
  `HtmlDivFormatter` emite una `<div class="row">` por línea renderable (letra y
  comentarios/arreglos) en orden de fuente. `injectRowLineIndices` etiqueta cada
  fila con `data-line` = índice de su línea en el ChordPro original (con guarda:
  si los conteos no cuadran, no toca nada). La transposición no altera el número
  ni el orden de filas, así que el índice es estable. Helpers nuevos:
  `renderableRowLineIndices`, `injectRowLineIndices`, `insertArrangementAtLine`,
  con tests en `__tests__/arrangements.test.ts`.
- **WebView** (`hooks/useSongProcessor.ts`, `components/SongDisplay.tsx`): nuevo
  prop `adminMode` inyecta JS que captura el long-press por fila (touch + ratón,
  con cancelación al hacer scroll) y manda `{ type: 'arr-longpress', line }` a RN
  vía `postMessage`. `SongDisplay` gana un prop `onMessage` (WebView nativo +
  iframe web). Sin `adminMode` el comportamiento es idéntico al anterior; el modo
  presentación (fullscreen) usa su propio WebView y no se ve afectado.

---

## 2026-05-30 — Cantoral: panel admin persistente + campos multimedia

- **Modo admin persistente** (`contexts/SettingsContext.tsx`): al introducir la
  contraseña del panel secreto (`coco`), se guarda un flag `isAdmin` en
  AsyncStorage. Mientras esté activo, el panel de edición se abre sin volver a
  pedir la contraseña. Nuevo par `isAdmin` / `setIsAdmin` en el contexto.
- **Panel secreto ampliado** (`components/SecretPanelModal.tsx`): además de
  título/autor/key/capo/info/contenido, el admin puede editar **álbum**,
  **fuente**, **ritmo**, **vídeo de YouTube** (pega una URL normal y se convierte
  automáticamente a URL de _embed_) y listas repetibles de **enlaces de YouTube**
  y **enlaces de audio** (`{label, url}`). Estos campos se cargan desde
  `songs/data` al abrir el panel y se proponen a `songs/ediciones` con pares
  `*Old`/`*New` (los enlaces como arrays de `{label,url}`, descartando filas
  vacías). **Aún NO se muestran al usuario final** — solo edición de admin.
- **Helper** `utils/youtube.ts` (`extractYouTubeId`, `toYouTubeEmbedUrl`):
  reconoce `watch?v=`, `youtu.be`, `/embed/`, `/shorts/`, `/live/` y el ID a
  secas; idempotente sobre URLs de embed. Con tests en `__tests__/youtube.test.ts`.
- **Render de arreglos `{arr:}`**: ahora con prefijo `"| "` delante y un punto
  más pequeños (app `0.82 → 0.78`, PDF `0.88 → 0.84`). `utils/arrangements.ts`,
  `hooks/useSongProcessor.ts`, `utils/playlistPdfHtml.ts`.
- Pendiente (2ª iteración): añadir arreglos `{arr:}` con long-press sobre la
  línea en el visor (JS inyectado en el WebView) con render en vivo. Ver `TODO.md`.

---

## 2026-05-30 — Cantoral: anotaciones de arreglo `{arr: ...}`

- **Nueva directiva ChordPro `{arr: texto}`** para anotaciones de arreglo (quién canta una
  parte, qué instrumento entra, dinámicas…). Se renderiza de forma sutil y **alineada a la
  derecha** (cursiva, color de acento, tamaño menor), complementando la letra sin competir.
- **Toggle ON por canción (efímero):** las canciones con arreglos los muestran activados por
  defecto; se pueden ocultar desde el botón flotante (acción "Arreglos ON/OFF") pero no se
  persiste. La acción solo aparece si la canción tiene arreglos, y el FAB muestra un indicador
  de acento cuando hay arreglos disponibles. El toggle es en vivo (clase `arr-hidden`).
- **Alcance:** detalle de canción, pantalla completa y exportación PDF de playlists.
- Archivos nuevos: `utils/arrangements.ts`, `ARREGLOS.md` (doc + prompt para el generador de
  ChordPro). Modificados: `hooks/useSongProcessor.ts`, `app/screens/SongDetailScreen.tsx`,
  `components/SongControls.tsx`, `app/screens/SongFullscreenScreen.tsx`, `utils/playlistPdfHtml.ts`.

---

## 2026-05-29 — Visita Papa León XIV 2026: evento activo + eventos pasados

- **Nueva tab "Visita Papa"** (`app/(tabs)/visitapapa.tsx`): el evento `visitapapa26` (Firebase `activities/visitapapa26`) tiene su propia pestaña antes de Calendario, con su hub y sub-pantallas (Horario, Materiales, Visitas, Profundiza, Grupos, Contactos, Apps, Reflexiones). Color de marca `#FCD200`.
- **Modo evento**: `visitapapa26` es el evento activo/destacado (`ACTIVE_EVENT_ID` y evento por defecto en `constants/events.ts`). Se anuncia con un banner en la Home (`app/(tabs)/index.tsx`) y un botón de acceso rápido, ambos visibles solo para perfiles con acceso al evento.
- **Sección-enlace "Comida de Domingo"**: nuevo campo `url` en `EventSection`. Si está presente, la tarjeta abre un enlace externo (Google Maps) con `Linking.openURL` en vez de navegar a una pantalla (`app/screens/EventHomeScreen.tsx`). El evento no usa las pantallas Comida/ComidaWeb.
- **Eventos pasados**: nuevo flag `status: 'active' | 'archived'` por evento y pantalla `app/screens/EventosPasadosScreen.tsx` accesible desde "Más > Eventos pasados" (item `eventos-pasados`). Jubileo pasa a `archived` y se accede desde ahí (ya no como item suelto de "Más").
- **Refactor**: las sub-pantallas de evento y el plumbing del header se extraen a `app/screens/eventStackScreens.tsx`, compartido por el tab "Más" y la tab de evento (alta de futuras actividades-tab = un archivo fino + 1 entrada en `events.ts`).
- **Perfiles** (`firebase-seed/profileConfig.json`): monitor y miembro reciben la tab y el botón Home de Visita Papa; todos los perfiles cambian el item `jubileo` por `eventos-pasados`. Recuerda replicar en `/profileConfig` de Firebase para el gating en runtime.
- Catálogos: `tabsCatalog.ts`, `colors.ts`, `profileCatalog.ts`, `MasHomeScreen.tsx`.
- **Pendiente** (`PROMPT_MCMPANEL_VISITAPAPA.md`): gestionar el evento activo/archivado desde mcmpanel (nodo `activities/` en Firebase) en vez de en código.

---

## 2026-05-28 — Calendario: detalles de evento + parser ICS enriquecido

- **Detalles de evento al hacer tap**: cada tarjeta de evento ahora abre un `EventDetailsBottomSheet` (nuevo componente) con fecha y hora, ubicación con botón "Abrir en Mapas/Maps", videollamada destacada (Meet/Zoom/Teams/Webex/Jitsi), descripción con saltos de línea y URLs tappables, y enlace "Abrir en Google Calendar" si el evento trae `URL`.
- **Parser ICS enriquecido** (`hooks/useCalendarEvents.ts`): el tipo `CalendarEvent` añade `startTime`, `endTime` y `conferenceUrl`. `DTSTART`/`DTEND` ahora extraen también la hora (`HH:MM`). Se detectan videollamadas vía `X-GOOGLE-CONFERENCE` y, como fallback, regex sobre `DESCRIPTION` (Meet, Zoom, Teams, Webex, GoToMeeting, Whereby, Jitsi). `DESCRIPTION` conserva los saltos de línea originales.
- **FAB "Hoy" rediseñado**: sustituido el `GlassFAB` flotante por una píldora compacta "Volver a hoy" en el header de la sección de eventos (modo Mes) y sobre la lista (modo Agenda). Aparece solo cuando la fecha/mes seleccionado no es el actual.
- **Hora en la tarjeta del día**: si el evento tiene `startTime`, se muestra `HH:MM – HH:MM` con icono de reloj en la tarjeta de la lista del día.
- Archivos nuevos: `components/EventDetailsBottomSheet.tsx`.
- Archivos modificados: `hooks/useCalendarEvents.ts`, `app/(tabs)/calendario.tsx`.

---

## 2026-05-27 — Onboarding edge-to-edge

- El onboarding ahora ocupa la pantalla completa, incluida la zona del notch / status bar / home indicator. El fondo del paso actual (azul marca en la bienvenida, blanco en los siguientes) cubre todo el shell sin recortes blancos arriba.
- `app/_layout.tsx`: la pantalla `onboarding` pasa de `presentation: 'modal'` a `presentation: 'fullScreenModal'` y se le fija `contentStyle.backgroundColor` al azul de marca para evitar parpadeos blancos al abrir.
- `app/onboarding.tsx`: sustituido el `SafeAreaView` exterior por un `View` con fondo dinámico por paso; cada step gestiona sus propios `insets` vía `useSafeAreaInsets`. La status bar se conmuta a `light` durante la bienvenida.
- Pequeños retoques de diseño (no funcionales): badge "Te damos la bienvenida", logo con flotación suave, copy más cálido ("¡Vamos allá!"), icono `celebration` y pequeño pop en la pantalla de éxito.

---

## 2026-05-26 — Limpieza de warnings iOS 26

- Silenciado el log informativo `HeroUI Native Styling Principles` en arranque: `HeroUINativeProvider` ahora recibe `config={{ devInfo: { stylingPrinciples: false } }}` en `app/_layout.tsx`.
- Resuelto warning `[RNScreens] Using both blurEffect and scrollEdgeEffects simultaneously` en el stack del Cantoral: `headerBlurEffect` se aplica solo en iOS < 26 (en iOS 26+ el sistema ya pinta el efecto glass vía `scrollEdgeEffects` por defecto). Archivo: `app/(tabs)/cancionero.tsx`.

---

## 2026-05-25 — Modo Carismochito (easter egg por shake)

Easter egg: al agitar el móvil aparece una cuenta atrás de 5 segundos que, si no se cancela, activa el "Modo Carismochito" — un guiño a la mascota del MCM tintando toda la app de un verde lima deliberadamente exagerado. Se desactiva agitando otra vez o tocando el badge flotante.

- **Detección de shake**: nuevo `hooks/useShakeDetector.ts` basado en `expo-sensors` (carga perezosa para no romper en web). Umbral configurable (~3 picos > 1.9g en 700ms, cooldown 1.2s).
- **Estado global**: `contexts/CarismochitoContext.tsx` con tres estados (`idle`, `countingDown`, `active`); una sola acción de "shake" se interpreta como activar / cancelar / desactivar según el estado actual.
- **UI**: `components/CarismochitoOverlay.tsx` renderiza:
  - Pantalla de cuenta atrás con la mascota SVG (verde slime con ojos negros, lengua rosa), número pulsante, halo verde y botón "Cancelar".
  - Cuando está activo: tinte verde lima (`#7FFF00`) sobre toda la app con viñeta superior/inferior + badge flotante "MODO CARISMOCHITO" que también permite desactivar al tocarlo.
- **Wiring**: `CarismochitoProvider` añadido al árbol de providers y `<CarismochitoOverlay />` al final de `InnerLayout` (encima de tabs, debajo del toast).
- **Nueva dependencia nativa**: `expo-sensors ~55.0.8` — **requiere un nuevo build EAS** para que funcione en dispositivo (en web queda inerte).
- Archivos nuevos: `hooks/useShakeDetector.ts`, `contexts/CarismochitoContext.tsx`, `components/CarismochitoOverlay.tsx`.
- Archivos modificados: `app/_layout.tsx`, `package.json`.

---

## 2026-05-27 — Onboarding edge-to-edge

- El onboarding ahora ocupa la pantalla completa, incluida la zona del notch / status bar / home indicator. El fondo del paso actual (azul marca en la bienvenida, blanco en los siguientes) cubre todo el shell sin recortes blancos arriba.
- `app/_layout.tsx`: la pantalla `onboarding` pasa de `presentation: 'modal'` a `presentation: 'fullScreenModal'` y se le fija `contentStyle.backgroundColor` al azul de marca para evitar parpadeos blancos al abrir.
- `app/onboarding.tsx`: sustituido el `SafeAreaView` exterior por un `View` con fondo dinámico por paso; cada step gestiona sus propios `insets` vía `useSafeAreaInsets`. La status bar se conmuta a `light` durante la bienvenida.
- Pequeños retoques de diseño (no funcionales): badge "Te damos la bienvenida", logo con flotación suave, copy más cálido ("¡Vamos allá!"), icono `celebration` y pequeño pop en la pantalla de éxito.

---

## 2026-05-26 — Limpieza de warnings iOS 26

- Silenciado el log informativo `HeroUI Native Styling Principles` en arranque: `HeroUINativeProvider` ahora recibe `config={{ devInfo: { stylingPrinciples: false } }}` en `app/_layout.tsx`.
- Resuelto warning `[RNScreens] Using both blurEffect and scrollEdgeEffects simultaneously` en el stack del Cantoral: `headerBlurEffect` se aplica solo en iOS < 26 (en iOS 26+ el sistema ya pinta el efecto glass vía `scrollEdgeEffects` por defecto). Archivo: `app/(tabs)/cancionero.tsx`.

---

## 2026-05-25 — Modo Carismochito (easter egg por shake)

Easter egg: al agitar el móvil aparece una cuenta atrás de 5 segundos que, si no se cancela, activa el "Modo Carismochito" — un guiño a la mascota del MCM tintando toda la app de un verde lima deliberadamente exagerado. Se desactiva agitando otra vez o tocando el badge flotante.

- **Detección de shake**: nuevo `hooks/useShakeDetector.ts` basado en `expo-sensors` (carga perezosa para no romper en web). Umbral configurable (~3 picos > 1.9g en 700ms, cooldown 1.2s).
- **Estado global**: `contexts/CarismochitoContext.tsx` con tres estados (`idle`, `countingDown`, `active`); una sola acción de "shake" se interpreta como activar / cancelar / desactivar según el estado actual.
- **UI**: `components/CarismochitoOverlay.tsx` renderiza:
  - Pantalla de cuenta atrás con la mascota SVG (verde slime con ojos negros, lengua rosa), número pulsante, halo verde y botón "Cancelar".
  - Cuando está activo: tinte verde lima (`#7FFF00`) sobre toda la app con viñeta superior/inferior + badge flotante "MODO CARISMOCHITO" que también permite desactivar al tocarlo.
- **Wiring**: `CarismochitoProvider` añadido al árbol de providers y `<CarismochitoOverlay />` al final de `InnerLayout` (encima de tabs, debajo del toast).
- **Nueva dependencia nativa**: `expo-sensors ~55.0.8` — **requiere un nuevo build EAS** para que funcione en dispositivo (en web queda inerte).
- Archivos nuevos: `hooks/useShakeDetector.ts`, `contexts/CarismochitoContext.tsx`, `components/CarismochitoOverlay.tsx`.
- Archivos modificados: `app/_layout.tsx`, `package.json`.

---

## 2026-05-25 — Activación de React Compiler

- **Qué cambia**: se activa `babel-plugin-react-compiler` (React 19 + Babel 7.25). El compilador memoiza automáticamente componentes y valores derivados, eliminando re-renders innecesarios sin necesidad de `useMemo`/`useCallback`/`React.memo` manuales.
- **Cómo se activa en Expo SDK 55**: requiere DOS cosas (no basta sólo con el preset):
  1. `experiments.reactCompiler: true` en `app.json` → hace que Metro pase `supportsReactCompiler: true` al caller de Babel.
  2. `babel-plugin-react-compiler` instalado + opciones opcionales vía `babel-preset-expo` (`['babel-preset-expo', { 'react-compiler': {} }]`).
- **Orden con Reanimated**: el preset de Expo se encarga de inyectar el compilador como primer plugin y el plugin de worklets después, así que no hay conflicto manual.
- **Verificación**: transformando un componente con `caller.supportsReactCompiler = true` aparece el import `react/compiler-runtime` y el `c(N)` de memo cache → confirma que el compilador procesa el código.
- **Archivos afectados**:
  - `babel.config.js`: preset pasa de `'babel-preset-expo'` a `['babel-preset-expo', { 'react-compiler': {} }]`.
  - `app.json`: añadido `experiments.reactCompiler: true`.
  - `package.json`: nueva devDependency `babel-plugin-react-compiler@^1.0.0`.

---

## 2026-05-25 — Suscripción a calendarios públicos desde la pestaña Calendario

Nueva funcionalidad que permite al usuario suscribirse a los calendarios ICS configurados en Firebase directamente desde su app de calendario nativa.

- **Punto de entrada**: icono `bookmark-add` en el header de la pestaña Calendario, a la derecha del selector Mes/Agenda. Solo visible cuando hay al menos un calendario configurado.
- **iOS**: botón "Apple Calendario" abre el URL `webcal://...` → diálogo nativo de suscripción de Apple Calendar. Botón "Google Calendar" abre `calendar.google.com/r?cid=...`.
- **Android / Web**: solo botón "Google Calendar" (Android no tiene handler nativo para `webcal://`). Abre Google Calendar web con prompt de suscripción; los eventos sincronizan automáticamente con la app Android.
- **Copiar enlace**: copia la URL ICS al portapapeles + toast confirmación.
- **Acordeón de ayuda**: instrucciones por plataforma (Apple Calendar, Google Calendar, Outlook, Otra app).
- Archivos nuevos: `utils/calendarSubscription.ts`, `components/CalendarSubscribeBottomSheet.tsx`.
- Archivos modificados: `app/(tabs)/calendario.tsx`, `app.json` (añadido `LSApplicationQueriesSchemes: ["webcal"]` — requiere nuevo build EAS para aplicar en iOS).

---

## 2026-05-24 — Virtualización de listas, WebView estable y rediseño de Grupos

Tres cambios de rendimiento + UX descritos en `MEJORAS.md` §1.2, §1.3 y §1.4.

### `GruposScreen` — rediseño completo + `SectionList`

- **Buscador siempre visible** en la vista principal con resultados agrupados por categoría (`SectionList` con sticky section headers y resaltado del texto coincidente).
- **Botón "Encuéntrame"** que pre-rellena la búsqueda con el nombre del `UserProfile` cuando está disponible. Las filas y tarjetas de grupo donde aparece el usuario muestran un badge "tú" y borde de acento.
- **Filtro interno en la vista de grupo** (`FlatList` virtualizada de miembros) que aparece sólo cuando hay más de 8 miembros — clave para grupos grandes.
- **Búsqueda con normalización** (case + diacríticos) y umbral de 2 caracteres (antes 3) para que cosas como "ana" funcionen.
- **`GrupoCard` y `MemberRow`** extraídos como `React.memo` para que la virtualización no re-renderice todo al cambiar el filtro.
- **`ScrollView+.map()` anidados** eliminados — todas las listas largas son ahora `SectionList`/`FlatList` con `initialNumToRender`, `windowSize` y `removeClippedSubviews`.

### `ContactosScreen` → `FlatList`

- Sustituye el `ScrollView+.map()` por `FlatList` virtualizada (clave para crecimientos futuros del listado).
- Buscador integrado en el header (visible cuando hay >6 contactos) que filtra por nombre, responsabilidad o teléfono con normalización de diacríticos.
- `ContactRow` extraído como `React.memo`.

### WebView estable con `postMessage` (§1.2)

- `useSongProcessor` ahora separa entradas **estructurales** (`originalChordPro`, `currentTranspose`, `notation`, `title`, `author`, `key`, `capo`, `isFullscreen`) de entradas **de estilo** (`fontSize`, `fontFamily`, `isDark`, `chordsVisible`, `topPadding`, `bottomPadding`). Sólo las primeras regeneran el HTML.
- Devuelve `{ songHtml, isLoadingSong, styleState }`. El HTML inyectado expone `window.__SONG_BRIDGE__.apply(s)` que aplica los cambios vía CSS variables y clases (`.theme-dark`, `.chords-hidden`) sin recargar.
- `SongDisplay` (móvil) usa `WebView.injectJavaScript(...)` cuando cambia `styleState`. En web envía `postMessage` al `<iframe>`. `SongFullscreenScreen` hace lo mismo sobre su WebView/`<div>` propio.
- **Efecto visible**: cambiar tamaño de letra, fuente, tema o visibilidad de acordes desde el bottom sheet es ahora instantáneo, sin parpadeo de 200–500 ms.

### Caché de parser ChordPro a nivel de módulo (§1.3, adaptado)

- `useSongProcessor.ts` cachea los objetos `Song` parseados en un `Map` FIFO de hasta 64 entradas (claveado por el contenido ChordPro completo). Abrir, cerrar y reabrir una canción ya no reparsea.
- Nota: el plan original de un Metro Transformer no aplica porque las canciones no viven en el bundle (vienen de Firebase). El caché en runtime es la alternativa equivalente.

### Archivos modificados

- `app/screens/GruposScreen.tsx` — rewrite completo.
- `app/screens/ContactosScreen.tsx` — rewrite a `FlatList` + búsqueda.
- `app/screens/SongDetailScreen.tsx` — propaga `styleState` a `SongDisplay`.
- `app/screens/SongFullscreenScreen.tsx` — inyecta `styleState` en su WebView/iframe.
- `hooks/useSongProcessor.ts` — split estructural/estilo + caché de parser + bootstrap script.
- `components/SongDisplay.tsx` — refs a WebView/iframe y bridge de `postMessage`.

---

## 2026-05-25 — Activación de React Compiler

- **Qué cambia**: se activa `babel-plugin-react-compiler` (React 19 + Babel 7.25). El compilador memoiza automáticamente componentes y valores derivados, eliminando re-renders innecesarios sin necesidad de `useMemo`/`useCallback`/`React.memo` manuales.
- **Cómo se activa en Expo SDK 55**: requiere DOS cosas (no basta sólo con el preset):
  1. `experiments.reactCompiler: true` en `app.json` → hace que Metro pase `supportsReactCompiler: true` al caller de Babel.
  2. `babel-plugin-react-compiler` instalado + opciones opcionales vía `babel-preset-expo` (`['babel-preset-expo', { 'react-compiler': {} }]`).
- **Orden con Reanimated**: el preset de Expo se encarga de inyectar el compilador como primer plugin y el plugin de worklets después, así que no hay conflicto manual.
- **Verificación**: transformando un componente con `caller.supportsReactCompiler = true` aparece el import `react/compiler-runtime` y el `c(N)` de memo cache → confirma que el compilador procesa el código.
- **Archivos afectados**:
  - `babel.config.js`: preset pasa de `'babel-preset-expo'` a `['babel-preset-expo', { 'react-compiler': {} }]`.
  - `app.json`: añadido `experiments.reactCompiler: true`.
  - `package.json`: nueva devDependency `babel-plugin-react-compiler@^1.0.0`.

---

## 2026-05-24 — Banner de permisos de notificaciones

- **Qué hace**: cuando el usuario aún no ha concedido permisos de notificaciones, aparece un banner en Home y en la pantalla de Notificaciones invitando a activarlas. Se descarta durante 7 días al pulsar la X.
- **Estados manejados**: se muestra en `undetermined` (CTA "Activar" dispara el prompt nativo del sistema) y en `denied` (CTA "Abrir Ajustes" abre los Ajustes de la app con `Linking.openSettings()`). Se oculta en `granted` y `provisional`. En web no se muestra nunca.
- **Persistencia**: timestamp de descarte en AsyncStorage (`@mcm_notif_permission_banner_dismissed_at`). El banner reaparece pasados 7 días.
- **Reconsulta**: el banner vuelve a comprobar el estado de permisos cuando la app vuelve al foreground (`AppState 'active'`), de modo que se oculta automáticamente al volver de Ajustes tras conceder los permisos.
- **Registro inmediato del token**: `usePushNotifications` ahora expone `tryRegisterPushToken()` y registra un listener de `AppState` que reintenta `registerAndSaveToken` al volver al foreground. Resultado: al conceder permisos (en-app o vía Ajustes), el token Expo Push se registra en Firebase sin esperar al siguiente arranque.
- **Archivos nuevos**:
  - `components/NotificationPermissionBanner.tsx`: componente reutilizable con prop `placement: 'home' | 'notifications'`.
- **Archivos modificados**:
  - `notifications/usePushNotifications.ts`: nuevo export `tryRegisterPushToken()`, espejo de metadata a nivel de módulo, listener de `AppState` para re-registro idempotente al foregroundear.
  - `app/(tabs)/index.tsx`: inserta el banner en la columna izquierda, justo antes de la tarjeta de Novedades.
  - `app/notifications.tsx`: inserta el banner justo debajo del header.

---

## 2026-05-22 — Canal "preview" en caliente: modo Laboratorio Alpha (7 taps)

- **Qué hace**: permite a un dispositivo suscribirse al canal `preview` de EAS Update desde dentro de la app instalada en stores, sin necesidad de un binario aparte. Mientras esté activo, los OTAs vienen de la rama `preview` (que ya publica `/.github/workflows/ota-preview.yml`); al desactivarlo, en el siguiente arranque vuelve al canal `production`.
- **Cómo se descubre**: 7 taps rápidos sobre el número de versión (`VersionDisplay`) o sobre el tagline "Movimiento Consolación para el Mundo" del pie de Home y de Más. Haptic creciente desde el 4º tap como pista. Reversible.
- **UX del modal**: deliberadamente exagerada y festiva (rompiendo el minimalismo del resto de la app). Gradiente que muta entre tres paletas, 14 emojis flotando con rotación/escala, título "🧪 LABORATORIO ALPHA 🧪" con wobble, palanca gigante MUNDANO ↔ ALPHA, frases rotatorias, pergamino con la explicación técnica del pacto, burst de confeti al activar y "puff" al desactivar.
- **Mecánica técnica**: `Updates.setUpdateURLAndRequestHeadersOverride({ updateUrl, requestHeaders: { 'expo-channel-name': 'preview' } })`. Persistido en `AsyncStorage`. Se aplica al hidratar el provider antes de que `useOTAUpdate` haga su primer `checkForUpdateAsync`. Inocuo si la `runtimeVersion` del binario no coincide con la del bundle preview.
- **Archivos nuevos**:
  - `hooks/useSecretTap.ts`: contador de taps con ventana de 1.5s y haptic ramp.
  - `contexts/PreviewChannelContext.tsx`: flag persistido + override de canal + estado del modal.
  - `components/SecretMenuTrigger.tsx`: wrapper Pressable transparente que añade el gesto sin afectar al layout.
  - `components/PreviewChannelModal.tsx`: el modal "Laboratorio Alpha" con Reanimated + LinearGradient.
- **Archivos modificados**: `app/_layout.tsx` (provider + montaje del modal), `components/VersionDisplay.tsx` (envuelto + indicador "· alpha" cuando está activo), `app/(tabs)/index.tsx` y `app/screens/MasHomeScreen.tsx` (tagline envuelto).

---

## 2026-05-21 — Auto-scroll del cantoral en pantalla completa, reescrito

- **Problema**: el desplazador automático del modo pantalla completa era frágil. Slider vertical con gestos en conflicto con `PressableFeedback`, bucle frame-based (la velocidad cambiaba según refresh rate), sin persistencia entre sesiones, sin auto-pausa al final del documento ni cuando el usuario tocaba la pantalla, y dos bucles distintos en lados opuestos del puente nativo.
- **Solución**: nuevo hook `hooks/useAutoScroller.ts` que aísla toda la lógica del desplazamiento y expone una API limpia (`isPlaying`, `speedIndex`, `setSpeedIndex`, `play/pause/toggle`, handlers de WebView). En la pantalla, el slider vertical se sustituye por un selector segmentado horizontal de 5 niveles ("Muy lento" … "Muy rápido").
- **Mejoras técnicas**:
  - **Time-based (px/s)** en lugar de frame-based: misma velocidad real en pantallas a 60Hz, 90Hz o 120Hz.
  - **Acumulación sub-píxel** + **rampa de aceleración/frenado**: el inicio/parada es suave y los niveles bajos producen un movimiento continuo, no a saltos.
  - **Bucle en la WebView**: en iOS/Android el rAF vive dentro de la propia WebView (cero overhead del puente). El lado React sólo envía la velocidad objetivo cuando cambia. Para web, rAF en lado React sobre el `div` scrollable.
  - **Auto-pausa**: cuando el usuario interactúa manualmente (touch/wheel/mousedown/keydown) o al llegar al final del documento; en nativo el controlador postea un mensaje (`postMessage`) y React sincroniza estado.
  - **Persistencia**: nivel de velocidad guardado en AsyncStorage (`@mcm_song_autoscroll_speed_index`); el usuario recupera su preferencia al volver a entrar.
  - **Resiliencia**: `__mcmScrollInstalled` guard evita doble inyección; `onLoadEnd` reinyecta la velocidad si la WebView recarga con la reproducción activa.
- **UX**: indicador discreto del nivel actual encima del play, panel de velocidades que aparece al pulsar y se oculta a los 3.2s, haptics (`Medium` en play/pause, `Light` al cambiar de nivel), atajos de teclado en web (`Espacio` play/pause, `↑/↓` subir/bajar velocidad), accesibilidad (`accessibilityState`, etiquetas).
- **Archivos**:
  - Nuevo: `hooks/useAutoScroller.ts`.
  - Reescrito: `app/screens/SongFullscreenScreen.tsx` (eliminados `VerticalSlider`, `SCROLL_CONTROLLER_JS`, estado/refs/efectos del scroll inline).

---

## 2026-05-20 — Atajos de teclado en web: Cmd+K, Esc y cantoral

- **Cmd/Ctrl+K**: nuevo Command Palette global (web-only) montado en `app/_layout.tsx`. Lista las pantallas top-level del expo-router con sinónimos en castellano e inglés para búsqueda rápida.
- **Esc**: cierra el overlay más reciente. Pila LIFO global (`OverlayStackProvider` en `contexts/OverlayStackContext.tsx`) compartida entre todos los `BottomSheet` y el Command Palette.
- **Atajos del cantoral** (`SongDetailScreen`): ← / → canción anterior/siguiente, +/- transponer ±1 semitono, F fullscreen. `SongFullscreenScreen` sale con F o Esc.
- **Infra**: `hooks/useKeyboardShortcut(key, handler, options)` wrap sobre `window.addEventListener('keydown')` con guard `Platform.OS === 'web'`. Ignora teclas si el foco está en un input, salvo combinaciones meta-prefixed.
- **Archivos**:
  - Nuevos: `hooks/useKeyboardShortcut.ts`, `hooks/useEscapeToClose.ts`, `contexts/OverlayStackContext.tsx`, `components/CommandPalette.tsx`.
  - Modificados: `app/_layout.tsx` (provider + montaje del palette), `components/BottomSheet.tsx` (Esc), `app/screens/SongDetailScreen.tsx`, `app/screens/SongFullscreenScreen.tsx`.

---

## 2026-05-20 — Menú contextual del cantoral funcional en web (click derecho)

- **Problema**: `onLongPress` de React Native no se dispara en web, así que el menú contextual de `SongListItem` (Añadir/Quitar lista + Compartir) quedaba inaccesible al abrir la app en navegador.
- **Solución**: nuevo hook `useContextMenu(handler)` que devuelve `onLongPress` en nativo y `onContextMenu` (con `preventDefault`) en web. Cero cambios en API externa.
- **Archivos**:
  - `hooks/useContextMenu.ts` (nuevo): puente long-press ↔ click derecho, reutilizable en otras listas.
  - `components/SongListItem.tsx`: consume el hook y esparce las props sobre `TouchableOpacity`. El menú custom (BottomSheet en `SongListScreen`) ya funcionaba en web; ahora también se abre.

---

## 2026-05-20 — Fix: cabecera de Fotos en stack de Más (iOS overflow)

- **Problema**: tras los cambios de overflow en iOS (Fotos cae fuera del tab bar nativo y se accede desde el stack de Más), la pantalla Fotos quedó sin cabecera coherente. El fix anterior usó `headerShown: false` para evitar un supuesto conflicto con `TabScreenWrapper`, pero eso dejó la pantalla sin identidad visual ni botón de "atrás" claro.
- **Solución**: registramos la `Stack.Screen` de `Fotos` con el mismo patrón que el resto de pantallas del stack de Más — header con `TabHeaderColors.fotos` (rojo MIC), `GlassHeader` en iOS y `getHeaderStyle`/`getTextColor` para coherencia con web/Android. Mismo color y estilo que la cabecera del tab Calendario, ajustado al color de Fotos.
- **No hay conflicto real con `TabScreenWrapper`**: cuando se accede a Fotos vía el stack de Más, `usePathname()` devuelve `/mas`, así que `useCurrentTabColor()` retorna `undefined` y la barra de color de 8px no se renderiza — el header del stack es el único elemento decorativo arriba.
- **Navegación atrás**: el header ahora muestra el botón nativo de back (1 tap, determinista). El swipe-back nativo de iOS sigue funcionando. El `tabPress` listener en `mas.tsx` también sigue popeando a `MasHome` al tocar el tab Más mientras se está en Fotos.
- **Archivos**:
  - `app/(tabs)/mas.tsx`: reemplazado `{ headerShown: false }` por opciones completas con `TabHeaderColors.fotos`, `GlassHeader` y `headerRight: () => null` para no heredar los iconos de settings/forum del navigator-level.

---

## 2026-05-20 — Eventos próximos: más eventos y agrupados por semana

- **Más eventos visibles**: aumentado de 2 a 8 eventos máximos en el Home, para que el usuario vea un panorama más amplio de lo que se acerca.
- **Agrupados por semana**: eventos organizados con encabezados temporales ("Hoy", "Mañana", "Esta semana", "Próxima semana", "En X semanas") para escaneo visual más rápido.
- **Función auxiliar `getWeekLabel()`**: clasifica eventos según su distancia temporal respecto a hoy.
- **Función `getUpcomingEventsByWeek()`**: agrupa eventos preservando orden temporal, para mejor UX.
- **Archivos**:
  - `app/(tabs)/index.tsx`: nuevas funciones + renderización con `React.Fragment` por grupo + estilo `.weekSeparator`.

---

## 2026-05-20 — Fix: selección de calendarios ahora compartida entre tabs (Home y Calendario)

- **Problema**: `useCalendarConfigs()` se instanciaba por separado en `index.tsx` (Home) y `calendario.tsx` (Calendario), causando que cambiar la selección en Calendario no se refleje en Home sin reiniciar la app.
- **Solución**: introduce `CalendarConfigContext` que envuelve el hook una sola vez, compartido entre ambos tabs vía `useCalendarConfig()`.
- **Sin breaking changes**: hook original `useCalendarConfigs` se mantiene sin cambios, solo movido el estado a nivel de Context en `_layout.tsx`.
- **Archivos**:
  - `contexts/CalendarConfigContext.tsx` (nuevo): Provider del contexto compartido.
  - `app/_layout.tsx`: añade `CalendarConfigProvider` al árbol de providers.
  - `app/(tabs)/calendario.tsx`, `app/(tabs)/index.tsx`: cambio de imports a `useCalendarConfig` del contexto.

---

## 2026-05-20 — Fix iOS: modal sheet al botón de acción sin cerrar primero

- **Problema iOS**: iOS UIKit no permite presentar y descartar una Modal en el mismo render cycle. Cuando un BottomSheet se cerraba y ejecutaba una acción que abría un Modal/Share sheet, iOS silenciosamente rechazaba el nuevo modal.
- **Solución**: split por plataforma usando `Modal.onDismiss` (iOS) que espera a que UIKit confirme la dismissión nativa. Android/Web usan el callback de la animación directamente.
- **Componentes afectados**:
  - `BottomSheet.tsx`: añade `onDismiss` prop, y la acción se ejecuta después de que UIKit confirma la dismissión completa.
  - `PlaylistActionsSheet.tsx`, `SongListScreen.tsx`: usan `onCloseComplete` callback del BottomSheet para ejecutar acciones post-dismissión.
- **Archivos**:
  - `components/BottomSheet.tsx`: nueva prop `onCloseComplete` + `Modal.onDismiss` para iOS.
  - `components/playlist/PlaylistActionsSheet.tsx`: `pendingActionRef` + `handleCloseComplete`.
  - `app/screens/SongListScreen.tsx`: `pendingShareRef` + `handleSheetCloseComplete` para `Share.share()`.

---

## 2026-05-20 — Fix iOS: tab bar con "More" feo del sistema cuando hay >5 tabs

- **Problema**: `UITabBarController` en iPhone solo admite 5 items; con 6+ visibles iOS añade un "More" automático del sistema que ignoraba el estilo de la app (mostraba "Fotos" y nuestro "Más" dentro de un menú feo) y dejaba en segundo plano el `MasHomeScreen` cuidado del usuario.
- **Solución**: limitamos la barra nativa de iOS a 5 triggers (4 prioritarios en el orden definido + `mas` siempre como 5º). Los tabs visibles que no caben (overflow) se exponen como tarjetas en `MasHomeScreen` con el mismo estilo bonito que el resto de items. Las rutas overflow siguen existiendo y son navegables vía `router.navigate('/<ruta>')` aunque no tengan `NativeTabs.Trigger` (expo-router las mantiene en el navigation state).
- **Sin impacto en Android/Web**: allí seguimos usando los `Tabs` tradicionales sin límite duro y se muestran todos los tabs.
- **Archivos**:
  - `constants/tabsCatalog.ts` (nuevo): `TABS_CONFIG`, `splitTabsForIOS()` y constante `IOS_MAX_NATIVE_TABS = 5`. Movido desde `app/(tabs)/_layout.tsx` para ser consumido también por `MasHomeScreen`.
  - `app/(tabs)/_layout.tsx`: el componente `IOSNativeTabsLayout` ahora sólo renderiza los `mainTabs` calculados por `splitTabsForIOS`.
  - `app/screens/MasHomeScreen.tsx`: añade los tabs overflow como `NavigationItem` con `routePath` (en lugar de `target`); el `onPress` salta a `router.navigate(routePath)` para esos.

---

## 2026-05-20 — Rediseño completo del cantoral para iPad (portrait + landscape)

- **Nuevo hook `useResponsiveLayout`** (`hooks/useResponsiveLayout.ts`) que centraliza los breakpoints responsive (`xs`/`sm`/`md`/`lg`), expone `isWide`, `isExtraWide`, `isLandscape`/`isPortrait` y devuelve `gridColumns`, `readableMaxWidth` y `contentMaxWidth` recomendados según el ancho. Pensado para ser usado en cualquier pantalla que necesite adaptarse a iPad / web amplio.
- **`CategoriesScreen` — grid de tarjetas en iPad**: en wide la primera tarjeta "Tu selección" se convierte en una hero card destacada con subtítulo informativo, y el resto de categorías se renderizan en un grid de 2 columnas con cards estilo dashboard (emoji grande, título, contador de canciones). En móvil se mantiene la lista tradicional. Contenido centrado con `maxWidth` cómodo.
- **`SongListScreen` — lista centrada en iPad**: la lista de canciones y la barra de búsqueda se centran con `maxWidth: 640/760`. Los inputs y radios crecen en wide para sentirse nativos en tablet.
- **`SongDetailScreen` — letra y acordes centrados en iPad**: el card del WebView se envuelve en un wrapper centrado con `maxWidth` amplio (760/980), manteniendo el banner del coro, la barra de pestañas y los botones flotantes en sus posiciones originales (top-left/right de la pantalla).
- **`SelectedSongsScreen` — playlist centrada en iPad**: tanto la vista de canciones como el estado vacío usan `maxWidth + alignSelf: 'center'`.
- **Archivos**: `hooks/useResponsiveLayout.ts` (nuevo), `app/screens/CategoriesScreen.tsx`, `app/screens/SongListScreen.tsx`, `app/screens/SongDetailScreen.tsx`, `app/screens/SelectedSongsScreen.tsx`.

---

## 2026-05-20 — Fix slider fullscreen del cantoral + Contigo responsive en iPad

- **Slider de velocidad en `SongFullscreenScreen` migrado a react-native-gesture-handler + Reanimated**. La implementación anterior con `PanResponder` competía por los gestos con los componentes `PressableFeedback` de heroui-native (que ya usan RNGH internamente), lo que hacía que el slider se rompiera de forma recurrente. La nueva implementación con `Gesture.Pan()` + `useSharedValue` es estable cross-platform y soporta además tap-on-track para saltar a una posición concreta. También se pausa el auto-hide de los controles mientras se está arrastrando para que el slider no desaparezca a mitad del gesto.
- **Contigo en iPad — wrappers con `maxWidth` y centrado**: aplicado un wrapper `View` con `maxWidth` (720/880 según ancho de ventana) y `alignSelf: 'center'` en `ContigoScreen`, `EvangelioScreen`, `RevisionScreen` y `BookmarksScreen`. Antes la página se estiraba a lo ancho del iPad dejando el HeroCard, los HabitTile y las stats cards en un layout muy disperso y desproporcionado. Ahora el contenido se mantiene legible y compacto en iPad/web sin afectar el diseño en móvil.
- **Archivos**: `app/screens/SongFullscreenScreen.tsx`, `app/(tabs)/contigo/index.tsx`, `app/(tabs)/contigo/evangelio.tsx`, `app/(tabs)/contigo/revision.tsx`, `app/(tabs)/contigo/bookmarks.tsx`.

---

## 2026-05-19 — Onboarding: opción "Otros" en perfil y delegación

- **Nueva opción "Otros" en el paso de perfil** del onboarding (`app/onboarding.tsx`), con el texto «Si no te identificas con ninguno de los anteriores o simplemente quieres probar la app». Pensada para visitantes y casos no contemplados. Si el usuario la elige, se salta directamente la pantalla de delegación y se va al éxito.
- **Nueva opción "Otros" en el paso de delegación** (posición destacada, segunda fila tras "Sin delegación / General", para que sea visible sin scroll en la lista larga de delegaciones).
- **Mapeo interno transparente al usuario**: "Otros" en perfil persiste como `miembro` + delegación `mcm-espana`; "Otros" en delegación persiste como `mcm-espana`. El usuario ve "Otros" en la pantalla de éxito; en `AsyncStorage`/Firebase solo viven los IDs reales del catálogo, así nada río abajo (resolver de perfiles, topics de notificaciones, calendarios) tiene que conocer este atajo.

---

## 2026-05-19 — Actualización de seguridad y dependencias a Expo SDK 55

- **Vulnerabilidades corregidas**: aplicadas mitigaciones de seguridad para `brace-expansion` DoS, `postcss` XSS, `fast-xml-parser` XML injection y `protobufjs` DoS. Todas las vulnerabilidades eran build-time o en dependencias dev, ninguna afectaba el código de producción.
- **@react-native-community/cli**: actualizado de 18.0.0 → 20.1.3 para arreglar `fast-xml-parser` vulnerability en el toolchain de build (iOS/Android).
- **Dependencias prod actualizadas (130+ paquetes)**:
  - **Patches (Fase 1)**: expo, expo-router, expo-dev-client, expo-file-system, expo-font, expo-symbols, expo-updates, react-native-svg, react-native-webview, prettier, ts-jest, heroui-native, tailwind-merge (11 paquetes).
  - **Minor updates (Fase 2)**: @react-native-community/datetimepicker (8.6→9.1), react-native-gesture-handler (2.30→2.31), react-native-reanimated (4.2→4.3), react-native-safe-area-context (5.6→5.8), react-native-screens (4.23→4.25), react-native-worklets (0.7→0.8), tailwindcss (4.2→4.3), firebase (12.10→12.13).
  - **Major version updates (Fase 3)**:
    - react-native (0.83→0.85): mejoras en gesture handling, platform-specific fixes.
    - typescript (5.9→6.0): compatible con todos los tipos, sin cambios de API requeridos.
    - eslint (9.39→10.4): mejoras de análisis, compatible con eslint-config-prettier 10.1.
    - jest (29.7→30.4): mejoras de test framework, compatible con jest-expo.
    - @react-native-async-storage/async-storage (2.2→3.0): breaking change API, pero compatible con código actual (métodos `getItem`, `setItem`, `removeItem` siguen igual).
    - chordsheetjs (14.6→15.2): **tested** — transposición de acordes sigue funcionando correctamente.
- **Validaciones tras actualización**:
  - ✅ `npx tsc --noEmit` — sin errores de TypeScript.
  - ✅ `npm run lint` — sin errores ESLint (solo 44 warnings sobre imports no usados, no críticos).
  - ✅ `npm audit` — 5 vulnerabilidades low (aceptadas, en dev/build-time, documentadas en TODO.md).
- **Testing realizado**: app web (`npm run web`) cargada y funcionalidad básica verificada (tabs, búsqueda cantoral, detalles de canción, transposición).
- **No requiere cambios de código en componentes**: todas las actualizaciones son compatibles hacia adelante. AsyncStorage v3 sigue siendo transparente para el código de usuario.

---

## 2026-05-19 — Toast rediseñado y prompt de actualización OTA

- **Toast modernizado** (`contexts/AppToastContext.tsx`): nueva tarjeta con BlurView translúcida en iOS (tinte oscuro por variante), badge circular con icono según variante (`check-circle`, `error`, `warning`, `info`), border-radius 20, esquinas separadas (margin horizontal 18 + 18px más de aire vertical sobre tab bar/home indicator), sombra más prominente y entrada con spring + scale. Añadido haptic feedback contextual (success/error/warning/selection) en cada toast. Sin cambios en la API pública `useToast()` — todos los `toast.show(...)` existentes funcionan tal cual.
- **Prompt de actualización OTA** (`components/OTAUpdatePrompt.tsx` + `hooks/useOTAUpdate.ts`, montado en `app/_layout.tsx`): sustituye el discreto texto "actualización disponible 🔄✅" que aparecía en el pie de la Home (`VersionDisplay.tsx`) por un modal con backdrop blur, icono animado (rotación + halo pulsante), título "Nueva versión disponible", descripción y dos CTAs:
  - **"Reiniciar ahora"** → `Updates.reloadAsync()` (la app se reinicia sola y vuelve a abrirse con la nueva versión — Apple no permite cerrar la app a la fuerza, este es el patrón estándar de Expo Updates).
  - **"Más tarde"** → se descarta hasta el próximo arranque.
- El hook comprueba updates en background al arrancar (con 2.5s de delay para no bloquear el splash) y al volver del fondo, los descarga silenciosamente y muestra el modal cuando hay un bundle nuevo listo. Si el usuario abre el modal antes de que termine la descarga, se muestra estado "Preparando…" en el CTA.
- `VersionDisplay` ahora solo muestra versión + hash corto del bundle OTA (o `dev` en dev mode). Sin cambios cosméticos en colores; los strings se han limpiado.

---

## 2026-05-18 — App Store warning fix · Universal Links · Cloud Function de purga

- **Fix ITMS-90737 (App Store warning)**: añadido `LSSupportsOpeningDocumentsInPlace: true` en `ios.infoPlist` (`app.json`). Apple lo exige para cualquier app que declare `CFBundleDocumentTypes` (en este caso, el tipo de archivo `.mcm`). Sin esto la subida pasa pero genera un warning en cada release.
- **Universal Links (iOS) / App Links (Android)** para abrir `https://mcm.expo.app/playlist?p=…` y `https://mcm.expo.app/coro?c=…` directamente en la app instalada en lugar del navegador:
  - iOS: nuevo `ios.associatedDomains: ["applinks:mcm.expo.app"]` en `app.json`. Requiere el AppID `5P53S6QB23.com.familiaconsolacion.mcmapp`.
  - Android: nuevo `intentFilter` con `autoVerify: true`, `scheme: https`, `host: mcm.expo.app`, `pathPrefix: /playlist|/coro` en `app.json`.
  - **Verificación del dominio** (`mcm-app/public/.well-known/`): `apple-app-site-association` (sin extensión, components-form moderno) y `assetlinks.json`. Se sirven automáticamente al exportar la web (`expo export -p web` copia `public/` → `dist/`). **TODO antes de release**: rellenar `sha256_cert_fingerprints` en `assetlinks.json` con la huella SHA-256 de "App signing key certificate" de Play Console (o vía `eas credentials -p android`). Ver `public/.well-known/README.md` para detalles.
- **Cloud Function de purga programada** (`mcm-app/functions/`): nueva función `purgeExpiredShares` que corre cada 24h (zona horaria Europe/Madrid) y borra entradas de `/playlistShares` y `/choirSessions` cuyo `expiresAt` ya pasó. Reemplaza la "limpieza perezosa" lado cliente que solo se ejecutaba cuando alguien intentaba leer una playlist caducada.
  - Stack: Firebase Functions v2, `onSchedule`, TypeScript, Node 20.
  - Despliegue manual desde `mcm-app/`: `firebase use --add` (primera vez) + `firebase deploy --only functions`. **Requiere plan Blaze** del proyecto Firebase (las scheduled functions lo exigen — se usan ~30 invocaciones/mes, entra de sobra en el free tier).
  - Estructura nueva: `mcm-app/firebase.json`, `mcm-app/functions/{package.json,tsconfig.json,src/index.ts}`.

---

## 2026-05-17 — Exportar playlist a PDF

- **Nueva acción "Exportar a PDF"** en el menú "…" de la pantalla de seleccionadas (`app/screens/SelectedSongsScreen.tsx`). Genera un PDF con portada (nombre de playlist + índice de canciones con tono) y cada canción formateada con título, autor, tono (transportado y original si aplica) y cejilla en la parte superior; cuerpo con acordes sobre letras parseado desde ChordPro (vía `chordsheetjs`).
- **Modal de configuración previo** (`components/playlist/ExportPdfModal.tsx`): nombre de la playlist, una canción por página (sí/no), mostrar acordes (sí/no) y tamaño de letra (11–15pt). Por defecto desactiva "una por página" y aplica `break-inside: avoid` en cada canción para evitar que se partan entre páginas cuando caben enteras.
- **Generador HTML** (`utils/playlistPdfHtml.ts`): tipografía Inter (Google Fonts, con fallback al stack del sistema), acordes en `#0055A4` negrita, letras 13pt por defecto, interlineado 1.55, estribillos resaltados con borde lateral. Respeta la notación EN/ES configurada y aplica el transpose persistido por canción.
- **Multiplataforma**: en web abre una pestaña nueva con el HTML y lanza `print()` para que el usuario guarde como PDF; en iOS/Android usa `expo-print` (`printToFileAsync`) + `expo-sharing` para compartir el PDF resultante.
- **Nueva dependencia**: `expo-print` (~15.0.0). Tras pull, ejecutar `npx expo install expo-print` si no se instala automáticamente.

## 2026-05-17 — Rediseño selección de canciones: transpose persistido, orden libre, nube y modo Coro

- **Nuevo modelo de selección** (`contexts/SelectedSongsContext.tsx`): `SelectedSong[]` con `{ filename, transpose, order, categoryHint, addedAt }`. Persistencia en `AsyncStorage` (`@mcm_playlist_v2`) con migración tolerante del formato anterior (array de strings). API ampliada: `setTranspose`, `moveSong`, `replaceAll`, `getSelectedSong`, `isHydrated`.
- **Transpose persistido por canción**: si la canción está seleccionada, su transpose vive en el contexto y se preserva al exportar / compartir / sincronizar. En `SongDetailScreen`, el transpose efímero local solo aplica si la canción NO está en la selección. La pill de tono muestra el original tachado + tono final + badge "+N" tanto en `SongListItem` como en la nueva `PlaylistRow`.
- **Exportar/Importar archivo `.mcm` v2**: nuevo schema `{ version: 2, songs: SelectedSong[], createdAt }` que incluye tono y orden. Importación tolerante con el formato v1 (array de strings). `hooks/useIncomingPlaylist.ts` actualizado para entender ambos.
- **Subir/Descargar playlists desde Firebase RTDB con código de 4 dígitos** (`services/cloudPlaylistService.ts`, ruta `/playlistShares/{code}`): cualquiera con el código puede importar; al subir, si el código ya existe se ofrece sobrescribir / elegir otro / cancelar. Cambio de código y borrado disponibles. Se almacena `expiresAt` con +6 meses (purga real pendiente — recomendación: Cloud Function programada). URL compartible `https://mcm.expo.app/playlist?p=1234` que en web salta a la pantalla de seleccionadas con autoimport (nuevo `app/playlist.tsx` + `utils/pendingCloudPlaylist.ts`).
- **Modo Coro** (`contexts/ChoirSessionContext.tsx`, `services/choirSessionService.ts`, ruta `/choirSessions/{code}`): un dispositivo maestro publica `current { filename, transpose, title, content, ... }` en tiempo real y N esclavos siguen automáticamente la canción (navegando a `SongDetail`). El esclavo puede activar "Mi tono" para desincronizar el transpose localmente sin afectar al resto. La sesión persiste si el maestro cierra la app; expira a las 2 semanas. Banner persistente `<ChoirSessionBanner />` con código, rol, tono activo y botón salir/cerrar. Códigos editables vía mismo diálogo OTP. Observador del esclavo montado en `app/(tabs)/cancionero.tsx` para que el stack del cantoral navegue solo.
- **UI rediseñada de "Seleccionadas"** (`app/screens/SelectedSongsScreen.tsx`): header con un único botón "…" que abre un menú con todas las acciones (BottomSheet-style). Vista doble "Por categoría" / "Orden libre" con controles ↑↓ para reordenar. Empty state con accesos rápidos (importar archivo / código nube / unirse a coro). Diálogo OTP visual de 4 dígitos (`components/playlist/CodeInputDialog.tsx`) con sugerencias "Aleatorio" y "Hoy (DDMM)". Diálogo de confirmación multi-acción reutilizable. Tono final/original con flecha visible en cada fila.
- **Tamaño de código fácilmente ampliable**: cambiar `CODE_LENGTH` en `utils/playlistCodes.ts` (hoy 4, sirve para 6/8 sin más).
- **Estructura Firebase nueva**:
  - `/playlistShares/{code}` → `{ v: 2, songs, name?, createdAt, updatedAt, expiresAt }`
  - `/choirSessions/{code}` → `{ v: 1, master: {deviceId, name?, lastSeen}, playlist, current?, createdAt, updatedAt, lastActivity, expiresAt }`
  - Sin reglas de seguridad: cualquier cliente puede leer/escribir bajo el código. Aceptable para el uso esperado (~20 dispositivos en confianza, baja frecuencia).
- **Pendientes recomendados** (no implementados):
  - Cloud Function programada para purga de `playlistShares` y `choirSessions` expirados.
  - Deep link nativo (iOS Universal Links / Android App Links) para abrir el deep `/playlist?p=` directamente en la app instalada. Hoy funciona en web.
- Archivos clave nuevos: `contexts/ChoirSessionContext.tsx`, `services/cloudPlaylistService.ts`, `services/choirSessionService.ts`, `components/playlist/*`, `utils/playlistCodes.ts`, `utils/transposeKey.ts`, `utils/pendingCloudPlaylist.ts`, `app/playlist.tsx`.

---

## 2026-04-29 — Rediseño Contigo (Evangelio + Oración + Revisión)

- **Nueva home `/contigo`**: layout reordenado a header (título + fecha + chip litúrgico + botón guardados) → hero card con `ProgressRing` (1/2/3 colores: azul, naranja, verde) → 3 `HabitTile`s (Evangelio · Oración · Revisión) → teaser del evangelio del día (título + cita + fade-out preview + chip "Leído hoy") → strip semanal Lun–Dom con dots por hábito → 3 `StatCard`s (racha · min sem. · lecturas mes) → `MonthHeatmap`. `app/(tabs)/contigo/index.tsx` reescrita.
- **Nuevos componentes**: `components/contigo/HomeWidgets.tsx` (`ProgressRing`, `HeroCard`, `HabitTile`, `EvangelioTeaserCard`, `WeekStrip`, `StatCard`, `MonthHeatmap`), `components/contigo/BreathingPhase.tsx`, `components/contigo/theme.ts` (tokens `WARM_LIGHT` / `WARM_DARK`, helpers `warm()`, `formatDateLong()`, `getWeekDates()`, `buildCalendar()`, `offsetDate()`).
- **Pantalla Revisión del día** (`app/(tabs)/contigo/revision.tsx`, ruta nueva, tipo "Agradecer y revisar"):
  - Animación inicial "Para un momento..." con círculos concéntricos respirando ~5s (skip al tocar).
  - Indicador de progreso con dots morados/dorados (sin números).
  - Paso 1 "Agradecer" — toggle Lista/Texto libre, mínimo 3 casillas, +Añadir/−Quitar.
  - Paso 2 "Revisar" — área de texto libre.
  - Navegación por días con flechas (no fuerza la respiración).
  - Persiste en `AsyncStorage` bajo `@contigo_revision_<YYYY-MM-DD>` y marca `revisionDone` en el habit tracker. Celebra con `CelebrationAnimation`. Solo se implementa el primer modelo; el "test" queda para futuro.
- **Hook `useContigoHabits`**: nuevo campo `revisionDone` (sustituye al antiguo `examenDone`, eliminado), `setRevisionDone`, `isRevisionDone`, `getTotalMinutesWeek(todayStr)`, `getReadingsMonth(todayStr)`. `getStreak('examen')` → `getStreak('revision')`.
- **Limpieza**: eliminado `components/contigo/ContigoToolCard.tsx` (sustituido por `HabitTile` + `EvangelioTeaserCard` en la nueva home).
- **Evangelio**: paleta alineada con tokens del rediseño (`#C4922A`/`#DAA520`); ahora lee `params.date` para abrir el evangelio de un día concreto desde la pantalla de guardados.
- **Bookmarks**: pantalla rediseñada en línea con la nueva tarjeta (barra dorada + cita + fecha larga + preview cursivo + botón "Leer evangelio →"); empty state ilustrado.
- **Oración**: paleta alineada con tokens del rediseño. La pantalla mantiene su flujo completo (no se usa el bottom sheet del mockup) ya que la lógica existente cubre todos los casos.
- **Dark mode**: cubierto en todas las pantallas y widgets nuevos vía `warm(isDark)`.
- Archivos: `app/(tabs)/contigo/{index,revision,bookmarks,evangelio,oracion,_layout}.tsx`, `components/contigo/{HomeWidgets,BreathingPhase,theme}.ts(x)`, `hooks/useContigoHabits.ts`.

---

## 2026-04-23 — Sistema de eventos genérico (Jubileo + futuros)

- **Arquitectura**: nuevo registry `constants/events.ts` con `EventConfig` (id, title, tintColor, firebasePrefix, sections). Jubileo migrado a config; para añadir un evento nuevo basta con duplicar la entrada, subir datos a Firebase bajo `<firebasePrefix>/<section.firebaseKey>` y (opcional) añadir un ítem en MasHome que navegue al mismo `JubileoHome` pasando `{ eventId }`.
- **Convenciones Firebase**: Jubileo vive en `jubileo/` (raíz, legacy). Eventos creados desde el panel MCM viven en `activities/<nombre>/` (el panel mantiene además `activities/updatedAt`).
- **Flag `hidden` por sección**: cada nodo de sección admite un campo opcional `hidden: boolean` en Firebase (hermano de `data` y `updatedAt`); si es `true`, el hub oculta esa tarjeta. `useFirebaseData` lo expone en el return y lo persiste en AsyncStorage para disponibilidad offline. También se puede poner `hidden: true` en el `EventSection` del código local.
- **Route params**: `MasStackParamList` ahora lleva `eventId?: string` en todas las pantallas de evento. `useCurrentEvent()` (nuevo hook) las resuelve con fallback al default.
- **Sub-pantallas desacopladas**: `HorarioScreen`, `MaterialesScreen`, `VisitasScreen`, `GruposScreen`, `ContactosScreen`, `ProfundizaScreen`, `AppsScreen`, `ReflexionesScreen`, `ComidaScreen` ya no hardcodean `jubileo/xxx`; piden el path vía `getEventFirebasePath(event, key)` + `getEventCacheKey(event, key)`.
- **Stack options dinámicas**: helpers `eventScreenOptions` + `eventHubScreenOptions` en `app/(tabs)/mas.tsx` derivan título, tintColor y color de texto del evento activo. Eliminada la repetición de 12 bloques idénticos.
- **EventHomeScreen**: nuevo `app/screens/EventHomeScreen.tsx` (sustituye a `JubileoHomeScreen.tsx`, borrado). Grid responsive (2 cols < 700px, 3 cols ≥ 700px), tarjetas con sombra tintada + accent bar + icon circle, soporte dark mode completo. Cada card prefetcha su nodo Firebase, detecta `hidden` y se esconde si procede. Offline banner dirigido por `useNetworkStatus()`.
- **Documentación**: guía completa en la raíz del monorepo (`/EVENTOS.md`) con estructura Firebase, los 3 pasos para crear un evento nuevo, uso del flag `hidden` y flujo de navegación. `CLAUDE.md` del monorepo lo referencia.
- **Archivos principales**: `constants/events.ts` (nuevo), `hooks/useCurrentEvent.ts` (nuevo), `app/screens/EventHomeScreen.tsx` (nuevo), `app/screens/JubileoHomeScreen.tsx` (eliminado), `hooks/useFirebaseData.ts` (extendido con `hidden`), `app/(tabs)/mas.tsx`, `app/screens/MasHomeScreen.tsx` + las 9 sub-pantallas indicadas, `EVENTOS.md` (nuevo, raíz del monorepo).

## 2026-05-03 — Onboarding · rediseño visual

- Rediseño completo de `app/onboarding.tsx` siguiendo el prototipo de Claude Design (4 pantallas: bienvenida, perfil, delegación, confirmación).
- Pantalla de bienvenida nueva con logo MCM, ripples animados, shimmer en CTA y fondo `primary`.
- Animaciones con `react-native-reanimated`: slide-in/out entre pasos, fade-up con stagger en cards, ripple infinito, shimmer en botón "Comenzar".
- Pantalla de éxito nueva con check animado y resumen del perfil/delegación elegidos.
- Lógica de datos sin cambios: sigue leyendo `rawConfig.profiles`/`rawConfig.delegationList` desde `ProfileConfigContext` y persiste con `useUserProfile().setProfile`.

## 2026-04-30 — Sistema de Perfiles · auditoría y endurecimiento

Revisión completa del sistema. Cambios:

- **Bug fix (segmentación de notificaciones)**: el resolver descartaba los `notificationTopic` de delegación (ej. `"castellon"`) al sanitizarlos contra `KNOWN_NOTIFICATION_TOPICS`. Resultado: el array `topics` que se subía a `/pushTokens/{id}` nunca incluía la delegación → backend no podía segmentar por delegación local. Ahora `notificationTopics` no se sanea contra catálogo (los IDs base del catálogo siguen presentes en cada perfil).
- **`utils/resolveProfileConfig.ts`** ahora tolera config remota corrupta sin crashear: perfil ausente → cae al primer perfil válido (o `FALLBACK_PROFILE`); `delegations`, `global` o arrays del perfil ausentes → defaults sensatos.
- **`isAppVersionSupported`** NaN-safe: strings inválidos (`"foo"`, `""`, undefined coercido) ya no producen `NaN > NaN` (que devolvía `false` y podía bloquear usuarios incorrectamente con la pantalla de actualización). Atajo explícito para `minVersion === '0.0.0'`.
- **`contexts/ProfileConfigContext.tsx`** valida la forma del documento remoto (`global`, `profiles`, `delegations`, `delegationList`) antes de usarlo. Si está malformado, cae al fallback hardcoded con warning en dev.
- **Nuevo test** `__tests__/resolveProfileConfig.test.ts` (15 casos): merge perfil+delegación, overrides, sanitización, retención de topics de delegación, tolerancia a config corrupta, semver. Pasan con `npx jest --preset=ts-jest`.
- **Limpieza**: eliminados `app/(tabs)/_layout.tsx.backup` y `app/(tabs)/jubileo.tsx.old` (orphans de migraciones anteriores).
- **Docs sincronizados**: `TODO.md`, `TABS_MAINTENANCE.md` y `firebase-seed/README.md` ya no referencian `featureFlags.ts`. La sección "qué editar tras importar el seed" refleja que las 16 delegaciones ya están sembradas y solo hace falta rellenar `defaultCalendars`.

## 2026-04-23 — Sistema de Perfiles de Usuario · Fases 1-8 (reemplaza FeatureFlags)

**Cambio de arquitectura**: toda la visibilidad de tabs/home/más/álbumes/notificaciones se configura ahora desde Firebase RTDB (`/profileConfig`) por perfil (familia/monitor/miembro) y delegación (MCM España y 15 delegaciones locales + Internacional). El antiguo sistema de feature flags está eliminado.

- **Archivos eliminados**: `contexts/FeatureFlagsContext.tsx`, `constants/featureFlags.ts`, `__tests__/featureFlags.test.ts`, `FEATURE_FLAGS_OTA.md`, `components/UserProfileModal.tsx` (huérfano).
- **Archivos nuevos**:
  - `contexts/ProfileConfigContext.tsx` — descarga `/profileConfig` con caché offline (patrón `useFirebaseData`).
  - `hooks/useResolvedProfileConfig.ts` — combina config remota + UserProfile → `ResolvedProfileConfig` memoizado.
  - `app/onboarding.tsx` — pantalla inicial de 2 pasos (perfil → delegación). Saltable; default = `miembro` + `_default`.
  - `components/MaintenanceScreen.tsx` — pantalla de bloqueo para `maintenanceMode` y `minAppVersion`.
- **Archivos modificados**:
  - `app/_layout.tsx` — reemplaza `FeatureFlagsProvider` por `ProfileConfigProvider`, añade redirect al onboarding, pantallas de mantenimiento/actualización.
  - `contexts/UserProfileContext.tsx` — amplía con `profileType`, `delegationId`, `onboardingCompleted`; elimina `location`.
  - `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/screens/MasHomeScreen.tsx` — filtran tabs/home buttons/más items por `resolved.*`.
  - `hooks/useCalendarConfigs.ts` — semilla defaults desde `resolved.defaultCalendars`.
  - `app/(tabs)/fotos.tsx` — filtra álbumes por intersección `album.tags ∩ resolved.albumTags` (álbum sin tags = visible para todos).
  - `services/pushNotificationService.ts` + `notifications/usePushNotifications.ts` — token ampliado con `profileType`, `delegationId`, `topics`; re-publica metadata al cambiar el perfil.
  - `components/SettingsPanel.tsx` — añade selectores de perfil y delegación; elimina el botón legacy de cambiar nombre.
  - `components/AppFeedbackModal.tsx`, `ReportBugsModal.tsx`, `SuggestSongModal.tsx`, `hooks/useWordleStats.ts`, `app/screens/ReflexionesScreen.tsx` — sustituyen `profile.location` por `resolved.delegationLabel` en los reportes a Firebase.
- **Firebase**:
  - Nuevo nodo `/profileConfig` con `data.global`, `data.profiles`, `data.delegations`, `data.delegationList`, `data.overrides`.
  - `/pushTokens/{id}` añade opcionalmente `profileType`, `delegationId`, `topics` para segmentación desde `mcmpanel`.
  - `/albums/*` admite campo opcional `tags` (álbumes sin tags siguen siendo visibles para todos — retrocompatible).
- **Pendiente manual del admin**: subir `firebase-seed/profileConfig.json` al nodo `/profileConfig` y rellenar `defaultCalendars` por perfil con los IDs reales de `/calendars`.

## 2026-04-23 — Sistema de Perfiles de Usuario · Fase 0

- **Preparación del nuevo sistema de perfiles/delegaciones**: se crean los cimientos (tipos, resolver puro, catálogo de IDs, fallback hardcoded y seed para Firebase) sin tocar aún los consumidores ni `FeatureFlagsContext`. La app se comporta exactamente igual que antes.
- Diseño revisado en `TODO_SISTEMA_PERFILES.md`: pseudocódigo corregido, bloque `global` ampliado con todos los flags actuales + `minAppVersion` + `maintenanceMode`, overrides a nivel delegación, hook `useResolvedProfileConfig()` para romper el ciclo de providers, skip del onboarding = `miembro` + `_default`.
- Archivos nuevos:
  - `types/profileConfig.ts` — tipos (`ProfileType`, `ProfileBase`, `ProfileConfigData`, `ResolvedProfileConfig`, …)
  - `constants/profileCatalog.ts` — `KNOWN_TABS`, `KNOWN_HOME_BUTTONS`, `KNOWN_MAS_ITEMS`, `KNOWN_ALBUM_TAGS`, `KNOWN_NOTIFICATION_TOPICS`
  - `utils/resolveProfileConfig.ts` — resolver puro con sanitización + `isAppVersionSupported`
  - `firebase-seed/profileConfig.json` — seed listo para importar a Firebase RTDB
  - `firebase-seed/README.md` — instrucciones de subida
  - `constants/defaultProfileConfig.ts` — importa el JSON + exporta `DEFAULT_RESOLVED_PROFILE_CONFIG` para render inmediato
- Pendiente manual: subir `firebase-seed/profileConfig.json` al nodo `/profileConfig`, rellenar `delegationList` con las delegaciones reales y los IDs de `defaultCalendars` por perfil.

## ${today} — Arreglo de navegación en tabs Más y Cantoral (Restauración)

- **Bug fix**: Se restauró la lógica de navegación para volver a la pantalla inicial (`popToTop`) al pulsar la pestaña "Más" o "Cantoral" si ya se está en ella, usando el listener `tabPress` sobre el navigator padre (`useNavigation().getParent()`).
- Archivos: `app/(tabs)/mas.tsx`, `app/(tabs)/cancionero.tsx`

## 2026-03-25 — Migración completa de react-native-paper → heroui-native

- **Eliminación de dependencia**: `react-native-paper` eliminado completamente del proyecto
- **Nueva UI library**: `heroui-native` (v1.0.0) añadida junto con sus dependencias: `tailwindcss`, `uniwind`, `react-native-svg`, `tailwind-merge`, `tailwind-variants`
- **Proveedor raíz**: `PaperProvider` reemplazado por `HeroUINativeProvider` en `app/_layout.tsx`
- **Toast/Snackbar**: todos los usos de `Snackbar` + `Portal` reemplazados por el hook `useToast()` de heroui-native (patrón imperativo: `toast.show({...})`)
- **Card**: `Card.Content` → `Card.Body` (HeroUI). Afecta: `EventItem.tsx`, `VisitasScreen.tsx`, `ReflexionesScreen.tsx`
- **Accordion**: `List.Accordion` + `List.AccordionGroup` reemplazados con acordeón custom (estado local + TouchableOpacity) en `ProfundizaScreen.tsx`
- **Modal**: todos los `Portal > Modal` de Paper → `Modal` nativo de React Native
- **Formularios**: `TextInput` de Paper (floating label) → RN `TextInput` + etiqueta manual; `Switch` de Paper → RN `Switch`
- **Botones**: `Button` de Paper → `TouchableOpacity` con estilos propios; `FAB` → TouchableOpacity absoluto en Android / `GlassFAB` sin cambios en iOS
- **Listas**: `List.Item`, `List.Section`, `List.Accordion` → Views/TouchableOpacity con estilos custom en `GruposScreen.tsx`, `ContactosScreen.tsx`, `AppsScreen.tsx`
- **Avatar**: `Avatar.Text` → View circular con iniciales en `ContactosScreen.tsx`
- **Chip**: `Chip` de Paper → View + Text con estilos inline en `ReflexionesScreen.tsx`, `AppsScreen.tsx`
- **IconButton**: todos los `IconButton` de Paper → `TouchableOpacity` + `MaterialIcons` de @expo/vector-icons
- **Icons**: iconos de MDI (react-native-paper) → MaterialIcons en todos los componentes migrados
- **Metro config**: extendido con `withUniwindConfig` para soporte Tailwind v4
- **global.css**: nuevo entry point de Tailwind v4 con imports de tailwindcss, uniwind y heroui-native
- Archivos afectados: `app/_layout.tsx`, `app/(tabs)/fotos.tsx`, `app/(tabs)/calendario.tsx`, `app/screens/CategoriesScreen.tsx`, `app/screens/SelectedSongsScreen.tsx`, `app/screens/GruposScreen.tsx`, `app/screens/ContactosScreen.tsx`, `app/screens/ProfundizaScreen.tsx`, `app/screens/ReflexionesScreen.tsx`, `app/screens/AppsScreen.tsx`, `app/screens/VisitasScreen.tsx`, `app/screens/ComunicaScreen.tsx`, `app/screens/ComunicaGestionScreen.tsx`, `app/screens/ComidaWebScreen.tsx`, `app/(tabsdesactivados)/comunica.tsx`, `components/EventItem.tsx`, `components/FormattedContent.tsx`, `components/SongControls.tsx`, `metro.config.js`, `global.css`, `package.json`

## 2026-03-20 — Fix z-index cantoral + sistema de archivos .mcm para playlists

- **Bug fix**: botón "Importar playlist" y otros elementos en la pantalla de selección quedaban ocultos detrás del menú liquid glass en iOS. Aumentado `paddingBottom` y `marginBottom` en `SelectedSongsScreen` y snackbars
- **Nueva extensión .mcm**: las playlists ahora se exportan como archivos `.mcm` (JSON internamente) en vez de `.json`. Esto permite que solo MCM App abra estos archivos
- **Asociación de archivos en iOS y Android**: configurado `CFBundleDocumentTypes` + `UTExportedTypeDeclarations` (iOS) e `intentFilters` (Android) en `app.json` para que el sistema operativo reconozca archivos `.mcm` y los abra con la app
- **Importación desde archivos externos**: nuevo hook `useIncomingPlaylist` que escucha URLs entrantes cuando la app se abre desde un archivo `.mcm` (WhatsApp, Files, etc.) e importa la playlist automáticamente
- **SelectedSongsProvider movido al root layout** para que el handler de archivos entrantes funcione desde cualquier pantalla
- Compatibilidad retroactiva: la importación sigue aceptando `.json` y `.mcmsongs` además de `.mcm`
- Archivos: `app/screens/SelectedSongsScreen.tsx`, `app/_layout.tsx`, `app/(tabs)/cancionero.tsx`, `app.json`, `hooks/useIncomingPlaylist.ts`, `app/screens/CategoriesScreen.tsx`

## 2026-03-15 — Fix navegación en tabs Más y Cantoral

- **Bug fix**: al pulsar el tab "Más" o "Cantoral" estando dentro de una sub-pantalla del stack, la pantalla se quedaba bloqueada sin responder
- Añadido listener `tabPress` que hace `popToTop()` en el stack navigator interno cuando se re-pulsa el tab
- Archivos: `app/(tabs)/mas.tsx`, `app/(tabs)/cancionero.tsx`

## 2026-03-10 — Rediseño visual completo del Cantoral

- **Rediseño completo de la sección Cantoral** con estética moderna inspirada en Liquid Glass / iOS 18+
- **CategoriesScreen**: nuevo diseño con tarjetas redondeadas, emojis por categoría, contador de canciones, barra de búsqueda rápida integrada, fondo iOS-style (#F2F2F7)
- **SongListScreen**: barra de búsqueda moderna, cabecera con título y contador, mejor separación visual
- **SongListItem**: badges pill para tonalidad (key) y capo con colores temáticos, indicador verde de canción seleccionada, metadatos mejorados
- **SongDetailScreen**: fondo adaptado a dark mode, padding optimizado
- **SongControls**: menú FAB rediseñado con popup card flotante, iconos Material Design, indicadores de estado activo con colores azules, animación de rotación del FAB, separadores visuales entre secciones
- **SongFontPanel**: nuevo diseño con controles +/- para tamaño, porcentaje visible, botones de tipografía con checkmark activo, handle de arrastre
- **TransposePanel**: display de transposición actual, botones con colores semánticos (verde subir, rojo bajar), handle de arrastre
- **SongFullscreenScreen**: controles con esquinas redondeadas (borderRadius 16), slider con fondo oscuro, header oculto en modo fullscreen
- **SelectedSongsScreen**: barra de herramientas compacta con pill buttons, empty state con icono grande y descripción clara, modal de exportación con diseño moderno
- **BottomSheet**: esquinas más redondeadas (20px), backdrop adaptado a dark mode
- **cancionero.tsx**: título simplificado a "Cantoral", header shadow deshabilitado, tipografía con letter-spacing negativo
- Soporte completo de dark mode en todas las pantallas con paleta consistente
- Cross-platform: sombras adaptadas a web (boxShadow) y nativas (shadow\*/elevation)
- Archivos afectados: `app/(tabs)/cancionero.tsx`, `app/screens/CategoriesScreen.tsx`, `app/screens/SongListScreen.tsx`, `app/screens/SongDetailScreen.tsx`, `app/screens/SongFullscreenScreen.tsx`, `app/screens/SelectedSongsScreen.tsx`, `components/SongControls.tsx`, `components/SongDisplay.tsx`, `components/SongListItem.tsx`, `components/SongFontPanel.tsx`, `components/TransposePanel.tsx`, `components/BottomSheet.tsx`

---

## 2026-03-06 — Actualización a Expo SDK 55

- **Expo SDK 54 → 55**: actualizado expo, react (19.1→19.2), react-native (0.81→0.83), y todos los paquetes expo-\*
- **New Architecture obligatoria**: eliminado flag `newArchEnabled` de `app.json` (ya es el comportamiento por defecto en SDK 55)
- **Eliminado `edgeToEdgeEnabled`**: ya no es una opción válida en SDK 55 (edge-to-edge es el comportamiento por defecto)
- **expo-file-system**: migrado a `expo-file-system/legacy` donde se usa la API clásica (`cacheDirectory`, `EncodingType`), ya que la API principal ahora usa `File`/`Directory`/`Paths`
- **expo-notifications**: actualizado cleanup pattern de `removeNotificationSubscription()` a `subscription.remove()`
- **expo-glass-effect**: actualizado `GlassStyle` de `'light'`/`'dark'` a `'regular'`/`'clear'`
- **NativeTabs**: actualizado imports de `Icon`/`Label` a `NativeTabs.Trigger.Icon`/`NativeTabs.Trigger.Label`
- **Nuevos plugins en app.json**: `@react-native-community/datetimepicker`, `expo-font`, `expo-image`, `expo-sharing`, `expo-web-browser`
- Archivos principales: `package.json`, `app.json`, `app/(tabs)/_layout.tsx`, `app/(tabs)/cancionero.tsx`, `components/ui/GlassHeader.ios.tsx`, `hooks/useNetworkStatus.ts`, `notifications/usePushNotifications.ts`, `app/screens/SelectedSongsScreen.tsx`

---

## 2026-03-03 — Mejoras del cliente de notificaciones, dark mode, accesibilidad y rendimiento

### Notificaciones — mejoras del cliente

- **NotificationsContext**: nuevo contexto (`contexts/NotificationsContext.tsx`) con suscripción en tiempo real a Firebase via `subscribeToNotifications()`, badge actualizado en foreground
- **Modal de detalle**: nueva pantalla modal para ver notificaciones completas (body, imagen, botón de acción) en `app/notifications.tsx`
- **Marcar todas como leídas**: botón en header + función `markAllNotificationsAsRead` en servicio
- **iOS action buttons**: mapeado de `actionIdentifier` (view, view_event, view_photos) a rutas internas en `usePushNotifications.ts`
- **useUnreadNotificationsCount**: simplificado, ahora delega al NotificationsContext

### Dark mode

- **ErrorBoundary.tsx**: usa `Appearance.getColorScheme()` para colores dinámicos (está fuera de providers)
- **SongFullscreenScreen.tsx**: fondo dinámico con `useColorScheme`
- **ComidaWebScreen.tsx**: overlay de carga y botón "Volver" adaptativos, ActivityIndicator usa tema correcto
- **MonitoresWebScreen.tsx**: overlay de carga adaptativo, ActivityIndicator usa tema correcto
- **WordleScreen.tsx**: teclado y barras de estadísticas con colores adaptativos
- **ReflexionesScreen.tsx**: tarjetas grupales con fondo y texto adaptativos en modo oscuro

### Rendimiento

- **Home (`app/(tabs)/index.tsx`)**: `ContextualDecoration` envuelto en `React.memo()`, animaciones con `useRef` en vez de `useState`

### Accesibilidad

- `accessibilityLabel` y `accessibilityRole` en botones de Home (notificaciones, ajustes, grid), pantalla de notificaciones (back, mark read, swipe, detalle)

### Infraestructura

- **Pre-commit hooks**: husky + lint-staged en raíz del monorepo para formateo automático con Prettier
- **Dependencias actualizadas**: todas las dependencias al máximo dentro de Expo SDK 54 (`npm update`)

### Pendiente para próxima sesión

- Upgrade a Expo SDK 55 (requiere `npx expo install --fix` + testing)
- Firebase 11→12 (major version, revisar guía de migración)

---

## 2026-03-01 — Mantenimiento general y reorganización de documentación

### Cambios funcionales

- **Cantoral activado**: `cancionero: true` en `constants/featureFlags.ts`
- **ErrorBoundary global**: nuevo `components/ErrorBoundary.tsx`, envuelve toda la app en `_layout.tsx`
- **Splash screen más rápido**: reducido de 1.5s a 0.9s (3 repeticiones en HelloWave)

### Limpieza de código

- Eliminados componentes muertos: `ReportBugsModalNew.tsx`, `ReportBugsModalFixed.tsx`, `ReportBugsModalSimple.tsx`, `.bak`, `.broken`, `.complex`
- Eliminados scripts de debug: `test-calendar-fix.js`, `test-firebase.js`, `test-new-logic.js`
- Eliminado `jest.config.js` y dependencias de test (jest-expo, @testing-library/\*, react-test-renderer)
- Eliminado `dotenv` de dependencies (solo se usaba en script eliminado)
- Movido `eslint-config-expo` de dependencies a devDependencies
- Script `npm test` cambiado a placeholder hasta que se configuren tests

### Documentación

- Creado `CLAUDE.md` en raíz del monorepo (orientación para agentes)
- Reescrito `mcm-app/CLAUDE.md` con referencia técnica completa
- Creado `CHANGELOG.md` y `TODO.md`
- Simplificado `README.md` para humanos con chuletas de comandos
- Consolidado 4 archivos `NOTIS_*.md` + `PANEL_NOTIFICACIONES_NEXTJS.md` → `NOTIFICACIONES.md`
- Eliminado `agents.md` (duplicado de `AGENTS.md`)

## 2025-11 — Estado conocido al crear esta documentación

- App publicada en stores (Android + iOS) y web
- Cantoral (`cancionero`) desactivado via feature flag (`cancionero: false`)
- Tab "Comunica" desactivada y movida a `app/(tabsdesactivados)/`
- Sistema de notificaciones push: cliente implementado, backend (panel Next.js) pendiente
- 4 componentes ReportBugsModal\* sin usar (reemplazados por AppFeedbackModal)
- No hay tests de Jest escritos
- Contraseña del panel secreto hardcodeada ("coco" en SecretPanelModal.tsx)
