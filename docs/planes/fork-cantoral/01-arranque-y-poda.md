# 01 · Fase 0 — Crear el fork, identidad nueva y poda

> Parte del plan [`README.md`](README.md). Objetivo de la fase: **una app que
> solo tiene el cantoral, con su propio nombre e identificadores, en la raíz
> de un repo limpio, que compila, pasa los tests y se puede subir a
> TestFlight y a la prueba interna de Google Play** — con las pantallas de
> hoy, sin pestañas. El rediseño viene después (Fase 2). Rutas relativas a
> `mcm-app/` de MCM App salvo que se diga otra cosa (en el fork, al final de
> esta fase, `mcm-app/` desaparece y todo vive en la raíz: D-04).
> Datos del mapa de código hecho el 21/11/2026 sobre `main` (`257f5f4`).

---

## 0. Antes de empezar (lo hace el usuario)

1. **Crear el repo `mcmespana/mcmcantoral`** (nombre decidido, A-03).
   GitHub normalmente **no deja forkear un repo dentro del mismo
   propietario** (`mcmespana` → `mcmespana`). Si no deja, se crea el repo
   vacío y se empuja la historia de `mcmapp` para que la comparta (así
   `diff` y los parches con upstream funcionan):

   ```bash
   git clone --bare https://github.com/mcmespana/mcmapp mcmapp.git
   cd mcmapp.git && git push --mirror https://github.com/mcmespana/mcmcantoral
   ```

   (o solo `main`: `git push https://github.com/mcmespana/mcmcantoral main`).
2. Añadir el repo a la sesión de Claude (con permiso de escritura).
3. Tener a mano: cuenta de Expo (la misma), Apple Developer (equipo
   `5P53S6QB23`) y Google Play Console (de organización, A-02).

## 1. Lo que se queda y lo que se va (resumen del mapa)

- La app tiene **905 ficheros y ~169.500 líneas** (sin tests). El cantoral
  usa **~9.500 líneas de pantallas, ~30.000 de librerías propias y ~80
  ficheros de infraestructura compartida**: ~¼ de la app.
- **Se va**: Comunica (~57k líneas + 87 tests), Contigo (~14k), Pañuelo
  (~13k, incluido `panuelo-3d/`), eventos/Más/visitapapa (~10k),
  calendario, fotos, Inicio, encuestas, notificaciones, perfiles/onboarding/
  login, Carismochito, medallas, Wordle, Laboratorio Alpha, la barra de
  pestañas. Fuera de `mcm-app/`: `portadas-albumes/`, `medallas-3d/`,
  `piezas-3d/`, `scraper-lecturas/`, `_para-borrar/`.
- **Se queda** (D-14: **todos** los satélites): todo `cancionero/`
  (categorías, lista, canción, pantalla completa, selección, domingo,
  lecturas del domingo, lo cantado por el coro, sugerir/fallitos, PDF,
  afinador+metrónomo, onboarding, editor, ordenar), los
  puentes `app/cancion.tsx`, `app/coro.tsx`, `app/playlist.tsx`, coros y
  playlists en la nube, etiquetas, multimedia, onboarding del cantoral,
  `components/ui/` y la infraestructura (OTA, splash, toasts, ajustes,
  Firebase, logger, haptics, analítica).
- **Ojo con no borrar por error** `react-native-audio-api` (afinador y
  metrónomo), `expo-camera` (QR), `react-native-webview` (la hoja),
  `chordsheetjs` + `mock-jspdf.js`, `esbuild` (bundle de la hoja) y
  `expo-keep-awake` (se usa pero no está declarado: declararlo).

## 2. Pasos, en orden (cada uno un commit con los tests en verde)

### 2.1 Identidad nueva

| Qué | Hoy (MCM App) | Fork (propuesta, D-03) |
| --- | ------------- | ---------------------- |
| Nombre | MCM App | **MCM Cantoral** |
| `slug` / `scheme` | `mcm-app` / `mcmapp` | `mcm-cantoral` / `mcmcantoral` |
| iOS bundle id | `com.familiaconsolacion.mcmapp` | `com.familiaconsolacion.mcmcantoral` |
| Android package | `com.mcmespana.mcmapp` | `com.mcmespana.mcmcantoral` |
| EAS project | `aa9f2d3a-…` | **nuevo** (`eas init`), y su `updates.url` |
| `ascAppId` (eas.json) | `6753905393` | el de la app nueva en App Store Connect |
| Versión / runtime | 2.5.1 | **1.0.0** |
| Web | `mcm.expo.app` | dominio propio (D-13), p. ej. `mcm-cantoral.expo.app` |
| Universal links | `applinks:mcm.expo.app` (`/playlist`, `/coro`) | los del dominio nuevo |
| Tipo de fichero `.mcm` | UTI `com.mcmespana.mcmapp.playlist` (dueña) | UTI propia como dueña **y** la de MCM App como *importada*: las dos apps abren los `.mcm` de la otra sin chocar |
| Sentry / Aptabase | proyecto de MCM App | **instalados y apagados** (sin claves) hasta la Fase 5 (D-15: «segunda fase»); se encienden con una variable, sin build |
| Red local | — | `NSLocalNetworkUsageDescription`, `NSBonjourServices: ["_mcmcantoral._tcp"]`; Android según targetSdk (`04` §5.4) |

Ficheros: `app.json`, `app.config.ts`, `eas.json`, `utils/storeLinks.ts`,
`SelectedSongsScreen.tsx` (`WEB_BASE_URL`, `APP_SCHEME`, UTI en la línea
~532), `ChoirSessionBanner.tsx:55,170`, `utils/qrScan.ts` (que **siga
reconociendo** los enlaces y QR de `mcm.expo.app` además de los nuevos),
`+html.tsx`, `public/manifest.json`, `public/icons/*`,
`utils/documentTitle.ts`, `assets/images/*` (icono provisional hasta D-06).
Textos de permisos reescritos: micrófono (afinador), cámara (QR; hoy habla
de «área privada»), fotos (editor).

**Mantenimiento y versión mínima**: hoy salen de
`/profileConfig/data/global`. Si el fork lo leyera, la `minAppVersion` de
MCM App (2.5.x) **bloquearía** a MCM Cantoral 1.0. Se mueven a
`songs/cantoralConfig.data.{maintenance, minAppVersion}` (ver `02` §7).

### 2.2 Shell sin pestañas

1. `app/(tabs)/_layout.tsx` → `<Stack screenOptions={{ headerShown: false }} />`
   y `app/index.tsx` que redirige `/` → `/cancionero`. Se conservan las rutas
   `/cancionero/*` (enlaces, `CANTORAL_BASE`, tests).
2. Quitar `useTabReselect` de `cancionero/_layout.tsx`, `useForceCompact`
   de `SongDetail`, y cambiar `useTabListScroll('cancionero')` (Categorías,
   Lista, Domingo) por un ref y el margen del área segura.
3. `hooks/useTabBarClearance.ts` → `insets.bottom + extra` (arregla de una
   vez `SongControls`, `FloatingMediaPlayer`, `MetronomeFloating`,
   `KeepMetronomePrompt` y la selección).
4. `utils/documentTitle.ts` sin `TABS_CONFIG`.
5. Borrar `components/tabs/`, `constants/tabsCatalog.ts`, `tabIcons.ts`,
   `assets/tab-icons/`, `utils/tabRoutes.ts`, `tabNavigation.ts`,
   `useTabNavigation`, `useVisibleTabs`, `HapticTab`,
   `scripts/generate-tab-icons.js`, `expo-native-compact-tabs` y su parche.

### 2.3 Providers y arranque

En `components/AppProviders.tsx` se quedan: `HeroUINativeProvider`,
`AppToastProvider`, `OverlayStackProvider`, `AppSettingsProvider` (+
`UniwindThemeBridge`), `SelectedSongsProvider`, `ChoirSessionProvider`,
`OTAProvider` (sin `settleSession` de Comunica ni `PreviewChannelProvider`:
OTA lista al momento) y un `VersionGate` que lea `cantoralConfig`. Se van:
`ProfileConfigProvider`, `UserProfileProvider`, `EventSubscriptions`,
`Notifications`, `CalendarConfig`, `PreviewChannel`, `Carismochito*`,
`ActiveEvent`. `AuthProvider` se va también (el editor vuelve con el admin por código,
ver `06`: al final de la Fase 4 si da tiempo).

En `InnerLayout`: fuera la redirección a onboarding, `usePushNotifications`,
`updateUserMCMData`, `CarismochitoOverlay`, `ComunicaBackground`,
`ContigoRemindersBackground`, `PreviewChannelModal`. El error de
configuración de Firebase sale de `getFirebaseApp()`, no de `useAuth()`.
Se quedan `useIncomingPlaylist`, `useScreenTracking` (sin perfil),
`useDocumentTitle`, `useStatusBarTheme`, el service worker web,
`AddToHomeBanner` y `CommandPalette` (⌘K web, solo comandos del cantoral).
`app/+native-intent.ts`: solo la rama `file://`/`content://` → cantoral.

### 2.4 Cortar los enganches del cantoral con lo que se borra

| Enganche | Arreglo |
| -------- | ------- |
| `useSuppressCarismochito` en SongDetail y Fullscreen | Quitar la llamada |
| `useAdminStatus` → `AuthContext` → `authHelpers` (Contigo, Pañuelo…) | `useAdminStatus` devuelve `false` hasta el admin por código (`06`, final de la Fase 4 si da tiempo); el editor y «Ordenar» se esconden mientras |
| `songEditorService.ts:89` usa `getIdToken()` | Igual: vuelve con el admin por código |
| `ReportBugsModal`, `SuggestSongModal`, `ChoirStep`, `usePlaylistSharing` leen `useUserProfile().profile.name` (y perfil/delegación) | Un **nombre local** opcional en Ajustes («¿Cómo te llamas en el coro?»); sin perfil ni delegación |
| `utils/qrScan.ts` importa `isTradeCode` de `panueloTrade` | Quitar esa rama |
| `constants/analyticsEvents.ts` → `types/notifications.ts` | Quitar los tipos de notificaciones |
| `useDailyReadings` lee `seccion_oracion/lecturas/<fecha>` y `@contigo_bookmarks` | Se queda la lectura del nodo si D-14 mantiene «Lecturas del domingo»; fuera lo de marcadores |
| `SuggestSongModal` escribe `songs/updatedAt` | **Quitar** (bug, ver `02` §1) |

### 2.5 Borrar las áreas

Por áreas, un commit por área, en este orden (de menos a más enganchada):
Wordle → medallas → Carismochito → Pañuelo → fotos → calendario
(`functions/` se borra: la función del admin irá en su propio *codebase*,
ver §2.9) →
encuestas → eventos/Más/visitapapa → Contigo (+ `modules/highlight-menu`) →
Comunica → notificaciones (+ `plugins/`, `targets/`, la extensión del
proceso de notificaciones en `eas.json`) → perfiles/onboarding/login → Inicio
→ Laboratorio Alpha. Con cada área, sus tests y sus mocks de
`jest.setup.js`.

Código ya muerto que se borra de paso: `components/ThemedView.tsx`,
`components/ui/TabScreenWrapper.tsx`, `hooks/comunica/useHomePrefs.ts`,
`hooks/useCurrentTabColor.ts`, `utils/contigoWidgetPayload.ts`.

### 2.6 Dependencias fuera

`expo-native-compact-tabs`, `expo-notifications`, `@react-native-google-signin/google-signin`,
`expo-apple-authentication`, `expo-secure-store`, `expo-sqlite`,
`expo-local-authentication`, `react-native-nfc-manager`,
`expo-alternate-app-icons`, `expo-sensors`, `expo-intent-launcher`,
`@gorhom/bottom-sheet`, `expo-gl`, `expo-image`, `react-native-calendars`
(y su bloque `overrides`), `react-native-confetti-cannon`,
`react-native-render-html`, `@tanstack/react-query`, `zod`,
`@react-native-community/datetimepicker`; dev: `three`, `@types/three`,
`opentype.js`. (`expo-insights`/`expo-observe` no se importan: fuera.)

`app.json`: fuera el dominio de Comunica, `usesAppleSignIn`,
`LSApplicationQueriesSchemes: webcal`, `NSLocationWhenInUseUsageDescription`,
los plugins de lo borrado, la extensión de notificaciones,
`blockedPermissions` de ACTIVITY_RECOGNITION y `googleServicesFile`.
`eas.json`: fuera `EXPO_PUBLIC_COMUNICA_API`, el perfil
`production-comunica-falso` y los client IDs de Google.

### 2.7 Tests y trinquetes

- Se borran con su área los tests de lo borrado (incluidos los de la barra
  de pestañas: `CompactTabBar`, `collapseRule`, `splitTabsForBar`,
  `tabBarSelection`, `tabBarClearance`, `tabNavigation*`, `useTabNavigation`,
  `useVisibleTabs`, `transparentHeader`, `tabsLayoutWebSafety`,
  `router/tabsHaveOwnStack`, `tabsMountWithRouter`, `tabSwitchKeepsStack`,
  `tabReselect`, `inicioGroupRoute`).
- Se editan: `screenSmoke` (solo pantallas del cantoral), `largeText`,
  `settingsContexts`, `useAdminStatus`, `routeFoldersWalk`, `designTokens`
  (importa `contigo/theme` y `notificationCategory`).
- ⚠️ **Los trinquetes fallan al borrar mucho**: `noNewMagicNumbers` tiene
  también **cota inferior** (hex, fontSize, borderRadius) y `noLooseMotion`
  igual. **Se bajan los topes en el mismo commit** que cada borrado.
- Se mantienen los 59 tests del cantoral y los ~49 compartidos.

### 2.8 La app a la raíz y limpieza (D-04: «limpia, que hay mucha mierda»)

Al final de la poda, cuando ya solo queda el cantoral:

1. **Un commit que solo mueve** (`git mv mcm-app/* .` y los ocultos): así
   git ve renombres al 100 % y se conserva la historia de cada fichero.
   Nada más en ese commit.
2. Fusionar el `package.json` de la raíz del monorepo (husky, lint-staged,
   prettier) en el de la app y borrar el de la raíz y su `package-lock.json`.
   `lint-staged` con rutas sin `mcm-app/`.
3. **Fuera del repo**: `_para-borrar/`, `medallas-3d/`, `piezas-3d/`,
   `portadas-albumes/`, `scraper-lecturas/` (el scraper sigue en `mcmapp`;
   el fork solo lee lo que publica), `panuelo-3d/`, `firebase-seed/`,
   `notifications/`, `targets/`, `plugins/`, `modules/highlight-menu/`,
   `styles/`, `AGENTS.md` (su contenido va al `CLAUDE.md`), `TODO.md` viejo
   (uno nuevo, vacío), `database.rules.json`, `.firebaserc` y `firebase.json`
   (§2.9), `.vscode/` si no aporta.
4. Workflows sin `working-directory: mcm-app` (§2.9).
5. `scripts/`: solo los del cantoral (`build-sheet-bundle.js`, el nuevo
   `snapshot-cantoral.mjs`, iconos de la app, los de portar de
   `DIVERGENCIAS.md`).
6. `.gitattributes`, `.gitignore`, `.easignore`, `.prettierignore`
   repasados para la estructura nueva.
7. Comprobar con `git ls-files | wc -l` y `du -sh` que el repo ha
   adelgazado de verdad, y `npm ci && npm test` desde cero.

Portar entre los dos repos con rutas distintas está resuelto en
`DIVERGENCIAS.md` §4 (`git format-patch --relative=mcm-app` para traer y
`git am --directory=mcm-app` para llevar).

### 2.8 bis Documentos del fork

- `CLAUDE.md` **único y corto** en la raíz: qué es MCM Cantoral, comandos,
  OTA, la zona espejo, y «lee `docs/DIVERGENCIAS.md` y `design.md`». Fuera
  todo lo de Comunica/Contigo/perfiles.
- `design.md` del fork: provisional (las reglas de mecánica de MCM App sin
  territorios) hasta la Fase 2.
- `docs/DIVERGENCIAS.md` desde la plantilla, con el sha de origen.
- `docs/planes/`: este plan entero (copiado de `mcmapp`), y fuera los
  planes de MCM App.
- `docs/funcionalidades/`: solo COROS, HOJA_CANCION, ARREGLOS, ETIQUETAS,
  AFINADOR, EDITOR_CANCIONES, ENLACES_CANCION, CANTOS_DOMINGO.
- `CHANGELOG.md` nuevo, primera entrada «Nace MCM Cantoral desde
  mcmapp@<sha>».
- `.agents/skills/` y `skills-lock.json` en la raíz, con las skills nuevas
  (`03` §8).

### 2.9 CI y despliegues

- Workflows: `deploy-web` (EAS Hosting al dominio nuevo), `ota-preview`,
  `ota-production`, `eas-build`, `verify` y `pr`, con el proyecto EAS nuevo.
  Mismo ritmo `main → preview → production` que MCM App (lo dirá el
  `CLAUDE.md` del fork). **Fuera** `deploy-firebase-rules.yml` y
  `scraper-lecturas.yml`.
- **Las reglas de Firebase son de `mcmapp`**: la base de datos es la misma y
  dos repos desplegando reglas se pisarían. Si el fork necesita una regla
  nueva, se añade en `mcmapp/mcm-app/database.rules.json`.
- **Cloud Functions**: el fork solo tendrá la del admin (`06`). Va en
  `functions/` con `"codebase": "cantoral"` en su `firebase.json`, para que
  desplegarla **nunca borre** las funciones de MCM App (un `firebase deploy`
  sin codebase borra lo que no está en su carpeta).
- Secretos: las `EXPO_PUBLIC_FIREBASE_*` son las mismas (misma base de
  datos, SDK web: **no hace falta registrar apps nuevas en Firebase**);
  Sentry nuevo.
- Antes de cada build y OTA: `snapshot-cantoral.mjs` (semilla, ver `02`).

### 2.10 Spikes (el primer día, antes de podar)

- **Wifi local (crítico, D-07)**: en una build de desarrollo de SDK 58, con
  un iPhone y un Android en la misma wifi: `react-native-tcp-socket`
  sirviendo y conectando, `react-native-zeroconf` anunciando y descubriendo,
  1.000 mensajes de ida y vuelta, y bloquear/desbloquear para ver la
  reconexión. **Si falla, se decide ese mismo día el módulo propio** (`04`
  §5.1). Es lo único del plan que podría no tener solución con librerías.
- ¿`Stack.Toolbar` de expo-router 58 admite la barra **inferior** en iOS?
- ¿Qué componentes de `@expo/ui` (SwiftUI/Compose) hay en SDK 58 para la
  barra inferior de Android y los menús?
- `react-native-volume-manager` y `expo-key-event` instalan y responden.
- Instalar las skills de diseño (`03` §8) y comprobar que cargan.

## 3. Cómo se da por terminada la Fase 0

- [ ] `npx tsc --noEmit && npm run lint && npm test` en verde.
- [ ] La app arranca en iOS, Android y web directamente en el cantoral, sin
      pestañas, y hace lo mismo que el cantoral de MCM App (salvo editor).
- [ ] Un móvil con MCM Cantoral y otro con MCM App: importar una playlist del
      otro por QR y seguir un coro en vivo **en los dos sentidos**.
- [ ] `grep` de `comunica|contigo|panuelo|carismochito|notification` en el
      repo sin resultados fuera de comentarios de historia.
- [ ] La app vive en la raíz, sin `mcm-app/`, y el repo ha perdido las
      carpetas de §2.8.
- [ ] Spike de wifi local hecho y la librería (o el módulo propio)
      decidida.
- [ ] Build de desarrollo en un iPhone y un Android de verdad.
- [ ] **Build subida a TestFlight y a prueba interna de Google Play** con el
      nombre nuevo (arranca la burocracia de las tiendas cuanto antes; ver
      `07`).

Modelo: **Opus** para 2.1-2.4 (decisiones finas); **Sonnet** para 2.5-2.7
(borrado mecánico con los tests como red). Estimación: 1-2 sesiones.
