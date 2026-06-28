# TODO — MCM App · Checklist de mantenimiento y mejoras

> Lista de tareas pendientes para mantener y mejorar la app.
> Agentes IA: consultad esta lista antes de trabajar. Al terminar una tarea,
> **eliminadla de aquí** y documentad el cambio en `CHANGELOG.md` (las tareas
> completadas no se acumulan en este archivo).

---

## Prioridad alta

- [ ] **PDF — número de página y pie por canción**: parcial. Hecho: pie con nombre de playlist + "Página N" vía margin boxes de `@page` (funciona en web Chrome ≥131 y Android; iOS/WebKit no los soporta → validar y, si se quiere también en iOS, haría falta paginación JS). Pendiente: el "1 de 3" por canción multipágina — no viable con CSS de impresión, requeriría paginar por JS midiendo alturas.
- [ ] **iPad: habilitar landscape a nivel nativo** — añadir
      `UISupportedInterfaceOrientations~ipad` (las 4 orientaciones) en
      `ios.infoPlist` de `app.json` para que iPad rote (iPhone se queda en
      portrait). ⚠️ Cambio NATIVO → **build de tienda + commit `[skip-ota]`**, no
      OTA. Hacerlo en la próxima release de tienda. Los layouts de iPad (pasada
      del 2026-06-21, ver CHANGELOG) ya están listos para cuando se active.
- [ ] **iPad: verificar en dispositivo real (9/10)** en horizontal y vertical
      todas las pantallas y modales/bottom sheets (la pasada de layouts no se ha
      probado en iPad físico). Posibles ajustes finos tras la prueba.
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
- [ ] **Deep link a un evento/actividad concreto** — hoy el destino navegable es
      `/(tabs)/mas`; no hay ruta estable tipo `/(tabs)/mas/evento/<id>`. Registrar una
      ruta con parámetro `eventId` y propagarla para que una notificación abra el evento
      directamente (Jubileo, visitapapa26, `activities/<nombre>`).
- [ ] **Channels Android por tipo/prioridad** — hoy solo existe el channel `default`
      (importancia MAX), así que `priority` no diferencia el display. Crear channels
      (`urgente`, `eventos`…) para heads-up/sonido diferenciados y permitir que el panel
      mande `channelId`. ⚠️ Puede requerir build nativo.
- [ ] **Usar `data.category` en el centro de notificaciones** — hoy se guarda pero no
      dispara color/icono/agrupación/filtro. Diseñar el tratamiento visual por categoría
      y converger el vocabulario con el panel (`eventos` vs `evento`, `cancionero` vs
      `cantoral`).
- [ ] **(Panel) Corregir el contrato** — que el MCM Panel use las rutas reales,
      segmente por `topics`/`profileType`/`delegationId` (no `userType`/`delegacion`) y
      desacople `categoryId` (solo iOS) de `data.category`. Detalle en
      `docs/contratos/NOTIFICACIONES_CONTRATO.md`.

---

## Mantenimiento

- [ ] **Ampliar cobertura de tests**: ya hay 18 ficheros en `__tests__/` / 183 tests. Hecho en jun-2026: `useSongProcessor` (núcleo del cantoral) y `choirSessionService` (Modo Coro, maestro/oyentes). Pendiente: `useResolvedProfileConfig` (el resolver puro `resolveProfileConfig` ya está cubierto) y al menos una pantalla con render snapshot.

---

## Prioridad baja

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

> Análisis técnico transversal completo en **`docs/planes/MEJORAS.md`** (raíz del monorepo). Cada item de abajo tiene su sección con archivo:línea y propuesta concreta. Los quick wins de aquella primera tanda ya están hechos.

- [ ] **React Compiler** — activar `babel-plugin-react-compiler` (soportado en React 19). Memoiza automáticamente. Ver MEJORAS.md §1.6.
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
