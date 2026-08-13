# Changelog — MCM App

> Registro de cambios importantes. Agentes IA: documentad aquí los cambios significativos.
> NO documentar: ajustes cosméticos, typos, refactors sin cambio funcional.
> Entradas anteriores a mayo de 2026: ver `docs/CHANGELOG-ARCHIVO.md` (raíz del monorepo).

## Formato

```
## YYYY-MM-DD HH:MM — Descripción breve
- Qué cambió y por qué
- Archivos principales afectados
```

> **Incluid siempre la hora** (formato 24h, hora española) además de la fecha:
> con varios cambios el mismo día es la única forma de saber el orden.
> Entrada nueva SIEMPRE arriba del todo (orden cronológico inverso).

---

## 2026-08-13 18:20 — Reglas de Firebase listas para desplegar, con diagnóstico en ambos lados

**Reglas** (`database.rules.json`, reescrito). Los permisos que el panel
necesita cuelgan ahora de dos banderas en `/_config` (`legacyPanelWrites`,
`legacyNotificationsOpen`): con ellas en `true` todo funciona igual que hoy y
se apagan desde la consola sin desplegar. **Hay que sembrar `/_config` ANTES de
desplegar** (`firebase-seed/config.json`) o el panel se queda sin permisos.
Guía completa en `docs/desarrollo/FIREBASE_REGLAS.md`.

Bugs de las reglas que habrían roto la app:

- `activities/<ev>/evaluacion/updatedAt` lo escribe la app al enviar una
  evaluación y estaba denegado — sin él, ningún dispositivo se entera de que
  hay respuestas nuevas. Igual para `jubileo/evaluacion/**`, que no existía.
- **Escalada de privilegios en `users/$uid/isAdmin`**: el `.write` del nodo
  cascadeaba hasta el flag, así que cualquiera con sesión podía nombrarse admin
  y abrirse el panel secreto del cantoral. Cortado con un `.validate` (un
  `".write": false` debajo NO lo arregla: la cascada no se revoca).
- Los `.validate` de `playlistShares`/`choirSessions` estaban en el padre, donde
  los `update()` parciales no los reevalúan. Movidos a la hoja.

Fugas cerradas: `surveys/<id>/respuestas` y `<evento>/evaluacion/respuestas`
dejan de ser legibles en bloque (llevan `userName`, `userDelegation`, `userId`);
cada dispositivo lee la suya.

**App**:

- `useFirebaseData` ya no hace `get()` del nodo entero en la primera carga. Se
  traía las respuestas de todo el mundo para pintar un formulario. Ahora pide
  siempre `updatedAt`/`hidden`/`data` por separado.
- Acepta `path: null` para "sin nodo que mirar". `EventHomeScreen` consultaba un
  path inventado (`__noop__/<slug>`) por cada tarjeta de sección; con reglas
  cerradas eso es un `PERMISSION_DENIED` por render.
- Nuevo `utils/firebaseErrors.ts`: un `PERMISSION_DENIED` ya no se reintenta
  (nunca se arregla esperando) y **se reporta a Sentry** con la operación y el
  path, deduplicado por sesión para no reventar la cuota. Buscar
  `[firebase-rules]`.
- Test de contrato de las reglas (`__tests__/databaseRules.test.ts`, 170 casos)
  que las evalúa contra el inventario real de paths de la app y del panel, con
  las banderas puestas, apagadas y sin sembrar.

**Panel** (repo mcmpanel): deja de leer la raíz de la base de datos —
imprescindible, porque conceder `.read` en `/` es conceder `/users`— y modal
*ERROR DE REGLAS DE FIREBASE* con el path denegado y qué mirar.

**Pendiente**: la sección Usuarios del panel y el contador de destinatarios del
composer dejan de funcionar al desplegar. No tienen bandera a propósito
(`/users` es el diario de Contigo; `/pushTokens` enumerable es poder mandar push
a todos). Se arreglan con auth real en el panel — decisión D2.

## 2026-08-12 21:40 — Archivar un evento desde el panel ya funciona de verdad

- **B1 completo.** La app solo aplicaba el `_meta` que edita el MCM Panel
  (`title`/`tintColor`/`bannerText`/`status`) al **evento activo**. Todo lo
  demás salía del registry hardcodeado, así que archivar o desarchivar
  cualquier otro evento desde el panel no tenía ningún efecto, y la lista de
  "Eventos pasados" ignoraba también el título y el color que dijera el panel.
- Ahora se leen los `_meta` de **todos** los eventos del registry y se mergean;
  "Eventos pasados" se construye de esa lista ya mergeada, así que el estado
  archivado sale siempre de lo que diga el panel, sin publicar versión.
- **C3**: tipados `global.appReviewMode` y `data.appReviewBackup` como
  opcionales (el modo revisión de las tiendas que gestiona el panel) y
  documentado el mecanismo en `docs/contratos/PANEL_PERFILES.md` §1.6. La app
  no los lee: el efecto le llega ya aplicado en las `tabs`.
- Archivos: `hooks/useEventMeta.ts` (nuevo `useEventsMeta`),
  `contexts/ActiveEventContext.tsx` (expone `events` mergeados),
  `app/screens/EventosPasadosScreen.tsx`, `types/profileConfig.ts`.
- Docs: `PANEL_PERFILES.md`, `PLAN_INTEGRACIONES.md`, `BACKLOG.md`, `COROS.md`.

## 2026-08-12 20:35 — Menú de la playlist: opciones vivas, orden por uso y arreglos

- **Solo se ofrece lo que se puede hacer**: con la lista vacía siguen visibles
  las de importar, el hub del coro y el enlace del coro (que no depende de tu
  selección) — antes ese enlace desaparecía sin motivo. Vaciar, exportar, subir
  y compartir siguen ocultándose.
- **Orden por frecuencia real**: Mi coro → Exportar y compartir → Coro en vivo →
  Códigos y QR → Archivo → Vaciar (Archivo baja, que es lo más raro de usar).
- **Arreglo**: en una sesión en vivo que cuelga de un coro ya no se ofrece
  «cambiar el código» — la clave *es* el coro, así que cambiarla la desataba de
  él y el resto del coro no la encontraba. Su QR usa ahora `?coro=<id>`.
- **Un toque menos**: si abres «guardar» sin tener coro elegido, después de
  elegirlo la hoja vuelve a guardar en vez de dejarte en el inicio.
- Archivos: `app/screens/SelectedSongsScreen.tsx`,
  `components/playlist/ChoirSheet.tsx`.

## 2026-08-12 19:40 — Rediseño de «Tu selección»: las playlists cuelgan de un coro

- **Concepto nuevo: el coro es la entidad**. Se crea un coro («Coro Consolación
  Castellón»), se elige una vez en el dispositivo y a partir de ahí las
  playlists cuelgan de él. Importar la del domingo es **un toque** («Importar la
  última»); el histórico enseña nombre, fecha y el código en pequeñito. Los
  códigos y QR pasan a ser una opción secundaria, y todos los antiguos siguen
  funcionando (el contenido sigue en `/playlistShares/<code>`).
- **Nuevo nodo `/choirs/<choirId>`** con el índice de playlists del coro y
  `createdBy`, para que el panel pueda borrar coros y retocar nombres/fechas.
  Reglas de RTDB añadidas (lectura pública enumerable, escritura por coro).
- **Actualizar una playlist ya subida** deja de ser imposible: la app recuerda
  el enlace con la nube (código + coro + firma de la lista) y ofrece
  «Actualizar «X»» o «Subir como nueva». La cabecera dice si hay **cambios sin
  guardar**. Cualquiera puede machacar la de otra persona con la contraseña
  `coco`; si la subiste tú desde ese dispositivo, sin contraseña.
- **Importar ya no interroga**: venir de un enlace, un QR o el coro reemplaza la
  selección y deja **10 s de «Deshacer»** (canciones y enlace). El diálogo de
  «reemplazar / añadir» se queda solo para los archivos `.mcm`. **Vaciar** pasa
  a la cabecera, sin confirmación y con deshacer.
- **Coro en vivo por coro, no por código**: se entra por el nombre del coro,
  la sesión **caduca sola a las 24 h** desde que empezó (antes 2 semanas, y se
  estiraba sola) y se puede tomar el mando — sin contraseña si eres el mismo
  usuario desde otro dispositivo, con `coco` si es de otra persona.
- **Enlaces nuevos**: `/playlist?coro=<id>` (importa siempre la última) y
  `/coro?coro=<id>` (sesión en vivo). Reconocidos también por el escáner de QR.
- Archivos: `utils/choirIds.ts`, `utils/playlistSync.ts`,
  `services/choirDirectoryService.ts`, `services/choirSessionService.ts`,
  `services/cloudPlaylistService.ts`, `hooks/usePlaylistSharing.ts`,
  `hooks/useMyChoir.ts`, `hooks/usePlaylistLink.ts`,
  `components/playlist/ChoirSheet.tsx`, `components/playlist/PlaylistHeaderBar.tsx`,
  `app/screens/SelectedSongsScreen.tsx`, `app/playlist.tsx`, `app/coro.tsx`,
  `database.rules.json`. Documentación: `docs/funcionalidades/COROS.md`.

## 2026-08-09 16:40 — Menú "..." del cantoral, eventos pasados y raya de sección

- **El menú "..." del cantoral ya no se traga las opciones.** Cada opción es
  "cierra la hoja y abre otra cosa" (código, coro, selector de archivos),
  porque iOS no presenta dos modales a la vez: la acción viaja diferida hasta
  que la hoja está cerrada del todo. Ese eslabón dependía en exclusiva del
  `onDismiss` del `Modal`, y si no llegaba, la acción se perdía **en silencio**
  — el menú entero parecía muerto (desde el estado vacío, sin hoja de por
  medio, funcionaba: por eso el contraste). Ahora `BottomSheet` garantiza
  `onCloseComplete` exactamente una vez por cierre, con red de seguridad si
  `onDismiss` no aparece.
- **Sin canciones seleccionadas, el menú deja de ofrecer lo imposible**:
  desaparecen compartir mensaje, exportar PDF, subir playlist, exportar
  archivo y vaciar. Se quedan las de IMPORTAR (código y archivo) y el modo
  coro, que son las que tienen sentido con la playlist vacía.
- **Entrar en un evento ARCHIVADO ya no te suscribe a sus avisos.** La
  auto-suscripción es para eventos vivos; mirar un encuentro que ya pasó desde
  "Más > Eventos pasados" no es pedir que te avisen. La campana sigue ahí para
  activarlo a mano.
- **Cantoral y Calendario estrenan su raya de color arriba** (amarilla y
  celeste), como la roja de Fotos: identifica la sección aunque el header sea
  transparente y no lleve título. `components/ui/TabTintBar.tsx`, iOS.
- **+10 tests** sobre lo que se rompió sin que nadie se enterara: ciclo de vida
  del `BottomSheet` (monta el Modal en el mismo render en que se abre, sigue
  montado mientras se cierra, `onCloseComplete` una sola vez) y el menú de
  acciones (ejecuta después de cerrar, respeta `disabled`, no pinta secciones
  vacías). Suite en **593**.

## 2026-08-09 04:10 — La hoja de multimedia se abre y el reproductor se VE

Dos secuelas del arreglo de los bottom sheets, las dos reproducidas y
verificadas en el simulador iOS:

- **La ficha de multimedia del cantoral no se abría** (y era la única que
  seguía sin hacerlo). No era la animación: el `Modal` no llegaba a montarse.
  `BottomSheet` encendía `modalVisible` con un **setState en fase de render**, y
  en pantallas que a su vez hacen su propio setState en fase de render —como el
  detalle de canción, que resetea estado al cambiar de canción— ese update se
  perdía: la hoja se quedaba con `visible` a true, sin `Modal`, y no aparecía
  hasta que algo ajeno forzaba otro render. Ahora `modalVisible` es **derivado**
  (`visible || closing`), que no se puede perder.
- **En pantalla completa, los botones del reproductor quedaban debajo del
  header.** El reproductor tapa toda la pantalla, pero el header del stack es
  NATIVO y se pinta ENCIMA: la barra con YouTube / salir de pantalla completa /
  cerrar caía justo debajo del botón de atrás y no había forma de tocarla. Ahora
  reserva el alto de la barra de navegación además del inset. (No se usa
  `useHeaderHeight()`: revienta si el reproductor se monta fuera de una pantalla
  con header.)
- **El reproductor flotante sonaba pero no se veía.** Nace justo cuando se está
  desmontando el `Modal` de la hoja, y su estilo animado (que empieza en
  `opacity: 0`) puede no llegar a aplicarse nunca: vídeo sonando, reproductor
  invisible y sin forma de pararlo. La opacidad sale del estilo animado; la
  entrada se queda en desplazamiento y escala, que si no se animan dejan el
  reproductor perfectamente visible.

**Sobre la duda que dejaba anotada la entrada de las 02:33** ("no es que en un
`Modal` no corra Reanimated a secas"): confirmado con una vista de prueba que
anima su opacidad de 0 a 1 dentro del propio `BottomSheet` —se queda invisible
tras un reinicio limpio de la app—. La regla que encaja con todo lo visto es
**`Modal` TRANSPARENTE**: ahí los estilos animados de Reanimated no se aplican;
en un `Modal` opaco (el escáner de QR) sí. Está escrito en la cabecera de
`BottomSheet.tsx`.

**Y de la ronda de ajustes de UI**: el chip de "Hoy" del evangelio ahora dice
**"Volver a hoy"** (parecía una etiqueta que anunciaba el día, no un botón), el
mes y sus flechas en el calendario de Contigo van alineados (el `smallLabel`
traía un `marginBottom` que descuadraba la fila) y el conmutador **Mes/Agenda
ocupa todo el ancho** hasta el botón de suscribirse, calculado desde el ancho
real de la ventana en vez de un número a ojo — así cuadra en cualquier pantalla
y al girar.

**Archivos**: `components/BottomSheet.tsx`,
`components/song-media/FloatingMediaPlayer.tsx`,
`app/(tabs)/contigo/{index,evangelio}.tsx`, `app/(tabs)/calendario.tsx`,
`components/ui/SegmentedControl.tsx`.

## 2026-08-09 02:33 — El marco del escáner de QR vuelve al centro de la pantalla

La "ventana" por la que se apunta al QR estaba pegada al **borde inferior** de
la pantalla, con las esquinas de abajo cortadas: en el JSX los paneles de
penumbra iban en el orden `arriba` → `abajo` → `fila del hueco`, así que la fila
con el hueco caía la última de la columna. Ahora van `arriba` → `hueco` →
`abajo` y el marco queda centrado. Verificado en el simulador iOS.

De paso, **revisados los dos ficheros que quedaban con Reanimated dentro de un
`Modal`** tras el arreglo de los bottom sheets, y **los dos están bien**:
`QrScannerModal` (el láser barre, las esquinas entran, los `entering={FadeIn}`
de cabecera y pie acaban visibles) y `PreviewChannelModal` (el bucle de `phase`
mueve gradientes y partículas). No hace falta migrarlos a `Animated`; queda
anotado en la cabecera de cada uno. Es decir, el fallo del 02:14 **no** es "en
un `Modal` no corre Reanimated" a secas — algo más específico le pasaba a
`BottomSheet`, y conviene volver sobre ello antes de generalizar la regla.

**Archivos**: `components/playlist/QrScannerModal.tsx`,
`components/PreviewChannelModal.tsx`.

## 2026-08-09 02:14 — Los bottom sheets vuelven a abrirse (y dejan de matar la pestaña)

El fallo gordo: **cualquier hoja inferior de la app abría un `Modal` invisible
que se comía todos los toques y dejaba la sección muerta hasta reiniciar** —
suscribirse a calendarios, sugerir canción, la ficha multimedia del cantoral, el
calendario de evangelios… Se reprodujo en simulador con binario nuevo, así que
no era cuestión de una build vieja.

**Causa**: la migración de `BottomSheet` a Reanimated (2026-08-03). Dentro de un
`Modal` de React Native, las animaciones de Reanimated 4 **no llegan a correr**:
la hoja se quedaba donde nacía (fuera de pantalla, fondo a opacidad 0) y el
callback de la animación de cierre —que es quien desmonta el `Modal`— no se
disparaba nunca. Las animaciones vuelven al `Animated` de React Native, con un
aviso en el fichero para que no se vuelva a migrar sin comprobarlo.

**Además:**

- **"Subrayar" ya sale en el menú nativo de iOS.** Nunca había salido, y no era
  (solo) el `.easignore`: `RCTUITextView` **ignora en silencio** cualquier
  `setDelegate:` de fuera ("it cannot be changed from outside"), así que el
  proxy del módulo `highlight-menu` no llegaba a instalarse. Ahora se pone
  llamando a la implementación de `UITextView`, y se reintenta también en
  `didAddSubview`. **Requiere binario nuevo** (no sale por OTA).
- **Subrayar desde el menú nativo pinta ya**, con un color al azar que se
  mantiene ~8 min (`utils/stickyHighlightColor.ts`): la barra de colores sale
  con ese color marcado, así que elegir otro es opcional en vez de un toque de
  peaje. 4 tests nuevos; suite en 583.
- **Entrar en modo subrayar ya no despliega todas las lecturas**: las tarjetas
  que tuvieras cerradas se quedan cerradas.
- **Las lecturas ya no crecen solas.** El `TextInput` del texto llevaba una
  altura puesta a mano desde `onContentSizeChange`, que se retroalimentaba (el
  evangelio se hacía grande poco a poco) y al cambiar de día conservaba la
  altura anterior (el salmo, corto, con medio folio en blanco). Ahora la mide
  React Native con `scrollEnabled={false}`.
- **Calendario de Contigo con meses.** El calendario de la home de Contigo
  estaba clavado en el mes en curso y con los días futuros bloqueados: ahora
  navega por meses (con atajo para volver al mes de hoy) y deja abrir días de
  más adelante, que las lecturas se publican con antelación. Y en el evangelio,
  un "Hoy" diminuto que solo aparece cuando estás mirando otro día.
- **Mes/Agenda pasa al header** del tab Calendario (con el botón de
  suscribirse), en vez de comerse una fila entera debajo. En el stack de "Más"
  se queda como estaba (allí hay título y back).
- **Cambiar de pestaña ya no reinicia el cantoral ni "Más"**: salías un momento
  a Contigo y volvías a la lista de categorías con la canción perdida. Volver a
  la raíz sigue siendo re-pulsar la pestaña activa. De paso desaparecen los
  `POP_TO_TOP was not handled by any navigator` de la consola.

**Archivos**: `components/BottomSheet.tsx`,
`modules/highlight-menu/ios/HighlightMenuView.swift`,
`utils/stickyHighlightColor.ts`, `hooks/useReadingHighlights.ts`,
`components/contigo/{ReadingCard,HighlightableReading,HomeWidgets}.tsx`,
`app/(tabs)/contigo/{index,evangelio}.tsx`, `app/(tabs)/calendario.tsx`,
`app/(tabs)/{cancionero,mas}.tsx`, `components/ui/SegmentedControl.tsx`.

## 2026-08-09 00:00 — Pantalla de "actualiza la app" rediseñada, con escape de gracia

La pantalla de bloqueo por versión mínima (`MaintenanceScreen`, `mode="update"`)
abría la Play Store en iOS cuando la app corría en web/PWA (`Platform.OS` daba
`'web'`, no `'ios'`) y siempre enlazaba a la ficha web de la tienda en vez de
abrir la app de la tienda directamente.

**Lo que se ha hecho:**

- **`utils/storeLinks.ts` (nuevo)**: `openAppStore()` detecta la plataforma
  correcta también en web (mira el user-agent) y abre primero el esquema
  nativo (`itms-apps://` / `market://`) para ir directo a la app de la tienda;
  si no está disponible, cae al enlace https.
- **`components/MaintenanceScreen.tsx`**: rediseño con animaciones
  (Reanimated: halo pulsante, icono con rebote) y botón "Ir a la tienda ya"
  más vistoso. Para `mode="update"` aparece a los 500ms un segundo botón
  ("Voy pa'dentro") con emojis revoloteando que deja pasar sin actualizar
  **por esta sesión** (`onSkip`).
- **`contexts/VersionGateContext.tsx` (nuevo)**: centraliza `updateRequired` /
  `updateSkipped` / `skipUpdate` / `openStore` para que tanto `_layout.tsx`
  (decide si bloquea) como el header de Home puedan compartir el estado.
- **`app/(tabs)/index.tsx`**: si el usuario salta la actualización obligatoria,
  aparece un icono de "tienes que actualizar" en el header (mismo patrón que
  el aviso de update OTA saltado) que abre la tienda directamente al tocarlo,
  sin diálogo de por medio.

**Archivos**: `utils/storeLinks.ts`, `contexts/VersionGateContext.tsx`,
`components/MaintenanceScreen.tsx`, `app/_layout.tsx`, `app/(tabs)/index.tsx`

---

## 2026-08-08 23:15 — Inicio de sesión en Android: Google nativo, ya de verdad

Android llevaba desde el 5 de junio con el cartel de **"Inicio de sesión
próximamente"**: los botones estaban ocultos y el onboarding se saltaba el paso
de login entero. Se acabó — **entrar con Google funciona en Android** igual que
en iOS, y de paso la capa de auth queda mejor en las tres plataformas.

**Lo que se ha hecho:**

- **Fuera el aviso de "próximamente"**: `SocialLoginSection` pinta el botón de
  Google en Android, y el onboarding vuelve a incluir el paso de login para los
  perfiles monitor y miembro (el indicador de pasos vuelve a marcar 3).
- **Apple no se pinta en Android** (no existe como proveedor nativo allí). La
  disponibilidad se pregunta de verdad con `isAppleSignInAvailable()` en lugar
  de deducirla de la plataforma, así que un iOS antiguo sin Apple Sign-In
  tampoco vería un botón que no funciona.
- **`utils/authErrors.ts` (nuevo)**: una sola tabla que traduce los códigos de
  las tres capas —`12501`/`10`/`7` del módulo nativo de Google,
  `ERR_REQUEST_CANCELED` de Apple, `auth/...` de Firebase— a códigos propios
  con mensaje de usuario. Antes cualquier fallo era un genérico "No se pudo
  iniciar sesión"; ahora el toast dice si falta conexión, si falta Google Play
  Services, o si ese correo ya tiene cuenta con otro proveedor. Y una
  cancelación sigue sin mostrar nada, que no es un error.
- **La configuración de Google se garantiza antes del `signIn()`**
  (`ensureGoogleSignInConfigured`), en vez de depender de que el efecto de
  arranque de `AuthContext` hubiera terminado. En Android eso importa: sin
  `webClientId` aplicado no llega `idToken` y Firebase no puede crear la
  sesión. Si la variable falta directamente en el build, ahora falla con un
  error explícito en lugar de en silencio.
- **Carga perezosa del módulo nativo con `require`** en vez de `import()`
  dinámico: mismo comportamiento en la app (Metro no hace code splitting) y
  además testeable. Si el binario no trae el módulo, el mensaje es "actualiza
  la app" en lugar de un fallo mudo.
- **Logo real de Google** (SVG en sus cuatro colores) sustituyendo la "G" de
  texto azul, y feedback háptico al entrar/fallar.
- **28 tests nuevos** (`authErrors.test.ts`, `platformAuthNative.test.ts`):
  suite en 579.

**Configuración pendiente fuera del código:** hay que registrar en Firebase las
huellas **SHA-1** del keystore de EAS y de Play App Signing, o Android falla con
`DEVELOPER_ERROR`. Paso a paso en
`docs/funcionalidades/LOGIN.md` (nuevo) y resumen en el §2.6 del documento de
build de agosto.

- Archivos: `utils/authErrors.ts` (nuevo), `utils/platformAuth.native.ts`,
  `utils/platformAuth.ts`, `contexts/AuthContext.tsx`,
  `components/SocialLoginSection.tsx`, `app/onboarding.tsx`,
  `__tests__/authErrors.test.ts`, `__tests__/platformAuthNative.test.ts`,
  `docs/funcionalidades/LOGIN.md`, `docs/desarrollo/BUILD_AGOSTO_2026.md`.
- **Sin paquetes nativos nuevos**: todo lo que usa ya estaba en el binario.

---

## 2026-08-08 20:25 — Navegación a tabs: un hueco más y 50 tests nuevos

Repaso del arreglo anterior. **Un hueco real que quedaba**: si el camino
resuelto era "entra por Más" pero **"Más" tampoco tenía ruta** —el perfil no lo
trae, o en iOS no cabe en la barra—, `router.push('/mas')` era otro no-op y el
botón volvía a no hacer nada. Ahora `resolveTabRoute` comprueba que "Más" sea
alcanzable antes de mandar por ahí y, si no lo es, devuelve el intento directo:
en Android/web funciona y en iOS no había camino de todas formas.

De paso, la condición "¿tiene ruta este tab?" se unificó en un solo predicado
(`hasRoute`) en vez de repartirse entre tres ramas: en iOS los tabs de la barra,
en Android/web los visibles del perfil.

**Cobertura: +50 tests en 4 ficheros nuevos**, con barridos exhaustivos en vez de
casos sueltos —el bug original vivía justo en una combinación que nadie había
recorrido—:

- `__tests__/tabNavigationInvariants.test.ts` (16): los **2^8 = 256 perfiles
  posibles × 3 plataformas**, comprobando que ningún tab visible se queda sin
  camino. Y dos invariantes atadas al código real: que cada espejo de
  `MAS_STACK_MIRROR` esté **registrado de verdad** en `mas.tsx` (se lee el
  fuente, incluido lo que entra por `renderEventScreens`), y que **todo tab que
  pueda caer en overflow tenga espejo** — sin él, en iOS es inalcanzable.
- `__tests__/useTabNavigation.test.tsx` (14): el cableado del hook con `router`
  mockeado — qué `push` sale y qué destino pendiente queda apuntado, incluido que
  no se ensucien los buzones.
- `__tests__/pendingNavigation.test.ts` (9): el contrato de los dos buzones de
  navegación pendiente (un solo uso, el nuevo pisa al viejo, independientes).
- `__tests__/splitTabsForBar.test.ts` (11): la premisa de todo, que no tenía
  tests propios — barra + overflow = los visibles sin perder ni duplicar, "mas"
  nunca en overflow, el orden lo manda `TABS_CONFIG` y no el perfil.

Suite: 60 ficheros, **551 tests** en verde (antes 56 / 501).

---

## 2026-08-08 19:40 — La Home ya no se equivoca de camino al ir a un tab

**Bug:** desde la Home, la tarjeta de un evento próximo y el botón "Ver
calendario" no llevaban al calendario. La causa: `navigateToCalendar` decidía el
camino con `Platform.OS === 'ios'` y entraba **siempre** por el stack de "Más".

Y eso solo acierta a veces. En iOS `IOSTabsLayout` crea un `NativeTabs.Trigger`
**solo por cada tab que cabe en la barra**, así que para un tab de overflow
`router.push('/calendario')` no falla: no hace nada. En Android y web están
registrados TODOS los tabs visibles del perfil, y allí el push directo siempre
vale. Y **qué tabs caben depende del perfil y de si hay evento en curso**: con
evento el calendario cae en overflow (y pasar por "Más" es lo correcto), sin
evento está en la barra (y pasar por "Más" aterriza en el tab equivocado, o en
ningún sitio si el perfil no tiene "Más").

Ahora eso lo resuelve un sitio, no cada botón a su manera:

- **`utils/tabNavigation.ts`** (puro, con tests): `resolveTabRoute` responde
  "¿ruta propia o entro por Más?" mirando el reparto REAL de la barra
  (`splitTabsForBar`), y `MAS_STACK_MIRROR` es la **fuente única** de qué tab
  tiene pantalla espejo en "Más".
- **`hooks/useTabNavigation.ts`**: `goToTab(tab, params?)` y
  `goToEventScreen(pantalla, params?)`.
- **Home**: el botón de calendario, las tarjetas de eventos próximos, el banner
  del evento activo y el CTA "Evalúa la actividad" pasan por ahí. De paso, dos
  cosas que estaban a fuego: el banner del evento hacía `router.push('/visitapapa')`
  ignorando el `tabId` del perfil, y el acceso de Fotos entraba por "Más" incluso
  siendo Fotos un tab de la barra.
- **`MasHomeScreen`**: sus tarjetas de overflow usaban su propia lista de espejos
  (`OVERFLOW_STACK_TARGETS`, sin `comunica`) — ahora usan la compartida, y el tab
  del evento resuelve al hub con su `eventId` en vez de a una ruta que en iOS no
  existe.

**Umbral de `max-lines`: 400 → 1.000** (y la guía de "trocear de verdad" 600 →
1.500), en `eslint.config.js` y `CLAUDE.md`. Con agentes de IA leyendo el código,
un archivo largo pero coherente cuesta menos que la misma lógica repartida en
seis ficheros. **Los gigantes se quedan**: la Fase 1 de `PLAN_CALIDAD.md` se
cierra por decisión, no por completada. Avisos de lint: 88 → 60.

**Nuevos**: `utils/tabNavigation.ts`, `hooks/useTabNavigation.ts`,
`__tests__/tabNavigation.test.ts` (10 tests). **Modificados**:
`app/(tabs)/index.tsx`, `app/screens/MasHomeScreen.tsx`, `eslint.config.js`,
`CLAUDE.md`, `docs/desarrollo/TABS_MAINTENANCE.md`, `docs/planes/PLAN_CALIDAD.md`.
Suite: 56 ficheros, 501 tests en verde.

---

## 2026-08-08 18:15 — Cuatro cosas pedidas que seguían sin estar `[skip-ota]`

### El ítem "Subrayar" del menú nativo NUNCA llegó a un binario (causa raíz)

El código estaba desde el 3 de agosto, pero **`.easignore` se comía las fuentes
nativas del módulo**. Es el mismo agujero que se arregló en `.gitignore` el 3 de
agosto (`a280e9d`) y que allí se quedó: reglas `ios/` y `android/` **sin barra
inicial**, que casan con cualquier carpeta con ese nombre a cualquier
profundidad. Y `.easignore`, cuando existe, **sustituye** a `.gitignore` para
decidir qué sube a EAS, así que arreglarlo allí no arreglaba esto.

Resultado: `modules/highlight-menu/` subía con su `expo-module.config.json` y su
JS pero **sin Swift, sin Kotlin, sin podspec ni `build.gradle`**. Autolinking lo
saltaba en silencio y todas las builds salieron sin el ítem del menú.
Comprobación de que no vuelve (no debe imprimir nada), añadida a
`docs/desarrollo/BUILD_AGOSTO_2026.md` §3:

```bash
git -c core.excludesFile=.easignore check-ignore -v --no-index \
  modules/highlight-menu/ios/HighlightMenuView.swift \
  modules/highlight-menu/android/build.gradle
```

Encima, tres cosas más del módulo:

- **Degradación limpia si el módulo no está en el binario.**
  `requireNativeView` NO lanza cuando falta: devuelve un componente cuyo nombre
  de vista nativa no existe y React Native lo sustituye por su placeholder de
  "componente sin implementar" — y como esta vista **envuelve** el texto de la
  lectura, eso se llevaba por delante el render del texto. Ahora se pregunta con
  `requireOptionalNativeModule` y sin módulo se renderiza un `View` pelado.
- **Reenganche en iOS y Android.** React Native se reasigna el delegate (iOS) y
  el `customSelectionActionModeCallback` (Android) al recrear el texto, así que
  con el enganche de una sola vez el ítem desaparecía en cuanto el texto se
  volvía a montar (cambio de día, de tamaño de letra, de modo) y no volvía hasta
  reiniciar la app. `attachIfNeeded` compara ahora con lo que hay puesto y nunca
  encadena dos proxies nuestros.

### Subrayar: seleccionas, tocas el lápiz y salen los colores

`HighlightableReading` solo reportaba la selección **dentro** del modo lápiz, así
que al entrar en el modo la barra decía "selecciona un texto" aunque hubiera
texto seleccionado, y no reaccionaba hasta mover las asas un pelo. Ahora la
reporta siempre que el texto sea un `TextInput` (en iOS, los dos modos). En
Android leyendo sigue siendo un `Text selectable`, que no da offsets: allí el
atajo es el ítem del menú nativo.

De paso, un bug que sacó el test nuevo: una selección hecha **de derecha a
izquierda** se descartaba como vacía (`end > start` en vez de `end !== start`; el
`Math.min`/`Math.max` de al lado era código muerto).

### Calendario: fuera el título del header

Volvió en la pasada del 7 de agosto y se comía el sitio del conmutador
Mes/Agenda, chocando con el botón de suscribirse. El **título lo pone ahora cada
anfitrión**, no la pantalla: en el tab no hay (`headerTitle: ''`), en el stack de
"Más" sí, porque allí es una pantalla apilada con su back. Y el cuerpo reserva la
altura real del header (`useHeaderHeight()`) en iOS, donde es transparente: antes
solo dejaba el hueco de la barra de estado y el contenido se metía debajo.

### Reproductor de audio/vídeo del cantoral

Cadena revisada de punta a punta y cubierta con tests (`songMediaFlow.test.tsx`):
la hoja avisa bien y el reproductor monta el embed correcto. Encima, tres cosas
que sí podían dejarlo en "no hace nada":

- **El reproductor nace cuando la hoja ya está DESMONTADA** (`onCloseComplete`,
  el gancho que el propio `BottomSheet` documenta para esto). En iOS la hoja es
  un `Modal` en su propia ventana: aparecer por debajo dejaba el reproductor
  tapado y el WebView arrancando en una ventana que no se ve.
- **El PiP de audio pasa de 64 a 116pt de alto.** El iframe de `/preview` de
  Drive pinta su propia cabecera encima de los controles: con 64 se veía una
  franja negra **sin el botón de play**.
- **Nunca es un callejón sin salida.** Se muestra "cargando", y si el embed falla
  (`onError`/`onHttpError`) sale un "toca para abrirlo fuera". El audio gana
  además su botón de abrir en Drive en la barra, que solo tenía el vídeo.

**Modificados**: `.easignore`, `modules/highlight-menu/` (JS + Swift + Kotlin),
`components/contigo/HighlightableReading.tsx`, `hooks/useReadingHighlights.ts`,
`app/(tabs)/calendario.tsx`, `app/screens/SongDetailScreen.tsx`,
`components/song-media/{SongMediaSheet,FloatingMediaPlayer}.tsx`,
`__tests__/{highlightSelection,songMediaFlow}.test.tsx`,
`docs/funcionalidades/SUBRAYADO.md`, `docs/desarrollo/BUILD_AGOSTO_2026.md`.
Suite: 55 ficheros, 491 tests en verde.

> ⚠️ **El ítem "Subrayar" del menú nativo necesita BUILD DE TIENDA.** Es código
> nativo: por OTA no va. El commit lleva `[skip-ota]`. Lo demás (lápiz,
> calendario, reproductor) sí sale por OTA.

---

## 2026-08-08 02:20 — Escáner de QR para importar playlists y unirse al coro `[skip-ota]`

Hasta ahora los QR que genera la app (`ShareQrModal`) solo se podían leer con la
cámara del sistema. Ahora se escanean **desde dentro**, en los dos diálogos en
los que se teclea un código: "Importar playlist con código" y "Unirse al coro".

- **Botón "Escanear QR"** en `CodeInputModal`, solo en las variantes
  `cloud-download` y `choir-join` (en las que uno GENERA el código no hay nada
  que escanear). Al leerlo se rellena y se envía solo: cero toques extra.
- **Lee los tres formatos** que produce la app: playlist en la nube
  (`/playlist?p=`), sesión de coro (`/coro?c=`) y playlist **sin conexión**
  (`mcmapp://playlist?d=`, con las canciones embebidas — se resuelve contra el
  catálogo cacheado, igual que el deep link). También acepta un QR con solo los
  4 dígitos.
- **Si el QR es del otro flujo** (enseñas el del coro en "importar playlist") no
  se cierra la cámara: sale un aviso y se sigue escaneando.
- **Animaciones**: el marco se dibuja esquina a esquina al abrir, un láser
  barre el hueco mientras busca, y al encontrarlo hay fogonazo verde, check,
  confeti (`CelebrationBurst`) y háptica de éxito antes de continuar.
- **Nueva dependencia NATIVA: `expo-camera`** → este cambio **NO puede ir por
  OTA**, necesita build de tienda. El commit lleva `[skip-ota]`. Aun así el
  módulo se carga con `require` dentro de un try/catch: si una OTA llegase a un
  binario antiguo, el botón simplemente no aparece en lugar de crashear.
- **Sin escáner en web**: ahí `expo-camera` depende del navegador y el enlace
  del QR se puede pinchar directamente.
- Archivos: `components/playlist/QrScannerModal.tsx`,
  `components/playlist/QrScanFrame.tsx`,
  `components/playlist/qrScannerStyles.ts`, `utils/qrScan.ts` (+ tests),
  `components/playlist/CodeInputModal.tsx` (estilos extraídos a
  `codeInputModalStyles.ts` para no pasar de 400 líneas),
  `app/screens/SelectedSongsScreen.tsx`, `app.json`.

## 2026-08-08 01:55 — El modo tester (Laboratorio Alpha) por fin recibe OTAs de `preview`

El modo alpha nunca llegó a funcionar. El intento anterior (2026-07-22) lo dejó
dependiendo de una build de tienda que no salió, y aun con ella habría seguido
sin funcionar bien. **Esta vez el arreglo va entero por OTA**: no hace falta
build nativa.

- **Causa raíz — API equivocada.** Se usaba
  `Updates.setUpdateURLAndRequestHeadersOverride()`, que (1) exige
  `updates.disableAntiBrickingMeasures: true` **en el binario** —config nativa,
  imposible de activar por OTA— y (2) aun con el flag, el override no surte
  efecto hasta cerrar y reabrir la app del todo, así que el
  `checkForUpdateAsync()` de esa sesión seguía yendo a `production`.
- **Fix — `Updates.setUpdateRequestHeadersOverride()`** (expo-updates ≥ 29;
  aquí 57.x). Sobreescribe solo la cabecera `expo-channel-name`, que es todo lo
  que hace falta. No necesita `disableAntiBrickingMeasures`, **muta la
  configuración viva** (el check inmediato ya va al canal nuevo) y se persiste
  en nativo, así que el chequeo del arranque también sale por `preview`.
  Funciona en cualquier build de EAS, incluida la que ya está en las tiendas.
- **`updates.disableAntiBrickingMeasures` se queda en `app.json` de momento, a
  propósito.** Ya no hace falta y conviene quitarlo (quita la protección que
  garantiza poder publicar un update que arregle un update roto; Expo
  desaconseja activarlo en tienda), pero **tocar `app.json` dispara el
  `guard-native` de `ota-production.yml`**, que obliga a `[skip-ota]` y con eso
  se saltaría la OTA entera — es decir, este arreglo no llegaría a los móviles
  ya instalados, que es justo el fallo que venimos a corregir. Quitarlo no tiene
  ningún efecto hasta la próxima build nativa, así que va a la bolsa nativa de
  `TODO.md` en vez de viajar con este cambio. El código funciona igual con el
  flag puesto o quitado.
- **Se acabó el fallo silencioso.** Antes todos los errores morían en un
  `logger.warn`: la palanca se movía, el pie ponía "· alpha" y el dispositivo
  seguía en `production`, sin ninguna señal. Ahora el modal cuenta qué ha pasado
  (cambiando / descargado / sin conexión / no soportado y por qué) y enseña un
  bloque de diagnóstico con el **canal realmente en uso** (`Updates.channel`),
  el canal tras reiniciar, la runtime version y el bundle. Si no se puede
  aplicar el canal, el flag **se revierte** en vez de mentir.
- **Se busca y descarga el update al momento**, con botón de "reiniciar y
  estrenarlo" en el propio modal, en vez de esperar al siguiente arranque.
- **Reconciliación en cada arranque, en las dos direcciones**: con el flag
  apagado se limpia el override explícitamente, para que nadie se quede
  atrapado en `preview` por un override heredado. También se limpia, si el
  binario lo permite, el override de URL que dejaba la versión antigua.
- **`OTAProvider` espera a que el canal esté reconciliado** antes de su primera
  comprobación (`useOTAUpdate({ ready })`): si no, la búsqueda de updates podía
  ganarle la carrera al override y pedirle el bundle a `production`.
- **La palanca.** No se ha podido reproducir el fallo sin dispositivo, así que
  la causa exacta no está confirmada. Lo que había: un `useSharedValue` escrito
  desde un `useEffect` colgado de la prop `active`, o sea que la palanca solo se
  movía cuando el estado del contexto daba la vuelta completa. Pasa a un
  `useDerivedValue` declarativo de `active` —la forma canónica de animar desde
  una prop en Reanimated, sin efecto de por medio—, el estado cambia de forma
  optimista antes de tocar la red, y el press da respuesta táctil inmediata.
  Además el knob deja de depender de cómo resuelve Yoga un hijo absoluto sin
  `left`. Si el cambio de canal se revierte, la palanca vuelve sola: esa vuelta
  ES la señal de que no ha cuajado.
- **Nuevos**: `services/previewChannel.ts` (mecánica aislada y testeable),
  `components/preview-channel/LabStatusPanel.tsx`,
  `__tests__/previewChannel.test.ts` (15 tests), y
  `docs/funcionalidades/CANAL_PREVIEW.md` con la prueba de humo y el porqué del
  fallo anterior. Suite completa: 42 ficheros, 405 tests verdes.
- **Modificados**: `contexts/PreviewChannelContext.tsx`, `contexts/OTAContext.tsx`,
  `hooks/useOTAUpdate.ts`, `components/PreviewChannelModal.tsx`,
  `components/preview-channel/GiantLever.tsx`, `TODO.md`, `docs/README.md`.
  **Ni un solo fichero de ruta nativa**: el arreglo sale entero por OTA.

## 2026-08-07 12:40 — Calendario deslizable, racha de 7 días interactiva y header de Fotos

- **Calendario (tab):** el mes ahora se desliza de verdad. El mes visible pasa a
  ser estado propio (`visibleMonth`), separado del día seleccionado; el swipe
  sigue al dedo y, al soltar, la rejilla sale por un lado mientras la nueva
  entra por el otro (`components/calendar/SwipeableMonthCalendar.tsx`, con
  `react-native-gesture-handler` + reanimated). Antes el gesto movía la lista de
  eventos pero la rejilla se quedaba clavada: `react-native-calendars` trata
  `current` como valor inicial, no reactivo. Las flechas del header usan la
  misma animación. La vista Agenda gana también swipe de mes.
- **Orden de calendarios:** el calendario de la delegación del perfil sale
  SIEMPRE el primero (los IDs de delegación y de calendario coinciden), después
  los `defaultCalendars` del perfil y luego el resto en el orden de Firebase.
  `CalendarConfig` incorpora `id` (`hooks/useCalendarConfigs.ts`).
- **Contigo — racha semanal:** la tira pasa de "lunes a domingo" a los
  **últimos 7 días** terminando en hoy (`getRollingDays`), así el lunes por la
  mañana ya no aparece vacía. Cada día es pulsable.
- **Contigo — días interactivos:** pulsar un día (en la racha o en el
  calendario del mes) abre lo que haya guardado; si hay varias cosas, sale un
  submenú (`components/contigo/DayActionSheet.tsx` + `hooks/useContigoDayMenu.ts`)
  para elegir entre revisión, oración y evangelio. Si no hay nada guardado va
  directo al evangelio de ese día, y ahora cualquier día pasado del calendario
  es pulsable (antes solo los que tenían algo marcado).
- **Fotos:** header nativo transparente (blur en iOS, barra semitransparente en
  Android/Web) SIN texto de título; las portadas pasan por debajo y se funden
  con él al deslizar, como en el cantoral.

---

## 2026-08-06 20:10 — Limpieza: 6 módulos sin importador y deps sin uso (Plan 015)

- Borrados `components/SongSearch.tsx`, `components/ExternalLink.tsx`,
  `components/ui/AppIconButton.tsx`, `components/ui/CloseIconButton.tsx`,
  `components/ui/GlassCard.tsx`, `hooks/useUnreadNotificationsCount.ts` —
  cero imports verificados. `TODO.md` tenía trabajo pendiente asignado a
  `AppIconButton` (inejecutable, nadie lo montaba); quitada la referencia.
  `CLAUDE.md` ya no los lista como vivos.
- Manifest: fuera `ts-jest`, `copy-webpack-plugin`, `tailwind-merge`,
  `tailwind-variants` (sin uso); `@expo/config` movido a devDependencies
  (solo build-time, `app.config.ts`).
- **⚠️ Cambio nativo**: `expo-system-ui` se quitó (sin uso, confirmado
  contra `expo-doctor` y `expo config`) — este paso requiere **build de
  producción** antes del próximo merge a `production` (el commit lleva
  `[skip-ota]`).
- `expo-insights` (EAS Insights) se quitó primero por el mismo motivo
  (sin uso), pero se decidió reincorporarlo: no necesita ningún código —
  con el paquete instalado, EAS manda automáticamente eventos de
  cold-start del app al dashboard "Insights" en el próximo build. También
  es cambio nativo, mismo aviso de build de producción.

## 2026-08-06 19:45 — Refactor: las escrituras de UI a Firebase ganan retry (Plan 014)

Las escrituras estaban repartidas por ~10 archivos, cada uno repitiendo el
ritual `getDatabase(getFirebaseApp())` → `ref` → `push`/`set` a mano, sin
ningún reintento — a diferencia de las lecturas (`useFirebaseData`), que ya
tenían `withRetry` con backoff. Una evaluación o un reporte de bug enviados
con wifi flojo se perdían con un toast de error, sin más.

- Nueva costura `services/firebaseWrites.ts`: `pushWithRetry`/`setWithRetry`.
  La key de `push()` se genera UNA vez y solo se reintenta el `set`
  (idempotente).
- Migrados: `AppFeedbackModal`, `ReportBugsModal`, `SuggestSongModal`,
  `EvaluacionScreen`, `EvaluacionAppScreen`, `SurveyScreen`, `SongDetailScreen`
  (fallitos + ediciones de arreglos), `ReflexionesScreen` (su `update()`
  multi-path se conserva tal cual, solo gana retry). Rutas y payloads
  idénticos a los previos.
- `WordleScreen` (congelado) y `SecretPanelModal` (lógica de escritura
  demasiado grande para la primitiva sin reordenar el archivo — gigante ya
  planificado en `PLAN_CALIDAD.md`) quedan fuera, a propósito.
- Corregida la frase falsa de `CLAUDE.md` ("Único punto de escritura:
  ReflexionesScreen").

## 2026-08-06 19:20 — Fix: poda la caché de lecturas diarias (crecía sin tope) (Plan 012)

`useDailyReadings` cacheaba cada día bajo su propia clave AsyncStorage y
nada la podaba nunca: un usuario diario acumulaba una clave por día para
siempre (varios MB al año), degradando el SQLite de AsyncStorage en Android.
El nodo remoto además se purga a 30 días, así que la copia local vieja podía
servir lecturas que el scraper ya había corregido.

- Nuevo `utils/dailyReadingsCache.ts`: `selectKeysToPrune` (pura) +
  `pruneDailyReadingsCache` (IO, se traga errores — la poda nunca rompe la
  carga de lecturas). Retención de 60 días.
- `useDailyReadings` dispara la poda UNA vez por sesión (fire-and-forget,
  sin bloquear el primer render) y gana el guard `isMounted` que le faltaba
  en el camino de caché.
- Los guardados del usuario no dependen de esta caché (los bookmarks llevan
  su propia copia del texto) — la poda no puede perder datos.
- Archivos: `hooks/useDailyReadings.ts`, `utils/dailyReadingsCache.ts`.

## 2026-08-06 19:05 — Perf: calendario litúrgico recortado a ventana rodante (−280 KB de bundle) (Plan 011)

`components/contigo/LiturgicalBadge.tsx` importaba estáticamente
`assets/calendario-liturgico.json`: 318 KB cubriendo 2025→2100, de los que
más del 95% no se usará en años. Metro inlinea ese JSON en el bundle JS, así
que cada OTA lo descargaba entero y cada arranque lo evaluaba.

- La tabla completa se preserva en `assets/calendario-liturgico-completo.json`
  (sin ningún import — no pesa en el bundle).
- `assets/calendario-liturgico.json` (el que sí importa el badge, mismo
  nombre) ahora es una ventana rodante de 5 años (actual −1 … actual +3):
  20,9 KB.
- Nuevo `npm run liturgical:window` (`scripts/generate-liturgical-window.js`)
  regenera la ventana; idempotente.
- Test de vigencia (`__tests__/liturgicalWindow.test.ts`): falla en CI con
  instrucciones si la ventana está a punto de caducar.
- `LiturgicalBadge.tsx` no cambia — mismo import, mismo nombre de archivo.

## 2026-08-06 18:45 — Perf: ICS del calendario en paralelo + ventana de frescura de 5 min (Plan 008)

Los calendarios ICS se descargaban en SERIE (`await fetch` dentro de un
`for`), así que el tiempo hasta calendario fresco era la suma de los
round-trips en vez del máximo — con el proxy caído, el doble. Además el
hook revalidaba TODO en cada montaje sin ninguna ventana de frescura: un
paseo Home→Calendario→Home re-descargaba y re-parseaba todos los ICS.

- Descarga con `Promise.allSettled` en paralelo, preservando el índice
  posicional de `calendarIndex` (el merge recorre `results` en orden).
- Ventana de frescura de 5 min por lista de URLs: un resultado completo
  reciente evita relanzar la descarga; un resultado parcial NO cuenta como
  fresco (el siguiente montaje sí revalida).
- La semántica de persistencia (completo→disco, parcial→según caché) no
  cambia.
- Tests nuevos en `__tests__/useCalendarEvents.test.ts`.
- Archivo: `hooks/useCalendarEvents.ts`.

## 2026-08-06 18:25 — Perf: `useFirebaseData` deja de re-transformar y re-renderizar sin cambios (Plan 007)

Tras la fase remota, el hook releía la caché y aplicaba `transform`
incondicionalmente, aunque el refresh hubiera salido por la vía rápida (el
`updatedAt` remoto coincide con el local, `parsed` es el MISMO objeto). Como
el transform crea un objeto nuevo, cada ciclo de navegación disparaba un
re-render y recomputaba todo `useMemo` aguas abajo para cero cambio visible
— en el cantoral, con 3 consumidores vivos del nodo `songs` y dos pasando
`filterSongsData` (copia + filtra el corpus entero), el coste es real.

- Memo por instancia (`useRef`, no en la caché de módulo compartida): si el
  `parsed` crudo no cambió de identidad entre la fase caché y la
  post-refresh, se reutiliza el resultado del transform en vez de
  re-ejecutarlo.
- Test de regresión: `__tests__/useFirebaseData.test.ts` (verificado que
  falla contra el código anterior).
- Archivo: `hooks/useFirebaseData.ts`.

## 2026-08-06 18:10 — Fix: serializa las escrituras concurrentes de historial de notificaciones y subrayados (Plan 006)

Varios módulos hacían el ciclo `getItem → mutar → setItem` sobre la misma
clave de AsyncStorage sin ninguna serialización: dos pushes casi
simultáneos, o el merge remoto de bookmarks al iniciar sesión corriendo
mientras el usuario subraya, podían intercalar sus escrituras — el segundo
`setItem` pisaba con una copia obsoleta y el cambio del primero
desaparecía en silencio (notificaciones que se esfuman del historial,
subrayados perdidos).

- Nuevo `utils/storageMutex.ts` (`withStorageLock`): mutex por clave, una
  cadena de promesas por detrás de los helpers de escritura.
- Envuelve `saveReceivedNotificationLocally`, `markNotificationAsRead` y
  `markAllNotificationsAsRead` (clave `@mcm_notifications_history`) y
  `upsertLocalBookmark`, `removeLocalBookmark`, `mergeRemoteBookmarks`
  (clave `@contigo_bookmarks`). Las firmas públicas no cambian.
- Tests de concurrencia real: dos escrituras sin `await` entre ellas ya no
  se pierden ninguna (`__tests__/storageMutex.test.ts`,
  `__tests__/contigoBookmarks.test.ts`,
  `__tests__/pushNotificationServiceStorage.test.ts`).

## 2026-08-06 17:50 — Tests de `cloudPlaylistService` + movimiento de playlist atómico (Plan 005)

`cloudPlaylistService` es el único sitio de la app donde se borran datos de
usuario en la nube (playlists compartidas por código de 4 dígitos) y no
tenía ningún test, a diferencia de su gemelo `choirSessionService`. Además
`changeCloudPlaylistCode` movía la playlist en dos pasos no atómicos
(subir al nuevo código, luego borrar el viejo): si el borrado fallaba
quedaban dos copias vivas.

- 13 tests nuevos (`__tests__/cloudPlaylistService.test.ts`): validación de
  código, borrado perezoso de caducadas (incluido el caso "vigente → NO se
  borra", centinela de la regresión destructiva), limpieza de `undefined` y
  el cambio de código con sus errores.
- `changeCloudPlaylistCode` ahora mueve con un solo `update()` multi-path
  (destino=payload, origen=`null`) en vez de `set` + `remove` separados —
  un fallo a medias ya no puede dejar dos copias vivas.
- Archivos: `services/cloudPlaylistService.ts`.

## 2026-08-06 17:30 — Fix: un solo dueño del mapa de hábitos de Contigo (Plan 004)

`useContigoHabits` guardaba TODO el mapa de hábitos desde el estado propio
de CADA instancia del hook, y hay 4 pantallas de Contigo montadas a la vez
(index, evangelio, oración, revisión). Si dos pantallas escribían sin
remontarse entre medias, la segunda pisaba el mapa entero con su copia
desactualizada — el usuario veía des-completarse en silencio un hábito que
acababa de marcar (racha y contadores incluidos).

- Nuevo `ContigoHabitsContext`/`ContigoHabitsProvider`: único dueño del
  estado, montado en `app/(tabs)/contigo/_layout.tsx`. Las mutaciones parten
  siempre de `recordsRef.current` (nunca de un closure de render viejo) y la
  persistencia a AsyncStorage se serializa con una cola de promesas.
  `useContigoHabits` pasa a ser una fachada de una línea — las 4 pantallas
  no cambian ni un import.
- El formato de `@contigo_habits` en AsyncStorage no cambia.
- Test de regresión: `__tests__/contigoHabitsContext.test.ts`.
- Archivos: `contexts/ContigoHabitsContext.tsx` (nuevo),
  `hooks/useContigoHabits.ts`, `app/(tabs)/contigo/_layout.tsx`.

## 2026-08-06 17:05 — Fix: expansión multi-día del calendario ante DST + horas UTC normalizadas (Plan 003)

**Parte A:** el bucle que expande eventos multi-día mezclaba `Date` en UTC
(parseo), `setDate()` en hora local (incremento) y `toISOString()` en UTC
(formato). Al cruzar el cambio de hora de Europa/Madrid, el instante se
desplazaba 1h y el día formateado saltaba o se duplicaba — un evento del
28-mar al 2-abr podía pintar `28, 29, 29 (dup), 31…`. Justo la ventana de
Semana Santa/retiros. Sustituido por aritmética de calendario pura
(`addDaysISO`, en UTC de punta a punta, sin pasar por hora local en ningún
punto). El mismo fix se aplicó al ajuste del `DTEND` exclusivo de eventos de
día completo (usaba `setDate` igual).

**Parte B:** verificado contra el feed real (`basic.ics`) — emite las horas
en UTC con sufijo `Z`, sin `TZID`. Los eventos con hora se mostraban 1-2h
antes de lo real. Ahora `DTSTART`/`DTEND` con `Z` se convierten a fecha/hora
local; los valores flotantes (sin `Z`) se dejan exactamente como estaban.

- Tests nuevos: `__tests__/useCalendarEvents.test.ts` (rango DST
  primavera/otoño, `addDaysISO`, parseo de horas UTC vs flotantes).
- Archivo: `hooks/useCalendarEvents.ts`.

## 2026-08-06 16:45 — CI: guard de cambios nativos en todo el push + gate de tests antes de publicar (Plan 002)

Los workflows de OTA solo miraban el último commit del push para detectar
`[skip-ota]`, y ni la OTA ni el deploy web corrían tests/typecheck/lint —
solo `ci.yml` en pull requests. Un push directo con cambios nativos sin
`[skip-ota]` en el último commit (o un `workflow_dispatch`, que se lo saltaba
siempre) podía crashear la base instalada entera.

- Nuevo job `guard-native` en `ota-production.yml` y `ota-preview.yml`:
  compara TODO el rango del push (`github.event.before`..`github.sha`)
  contra las rutas nativas del repo. Si hay diff nativo sin `[skip-ota]` en
  ningún commit del rango, el guard falla en rojo y no publica.
  `workflow_dispatch` ahora acepta un input `force` explícito para saltárselo
  a propósito (ya no es un bypass silencioso).
- Nuevo workflow reutilizable `verify.yml` (typecheck + typecheck:tests +
  lint + test) que ahora usan `ci.yml`, `ota-production.yml`,
  `ota-preview.yml` y `deploy-web.yml` — una sola fuente de verdad para los
  pasos de verificación.
- Archivos: `.github/workflows/{ci,ota-production,ota-preview,deploy-web,verify}.yml`.

## 2026-08-06 16:30 — Fix: los `off()` de coro y notificaciones no quitaban el listener (Plan 001)

`subscribeChoirSession` y `subscribeToNotifications` devolvían una función de
limpieza que llamaba a `off(ref, 'value', <valor devuelto por onValue>)` — pero
ese valor es el `Unsubscribe`, no el callback, así que `off` no encontraba
coincidencia y la suscripción quedaba viva para siempre (listeners acumulados
en "modo Coro" al cambiar de código, e igual en el historial de
notificaciones).

- Ambos servicios ahora devuelven directamente el `Unsubscribe` que da
  `onValue` — el patrón correcto del SDK modular de Firebase.
- Nuevo test de regresión en `choirSessionService.test.ts` que fija el
  contrato.
- Archivos: `services/choirSessionService.ts`, `services/pushNotificationService.ts`,
  `__tests__/choirSessionService.test.ts`.

## 2026-08-04 03:00 — Red: reintentos y resincronización al volver online

`useFirebaseData` se tragaba los fallos de red con un `logger.error` y ya: sin
reintento, y la pantalla se quedaba con lo que hubiera en caché **hasta el
siguiente montaje**. En un encuentro con el wifi saturado eso es exactamente "la
app no carga".

- **Reintentos con espera creciente** (0,4 s → 1,2 s, tres intentos) en la fase
  remota. Reintentar la operación entera es seguro porque sus escrituras en
  AsyncStorage son idempotentes. Se rinde a propósito tras el tercero: insistir
  sin red solo gasta batería, y dejar promesas colgadas impediría limpiar el
  `inflight` que coalesce las peticiones. Tests en
  `__tests__/firebaseRetry.test.ts`.
- **Resincronización al recuperar la red**: si la app arranca sin cobertura, en
  cuanto vuelve se revalida sola. Solo dispara en la transición sin red → con
  red, porque el listener también emite al pasar de wifi a datos estando ya
  conectado y ahí no hay nada que recuperar.

**Reglas de Firebase revisadas** (escritas, NO desplegadas):
`/scheduledNotifications` no estaba declarado. Ya estaba denegado —lo no listado
se bloquea— pero por omisión y no por decisión. Ahora es explícito y comentado.
Documento nuevo `docs/desarrollo/FIREBASE_REGLAS.md` con qué tiene que cambiar
el Panel, la decisión de auth pendiente y los comandos de despliegue (a mano y
por el workflow que ya existe y solo espera un secret).

## 2026-08-04 02:10 — `EmptyState` en el cantoral y en Grupos

Los dos "no he encontrado nada" que quedaban a mano —la lista de canciones y la
búsqueda de Grupos— pasan a `EmptyState`. Tenían la misma forma (icono/emoji +
titular + pista) reimplementada dos veces con tamaños y colores distintos.
Fuera sus siete estilos propios.

Con esto **el inventario de `TextInput` sueltos queda cerrado como decisión, no
como pendiente**: los buscadores son otro patrón, el de `CodeInputModal` es un
input invisible detrás de las celdas del código, y los de Revisión quedaron tras
el refactor del examen del día como campos sin borde dentro de una fila que sí
lo tiene — meterles `AppTextField` sería un borde dentro de otro.

## 2026-08-04 01:20 — UI Nativa Fase 2 cerrada

**`SegmentedControl` (nuevo)** — era el último componente que faltaba del plan.
La forma sale del conmutador Mes/Agenda del calendario, que era el que mejor
estaba resuelto; ahora el calendario lo usa a él y se han borrado sus cinco
estilos propios. Acepta `accentColor` para que Contigo y los eventos conserven
su paleta. No usa el `Tabs` de heroui a propósito: aquí no se navega, se cambia
una vista dentro de la misma pantalla, y `Tabs` arrastra gestión de foco y
accesibilidad de navegación que aquí confunde a los lectores de pantalla.

**`AppTextField` en Revisión: retirado.** Esa pantalla se refactorizó en
paralelo en la misma rama (el examen del día) y la migración chocaba de frente
con el cambio. Manda el refactor; el `AppTextField` de Revisión se replantea
cuando esa pantalla esté quieta.

**`AppPrimaryButton`** — el CTA de `ArrangementInputModal`.

**Los dos `TextInput` que quedan NO se migran, y es a propósito**: los buscadores
(`SongListScreen`, `grupos/SearchBar`) son otro patrón —icono dentro, botón de
limpiar— y meterlos en `AppTextField` los empeoraría; y el de `CodeInputModal`
es un input INVISIBLE detrás de las celdas del código, no un campo de
formulario.

**Pie de "Más" extraído** a `components/mas/MasFooter.tsx`: al añadirle los
enlaces legales, la pantalla se pasó del límite de 400 líneas del propio ESLint
del repo. Ahora son 388 y el pie no vive mezclado con la rejilla de tarjetas.

## 2026-08-04 01:20 — Examen del día: celebra siempre y ya no queda tapado por las pestañas

- **La celebración se lanza SIEMPRE al guardar**, no solo si la revisión es de
  hoy: el hábito se marca igual en retroactivas, así que la recompensa debe ser
  la misma. Además ahora se sale de la pantalla cuando el burst termina (2,1 s)
  en vez de a mitad (1,4 s), que era por lo que "no celebraba".
- **Los botones de Continuar / Guardar ya no quedan debajo de la barra flotante
  de pestañas**: el footer va en el flujo, así que es él quien reserva el hueco
  (`useTabBarClearance`) en lugar del contenido del scroll.
- **Una sola tipografía para todo lo que se escribe** en los dos pasos: la lista
  de gratitud usaba la fuente del sistema a 14 y los textos largos serif a 15,
  de modo que cada paso se veía distinto.
- **Los campos de la lista centran bien el texto**: la fila pasa a ser la caja
  (flex row) con la estrella y el input como hermanos centrados, en vez de una
  estrella absoluta con `lineHeight: 50` a mano y el padding vertical fantasma
  de Android sin desactivar.
- Repaso de UX: etiqueta "Paso N de 2 · Agradecer/Revisar", transición cruzada
  entre pasos, háptica al cambiar de paso, de modo y de fecha, y añadir/quitar
  agradecimientos en una sola fila con iconos.
- Archivo: `app/(tabs)/contigo/revision.tsx`

## 2026-08-04 00:30 — Versión 2.1.0 · fuera las barras opacas fijas

**Versión 2.1.0** (`app.json`: `version` y `runtimeVersion`). El bump de
`runtimeVersion` separa el canal de OTAs del de la 2.0, que es lo que toca al
cambiar el binario.

**Fotos y Calendario dejan de tener cabecera fija.** Eran las dos últimas
pantallas con una barra clavada arriba, y en Android además era opaca y de
color:

- **Fotos**: fuera el hero "Fotos · Galería de fotos MCM". La pestaña ya se
  llama Fotos y las portadas se explican solas; ese bloque de dos líneas se
  comía una pantalla entera de álbumes cada vez que entrabas.
- **Calendario**: `headerShown: false`. El conmutador Calendario/Agenda hace de
  ancla visual. En iOS se quitan también los 44pt que se reservaban para un
  header que ya era transparente.

**Hallazgo**: los headers de los eventos (hub y sub-pantallas) **ya eran
transparentes con glass del sistema en iOS** desde la pasada de junio
(`eventScreenOptions` + el `screenOptions` del stack). Lo que sigue opaco es
Android/web, donde no hay glass de sistema que usar — o sea que el item del
TODO estaba desfasado, no pendiente. Corregido allí.

**Widget de Contigo y Firebase App Check → build 2.2 (nov-dic).** Los dos son
nativos y no entran en la 2.1. Anotados en `docs/planes/BACKLOG.md` §C-bis con
el motivo.

## 2026-08-03 23:45 — Render tests de la barra de pestañas compacta

Primeros render tests del repo (`react-test-renderer`, ya presente en
`package.json` pero sin usar): `__tests__/CompactTabBar.test.tsx` cubre
`components/tabs/CompactTabBar.tsx` (ver `docs/desarrollo/TABS_MAINTENANCE.md`).
Mockea la vista nativa de `expo-native-compact-tabs` (no existe bajo Jest y
resolver los PNG de iconos vía `Image.resolveAssetSource` tampoco funciona ahí)
y comprueba lo que sí es responsabilidad nuestra: qué `items` recibe la barra,
qué tab marca `selectedIndex` según el pathname, y que `onTabSelected` navega
al tab pulsado o delega el re-tap en `tabBarController.handleReselect` sin
navegar.

## 2026-08-03 23:15 — Enlaces legales en "Más" y limpieza de documentación

**Enlaces legales.** Política de privacidad, términos y condiciones y aviso
legal en el pie de "Más", con las URLs centralizadas en
`constants/legalLinks.ts`. No era solo la tarea pendiente del backlog: Apple y
Google **exigen** que la política de privacidad se pueda abrir desde dentro de
la app, no solo desde la ficha de la tienda.

**Limpieza de documentación.** La carpeta `plans/` de la raíz (1.700 líneas, 8
planes tácticos, todos DONE o REJECTED) ocupaba un sitio de entrada del repo
como si fuera trabajo pendiente. Archivada en
`docs/planes/archivo/tacticos/`. El puntero de `BACKLOG.md` estaba desfasado
(decía "ahora mismo: UI Nativa" cuando todo gira alrededor de la build) y se ha
reescrito. En `TODO.md` se ha quitado la sección que duplicaba la Fase 1 de
`PLAN_CALIDAD.md` —con cifras que además se contradecían entre los dos
documentos— y las tareas ya terminadas, que es lo que el propio TODO pide en su
cabecera y llevaba tiempo sin cumplirse.

## 2026-08-03 21:30 — Analítica con Aptabase y "Subrayar" en el menú nativo

**Aptabase** (`@aptabase/react-native`). Se eligió por lo que NO guarda: ningún
identificador persistente de dispositivo ni de usuario. Lo único que agrupa los
eventos es un `sessionId` aleatorio que caduca a la hora de inactividad, así que
no hay forma de seguir a nadie entre sesiones. Con menores en el público, eso
era el criterio, no un extra. Servidores en la UE (la región va dentro de la
propia App Key: `A-EU-…`).

Lo que hace que sirva de algo es el **catálogo cerrado y tipado** de eventos
(`constants/analyticsEvents.ts`): `trackEvent` solo acepta nombres declarados
ahí y con sus propiedades exactas, así que inventarse un evento no compila.
Nueve eventos: `app_abierta`, `pantalla_vista`, `cancion_abierta`,
`modo_presentacion`, `playlist_usada`, `notificacion_abierta`,
`onboarding_completado`, `evento_abierto` y `carismochito_activado`.

`pantalla_vista` se dispara **solo**, desde `hooks/useScreenTracking.ts`, a
partir de la ruta de expo-router: cubre toda la app —incluidas las pantallas que
aún no existen— sin llamadas repartidas que alguien se olvide de poner. Las
rutas se normalizan (`/cancionero/alabare-a-mi-senor…` → `/cancionero/:id`) para
que los gráficos se puedan leer y para no mandar títulos.

Nada sale hasta que el perfil está cargado, así que los eventos llevan `perfil`
y `delegacion` de verdad y no `sin_perfil`. **Sin `EXPO_PUBLIC_APTABASE_KEY` no
se manda ningún evento**, igual que con Sentry.

**"Subrayar" en el menú nativo de selección** (`modules/highlight-menu/`, módulo
local de Expo). Al seleccionar texto en cualquier lectura de Contigo, el menú
del sistema trae un ítem "Subrayar" junto a Copiar/Traducir/Buscar; tocarlo abre
la barra de colores que ya existía. Ya no hace falta entrar antes en el modo
lápiz — **que se mantiene**: es el único camino en web y el respaldo si el menú
nativo fallara.

En iOS el menú se construye en `textView(_:editMenuForTextIn:suggestedActions:)`
y ese delegate **ya lo ocupa React Native**, así que el módulo interpone un
proxy que implementa solo ese método y reenvía todo lo demás con
`forwardingTarget(for:)`. En Android es un `ActionMode.Callback` que también
reenvía al anterior. La vista envuelve el texto en vez de buscarlo por su tag
(con la nueva arquitectura eso ya no es fiable) y sin
`onNativeHighlightRequest` el árbol de `HighlightableReading` queda idéntico.

Archivos: `utils/analytics.ts`, `constants/analyticsEvents.ts`,
`hooks/useScreenTracking.ts`, `modules/highlight-menu/*`,
`components/contigo/HighlightableReading.tsx`, `components/contigo/ReadingCard.tsx`,
`app/(tabs)/contigo/evangelio.tsx`, más los puntos de evento en onboarding,
cantoral, playlist, notificaciones, eventos y Carismochito.

## 2026-08-03 19:05 — Los enlaces de acceso de Comunica abren la app

Los correos del área privada («Acceder a mi área privada») llevarán un enlace
mágico. Hasta ahora ese enlace sólo podía acabar en el navegador, aunque la
persona tuviera la app instalada y aunque Comunica sea un tab de la propia app.
Ahora abre la app y entra ahí directamente — también pulsándolo desde Mail,
Gmail o el cliente de correo de Android.

**Cómo.** El correo enlaza a una ruta puente del dominio de Comunica
(`/app/acceso?acceso_magico=…`) declarada como universal link (iOS) y app link
(Android). Con la app instalada la intercepta el sistema operativo antes de que
haya petición web; sin app, WordPress la redirige al área privada de siempre con
el token intacto. Se reclama **sólo esa ruta**, no el portal entero: un enlace
cualquiera de Comunica compartido por WhatsApp sigue abriendo el navegador.

- `app.json` — `associatedDomains` de iOS + `intentFilters` con `autoVerify` para
  `comunica.movimientoconsolacion.com/app/acceso`
- `app/+native-intent.ts` (nuevo) — reescribe el deep link entrante a
  `/(tabs)/comunica` y deja el token en la cola
- `utils/pendingComunicaLink.ts` (nuevo) — la cola, y el montaje de la URL del
  área (sólo se reenvían `acceso_magico` y `token`)
- `hooks/useComunicaWebView.ts` — el WebView carga esa URL en vez de la de
  arranque, así WordPress valida el token y crea la sesión dentro de la app
- `__tests__/comunicaDeepLink.test.ts` (nuevo)
- Contrato actualizado: `docs/contratos/COMUNICA_WEBVIEW.md` §6

⚠️ **Requiere build de tienda**: `associatedDomains` e `intentFilters` son
configuración nativa y no viajan en una OTA. Y en Android no funcionará hasta
que se rellene la huella SHA-256 de firma en los ajustes del plugin de
WordPress (ver el contrato).

## 2026-08-03 18:10 — NSE de iOS, Sentry e icono de Carismochito

Las tres piezas nativas que faltaban para la build de tienda de agosto. Todo
requiere **build de producción**, nada sale por OTA.

**Notification Service Extension (iOS).** Hasta ahora las notificaciones con
imagen se veían en Android pero nunca en iOS, y no había forma de arreglarlo sin
una extensión. Como el proyecto es "managed" (no hay `ios/` en el repo), el
target de Xcode se crea en cada prebuild con un config plugin propio:
`plugins/withNotificationServiceExtension.js` + el Swift en
`targets/notification-service/`. La extensión busca la URL en `data.imageUrl`,
`richContent.image` y `attachment-url`, y si algo falla entrega la notificación
sin imagen — nunca se traga el aviso.
**Requiere del Panel**: `mutableContent: true` en los pushes con imagen; sin ese
flag iOS ni arranca la extensión. Contrato actualizado (§4 y TL;DR).
**Requiere de Apple**: la extensión es un bundle id nuevo
(`com.familiaconsolacion.mcmapp.MCMNotificationService`) y EAS pide credenciales
la primera vez que se compila.

**Sentry** (`@sentry/react-native` 7.11). `utils/logger.ts` ya tenía el enganche
`setReporter` desde hace meses; ahora se usa: todo `logger.warn`/`logger.error`
de la app —incluido el `ErrorBoundary`— llega a Sentry, más los crashes nativos
y las excepciones no capturadas. **Sin `EXPO_PUBLIC_SENTRY_DSN` no reporta
absolutamente nada** y el árbol de componentes queda idéntico: el SDK nativo va
en el binario precisamente para poder encenderlo después por OTA. El plugin de
subida de source maps se configura con `SENTRY_ORG`/`SENTRY_PROJECT`/
`SENTRY_AUTH_TOKEN` en el build. Los workflows de OTA ahora propagan el DSN: sin
eso, la primera OTA habría apagado el crash reporting sin avisar.

**Icono alternativo de Carismochito** (`expo-alternate-app-icons`). Al activar el
modo, el icono del launcher pasa a la mascota sobre verde COM; al desactivarlo,
vuelve el normal. Los iconos se generan con `npm run icons:alt`. `utils/appIcon.ts`
sólo llama al nativo cuando el icono no coincide ya con el estado: en iOS cada
cambio real dispara una alerta del sistema que no se puede suprimir, así que
hacerlo a ciegas en cada arranque sería insufrible. Al arrancar se repara el
icono si quedó descolgado del estado guardado.

**Documento nuevo**: `docs/desarrollo/BUILD_AGOSTO_2026.md` — paso a paso de la
build, qué variables configurar y dónde, y el checklist de pruebas.

Archivos: `plugins/withNotificationServiceExtension.js`,
`targets/notification-service/*`, `utils/sentry.ts`, `utils/appIcon.ts`,
`scripts/generate-alt-icons.js`, `assets/app-icons/*`, `app.json`,
`app.config.ts`, `app/_layout.tsx`, `contexts/CarismochitoContext.tsx`,
`.env.example`, `.github/workflows/ota-{production,preview}.yml`.

## 2026-08-03 15:40 — Canales de notificación de Android por categoría

Android tenía un único canal (`default`, importancia `MAX`): todo salía igual de
agresivo y silenciar el cantoral significaba silenciarlo todo. Ahora hay siete,
uno por cada categoría de negocio que ya manda el Panel en `data.category`:

| Canal                           | Importancia | Efecto                   |
| ------------------------------- | ----------- | ------------------------ |
| `default` (general) · `urgente` | `MAX`       | Heads-up + sonido        |
| `eventos` · `celebraciones`     | `HIGH`      | Heads-up + sonido        |
| `cancionero` · `fotos`          | `DEFAULT`   | Sonido, sin heads-up     |
| `mantenimiento`                 | `LOW`       | Silencioso, solo bandeja |

Los ids son literalmente los valores de `category`, con `general` → `default`
(el id de un canal es inmutable en Android: renombrarlo habría perdido los
ajustes del usuario en las instalaciones actuales). Los canales se dan de alta
antes de pedir permisos —crearlos no lo requiere— y al sincronizar se borran los
que la app ya no declara.

**Requiere cambio en MCM Panel**: hay que mandar `channelId` top-level con el
mismo valor que `data.category`. Sin él todo sigue llegando a `default`, igual
que antes; con un `channelId` que la app no declare, Android **no entrega** la
notificación. Contrato actualizado en `docs/contratos/NOTIFICACIONES_CONTRATO.md`
§8 con la tabla cerrada y un ejemplo de payload.

Archivos: `constants/notificationChannels.ts` (nuevo, catálogo puro),
`notifications/androidChannels.ts` (nuevo, alta en el sistema),
`notifications/usePushNotifications.ts`,
`__tests__/notificationChannels.test.ts` (nuevo).

## 2026-08-03 15:05 — La barra de pestañas ya no se expande sola

Reescrita la regla de compactar/expandir de la barra flotante. Se ha sacado de
`tabBarController.ts` a `components/tabs/collapseRule.ts` como función pura con
directiva `'worklet'`, para que la usen los dos caminos que había duplicados (el
worklet de Reanimated y el `onScroll` por JS del WebView de Comunica) y para
poder probarla: `__tests__/collapseRule.test.ts`, 16 casos.

Tres bugs arreglados:

- **Al llegar al final del scroll la barra se ponía grande.** El rebote elástico
  llevaba el offset por encima del máximo y al volver se leía como "el usuario
  está subiendo". Ahora el offset se recorta contra los límites reales
  (`-contentInset.top` y `contentSize - viewport + contentInset.bottom`).
- **Costaba compactar.** Los umbrales eran simétricos (6 px en ambos sentidos).
  Ahora compactar cuesta 5 px hacia abajo y expandir 40 px hacia arriba, y el
  ancla persigue el extremo alcanzado en cada sentido, así que el recorrido se
  mide desde donde el usuario dio la vuelta.
- **Entrar en una pantalla anidada expandía la barra.** El scroller recién
  montado emitía su primer evento en el offset inicial y eso disparaba la regla
  de "arriba del todo siempre expandida". Ahora esa regla solo aplica después de
  que el usuario arrastre de verdad (`onBeginDrag`), así que el estado compacto
  se hereda al navegar dentro de un tab.

Además, los worklets de scroll ya no llaman a `setCompact` en cada fotograma:
llevan un espejo del estado en un shared value (`compactMirrors`), que se
actualiza desde JS sin suscribir la pantalla entera a re-render.

Archivos: `components/tabs/collapseRule.ts` (nuevo),
`components/tabs/tabBarController.ts`, `app/screens/ComunicaScreen.tsx`,
`__tests__/collapseRule.test.ts` (nuevo),
`docs/desarrollo/TABS_MAINTENANCE.md`.

## 2026-08-03 06:20 — Recupera de `production` los arreglos del reproductor multimedia

Auditoría de `production` frente a esta rama. `main` y `production` divergieron
el 28-jun y se han mantenido a mano en paralelo, así que se comparó por
CONTENIDO (equivalencia de parches), no por historia: de todos los commits de
`production` que tocan código de app, **solo 11 no estaban aquí, y de esos solo
4 faltaban de verdad** — el resto ya estaba reimplementado (URL `/aptest` de
Comunica, `disableAntiBrickingMeasures`, `AppPrimaryButton`, hidratación de
hábitos, el oscuro de Comunica y el plan de integraciones).

Los 4 que faltaban son la saga del reproductor del cantoral (`a3395fc`,
`ede0478`, `78e0866`, `bba0dd6`), y explican por qué **los vídeos de YouTube no
funcionaban en esta rama y sí en producción**:

- **La causa**: YouTube exige una cabecera HTTP `Referer` real en la petición
  del embed. Todo lo que se carga con `loadHTMLString` —HTML inyectado, con o
  sin `baseUrl`, con o sin la IFrame API— sale SIN Referer, y YouTube lo rechaza
  con "vídeo no disponible" (152/153). Esta rama tenía justamente esa versión
  con shell de iframe, que fue el intento fallido. La solución es cargar la URL
  de embed real con `source.headers.Referer`.
- **Audio de Drive**: el PiP de audio pasa a casi todo el ancho de pantalla y
  menos alto (64 en vez de 100) — con el ancho estrecho del PiP de vídeo los
  controles de Drive se veían apretados.
- **Pantalla completa sin recargar**: ya no monta un segundo WebView en un
  Modal; el propio contenedor se expande con `LayoutAnimation` y el WebView es
  siempre la misma instancia, así que el vídeo no se corta al entrar o salir.
- **Enlaces nativos**: los saltos a `watch?v=` se interceptan y abren la APP de
  YouTube; los de Drive pasan de `WebBrowser` a `Linking` para que los capture
  la app de Google Drive (`SongMediaSheet`).

Se conservan sobre esa base las dos cosas propias de esta rama: el hueco de la
barra de pestañas flotante (`useTabBarClearance`) y el arrastre en Reanimated +
gesture-handler.

## 2026-08-03 05:40 — Migración a Reanimated TERMINADA (`refs` 277 → 34)

Último bloque. Ya no queda ni un `useRef(new Animated.Value())` en la app, salvo
el Wordle (código congelado). Los 34 avisos que quedan **no son animaciones**:
son refs legítimas (`.panHandlers`, timers, callbacks estables, el ref del
WebView…).

En esta tanda: `CarismochitoOverlay` (31), `BottomSheet` (23),
`CarismochitoMascot` (11), `HorarioScreen` (11), `SongFullscreenScreen` (10),
`AppToastContext` (8), `ReadingCalendarSheet` (8), `CarismochitoDialogs` (7),
`TransposeBottomSheet` (7), `HighlightActionBar` (7), `ComunicaScreen` (6),
`SongDetailScreen` (5) y `SongControls` (2).

**Lo que se gana** es que las animaciones corren en el hilo de UI y dejan de
entrecortarse cuando JS está ocupado. Se nota sobre todo en la portada de
Comunica (se ve MIENTRAS arranca el WebView), el burst de celebración (se lanza a
la vez que se guarda el hábito) y el arrastre del reproductor flotante.

**Decisión consciente**: el GESTO de `BottomSheet` se queda en `PanResponder`.
Ese sheet lo comparten una decena de modales y muchos llevan un ScrollView
dentro; pasarlo a gesture-handler cambiaría cómo compiten los dos por el toque,
que es lo delicado. Sus animaciones sí están migradas.

De paso, dos arreglos que salieron por el camino:

- `ComunicaScreen` cierra el último `set-state-in-effect` de la migración
  (quedan 6, todos justificados en `TODO.md`).
- Los `PanResponder` de `BottomSheet` se crean UNA vez y se quedaban con el
  `onClose` del primer render. Ahora va por ref.

**`jest.config.js`**: Reanimated arranca su módulo nativo al importarse y bajo
Jest revienta (`loadUnpackers`). Se añade el resolver que trae
`react-native-worklets` para tests. Sin esto, cualquier fichero que acabe
importando Reanimated —aunque sea de rebote a través de un contexto— tumbaba su
suite entera; de hecho pasó al migrar `AppToastContext`.

⚠️ **NADA de esto está validado en dispositivo**: son animaciones, y sólo se
comprueban mirándolas. Es lo primero a repasar en la build de tienda.

## 2026-08-03 04:45 — Migración a Reanimated (segundo bloque): OTA prompt y reproductor flotante

Sigue la migración. `react-hooks/refs` baja de 196 a **160** (117 de los 277
originales).

- `OTAUpdatePrompt` (19): entrada del modal, rotación del icono y pulso del halo.
- `FloatingMediaPlayer` (17): entrada del reproductor y, sobre todo, **el
  arrastre**, que pasa de `PanResponder` a `Gesture.Pan()` de gesture-handler.
  Ahora el reproductor sigue al dedo en el hilo de UI aunque JS esté ocupado —
  que es lo habitual, con un WebView reproduciendo vídeo al lado.

Dos cosas aprendidas que quedan apuntadas en `TODO.md` para el resto:

- **Los bucles infinitos hay que pararlos a mano** con `cancelAnimation`. En
  Reanimated siguen corriendo en el hilo de UI aunque el componente esté oculto;
  con `Animated.loop` bastaba el `.stop()` del cleanup.
- Los `PanResponder` se replican guardando la posición inicial en `onStart`, que
  es lo que hacían `extractOffset`/`flattenOffset`.

⚠️ **Sin validar en dispositivo**: son animaciones y un gesto.

## 2026-08-03 04:10 — La barra de pestañas ya no sale cortada al salir del onboarding

Al terminar el onboarding, la barra flotante aparecía con las etiquetas ~34pt
más abajo de la cuenta, cortadas contra el borde de la cápsula. Con el
onboarding ya hecho de antes no pasaba, y se arreglaba solo al reiniciar.

**Causa (nativa, de la librería).** En iOS 26 el hueco del home indicator lo
reserva UIKit DENTRO de la `UITabBar`, a partir del `safeAreaInsets` de la
vista. El onboarding se presenta como `fullScreenModal` y mientras está encima
iOS **saca de la ventana** la vista que queda debajo, así que ese inset pasa a
valer cero: la barra reparte sus items por los 78pt enteros en vez de por los 44
de arriba. Al cerrarse el modal no cambia ningún tamaño, no llega otro
`layoutSubviews` y la posición mala se queda pegada.

**Arreglo (nativo).** `patches/expo-native-compact-tabs+0.2.0.patch` añade
`didMoveToWindow()` y `safeAreaInsetsDidChange()`, que invalidan el layout de la
vista **y el de la `UITabBar`** (lo que hay que recalcular es su reparto interno
de items, no solo el frame). Cubre también el camino pre-iOS 26, donde
`resolvedTabFrame` lee `window?.safeAreaInsets.bottom` y caía a 0.

⚠️ **Es código nativo: necesita build de tienda.** Se retiró el apaño en JS que
remontaba la barra (commit anterior), que ya no hace falta.

## 2026-08-03 03:20 — Migración a Reanimated (primer bloque): 6 componentes

Primer tramo de la migración de animaciones de `Animated` de React Native a
Reanimated. **Beneficio real**: Reanimated corre las animaciones en el hilo de
UI, así que dejan de entrecortarse cuando JS está ocupado — que es justo lo que
pasa en dos de los casos migrados (la portada de Comunica se ve MIENTRAS arranca
el WebView, y el burst de celebración se lanza a la vez que se guarda el hábito).

Migrados (81 avisos de `react-hooks/refs` menos, de 277 a 196):

- `ComunicaLoader` (24) — onda del logo, anillo, barra de progreso y shimmer.
- `CarismochitoChargeDots` (14)
- `ComunicaTopProgress` (13)
- `BreathingPhase` (10) — los tres anillos de la respiración de Revisión.
- `CelebrationBurst` (10)
- `CelebrationAnimation` (10) — **resultó ser una copia literal de
  `CelebrationBurst`** (mismas 12 partículas, mismos colores, mismas duraciones
  900/800 ms y la misma curva bezier). Ahora delega en él, así que la animación
  vive en un solo sitio.

Los arrays de `Animated.Value` (partículas del burst, barras de la onda) pasan a
ser un subcomponente por elemento con su propio shared value, porque los hooks no
se pueden llamar en un bucle de longitud variable.

`constants/animations.ts` gana `reaEasings`: las mismas curvas que `easings` pero
en la versión de Reanimated. Son dos módulos `Easing` distintos y **no son
intercambiables** — el de react-native no puede ejecutarse dentro de un worklet.

Queda pendiente el resto (`CarismochitoOverlay`, `BottomSheet`, `OTAUpdatePrompt`,
`FloatingMediaPlayer`…), listado por tamaño en `TODO.md`.

⚠️ **Sin validar en dispositivo**: son animaciones, y solo se comprueban mirándolas.

## 2026-08-03 01:55 — Comunica se desliza bajo el notch en Android y 28 efectos de sincronización menos

### Comunica (Android): zona segura dentro de la página

En iOS la web ya quedaba en zona segura y se deslizaba bajo la barra glass del
notch gracias al `contentInset` del WKWebView. **El WebView de Android no tiene
`contentInset`**, así que allí la franja del notch era una barra en el layout y
la web arrancaba debajo, sin deslizarse. Y abajo pasaba algo peor: nadie
reservaba el hueco de la barra de pestañas flotante, que **tapaba el final de
cada página de forma permanente**.

Ahora el hueco lo reserva la propia página: la app le inyecta un `<style>` con
`padding-top` / `padding-bottom` (`safeAreaBridgeJS` en
`hooks/useComunicaWebView.ts`) y la franja del notch pasa a ser un overlay
opaco del color de la página. El resultado es el mismo que en iOS.

- Los insets se publican SIEMPRE como variables CSS (`--mcm-app-inset-top` /
  `--mcm-app-inset-bottom`) en las dos plataformas, para que la web pueda
  usarlas en sus elementos `position: fixed` — que ningún inset del contenedor
  mueve.
- La conversión dp → px CSS se hace con el ancho real del viewport, así que
  aguanta un `<meta viewport>` que no sea `width=device-width`.
- Es idempotente (reutiliza el mismo `<style>` por id) y se reinyecta en cada
  carga y al rotar.
- **Opt-out para la web**: con `<html data-mcm-insets="self">` la app no toca el
  layout y solo publica las variables.
- Contrato actualizado: `docs/contratos/COMUNICA_WEBVIEW.md` §3. Tests nuevos en
  `__tests__/comunicaThemeBridge.test.ts`.

⚠️ **Sin validar en un Android real todavía.**

### React Compiler: `set-state-in-effect` de 35 a 7

Efectos que solo copiaban a estado algo que ya se podía calcular. Además del
aviso, varios escondían comportamientos molestos que se van con el arreglo:

- **`hooks/useAlbumPagination.ts` (nuevo)** — la paginación de álbumes, que
  estaba duplicada en `app/(tabs)/fotos.tsx` y `app/screens/AlbumListScreen.tsx`.
  La lista visible pasa a ser un `slice` derivado: **un refresco de Firebase ya
  no devuelve al usuario a la primera página** perdiendo todo lo cargado. Con
  tests (`__tests__/useAlbumPagination.test.ts`).
- **`SongListScreen`** — la construcción de la lista era un `useEffect` declarado
  `async` que no esperaba a nada. Ahora es una función pura (`buildSongList`) +
  `useMemo`; se van tres estados.
- **`useAdminStatus`, `useEventMeta`, `ChoirSessionContext`** — el resultado se
  guarda junto a la clave a la que pertenece (uid / eventId / código de sesión),
  así lo viejo deja de contar solo al cambiar. De paso se cierra la rendija por
  la que un `isAdmin: true` del usuario anterior seguía en pie hasta la primera
  respuesta del nuevo.
- **`HorarioScreen` y `MaterialesScreen`** — el día abierto se deriva; **un
  refresco de Firebase ya no te devuelve al día de hoy** si estabas en otro.
- **`ReflexionesScreen`** — la lista se deriva de Firebase y las recién
  publicadas se pintan al instante hasta que llegan confirmadas (casadas por id).
- **`AuthContext`** — si falta la config de Firebase, el fallo es un valor desde
  el primer render en vez de un setState en el efecto.
- **`useColorScheme.web.ts`** — el flag de hidratación pasa a
  `useSyncExternalStore`.
- Modales que se resetean al abrir (`ArrangementInputModal`,
  `PasswordPromptModal`, `CodeInputModal`, `ShareQrModal`, `ExportPdfModal`,
  `SecretPanelModal`, `NotificationsBottomSheet`) y pantallas que reaccionan a un
  parámetro de navegación (`calendario`, `oracion`, `SongDetailScreen`): pasan al
  patrón documentado de **ajuste durante el render**. Mismo comportamiento, sin
  el render intermedio con los datos de la vez anterior. **No** se ha usado
  `key={visible}`: habría matado la animación de salida del `BottomSheet`.

Los **7 restantes son decisiones, no deuda**, y quedan justificados uno a uno en
`TODO.md`: Wordle (código congelado), el auto-abrir por deep-link de
`notifications.tsx` (una acción, no estado), `AddToHomeBanner` (lee `window`, no
puede subir al render sin romper la hidratación en web), `useSongProcessor`
(pasarlo a `useMemo` metería el formateo ChordPro→HTML dentro del render en la
pantalla más usada — decisión de rendimiento a medir) y el loader de
`ComunicaScreen` (va atado al `Animated.Value`, entra en la migración a
Reanimated).

Sin cambios nativos: el commit **no** necesita `[skip-ota]` por este motivo.

## 2026-08-02 03:10 — Fotos sin header fijo y dos antipatrones de estado menos

- **Fotos: el título ya no es una barra clavada arriba.** Pasa a un `ScreenHero`
  dentro de la propia lista, así que se va con el scroll igual que en el hub de
  eventos o en Más. Antes en Android era un header opaco fijo y en iOS no había
  título ninguno. `headerShown: false` para ese tab en `TABS_CONFIG`.
- **`LiturgicalBadge` y `VersionDisplay`**: guardaban en estado algo que se
  puede calcular y lo sincronizaban con un efecto. Pasan a `useMemo`: un render
  menos cada vez, y el pie de la Home ya no parpadea vacío en el primer render.
  Eran dos de los avisos de `react-hooks/set-state-in-effect`.

Los 35 avisos restantes de esa regla quedan **clasificados uno a uno** en
`TODO.md`: cuáles son legítimos (suscripciones de Firebase, cargas async),
cuáles son resets de formulario al abrir un modal (se arreglan con
`key={visible}`, pero hay que probarlos en dispositivo) y cuáles son paginación
derivable.

**Comunica**: en iOS ya hace lo que se pedía (barra glass en el notch con el
contenido deslizándose por debajo, vía `contentInset`). En Android no se puede
igual porque su WebView no admite `contentInset`: el principio de la página
quedaría tapado para siempre. Queda anotado en `TODO.md`.

---

## 2026-08-02 02:20 — Arreglos de la barra de pestañas tras la primera dev build

Se sustituye `createCompactTabBarController()` de la librería por un
controlador propio (`components/tabs/tabBarController.ts`), porque hacían falta
tres cosas que aquel no daba:

- **El doble tap ya no volvía a la pantalla anterior** en Más y Cantoral.
  Regresión de la barra nueva: `cancionero`, `mas` y `visitapapa` hacían
  `popToTop()` desde un listener de `tabPress` del navegador, y con la barra del
  sistema oculta ese evento no se dispara. Ahora la barra emite el re-tap y los
  tres se suscriben con `useTabReselect`; si hay pantallas que cerrar cierra, y
  si no, sube el scroll.
- **El scroll-arriba se quedaba detrás del header.** Subía a 0, que con
  `contentInsetAdjustmentBehavior="automatic"` cae POR DEBAJO de la cabecera.
  Ahora sube a `-contentInset.top`, aprendido de los propios eventos de scroll.
- **La barra tardaba en compactarse en el cantoral.** El controlador de la
  librería recorta el offset a >= 0, así que durante todo el recorrido del
  header grande el valor se quedaba pegado a 0.

Además:

- La lista de canciones no subía al re-tapear: las pantallas anidadas pasaban
  `null` como clave y no se registraban. Ahora usan la clave de su tab y gana la
  última montada. Igual en las subrutas de Contigo y en el modo calendario.
- **Dentro de una canción la barra se queda compacta** (`useForceCompact`).
- **Comunica**: el WebView también compacta la barra ahora (no es un scroller de
  RN pero emite `onScroll`), y las flechas de navegación bajan a
  `TAB_BAR_HEIGHT + safe area + 8`.

---

## 2026-08-02 01:30 — React Compiler: 7 avisos menos y el diagnóstico bien hecho

Los avisos de `preserve-manual-memoization` NO eran por llamadas impuras como
decía la entrada anterior — el mensaje completo del compilador lo aclara:

> The inferred dependency was `user`, but the source dependencies were
> [scope, `user?.uid`, …]. Inferred less specific property than source.

O sea: el compilador infiere `user` entero como dependencia, el código declara
`user?.uid`, no coinciden y **se salta el componente entero**. El arreglo es
mecánico: sacar `const uid = user?.uid` fuera del `useCallback`. Aplicado en
`EvaluacionAppScreen`, `EvaluacionScreen`, `SurveyScreen` y
`EventDetailsBottomSheet` (mismo patrón con `event?.description`).

**7 de 12 arreglados**; quedan 5 de otra clase ("memoized in source but not in
compilation output": `useMemo` que mutan un Map, callbacks async con setState)
que sí piden reestructurar caso a caso.

`TODO.md` queda reescrito y **priorizado** con el coste y el beneficio REAL de
cada familia, incluida la migración de animaciones a Reanimated (los 276 avisos
de `react-hooks/refs` salen de ~41 `useRef(new Animated.Value(0)).current`; la
migración no es cosmética: Reanimated corre en el hilo de UI y las animaciones
dejan de entrecortarse cuando JS está ocupado).

---

## 2026-08-02 00:40 — iPad landscape, subrayado que reconoce lo ya subrayado y limpieza

- **iPad rota de verdad.** `UISupportedInterfaceOrientations~ipad` con las 4
  orientaciones en `app.json`; el iPhone se queda en portrait. Los layouts de
  iPad estaban listos desde junio, sólo faltaba activarlo a nivel nativo.
  Verificado en el `Info.plist` que genera `expo prebuild`. ⚠️ Cambio NATIVO.
- **Subrayado: al seleccionar texto ya subrayado, la barra lo reconoce.** Marca
  con un aro el color que ya tiene y la goma se anuncia como "quitar el
  subrayado", en vez de comportarse como si fuera texto nuevo. Nueva función
  pura `selectionHighlight()` en `utils/highlightRanges.ts` (si la selección
  pisa varios colores gana el que cubra más caracteres), expuesta por
  `useReadingHighlights` como `selection`. 7 tests nuevos.
- **Dos avisos del React Compiler que eran bugs de verdad, arreglados**:
  `useSectionFontScale` construía `settings.sectionFontScales ?? {}` suelto en
  el cuerpo, así que sin overrides creaba un objeto nuevo en cada render y sus
  dos `useCallback` cambiaban de identidad siempre — la memoización no servía
  de nada. (El otro, `ActionButton` en `SongControls`, iba en la entrada
  anterior.) El resto de familias están medidas y explicadas en `TODO.md`.

Sigue **pendiente** el ítem "Subrayar" dentro del menú nativo del sistema: eso
pide un módulo nativo (UIMenu en iOS, ActionMode en Android) y es una iteración
propia — ver `docs/funcionalidades/SUBRAYADO.md`.

---

## 2026-08-01 23:05 — Actualización de dependencias de terceros y limpieza

Segunda mitad de la puesta al día: el salto de SDK sólo movió lo que
gestiona Expo, esto es todo lo demás. **Regla seguida: no se toca nada que
fije el SDK** (react, react-native, reanimated, screens, svg,
safe-area-context, webview, gesture-handler, async-storage, worklets,
TypeScript, babel) — `expo install --fix` confirma que están donde deben.

- **Subidas**: firebase 12.10 → 12.17, heroui-native 1.0 → 1.0.8,
  **chordsheetjs 14 → 15.6.1**, react-native-calendars, tailwindcss +
  tailwind-merge + tailwind-variants, uniwind 1.6 → 1.10, prettier 3.2 → 3.9,
  eslint-plugin-prettier, @expo/vector-icons, @react-native-community/cli,
  google-signin, ts-jest. Majors: **@testing-library/react-native 13 → 14**,
  eslint-config-prettier 9 → 10, cross-env 7 → 10, @types/node 22 → 26.
- **chordsheetjs 15** sólo rompe una cosa (hace opcional su soporte PDF) y no
  nos afecta: el PDF de playlists va por `HtmlDivFormatter` → HTML →
  expo-print, no usamos su `PdfFormatter`.
- **RNTL 14** hizo `renderHook` asíncrono (envuelve el render en `act`): los
  tres tests de hooks pasan a `await`. En `useFirebaseData` se cae la aserción
  del `loading === true` inicial, que con la API nueva ya no es observable.
- **Descartadas por incompatibilidad real, comprobada**: `eslint 10` (rompe el
  eslint-plugin-react que trae eslint-config-expo) y `jest 30` (jest-expo 57
  está construido contra jest 29 y mezclarlos rompe el runtime entero).

### Bug real arreglado de camino

`ActionButton` se definía **dentro** de `SongControls`, así que React lo
trataba como un tipo de componente nuevo en cada render y desmontaba y volvía
a montar todo el menú de acciones del cantoral. Sacado a nivel de módulo con
`isDark` por prop. Lo señalaba `react-hooks/static-components`, una de las
reglas del React Compiler que activa el SDK 56.

El resto de esas reglas se han **medido** y el veredicto está en `TODO.md`:
el 78% son el idiom de RN `useRef(new Animated.Value(0)).current` y los
`sharedValue.value = …` de Reanimated, que no tienen arreglo razonable.

---

## 2026-08-01 21:10 — Arreglo del tamaño de los iconos de la barra de pestañas

Los iconos salían enormes, montados unos sobre otros y encima de las
etiquetas. Eran **dos** bugs a la vez:

- **El generador de iconos normalizaba cada glifo a su propio bounding box.**
  Los glifos de MaterialIcons comparten una caja em de 512 unidades y están
  diseñados dentro de ella, así que ajustar cada uno a su caja los descuadra
  entre sí: `more-horiz` (86 unidades de alto) acababa dibujado tan grande como
  `home` (363), 4x de más. Ahora se dibuja sobre la caja em, que es exactamente
  lo que pinta `<MaterialIcons />` en el resto de la app. De paso la caja baja
  de 28 a 24pt, que es lo que espera la barra nativa.
- **Bug de escala en iOS de `expo-native-compact-tabs`.** `UITabBarItem` dibuja
  la imagen a su tamaño natural en puntos (píxeles ÷ escala) y no la
  redimensiona, pero la librería carga los ficheros con
  `UIImage(contentsOfFile:)`, que siempre reporta escala 1.0 → un asset @3x se
  pinta 3x más grande. En dev con Metro no se veía porque el fichero llega por
  http y ahí sí se decodifica con la escala correcta.

Se añade **`patch-package`** (con `postinstall`) y el parche
`patches/expo-native-compact-tabs+0.2.0.patch`, que normaliza la escala a
partir del ancho real en píxeles: el icono mide 24pt venga del fichero que
venga. No vale mirar el nombre del fichero, porque los bundlers que hashean
los assets embebidos se comen el sufijo `@3x`. Android no estaba afectado (su
icono va en una caja fija de 28dp con `CENTER_INSIDE`).

Archivos: `scripts/generate-tab-icons.js`, `assets/tab-icons/*`, `patches/`,
`package.json`

---

## 2026-08-01 19:30 — Expo SDK 57 + barra de pestañas flotante compacta

> ⚠️ **Incluye código nativo (Swift + Kotlin) y un salto de SDK: NO entra por
> OTA.** Todos los commits llevan `[skip-ota]`. Esta rama queda **pendiente de
> validar en una dev build** antes de mergear.

### Expo SDK 55 → 56 → 57

- **SDK 56** (RN 0.85, TypeScript 6). Cambios obligados:
  - `StyleSheet.absoluteFillObject` desaparece de RN (también en runtime) →
    `StyleSheet.absoluteFill`, que ahora es un objeto plano y spreadable.
  - **expo-router 56 ya no admite `@react-navigation/*` como dependencia
    directa**: trae su copia vendorizada. Se eliminan los 4 paquetes y los ~40
    imports pasan a `expo-router/react-navigation` y
    `expo-router/build/react-navigation/*`.
  - `eslint-config-expo` 56 activa las reglas del React Compiler como error
    (~330 avisos sobre patrones preexistentes). Quedan como `warn`; sanearlas
    está apuntado en TODO.md.
  - `jest-expo` 56 requiere `@react-native/jest-preset` aparte.
- **SDK 57** (RN 0.86): sin cambios de código, solo alineación de versiones. Es
  lo que exige `expo-native-compact-tabs` (peers `expo>=57`, `rn>=0.86`).

### Barra de pestañas

- Nueva dependencia **`expo-native-compact-tabs` 0.2.0**: barra flotante nativa
  que al compactarse con el scroll **mantiene todos los iconos visibles**, en vez
  de colapsar a la píldora del sistema que los esconde. Liquid Glass real en
  iOS 26+, píldora sólida con cápsula animada en iOS 16.4–18.x y Android.
- El layout pasa de **dos ramas a tres**: iOS y Android comparten la barra
  flotante; **web se queda exactamente como estaba**.
  - iOS: `NativeTabs` sigue de navegador pero con la barra del sistema oculta.
  - Android: se mantiene el navegador `Tabs` con `tabBar={() => null}`, para no
    perder los headers que salen de las options de cada `Tabs.Screen`.
- **Tope de items 5 → 6** (`MAX_TAB_BAR_ITEMS`), aplicado ahora también en
  Android: ya no lo impone `UITabBarController`. `splitTabsForIOS` →
  `splitTabsForBar`, y MasHomeScreen muestra las tarjetas de overflow en las dos
  plataformas.
- **Iconos**: la librería pinta desde PNG, no admite SF Symbols ni MaterialIcons.
  `scripts/generate-tab-icons.js` (`npm run icons:tabs`) rasteriza el mismo glifo
  que ya declaraba `androidIcon`, más 5 fotogramas de animación de selección.
- **La barra flota**: no ocupa layout. `components/tabs/useTabScroll.ts` da a cada
  pantalla el `onScroll` del colapso y el `paddingBottom` a reservar; sustituye a
  los paddings 100/120/140 que estaban a mano y casi siempre detrás de un
  `Platform.OS === 'ios' &&` (en Android no había reserva ninguna). Se recolocan
  también FAB, mini reproductor, barra de subrayado y puntos de Carismochito.
- Comunica (WebView) no colapsa la barra: no hay scroller de RN al que
  engancharse. El hueco se da por `contentInset`.
- Se eliminan `TabBarBackground.tsx` / `.ios.tsx` y `GlassTabBarBackground.ios.tsx`:
  no los usaba nadie y reexportaban `useBottomTabBarHeight()`, que con la barra
  del navegador oculta ya no significa nada.

### Archivos principales

`app/(tabs)/_layout.tsx`, `components/tabs/*` (nuevo), `constants/tabsCatalog.ts`,
`constants/tabIcons.ts`, `constants/spacing.ts`, `hooks/useTabBarClearance.ts`,
`utils/tabRoutes.ts`, `scripts/generate-tab-icons.js`, `assets/tab-icons/*`

---

## 2026-07-30 01:15 — Comunica: modo oscuro completo + pantalla de carga de marca

- **Franjas de arriba y de abajo en claro con la app en oscuro (bug).** Las zonas
  del `contentInset` (notch arriba, hueco del tab bar abajo) y el rebote del
  scroll las pintaba **WKWebView con su blanco por defecto**, no la pantalla: se
  veían dos bandas claras sobre contenido oscuro y no cambiaban nunca de color.
  El WebView ahora lleva el fondo del tema (`opaque={false}` en iOS + `style`).
- **El tema del sistema mandaba sobre el de la app en todo lo nativo.** La barra
  glass del notch, la tab bar nativa de iOS, el teclado y el fondo por defecto de
  los WebView seguían la apariencia del **sistema operativo**, así que con la app
  en Oscuro y el móvil en Claro se quedaban claros (y al cambiar el modo del
  dispositivo con Comunica abierto la parte de arriba no reaccionaba).
  `AppSettingsContext` ahora llama a `Appearance.setColorScheme()` con el tema
  elegido — afecta a TODA la app, no solo a Comunica.
- **Barra glass del notch teñida con el tema** (antes usaba el material del
  sistema sin tinte) y hairline visible también en oscuro
  (`GlassSurface` acepta `bottomBorderColor`).
- **Pantalla de carga de marca** (`ComunicaLoader`): onda del logo animada,
  barra de progreso real (`onLoadProgress`), esqueleto de formulario y salida en
  fade. Comunica tarda en responder y antes no se mostraba nada: `renderLoading`
  no se aplicaba porque faltaba `startInLoadingState`. En error se ofrece
  **Reintentar** en la propia pantalla; los fallos de navegaciones posteriores
  siguen siendo un toast y muestran un hilo de progreso arriba
  (`ComunicaTopProgress`) en vez de tapar la web.
- La mecánica del WebView (tema hacia la web, historial, progreso, errores) se
  extrae a `hooks/useComunicaWebView.ts`; la pantalla se queda con el layout.
- **Lado web** (repo `comunicaFormularios`): `crm_comunica_estilos.css` gana una
  capa de modo oscuro por variables, colgada de `html.dark` /
  `data-mcm-theme="dark"` (y de `prefers-color-scheme` fuera de la app), con el
  fondo de página `#121316` que espera la app; los formularios añaden
  `viewport-fit=cover` y `<meta name="color-scheme">`, y los elementos fijos
  reservan `env(safe-area-inset-bottom)`. El tema claro queda igual (verificado
  pixel a pixel; solo cambian los iconos de enlace externo de los botones
  legales, que eran oscuros sobre fondo de color).
- Archivos: `app/screens/ComunicaScreen.tsx`, `hooks/useComunicaWebView.ts`,
  `components/ui/ComunicaLoader.tsx`, `components/ui/ComunicaTopProgress.tsx`,
  `components/ui/GlassSurface{,.ios}.tsx`, `contexts/AppSettingsContext.tsx`,
  `__tests__/comunicaThemeBridge.test.ts`,
  `docs/contratos/COMUNICA_WEBVIEW.md`.

## 2026-07-29 19:20 — Visita Papa archivada y Comunica como tab (después de Contigo)

- **Archivar un evento ahora hace algo.** El "archivar" del panel MCM
  (`activities/<id>/_meta.status = 'archived'`) se leía y se mergeaba sobre el
  registry, pero **ningún sitio de la app consumía el `status`**: la tab del
  evento dependía sólo de la lista `tabs` del perfil, el botón de la Home de
  `homeButtons` y el banner de "tener acceso al evento", así que archivar no
  cambiaba nada visible. Nuevo `hooks/useVisibleTabs.ts` (quita el `tabId` del
  evento archivado en `(tabs)/_layout.tsx` y en las tarjetas de overflow de
  `MasHomeScreen`), más el gating del banner y del botón del grid en
  `app/(tabs)/index.tsx`. `EventosPasadosScreen` ya incluye el evento en curso
  cuando el panel lo archiva en caliente (antes leía sólo el registry).
- **Visita Papa León XIV 2026 pasa a `status: 'archived'`** en
  `constants/events.ts`: sin tab, sin botón en la Home y sin banner; se accede
  desde **Más > Eventos pasados**. El panel puede devolverla a `active`.
- **Comunica es tab propia, justo después de Contigo.** Faltaba la ruta:
  `TABS_CONFIG` y `KNOWN_TABS` ya listaban `comunica`, pero no existía
  `app/(tabs)/comunica.tsx`, así que ponerla en `tabs` no podía funcionar. Se
  crea la ruta (envuelve `ComunicaScreen`, `headerShown: false` porque el WebView
  gestiona su propia zona segura) y se mueve su entrada del catálogo detrás de
  `contigo`. El botón de la Home apunta a `/comunica` cuando el perfil tiene el
  tab, en vez de abrir la pantalla dentro del stack de "Más".
- **`firebase-seed/profileConfig.json`:** los tres perfiles (familia, monitor,
  miembro) añaden `comunica` a `tabs`, quitan `visitapapa` de `tabs`/
  `homeButtons` y quitan `comunica` de `masItems` (ya no hace falta duplicarla en
  "Más"). ⚠️ El mismo cambio hay que aplicarlo en `/profileConfig/data/profiles/*`
  de Firebase (desde el panel) para que surta efecto sin publicar.
- Orden resultante de la barra: Inicio · Cantoral · Contigo · Comunica ·
  Calendario · Fotos · Más (en iOS, Calendario y Fotos siguen cayendo como
  tarjetas en "Más", igual que antes).
- Archivos: `constants/events.ts`, `constants/tabsCatalog.ts`,
  `hooks/useVisibleTabs.ts`, `app/(tabs)/comunica.tsx`, `app/(tabs)/_layout.tsx`,
  `app/(tabs)/index.tsx`, `app/screens/MasHomeScreen.tsx`,
  `app/screens/EventosPasadosScreen.tsx`, `firebase-seed/profileConfig.json`,
  `docs/funcionalidades/EVENTOS.md`.

## 2026-07-27 23:45 — Comunica: el tema de la web ya no se congela antes de tiempo

- **Tema correcto en la primera petición.** La URL inicial (`?theme=`) se
  congelaba en el primer render, antes de que `AppSettingsContext` terminara de
  leer el tema guardado de AsyncStorage. En arranque en frío eso mandaba el tema
  del **sistema operativo**, no el elegido en la app: alguien con la app en Claro
  y el móvil en oscuro veía Comunica cargar en oscuro y corregirse después. Ahora
  la pantalla espera a tener el tema guardado (muestra el loader) y solo entonces
  monta la web.
- **Web (iframe):** al ser cross-origin no admite inyección de JS, así que el
  cambio de tema en caliente no le llegaba nunca y se quedaba siempre en claro.
  Ahora el `src` del iframe lleva el tema actual y se recarga al cambiarlo.
- **Costura de color al hacer overscroll:** el fondo bajo el WebView pasa de
  `#1C1C1E` a `#121316` para coincidir con el fondo de página de la web.
- Archivos: `app/screens/ComunicaScreen.tsx`,
  `docs/contratos/COMUNICA_WEBVIEW.md` (contrato al día: quién resuelve
  «Sistema», colores de fondo, excepción de la web).

## 2026-07-26 18:05 — Contigo: revisión a fondo del sistema de subrayado

- **Copiar/pegar y menú nativo de verdad**: `HighlightableReading` renderiza el
  texto en iOS como un `TextInput` de solo lectura (un `UITextView` real) en los
  **dos** modos, en vez de cambiar de componente al entrar en modo subrayar. Se
  gana la selección nativa completa: asas, lupa, Copiar, Traducir, Buscar y las
  Herramientas de escritura de iOS. En Android se sigue usando `Text selectable`
  al leer (evita que "Pegar" escriba dentro de la lectura) y `TextInput` al
  subrayar. Todas las lecturas usan ya el mismo componente, sean subrayables o
  no.
- **Los subrayados ya no desaparecen en modo subrayar**: los tramos de color se
  pasan como hijos `<Text>` del `TextInput` (cadena atribuida nativa) en lugar de
  un `value` plano. Como consecuencia, aplicar un color ya **no** cierra el modo
  subrayar: se pueden marcar varias frases seguidas viendo lo ya pintado.
  (Excepción conocida: en web RNW no admite hijos en el `textarea`, así que ahí
  el color se ve al salir del modo.)
- **Se pueden subrayar TODAS las lecturas del día**: primera lectura, salmo,
  segunda lectura y también el **comentario**, no solo evangelio y salmo.
  `HighlightSource` pasa a `evangelio | comentario | lectura1 | salmo | lectura2`
  y el estado se centraliza en el hook nuevo `useReadingHighlights`, de modo que
  añadir una fuente es añadir una entrada a `HIGHLIGHT_SOURCES` (antes había que
  duplicar memos y handlers a mano, que es por lo que la primera lectura se
  quedó sin subrayado).
- **Fix de los toggles de las tarjetas**: al entrar en modo subrayar la tarjeta
  se abre una vez y a partir de ahí manda el usuario. Antes `isOpen` la forzaba
  abierta mientras durase el modo, así que pulsar la cabecera no hacía nada
  visible y las tarjetas parecían abrirse y cerrarse solas.
- **Texto**: "Otras lecturas de la misa" → "Todas las lecturas del día".
- **Documentación**: nuevo `docs/funcionalidades/SUBRAYADO.md` con el modelo de
  datos, por qué el texto es un `TextInput`, y los pasos concretos (iOS `UIMenu`
  vía `editMenuForTextIn`, Android `ActionMode.Callback2`) para meter "Subrayar"
  en el menú nativo — eso requiere **build de tienda**, no OTA. Tarea añadida a
  `TODO.md`.
- Archivos: `components/contigo/HighlightableReading.tsx`,
  `components/contigo/ReadingCard.tsx`, `hooks/useReadingHighlights.ts` (nuevo),
  `app/(tabs)/contigo/evangelio.tsx`, `utils/contigoBookmarks.ts`,
  `docs/funcionalidades/SUBRAYADO.md`.

## 2026-07-26 11:20 — Comunica: cápsula atrás/adelante legible en oscuro + tema hacia la web

- **Fix (modo oscuro)**: la cápsula atrás/adelante era ilegible. `GlassSurface`
  sin `tintColor` pinta **blanco al 95% en Android/web** ignorando el tema, y en
  iOS usa `systemChromeMaterial`, que sigue la apariencia del **sistema** y no el
  tema elegido a mano en la app → iconos blancos sobre cristal blanco (o al
  revés). `GlassActionGroup` acepta ahora un `tintColor` opcional (aditivo, no
  cambia el resto de usos) y `WebViewNavControls` lo fija según el tema de la
  app; el rim blanco se atenúa sobre cápsula oscura y sube el contraste del
  estado deshabilitado.
- **Tema hacia la web**: la app propaga claro/oscuro a Comunica por tres vías
  complementarias — `?theme=` en la URL inicial (render server-side sin
  parpadeo), **cookie `mcm_theme`** (viaja en todas las peticiones siguientes,
  legible desde PHP) y clase/atributo en `<html>` + `color-scheme` (para webs
  que resuelven el tema solo con CSS). Si el usuario cambia el tema con Comunica
  abierto se reinyecta **sin recargar**, para no perder formularios a medias.
  La URL se congela con el tema del montaje para que un cambio de tema no mute
  `source.uri` y fuerce recarga. Fondo del contenedor según tema (sin flash
  blanco al cargar en oscuro).
- **Nuevo** `docs/contratos/COMUNICA_WEBVIEW.md`: contrato para el repo PHP de
  Comunica (`?app=1`, tema, zona segura con `env(safe-area-inset-*)`, saneado de
  los parámetros). Indexado en `docs/README.md`.
- Archivos: `components/ui/GlassActionGroup.tsx`,
  `components/ui/WebViewNavControls.tsx`, `app/screens/ComunicaScreen.tsx`.
  Cambio OTA-safe.

---

## 2026-07-24 18:42 — UI Nativa Fase 2: `AppTextField` en más formularios + `EmptyState` en Calendario

- Migrados a `AppTextField`: pregunta de texto libre del wizard de encuestas
  (`QuestionInput`), nombre de fichero al exportar playlist
  (`SelectedSongsScreen`), formulario de "Compartiendo" en Reflexiones
  (título/contenido/autor), nombre de sesión al subir/cambiar código
  (`CodeInputModal`) y título/fecha del modal de exportar PDF
  (`ExportPdfModal`). Cada campo respeta su acento existente (verde de
  Reflexiones, azul de playlists, rojo de PDF) vía `accentColor`.
- Descartados a propósito en esta pasada: el input oculto de dígitos de
  `CodeInputModal` (hack de opacidad casi nula para el UI de celdas — no es
  un campo visible), el `TextInput` de solo-selección de
  `HighlightableReading` (no es un formulario, es un truco de
  selección/resaltado de texto de lectura) y los formularios de Contigo
  (`revision.tsx`) que usan la paleta cálida propia — se dejan para cuando
  se pueda verificar en dispositivo, igual que `evangelio.tsx` en el lote
  anterior. `SecretPanelModal` (panel de depuración, 16 campos) se deja
  fuera por ser una superficie grande sin verificar en dispositivo.
- `EmptyState` adoptado en el tab Calendario: "Sin eventos" del día
  seleccionado y "Sin eventos este mes" / "Todos los calendarios ocultos"
  de la vista agenda.

## 2026-07-24 04:10 — UI Nativa Fase 2: más `EmptyState` (Eventos pasados, Contactos)

- `EventosPasadosScreen` (texto pelado "todavía no hay eventos pasados") y el
  vacío de búsqueda de `ContactosScreen` pasan al componente canónico
  `EmptyState` (icono + título + subtítulo unificados). `CommandPalette` se
  deja fuera a propósito: es un dropdown compacto y el padding de `EmptyState`
  lo desbordaría.

## 2026-07-23 06:51 — Comunica (familias): navegación atrás/adelante en la web

- Nuevo `components/ui/WebViewNavControls.tsx`: cápsula **glass flotante**
  (reutiliza `GlassActionGroup`, el look segmentado del cantoral/eventos) con
  botones **atrás/adelante** para WebViews a pantalla completa. Se **auto-oculta
  cuando no hay historial** en ninguna dirección (en la primera página no
  aparece nada) y atenúa el segmento cuyo sentido no está disponible. Háptica
  al pulsar (`h.tap`).
- `ComunicaScreen`: cablea `onNavigationStateChange` → estado
  `canGoBack/canGoForward`, `ref.goBack()/goForward()`, y la cápsula flotante
  abajo-izquierda (por encima del tab bar). En **Android** el botón/gesto atrás
  del sistema navega primero por el historial de la web (`BackHandler` bajo
  `useFocusEffect`) y solo sale de la pantalla al agotarlo.
- Componente reutilizable: preparado para colgarlo también de Gestión y MCM
  Panel si se quiere. Cambio OTA-safe (sin módulos nativos nuevos).
- Archivos: `components/ui/WebViewNavControls.tsx`, `app/screens/ComunicaScreen.tsx`.

---

## 2026-07-23 06:37 — Comunica (familias): barra superior glass y scroll bajo el tab bar

- **Barra superior**: se sustituye la franja azul sólida del notch por una
  barra **glass nativa** (`GlassSurface`, mismo material `systemChromeMaterial`
  del tab bar y de los headers del cantoral) en iOS; la web queda a pantalla
  completa por detrás y se desliza bajo el cristal al hacer scroll. El texto de
  la status bar pasa a ser **adaptativo** (oscuro en claro / claro en oscuro),
  así siempre es legible. En Android (sin cristal fiable) se usa una franja
  lisa blanca/oscura según el tema.
- **Scroll inferior (iOS)**: se añade `contentInset` inferior (alto del tab bar
  - margen) para poder arrastrar el contenido por encima del tab bar
    translúcido — antes el último botón de la web (p. ej. «Guardar») quedaba
    tapado. Además la web arranca en zona segura vía `contentInset` superior.
- Archivo: `app/screens/ComunicaScreen.tsx`. Cambio OTA-safe (sin módulos
  nativos nuevos; `GlassSurface`/`expo-blur` ya están en el binario).

---

## 2026-07-22 23:55 — UI Nativa Fase 2: adoptar `EmptyState` en estados vacíos

- Estados "no hay…" reinventados a mano migrados al componente canónico
  `EmptyState`: `ReflexionesScreen` ("aún no hay reflexiones"),
  `app/notifications.tsx` y `NotificationsBottomSheet` ("no hay notificaciones").
  Mismo look de vacío unificado (icono en círculo tintado + título + subtítulo).

## 2026-07-22 23:45 — UI Nativa Fase 2: más migraciones a `AppTextField`

- `AppTextField` gana dos props: `error` (borde rojo, con prioridad sobre
  foco/contenido) y `accentColor` (color de acento configurable, por defecto el
  verde de iOS) — así las pantallas con paleta propia lo respetan.
- Migrados a `AppTextField`: `PasswordPromptModal` (usa `error` para la
  contraseña incorrecta) y `ArrangementInputModal` (usa `accentColor` con el
  rojo de marca `#E15C62`).

## 2026-07-22 23:15 — UI Nativa Fase 2: `AppPrimaryButton` (CTA unificado)

- Nuevo `components/ui/AppPrimaryButton.tsx`: botón CTA estándar
  ("Enviar/Guardar/Aceptar") que sustituye el `TouchableOpacity` + estilo a mano
  que cada modal reimplementaba (azul lleno, icono opcional, spinner al enviar,
  estado deshabilitado). Usa `PressableFeedback` (heroui) con `Scale` —la
  primitiva de pulsación decidida para la app— y una prop `color` para que
  Contigo (warm) y los eventos (color por evento) mantengan su paleta propia.
- Migrados los CTAs de `SuggestSongModal`, `AppFeedbackModal` y `ReportBugsModal`.
- Además, los `TextInput` crudos de `AppFeedbackModal` y `ReportBugsModal`
  pasan a `AppTextField` (mismo look de input unificado, borde verde al
  rellenar) — SuggestSong ya lo usaba.
- **Decisiones de UI tomadas** (ver `docs/planes/PLAN_UI_NATIVA.md` §4): headers
  nativos en pantallas "lista+detalle" y floating glass solo en heros de evento;
  pulsación estándar `PressableFeedback`; Contigo/Eventos conservan su paleta.

## 2026-07-22 22:30 — Plan 008: caché de datos compartida (dedupe) + calendario stale-while-revalidate

- **`useFirebaseData`**: nueva caché a nivel de módulo compartida entre las
  instancias del mismo `storageKey`. Antes cada consumidor del mismo path
  repetía el `JSON.parse` de la caché de AsyncStorage y su propio round-trip a
  Firebase — el nodo `songs` tiene 3 consumidores vivos a la vez (Categories,
  SongList, SelectedSongs por `freezeOnBlur`). Ahora el fetch remoto se
  **coalesce** (una sola descarga aunque monten varios a la vez) y el parseo se
  reutiliza. La API del hook no cambia (`{ data, loading, offline, hidden }`).
- **Datos crudos en caché**: la caché de módulo y AsyncStorage guardan ahora el
  dato **sin transformar**; el `transform` se aplica por instancia al leer (dos
  consumidores del mismo path pueden filtrar distinto). Antes AsyncStorage
  guardaba lo que transformara el último en escribir —dependiente de una
  carrera—; la vista de cada pantalla es idéntica porque el transform se aplica
  siempre al leer.
- **Calendario (`useCalendarEvents`)**: stale-while-revalidate — la caché se
  muestra al instante también **online** (antes solo offline; online se
  esperaba a bajar todos los ICS aunque hubiera datos válidos). El fetch+parseo
  se coalesce entre Home y Calendario. El `catch {}` vacío por calendario ahora
  loguea con `logger.error`, y un fallo parcial **no pisa** la caché buena en
  disco ni degrada la vista si ya había caché.
- Tests: +3 casos de dedupe en `__tests__/useFirebaseData.test.ts` (los 6
  existentes intactos). Suite: 32 ficheros, 305 tests.

## 2026-07-22 21:13 — Comunica (familias): nueva URL de la web embebida

- El WebView de "Comunica" (portal para familias) apunta ahora a
  `https://comunica.movimientoconsolacion.com/aptest/?app=1` en lugar de la
  raíz del dominio. El parámetro `?app=1` permite a la web detectar que se
  carga desde la app.
- La URL sigue hardcodeada como constante en el propio componente (no viene
  de Firebase ni de un JSON de config) — mismo patrón que
  `ComunicaGestionScreen.tsx` (administradores).
- Archivo: `app/screens/ComunicaScreen.tsx`

---

## 2026-07-22 21:00 — Fix: el modo alpha (7 taps) no conectaba al canal OTA preview

- **Causa raíz**: `Updates.setUpdateURLAndRequestHeadersOverride()` exige que el
  binario esté construido con `updates.disableAntiBrickingMeasures: true` en
  `app.json`. Sin ese flag, expo-updates lanza un error que el `try/catch` de
  `PreviewChannelContext` silenciaba — el toggle parecía funcionar pero el
  dispositivo seguía en el canal `production`.
- **Fix**: añadido `"disableAntiBrickingMeasures": true` al bloque `updates` de
  `app.json`, y el `catch` ahora loguea con `logger.warn` para que el fallo sea
  visible. (`app.json`, `contexts/PreviewChannelContext.tsx`)
- ⚠️ **Requiere build de tienda**: el flag se hornea en el binario nativo
  (Expo.plist / AndroidManifest). Los binarios ya instalados seguirán ignorando
  el toggle hasta que se publique una nueva build de producción con este cambio.
  Las OTAs no pueden activar el flag — este commit en sí es OTA-safe (no añade
  módulos nativos nuevos), simplemente el toggle no surtirá efecto hasta la
  próxima build de tienda.
- El resto de la cadena ya estaba bien: 7 taps (`SecretMenuTrigger` →
  `useSecretTap`) → modal Laboratorio Alpha → flag en AsyncStorage → override al
  arrancar → `useOTAUpdate` hace `checkForUpdateAsync` contra el canal `preview`.
  El workflow `.github/workflows/ota-preview.yml` publica en la branch EAS
  `preview` con cada push a la rama git `preview`.

## 2026-07-22 20:15 — Plan 004: hábitos y revisiones de Contigo se restauran al iniciar sesión

- **Bug arreglado**: los hábitos diarios (`users/{uid}/contigo/habits`) y las
  revisiones (`users/{uid}/contigo/revisions`) se subían a RTDB al marcar,
  pero nada los leía de vuelta — reinstalar la app o cambiar de dispositivo
  con sesión iniciada borraba rachas, heatmap y el texto de revisiones
  antiguas aunque siguieran en la nube.
- **`utils/authHelpers.ts`**: nuevas `fetchContigoHabits`/`fetchContigoRevisions`
  (mismo patrón que `fetchContigoBookmarks`), y `stripUndefined` pasa a
  exportarse para poder testearla directamente.
- **`hooks/useContigoHabits.ts`**: al montar o cambiar de sesión, hidrata
  desde RTDB y fusiona con lo local vía el nuevo helper puro
  `utils/contigoMerge.ts` — por fecha, gana el registro con más hábitos
  marcados, a igualdad el local (un remoto desactualizado nunca "desmarca"
  progreso reciente); las fechas donde lo local aportó algo se re-suben.
  `reloadRecords` (recarga al enfocar la pantalla) sigue siendo solo local,
  sin tocar red.
- **`app/(tabs)/contigo/revision.tsx`**: si no hay entrada local para el día
  seleccionado y hay sesión, hidrata el texto completo (gratitud + revisión)
  desde RTDB y lo persiste en local para no repetir la descarga.
- **Tests nuevos**: `__tests__/authHelpers.test.ts` (14, cubre también
  `writeUserOnLogin`/`deleteUserData` que no tenían ninguno) y
  `__tests__/contigoMerge.test.ts` (5, semántica de fusión). Suite completa:
  32 ficheros, 302 tests verdes.
- Plan `plans/004-contigo-sync-bidireccional.md` → DONE. Ver
  `docs/planes/BACKLOG.md` — siguiente en la cola: Plan 005 (scraper).

## 2026-07-22 19:10 — Backlog único de planes (`docs/planes/BACKLOG.md`); anulado el plan 007; archivado MEJORAS.md

- **Nuevo `docs/planes/BACKLOG.md`**: fuente única de verdad del orden de
  ejecución de todos los planes (tácticos de `plans/` + estratégicos de
  `docs/planes/`), con protocolo de trabajo explícito — qué hacer cuando se
  dice "seguimos" (avanza la cola principal) o "me sobran tokens" (muestra
  el backlog y deja repriorizar sin avanzar la cola), y qué ítems están
  bloqueados por una decisión del usuario (con dónde consultar el contexto y
  qué preguntar antes de ejecutar). Referenciado desde `CLAUDE.md` (raíz,
  regla 9) y `docs/README.md` como punto de entrada.
- **Cola principal fijada**: Plan 004 → Plan 005 → Plan 008 (Opus, con foco
  extra en medir rendimiento real) → UI Nativa → Integración D (repriorizada,
  ver abajo) → Widget de Contigo (al final) → Carismochito + Panel Pañuelo
  (cierre). Fuera de la cola: Calidad Fase 1 (solo si piden hueco),
  Integraciones resto, y una "bolsa nativa" para la próxima build de tienda
  (el fix del modo alpha de arriba ya está mergeado, solo pendiente de build).
- **Plan 007 anulado** (privacidad de respuestas de encuestas): decisión de
  producto — el panel debe poder ver nombres/respuestas, no es un bug.
  Banner de anulación en `plans/007-privacidad-respuestas-encuestas.md`,
  estado `REJECTED` en `plans/README.md`.
- **Integración D repriorizada**: ya no es urgencia de incidente (la app está
  en beta privada, no en gran producción); sigue siendo importante hacerla
  pero sin prisa. Nota añadida en `docs/planes/PLAN_INTEGRACIONES.md`.
- **`docs/planes/MEJORAS.md` archivado** a `docs/planes/archivo/MEJORAS.md`
  (superseded por `BACKLOG.md` + `TODO.md` + `PLAN_CALIDAD.md`). Multilenguaje
  queda anotado como "deuda futura" (no ahora); enlaces legales en "Más"
  queda como tarea pequeña pendiente de que el usuario pase las 3 URLs.
- **Nuevo concepto anotado** (sin plan funcional, solo idea):
  `docs/planes/PLAN_PANEL_PANUELO.md` — espacio con modelo 3D del pañuelo del
  MCM donde colocar chapas ganadas por participar en actividades. Cierre
  final de la cola junto con Carismochito.
- Archivos: `docs/planes/BACKLOG.md`, `docs/planes/PLAN_PANEL_PANUELO.md`,
  `docs/planes/PLAN_CARISMOCHITO.md`, `docs/planes/PLAN_INTEGRACIONES.md`,
  `docs/README.md`, `CLAUDE.md` (raíz), `plans/README.md`,
  `plans/007-privacidad-respuestas-encuestas.md`, `mcm-app/TODO.md`; retirado
  `docs/planes/RESUMEN_EJECUTIVO.md` (fusionado en BACKLOG.md).

## 2026-07-19 18:30 — Seguridad cantoral (XSS), bug de fecha UTC, reflexiones atómicas, limpieza de deps

- **Seguridad (cantoral)**: `author`/`title`/el badge de tono se escapan
  antes de inyectarse en el WebView de la canción. Además, se descubrió que
  `HtmlDivFormatter` de ChordSheetJS no escapa NADA de lo que extrae del
  ChordPro (título, comentarios, letra) — como `/songs/data` es escribible
  públicamente, cualquier canción podía ejecutar HTML/JS arbitrario en el
  WebView de todos los dispositivos que la abrieran. Ahora el ChordPro se
  escapa completo antes de parsear. También se endurece `SongDisplay`
  (`originWhitelist` + bloqueo de navegación) para que el WebView del
  cantoral no siga marcado como superficie de confianza total.
- **Fix de fecha (bug UTC)**: "hoy" en Home y Calendario, y la fecha de una
  reflexión, se calculaban con `toISOString()` (convierte a UTC) — en España
  eso desplazaba "hoy" al día anterior entre medianoche y la 1-2 de la
  madrugada, colando eventos de ayer como "próximos". Nuevo helper
  `utils/localDate.ts` (`localISO`) usado en los tres sitios y en
  `useContigoHabits` (que ya lo tenía, ahora compartido).
- **Reflexiones**: la publicación ahora es una única escritura atómica
  (`update()` multi-path para `data`+`updatedAt`, antes eran dos `set()`
  separados que podían dejar una reflexión invisible para otros
  dispositivos si el segundo fallaba). Si falla el guardado, el texto ya NO
  se borra del formulario y se muestra un toast de error.
- **Dependencias**: eliminadas 4 sin ningún uso en el código
  (`@gorhom/bottom-sheet`, `react-native-modal` —iba en versión _release
  candidate_—, `@react-native-picker/picker`, `@react-native-community/slider`)
  y `jest` deduplicado (estaba a la vez en `dependencies` y
  `devDependencies`). Pineadas las versiones de `eas-cli`/`firebase-tools`
  en los workflows de release (antes `@latest`, con riesgo de que una major
  nueva rompiera un deploy sin cambios en el repo).
- Archivos: `hooks/useSongProcessor.ts`, `components/SongDisplay.tsx`,
  `utils/localDate.ts` (nuevo), `utils/reflexiones.ts` (nuevo),
  `app/(tabs)/index.tsx`, `app/(tabs)/calendario.tsx`,
  `app/screens/ReflexionesScreen.tsx`, `hooks/useContigoHabits.ts`,
  `package.json`, `.github/workflows/{deploy-web,deploy-firebase-rules,
ota-preview,ota-production}.yml`, `plans/README.md`.

---

## 2026-07-19 16:45 — Quick wins de la auditoría: logging de registro push y limpieza

- El registro de notificaciones push (`registerAndSaveToken`) ya no traga
  errores en silencio: fallos de permisos/token/escritura se loguean con
  `logger.error` (antes "no me llegan notificaciones" era indepurable).
- `ReflexionesScreen` usa el toast de la app (`AppToastContext`) en vez del
  de heroui (único straggler del repo).
- `TabScreenWrapper.ios.tsx` → `TabScreenWrapper.tsx` (era cross-platform;
  el sufijo `.ios` era engañoso y los imports llevaban extensión explícita).
- Docs sincronizados con la realidad: conteo de tests y ruta de
  `utils/firebaseApp.ts` en CLAUDE.md, React Compiler ya activo (fuera del
  TODO), README sin `expo-cli` deprecado y con la chuleta de builds vía
  `npm run eas:build*`.
- Archivos: `notifications/usePushNotifications.ts`,
  `app/screens/ReflexionesScreen.tsx`, `components/ui/TabScreenWrapper.tsx`,
  `CLAUDE.md`, `TODO.md`, `README.md` (raíz), `plans/README.md`.

## 2026-07-19 16:20 — Celebración al publicar reflexión + metadatos OG del web

- Al compartir una reflexión con éxito, se lanza el `CelebrationBurst` (ya
  existente en `components/ui/`, hasta ahora sin consumidores pese a que su
  docstring nombraba este caso de uso). Overlay de 1,1s, solo
  transform/opacity con native driver, no bloquea toques.
- Web/PWA: añadidos `og:site_name` y `og:locale` (es_ES) en `app/+html.tsx`;
  anotado que `og:image`/`og:url`/canonical necesitan el dominio público
  definitivo (URLs absolutas) cuando se fije.
- Instalados packs de skills para agentes: `shadcn/improve` e
  `ibelick/ui-skills` (`.agents/skills/`), con auditoría técnica completa en
  `plans/` (8 planes priorizados).
- Archivos: `app/screens/ReflexionesScreen.tsx`, `app/+html.tsx`,
  `plans/*`, `.agents/skills/*`.

## 2026-07-16 14:20 — Fix: modo subrayar con capa única (se veía el texto doblado)

- La capa de selección (TextInput con glifos "transparentes" superpuesta al
  texto) se pintaba igualmente en iOS y quedaba doblada y desalineada. Ahora el
  modo subrayar muestra UNA sola capa: el propio `TextInput` de solo lectura con
  el texto visible (misma tipografía), con altura autoajustada.
- Al elegir color (o borrar con la goma) se aplica y se sale automáticamente del
  modo subrayar, de forma que el pastel recién pintado se ve al instante.
- La selección ahora es "pegajosa": tocar el chip de color ya no puede perder la
  selección por el colapso nativo previo al onPress.

## 2026-07-16 13:45 — Contigo: subrayado con selección nativa y colores pastel + calendario de evangelios

- **Subrayado v2 (reemplaza al de frases).** En modo subrayar se superpone al
  texto un `TextInput` de solo lectura con glifos transparentes: la selección
  es la NATIVA del sistema (asas de arrastre, lupa, menú de copiar y
  herramientas de escritura/IA de iOS) y marca inicio y fin exactos. Una barra
  flotante ofrece **5 colores pastel** y goma de borrar; el modelo pasa de
  frases a **rangos de caracteres con color** (`utils/highlightRanges.ts`,
  offsets sobre el texto canónico de `normalizeReadingText`). Retrocompatible:
  las frases guardadas por la versión anterior se convierten al vuelo.
- **Calendario de evangelios** (`ReadingCalendarSheet` + botón en el header):
  navegación por meses con animación, días con lectura disponible (consulta
  las claves de `seccion_oracion/lecturas` vía REST `shallow=true`, cacheado
  6 h — `hooks/useAvailableReadingDates.ts`), guardados y subrayados marcados,
  leyenda y salto a hoy.
- **Ajustes de lectura**: la barra de tamaño ahora se puede pulsar y
  arrastrar; se elimina el botón «Sincronizar con la app» (la herencia del
  tamaño global sigue funcionando en silencio). El header del evangelio pierde
  el título y gana el botón de calendario.
- **Cantoral — sheet de transponer**: sección TONO rediseñada con −1/+1
  grandes y fijos (pensados para pulsar varias veces rápido), mantener
  pulsado repite, y valor central con animación de confirmación. Se retiran
  los pasos ±2.
- Refactor: créditos de fuentes extraídos a
  `components/contigo/CreditsSheet.tsx`; `HighlightableText` sustituido por
  `components/contigo/HighlightableReading.tsx`.

## 2026-07-15 18:30 — Contigo: subrayado de lecturas, bookmarks duraderos y tamaño de letra propio

- **Bookmarks duraderos en Firebase.** El Job del scraper borra
  `seccion_oracion/lecturas/{fecha}` pasados 30 días, así que un evangelio
  guardado perdía su texto al reinstalar o cambiar de dispositivo. Ahora el
  bookmark guarda el **texto completo** también en el subárbol del propio
  usuario (`users/{uid}/contigo/bookmarks/{date}`): crecimiento acotado
  (solo lo que cada usuario guarda) y se conserva para siempre sin hinchar el
  nodo común. Al abrir la sección se **hidrata** lo local desde RTDB, de modo
  que los guardados sobreviven a reinstalaciones y al borrado a 30 días.
- **Subrayado de lecturas (evangelio y salmo).** Nuevo modo «subrayar»: un toque
  marca la frase; la selección nativa (copiar, buscar, herramientas de escritura
  de iOS) sigue disponible con pulsación larga. Subrayar **auto-guarda** el día
  como bookmark y almacena las frases subrayadas (visibles en «Guardados»).
- **Tamaño de letra propio de Contigo + modo oscuro.** El botón de ajustes de la
  lectura abre un bottom sheet dedicado (`ReaderSettingsSheet`) con vista previa
  en vivo, tamaño de letra y tema. El tamaño es **independiente del global**,
  pero si no se ha configurado uno propio, **hereda** del general (transición
  suave). Mecanismo reutilizable (`useSectionFontScale`) para futuras secciones
  de lectura (p.ej. materiales de eventos). Las lecturas secundarias suben de 16
  a 17 pt para acercarse al evangelio.
- **Datos:** nuevo campo con texto completo y `highlights` en
  `users/{uid}/contigo/bookmarks/{date}`. Sin cambios en las reglas RTDB (el
  nodo ya era privado del dueño).
- Archivos: `hooks/useSectionFontScale.ts`, `hooks/useReaderBookmarks.ts`,
  `utils/contigoBookmarks.ts`, `utils/readingSegments.ts`,
  `components/contigo/HighlightableText.tsx`,
  `components/contigo/ReaderSettingsSheet.tsx`,
  `components/contigo/ReadingCard.tsx`, `contexts/AppSettingsContext.tsx`,
  `utils/authHelpers.ts`, `app/(tabs)/contigo/evangelio.tsx`,
  `app/(tabs)/contigo/bookmarks.tsx`.

## 2026-07-07 19:20 — B4 (panel): escrituras granulares de Actividades

- Cambio en el repo **mcmpanel** (aquí solo se documenta, es contrato de datos).
  El panel guardaba `/activities` con `set()` del nodo completo, lo que pisaba
  lo que escribe la app: `activities/<evento>/evaluacion/respuestas/<device>` y
  `activities/<evento>/compartiendo` (reflexiones). Ahora escribe con `update()`
  multi-path SOLO las subrutas que el admin editó, así esos subnodos ya no se
  sobrescriben. Corrige además un clobber preexistente: cada edición de
  Actividades reescribía todo `/jubileo`.
- Sin cambios en la app. Ejecuta B4 de PLAN_INTEGRACIONES (queda un smoke test
  contra Firebase real). Con esto la **Integración B está completa** (B1–B4).

## 2026-07-07 18:40 — B1: la app consume `activities/<id>/_meta` del evento activo

- El panel edita por evento `title`, `tintColor`, `bannerText` y `status`, pero
  la app los ignoraba (todo salía del registry hardcodeado
  `constants/events.ts`). Ahora, para el **evento activo**, la app mergea ese
  `_meta` remoto sobre la config del registry: el banner de la Home y el hub del
  evento reflejan los cambios del panel **sin publicar versión** (p. ej. cambiar
  el banner o el color del evento activo).
- `utils/mergeEventMeta.ts` (merge puro, valida hex/campos) +
  `hooks/useEventMeta.ts` (lee el nodo `_meta` PLANO con caché offline; ese
  nodo NO es `{updatedAt,data}` como el global, por eso no usa
  `useFirebaseData`), aplicado en `contexts/ActiveEventContext.tsx`. Test:
  `__tests__/mergeEventMeta.test.ts`. Retrocompatible: sin `_meta` remoto se
  usa el registry.
- Pendiente (follow-up bajo riesgo): mergear `_meta` de eventos NO activos para
  que "Eventos pasados" respete `status: archived` del panel.
- Lado panel (mcmpanel): avisos honestos en el card de metadatos (B2) y en el
  diálogo de crear actividad (B3). Ejecuta B1–B3 de PLAN_INTEGRACIONES; queda B4
  (escrituras granulares, pendiente por riesgo — toca el guardado compartido).

## 2026-07-07 18:00 — A4.3: deep link de notificación a un evento concreto

- El panel puede mandar `data.eventId` (id del registry, p. ej. `jubileo` o
  `visitapapa26`) y, al tocar la notificación, la app abre el hub del evento en
  vez de solo el centro de notificaciones. Evento con tab propia → su tab;
  archivado sin tab → "Más"; id desconocido → fallback normal. Prioritario
  sobre `internalRoute`. También botón "Ir al evento" en el modal de detalle.
- Sin código nativo → entra por OTA. Aditivo y de impacto cero hasta que un
  admin lo use. Archivos: `utils/notificationEventRoute.ts` (nuevo helper),
  `notifications/usePushNotifications.ts` (handler de tap),
  `app/notifications.tsx` (botón en el modal), `types/notifications.ts`
  (`eventId`). Test: `__tests__/notificationEventRoute.test.ts`. Contrato §4/§(e).
- Lado panel (repo mcmpanel): opción "🎉 Abrir un evento…" en el composer,
  propagada por send/schedule/process-scheduled y persistida en el registro.
- Ejecuta el punto 3 de la acción **A4**. Con A4.1 ya hecho, de A4 solo quedan
  A4.2 (channels Android) y A4.4 (NSE de iOS, requiere build de tienda).

## 2026-07-07 17:15 — A4.1: chip visual de categoría en el centro de notificaciones

- `data.category` ya no es solo una etiqueta guardada: la tarjeta del centro de
  notificaciones y el modal de detalle pintan un chip de color con icono según
  la categoría (Eventos, Cantoral, Fotos, Urgente, Mantenimiento, Celebración).
  `general`, ausente y valores desconocidos no pintan chip (sin ruido).
- Sin código nativo → entra por OTA. Archivos:
  `utils/notificationCategory.ts` (nuevo, helper puro),
  `app/notifications.tsx` (chip en fila y modal). Test:
  `__tests__/notificationCategory.test.ts`. Contrato §6 y §(e) actualizados.
- Ejecuta el punto 1 de la acción **A4** de `docs/planes/PLAN_INTEGRACIONES.md`
  (el único sin build nativo). Pendientes A4.2 (channels Android), A4.3 (deep
  link a evento) y A4.4 (NSE de iOS, requiere build de tienda).

## 2026-07-07 16:45 — Plan de integraciones: A3 hecha (en mcmpanel) y A4 valorada

- `docs/planes/PLAN_INTEGRACIONES.md`: marcadas A1 y A3 como hechas y añadida la
  valoración de A4 (cuatro mejoras separadas por riesgo; recomendación de
  abordar solo el uso visual de `data.category` en la siguiente iteración y
  dejar channels Android, deep link a evento y NSE de iOS como acciones aparte).
- A3 se implementó en el repo `mcmpanel` (selector de eventos del composer
  poblado desde `/activities`); aquí solo se documenta.

## 2026-07-07 16:30 — A1: filtrar el historial in-app de notificaciones por audiencia

- El centro de notificaciones (la campana) pintaba TODO el nodo `/notifications`,
  así que un aviso segmentado ("solo monitores de Madrid") lo veía cualquiera.
  Ahora la app filtra cada registro contra el usuario actual usando el objeto
  `audience` que el panel ya guarda en el registro, con la MISMA semántica de
  envío (4 ejes + AND/OR). Un registro sin `audience` → visible para todos
  (retrocompatible con el histórico).
- El "usuario" es `profileType` + `delegationId` + unión de `notificationTopics`
  y topics `event-<id>` — la misma metadata que va a `/pushTokens`. El filtro se
  aplica tanto a la lista visible como al contador del badge.
- Archivos: `utils/notificationAudience.ts` (nuevo, lógica pura),
  `contexts/NotificationsContext.tsx` (consume perfil/config/eventos y filtra),
  `services/pushNotificationService.ts` (el contador acepta un predicado),
  `types/notifications.ts` (campo `audience`). Tests:
  `__tests__/notificationAudience.test.ts` (12 casos). Contrato actualizado:
  `docs/contratos/NOTIFICACIONES_CONTRATO.md` §7.ter.
- Ejecuta la acción **A1** de `docs/planes/PLAN_INTEGRACIONES.md`.

## 2026-07-06 17:00 — Auditoría de integraciones app ↔ panel ↔ cantoral (solo docs en este repo)

- Nuevo `docs/planes/PLAN_INTEGRACIONES.md`: hallazgos de la auditoría, arreglos
  ya aplicados en mcmpanel (id de evento `visitapapa26` en el composer, forma
  canónica de `activities/_meta`, preservación de colas de `/songs`, guardado
  del JSONManager sin pisar ediciones) y acciones pendientes ejecutables una a
  una (A1…E2).
- Docs corregidos: `PANEL_PERFILES.md` (la app deriva `delegationList` de
  `delegations`; catálogos con `visitapapa`/`eventos-pasados`; checklist
  cerrado), `EVENTOS.md` (documenta `activities/_meta` y que la app no lee los
  `_meta` por evento), `SEGURIDAD.md` (⚠️ el panel NO usa Admin SDK: no
  desplegar las reglas hasta darle auth), `NOTIFICACIONES.md` (título máx. 50).
- Sin cambios de código en la app.

## 2026-07-02 12:30 — Fix reproductor flotante de YouTube + audios de Drive en la app

**Vídeos (fix):** el player flotante cargaba `youtube.com/embed/<id>` como
documento principal del WebView y YouTube lo rechaza ("vídeo no disponible",
error 153: el embed exige vivir dentro de un `<iframe>` en una página con
referer válido — por eso en doceacordes funciona y aquí no). Ahora en nativo
se carga un shell HTML mínimo con el embed dentro de un iframe y
`baseUrl: https://www.youtube.com`; en web se mantiene el `<iframe>` directo.
No hace falta tocar el repo del cantoral: valen tanto URLs `watch` como
`embed` (la app ya normalizaba con `toYouTubeEmbedUrl`).

**Audios (nuevo):** los enlaces de Google Drive ya no se abren en el
navegador — suenan en el mismo reproductor flotante usando el endpoint
oficial de embed de Drive (`/file/d/<id>/preview`), con botón secundario
para abrir en el navegador. URLs no reconocidas como Drive siguen cayendo
al navegador.

- `components/song-media/FloatingYouTubePlayer.tsx` →
  `FloatingMediaPlayer.tsx` (soporta `kind: 'youtube' | 'drive'`; sin botón
  de pantalla completa para audio; altura reducida para el player de audio)
- `utils/googleDrive.ts` (nuevo) + `__tests__/googleDrive.test.ts`:
  `extractDriveFileId` / `toDrivePreviewUrl`
- `components/song-media/SongMediaSheet.tsx`: prop `onPlayVideo` →
  `onPlayMedia`; filas de audio reproducen in-app
- `app/screens/SongDetailScreen.tsx`: estado `floatingVideo` → `floatingMedia`

## 2026-06-28 15:45 — Refactor: trocear GruposScreen (parcial, Fase 1.7)

`app/screens/GruposScreen.tsx` pasa de **1100 → 561 líneas** (sale de la lista
de archivos >800). Extraído a una carpeta nueva `components/grupos/`:

- `SearchBar`, `MemberRow`, `GrupoCard`, `SearchHitRow` — los subcomponentes
  (ya recibían `styles` por prop, así que la extracción es directa).
- `gruposStyles.ts` — el `createStyles` + el tipo `GruposStyles`.
- `gruposHelpers.ts` — tipos (`Grupo`/`Data`/`SearchHit`) y helpers puros
  `normalize`/`isMe`, **con test** (`__tests__/gruposHelpers.test.ts`, 7 tests).
  `highlightText` se movió dentro de `SearchHitRow` (su único uso).

Cero cambios de comportamiento. **Parcial a propósito**: el cuerpo del
componente (4 ramas de render, ~511 líneas) NO se ha troceado — requiere
verificación en dispositivo y la posible migración a `SectionList` cambiaría
comportamiento (queda como follow-up en PLAN_CALIDAD §1.7). Gigantes >800:
11 → 10. typecheck/typecheck:tests/lint(0 err)/test(204) ok.

## 2026-06-28 15:10 — Refactor: trocear EvaluationWizard (Fase 1.9)

`components/EvaluationWizard.tsx` pasa de **976 → 360 líneas**, quedando como
pura orquestación (máquina de estados, barra de progreso, top bar y footer).
Piezas extraídas a una carpeta nueva `components/evaluation/`:

- `WelcomePhase.tsx` — pantalla de bienvenida.
- `QuestionInput.tsx` — el control de entrada por tipo de pregunta
  (stars/text/yesno/scale/single/multi).
- `SuccessPhase.tsx` — pantalla de agradecimiento.
- `WizardButton.tsx` — botón principal con micro-animación (usado por el
  wizard y por SuccessPhase).
- `ScaleInput.tsx` — escala numérica (NPS 0..10).
- `wizardStyles.ts` — estilos del armazón (`createWizardStyles(isDark)`).

Cero cambios de comportamiento (mismo JSX/estilos repartidos, callbacks pasados
por props). Se mantiene el export nombrado `EvaluationAnswers` en el mismo path
(lo importan EvaluacionScreen/EvaluacionAppScreen/SurveyScreen). Gigantes >800:
12 → 11. typecheck/typecheck:tests/lint(0 err)/test(197) ok.

## 2026-06-28 14:40 — Refactor: trocear NotificationsBottomSheet (Fase 1.9)

`components/NotificationsBottomSheet.tsx` pasa de **938 → 365 líneas**. Piezas
extraídas a una carpeta nueva `components/notifications/`:

- `NotificationDetail.tsx` — vista "en grande" de una notificación.
- `NotificationListItem.tsx` — tarjeta de la lista (swipe-para-leída, dot, chips
  de destino/acción). La lógica de marcado/navegación sigue en el padre y se le
  pasa por props.
- `notificationDisplay.ts` — helpers puros (`normalizeRoute`, `getRouteLabel`,
  `formatDate`, `ROUTE_LABELS`), **con test** (`__tests__/notificationDisplay.test.ts`,
  14 tests).

El sheet queda como datos + composición. Cero cambios de comportamiento (la
acción del chip de botón se movió a un handler `handleActionButtonPress` con la
misma lógica; se eliminaron dos estilos que ya no se usaban). Solo
`app/(tabs)/index.tsx` consume el sheet y su import no cambia. Tests: 19
ficheros / 197.

## 2026-06-28 14:05 — Refactor: trocear PreviewChannelModal (Fase 1.9)

Descuartizado el más pequeño de los gigantes (PLAN_CALIDAD §1.9):
`components/PreviewChannelModal.tsx` pasa de **847 → 349 líneas**. Las piezas
decorativas animadas del "Laboratorio Alpha" se extraen a una carpeta nueva
`components/preview-channel/`, cada una con sus propios estilos y constantes:

- `AnimatedGradients.tsx` — fondo de gradientes morphing.
- `FloatingParticle.tsx` — emojis flotantes.
- `ConfettiBurst.tsx` — explosión de confeti (variantes explode/puff).
- `GiantLever.tsx` — palanca MUNDANO ↔ ALPHA.
- `LabDecorations.tsx` — título wobble, sparkles y ticker de frases.

El modal queda como composición + contenido + estilos de layout. Cero cambios
de comportamiento (mismo código, estilos repartidos sin solapamiento); solo
`app/_layout.tsx` consumía el modal y su import no cambia. Gigantes >800
líneas: 13 → 12. typecheck/typecheck:tests/lint(0 err)/test(183) en verde.

## 2026-06-28 14:00 — Cantoral: pantalla amable para canciones con error de sintaxis

Antes, cuando una canción tenía un error de sintaxis en su ChordPro y no se
podía parsear, el visor mostraba un texto plano feo (`❌ Error preparando la
canción.`) en Times New Roman. Ahora:

- Se pinta una **pantalla de error con estilo** (centrada, emoji, colores de
  marca y modo oscuro) que dice _"Ay, mecachis · Hay un error procesando esta
  canción"_ y, en pequeñito, _"Hemos avisado a la gente maja que mantiene el
  cantoral para arreglarlo"_.
- Se muestra la **línea (y columna) del error** y se **pega el texto de la
  línea problemática** para localizarlo de un vistazo.
- El fallo se **reporta a Firebase** en la cola `songs/fallitos` (filename,
  categoría, título, mensaje, línea/columna, texto de la línea, plataforma y
  timestamp), una sola vez por canción+posición, para que quien mantiene el
  cantoral lo pueda arreglar.
- Archivos: `hooks/useSongProcessor.ts` (captura del error con
  línea/columna + `buildErrorHtml`, nuevo `songError` en el retorno),
  `app/screens/SongDetailScreen.tsx` (escritura a `songs/fallitos`).

## 2026-06-28 13:15 — Tests: useSongProcessor + Modo Coro (Fase 5)

Cobertura de dos piezas que estaban sin tests (PLAN_CALIDAD §5.1 y §5.2):

- **`__tests__/useSongProcessor.test.ts`** (17 tests): el núcleo del cantoral.
  Vía `renderHook`, comprueba el HTML generado — badges de tono/cejilla/
  transpose, notación EN/ES (`Notation = 'EN' | 'ES'`), clases del `<body>`
  (acordes ocultos, tema oscuro), cabecera de modo presentación y `styleState`.
  Se exporta `UseSongProcessorParams` para poder tipar el test.
- **`__tests__/choirSessionService.test.ts`** (16 tests): Modo Coro
  (maestro/oyentes). Validación de código, forma del payload + expiración a 2
  semanas, limpieza de `undefined` antes de escribir en RTDB, publicaciones del
  maestro, y traspaso de sesión entre códigos con sus casos de error.
- Ampliado `__mocks__/firebase.ts` con `set/update/remove/onValue/off`.

Total: 16→18 ficheros de test, 150→183 tests. Sin cambios de comportamiento.

## 2026-06-28 12:30 — Calidad: guardarraíles ESLint + typecheck de tests en CI

Remate de la Fase 0 de `docs/planes/PLAN_CALIDAD.md` (los planes estaban
desfasados: el logger central, la migración de `console.*` a 0, el CI, husky y
lint-staged ya estaban hechos). Cambios de esta pasada:

- **ESLint** (`eslint.config.js`): `no-console` sube de `warn` a `error` (la
  migración al logger está completa, 0 `console.*` en el código); añadido
  `max-lines: ['warn', { max: 400 }]` para señalar archivos grandes sin
  bloquear los legacy en CI (33 avisos, todos en gigantes ya conocidos).
- **Typecheck de tests** (Fase 4.2): nuevo `tsconfig.test.json` (extiende el
  base + incluye `__tests__`), script `npm run typecheck:tests`, y añadido como
  paso del workflow `ci.yml`. Antes los tests no se typecheckeaban.
- **Docs al día**: regla anti-gigantes (≤400 líneas archivo nuevo, extraer si
  > 600. y nota del logger en `CLAUDE.md`; conteo de tests corregido (16/150);
  > Fase 0 y 4.2 marcadas en `PLAN_CALIDAD.md`.

Sin cambios de comportamiento de la app (solo tooling/docs). Pendiente de la
Fase 0: activar `no-explicit-any: warn` cuando se limpien los 66 `: any`
(Fase 4.1), porque con `lint-staged --max-warnings=0` bloquearía commits que
toquen esos archivos.

## 2026-06-22 15:10 — Fix: Playlist "Orden ajustado" tapada por el header (iOS)

En iOS el header de la pantalla es transparente y las `FlatList` lo compensan
con `contentInsetAdjustmentBehavior="automatic"`, pero la `ReorderableList`
(modo «Orden ajustado», drag & drop) no respeta ese inset: su contenido
arrancaba bajo el header y al arrastrar la primera canción quedaba tapada.

- Se le da a la `ReorderableList` un `paddingTop` explícito igual a la altura
  del header (`useHeaderHeight`, solo iOS) y `contentInsetAdjustmentBehavior="never"`.
- No se toca el header ni las demás vistas (categoría / web siguen igual).
- Archivo: `app/screens/SelectedSongsScreen.tsx`.

## 2026-06-22 14:45 — Accesibilidad: cobertura de pantallas pendientes

Se añaden `accessibilityLabel`/`accessibilityRole` (y algún `accessibilityHint`)
en las pantallas/componentes que faltaban (OTA):

- Fotos: `AlbumCard` (label con título + lugar/fecha) y botón «Cargar Más» de
  `AlbumListScreen`.
- `MasHomeScreen`: tarjetas de navegación + enlace de feedback.
- `MaterialesScreen` y `ComidaScreen`: tarjetas de actividad/opción.
- `EventItem`: botones «Materiales» y «Ver en Maps».
- (Horario es de solo lectura, sin elementos interactivos.)

Pendiente: validación en dispositivo con VoiceOver/TalkBack.

## 2026-06-22 14:30 — Carismochito: onboarding, salir con confirmación

Ajustes de comportamiento del Modo Carismochito (OTA). Ver
`docs/planes/PLAN_CARISMOCHITO.md` §1 y §2.

- **Onboarding/explicación**: tras la cuenta atrás de activación (primera vez)
  se abre un modal de bienvenida que adelanta lo que vendrá (encontrar a
  Carismochito por la app, «próximamente coleccionarlos…») sin destriparlo.
  Persistido en `@carismochito_onboarding_seen`; reabrible desde el badge.
- **El badge ya no desactiva**: al tocarlo abre la explicación (antes salía
  del modo, poco intuitivo).
- **Salir con confirmación + más agitado**: para salir hay que dar un par de
  sacudidas fuertes (sin el semáforo de carga), que abren un diálogo
  «¿Salir del Modo Carismochito?». Sustituye al desactivado inmediato.
- Archivos: `contexts/CarismochitoContext.tsx`,
  `components/CarismochitoOverlay.tsx`, nuevo `components/CarismochitoDialogs.tsx`.

## 2026-06-22 13:45 — Menú contextual en la Playlist (web)

Modernización: `useContextMenu` también en la pantalla de Playlist
(`SelectedSongsScreen`).

- **Clic derecho en web** sobre una canción abre un `ContextMenuSheet` con
  acciones «Subir» / «Bajar» / «Quitar de la lista».
- Se limita a web a propósito: en nativo el long-press ya inicia el
  arrastre (drag & drop) de `react-native-reorderable-list`, así que un menú
  por long-press chocaría con el gesto. En nativo siguen disponibles drag,
  swipe-para-quitar y los botones ↑/↓.
- Archivos: `app/screens/SelectedSongsScreen.tsx`,
  `components/playlist/PlaylistRow.tsx`.

## 2026-06-22 13:30 — Menú contextual y borrado en Notificaciones

Modernización: se extiende `useContextMenu` a la pantalla de Notificaciones
(toda OTA).

- **Long-press / clic derecho** sobre una notificación abre un `ContextMenuSheet`
  con acciones «Marcar como leída» (si no leída) y «Eliminar».
- **Borrado de notificaciones**: nuevas funciones `dismissNotification` y
  `getDismissedNotificationKeys` en `pushNotificationService`. Las eliminadas se
  quitan del historial local y se registran (id + clave de contenido) como
  descartadas para que su equivalente de Firebase no reaparezca.
- Se extrae la fila a un componente `NotificationRow` (necesario para usar el
  hook por fila respetando las reglas de hooks).
- **Test nuevo**: `__tests__/dismissNotification.test.ts`.
- Archivos: `app/notifications.tsx`, `services/pushNotificationService.ts`,
  `__tests__/dismissNotification.test.ts`.

## 2026-06-22 13:00 — Logger centralizado y endurecimiento del lint

Tanda de calidad de código (toda OTA, sin código nativo).

- **Nuevo `utils/logger.ts`**: logger centralizado con niveles
  (`debug`/`info`/`log`/`warn`/`error`). En producción silencia
  `debug`/`info`/`log` y mantiene `warn`/`error`. Punto único de enganche para
  crash reporting vía `setReporter` (listo para Sentry, ver MEJORAS.md §8.1).
- **Migrados los ~119 `console.*`** de la base de código (45 ficheros de
  `app/`, `components/`, `hooks/`, `utils/`, `contexts/`, `services/`,
  `notifications/`) a `logger.*`.
- **ESLint más estricto**: `prettier/prettier` pasa de `warn` a `error` y se
  añade `no-console: warn` (excepto en `utils/logger.ts`).
- **Test nuevo**: `__tests__/logger.test.ts` (gating por entorno + reporter).
- Archivos: `utils/logger.ts`, `eslint.config.js`, `__tests__/logger.test.ts`
  y los 45 ficheros migrados.

## 2026-06-21 22:30 — UI nativa: headers, cápsulas glass y campos unificados

Pasada de unificación visual hacia componentes nativos/coherentes (toda OTA,
sin código nativo). Ver `docs/planes/PLAN_UI_NATIVA.md`.

- **Headers nativos**: Contigo (Oración, Evangelio, Favoritos, Revisión con su
  navegador de fechas como título, índice) pasan de "floating header" custom a
  header nativo de `native-stack`; back nativo (icono solo) con el efecto liquid
  glass de iOS 26.
- **Headers transparentes** (como el cantoral) en Calendario y Eventos Pasados
  (stack de "Más"): de barra opaca a transparente + glass del sistema en iOS.
- **Cantoral base** (`CategoriesScreen`): botones "sugerir"/"buscar" como bar
  items nativos. **Búsqueda nativa** (`headerSearchBarOptions`) en TODAS las
  categorías. **Calendario** envuelto en stack para tener header nativo.
- **Canción**: header nativo transparente heredado del stack + **letra a
  pantalla completa** (sin tarjeta, `SongDisplay` con `fullBleed`/`topInset`)
  para que la letra scrollee bajo el header. FAB con icono `+`→X correcto.
- **Componentes nuevos** (Fase 2): `GlassActionGroup` (cápsula glass segmentada,
  usada en Inicio), `AppIconButton` y `AppTextField` (input unificado; migrado
  SuggestSongModal).
- **EventHome**: campana de suscripción siempre en el hero (consistente entre
  Jubileo y Visita Papa); auto-suscripción opt-out al entrar.
- **Eventos**: back solo icono (sin "Atrás") y sin cápsula doble.
- **BottomSheet**: con teclado abierto, capa la altura y deja scrollear el
  contenido (antes empujaba la hoja fuera de pantalla).
- **LiturgicalBadge**: pill propio legible en oscuro; "Tiempo Ordinario" sin
  color.

## 2026-06-21 19:30 — iPad: layouts que aprovechan el ancho (OTA-safe)

Pasada de diseño para iPad (portrait y landscape). **Todo es JS puro
(OTA-safe).** Falta habilitar el landscape a nivel nativo (ver nota al final).

- **`PageContainer` ahora también limita el ancho en nativo**, no solo en web.
  Antes era no-op en iPad, así que en horizontal las 9 pantallas que lo usan
  (MasHome, Materiales, Profundiza, Reflexiones, Horario, Grupos, Contactos,
  Visitas, Apps) se estiraban de lado a lado. Ahora se centran en una columna
  legible (máx. 960). En móvil no cambia nada (su ancho está por debajo del
  límite). (`components/ui/PageContainer.tsx`)
- **`MasHomeScreen`: grid de 2 columnas en iPad** (portrait y landscape). Antes
  el grid solo se activaba en **web** (`isWeb && isMd`); en iPad nativo se veía
  una única columna estirada. El ancho de tarjeta usaba `calc()` (solo-web);
  ahora usa porcentaje, válido en nativo. (`app/screens/MasHomeScreen.tsx`)
- **`Calendario`: dos paneles en iPad landscape.** El mes va a la izquierda y los
  eventos del día seleccionado a la derecha (máx. 1000, centrado). En iPad
  portrait es una sola columna centrada (máx. 760) y en móvil, ancho completo
  (sin cambios). El switcher Mes/Agenda deja de estirarse en ancho.
  (`app/(tabs)/calendario.tsx`)
- **Home: accesos rápidos centrados en ancho.** En iPad el grid de accesos
  rápidos se agrupa centrado y envuelve en varias filas, en vez de separarse a
  los extremos. Móvil sin cambios. (`app/(tabs)/index.tsx`)
- **Fotos: 3 columnas en iPad landscape** (≥1024, incluye iPad 9 a 1080). En
  portrait/medianas siguen 2; en móvil, 1. (`app/(tabs)/fotos.tsx`)
- Ya estaban bien para tablet y no se han tocado: Cantoral
  (`CategoriesScreen`/`SongList`/`SelectedSongs`, grid por `useResponsiveLayout`)
  y el hub de eventos (`EventHomeScreen`, 3 col + ancho computado).
- **Pendiente (build de tienda):** habilitar el landscape de iPad a nivel nativo
  añadiendo `UISupportedInterfaceOrientations~ipad` en `ios.infoPlist` (iPhone
  seguiría en portrait). Es cambio nativo → no OTA; se hará en la próxima release
  de tienda. Hasta entonces estos layouts solo se ven en horizontal si el build
  instalado ya permite rotar.

## 2026-06-21 14:00 — Cantoral: búsqueda nativa en todas las categorías

- La búsqueda dentro de una categoría (`SongListScreen`) ahora usa la **barra de
  búsqueda nativa** de iOS/Android (`headerSearchBarOptions`), igual que el
  buscador general, en vez del input/toggle custom. En web se mantiene el input
  propio (native-stack no soporta la barra nativa en web).
- Badge litúrgico: "Tiempo Ordinario" se muestra sin color de fondo (solo texto
  legible en claro/oscuro). (cosmético)

## 2026-06-19 13:00 — Suscripción opt-in a notificaciones por evento

- **Nuevo**: el usuario puede **suscribirse a avisos de un evento concreto**
  (Jubileo, encuentros, retiros…) en lugar de que las notificaciones de evento
  lleguen a todos. Modelo **opt-in + auto-sugerir**: nadie recibe avisos hasta
  pulsar "Avisarme"; al abrir un evento por primera vez se ofrece suscribirse
  (una sola vez por evento).
- Cada suscripción añade el topic **`event-<eventId>`** al array `topics` de
  `/pushTokens/{id}`, que el MCM Panel usa para segmentar el envío. El cambio se
  escribe en Firebase al instante (no espera al heartbeat de 5 min).
- La segmentación por **perfil** (familia/monitor/miembro) y **delegación** ya
  estaba lista en el cliente vía `topics`/`profileType`/`delegationId`; lo que
  faltaba (filtrar al enviar) es trabajo del Panel. Aquí solo se añade la capa
  de eventos.
- **UI**: campana de suscripción en el hero de `EventHomeScreen` + tarjeta de
  auto-sugerencia.
- **Archivos**: `contexts/EventSubscriptionsContext.tsx` (nuevo),
  `app/screens/EventHomeScreen.tsx`, `notifications/usePushNotifications.ts`
  (merge de topics + escritura inmediata), `app/_layout.tsx` (provider).
- Contrato del Panel: ver §7.bis en
  `docs/contratos/NOTIFICACIONES_CONTRATO.md`.
- Todo JS puro → **compatible OTA** (sin build nativo).

## 2026-06-18 17:30 — Playlist: QR unificado, contador correcto y tono transportado real

- **Bug grave en el tono transportado**: `transposeKey` **siempre devolvía el
  tono original** sin transponer. Miraba `lines[0]` del ChordPro parseado, que
  es la línea de la directiva `{key:}` (el acorde queda en `lines[1]`), así que
  nunca encontraba el `ChordLyricsPair`. Resultado: una canción en La subida +5
  mostraba "La̶ → La +5" en vez de "La̶ Re". Ahora recorre todas las líneas
  hasta dar con el acorde. Además se normalizan las claves que llegan en
  mayúsculas ("Am" → "AM", "Bb" → "BB"), formas que ChordSheetJS no entendía y
  que rompían menores y bemoles. Afecta también al **PDF exportado** y al
  **texto de WhatsApp**, que usaban la misma función. (`utils/transposeKey.ts`,
  nuevo `__tests__/transposeKey.test.ts`).
- **Presentación del tono transportado**: ahora se muestra `La̶ Re (+5)` —tono
  destino prominente y el transporte pequeño entre paréntesis— en lugar de
  `La̶ → Re +5`. (`components/playlist/PlaylistRow.tsx`,
  `components/SongListItem.tsx`).
- **QR de la playlist unificado**: antes había dos opciones separadas ("Ver QR
  offline" y "Ver QR de la playlist"). Ahora es **un único botón** "Compartir QR
  de la playlist" que abre el modal con **dos pestañas** (con código / sin
  conexión). Si la playlist aún no está subida, la pestaña "con código" invita a
  subirla. (`app/screens/SelectedSongsScreen.tsx`,
  `components/playlist/ShareQrModal.tsx`).
- **Contador de canciones**: mostraba `selectedSongs.length`, pero la lista
  filtra canciones que no estén en el catálogo cargado → descuadres (p. ej. "13"
  con 12 filas). Ahora cuenta las realmente visibles (`flatSelectedSongs`), con
  fallback al total mientras carga el catálogo. Además `normalizeOrder` **elimina
  duplicados** por `filename` al importar/descargar, que inflaban el contador y
  rompían las keys de la lista. (`app/screens/SelectedSongsScreen.tsx`,
  `contexts/SelectedSongsContext.tsx`).
- **OTA-safe** (solo JS).

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

- **Nuevo**: opción "Ver QR offline" en el menú de la playlist (Seleccionadas). Genera un QR con la playlist **entera embebida** en un deep link `mcmapp://playlist?d=<payload>`. Un dispositivo con la app instalada y el cantoral cacheado puede escanearlo con la cámara normal y abrir la playlist **sin conexión a internet** (no descarga nada de Firebase, a diferencia del QR "en la nube" con código de 4 dígitos).
- **Codificación compacta**: cada canción se codifica como categoría (1 letra, alineada con `songUtils`) + número de canción + tono (`t±n` semitonos) y cejilla (`cN`) opcionales; el orden se deduce de la posición. Respaldo "crudo" por `filename` para canciones sin categoría/número conocidos. Así el QR es pequeño aunque haya muchas canciones. El receptor resuelve categoría+número → `filename` contra su catálogo cacheado; las canciones que no tenga se omiten avisando al usuario.
- **Toggle online/offline** dentro del `ShareQrModal`: si hay también código en la nube, se puede alternar entre los dos QR.
- Archivos: `utils/offlinePlaylist.ts` (nuevo, + test), `utils/pendingCloudPlaylist.ts`, `app/playlist.tsx`, `app/screens/CategoriesScreen.tsx`, `app/screens/SelectedSongsScreen.tsx`, `components/playlist/ShareQrModal.tsx`. Sin dependencias nuevas ni código nativo (OTA normal).

## 2026-06-13 — Fix: la selección de calendarios se perdía al reabrir la app

- **Bug**: la visibilidad de calendarios se guardaba como array **por índice** (`boolean[]`) y se reconciliaba contra el `fallbackConfigs` (1 solo calendario) durante el instante en que Firebase aún cargaba. Eso truncaba el array guardado a longitud 1, lo persistía, y al llegar los datos reales rellenaba con los defaults — perdiendo la selección del usuario.
- **Fix**: la selección ahora se persiste **por ID de calendario** (`{ [id]: boolean }`) en AsyncStorage. Sobrevive a reordenamientos, altas/bajas de calendarios y al fallback transitorio. Migración one-shot del formato antiguo por índice. Archivo: `hooks/useCalendarConfigs.ts`.

## 2026-06-13 — Fix de ubicaciones y descripciones en detalle de evento

- **Ubicaciones del calendario**: el parser ICS ahora desescapa `\,`, `\;` y `\\` en el campo `LOCATION` (antes salía "Plaza de la M Molas\, 1 Madrid\, España" con las barras visibles). Archivo: `hooks/useCalendarEvents.ts`.
- **Descripciones con HTML**: las descripciones de Google Calendar pueden llegar como HTML (`<br>`, `<b>`, `&amp;`, …). El bottom sheet ahora normaliza el HTML a texto plano con saltos de línea, runs en negrita y entidades decodificadas, en lugar de mostrar las etiquetas en crudo. Archivo: `components/EventDetailsBottomSheet.tsx`.

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

---

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

---

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

---

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

---

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

---

## 2026-06-09 — Menú de acciones de la playlist reorganizado por secciones

- El bottom-sheet de acciones de la playlist (`PlaylistActionsBottomSheet`)
  pasa de una lista plana (~12 items con separadores sueltos) a **secciones con
  cabecera**: Exportar y compartir · Playlist en la nube · Archivo · Modo coro ·
  zona de peligro (Vaciar) al final. API del componente: prop `sections`
  (`PlaylistActionSection[]`) en lugar de `actions`.
- Etiquetas más cortas al apoyarse en la cabecera de sección ("Subir playlist
  (compartir código)", "Exportar archivo (.mcm)"…).

---

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

---

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

---

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

---

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

---

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

---

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

---

## 2026-06-06 — Fix layout de Materiales

- **Materiales · tarjetas empujadas abajo / hueco enorme**: el `DateSelector`
  (un `FlatList` horizontal) iba suelto como hijo directo del contenedor flex en
  columna, así que crecía en vertical y empujaba el `ScrollView` de tarjetas al
  fondo (cortándolas). Se envuelve en una `View` (mismo patrón que
  `HorarioScreen`) para limitarlo a su altura natural. Archivo:
  `app/screens/MaterialesScreen.tsx`.

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

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

---

## 2026-06-03 — Fix: login con Google roto en nativo tras OTA

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

---

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

---

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

---

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

## 2026-05-29 — UI fixes: onboarding, eventos (Liquid Glass), modo oscuro login

- **Onboarding — paso de login como pantalla final/resumen** (`app/onboarding.tsx`): para perfiles con login (monitor/miembro), al iniciar sesión la pantalla de login pasa a ser el último paso y muestra el resumen (perfil + delegación) con el botón "Ir a la app" centrado verticalmente; ya no hay pantalla `success` extra en ese flujo. Quien continúa sin cuenta sigue viendo la pantalla de resumen `success`.
- **Onboarding — indicador de pasos**: el indicador de puntos (`ProgressDots`) ahora aparece en perfil, delegación y login, con un total dinámico según el perfil elegido (otros → 1, familia → 2, monitor/miembro → 3).
- **Eventos — Liquid Glass en sub-pantallas** (`app/screens/eventStackScreens.tsx`, `components/EventActionButtons.tsx`, `app/(tabs)/visitapapa.tsx`, `app/(tabs)/mas.tsx`): las sub-pantallas con `ScreenHero` (Horario, Materiales, Visitas, Profundiza, Grupos, Contactos, Apps) ocultan el título duplicado del header (queda solo la barra glass + volver). Las acciones de Ajustes y Compartiendo salen del header y se muestran como FAB glass flotantes (`EventActionButtons`) que el tab renderiza por encima del navigator.
- **Modo oscuro del login** (`components/SocialLoginSection.tsx`): el botón de Google ya no usa texto oscuro fijo (era ilegible sobre tarjeta oscura); colores de texto/borde adaptados al esquema oscuro.

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

## 2026-05-25 — Arreglo de navegación en tabs Más y Cantoral (Restauración)

- **Bug fix**: Se restauró la lógica de navegación para volver a la pantalla inicial (`popToTop`) al pulsar la pestaña "Más" o "Cantoral" si ya se está en ella, usando el listener `tabPress` sobre el navigator padre (`useNavigation().getParent()`).
- Archivos: `app/(tabs)/mas.tsx`, `app/(tabs)/cancionero.tsx`

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

---

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

## 2026-05-03 — Onboarding · rediseño visual

- Rediseño completo de `app/onboarding.tsx` siguiendo el prototipo de Claude Design (4 pantallas: bienvenida, perfil, delegación, confirmación).
- Pantalla de bienvenida nueva con logo MCM, ripples animados, shimmer en CTA y fondo `primary`.
- Animaciones con `react-native-reanimated`: slide-in/out entre pasos, fade-up con stagger en cards, ripple infinito, shimmer en botón "Comenzar".
- Pantalla de éxito nueva con check animado y resumen del perfil/delegación elegidos.
- Lógica de datos sin cambios: sigue leyendo `rawConfig.profiles`/`rawConfig.delegationList` desde `ProfileConfigContext` y persiste con `useUserProfile().setProfile`.
