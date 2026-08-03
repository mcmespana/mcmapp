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

- [ ] **`react-hooks/set-state-in-effect` — quedan 6** (eran 35). Los 29
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

      Los **6 que quedan NO son deuda pendiente, son decisiones**; no vayas a por el
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
              - ~~`ComunicaScreen`~~ — hecho al migrarlo a Reanimated.

- [x] ~~`react-hooks/refs`~~ — **migración a Reanimated TERMINADA** (2026-08-03).
      De 277 avisos a **34**, y los 34 que quedan **no son animaciones**: son
      refs legítimas (`.panHandlers`, `.current` de timers, callbacks estables,
      el ref del WebView…). Ya no queda ni un `useRef(new Animated.Value())` en
      la app salvo el Wordle, que es código congelado.

      **Lo que se ganó**: Reanimated corre las animaciones en el hilo de UI, así
      que dejan de entrecortarse cuando JS está ocupado. Se nota especialmente en
      la portada de Comunica (se ve MIENTRAS arranca el WebView), el burst de
      celebración (se lanza a la vez que se guarda el hábito) y el arrastre del
      reproductor flotante (con un vídeo reproduciéndose al lado).

      **Recetario, por si hay que migrar algo nuevo**: `useSharedValue` +
      `useAnimatedStyle`; curvas desde `reaEasings` (`constants/animations.ts`),
      que son las MISMAS que `easings` pero en la versión worklet — no son
      intercambiables. `Animated.loop` → `withRepeat`, `Animated.sequence` →
      `withSequence`, `Animated.delay` → `withDelay`,
      `Animated.spring({tension, friction})` → `withSpring({stiffness, damping})`,
      `.interpolate()` → `interpolate()` dentro del worklet, y las props de SVG
      por `useAnimatedProps` (no por estilo). Un array de `Animated.Value` se
      convierte en un subcomponente por elemento con su propio shared value,
      porque los hooks no se pueden llamar en un bucle. **Los bucles infinitos
      hay que pararlos a mano** con `cancelAnimation`: siguen corriendo en el
      hilo de UI aunque el componente esté oculto.

      **Decisión consciente**: el gesto de `BottomSheet` se queda en
      `PanResponder`. Ese sheet lo comparten una decena de modales y muchos
      llevan un ScrollView dentro; pasarlo a gesture-handler cambiaría cómo
      compiten los dos por el toque. Sus animaciones sí están migradas.

      ⚠️ **NADA de esto está validado en dispositivo**: son animaciones, y solo
      se comprueban mirándolas. Es lo primero que hay que repasar en la build.

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
- [ ] **NO tocar: `react-hooks/immutability` (26, eran 14)** — son `sharedValue.value =
…`, o sea LA api de Reanimated. No tiene arreglo por diseño.
- [ ] **NO tocar: `react-hooks/purity` (3)** — revisados uno a uno, los tres son
      falsos positivos (`Date.now()` en un handler async de `ReflexionesScreen`,
      `Math.random()` en un `useMemo` del Wordle, que además es código
      congelado).
- [ ] **Subir `react-hooks/refs` a `error`** en `eslint.config.js`: con la
      migración hecha, los 34 que quedan son refs legítimas y habría que darles
      su `eslint-disable-next-line` con el motivo antes de subir la regla.
      `set-state-in-effect` tampoco puede subir tal cual — mismos 6 casos
      justificados arriba. Hacerlo cuando la build de tienda esté validada, no
      antes: son cambios que solo añaden ruido si hay que revertir algo.

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

- [ ] **"Subrayar" dentro del menú NATIVO del sistema** — ⚠️ **replanteado el
      2026-08-03, leer antes de empezar**: resulta que `HighlightableReading` YA
      renderiza con un `TextInput` de solo lectura, que en iOS **es un
      `UITextView` real**. O sea que NO hay que sustituir el render por una
      vista nativa (que era el grueso del trabajo estimado); basta con enganchar
      el menú al text view que ya hay. Lo delicado pasa a ser otra cosa: el
      delegate `textView(_:editMenuForTextIn:suggestedActions:)` **ya lo ocupa
      React Native**, así que hay que interponer un proxy que reenvíe el resto y
      probarlo en dispositivo. Alcance mínimo: UN ítem «Subrayar» que abra la
      barra de colores actual — el submenú por color es extra. Detalle en
      `docs/funcionalidades/SUBRAYADO.md`.

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
- [x] **Icono de la app en verde/Carismochito** (2026-08-03) — hecho con
      `expo-alternate-app-icons`; iconos generados con `npm run icons:alt` y swap
      en `utils/appIcon.ts`. Queda **probarlo en dispositivo** con la build de
      tienda: en iOS sale una alerta del sistema en cada cambio real (de Apple, no
      se puede quitar) y en Android el launcher puede tardar en refrescar.

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

- [x] **NSE iOS para imágenes en la notificación del sistema** (2026-08-03) —
      `plugins/withNotificationServiceExtension.js` crea el target de Xcode en cada
      prebuild; el Swift está en `targets/notification-service/`. Queda **probarlo
      en un iPhone real** con la build de tienda y que el Panel empiece a mandar
      `mutableContent: true` en los pushes con imagen (sin ese flag iOS no ejecuta
      la extensión). Ver `docs/desarrollo/BUILD_AGOSTO_2026.md` §5.
- [x] **Deep link a un evento/actividad concreto** (2026-07-07) — el panel manda
      `data.eventId` (id del registry) y la app abre el hub del evento
      (`utils/notificationEventRoute.ts`: `/(tabs)/<tabId>` o `/(tabs)/mas`).
      Prioritario sobre `internalRoute`; botón "Ir al evento" en el modal. El
      evento debe existir en `constants/events.ts` (ligado a consumir
      `activities/<id>/_meta`, aún pendiente).
- [ ] **Channels Android — probar en dispositivo real antes de production** ⚠️ los
      canales YA están implementados (2026-08-03): siete, uno por categoría del Panel,
      en `constants/notificationChannels.ts` + `notifications/androidChannels.ts`.
      Queda lo que siempre fue requisito y no se puede hacer a ciegas:
      (a) **verificar en un Android real** el heads-up y el sonido de cada canal —
      aparecen en los ajustes del sistema de TODOS los Android y las preferencias que
      el usuario toque ya no se pueden revertir desde la app
      (`deleteNotificationChannelAsync` no las borra);
      (b) **que el Panel mande `channelId`** (cross-repo) — sin él todo cae en
      `default` como hasta ahora, y con un `channelId` que la app no declare Android
      **no entrega** la notificación. Tabla cerrada en
      `docs/contratos/NOTIFICACIONES_CONTRATO.md` §8.
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

---

## Seguridad y observabilidad

- [ ] **Firebase App Check** (DeviceCheck/Play Integrity) para evitar abuso de las API keys públicas (`EXPO_PUBLIC_*`). Ver MEJORAS.md §7.2.
- [x] **Crash reporting con Sentry** (2026-08-03) — `utils/sentry.ts` engancha
      `logger.warn/error` (y por tanto el `ErrorBoundary`) más los crashes nativos.
      Queda **crear el proyecto en Sentry y configurar las variables**: paso a paso
      en `docs/desarrollo/BUILD_AGOSTO_2026.md` §2. Sin `EXPO_PUBLIC_SENTRY_DSN` no
      reporta nada, así que hasta que se configure está apagado.
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
