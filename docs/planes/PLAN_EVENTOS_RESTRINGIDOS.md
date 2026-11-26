# Plan — Eventos restringidos a los inscritos

> **Estado (2026-11-26): plan escrito. No se ha empezado.** **No se ejecuta antes
> del 1/12/2026**: el Congreso M+C (27–29/11) ocupa ahora el hueco del evento,
> y no se toca un evento en marcha. Desde el 1/12, cualquier agente que toque
> `mcmapp`, `comunicaMiddleware` o `mcmpanel` dice en una frase que esto está
> pendiente (regla en el `CLAUDE.md` de los tres repos). Esa regla se quita en el
> commit que archive este plan.
>
> Afecta a tres repos: **`comunicaMiddleware`** (un endpoint nuevo y el límite de
> `app-account`), **`mcmpanel`** (el bloque «Acceso» del evento) y **`mcmapp`**
> (la puerta). La app sale entera por **OTA** (✅ solo JS).

---

## Lo que pidió el usuario (26/11/2026)

> Una forma nueva de acceder a los eventos. Si un evento está marcado como
> restringido, la pestaña y el icono de la Home solo los ven quienes están
> inscritos de verdad. Para eso hay que tener la sesión de Comunica iniciada,
> porque con ella sabemos si alguien está inscrito; eso ya lo hace el
> middleware. Hay gente que se baja la app y no ha entrado en Comunica, y gente
> que entra con Apple con el correo oculto, así que no sabemos su correo real.
> Por eso habría dos modos:
>
> - **Restricción total**: solo lo ven los inscritos, sí o sí, y no se explica
>   nada.
> - **Con aviso**: casi cualquiera ve el evento, pero al entrar se le dice:
>   - si tiene la sesión de Comunica y no está inscrito: «No estás inscrito en
>     este evento»;
>   - si no tiene la sesión de Comunica: «Inicia sesión en Comunica para ver
>     este evento».
>
> Y si la persona tiene cuenta en Comunica con el mismo correo con el que entró
> en la app, se le inicia la sesión de Comunica sola.

---

## 0. Lo que hay hoy (comprobado en el código el 26/11/2026)

### 0.1 Eventos en la app

- **Registro**: `mcm-app/constants/events.ts` (`EventConfig`, `EVENTS`). Hoy
  hay tres eventos: `jubileo`, `visitapapa26` (archivado) y `congresomc26`. Un
  evento nuevo **siempre** necesita una entrada aquí. El panel no crea eventos
  visibles por su cuenta.
- **Evento activo**: `activities/_meta.data.activeEventId`, que lee
  `contexts/ActiveEventContext.tsx`. Solo el evento activo con `tabId`
  (`'visitapapa'`, que es el único hueco de pestaña) se destaca.
- **Metadatos por evento**: `activities/<id>/_meta`. Es un nodo **plano** con
  `status`, `title`, `tintColor`, `bannerText`, `heroImageUrl` y `heroSvg`. La
  app lo lee con `useEventsMeta`, guarda una copia en AsyncStorage
  (`eventMeta_<id>`) y lo aplica sobre la configuración con
  `utils/mergeEventMeta.ts`, validando cada campo.
- **⚠️ Bug probable**: `hooks/useCurrentEvent.ts:39` devuelve
  `getEvent(...)`, el registro **en crudo**. El hub y las subpantallas no
  aplican el `_meta`. La puerta lo necesita aplicado, así que se arregla en la
  F3.
- **Por dónde se entra a un evento**. La puerta tiene que cubrir todas estas
  entradas:

  | # | Entrada | Dónde |
  | --- | --- | --- |
  | 1 | Pestaña del evento | `hooks/useVisibleTabs.ts` → los tres layouts de pestañas. Pila en `app/(tabs)/visitapapa/_layout.tsx` |
  | 2 | Botón del evento en la Home | `app/(tabs)/(inicio)/index.tsx` (`quickItems`, ~l.494-566) |
  | 3 | Banner «modo evento» de la Home | mismo fichero (`hasEventAccess` / `showEventBanner`, ~l.269-282) |
  | 4 | Banner «Evalúa la actividad» | mismo fichero (`showEvalBanner`, ~l.345 y l.1025) |
  | 5 | Tarjeta de desbordamiento de la pestaña en «Más» (iOS) | `app/screens/MasHomeScreen.tsx` (~l.123-153) |
  | 6 | Entrada `jubileo` de «Más» y «Eventos pasados» | `MasHomeScreen.tsx` · `app/screens/EventosPasadosScreen.tsx` |
  | 7 | Notificación con `data.eventId` o `internalRoute` | `notifications/usePushNotifications.ts:296-304` → `utils/notificationEventRoute.ts` |
  | 8 | Botón «ir al evento» del buzón | `components/notifications/NotificationDetail.tsx` |
  | 9 | Enlaces `mcmapp://visitapapa/...` y `mcmapp://mas/evento?eventId=...` | `app/+native-intent.ts` (los deja pasar) |
  | 10 | URL directa a una subpantalla (`/mas/horario?eventId=…`) | La pila de «Más» registra **siempre** las pantallas de evento (`app/(tabs)/mas/_layout.tsx`) |

  **Conclusión**: ocultar la pestaña y el botón no basta. Hace falta además una
  puerta en las **pantallas** del evento (hub y subpantallas), que es el único
  punto común a las diez entradas.

### 0.2 La sesión de Comunica en la app

- **Sesión**: `services/comunica/session.ts`. El token de acceso dura 15 min y
  vive en memoria. El de refresco va en `expo-secure-store`. La persona (`Me`)
  se guarda en AsyncStorage. Las funciones son `initSession`,
  `getSessionState`, `subscribeSession`, `signIn`, `signOut` y `withSession`.
- **Uso fuera de la pestaña Comunica**: el `ComunicaAreaProvider` y sus hooks
  (`useMe`, `useRegistrations`…) solo están montados dentro de esa pestaña.
  Fuera se hace como `hooks/usePanueloScarf.ts`: `initSession()` y luego
  `getSessionState()` + `subscribeSession`.
- **`Me` no trae el correo.** Trae `personId` (id de contacto del CRM),
  `delegation`, `roles`… Los hijos salen de `GET /v1/me/profiles`.
- **Entrar con la cuenta de la app ya existe**: `services/comunica/appAccount.ts`
  (`checkAppAccount()`) manda el `idToken` de Firebase a
  `POST /v1/auth/app-account`. Puede contestar:
  - `ready`: una ficha con ese correo, ya hay sesión;
  - `choose`: varias fichas, la persona elige «¿Quién eres?»;
  - `no_match`;
  - `failed`.
- **Desde el 14/11 la app no entra sola**: comprueba la cuenta y la persona
  pulsa «Entrar en Comunica» (`AccessScreen.tsx` ~l.147-171). Si alguien sale
  de Comunica a propósito, se guarda en `comunica.appAccount.optOut` y la app
  ya no entra sola. **Este plan cambia esa regla, pero solo para los eventos
  restringidos** (§2.4): lo pide el usuario en este encargo.
- **Apple con «ocultar mi correo»** no se trata en ningún sitio. Ese correo
  (`…@privaterelay.appleid.com`) da `no_match`.

### 0.3 El middleware (`comunicaMiddleware`)

- **Identidad**: id de contacto del CRM. Token propio HMAC de 15 min. Sesión en
  Supabase de 1 año, que se renueva con el uso. Detalle en
  `docs/ACCESO-APP.md`.
- **`POST /v1/auth/app-account`**:
  - verifica el `idToken` sin librerías (Google o Apple, proyecto
    `mcmappconsolacion`);
  - busca las fichas con ese correo con `peopleByEmail`, en cualquier dirección
    de la ficha;
  - aplica `enter()`: una ficha → sesión; varias → `choose`; ninguna → 422
    `no_match`.
- **⚠️ Límite que choca con este plan**: `appAccount` apunta **30 por IP y
  hora** *antes* de comprobar el pase, compartido con el envío de códigos
  (`src/app/auth.ts:195`). En un encuentro, cientos de móviles salen por la
  misma wifi con una sola IP. La entrada automática agotaría el cupo en minutos
  y dejaría a todo el local también sin poder pedir código. Se arregla en la F2.
- **Una ficha sin delegación** (`assigned_user_id` vacío) no consigue sesión de
  la app (403 `wrong_delegation` en `loadPrincipal`).
- **Inscripciones**:
  - `GET /v1/profiles/:pid/events` devuelve `signedUp` (con
    `myRegistrationStatus`), solo de −14 a +12 meses;
  - `GET /v1/profiles/:pid/events/:eventId` devuelve `myRegistrationId`;
  - `GET /v1/profiles/:pid/registrations` devuelve todas, también las
    canceladas.

  No hay una consulta del tipo «¿estoy inscrito en X, Y o Z?», y
  `myRegistrationStatus` pone «Con plaza» igual a quien está en lista de espera
  que a quien está confirmado.
- **Qué cuenta hoy como inscripción activa** (`src/app/reg-status.ts`): el
  `status` no está en `GONE_STATUSES = {dropped, not_participate, cancelled}`.
  Entran por tanto `confirmed`, `invited`, `uninvited`, `maybe`,
  `participates`, `waiting_list`, `rejected` y el estado vacío.
- **Un evento del CRM se identifica** por `stic_events.id` (UUID) o por
  `stic_events_cstm.web_slug_c`. Ya hay una consulta que acepta las dos cosas
  (`SQL_PE_EVENT_BY_SLUG`). **El mismo encuentro en dos delegaciones son dos
  eventos distintos del CRM.**
- **No hay ninguna relación** entre los ids de la app (`congresomc26`) y los
  del CRM.

### 0.4 El panel (`mcmpanel`)

- **Metadatos del evento**: `src/components/sections/ActivitiesSection.tsx`.
  `EventMeta` tiene `status`, `title`, `tintColor`, `bannerText`,
  `heroImageUrl`, `heroSvg` y `updatedAt`. Se escribe con
  `handleEventMetaUpdate` → `update()` del camino `activities/<id>/_meta`
  completo (`src/lib/activityWrites.ts`).
- **No hay ningún control de acceso por evento** (ni audiencia, ni perfil, ni
  delegación) y **no llama nunca al middleware**.

### 0.5 Los datos del evento en Firebase son públicos

`activities/<id>/<sección>` se puede leer sin sesión. Con las reglas
desplegadas o sin ellas, la sección se sigue pudiendo leer. **Esta puerta
controla lo que se ve en la app, no la confidencialidad de los datos.** Alguien
con conocimientos puede leer el horario de un evento restringido directamente
de Firebase. Ver la decisión D4.

---

## 1. Qué se construye (resumen)

1. En el **panel**, cada evento tiene un bloque «Acceso» con estos campos:
   - el **modo**: Abierto · Solo inscritos, con aviso · Solo inscritos,
     invisible;
   - **a qué eventos del CRM corresponde**: uno por delegación, se pega el
     enlace de Comunica o el id;
   - si **cuentan los hijos inscritos**;
   - un texto opcional.
2. El **middleware** contesta en una sola llamada si quien ha entrado (o un hijo
   suyo) tiene una inscripción válida en alguno de esos eventos del CRM:
   `GET /v1/me/event-access`.
3. La **app** calcula, para cada evento restringido, uno de estos estados:
   - **abierto**: el evento no está restringido o la persona es admin;
   - **concedido**;
   - **comprobando**;
   - **falta Comunica**;
   - **no inscrito**;
   - **no se puede comprobar**.

   Con ese estado:
   - **modo invisible**: el evento solo aparece (pestaña, botón, banner, «Más»)
     si el estado es *concedido*;
   - **modo con aviso**: el evento aparece siempre, y al entrar se ve la
     pantalla de aviso que toca, con la cabecera del evento;
   - **los dos modos**: las pantallas del evento llevan la puerta, de modo que
     entrar por un enlace o una notificación no se la salta.
4. **Entrada automática en Comunica.** Si hay un evento restringido, no hay
   sesión de Comunica y hay cuenta de la app con un correo que no está oculto,
   la app llama a `app-account` en segundo plano. Según la respuesta:
   - **una ficha**: entra sola, sin pulsar;
   - **varias**: en modo aviso se ofrece «¿Quién eres?»;
   - **ninguna**: se ofrece entrar con código.
5. **Caché en el móvil.** Un «concedido» se guarda para que el evento funcione
   **sin conexión** en el local. Un «no inscrito» se olvida en pocos minutos,
   por si la persona se acaba de inscribir.

---

## 2. Diseño

### 2.1 Contrato en Firebase: `activities/<id>/_meta.access`

Va dentro del `_meta` plano que ya edita el panel. Así no hay nodo nuevo, ni
regla nueva, y la app ya lo descarga.

```jsonc
"activities": {
  "congresomc27": {
    "_meta": {
      "title": "Congreso M+C 2027",
      "tintColor": "#E15C62",
      "updatedAt": "2027-01-10T09:00:00.000Z",
      "access": {
        "mode": "notice",            // "open" | "notice" | "strict". Ausente u "open" = como hoy
        "crmEvents": [               // 1–20. Id del CRM o slug web (web_slug_c), tal cual
          "4f1c2a9e-0b7d-4c8e-9a51-2d3e4f5a6b7c",
          "congreso-mc-2027-valencia"
        ],
        "family": true,              // ¿cuentan los hijos inscritos? Ausente = true
        "message": "Si no te has inscrito, habla con tu monitor."   // opcional, ≤ 280
      }
    }
  }
}
```

**Validación** (la misma en la app y en el panel, en ficheros espejo
`mcm-app/utils/eventAccess.ts` ↔ `mcmpanel/src/lib/eventAccess.ts`):

- Un `mode` desconocido se trata como `notice`. Si alguien escribe mal el modo,
  **no se abre el evento**: es más seguro cerrar.
- `crmEvents`:
  - cada entrada tiene que cumplir `^[A-Za-z0-9-]{1,36}$` (id) o
    `^[A-Za-z0-9._~-]{1,100}$` (slug);
  - las que no cumplen se descartan;
  - como mucho 20.
- `mode` ≠ `open` con `crmEvents` vacío no da acceso a nadie que no sea admin.
  El panel **no deja guardar** así (§2.7), pero la app también lo aguanta.
- `message`: se recorta y se trunca a 280 caracteres. Es texto plano.
- `access` ausente es **exactamente lo de hoy**. Los eventos actuales no
  cambian.

> Por qué en `_meta` y no en `events.ts`: así el modo se cambia desde el panel
> sin OTA, y además sirve de **interruptor de emergencia**. Si el día del
> evento algo falla, se pone «Abierto» desde el panel y todo el mundo entra.

### 2.2 Endpoint nuevo: `GET /v1/me/event-access`

En `comunicaMiddleware`, con acceso `app` (`Authorization: Bearer`).
**Solo lectura y por SQL**, como todo lo que lee.

```
GET /v1/me/event-access?events=<id o slug>,<id o slug>,…
```

- `events` lleva de 1 a 20 entradas, validadas con `isCrmId` o con la expresión
  del slug. Si alguna no vale, 422 `validation`.
- **A quién mira**: a quien ha entrado (`principal.personId`) y a sus hijos con
  relación vigente, con `childrenOf(db, personId, now)`, lo mismo que
  `/v1/me/profiles`. **Nunca a otras fichas del mismo correo**: la sesión es de
  una ficha.
- **Consultas nuevas** (constantes `SQL_…` en `src/reads/event-access.ts`, con
  `deleted = 0` en cada tabla y en cada enlace):
  - `SQL_EA_EVENTS`: traduce las entradas a ids.
    ```sql
    SELECT e.id, ec.web_slug_c AS slug
    FROM stic_events e LEFT JOIN stic_events_cstm ec ON ec.id_c = e.id
    WHERE e.deleted = 0 AND (e.id IN (?) OR ec.web_slug_c IN (?))
    ```
  - `SQL_EA_REGISTRATIONS`: las inscripciones de esas personas en esos eventos.
    ```sql
    SELECT rc.stic_registrations_contactscontacts_ida AS contact_id,
           re.stic_registrations_stic_eventsstic_events_ida AS event_id,
           r.status
    FROM stic_registrations r
    JOIN stic_registrations_contacts_c rc ON rc.stic_registrations_contactsstic_registrations_idb = r.id AND rc.deleted = 0
    JOIN stic_registrations_stic_events_c re ON re.stic_registrations_stic_eventsstic_registrations_idb = r.id AND re.deleted = 0
    WHERE r.deleted = 0
      AND rc.stic_registrations_contactscontacts_ida IN (?)
      AND re.stic_registrations_stic_eventsstic_events_ida IN (?)
    ```
    Los nombres de columna están copiados de `SQL_PE_REGISTRATIONS`
    (`src/reads/profile-events.ts`). En la F0 se comprueban contra
    `docs/bbdd/ESQUEMA.md`.
- **Qué cuenta como inscrito** (decisión D1): una función nueva y pura en
  `src/app/reg-status.ts`:
  ```ts
  /** Da acceso a un evento restringido de la app (PLAN_EVENTOS_RESTRINGIDOS, D1). */
  export const grantsEventAccess = (raw: unknown) =>
    !isGone(raw) && !NO_ACCESS_STATUSES.has(norm(raw)) // { 'rejected', 'waiting_list' }
  ```
- **Respuesta**: va en `src/contract.ts` y en la copia de la app, `read(...)`
  con `generatedAt`.
  ```ts
  export const EventAccess = read({
    /** Clave: la entrada TAL CUAL se pidió (id o slug), para que la app la empareje. */
    events: z.record(z.string(), z.object({ self: z.boolean(), child: z.boolean() })),
  })
  ```
  - Una entrada que no existe o que está borrada contesta
    `{ self: false, child: false }`, **sin 404**: no se dice si un evento
    existe.
  - **No se devuelve qué hijo** ni ningún dato personal; solo booleanos.
- **Cabeceras**: `sensitive: true` (`no-store, private`). Que alguien esté
  inscrito en una actividad de un movimiento católico es un dato de categoría
  especial.
- **Registros**: solo el número de entradas y el tiempo. Ni ids de evento
  juntos con la persona.
- **`MW_OFF=1`**: 503 `switched_off`, como todo. La app lo trata como «no se
  puede comprobar» (§2.5).
- **Sin papel de equipo**: los monitores no tienen pase especial. Si no están
  inscritos, no entran; los coordinadores suelen estar inscritos. Los admins de
  la app sí lo tienen, pero en la app (D5).

### 2.3 Límite de `app-account` (para no tumbar una wifi compartida)

Hoy (`src/app/auth.ts:192-196`) se apunta `ip:<hash>` con un máximo de 30 por
hora **antes** de verificar el pase, y es el mismo contador que el del envío de
códigos. Cambio:

1. Se verifica el pase **primero**. Un pase malo sigue contando en el contador
   de IP de siempre (30 por hora), para que nadie use la ruta para probar.
2. Con un pase válido, el contador es **por cuenta**: `uid:<hash(sub)>`, con 10
   por hora. Es más que suficiente: la app hace como mucho una llamada por
   arranque y nunca más de una cada 6 h por sí sola (§2.4).
3. Además, un tope **por IP solo para pases válidos**, `appip:<hash>`, de 600
   por hora. Es un freno ante un abuso masivo sin castigar a un local con 300
   personas.

Hay que poner al día `docs/ACCESO-APP.md` y `test/app-auth.test.ts`. **Se
despliega antes que la app.**

### 2.4 La app: estado de acceso y entrada automática

**Piezas nuevas**:

| Fichero | Qué |
| --- | --- |
| `utils/eventAccess.ts` | Puro: `parseEventAccess(raw)` → `EventAccessRule \| null` y `decideEventAccess(input)` → `{ state, visible }`. Con tests |
| `services/comunica/eventAccess.ts` | `checkEventAccess(rule)`: llama al endpoint con `withSession` y guarda la caché (§2.5) |
| `contexts/EventAccessContext.tsx` | Proveedor en la raíz, por dentro de `AuthProvider` y `ActiveEventProvider`. Calcula el estado de **cada evento del registro con regla** y lo expone con `useEventAccess(eventId)` |
| `services/comunica/appAccount.ts` (amplía) | `autoEnterForRestrictedEvent()`: la entrada automática de abajo |
| `components/events/EventGate.tsx` | La puerta: pantalla de aviso o neutra (§2.6) |

**`EventConfig` y el merge**: se añade `access?: EventAccessRule` a
`EventConfig`. `mergeEventMeta` lo copia validado con `parseEventAccess`. Además
se arregla `useCurrentEvent` para que devuelva el evento **con el merge
aplicado** (el bug de §0.1).

**Estados** (`decideEventAccess`):

| Estado | Cuándo | Modo con aviso | Modo invisible |
| --- | --- | --- | --- |
| `open` | Sin regla, `mode: open`, o admin (D5) | Se ve y se entra | Se ve y se entra |
| `granted` | El endpoint (o la caché válida) dice `self`, o `child` con `family` | Se ve y se entra | Se ve y se entra |
| `checking` | Hay sesión de Comunica y la respuesta está en camino, sin caché | Se ve; al entrar, esqueleto | **No se ve** |
| `needs-comunica` | Sin sesión de Comunica y sin entrada automática posible (o pendiente de elegir) | Se ve; al entrar, «Inicia sesión en Comunica» | No se ve |
| `not-enrolled` | Sesión de Comunica y el endpoint dice que no | Se ve; al entrar, «No te encontramos entre los inscritos» | No se ve |
| `unavailable` | Error de red, 503 o el middleware apagado, sin caché válida | Se ve; al entrar, «No podemos comprobarlo ahora» + Reintentar | No se ve (D6) |

**Cuándo se comprueba**:

- al arrancar la app;
- al cambiar la sesión de Comunica (`subscribeSession`);
- al volver a primer plano (`AppState`), como mucho una vez cada 5 min;
- al pulsar «Comprobar otra vez» en la puerta.

**Solo se llama al middleware si existe algún evento con regla** que sea el
activo, o que esté en «Más»/«Eventos pasados». Quien no tiene eventos
restringidos no genera tráfico.

**Entrada automática en Comunica** (`autoEnterForRestrictedEvent`). Se intenta
solo si se cumple **todo**:

1. hay al menos un evento restringido que se pueda ver (el activo o alguno de
   «Más»);
2. no hay sesión de Comunica (`getSessionState().status === 'signedOut'`);
3. hay cuenta de la app (`useAuth().user`) y su correo **no** termina en
   `@privaterelay.appleid.com`. Ese correo siempre da `no_match` y gastaría
   cupo;
4. la persona **no** ha salido de Comunica a propósito
   (`comunica.appAccount.optOut`). Quien salió para cambiar de ficha no entra
   solo;
5. no se ha intentado en las últimas 6 h. Hay que guardar la marca
   `eventAccess.autoEnter.lastTry`; con un `no_match`, 24 h.

Resultado:

- **`ready`**: `signIn(...)` sin pulsar nada. Sale un aviso discreto, «Hemos
  entrado en Comunica con tu cuenta (correo)», con el `Toast` que ya use la
  app, y se comprueba el acceso.
- **`choose`**: se guardan las opciones en memoria.
  - En modo **aviso**, la puerta enseña «Elige quién eres para ver el evento» y
    lleva a `/comunica/acceso-elegir` con `returnTo`.
  - En modo **invisible** no se enseña nada: el evento seguirá oculto hasta que
    la persona entre en Comunica por su cuenta. Es la contrapartida de «no se
    explica nada» (§4, riesgos).
- **`no_match` o `failed`**: nada. Se queda en `needs-comunica`.

> Esto **revisa la regla del 14/11** («la app ya no entra sola») **solo para
> este caso**: lo pide el usuario. La regla general de la pestaña Comunica no
> cambia. Quien abre esa pestaña sigue viendo «Entrar como <correo>» y pulsando.

**Notificaciones**: al pasar a `granted`, la app suscribe sola al tema
`event-<id>` (`EventSubscriptionsContext`). Así los inscritos reciben los avisos
del evento aunque no hayan abierto nunca el hub, y el panel ya sabe mandar a
ese tema. En modo invisible, al pasar de `granted` a otro estado (por ejemplo,
se canceló la inscripción) se quita la suscripción.

### 2.5 La caché

En AsyncStorage, clave `@eventAccess/v1`:

```ts
{ [personId]: { [ruleKey]: { granted: boolean; at: number } } }
// ruleKey = hash de crmEvents ordenados + family
```

- **`granted: true` vale 21 días.** Se usa al instante y **se vuelve a pedir**
  en cada comprobación con conexión. Es lo que permite abrir el horario
  **sin cobertura en el local** si la persona abrió la app con conexión alguna
  vez en las tres semanas anteriores.
- **`granted: false` vale 10 min.** Así, quien se inscribe en el último
  momento lo ve enseguida.
- La clave incluye `ruleKey`: si el panel cambia los eventos del CRM de la
  regla, la caché anterior deja de valer.
- **Al salir de Comunica, o si la sesión se revoca, se borra entera.** El
  acceso es de la ficha, no del móvil.
- **Error sin caché**: `unavailable`. Con caché vencida pero `granted: true`
  de hace menos de 60 días, la app confía en ella *solo si la red falla*
  (`stale-if-error`). Esto se decide en D6.

### 2.6 Dónde se aplica

**Visibilidad (modo invisible)**: un evento con `visible: false` desaparece de:

- `useVisibleTabs`: se quita el `tabId` del evento activo, igual que se hace ya
  con los archivados;
- la Home: `hasEventAccess` se combina con `visible`, lo que apaga a la vez el
  botón, el banner y «Evalúa»;
- `MasHomeScreen`: la tarjeta de desbordamiento y la entrada `jubileo` si
  algún día ese evento lleva regla;
- `EventosPasadosScreen`: se filtran los que no se ven.

En modo **aviso** todo eso se queda como hoy, porque el evento se ve.

**La puerta (los dos modos)**: `EventGate` envuelve el hub y **cada
subpantalla**. Se monta en un solo sitio, `renderEventScreens`
(`app/screens/eventStackScreens.tsx`), con un `withEventGate(Screen)`. Así
cubre las dos pilas (`visitapapa` y `mas`) y las entradas 7-10 de §0.1. Además
corta la carga de datos: hasta que el estado es `open` o `granted`, la pantalla
real no se monta, así que tampoco pide nada a Firebase.

**Qué pinta la puerta**. Territorio **Evento** (`design.md` §2): estructura
institucional con el `tintColor` del evento. Piezas aprobadas (§7):
`ScreenHero` con el logo y el título del evento, `EmptyState` para el mensaje,
`AppPrimaryButton color={tint}` para la acción y `ListSkeleton` mientras
comprueba. Nada nuevo inventado.

| Estado (modo aviso) | Título | Texto | Acción |
| --- | --- | --- | --- |
| `needs-comunica` | Inicia sesión en Comunica para ver este evento | Este evento es solo para quienes están inscritos. Entra con el correo con el que hiciste la inscripción. | **Entrar en Comunica** → `/comunica/acceso?returnTo=<ruta del evento>` |
| `needs-comunica` + correo oculto de Apple | (igual) | Añade: «Entraste en la app con Apple ocultando tu correo, así que no podemos reconocerte solos. Entra con el correo de tu inscripción.» | (igual) |
| `needs-comunica` + `choose` pendiente | Elige quién eres | Tu correo tiene varias fichas en Comunica. Elige con cuál te inscribiste. | **Elegir** → `/comunica/acceso-elegir?returnTo=…` |
| `not-enrolled` | No te encontramos entre los inscritos | Has entrado en Comunica como **{nombre}** y no vemos una inscripción en este evento. Si te inscribiste con otra ficha o con otro correo, entra con ella. + `message` del panel | **Comprobar otra vez** · secundario: **Entrar con otra ficha** (cierra la sesión de Comunica con confirmación y abre el acceso) |
| `unavailable` | No podemos comprobarlo ahora | Inténtalo en un momento. | **Reintentar** |
| `checking` | — | `ListSkeleton` | — |

**Modo invisible y alguien llega por un enlace o una notificación**: no se
explica nada. Sale una pantalla neutra, `EmptyState` «Este contenido no está
disponible» con el botón «Volver al inicio». No dice que el evento existe ni
por qué.

**Volver después de entrar**: `AccessScreen` acepta `returnTo`, que solo admite
rutas internas que empiecen por `/visitapapa` o `/mas/`. Tras `signIn` hace
`router.replace(returnTo)`. La puerta además se repinta sola, porque escucha la
sesión.

**Textos**: neutros de género («No te encontramos entre los inscritos», no «No
estás inscrito/a»), en español de España con tuteo, sin la palabra «error».

### 2.7 El panel

En `ActivitiesSection.tsx`, dentro de los metadatos del evento y debajo del
logo, un bloque **«Acceso al evento»**:

- **Modo**: `Select` con «Abierto (como hasta ahora)», «Solo inscritos, con
  aviso» y «Solo inscritos, invisible». Bajo cada opción, una línea que dice lo
  que verá la gente.
- **Eventos del CRM**: un campo «Pega el enlace del evento en Comunica o su id»
  con el botón «Añadir», y debajo la lista de fichas con su botón de quitar.
  `extractCrmEventRef(input)`, en `src/lib/eventAccess.ts`, entiende:
  - el enlace público de Comunica (`…?e=<slug o id>`);
  - el enlace del CRM (`…record=<id>`);
  - un id;
  - un slug.

  Recordatorio en gris: «Un evento por delegación: el mismo encuentro en dos
  delegaciones son dos eventos del CRM».
- **«Cuentan los hijos inscritos»**: `Switch`, encendido por defecto.
- **Mensaje para quien no está inscrito**: `Textarea`, opcional, con un máximo
  de 280.
- **Validación**:
  - con un modo distinto de «Abierto» y sin eventos del CRM, el bloque se pone
    en rojo y **no se guarda** («Sin eventos del CRM nadie podría entrar»);
  - con el modo «invisible», un aviso ámbar: «Quien no haya entrado en Comunica
    no verá el evento ni sabrá que existe».
- **Escritura**: `handleEventMetaUpdate({ access })`, por el camino de siempre
  (`update()` de `activities/<id>/_meta`). Volver a «Abierto» guarda
  `mode: "open"` **sin borrar la lista**, para que reactivarlo sea un clic.
- **Lista de actividades**: un candado 🔒 junto a cada evento restringido.
- **Notificaciones**: si el enlace «Abrir un evento» apunta a un evento
  restringido y la audiencia no es `event-<id>`, aparece una pista: «Solo
  podrán abrirlo los inscritos; quizá quieras mandarlo a los suscritos del
  evento».
- Hay que poner al día la tabla de secciones del `CLAUDE.md` del panel (fila
  Actividades).

> Lo que **no** hace el panel en la v1: comprobar contra el CRM que el id
> existe. El panel no habla con el middleware y abrirle esa puerta (con un
> secreto en el navegador) es peor que el problema. Lo comprueba la F8 con un
> móvil de verdad.

---

## 3. Fases

Orden: **F0 → F1 ∥ F2 → F3 → F4 → (F5 ∥ F6) → F7 → F8 → F9**. La F7 (panel)
puede empezar en cuanto esté la F3, porque solo necesita el contrato.

| Fase | Qué | Repo | Modelo | Despliegue |
| --- | --- | --- | --- | --- |
| **F0** | Comprobar supuestos (abajo) | los tres (leer) | Sonnet | — |
| **F1** | `GET /v1/me/event-access`: consultas, `grantsEventAccess`, contrato, ruta en el registro, tests (`routes`, `sql-guard`, `mariadb` con dos delegaciones y una inscripción borrada, una `rejected` y una en lista de espera), documento | `comunicaMiddleware` | Opus | Vercel (compatible hacia atrás: ruta nueva) |
| **F2** | Límite de `app-account` por cuenta (§2.3) + tests + `ACCESO-APP.md` | `comunicaMiddleware` | Opus | Vercel, **antes de la F4 en `preview`** |
| **F3** | `utils/eventAccess.ts` (parse + decide, con tests de todos los estados), `access` en `EventConfig`/`mergeEventMeta`, arreglo de `useCurrentEvent`, copia del contrato (`EventAccess` y `getEventAccess` en `client.ts` y en el servidor falso) | `mcmapp` | Sonnet | OTA ✅ (sin efecto visible: ningún evento lleva regla) |
| **F4** | `services/comunica/eventAccess.ts` + caché, `EventAccessContext`, `autoEnterForRestrictedEvent`, suscripción al tema | `mcmapp` | Opus | OTA ✅ |
| **F5** | Visibilidad en modo invisible: `useVisibleTabs`, Home, «Más», «Eventos pasados» | `mcmapp` | Sonnet | OTA ✅ |
| **F6** | `EventGate` + `withEventGate` en `renderEventScreens` + `returnTo` en el acceso + textos | `mcmapp` | Opus | OTA ✅ |
| **F7** | Bloque «Acceso al evento», `src/lib/eventAccess.ts` (espejo), candado en la lista, pista en Notificaciones, `CLAUDE.md` | `mcmpanel` | Sonnet | Vercel |
| **F8** | Prueba de punta a punta con un **evento de prueba** (abajo) en `preview` | los tres | usuario + agente | — |
| **F9** | Documentación viva (`EVENTOS.md` §«Eventos restringidos», `COMUNICA_API.md`, contrato del panel), `CHANGELOG`, archivar el plan, **quitar el recordatorio de los tres `CLAUDE.md`** | los tres | Sonnet | — |

### F0 — Lo que hay que comprobar antes de escribir código

1. Las columnas de `SQL_EA_*` contra `comunicaMiddleware/docs/bbdd/ESQUEMA.md`.
   En particular, el enlace `stic_events_cstm.id_c` y si `web_slug_c` está
   indexado. Si no lo está, la consulta por slug es de una sola fila: se acepta.
2. **Cómo se pasan las listas a `IN (?)`** en `src/reads/ficha.ts:128` o en
   `eventos.ts:61`, y hacerlo igual. `sql-guard` prohíbe los huecos `${…}`.
3. **Si `useEventsMeta` vuelve a pedir el `_meta` al abrir la app** o si se
   queda con la copia de AsyncStorage. El interruptor de emergencia depende de
   que «Abierto» llegue en minutos, no en días.
4. El bug de `useCurrentEvent` (§0.1): confirmarlo y ver si el hub pinta el
   logo por otro camino.
5. Con el MCP de SinergiaCRM, **contar las inscripciones por estado** de un
   evento real (el Congreso M+C de alguna delegación). Así se ve cuánta gente
   hay en `waiting_list`, `uninvited` o `maybe` y se responde a D1 con datos.
6. Qué `Toast` o aviso discreto usa ya la app fuera de Comunica, para el «Hemos
   entrado en Comunica».

### F8 — Prueba real (matriz)

Hace falta un **evento de prueba** en el registro (`pruebaacceso`, sin
`tabId`, solo en «Más» y detrás del Laboratorio Alpha) y en el CRM, con fichas
de prueba. Si no, se usa el próximo evento de verdad en modo aviso, con el
interruptor a mano.

| # | Persona | Modo | Esperado |
| --- | --- | --- | --- |
| 1 | Inscrita, sesión de Comunica | aviso / invisible | Entra / lo ve y entra |
| 2 | Inscrita, sin Comunica, Google con el mismo correo | invisible | Al arrancar entra sola en Comunica y el evento aparece |
| 3 | Igual que la 2, pero salió de Comunica a propósito | aviso | «Inicia sesión en Comunica»; **no** entra sola |
| 4 | Inscrita, Apple con el correo oculto | aviso | Texto del correo oculto → entra con código → vuelve al evento con acceso |
| 5 | Inscrita, correo compartido con su hijo (dos fichas) | aviso | «Elige quién eres» → elige → acceso |
| 6 | Igual que la 5 | invisible | No lo ve hasta que entra en Comunica por su cuenta (limitación aceptada) |
| 7 | Padre o madre con un hijo inscrito, `family: true` / `false` | aviso | Entra / «No te encontramos» |
| 8 | Inscripción `rejected` o `waiting_list` | aviso | «No te encontramos» (según D1) |
| 9 | Sin inscripción, sesión de Comunica | invisible | No lo ve. Por enlace o notificación, pantalla neutra |
| 10 | Se inscribe en ese momento | aviso | «Comprobar otra vez» → acceso (como mucho 10 min por la caché) |
| 11 | Inscrita, en modo avión después de haber entrado | los dos | Entra (caché) |
| 12 | `MW_OFF=1` sin caché | aviso / invisible | «No podemos comprobarlo» / no lo ve |
| 13 | Panel cambia a «Abierto» | — | Todo el mundo entra en minutos |
| 14 | Admin de la app (D5) | invisible | Lo ve con la etiqueta «Restringido: lo ves por ser admin» |
| 15 | 50 arranques desde la misma IP (script contra `preview`) | — | Sin 429 para pases válidos |

---

## 4. Riesgos y cómo se cubren

| Riesgo | Cobertura |
| --- | --- |
| **Binarios viejos que no reciben la OTA** ignoran `access` y enseñan el evento | Un evento **nuevo** registrado solo en el bundle nuevo no existe para un bundle viejo: `getEvent` cae al de por defecto. Para restringir un evento que ya existe, subir `global.minAppVersion` |
| **Wifi compartida en el local** agota el límite de `app-account` | F2 (límite por cuenta) + la entrada automática como mucho cada 6 h + no llamar con el correo oculto de Apple |
| **Sin cobertura el día del evento** | Caché positiva de 21 días; la comprobación se hace al arrancar, días antes |
| **El middleware se cae o se apaga** | Interruptor del panel a «Abierto» y `stale-if-error` (D6) |
| **Correo compartido entre varias fichas** en modo invisible | Limitación aceptada. Si molesta, la v2 sería un endpoint que, con el `idToken`, mire **todas** las fichas del correo sin abrir sesión |
| **Ficha sin delegación** (`wrong_delegation`) no puede entrar en Comunica | La oficina técnica arregla la ficha en el CRM. Se detecta en la F8 |
| **Dato sensible** (inscrito en una actividad religiosa, menores) | Endpoint `sensitive`, solo booleanos, registros sin ids, caché en el móvil borrada al salir |
| **Los datos del evento en Firebase siguen siendo públicos** | D4. En la v1 no se ponen teléfonos ni datos personales en un evento restringido |
| **Alguien se salta la puerta** con un enlace o una notificación | `withEventGate` en `renderEventScreens` cubre todas las pantallas de evento de las dos pilas |

---

## 5. 🔒 Decisiones del usuario

Mientras una no esté contestada, se sigue la recomendada.

| # | Pregunta | Recomendación |
| --- | --- | --- |
| **D1** | ¿Qué estados de inscripción dan acceso? | Todos los activos **menos `rejected` y `waiting_list`**: entran `confirmed`, `participates`, `invited`, `uninvited`, `maybe` y el vacío. Se confirma con los números de la F0.5 |
| **D2** | ¿Un padre o una madre con un hijo inscrito ve el evento? | **Sí por defecto**, con el interruptor «Cuentan los hijos inscritos» por evento (apagarlo en encuentros de jóvenes donde los padres no pintan nada) |
| **D3** | ¿Entrar solo en Comunica sin pulsar? | **Ya decidido por el usuario en este encargo**: sí, pero solo por un evento restringido, con una sola ficha y respetando a quien salió a propósito |
| **D4** | ¿Basta con ocultar (v1) o hace falta que los datos no se puedan leer? | **Basta con ocultar en la v1**. Si un evento necesita datos de verdad privados (teléfonos, listas con nombres), la v2 los sirve el middleware o se protegen con reglas de Firebase y *custom claims* |
| **D5** | ¿Los admins de la app (`users/<uid>/isAdmin`) ven los restringidos? | **Sí**, con una etiqueta que lo dice, para poder preparar y probar el evento |
| **D6** | Si no se puede comprobar y no hay caché | **Cerrado** (aviso: «No podemos comprobarlo»; invisible: no se ve), con `stale-if-error` de 60 días para quien ya tuvo acceso. La salida de emergencia es el panel |
| **D7** | ¿Cómo se dice qué eventos del CRM son? | **Pegando enlaces o ids en el panel** (no toca el CRM). Alternativa: un campo nuevo en `stic_events` con el id de la app, para que cada delegación lo marque en el CRM. Pide crearlo en Studio y apuntarlo en `CAMPOS.md` |
| **D8** | En modo aviso, al que no está inscrito, ¿le ofrecemos «Inscribirme» si las inscripciones siguen abiertas? | **No en la v1**. Si se quiere, la v1.1 mira si el evento del CRM de su delegación está en `toSignUp` y enlaza a `actividades/[eventId]/inscribirme` |

---

## 6. Fuera de alcance (v1)

- Restringir **secciones** sueltas de un evento (solo el horario de monitores,
  por ejemplo). Se podría con `access` por sección, pero no se ha pedido.
- Restringir por papel (solo monitores) o por delegación sin inscripción.
- Proteger los datos en Firebase (D4).
- Comprobar desde el panel que un id del CRM existe.
