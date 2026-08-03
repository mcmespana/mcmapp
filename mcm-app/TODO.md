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

> Orden propuesto (repriorízalo si no lo ves). Los 1-3 están atados entre sí:
> la rama de la barra de tabs no se mergea hasta validarla, y hay cosas que
> sólo se pueden hacer con la build nativa delante.

### 1. Validar y publicar la rama de la barra de tabs

- [ ] **Validar `claude/compact-tabs-bar-uxxaoz` en dev build** — es lo que
      desbloquea todo lo demás. Lleva Expo SDK 57, la barra flotante, la
      actualización de dependencias, iPad landscape y el subrayado nuevo.
- [ ] **Igualar `production` a esta rama** — es todo código NATIVO: hace falta
      **build de tienda**, no vale OTA. Orden: validar dev build → merge a
      `main` → build de producción iOS + Android → subir a las tiendas → mover
      `production`.
- [ ] **iPad: verificar en dispositivo real** en horizontal y vertical todas las
      pantallas y modales/bottom sheets. El landscape ya está activado
      (`UISupportedInterfaceOrientations~ipad`), pero la pasada de layouts nunca
      se ha probado en un iPad físico. Posibles ajustes finos tras la prueba.

### 2. React Compiler — lo que SÍ merece la pena

> Contexto: el React Compiler está ACTIVADO (`experiments.reactCompiler: true`
> en `app.json`). Estas reglas son su linter: marcan sitios donde NO puede
> optimizar, así que esos componentes se quedan sin memoización automática. No
> son bugs. Están en `warn` en `eslint.config.js`.

- [ ] **`react-hooks/set-state-in-effect` — quedan 7** (eran 35). Los 28
      arreglados el 2026-08-02 con dos patrones, ninguno de ellos `key={visible}`:

      - **Estado DERIVADO** donde el efecto solo copiaba algo calculable:
                `useAdminStatus`, `useEventMeta` y `ChoirSessionContext` guardan ahora el
                resultado JUNTO a la clave a la que pertenece (uid / eventId / código),
                así lo viejo deja de contar solo; `SongListScreen` construye la lista con
                una función pura + `useMemo` (el efecto era `async` sin esperar a nada);
                `fotos.tsx` y `AlbumListScreen` comparten `hooks/useAlbumPagination.ts`;
                `useColorScheme.web.ts` usa `useSyncExternalStore` para el flag de
                hidratación.
              - **Ajuste durante el render** (el patrón que documenta React para «cambiar
                estado cuando cambia una prop») en los modales que se resetean al abrir y
                en las pantallas que reaccionan a un parámetro de navegación. Es
                equivalente al efecto pero sin el render intermedio con los datos
                anteriores, y **no cambia el comportamiento** (a diferencia de
                `key={visible}`, que además habría matado la animación de salida del
                `BottomSheet`).

      Los **7 que quedan NO son deuda pendiente, son decisiones**; no vayas a por el
      número:

      - `WordleScreen` (×2) y `useWordleGame` — **código congelado**, CLAUDE.md
                prohíbe refactorizarlo.
              - `notifications.tsx:568` — auto-abrir por deep-link. Es una ACCIÓN
                disparada por la navegación, no estado que derivar: un efecto es
                justamente la herramienta correcta.
              - `AddToHomeBanner:30` — lee `window`/`localStorage`, que solo existen en
                cliente. Moverlo al render rompería la hidratación del render estático de
                web.
              - `useSongProcessor:523` — el efecto entero es síncrono y se podría pasar a
                `useMemo`, pero eso mete ~500 líneas de formateo ChordPro→HTML DENTRO del
                render en la pantalla más usada de la app. Hoy la pantalla pinta primero y
                formatea después; cambiarlo es una decisión de rendimiento **que hay que
                medir en dispositivo**.
              - `ComunicaScreen:136` — el montaje/desmontaje del loader va atado al
                `Animated.Value` del fundido. **Entra en la migración a Reanimated**
                (abajo), que reescribe esa animación de todas formas.

- [ ] **`react-hooks/refs` — quedan 160** (eran 277). Migración de animaciones a
      Reanimated **EN CURSO**. Viene de los `useRef(new Animated.Value(0)).current`
      repartidos por la app (cada valor genera varios avisos, uno por lectura en
      render). **Beneficio real, no cosmético**: Reanimated corre las animaciones
      en el hilo de UI, así que no se entrecortan cuando JS está ocupado.

      - ✅ **Hechos (2026-08-03, 117 avisos)**: `ComunicaLoader` (24),
                `OTAUpdatePrompt` (19), `FloatingMediaPlayer` (17),
                `CarismochitoChargeDots` (14), `ComunicaTopProgress` (13),
                `BreathingPhase` (10), `CelebrationBurst` (10) y
                `CelebrationAnimation` (10 — resultó ser una copia literal de
                `CelebrationBurst`, así que ahora delega en él).
              - **Pendientes, por tamaño**: `CarismochitoOverlay` (31),
                `BottomSheet` (23), `HorarioScreen` (11), `CarismochitoMascot` (11),
                `SongFullscreenScreen` (10), `ReadingCalendarSheet` (8),
                `AppToastContext` (8), `CarismochitoDialogs` (7),
                `TransposeBottomSheet` (7), `HighlightActionBar` (7),
                `ComunicaScreen` (6), `SongDetailScreen` (5) y 15 ficheros con 1-5.
                **`WordleScreen` NO se toca** (código congelado).
              - **Cómo se está haciendo** (seguir el mismo patrón): `useSharedValue` +
                `useAnimatedStyle`, curvas desde `reaEasings` en
                `constants/animations.ts` (son las MISMAS que `easings`, pero en la
                versión worklet de Reanimated — no son intercambiables). Los arrays de
                `Animated.Value` se convierten en un subcomponente por elemento con su
                propio shared value, porque los hooks no se pueden llamar en un bucle.
                `Animated.loop` → `withRepeat`, `Animated.sequence` → `withSequence`,
                `Animated.delay` → `withDelay`, `Animated.spring({tension, friction})`
                → `withSpring({stiffness, damping})`, e `interpolate()` dentro del
                worklet en vez de `.interpolate()`. **Los bucles infinitos hay que
                pararlos a mano** con `cancelAnimation` al desmontar/ocultar: en
                Reanimated siguen corriendo en el hilo de UI aunque nadie los mire
                (con `Animated.loop` bastaba el `.stop()`). Los `PanResponder` pasan a
                `Gesture.Pan()` de gesture-handler, guardando la posición inicial en
                `onStart` para replicar `extractOffset`/`flattenOffset`.
              - **Ojo**: cada fichero migrado cambia avisos de `refs` por 1-2 de
                `immutability` (`sharedValue.value = …`), que son la API de Reanimated
                y no tienen arreglo. Es el intercambio esperado: 117 `refs` menos ha
                costado 1 `immutability` más.
              - ⚠️ **Nada de esto está validado en dispositivo**: son animaciones, y
                sólo se comprueban mirándolas.
- [ ] **`react-hooks/preserve-manual-memoization` — quedan 5** (de 12). Los 7
      mecánicos ya están hechos (el patrón era: usar `user?.uid` dentro de un
      `useCallback` hace que el compilador infiera `user` entero y se salte el
      componente; se arregla sacando `const uid = user?.uid` fuera). Los 5 que
      quedan son de otra clase ("memoized in source but not in compilation
      output"): `useMemo` que mutan un `Map` por dentro, o callbacks async con
      setState. `app/notifications.tsx:511`, `SelectedSongsScreen` (×3),
      `NotificationsBottomSheet:100`. Piden reestructurar cada caso y el premio
      es pequeño: **hacerlo sólo de pasada si se toca ese fichero por otra
      cosa**.
- [ ] **NO tocar: `react-hooks/immutability` (14)** — son `sharedValue.value =
…`, o sea LA api de Reanimated. No tiene arreglo por diseño.
- [ ] **NO tocar: `react-hooks/purity` (3)** — revisados uno a uno, los tres son
      falsos positivos (`Date.now()` en un handler async de `ReflexionesScreen`,
      `Math.random()` en un `useMemo` del Wordle, que además es código
      congelado).
- [ ] Cuando `refs` esté hecho, **subir las reglas a `error`** en
      `eslint.config.js` para que no se cuelen más. Ojo: `set-state-in-effect` no
      puede subir a `error` tal cual — los 7 casos de arriba son legítimos y
      necesitarían su `eslint-disable-next-line` con el motivo antes de hacerlo.

### 3. Headers que se esconden al hacer scroll

- [x] ~~Fotos~~ — hecho: el título va en un `ScreenHero` dentro de la lista y se
      va con el scroll.
- [x] ~~Comunica en Android~~ — hecho (2026-08-02): la franja del notch es ya un
      overlay y la web se desliza por debajo, igual que en iOS. Como el WebView
      de Android no admite `contentInset`, el hueco (arriba **y abajo**, que
      tampoco estaba: la barra flotante tapaba el final de la página) lo reserva
      la propia página con el `padding` que le inyecta `safeAreaBridgeJS`.
      **Pendiente sólo de validar en un Android real**, y de decidir con el lado
      web si prefieren el opt-out (`data-mcm-insets="self"`) para no perder su
      propio `padding` de `<body>`. Contrato actualizado en
      `docs/contratos/COMUNICA_WEBVIEW.md` §3.
- [ ] **Calendario**: es el otro tab que sigue con header opaco
      (`headerShown: true`). Si se quiere el mismo trato que Fotos, mismo
      patrón: `ScreenHero` dentro del scroller y `headerShown: false`. No se ha
      hecho porque nadie lo ha pedido y el calendario tiene sus propios
      controles pegados arriba (selector de mes, chips de filtro) que habría que
      recolocar.

### 4. Subrayado — siguiente iteración

- [ ] **"Subrayar" dentro del menú NATIVO del sistema** — hoy hay que entrar al
      modo subrayar (botón del rotulador). Lo suyo es seleccionar en cualquier
      momento y que el menú del sistema tenga un ítem "Subrayar" con sus
      colores, junto a Copiar / Herramientas de escritura / Traducir. No se
      puede desde JS: `UIMenu` vía `textView(_:editMenuForTextIn:suggestedActions:)`
      en iOS 16+ y `ActionMode.Callback2` en Android. ⚠️ Es un MÓDULO NATIVO →
      **build de tienda + commit `[skip-ota]`**, y hay que probarlo en
      dispositivo. Contrato hacia JS y pasos en
      `docs/funcionalidades/SUBRAYADO.md`. Ya está hecha la mitad JS: al
      seleccionar texto subrayado, la barra reconoce el color y deja cambiarlo.

### 5. Otros

- [ ] **Revisar las 4 dependencias que se quedaron atrás** (2026-08-01). No se
      subieron por incompatibilidad REAL comprobada, no por prudencia — hay que
      esperar a que el ecosistema se mueva. Ninguna afecta al binario que
      instalan los usuarios: - `eslint` 9 → 10: rompe el `eslint-plugin-react` que trae
      `eslint-config-expo` (`contextOrFilename.getFilename is not a function`).
      Reintentar cuando salga `eslint-config-expo` con soporte de ESLint 10. - `jest` 29 → 30 (+ `@types/jest` 30): `jest-expo` 57 está construido
      contra jest 29; mezclarlos rompe el runtime entero
      (`_moduleMocker.clearMocksOnScope is not a function`). Va atado al SDK. - `typescript` 6 → 7, `@babel/core` 7 → 8: los fija Expo, no se tocan a
      mano. Entrarán con el SDK 58.
- [ ] **PDF — número de página y pie por canción**: parcial. Hecho: pie con nombre de playlist + "Página N" vía margin boxes de `@page` (funciona en web Chrome ≥131 y Android; iOS/WebKit no los soporta → validar y, si se quiere también en iOS, haría falta paginación JS). Pendiente: el "1 de 3" por canción multipágina — no viable con CSS de impresión, requeriría paginar por JS midiendo alturas.
- [ ] **Command Palette v2: deep-link a contenidos** — el palette actual (`CommandPalette.tsx`) solo navega a tabs/pantallas top-level. Para saltar a una canción concreta o a un punto dentro de los stacks anidados hay que exponer un `navigation ref` (p.ej. `CancioneroNavRefContext`). Después indexar canciones (`songs/data`), reflexiones (`compartiendo/data`) y eventos del calendario.

---

## UI nativa — pendientes (Fase 1/2 de `docs/planes/PLAN_UI_NATIVA.md`)

> Hecho en la pasada del 2026-06-21 (ver CHANGELOG): headers nativos de Contigo,
> headers transparentes en Calendario/Eventos Pasados, búsqueda nativa en todas
> las categorías, canción con letra full-bleed, `GlassActionGroup`/`AppIconButton`/
> `AppTextField`. Pendiente de la review de componentes:

- [ ] **Pulido del glass (iOS 26) — fino, con dispositivo delante**: botones del
      header de la canción "justos" dentro de la cápsula, seam/línea del header
      sobre letra blanca, y acercar `AppIconButton`/`GlassSurface` al bar item
      nativo. Difícil a ciegas. (`components/ui/AppIconButton.tsx`, `GlassSurface.ios.tsx`)
- [ ] **Headers de evento (hub + sub-pantallas) transparentes** como el cantoral:
      hoy usan el "floating header" opaco (`eventScreenOptions` con
      `FloatingHeaderBackground`). Unificar al glass del sistema — cambio mayor,
      revisar el inset de cada hero. (`app/screens/eventStackScreens.tsx`)
- [ ] **Seguir Fase 2 (componentes unificados)**: migrar más `TextInput` a
      `AppTextField` (quedan ~13); crear `AppPrimaryButton` (CTA de modales) y
      `SegmentedControl`; adoptar `EmptyState` en los ~20 sitios que reinventan
      el "no hay…". Ver §2 de `PLAN_UI_NATIVA.md`.

## Modo Carismochito (ver `docs/planes/PLAN_CARISMOCHITO.md`)

> Hecho (jun-2026, ver CHANGELOG): confirmar antes de desactivar + salir con un
> par de sacudidas fuertes (sin semáforo), el badge ahora abre la explicación, y
> onboarding persistido con teaser de futuro.

- [ ] **Carismochito aparece en (casi) todas las pantallas** (overlay global),
      excepto materiales/profundiza de evento y canción a pantalla completa.
- [ ] **Colección + contador** al tocar la mascota (animación especial); guardado
      por usuario y **solo con sesión iniciada** (si no, avisar de pérdida de
      progreso).
- [ ] **Icono de la app en verde/Carismochito** al activar el modo → iconos
      alternativos (iOS `setAlternateIconName`, Android `activity-alias`). ⚠️
      NATIVO (build de tienda, no OTA); persiste fuera de la app; en Android el
      swap es tosco. (Ya estaba en "Prioridad baja"; detalle en el plan.)

## Widget de Contigo (ver `docs/planes/PLAN_WIDGET_CONTIGO.md`)

- [ ] **Widget de los 3 hábitos diarios** (Evangelio/Oración/Revisión) con marca,
      deep-link y recordatorio (notificación local / Carismochito). ⚠️ NATIVO
      (WidgetKit iOS / App Widget Android) → build de tienda + App Group para
      compartir el estado del día con el widget. Empezar por iOS.

## Notificaciones push — mejoras pendientes (alineación con MCM Panel)

> Contexto: ver `docs/contratos/NOTIFICACIONES_CONTRATO.md` (raíz del monorepo).
> La app ya tolera el formato del panel (alias de rutas + `actionButtons[]`).
> Estas mejoras requieren build nativo o trabajo nuevo y por eso quedaron fuera
> de la entrega OTA de 2026-06-02.

- [ ] **NSE iOS para imágenes en la notificación del sistema** — hoy `richContent.image`
  - `mutableContent` NO pintan imagen en iOS (no hay Notification Service Extension);
    la imagen solo se ve in-app vía `data.imageUrl`. Añadir NSE (Android ya funciona).
    ⚠️ Código nativo → requiere build de producción y commit con `[skip-ota]`.
- [x] **Deep link a un evento/actividad concreto** (2026-07-07) — el panel manda
      `data.eventId` (id del registry) y la app abre el hub del evento
      (`utils/notificationEventRoute.ts`: `/(tabs)/<tabId>` o `/(tabs)/mas`).
      Prioritario sobre `internalRoute`; botón "Ir al evento" en el modal. El
      evento debe existir en `constants/events.ts` (ligado a consumir
      `activities/<id>/_meta`, aún pendiente).
- [ ] **Channels Android por tipo/prioridad (A4.2 — PENDIENTE, con condiciones)** — hoy
      solo existe el channel `default` (importancia MAX), así que `priority` no
      diferencia el display. Crear channels (`urgente`, `eventos`…) para heads-up/sonido
      diferenciados y permitir que el panel mande `channelId`.
      **Por qué está pendiente (decisión 2026-07-07):** aunque `setNotificationChannelAsync`
      es runtime (NO necesita build nativo), NO es de impacto cero: crear channels extra
      hace que aparezcan canales (posiblemente vacíos) en los ajustes del sistema de
      TODOS los Android, es difícil de revertir (`deleteNotificationChannelAsync` no borra
      las preferencias que el usuario ya haya tocado) y altera la ruta de entrega del push.
      **Requisitos antes de hacerlo:** (1) decidir el set de channels y el mapeo
      categoría/priority→channel; (2) que el panel mande `channelId` (cross-repo, ver
      contrato §8/§9); (3) **probar en dispositivo Android real** el heads-up/sonido antes
      de mergear a production. No enviar a ciegas por OTA. Ver
      `docs/planes/PLAN_INTEGRACIONES.md` (A4, punto 2).
- [x] **Usar `data.category` en el centro de notificaciones (A4.1)** (2026-07-07) —
      chip de color con icono por categoría en la tarjeta y el modal
      (`utils/notificationCategory.ts`). `general`/ausente/desconocida no pintan chip.
      Pendiente aún (opcional): agrupación/filtro por categoría.
- [ ] **(Panel) Corregir el contrato** — que el MCM Panel use las rutas reales,
      segmente por `topics`/`profileType`/`delegationId` (no `userType`/`delegacion`) y
      desacople `categoryId` (solo iOS) de `data.category`. Detalle en
      `docs/contratos/NOTIFICACIONES_CONTRATO.md`.

---

## Mantenimiento

- [ ] **Ampliar cobertura de tests — tarea ideal para "quemar tokens"** (anotado
      2026-08-01). Hoy hay 325 tests en 34 ficheros, pero **casi todos son de
      lógica pura**: no hay ni un test que renderice una pantalla. Justo el tipo
      de bug que se coló con la barra de tabs (`ActionButton` remontándose en
      cada render) lo habría cazado un render test.

      Por dónde empezar, en orden de rentabilidad:
                          1. **Render tests de las pantallas de tab** (Home, Cantoral, Contigo,
                             Más): que monten sin reventar con datos vacíos, con datos y offline.
                          2. `useResolvedProfileConfig` (el resolver puro ya está cubierto, falta el
                             hook con sus contextos).
                          3. El flujo de subrayado de punta a punta: seleccionar → color → guardar →
                             releer del bookmark.
                          4. `useReadingHighlights` y `useTabScroll`, que son hooks con estado.

                          Nota: tener muchos tests **no** encarece las features nuevas. Un agente no
                          lee la suite entera para tocar código: lee los tests del área que toca. Lo
                          que sí ahorra es tiempo de depuración —los fallos salen en segundos en vez
                          de en una build de 20 minutos— y evita iteraciones enteras como la del
                          tamaño de los iconos. El coste real de una suite grande es de
                          MANTENIMIENTO: tests frágiles (snapshots enormes, aserciones sobre
                          detalles internos) que hay que reescribir en cada refactor. Por eso la
                          lista de arriba pide tests de COMPORTAMIENTO, no snapshots.

- [ ] **Modo carismochito — cambiar el icono del launcher (icono "de fuera") a verde**:
      hoy el modo solo tiñe la UI dentro de la app (incluido el cuadro-logo del
      header de la Home). Cambiar el icono del móvil requiere **iconos
      alternativos**: iOS `setAlternateIconName`, Android `activity-alias`
      (vía `expo-dynamic-app-icon` o similar). Peros a valorar antes de hacerlo:
      ⚠️ es **código nativo** → build de tienda, no OTA, y los iconos deben ir
      empaquetados en el build; ⚠️ el cambio **persiste fuera de la app** (hay que
      revertirlo al desactivar el modo); ⚠️ en Android el swap es tosco (ocurre al
      pasar a segundo plano y puede reiniciar atajos). Encaja regular con un modo
      efímero por agitado — decidir si compensa.
- [ ] **Accesibilidad — completar cobertura restante**: ya cubren `accessibilityLabel` Home, Notificaciones, Cantoral (Categories/SongList/Detail/Fullscreen/Selected), Calendario (parcial vía Contigo), Contactos, Visitas, Grupos, Apps, EventHome, Profundiza, varios bottom sheets y modales, y (jun-2026) Fotos (`AlbumListScreen`/`AlbumCard`), Materiales, Comida, MasHome y `EventItem`. Horario es de solo lectura (sin interactivos). Pendiente: validar en dispositivo con VoiceOver/TalkBack y revisar pantallas/flujos secundarios.

---

## Inconsistencias del Design System

- [ ] **Tipografía no conectada a componentes**: `constants/typography.ts` define h1/h2/body/caption/button pero la mayoría de componentes usan fontSize inline. El archivo solo se importa en pocos sitios.
- [ ] **Peso de fuente inconsistente**: section labels usan `fontWeight: '800'`, títulos de cards `'700'`, botones `'500'`/`'700'`. No hay guía clara de qué peso usar en cada nivel.
- [ ] **Migrar componentes existentes a tokens**: `radii.*` y `shadows.*` están definidos pero los componentes siguen usando valores inline. Migrar gradualmente.

---

## Ideas para la Home Screen

La home actual es un grid de botones estático. Opciones para hacerla más útil:

### Opción A: Home con contenido dinámico (recomendada)

- Próximo evento del calendario (tarjeta destacada arriba)
- Accesos rápidos más compactos
- Canción del día (si el cantoral está activo)
- Wordle pendiente con indicador más claro
- Último contenido actualizado (materiales, reflexiones)

### Opción B: Home tipo dashboard

- Saludo personalizado (si UserProfile tiene nombre)
- Fecha de hoy + próximo evento
- Cards apiladas con preview de contenido

### Opción C: Home minimalista

- Logo MCM grande arriba
- Lista simple de secciones con subtítulo
- Barra de búsqueda global

---

## Mejoras técnicas — rendimiento

> Análisis técnico transversal completo en **`docs/planes/archivo/MEJORAS.md`** (raíz del monorepo). Cada item de abajo tiene su sección con archivo:línea y propuesta concreta. Los quick wins de aquella primera tanda ya están hechos.

- [ ] Auditar si `react-native-render-html` compensa (solo se usa en `FormattedContent.tsx`). Si BBCode simple bastara, ahorraría peso de bundle. Ver MEJORAS.md §1.10.
- [ ] Cómo medir antes/después (cold start, transpose, bytes de red, memoria) → MEJORAS.md "Lo que NO se ha cubierto" §1.

---

## Calidad de código y mantenibilidad

- [ ] **Trocear ficheros enormes**: `SelectedSongsScreen.tsx` (1.750 líneas), `NotificationsBottomSheet.tsx` (908), `WordleScreen.tsx` (776), `SecretPanelModal.tsx` (660). Extraer subcomponentes, hooks y utilidades. Ver MEJORAS.md §2.1 y el plan por fases en `docs/planes/PLAN_CALIDAD.md`.
- [ ] **Agrupar providers afines** en `app/_layout.tsx` (12 anidados). Por ejemplo, combinar `UserProfile` + `ProfileConfig`. Ver MEJORAS.md §2.2.
- [ ] **Conectar el logger con Sentry**: `utils/logger.ts` ya expone `setReporter`; falta integrar `@sentry/react-native` y llamarlo en el arranque (ver «Crash reporting» abajo).

---

## Seguridad y observabilidad

- [ ] **Firebase App Check** (DeviceCheck/Play Integrity) para evitar abuso de las API keys públicas (`EXPO_PUBLIC_*`). Ver MEJORAS.md §7.2.
- [ ] **Crash reporting** — integrar Sentry (`@sentry/react-native`). Hoy `ErrorBoundary` muestra UI pero no reporta. Ver MEJORAS.md §8.1.
- [ ] **Analítica de uso** — Firebase Analytics o PostHog, con eventos clave (`app_open`, `tab_view`, `song_open`, `playlist_create`, `notification_received`). Sin esto no se puede priorizar por datos reales. Ver MEJORAS.md §8.3.
- [ ] **Política de privacidad / consentimiento** — revisar si está pendiente para stores europeas / notificaciones push. Ver MEJORAS.md §7.4.

---

## DX / CI / Build

- [ ] **Documentar criterios de promoción OTA preview → production** (quién valida, cómo se hace rollback). Ver MEJORAS.md §12.2.

---

## Offline / red / PWA

- [ ] **Reintentos con backoff** en `useFirebaseData` cuando `get()` falla por red intermitente (hoy se traga el error). Ver MEJORAS.md §9.2.
- [ ] **Sincronización en background** al volver a estar online (no esperar al próximo mount). Ver MEJORAS.md §9.2.
- [ ] **Auditar política de caché PWA** (`useRegisterServiceWorker`): stale-while-revalidate, cabeceras correctas. Ver MEJORAS.md §9.3.

---

## Backend Firebase

- [ ] **Completar backend de notificaciones push** — solo hay `purgeExpiredShares`. Falta función Cloud que lea trigger y use FCM Admin (`docs/funcionalidades/NOTIFICACIONES.md`). Idempotencia y audiencias por perfil/delegación. Ver MEJORAS.md §13.2.
- [ ] **Cleanup adicional**: reflexiones antiguas, notificaciones por usuario antiguas. Ver MEJORAS.md §13.3.
- [ ] **Valorar Firestore** para `songs` y `compartiendo` cuando el dataset crezca (paginación, queries indexadas). Mantener RTDB para configuración y datos pequeños. Ver MEJORAS.md §13.1.

---

## Internacionalización

- [ ] **Decisión i18n**: ¿castellano monolingüe o se quiere catalán/euskera/portugués/inglés? Si "no por ahora", dejarlo explícito en CLAUDE.md para que ningún agente lo añada. Si "sí más adelante", introducir `i18n-js` + `expo-localization` ya con un único `es.json`. Ver MEJORAS.md §10.

---

## Documentación

- [ ] **ADR mínimo** (Architecture Decision Records) en algún sitio: por qué RTDB vs Firestore, por qué heroui-native vs Paper, por qué no react-query, etc. Ver MEJORAS.md §14.3.
