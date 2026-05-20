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
