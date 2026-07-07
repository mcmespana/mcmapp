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

### A1. Filtrar el historial in-app por audiencia · [app] · prioridad ALTA

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

### A3. Poblar el selector de eventos desde `/activities` · [panel] · prioridad BAJA

**Problema**: el desplegable "evento" del composer se autodescubre de los
topics `event-*` presentes en `/pushTokens` + una lista hardcodeada
(`EVENT_LABELS`). Un evento nuevo sin suscriptores y no listado no aparece.

**Acción**: unir también los ids de los nodos de `/activities` (excluyendo
`_meta`) y `jubileo` al construir `eventOptions` en `NotificationsSection.tsx`,
con su `_meta.title` como etiqueta si existe.

### A4. Mejoras ya identificadas en el contrato · [app] · prioridad BAJA

Referencia: `docs/contratos/NOTIFICACIONES_CONTRATO.md § Mejoras futuras` —
NSE de iOS para imagen en la notificación del sistema, deep link a un evento
concreto, channels Android por tipo, uso visual de `data.category`.

---

## Integración B — Eventos y sus secciones

### B1. Consumir `activities/<id>/_meta` en la app · [app] · prioridad MEDIA

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

### B2. Sincerar la UI de metadatos del panel · [panel] · prioridad MEDIA

Mientras B1 no esté hecho, el card "Metadatos del evento" de
`ActivitiesSection.tsx` es engañoso (el admin cambia "Estado en la app" y no
pasa nada). **Acción**: añadir un aviso visible en ese card ("la app aún no
lee estos campos, solo el evento activo global") o deshabilitar los campos no
consumidos. Retirar el aviso al completar B1.

### B3. Avisar al crear una actividad nueva · [panel] · prioridad BAJA

**Acción**: en el diálogo "Crear Nueva Actividad", añadir nota: "El evento no
aparecerá en la app hasta que se registre en `mcm-app/constants/events.ts`
(ver EVENTOS.md del repo mcmapp)".

### B4. No pisar datos que escribe la app al guardar `/activities` · [panel] · prioridad MEDIA

**Problema**: el guardado del panel hace `set()` del nodo `/activities`
completo con su copia en memoria. La app escribe dentro de ese árbol
(`<evento>/evaluacion/respuestas/<deviceId>` y `<evento>/compartiendo`): una
respuesta que llegue entre el snapshot y el `set()` se pierde.

**Acción**: guardar Actividades con escrituras granulares (`update()` multi-path
por subsección editada: `activities/<evento>/<subseccion>` y
`activities/_meta`) en vez de `set('/activities')`. Aplicar el mismo criterio
a `/jubileo` (subnodo `compartiendo`) y revisar `/app` (subnodo `feedback`,
`evaluations`).

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
