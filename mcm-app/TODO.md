# TODO — MCM App · Checklist de mantenimiento y mejoras

> Lista de tareas pendientes para mantener y mejorar la app.
> Agentes IA: consultad esta lista antes de trabajar. Al terminar una tarea,
> **eliminadla de aquí** y documentad el cambio en `CHANGELOG.md` (las tareas
> completadas no se acumulan en este archivo).
>
> Para saber **en qué orden** abordar los planes grandes (Calidad, UI Nativa,
> Integraciones, Carismochito, Widget…) y qué decisiones están pendientes de
> confirmación, ver `docs/planes/BACKLOG.md` — esta lista es el detalle de
> tareas sueltas, no el orden global.

---

## Prioridad alta

> Orden propuesto (repriorízalo si no lo ves).

### 1. Sacar la build de tienda de agosto

- [ ] **Todo el paso a paso está en `docs/desarrollo/BUILD_AGOSTO_2026.md`**
      (con una tabla de estado arriba: Sentry y Aptabase ✅ el 2026-10-08) —
      qué variables configurar y dónde, el checklist de pruebas completo y el
      orden de publicación. No se duplica aquí para que no haya dos listas que
      se contradigan.
- [ ] **Huellas SHA-1 de Android en Firebase** (§2.6 de ese documento) — el
      login con Google en Android ya está en el código, pero sin registrar la
      huella del keystore de EAS **y** la de Play App Signing, el botón falla
      con `DEVELOPER_ERROR`. Son dos momentos: la primera antes del build de
      desarrollo, la segunda después de subir el AAB a la Play Console. Detalle
      y diagnóstico en `docs/funcionalidades/LOGIN.md`.

Es lo que desbloquea el resto: `main` ya lleva SDK 57, barra flotante,
Reanimated 4, NSE de iOS, Sentry, analítica, icono de Carismochito y subrayado
nativo (entró en la #313 el 2026-08-04). Todo NATIVO, nada sale por OTA.

### 2. React Compiler y headers — solo lo que sigue abierto

- [ ] **Cuando `useEffectEvent` deje de ser experimental**, migrar de golpe la
      categoría `react-hooks/refs` (18 warnings; cuenta y reparto en
      [`docs/desarrollo/WARNINGS.md`](../docs/desarrollo/WARNINGS.md), que es la
      única referencia: no mantengas aquí una segunda lista). Y solo DESPUÉS,
      subir `react-hooks/refs` a `error`: hoy obligaría a poner 18
      `eslint-disable` que solo añaden ruido.
- [ ] **Headers (dispositivo)**: en Fotos y Calendario, que ahora no tienen
      barra opaca, comprobar que el contenido no queda pegado a la barra de
      estado ni le falta respiro arriba.

### 3. Varios de prioridad alta

- [ ] **Revisar las 4 dependencias que se quedaron atrás** (2026-08-01). No se
      subieron por incompatibilidad REAL comprobada, no por prudencia — hay que
      esperar a que el ecosistema se mueva. Ninguna afecta al binario que
      instalan los usuarios: - `eslint` 9 → 10: rompe el `eslint-plugin-react` que trae
      `eslint-config-expo` (`contextOrFilename.getFilename is not a function`).
      Reintentar cuando salga `eslint-config-expo` con soporte de ESLint 10. - `jest` 29 → 30 (+ `@types/jest` 30): `jest-expo` 57 está construido
      contra jest 29; mezclarlos rompe el runtime entero
      (`_moduleMocker.clearMocksOnScope is not a function`). Va atado al SDK. - `typescript` 6 → 7, `@babel/core` 7 → 8: los fija Expo, no se tocan a
      mano. Entrarán con el SDK 58.
- [ ] **Majors pendientes que no fija Expo**: Sentry 8, Firebase 13,
      chordsheetjs 18 (el parser del cantoral) y Aptabase 0.6. Cada una con su
      changelog y sus pruebas; ninguna corre prisa.
- [ ] **PDF — número de página y pie por canción**: parcial. Hecho: pie con nombre de playlist + "Página N" vía margin boxes de `@page` (funciona en web Chrome ≥131 y Android; iOS/WebKit no los soporta → validar y, si se quiere también en iOS, haría falta paginación JS). Pendiente: el "1 de 3" por canción multipágina — no viable con CSS de impresión, requeriría paginar por JS midiendo alturas.
- [ ] **Contigo — pulido pendiente tras la pasada del 2026-10-03.** Hecho:
      navegación por días/meses de la oración y el submenú de días de la home.
      Queda: el tiempo de oración (el usuario pide **propuestas**, no cambios
      directos), ~~los tres navegadores de fecha distintos~~ (✅ unificados en
      `DateNavigator` el 2026-10-08) y repasar en dispositivo el evangelio,
      que en web sin datos se queda en «Preparando la Palabra…».
- [ ] **Command Palette v2: deep-link a contenidos** — el palette actual (`CommandPalette.tsx`) solo navega a tabs/pantallas top-level. Para saltar a una canción concreta o a un punto dentro de los stacks anidados hay que exponer un `navigation ref` (p.ej. `CancioneroNavRefContext`). Después indexar canciones (`songs/data`), reflexiones (`compartiendo/data`) y eventos del calendario.

---

## UI nativa — pendientes (Fase 1/2 de `docs/planes/PLAN_UI_NATIVA.md`)

> Hecho en la pasada del 2026-06-21 (ver CHANGELOG): headers nativos de Contigo,
> headers transparentes en Calendario/Eventos Pasados, búsqueda nativa en todas
> las categorías, canción con letra full-bleed, `GlassActionGroup`/
> `AppTextField`. Pendiente de la review de componentes:

- [ ] **Pulido del glass (iOS 26) — fino, con dispositivo delante**: botones del
      header de la canción "justos" dentro de la cápsula, seam/línea del header
      sobre letra blanca, y acercar el glass al bar item nativo. Difícil a
      ciegas. (`GlassSurface.ios.tsx`)
- [ ] **Headers de evento (hub + sub-pantallas) transparentes** como el cantoral:
      hoy usan el "floating header" opaco (`eventScreenOptions` con
      `FloatingHeaderBackground`). Unificar al glass del sistema — cambio mayor,
      revisar el inset de cada hero. (`app/screens/eventStackScreens.tsx`)
- **Fase 2 (componentes unificados): cerrada (2026-08-03).**

  **Los `TextInput` que quedan NO se migran, y está decidido**: los
  buscadores del cantoral y de Grupos son otro patrón (icono dentro, botón
  de limpiar); el de `CodeInputModal` es un input INVISIBLE detrás de las
  celdas del código; y los de Revisión quedaron, tras el refactor del examen
  del día, como campos SIN borde dentro de una fila que sí lo tiene —
  `AppTextField` les metería un borde dentro de otro.

## Modo Carismochito (ver `docs/funcionalidades/CARISMOCHITO.md`)

> Hecho (jun-2026, ver CHANGELOG): confirmar antes de desactivar + salir con un
> par de sacudidas fuertes (sin semáforo), el badge ahora abre la explicación, y
> onboarding persistido con teaser de futuro.

- [ ] **Sacar la caza del laboratorio** cuando el usuario lo decida
      (`docs/planes/BACKLOG.md` §4).
- [ ] **Widgets de Contigo — los TRES** (ampliado el 2026-09-19, ver
      `docs/planes/PLAN_WIDGET_CONTIGO.md`): (1) los 3 hábitos diarios
      (Evangelio/Oración/Revisión) con marca y deep-link; (2) **la racha**, con
      un estado visual distinto por tramo (0 / 1-2 / 3-6 / 7+ / 30+ días);
      (3) **el evangelio del día**, que enseña "Hoy, Lc 15, 1-10" con su icono y
      lleva directo a la pantalla del evangelio. Más el recordatorio
      (notificación local / Carismochito). ⚠️ NATIVO (WidgetKit iOS / App Widget
      Android) → build de tienda + App Group. Los tres comparten target, payload
      y deep links: se hacen juntos. Empezar por iOS.

## Notificaciones push — mejoras pendientes (alineación con MCM Panel)

> Contexto: ver `docs/contratos/NOTIFICACIONES_CONTRATO.md` (raíz del monorepo).
> La app ya tolera el formato del panel (alias de rutas + `actionButtons[]`).
> Estas mejoras requieren build nativo o trabajo nuevo y por eso quedaron fuera
> de la entrega OTA de 2026-06-02.

- [ ] 🚨 **URGENTE — Android pierde las notificaciones con categoría** (visto el
      2026-09-26). El Panel manda `channelId` desde el **2026-08-03**
      (`mcmpanel/api/_lib/push.ts`, `resolveChannelId`: `urgente`, `eventos`,
      `celebraciones`, `cancionero`, `fotos`, `mantenimiento`), pero la app de
      `production` solo crea el canal `default`: los otros seis viven en
      `notifications/androidChannels.ts`, que está en `main` y no en
      `production`. Expo lo dice claro: un `channelId` que el dispositivo no
      tiene creado **no se muestra**. O sea: en Android solo llegan las de
      categoría `general`. **Decisión del usuario (2026-09-26): no se hace OTA
      a `production`; se arregla solo al publicar la build 2.1.** Las salidas que
      había, por si se reconsidera:
      (1) **OTA a `production`** con `androidChannels.ts` — es solo JS
      (`expo-notifications` ya está en el binario); arregla a cada móvil la
      próxima vez que abra la app. Ojo: los canales se quedan en los ajustes del
      sistema para siempre, así que la importancia de cada uno tiene que estar
      bien a la primera;
      (2) que el Panel mande `channelId: 'default'` hasta que salga la build 2.1.
      Pendiente además: **verificar en un Android real** el heads-up y el sonido
      de cada canal. Tabla en `docs/contratos/NOTIFICACIONES_CONTRATO.md` §8.

---

## Restos del pulido de octubre (2026-10-17)

El plan (`docs/planes/archivo/pulido-2026-10/`) está ejecutado y archivado;
esto es lo que quedó fuera a propósito. El `id` es el del hallazgo en
`hallazgos.json` de esa carpeta, con su evidencia y su arreglo propuesto.

**🔒 Necesitan tu decisión:**

- [ ] **`global.css` no se importa en ningún sitio** (nunca se ha importado):
      en web los componentes de heroui que van por `className` salen sin
      estilos (el Dialog de la paleta ⌘K, por ejemplo). Importarlo en
      `app/_layout.tsx` mete el reset de Tailwind en toda la web: hay que
      decidir y repasar la web entera con él.
- [ ] **Escala de letra del sistema en la hoja** (`android-webview-textzoom`):
      hoy solo Android la respeta, vía `textZoom` del WebView. Lo coherente es
      aplicar `fontScale` a la hoja en las dos plataformas, pero cambia cómo se
      ve en iOS.
- [ ] **Hoja de canción**, tres detalles que se hicieron en la versión más
      sobria: el mapa no sale en el PDF de la playlist; el pre-estribillo sale
      como «P»; la pantalla completa del navegador no entra sola (F o botón).

**Para hacer (sin decisión):**

- [ ] Añadir a mano en la consola de Firebase `".indexOn": ["createdAt"]` en
      `/notifications` y, después, la parte B de `perf-notificaciones-nodo-entero`
      (suscripción con `limitToLast(100)`).
- [ ] `web-bundle-asyncroutes` / `web-bundle-split-measure`: rutas asíncronas
      en web (el bundle inicial sigue en 6,7 MB).
- [ ] `bug-app-screens-son-rutas`: `app/screens/*` se publican como rutas
      reales en web; sacarlas de `app/`.
- [ ] Web: F5 en `/cancionero/Categories` o en una lista da 404 (solo el
      detalle de canción tiene URL estable, `/cancion?f=`).
- [ ] `android-pressable-ripple`: ripple de Android en vez del resaltado de iOS.
- [ ] `backlog-swipeable-reanimated-necesita-dispositivo`: migrar el
      `Swipeable` legacy a `ReanimatedSwipeable` (probar en dispositivo).
- [ ] `animation-readingcalendar-reanimated-dentro-de-bottomsheet`.
- [ ] `web-playlist-reorder-dnd`: arrastrar para reordenar la playlist en web.
- [ ] `backlog-home-cancion-del-dia`: tarjeta «Canción del día» en la Home.
- [ ] Sueltos: gris `#8E8E93` de `PlaylistRow.authorText`; muelle a mano e
      import directo de expo-haptics en `MaintenanceScreen.tsx`; comentario
      viejo del toast («Android Tabs custom 80»); `ux-copy-tone` en
      `AppsScreen` y la Home; el admin del cantoral podría pasar `songMap` a su
      vista previa.

**Comprobar en dispositivo** (lo que solo se ve en un teléfono real): hojas
con teclado en Android (que llegue `keyboardDidShow` dentro del `Modal`);
transponer sin recarga en iOS/Android/web; splash sin 🌐 en arranques normales
y nunca colgado más de 3 s; scroll de pestañas en iOS y volver arriba tras una
pantalla anidada; hero del Jubileo con texto oscuro y banner de encuesta con
acento poco contrastado; accesos rápidos de la Home en claro/oscuro; atrás de
Android en onboarding, encuestas, menú de la canción y Panel/Gestión; icono de
notificación y enlaces `mcmapp://` con Carismochito activo (build nativo).

---

## Mantenimiento

- [ ] **Ampliar cobertura de tests — tarea ideal para "quemar tokens"** (anotado
      2026-08-01; cifras al 2026-10-17: ~1.950 tests en 158 suites). La receta
      paso a paso está en `docs/desarrollo/COBERTURA.md`. Casi todo es lógica
      pura; hay una red de humo (`__tests__/screenSmoke.test.tsx`) que monta
      cada pantalla, pero no hay tests de comportamiento de pantalla (el tipo
      de bug de la barra de tabs, `ActionButton` remontándose en cada render,
      solo lo caza uno).

  Por dónde empezar, en orden de rentabilidad:
  1. **Tests de comportamiento de las pantallas de tab** (Home, Cantoral,
     Contigo, Más): con datos vacíos, con datos y offline.
  2. `useResolvedProfileConfig` (el resolver puro ya está cubierto, falta el
     hook con sus contextos).
  3. El flujo de subrayado de punta a punta: seleccionar → color → guardar →
     releer del bookmark.
  4. `useReadingHighlights` y `useTabScroll`, que son hooks con estado.

  Nota: tener muchos tests **no** encarece las features nuevas. Un agente no
  lee la suite entera para tocar código: lee los tests del área que toca. Lo
  que sí ahorra es tiempo de depuración —los fallos salen en segundos en vez
  de en una build de 20 minutos—. El coste real de una suite grande es de
  MANTENIMIENTO: tests frágiles (snapshots enormes, aserciones sobre
  detalles internos) que hay que reescribir en cada refactor. Por eso la
  lista de arriba pide tests de COMPORTAMIENTO, no snapshots.

- [ ] **Accesibilidad — completar cobertura restante**: ya cubren `accessibilityLabel` Home, Notificaciones, Cantoral (Categories/SongList/Detail/Fullscreen/Selected), Calendario (parcial vía Contigo), Contactos, Visitas, Grupos, Apps, EventHome, Profundiza, varios bottom sheets y modales, y (jun-2026) Fotos (`AlbumListScreen`/`AlbumCard`), Materiales, Comida, MasHome y `EventItem`. Horario es de solo lectura (sin interactivos). Pendiente: validar en dispositivo con VoiceOver/TalkBack y revisar pantallas/flujos secundarios.

---

## Inconsistencias del Design System

> El sitio donde se llevan estas ahora es
> **[`docs/planes/PLAN_DISENO.md`](../docs/planes/PLAN_DISENO.md)**, con la
> evidencia y el destino de cada una. Lo de aquí abajo es lo que queda vivo.

- [ ] **Tipografía no conectada a componentes** (`PLAN_DISENO` §C):
      `constants/typography.ts` define h1/h2/body/caption/button pero la
      mayoría de componentes usan `fontSize` inline. El archivo solo se
      importa en pocos sitios.
- [ ] **Peso de fuente inconsistente** (`PLAN_DISENO` §C): section labels usan
      `fontWeight: '800'`, títulos de cards `'700'`, botones `'500'`/`'700'`.
      La escala decidida está en `design.md` §4; falta aplicarla.

---

## Ideas para la Home Screen

> ⚠️ **Esta sección estaba desactualizada** (revisado 2026-09-02). La Home ya
> NO es "un grid de botones estático": tiene hero (`ScreenHero`), próximos
> eventos agrupados por cercanía con skeleton y `EmptyState`, banner de
> encuestas, avisos de actualización, campana de notificaciones con contador,
> accesos rápidos filtrados por perfil y layout de dos columnas en pantalla
> ancha. O sea, la Opción A ya está hecha casi entera.
>
> Lo único que sigue sin estar de la lista de abajo: **canción del día** y
> **último contenido actualizado**. El Wordle está dormido a propósito.

### Opción A: Home con contenido dinámico (recomendada) — ✅ mayormente hecha

- ✅ Próximo evento del calendario (tarjeta destacada arriba)
- ✅ Accesos rápidos más compactos
- [ ] Canción del día (si el cantoral está activo)
- ~~Wordle pendiente con indicador más claro~~ (el Wordle está dormido)
- [ ] Último contenido actualizado (materiales, reflexiones)

### Opción B: Home tipo dashboard

- Saludo personalizado (si UserProfile tiene nombre)
- Fecha de hoy + próximo evento
- Cards apiladas con preview de contenido

### Opción C: Home minimalista

- Logo MCM grande arriba
- Lista simple de secciones con subtítulo
- Barra de búsqueda global

---

## Ideas de futuro (apuntadas, sin fecha)

- [ ] **Mapa interactivo de obras y movimiento** (anotado 2026-09-19, idea del
      usuario). Un mapa con los puntos donde hay presencia: hospitales,
      residencias y colegios de las Hermanas de la Consolación, y los sitios
      donde la gente se junta para hacer movimiento. Sin fecha ni plan todavía
      — lo que hay que decidir antes de escribirlo: de dónde salen los datos
      (¿nodo nuevo en RTDB mantenido desde el panel, o un JSON en el repo?),
      qué se enseña de cada punto (ficha, foto, contacto, enlace a Comunica) y
      si es solo consulta o también "apúntate al de tu zona". Ojo al coste
      técnico: un mapa de verdad en la app son `react-native-maps` (nativo,
      build de tienda) o un WebView con un mapa web (OTA, más pobre).

---

## Mejoras técnicas — rendimiento

> Análisis técnico transversal completo en **`docs/planes/archivo/MEJORAS.md`** (raíz del monorepo). Cada item de abajo tiene su sección con archivo:línea y propuesta concreta. Los quick wins de aquella primera tanda ya están hechos.

- [ ] Auditar si `react-native-render-html` compensa (solo se usa en `FormattedContent.tsx`). Si BBCode simple bastara, ahorraría peso de bundle. Contexto (foto de mayo 2026, archivada): `docs/planes/archivo/MEJORAS.md` §1.10.
- [ ] Cómo medir antes/después (cold start, transpose, bytes de red, memoria) → `docs/planes/archivo/MEJORAS.md` "Lo que NO se ha cubierto" §1.

### Animaciones — lo que quedó de la auditoría de agosto 2026

> Auditoría completa (y por qué casi todo se dejó como estaba) en
> `docs/planes/archivo/ANIMACIONES.md`. Está archivada: estos tres son los
> únicos pendientes que sobrevivieron.

- [ ] **Reprobar Reanimated dentro de un `Modal` transparente** con la New
      Architecture activa. Hoy el `BottomSheet` usa `PanResponder` + core
      `Animated` a propósito, porque en agosto de 2026 los estilos animados de
      Reanimated 4 no se aplicaban ahí (ver la cabecera de
      `components/BottomSheet.tsx`: el intento anterior dejó un modal invisible
      a pantalla completa que se comía todos los toques). **Si ya funciona**,
      migrar el arrastre a `Gesture.Pan()` + shared value +
      `withSpring({ duration: 300, dampingRatio: 0.8, velocity })` sí merece la
      pena: cada frame del arrastre pasa hoy por el hilo de JS, y en un Android
      lento con el hilo ocupado el dedo va por delante de la hoja.
      ⚠️ Comprobar ANTES de nada que la hoja aparece de verdad, y con el mismo
      caso de prueba de la cabecera del fichero.
- [ ] **Core `Animated` que quedan: qué se migra y qué NO** (veredicto
      verificado el 2026-10-17). **NO migrar** `OTAUpdatePrompt`,
      `CarismochitoDialogs` ni `NotificationListItem`: los tres viven dentro de
      un `<Modal transparent>` (el último, vía `NotificationsBottomSheet` →
      `BottomSheet`), y ahí Reanimated pinta invisible — es justo el fallo del
      `BottomSheet` de agosto; su core `Animated` es el correcto. `WordleScreen`
      está congelado. Lo que SÍ queda: (1) `SongListItem`: solo la animación de
      fondo, que se puede pasar sin tocar el resto; (2) `PlaylistRow`,
      `SongListItem` (su swipe), `NotificationListItem` y `app/notifications.tsx`
      usan core `Animated` porque el `Swipeable` legacy de gesture-handler les
      entrega `progress`/`dragX` como `Animated.AnimatedInterpolation`:
      migrarlos es cambiar a `ReanimatedSwipeable`, no cambiar de librería de
      animación, y necesita dispositivo. Hasta entonces, no tocar.

"Reducir movimiento" ya está completo en toda la app menos Carismochito, que
se queda como está por decisión del usuario (es un huevo de pascua que se
activa a propósito agitando el móvil, quien entre ahí es porque quiere).

---

## Seguridad y observabilidad

- [ ] **Firebase App Check** (DeviceCheck/Play Integrity) para evitar abuso de las API keys públicas (`EXPO_PUBLIC_*`). Contexto (foto de mayo 2026, archivada): `docs/planes/archivo/MEJORAS.md` §7.2.
- [ ] **Fichas de privacidad de las tiendas** ⚠️ **bloquea publicar**: con la
      analítica encendida hay que declarar "datos de uso" en App Store y en el
      Data Safety de Play, y decirlo en la política de privacidad. Detalle y
      salida (no poner la clave de Aptabase) en
      `docs/desarrollo/BUILD_AGOSTO_2026.md` §6. Los tres enlaces legales ya
      están dentro de la app (`constants/legalLinks.ts` → pie de "Más").

---

## Offline / red / PWA

- [ ] **Auditar política de caché PWA** (`useRegisterServiceWorker`): stale-while-revalidate, cabeceras correctas. Contexto (foto de mayo 2026, archivada): `docs/planes/archivo/MEJORAS.md` §9.3.

---

## Backend Firebase

- [ ] **Cleanup adicional**: reflexiones antiguas, notificaciones por usuario antiguas. Contexto (foto de mayo 2026, archivada): `docs/planes/archivo/MEJORAS.md` §13.3.
- [ ] **Valorar Firestore** para `songs` y `compartiendo` cuando el dataset crezca (paginación, queries indexadas). Mantener RTDB para configuración y datos pequeños. Contexto (foto de mayo 2026, archivada): `docs/planes/archivo/MEJORAS.md` §13.1.

---

## Internacionalización

- [ ] **Decisión i18n**: ¿castellano monolingüe o se quiere catalán/euskera/portugués/inglés? Si "no por ahora", dejarlo explícito en CLAUDE.md para que ningún agente lo añada. Si "sí más adelante", introducir `i18n-js` + `expo-localization` ya con un único `es.json`. Contexto (foto de mayo 2026, archivada): `docs/planes/archivo/MEJORAS.md` §10.

---

## Documentación

- [ ] **ADR mínimo** (Architecture Decision Records) en algún sitio: por qué RTDB vs Firestore, por qué heroui-native vs Paper, por qué no react-query, etc. Contexto (foto de mayo 2026, archivada): `docs/planes/archivo/MEJORAS.md` §14.3.
