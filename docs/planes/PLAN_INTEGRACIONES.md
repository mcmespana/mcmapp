# PLAN_INTEGRACIONES — Coherencia mcmapp ↔ mcmpanel ↔ mcmapp-cantoral

> Resultado de la auditoría de integraciones (2026-07-06). Cada acción es
> **autocontenida y ejecutable por separado**: pide "ejecuta la acción B1" (o
> "las acciones A1 y A2") y con el contexto de este documento basta.
>
> Convención: **[app]** = repo `mcmapp` (código en `mcm-app/`),
> **[panel]** = repo `mcmpanel`, **[cantoral]** = repo `mcmapp-cantoral`.

---

## ✅ Arreglos ya aplicados en la auditoría (2026-07-06)

No requieren acción, se listan para contexto:

1. **[panel]** El selector de evento del composer de notificaciones usaba el id
   `visitapapa` — el id real del registry de la app es `visitapapa26` (topic
   `event-visitapapa26`). Corregido en `NotificationsSection.tsx`.
2. **[panel]** "Marcar como evento activo global" escribía `activities/_meta`
   en plano (`{activeEventId, updatedAt}`); la app espera
   `{updatedAt, data: {activeEventId}}`. Corregido en `ActivitiesSection.tsx`
   (lee ambas formas, escribe la canónica).
3. **[panel]** Reordenar canciones en el Cantoral guardaba `/songs` solo con
   `{data, updatedAt}`, borrando las colas `ediciones`/`solicitudes`/`fallitos`
   que escribe la app. Corregido en `SongsSection.tsx`.
4. **[panel]** El listener en tiempo real de la raíz (`JSONManager`) pisaba las
   ediciones locales sin guardar cada vez que la app escribía cualquier cosa
   (heartbeats de `/pushTokens` cada pocos minutos por dispositivo), y el
   guardado escribía el estado ya pisado → pérdida silenciosa de cambios.
   Corregido: el refresco remoto respeta las secciones con cambios pendientes
   y el guardado escribe siempre el valor pendiente.
5. **Docs**: reescritos `mcmpanel/CLAUDE.md` y `mcmpanel/AGENTS.md` (estaban
   desfasados: Lovable, secciones inexistentes); simplificado
   `mcmpanel/docs/notificaciones-contrato-mcm-app.md`; actualizado
   `PANEL_PERFILES.md` (delegationList derivada, catálogos con `visitapapa` y
   `eventos-pasados`, checklist cerrado); `EVENTOS.md` documenta
   `activities/_meta`; `SEGURIDAD.md` avisa de que las reglas NO se pueden
   desplegar aún; `NOTIFICACIONES.md` corrige el límite del título (50).

---

## Integración A — Notificaciones

### A1. Filtrar el historial in-app por audiencia · [app] · prioridad ALTA · ✅ HECHO (2026-07-07)

> Implementado: `utils/notificationAudience.ts` (lógica pura + tests en
> `__tests__/notificationAudience.test.ts`), aplicado en
> `contexts/NotificationsContext.tsx` (lista visible + contador del badge). El
> campo `audience` se tipó en `types/notifications.ts` y el contrato lo
> documenta en §7.ter (`NOTIFICACIONES_CONTRATO.md`). Retrocompatible: registro
> sin `audience` → visible para todos.

**Problema**: el panel segmenta el envío push (`audience` de 4 ejes), pero la
app pinta TODO el nodo `/notifications` en el centro de notificaciones. Una
notificación "solo monitores de Madrid" la ve cualquiera que abra la campana.

**Acción**: en la app, al listar el historial de Firebase
(`services/pushNotificationService.ts → getNotificationsHistory/subscribeToNotifications`
y su consumo en `app/notifications.tsx`), filtrar cada registro contra el
usuario actual usando `notification.audience` (misma semántica que
`mcmpanel/src/lib/audience.ts → tokenMatchesAudience`):

- Usuario = `profileType` + `delegationId` (de `UserProfileContext`) + topics
  resueltos (`useResolvedProfileConfig().notificationTopics` + suscripciones
  `event-<id>` de `EventSubscriptionsContext`).
- Registro sin `audience` (o sin ejes activos) → visible para todos
  (retrocompatible con el histórico).
- Añadir tests en `__tests__` (la lógica de match puede vivir en
  `utils/notificationAudience.ts` puro).

### A2. Proteger los endpoints de envío · [panel] · prioridad ALTA

**Problema**: `POST /api/notifications/send` y `/api/notifications/schedule`
no exigen ninguna credencial: cualquiera que descubra la URL del panel puede
mandar push a todos los usuarios. Solo el cron (`process-scheduled`) valida
`CRON_SECRET`.

**Acción mínima** (consciente de sus límites): exigir un secreto compartido
(`x-panel-key` header) validado en `send.ts` y `schedule.ts` contra una env de
Vercel (`PANEL_API_KEY`), y que el frontend lo envíe tras el login. Como el
login del panel es client-side, el secreto acaba en el bundle: esto solo sube
el listón. La solución real es la Integración D (auth de verdad).

### A3. Poblar el selector de eventos desde `/activities` · [panel] · prioridad BAJA · ✅ HECHO (2026-07-07)

> Implementado en `NotificationsSection.tsx`: se suscribe a `/activities`
> (excluyendo `_meta`) + legacy `jubileo` y une sus ids a `eventOptions` con 0
> suscriptores; la etiqueta usa `/activities/<id>/_meta.title` si existe. El id
> del nodo coincide con el id del registry de la app y con el topic `event-<id>`
> (verificado con `visitapapa26` en `constants/events.ts`), así que el filtrado
> sigue siendo correcto.

**Problema**: el desplegable "evento" del composer se autodescubre de los
topics `event-*` presentes en `/pushTokens` + una lista hardcodeada
(`EVENT_LABELS`). Un evento nuevo sin suscriptores y no listado no aparece.

**Acción**: unir también los ids de los nodos de `/activities` (excluyendo
`_meta`) y `jubileo` al construir `eventOptions` en `NotificationsSection.tsx`,
con su `_meta.title` como etiqueta si existe.

### A4. Mejoras ya identificadas en el contrato · [app] · prioridad BAJA · 🔎 VALORADA (2026-07-07)

Referencia: `docs/contratos/NOTIFICACIONES_CONTRATO.md § Mejoras futuras` —
NSE de iOS para imagen en la notificación del sistema, deep link a un evento
concreto, channels Android por tipo, uso visual de `data.category`.

**Valoración (2026-07-07).** A4 agrupa cuatro mejoras heterogéneas; conviene
tratarlas por separado, no como un bloque. Ordenadas de menor a mayor riesgo:

1. **Uso visual de `data.category`** · app · riesgo BAJO · sin nativo · sin
   panel · ✅ **HECHO (2026-07-07)**. Implementado: helper puro
   `utils/notificationCategory.ts` (`categoryVisual(category)` → etiqueta, color
   legible e icono; `general`/ausente/desconocida → sin chip) con test
   `__tests__/notificationCategory.test.ts`, consumido desde la tarjeta y el
   modal de `app/notifications.tsx`. Contrato §6 y §(e) actualizados. Sin nativo
   → entra por OTA.
2. **Channels Android por tipo** · app · riesgo MEDIO · nativo-runtime. Hoy
   existe un único channel `default` (importancia MAX). Crear channels por
   tipo/prioridad (`usePushNotifications.ts`) permitiría al usuario silenciar
   solo unos. Cuidado: cambiar channels afecta a la entrega de los existentes y
   requiere que el panel mande `channelId`; es cross-repo y conviene coordinarlo
   con `§8`/`§9` del contrato. **Posterior**, con su propio plan.
3. **Deep link a un evento concreto** · app + panel · sin nativo · ✅ **HECHO
   (2026-07-07)**. Convención: el panel manda `data.eventId` (id del registry);
   la app lo resuelve a la ruta del hub del evento
   (`utils/notificationEventRoute.ts` → `/(tabs)/<tabId>` o `/(tabs)/mas` para
   los archivados; id desconocido → fallback normal). Prioritario sobre
   `internalRoute`. Wired en el handler de respuesta de push
   (`usePushNotifications.ts`) y con botón "Ir al evento" en el modal
   (`app/notifications.tsx`). Panel: opción "🎉 Abrir un evento…" en el composer
   (`NotificationsSection.tsx`), propagado por `send`/`schedule`/
   `process-scheduled` y persistido en el registro. Aditivo y de impacto cero
   hasta que un admin lo use. Tests: `__tests__/notificationEventRoute.test.ts`.
   Contrato §4 y §(e). Nota: el evento debe estar en `constants/events.ts`
   (relacionado con B1, que sigue pendiente).
4. **NSE de iOS (imagen en la notificación del sistema)** · app · riesgo ALTO ·
   **nativo**. Requiere un Notification Service Extension (nuevo target iOS +
   config plugin), NO se puede OTA y obliga a build de tienda (`[skip-ota]`).
   Es el de mayor coste/riesgo y el que menos aporta (la imagen ya se ve en el
   modal in-app). **No hacer sin decisión explícita**; candidato a quedar fuera
   de alcance salvo petición concreta.

**Recomendación**: en la siguiente iteración, abordar solo el punto 1 (visual de
`data.category`) de forma autocontenida y con tests; dejar 2–4 como acciones
separadas con su propio plan y, en el caso del NSE, decidir antes si merece la
pena. No implementar A4 como bloque para no arriesgar la estabilidad del centro
de notificaciones.

**Estado A4 (2026-07-07):** hechos los puntos **1 (visual de `data.category`)** y
**3 (deep link a evento)** — ambos sin nativo, entregables por OTA/Vercel.
**Pendientes:** el punto **2 (channels Android)** y el **4 (NSE de iOS)**.
- **A4.2 (channels Android)**: técnicamente OTA, pero NO es de impacto cero —
  crear channels extra hace que aparezcan canales (posiblemente vacíos) en los
  ajustes del sistema de TODOS los Android, es difícil de revertir y necesita
  prueba en dispositivo real para validar el heads-up. Requiere además que el
  panel mande `channelId` (cross-repo). Se deja pendiente de decisión explícita
  y prueba en dispositivo, para no arriesgar la entrega de push a ciegas.
- **A4.4 (NSE de iOS)**: único que exige **build de tienda**. Fuera de alcance
  salvo petición concreta.

---

## Qué falta del PLAN (estado a 2026-07-07)

Resumen para retomar. ✅ hecho · ⏳ pendiente.

**Integración A — Notificaciones**
- ✅ A1 · filtrar historial in-app por audiencia · [app]
- ⏳ A2 · proteger endpoints de envío (`x-panel-key` + `PANEL_API_KEY`) · [panel]
  · prioridad ALTA · **sin empezar** (la solución real es la Integración D)
- ✅ A3 · poblar selector de eventos desde `/activities` · [panel]
- ◐ A4 · **parcial**: hechos el uso visual de `data.category` (A4.1) y el deep
  link a un evento vía `data.eventId` (A4.3); pendientes channels Android por
  tipo (A4.2, OTA pero no de impacto cero, necesita prueba en dispositivo) y NSE
  de iOS (A4.4, nativo, requiere build de tienda) · [app]

**Integración B — Eventos**
- ✅ B1 · consumir `activities/<id>/_meta` en la app (title/tint/banner/status)
  · [app] · **para el evento activo** (banner/hub) — ver nota abajo
- ✅ B2 · sincerar la UI de metadatos del panel · [panel] (aviso preciso en el
  card, no bloqueante)
- ✅ B3 · aviso al crear actividad ("no aparece hasta registrarla en
  `events.ts`") · [panel]
- ✅ B4 · guardar `/activities` con escrituras granulares (no pisar
  `evaluacion/respuestas` ni `compartiendo`) · [panel] — implementado con
  `update()` multi-path por subruta editada. ⚠️ **Pendiente un smoke test contra
  Firebase real** (guardar mientras llega una respuesta de evaluación) — ver nota
  en la sección B4 abajo.

**Integración C — Perfiles** (todo pendiente)
- ⏳ C1 · retirar gestión manual de `delegationList` (derivarla) · [panel] · MEDIA
- ⏳ C2 · unificar seeds de `profileConfig` (app como fuente) · [panel] · BAJA
- ⏳ C3 · documentar `appReviewMode` en el contrato + tipar opcionales · [app] · BAJA
- ⏳ C4 · completar validaciones del §5 (override, semver, slug, tabs sin
  `index`) · [panel] · BAJA

**Integración D — Seguridad Firebase** (todo pendiente · prioridad MÁXIMA)
- ⏳ D1 · credencial de servidor en `api/_lib/push.ts` (`?auth=`) · [panel]
- ⏳ D2 · auth real para escrituras del panel (Firebase Auth + `/admins`, o
  mover escrituras a `api/`) · [panel]
- ⏳ D3 · completar `database.rules.json` (`/scheduledNotifications`, lecturas
  del panel, `/users`) · [app]
- ⏳ D4 · desplegar reglas + smoke test app y panel
- ⏳ D5 · verificar `CRON_SECRET` en Vercel
- ⚠️ **No desplegar las reglas** (`deploy-firebase-rules.yml`) hasta completar
  D1–D3: hoy romperían el panel entero (ver `docs/SEGURIDAD.md`).

**Integración E — Cantoral** (pendiente)
- ⏳ E1 · proteger ediciones del panel frente al uploader (opción a: cantoral
  del panel solo-lectura) · [panel]/[cantoral] · MEDIA
- ✅ E2 · nota de coherencia `updatedAt` · sin acción

**Orden sugerido para continuar:** D (seguridad, único con riesgo de incidente)
→ A2 → C1/C2 → E1 → resto de prioridad baja. Pendientes de verificación en
entorno real: **B4** (smoke test en Firebase). Dejar A4.4 (NSE iOS) y A4.2
(channels Android) para cuando se decida/haya dispositivo de prueba.

---

## Integración B — Eventos y sus secciones

### B1. Consumir `activities/<id>/_meta` en la app · [app] · prioridad MEDIA · ✅ HECHO (2026-07-07)

> Implementado para el **evento activo**: `utils/mergeEventMeta.ts` (merge puro
> con validación: title/bannerText no vacíos, tintColor hex, status ∈
> active|archived) + `hooks/useEventMeta.ts` (lee el nodo PLANO
> `activities/<id>/_meta` con caché offline; OJO: NO es `{updatedAt,data}` como
> el global, por eso no usa `useFirebaseData`). Aplicado en
> `ActiveEventContext.tsx`: el banner de la Home y el hub del evento activo ya
> reflejan title/tintColor/bannerText/status del panel sin publicar la app.
> Tests: `__tests__/mergeEventMeta.test.ts`.
>
> **Alcance/pendiente**: el merge se aplica al **evento activo** (el caso de más
> valor). Falta, si se quiere, mergear `_meta` de eventos NO activos para que la
> lista "Eventos pasados" respete `status: archived` puesto desde el panel
> (`getArchivedEvents()` sigue leyendo el registry). Es un follow-up de bajo
> riesgo (aplicar `mergeEventMeta` también en el consumo de la lista de eventos).

**Problema**: el panel edita `title`, `tintColor`, `bannerText` y `status`
(activo/archivado) por evento, pero la app lo ignora todo: el registry
(`constants/events.ts`) está hardcodeado. Hoy solo funciona
`activities/_meta.data.activeEventId` (evento activo global).

**Acción**: en la app, mergear `activities/<id>/_meta` (con caché
`useFirebaseData`-style y fallback al registry) sobre la `EventConfig` local:
`title`, `tintColor`, `bannerText`, `status`. Con esto el panel podría archivar
un evento o cambiar el banner sin release. Nota: crear un evento 100% nuevo
seguirá requiriendo registrarlo en `events.ts` (las `sections` y pantallas son
código).

### B2. Sincerar la UI de metadatos del panel · [panel] · prioridad MEDIA · ✅ HECHO (2026-07-07)

> Implementado: aviso preciso (no bloqueante) en el card "Metadatos del evento"
> de `ActivitiesSection.tsx` explicando que la app aplica Título/Color/Banner al
> **evento activo** sin publicar versión, y que el Estado y los eventos no
> activos dependen aún del registry (`constants/events.ts`). Refleja el alcance
> real de B1 en vez de deshabilitar campos.

### B3. Avisar al crear una actividad nueva · [panel] · prioridad BAJA · ✅ HECHO (2026-07-07)

> Implementado: aviso ámbar en el diálogo "Crear Nueva Actividad"
> (`ActivitiesSection.tsx`) — "el evento no aparecerá en la app hasta
> registrarlo en `mcm-app/constants/events.ts`; aquí solo se crea el nodo de
> datos en Firebase (ver EVENTOS.md)".

### B4. No pisar datos que escribe la app al guardar `/activities` · [panel] · prioridad MEDIA · ✅ HECHO (2026-07-07)

> Implementado: `src/lib/activityWrites.ts` (helper puro: traduce la subruta
> editada a ruta Firebase, colapsa solapamientos y resuelve valores) +
> `JSONManager.tsx` (guarda Actividades/Jubileo con un único `update()`
> multi-path de SOLO las subrutas que el admin tocó, en vez de `set('/activities')`).
> `ActivitiesSection.tsx` reporta la subruta editada (`onUpdate(data, editedPath)`).
> Con esto:
> - `activities/<evento>/evaluacion/respuestas` y los subnodos NO editados nunca
>   se sobrescriben (antes se perdían en la carrera con la app).
> - Se corrige de paso un clobber preexistente: cada edición de Actividades
>   reescribía TODO `/jubileo` (incluido `jubileo/compartiendo`); ahora solo se
>   escribe la sección realmente editada.
> - Fallback seguro: si no hay rutas rastreadas, cae al `set()` de nodo completo
>   de antes. Las demás secciones no cambian.
> Lógica pura verificada con 13 checks (colapso de rutas, valores frescos,
> `evaluacion` nunca escrito).
>
> ⚠️ **Smoke test pendiente contra Firebase real** (no reproducible en este
> entorno): editar una subsección y guardar mientras un dispositivo escribe una
> respuesta de evaluación / una reflexión en `compartiendo`, y confirmar que
> ninguna se pierde. Recomendado antes de dar por cerrada la verificación en
> producción.

**Problema**: el guardado del panel hace `set()` del nodo `/activities`
completo con su copia en memoria. La app escribe dentro de ese árbol
(`<evento>/evaluacion/respuestas/<deviceId>` y `<evento>/compartiendo`): una
respuesta que llegue entre el snapshot y el `set()` se pierde.

**Acción**: guardar Actividades con escrituras granulares (`update()` multi-path
por subsección editada: `activities/<evento>/<subseccion>` y
`activities/_meta`) en vez de `set('/activities')`. Aplicar el mismo criterio
a `/jubileo` (subnodo `compartiendo`) y revisar `/app` (subnodo `feedback`,
`evaluations`).

> **Análisis (2026-07-07) — por qué se deja pendiente y con cuidado.** El
> guardado vive en `JSONManager.tsx → writePending()`, que hace
> `set('/${key}', pendingUpdates[key])` para CADA sección (es el camino de
> guardado **compartido por todas las secciones**, no solo Actividades). Riesgos
> a tener en cuenta antes de tocarlo:
> - `pendingUpdates` guarda el **valor completo** de la sección, no un diff, así
>   que no se sabe qué subruta editó el admin. Preservar a ciegas
>   `compartiendo`/`respuestas` del remoto **pisaría** una edición legítima del
>   admin en esas subsecciones (el panel tiene `CompartiendoSubsection`).
> - La solución correcta necesita **rastrear las subrutas editadas** (p. ej. que
>   `ActivitiesSection`/`updateSectionData` registren rutas tipo
>   `activities/<evento>/<subseccion>` y `activities/<evento>/_meta` y
>   `activities/_meta`) y hacer `update()` multi-path solo de esas.
> - Al ser el guardado común, un fallo aquí afecta a TODAS las secciones →
>   conviene diseñarlo aparte, con pruebas contra Firebase real (envío de una
>   respuesta de evaluación mientras el admin guarda) antes de production.
> **Recomendación**: hacerlo en su propia iteración, empezando por Actividades y
> `/jubileo` (subnodo `compartiendo`), y de paso revisar `/app`
> (`feedback`/`evaluations`).

---

## Integración C — Perfiles, visibilidad y onboarding

### C1. Retirar la gestión manual de `delegationList` · [panel] · prioridad MEDIA

**Contexto**: la app deriva la lista de delegaciones de `data.delegations` e
ignora `delegationList` (ver PANEL_PERFILES.md §1.4 actualizado). El panel
sigue manteniendo la lista a mano (`DelegationsEditor.tsx`, flag "hidden") y
sugiere un control (orden/ocultar) que no existe.

**Acción**: en `DelegationsEditor.tsx` eliminar la edición de
`delegationList`/"hidden" y derivarla al guardar (igual que la app:
`Object.keys(delegations)` sin `_default`) para mantener el nodo coherente
para consumidores internos del panel (composer de notificaciones). Quitar las
validaciones de desincronización en `ProfileConfigSection.tsx`, ya sin sentido.

### C2. Unificar los seeds de profileConfig · [panel] · prioridad BAJA

`mcmpanel/src/lib/profileConfigSeed.ts` y
`mcm-app/firebase-seed/profileConfig.json` han divergido (tabs/homeButtons
distintos, panel sin las 16 delegaciones). **Acción**: hacer del JSON de la app
la única fuente (copiar su contenido al seed del panel y anotar en ambos
ficheros que se sincronizan a mano, o importarlo en build si se prefiere).

### C3. Documentar `appReviewMode` en el contrato · [app] · prioridad BAJA

El panel escribe `global.appReviewMode` + `data.appReviewBackup` (modo revisión
de stores que oculta Cantoral/Comunica reescribiendo perfiles). La app no
conoce esos campos (los ignora — el efecto llega vía tabs reescritas).
**Acción**: añadir una sección breve a `PANEL_PERFILES.md` explicando el
mecanismo y, opcionalmente, tipar ambos campos como opcionales en
`mcm-app/types/profileConfig.ts` para que el contrato de tipos sea completo.

### C4. Completar validaciones del §5 del contrato · [panel] · prioridad BAJA

Revisar que el guardado de Perfiles valide: clave de override malformada
(bloquear), `minAppVersion` semver (bloquear), slugify de `notificationTopic`,
y aviso si `tabs` no contiene `index`. Hoy `ProfileConfigSection.tsx` solo
avisa de tabs vacías, calendarios inexistentes y (ya sin sentido, ver C1)
desincronización de delegationList.

---

## Integración D — Seguridad Firebase (transversal) · prioridad MÁXIMA

> **Nota de repriorización (2026-07-22):** la app está en **beta privada**,
> no en gran producción, así que esto deja de ser una urgencia de incidente
> activo — no hay prisa. Sigue siendo **importante** hacerlo bien antes de
> escalar a más usuarios. Alcance en el repo `mcmapp`: solo **D3** (completar
> `database.rules.json`); D1/D2/D4/D5 viven en `mcmpanel` y requieren
> añadirlo a la sesión. Orden real de ejecución y decisión bloqueante (D2) en
> `docs/planes/BACKLOG.md` §1 y §4.

**Contexto** (ver aviso en `docs/SEGURIDAD.md`): `mcm-app/database.rules.json`
asume que el panel escribe con Admin SDK, pero el panel usa el SDK cliente sin
auth y sus funciones `api/` usan REST sin token. Hoy las reglas reales de
producción están abiertas; desplegar las del repo rompería el panel entero.
Hay un workflow (`deploy-firebase-rules.yml`) listo para desplegarlas en
cuanto alguien configure el secret — **riesgo de rotura accidental**.

Secuencia (no desplegar reglas hasta completar D1–D3):

### D1. Dar credencial de servidor a las funciones del panel · [panel]

`api/_lib/push.ts`: añadir `?auth=<FIREBASE_DB_SECRET>` (o token de service
account) a todas las llamadas REST, con la env en Vercel. Es lo que ya hace el
uploader del cantoral.

### D2. Auth real para las escrituras del panel · [panel]

Opción recomendada: Firebase Auth (Google) en el panel + nodo `/admins/<uid>`
y reglas `".write": "auth != null && root.child('admins').child(auth.uid).val() === true"`
para los nodos de contenido. Alternativa más rápida: mover TODAS las
escrituras del panel a funciones `api/` (protegidas con D1 + sesión), dejando
el frontend solo-lectura. Decidir y ejecutar.

### D3. Completar las reglas · [app]

Añadir a `database.rules.json`: nodo `/scheduledNotifications` (hoy ausente =
denegado), lecturas que el panel necesita según lo decidido en D2 (p. ej.
`/pushTokens` solo desde servidor), y revisar `/users` (el panel lista todos
los usuarios y escribe `isAdmin`; con D2 pasaría a reglas de admin).

### D4. Desplegar y smoke test

Desplegar reglas (`firebase deploy --only database`), probar: app (cantoral,
eventos, notificaciones, reflexiones, evaluaciones, login/Contigo, tokens) y
panel (cada sección + envío push + programadas).

### D5. `CRON_SECRET` en Vercel

Verificar que `CRON_SECRET` está configurado en producción para
`process-scheduled` (si no, cualquiera puede forzar el procesado; el daño es
limitado pero gratis de cerrar).

---

## Integración E — Cantoral (mcmapp-cantoral → /songs)

### E1. Proteger las ediciones del panel frente al uploader · [panel]/[cantoral] · prioridad MEDIA

**Problema**: la fuente de verdad de `/songs/data` es el repo cantoral: cada
push a `main` regenera `songs-vX.json` y hace **PUT completo** de
`songs/data`. Cualquier edición hecha en la sección Cantoral del panel
(reordenar, editar canción) que no haya pasado por el repo se pierde en el
siguiente push. El flujo de vuelta existente es la cola `songs/ediciones`
(app → `sincronizaCambiosDeFirebase.py` → ficheros `.cho`), no el panel.

**Acción** (elegir una):
- (a) Hacer la edición de canciones del panel **solo lectura** (mantener
  gestión de `fallitos`/`solicitudes`, que sí es su función real), con nota
  "el cantoral se edita en el repo mcmapp-cantoral"; o
- (b) que las ediciones del panel escriban también en `songs/ediciones` para
  que el script las sincronice al repo.
  Recomendación: (a), es lo simple y honesto con el flujo real.

### E2. Nota de coherencia `updatedAt` · sin acción

El uploader escribe `songs/updatedAt` como epoch (string numérica) y el panel
como ISO. La app solo compara strings por desigualdad, así que funciona. Si
algún día se ordena por fecha, unificar a ISO.

---

## Orden sugerido si se ejecuta todo

1. **D** completa (seguridad) — es lo único con riesgo real de incidente.
2. **A1 + A2** (notificaciones: privacidad del historial + endpoints).
3. **B2 + B4** (panel honesto y sin pisar datos), luego **B1** cuando haya
   hueco de app release/OTA.
4. **C1 + C2** (perfiles), **E1** (cantoral), y el resto de prioridad baja.
