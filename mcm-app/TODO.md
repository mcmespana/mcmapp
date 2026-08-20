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

### 0. ⚠️ El CI no ejecuta nada desde abril de 2026

- [ ] **Averiguar por qué GitHub Actions está parado y volver a encenderlo.**
      El último run de `ci.yml` es del **2026-04-10**; desde entonces
      **ningún PR se ha verificado de verdad**, aunque el workflow siga en el
      repo y la PR parezca "clean" al mergear.

Cómo se descubrió: el 2026-08-15, `npm run typecheck:tests` —que es uno de los
cuatro pasos de `verify.yml`— llevaba fallando con 4 errores de tipos en `main`
sin que saltara nadie. Se arreglaron en la #334, pero el problema de fondo es
que **el guardarraíl está desenchufado**: mientras siga así, lo único que
verifica el repo es lo que ejecute a mano quien esté trabajando.

Sitios donde mirar: pestaña Actions del repo (¿deshabilitadas?), si la cuenta se
quedó sin minutos, y si algún ajuste de la organización bloquea los workflows en
PRs de ramas `claude/*`.

Mientras tanto, **antes de mergear cualquier cosa hay que pasar los cuatro pasos
en local**:

```bash
cd mcm-app
npm run typecheck && npm run typecheck:tests && npm run lint && npm test -- --ci
```

### 1. Sacar la build de tienda de agosto

- [ ] **Todo el paso a paso está en `docs/desarrollo/BUILD_AGOSTO_2026.md`** —
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

- [ ] **Quitar `updates.disableAntiBrickingMeasures: true` de `app.json`.** Ya
      no lo usa nadie: el modo tester pasó a `setUpdateRequestHeadersOverride`,
      que no lo necesita (ver `docs/funcionalidades/CANAL_PREVIEW.md`). Dejarlo
      puesto quita la protección que garantiza poder publicar un update que
      arregle un update roto — Expo lo desaconseja explícitamente en builds de
      tienda. **Hay que hacerlo aquí y no antes**: tocar `app.json` dispara el
      `guard-native` de `ota-production.yml`, que obliga a `[skip-ota]` y con
      eso se saltaría la OTA. Como el flag solo se hornea al compilar, quitarlo
      no cambia nada hasta esta build.

### 1-bis. `expo export --platform web` — ✅ ARREGLADO (2026-08-08)

Fallaba con `The method or property expo-modules-core.requireNativeViewManager
is not available on web` y no generaba ni `index.html` ni el bundle. La causa no
era el renderizado estático en sí: `app/(tabs)/_layout.tsx` importaba
**estáticamente** los tres layouts de pestañas, así que el grafo de módulos de
web llegaba a `expo-native-compact-tabs` — que llama a
`requireNativeViewManager()` al cargarse y no trae shim web. Con importarlo
bastaba, aunque la rama de `Platform.OS` no llegara a ejecutarse nunca.

Arreglado con resolución por plataforma (`components/tabs/PlatformTabsLayout.tsx`

- `.web.tsx`), que es la convención que ya usa el repo: en web Metro empaqueta el
  shim y el paquete nativo no entra en el bundle. Candado en
  `__tests__/tabsLayoutWebSafety.test.ts` para que un `import` directo no lo vuelva
  a romper — el fallo solo se vería al desplegar.

### 2. React Compiler — ✅ REPASADO A FONDO (2026-08-15)

**No mantengas aquí una segunda lista de warnings.** El repaso completo está en
[`docs/desarrollo/WARNINGS.md`](../docs/desarrollo/WARNINGS.md), que es la única
referencia: cuenta actual, reparto por regla y el motivo por el que cada grupo
se queda.

Resumen: **111 → 51 warnings**, sin silenciar ninguno. Lo que quedaba de verdad
(asignaciones tiradas por render, `exhaustive-deps` reales, un ajuste de estado
que leía y escribía un ref en render, y dos efectos que leían en zona muerta)
está arreglado. Los 51 restantes son irreducibles hoy: falsos positivos de
Reanimated, el patrón oficial de "ref al último callback", código congelado
(Wordle) y los tres gigantes exentos por decisión.

- [ ] **Cuando `useEffectEvent` deje de ser experimental**, migrar de golpe la
      categoría `react-hooks/refs` (18 warnings). Es la única acción pendiente
      real y no depende de nosotros.
- [ ] **Subir `react-hooks/refs` a `error`** solo DESPUÉS de esa migración: hoy
      obligaría a poner 18 `eslint-disable` que solo añaden ruido.

Lo único que se pide en el día a día: **no añadir warnings nuevos**. Si tu
cambio sube la cuenta por encima de 51, ese es tuyo.

### 3. Headers que se esconden al hacer scroll — ✅ CERRADO (2026-08-03)

Ya no queda ninguna pantalla con barra opaca fija. Fotos (sin hero) y Calendario
(`headerShown: false`) fueron las dos últimas. **Los headers de evento ya eran
transparentes con glass en iOS** desde junio — este TODO decía lo contrario y
estaba desfasado; en Android/web siguen opacos a propósito, porque allí no hay
glass del sistema que usar.

Pendiente de mirar en dispositivo: que en Fotos y Calendario el contenido no
quede pegado a la barra de estado ni le falte respiro arriba.

### 4. Varios de prioridad alta

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
- [x] **Fase 2 (componentes unificados) — CERRADA (2026-08-03)**:
      `SegmentedControl` creado y adoptado en el calendario, `AppPrimaryButton`
      en `ArrangementInputModal`, `EmptyState` en 11 pantallas (SongList y
      Grupos migrados de sus versiones a mano).

      **Los `TextInput` que quedan NO se migran, y está decidido**: los
                                  buscadores del cantoral y de Grupos son otro patrón (icono dentro, botón
                                  de limpiar); el de `CodeInputModal` es un input INVISIBLE detrás de las
                                  celdas del código; y los de Revisión quedaron, tras el refactor del examen
                                  del día, como campos SIN borde dentro de una fila que sí lo tiene —
                                  `AppTextField` les metería un borde dentro de otro.

## Modo Carismochito (ver `docs/planes/PLAN_CARISMOCHITO.md`)

> Hecho (jun-2026, ver CHANGELOG): confirmar antes de desactivar + salir con un
> par de sacudidas fuertes (sin semáforo), el badge ahora abre la explicación, y
> onboarding persistido con teaser de futuro.

- [ ] **Carismochito aparece en (casi) todas las pantallas** (overlay global),
      excepto materiales/profundiza de evento y canción a pantalla completa.
- [ ] **Colección + contador** al tocar la mascota (animación especial); guardado
      por usuario y **solo con sesión iniciada** (si no, avisar de pérdida de
      progreso).
- [ ] **Widget de los 3 hábitos diarios** (Evangelio/Oración/Revisión) con marca,
      deep-link y recordatorio (notificación local / Carismochito). ⚠️ NATIVO
      (WidgetKit iOS / App Widget Android) → build de tienda + App Group para
      compartir el estado del día con el widget. Empezar por iOS.

## Notificaciones push — mejoras pendientes (alineación con MCM Panel)

> Contexto: ver `docs/contratos/NOTIFICACIONES_CONTRATO.md` (raíz del monorepo).
> La app ya tolera el formato del panel (alias de rutas + `actionButtons[]`).
> Estas mejoras requieren build nativo o trabajo nuevo y por eso quedaron fuera
> de la entrega OTA de 2026-06-02.

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
- [ ] Pasar a Reanimated los core `Animated` que **no** viven dentro de un Modal
      transparente: `WordleScreen`, `notifications`, `PlaylistRow`,
      `OTAUpdatePrompt`, `SongListItem`, `NotificationListItem`,
      `CarismochitoDialogs`. Ninguno tiene un dedo encima, así que funcionan; es
      coherencia, no urgencia.

"Reducir movimiento" ya está completo en toda la app menos Carismochito, que
se queda como está por decisión del usuario (es un huevo de pascua que se
activa a propósito agitando el móvil, quien entre ahí es porque quiere).

---

## Seguridad y observabilidad

- [ ] **Firebase App Check** (DeviceCheck/Play Integrity) para evitar abuso de las API keys públicas (`EXPO_PUBLIC_*`). Ver MEJORAS.md §7.2.
- [ ] **Fichas de privacidad de las tiendas** ⚠️ **bloquea publicar**: con la
      analítica encendida hay que declarar "datos de uso" en App Store y en el
      Data Safety de Play, y decirlo en la política de privacidad. Detalle y
      salida (no poner la clave de Aptabase) en
      `docs/desarrollo/BUILD_AGOSTO_2026.md` §6. Los tres enlaces legales ya
      están dentro de la app (`constants/legalLinks.ts` → pie de "Más").

---

## DX / CI / Build

- [ ] **Documentar criterios de promoción OTA preview → production** (quién valida, cómo se hace rollback). Ver MEJORAS.md §12.2.

---

## Offline / red / PWA

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
