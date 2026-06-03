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

- **Header de sub-pantallas iOS rediseñado** (`app/screens/eventStackScreens.tsx`,
  `components/ui/GlassBackButton.{ios,}.tsx`): en iOS desaparece la barra de color
  plana; el header es transparente y el botón "Atrás" pasa a ser un pill
  liquid-glass flotante (`GlassBackButton`). El título grande del contenido
  (`ScreenHero`) queda justo debajo, muy pegado. Android/Web mantienen la barra
  de color con el botón de retroceso nativo. Se corrige el doble safe-area top
  (hueco blanco) en `HorarioScreen` quitando el `SafeAreaView` redundante.
- **Hub del evento con hero** (`app/screens/EventHomeScreen.tsx`): nuevo hero con
  degradado del color del evento (emblema + título + subtítulo) que rellena el
  espacio superior, lema **"Alzad la mirada"** al pie, y se elimina el hueco
  blanco superior (el header nativo se oculta cuando el hub es raíz de la tab y
  solo aparece, con botón Atrás flotante, al abrirlo desde "Más"). El emblema es
  un placeholder fácil de sustituir por el logo del encuentro.
- **Estados vacíos "Próximamente"** (`components/ui/ComingSoon.tsx` + Horario,
  Materiales, Visitas, Profundiza, Grupos, Contactos, Apps): cuando una sección
  no tiene datos en Firebase (o llegan vacíos/mal formados) se muestra un estado
  vacío elegante en vez de un esqueleto infinito. **Fix de crash en
  `ProfundizaScreen`** (`data.paginas.map` reventaba si faltaba `paginas`).
- **Acciones de evento como botones glass arriba a la derecha**
  (`components/EventActionButtons.tsx`, `components/ui/GlassIconButton.tsx`):
  los FAB de Ajustes y Compartiendo dejan de estar abajo-derecha apilados y
  pasan a ser dos botones liquid-glass flotantes arriba a la derecha, alineados
  con la fila del header.
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

=======

> > > > > > > mcmespana/claude/onboarding-fullscreen-layout-Vn7UE

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
