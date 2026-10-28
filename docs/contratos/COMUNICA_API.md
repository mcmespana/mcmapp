# Contrato App ↔ `mcm-comunica-api` (área privada nativa)

> Para quien construya el servidor del área privada nativa. La fuente de la
> verdad son los esquemas zod de
> [`mcm-app/services/comunica/contract.ts`](../../mcm-app/services/comunica/contract.ts):
> este documento los explica en prosa. Si discrepan, manda el código y se
> arregla aquí.
>
> Plan: [`docs/planes/area-nativa/00-contrato-y-servidor-falso.md`](../planes/area-nativa/00-contrato-y-servidor-falso.md).
> Mientras no exista el servidor, la app habla con un **servidor falso** en
> memoria con datos inventados (`mcm-app/services/comunica/fake/`), que
> implementa exactamente esto, autorización y rechazos incluidos: es la mejor
> referencia de comportamiento.

## 1. Reglas generales

- Rutas bajo `/v1/`, JSON, `Authorization: Bearer <token de acceso>` (lo da el
  acceso del plan 02).
- **Errores**: `{ "error": { "code", "message", "reason"? } }`.

  | `code`            | HTTP | Cuándo                                                                                                           |
  | ----------------- | ---- | ---------------------------------------------------------------------------------------------------------------- |
  | `unauthenticated` | 401  | Sin sesión o caducada: la app vuelve a pedir el acceso                                                           |
  | `forbidden`       | 403  | Fuera de tu alcance — **también si no existe**: nunca un 404 que confirme que algo existe fuera de tu delegación |
  | `not_found`       | 404  | Solo para cosas de tu alcance                                                                                    |
  | `validation`      | 422  | La petición no vale; `reason` dice por qué (p. ej. `nothing_marked`)                                             |
  | `crm_unavailable` | 503  | El CRM no contesta. La app deja la escritura en su cola y reintenta                                              |
  | `conflict`        | 409  | —                                                                                                                |
  | `rate_limited`    | 429  | —                                                                                                                |

- **Fechas**: instantes en ISO 8601 **con zona** (`2026-10-25T10:00:00+02:00`);
  días como `YYYY-MM-DD` en hora de Madrid. La trampa del CRM (fechas en UTC
  sin zona) la resuelve el servidor; la app nunca adivina.
- **Ids**: los del CRM, como cadena opaca.
- **Escrituras idempotentes**: llevan `clientId` (UUID v4 del móvil). El mismo
  `clientId` dos veces devuelve el mismo resultado sin escribir otra vez.
- Toda lectura lleva **`generatedAt`** (hora del servidor).
- **Nada de nombres del CRM** en el contrato (`ajmcm_…`, `stic_…`): el servidor
  traduce, con los nombres de `comunicaAreaPrivada/docs/comunica/CAMPOS.md`.
- **La salud nunca viaja en una lectura que el móvil guarda**: solo la marca
  (`badges.healthNote`). El texto, solo en `GET /v1/people/:id/health`, que la
  app pide con conexión y no guarda.
- Todo acotado por **delegación** (`assigned_user_id`, como en el plugin) y
  por los grupos de la persona. Sin paginación: más de 1.000 elementos en una
  respuesta es un fallo de alcance.
- `?fresh=1` en una lectura = «no me des tu caché» (el `?refrescar=1` del
  plugin; lo manda el deslizar para refrescar).

## 2. Vocabulario

El glosario completo está en el plan 00 §1. Lo mínimo:

| Contrato     | Es                                                                                                     | En el CRM                                     |
| ------------ | ------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `Delegation` | delegación                                                                                             | usuario de la delegación (`assigned_user_id`) |
| `Person`     | persona                                                                                                | `Contacts`                                    |
| `Group`      | grupo                                                                                                  | `ajmcm_GRUPOS`                                |
| `stage`      | etapa: `mic`, `com`, `lc`, `apoyo`                                                                     | —                                             |
| `segment`    | `com_1`…`com_3`                                                                                        | `ajmcm_segmento_com_c`                        |
| `Session`    | un sábado, una reunión, un día de evento                                                               | `stic_Sessions`                               |
| `RollCall`   | lista                                                                                                  | `LIS_listas`                                  |
| `Mark`       | marca: `yes`, `partial`, `no_justified`, `no_unjustified`, o `null` = **sin marcar** (no es una falta) | `stic_Attendances`                            |

## 3. Rutas que hay hoy

### Acceso

- `GET /v1/me` → `{ generatedAt, me: Me }`. `Me` = persona, delegación,
  papeles (`monitor`, `coordination`, `accompaniment`, `member`, `guardian`),
  alcance (`'delegation'` o `{ stages?, segments? }`) y `canSeeHealth`.
  (El resto del acceso —código, verificación, refresco, salir— lo define el
  plan 02.)

### Pasar Lista (plan 04)

- `GET /v1/groups` — la **estructura** del curso: grupos de la delegación con
  sus recuentos y monitores, `myGroupIds` (los de la persona; pueden ser
  varios), `stageEvents` (el evento semanal de cada etapa con sus sesiones),
  `hiddenGroups`, `participantsWithoutGroup`. Cambia poco: el móvil la guarda
  12 h.
- `GET /v1/today` — el **estado**: listas del curso de toda la delegación
  (`RollCallSummary`), eventos que empiezan o acaban hoy, cuántos eventos hay
  este curso y, solo a coordinación, la reunión pendiente. El móvil la guarda
  5 min.
- `GET /v1/sessions/:sid/groups/:gid/roll` — una lista: la sesión, el grupo,
  la lista si ya está pasada, sus monitores y una entrada por chaval con su
  marca, su nota y hasta **3 marcas anteriores** (sesiones del mismo evento
  celebradas antes, la última primero).
- `PUT /v1/sessions/:sid/groups/:gid/roll` — guardar (`action: 'save'`, con
  `marks` y `notes` por persona) o «Sin registro» (`action: 'skip'`).
  - Rechazos (`validation` + `reason`): `nothing_marked`, `session_in_future`,
    `already_taken` (un `skip` sobre una lista ya pasada o sin registro).
  - La app manda **personas y marcas, nunca ids de inscripción ni de lista**.
    Si alguien no está inscrito, el servidor lo inscribe; si no puede, vuelve
    en `notSaved` con `no_registration`. Quien ya no está en el grupo,
    `not_in_group`.
  - **No se reescribe lo que no cambia** (ni marca ni motivo iguales).
  - Responde la lista **releída** del CRM, su resumen y `notSaved`.

### Grupos y fichas (plan 05)

- `GET /v1/groups` (el del plan 04) sirve también aquí. `counts.participants`
  puede ser **`null`** = no se sabe (el mapa de relaciones vino a medias y no
  hay recuento fresco): la app no pinta número. **Nunca un cero inventado**
  (`MIS-GRUPOS.md` §8 del plugin).
- `GET /v1/people` → `{ generatedAt, season, seasonClosed, people:
  ParticipantRow[] }`: **todos** los participantes con relación vigente con la
  delegación, con grupo o sin él (`groupId: null` y su
  `unassignedMembershipId`). `ParticipantRow` = persona + `schoolLevel?`
  (`{ key, label }`: la clave de curso —`ep3`…`eso4`, `bach1`, `bach2`,
  `fp_gm`, `fp_gs`, `university`, `other`— o `null` si el texto no se
  reconoce; `label` la corta, «4 EP», «1 ESO»; el curso es el de la relación
  y, si no, el del grupo) + `age?`. Sin curso, el campo no viene.
  `seasonClosed: true` = el curso anterior se cerró y el nuevo no está
  abierto (la app lo explica con el texto del plugin).
- `GET /v1/groups/:id` → `{ generatedAt, group, monitors, participants }`.
  Monitores **sin marcas**. De otra delegación → 403.
- `GET /v1/people/:id` → la ficha (`ParticipantProfile`): persona, grupo
  (`null` = sin grupo), teléfonos en bruto (`own`, `emergency`), familia
  (`guardians`, **de los dos lados de la relación, sin repetidos y con el
  tutor 1 —el primero dado de alta— primero**; con o sin teléfono), las siete
  autorizaciones (`true`/`false`/`null` = sin contestar: **un vacío no es un
  «no»**), marcas, pañuelo (`none`, `red`, `green`, `blue`, `yellow`,
  `cross`, `unknown`), eventos del curso (`status`: su marca, `no_roll`,
  `registered` o `cancelled`), avisos **del curso** (sin número: lo pone la
  app ordenando por fecha e id), `noticeLimit` y la asistencia (`sessions`,
  `marks` con el «sin marcar» explícito como `null`, `reasons`) o `null` si
  no tiene sábados que contar. Solo si la persona tiene relación vigente de
  participante con la delegación; si no, **403 sin decir si existe**. El
  móvil la guarda: **sin datos personales ni salud**.
- `GET /v1/people/:id/personal` → nacimiento, documento (`kindLabel`,
  `number`), dirección en una línea, ciudad, centro, correo, talla, etapa,
  nivel COM y nº de persona. **El móvil no lo guarda nunca** (decisión
  `offline`): solo con conexión.
- `GET /v1/people/:id/photo?v=` → la miniatura. La URL lleva la versión (con
  ella, `max-age` de un año); sin foto no hay `photoUrl` y no se pide. Fuera
  de alcance → **403, no 404**. La app la pide con el token en la cabecera.
- `POST /v1/people/:id/notices` `{ clientId, date, reason, familyNotified,
  sessionId? }` → `WriteResult` + `notice`. Fecha futura → **se recorta a
  hoy** (Madrid); motivo vacío → `validation` / `empty_reason`.
- `PUT /v1/people/:id/scarf` `{ clientId, scarf }` (sin `unknown`) →
  `WriteResult`. No se reescribe si no cambia.
- `PUT /v1/memberships/:id/group` `{ clientId, groupId }` → `WriteResult`.
  **Solo coordinación** (acompañamiento no); el grupo y la RELACIÓN tienen
  que ser de su delegación. Pone grupo a una relación que ya existe; **nunca
  crea una**. Fuera de eso, 403.
- Si el CRM no contesta: `crm_unavailable`, **nunca una lista vacía**.
  Una relación con fin vacío o `0000-00-00` está vigente.

### Coordinación (plan 06)

Esquemas en `services/comunica/contract.ts` (bloque «Coordinación»). Todo de
la delegación de quien llama; el alcance es **la suma** de sus relaciones de
coordinación y acompañamiento vigentes (`alcance-coord`).

- `GET /v1/coordination` → `{ generatedAt, weeklyMonitorsRoll, lastSession,
  team }`. Coordinación o acompañamiento (si no, 403). `weeklyMonitorsRoll`
  solo a coordinación. `team`: `TeamMember[]` ordenados por curso → grupo →
  apellido; los que no van por grupos de Pasar Lista llevan `unassigned`
  `{ membershipId, kind, outsideGroupName? }` (plugin, 24-25/10/2026):
  - `kind: 'none'`: sin grupo de verdad (vacío o el comodín «POR DEFINIR»).
    Se vincula. Solo para quien ve toda la delegación.
  - `kind: 'support'`: de un grupo de **Apoyo** (no pasa lista). Lo ven
    **todas** las coordinaciones, también las de una etapa.
  - `kind: 'outside'`: de otro grupo que no pasa lista (Najar, Ruah…). Solo
    para quien ve toda la delegación; la app lo pliega al final.
- `GET /v1/coordination/summary` → el Resumen de grupos: `{ season, scoped,
  stripLimit, mine, rest, review }`. Todo el equipo. «Sin grupo asignado» de
  `review` = solo **participantes MIC-COM** (no adultos de COM-LC).
- `GET /v1/coordination/monitors-roll?kind=weekly|meeting&stage=&session=` →
  la lista de monitores. Solo coordinación. Semanal: una por etapa del alcance,
  cada una sobre su evento (`stages`, `stage`). Cada fila lleva `optional`:
  en la semanal, `true` para quien no va por grupos (Apoyo, otros grupos, sin
  grupo), que van en la lista de la etapa por defecto, **de joven a mayor**
  (sin fecha de nacimiento, al final y por apellido). En una reunión, nunca.
- `PUT /v1/sessions/:id/monitors-roll` `{ clientId, kind, marks }` →
  `WriteResult` + `rollCall`. **Una marca por fila, ninguna `null`**: el verde
  es un dato y se escribe `yes`. Las filas `optional` sin marcar **no van** y
  no se escriben ni cuentan. El servidor crea las inscripciones que falten, no
  reescribe lo que no cambia, recorta el motivo a 255 y no duplica con el mismo
  `clientId`. Sesión futura (salvo la próxima si no ha empezado ninguna, o una
  reunión) → `validation` / `session_in_future`.
- `GET /v1/coordination/meetings` → las reuniones de programación del curso,
  de la más reciente a la más antigua. Solo coordinación.
- `POST /v1/meetings` `{ clientId, name (1-120), date, startTime, durationHours
  (1 · 1,5 · 2 · 3 · 4) }` → `WriteResult` + `meeting`. Crea el evento del
  curso si no existe.
- `GET /v1/monitors/:id` → la ficha del monitor (sin seguimientos, sin
  familia, sin salud). Coordinación (monitor de su alcance) o acompañamiento;
  si no, 403.
- `GET /v1/monitors/:id/follow-ups` → `{ readable, writable, items }`. **El
  móvil no lo guarda nunca.** Sobre uno mismo, `readable` y `writable`
  vacíos. Incidencias y valoraciones: las escribe coordinación y las leen
  coordinación y acompañamiento; las de acompañamiento, solo acompañamiento.
- `POST /v1/monitors/:id/follow-ups` `{ clientId, type, date, text }` →
  `WriteResult` + `item`. Un tipo que no está en `writable` → 403.
- `POST /v1/events/:id/sessions/today` `{ clientId }` → `WriteResult` +
  `session`; si ya existe, se reutiliza.
- `PUT /v1/memberships/:id/group` (el de Grupos y fichas) vincula también a
  un monitor `unassigned.kind = 'none'`.

### Pasar lista en un evento (plan 07)

Esquemas en `services/comunica/contract.ts` (bloque «Pasar lista en un
evento»). Dos ajustes al catálogo del plan 00: `GET /v1/events/today` pasa a
ser **`GET /v1/events`** (la app clasifica hoy/próximos/pasados), y los grupos
de actividad van **dentro** de `GET /v1/events/:id/roll` (lo que tiene que
funcionar sin cobertura es una sola consulta). Origen en el plugin:
`inc/stic-pasar-lista-eventos.php` (`sticpa_pl_ev_*`) e
`inc/stic-grupos-actividad.php` (`sticpa_gac_*`).

- **Quién**: `monitor`, `coordination` o `accompaniment`; el alcance de
  coordinación no recorta (los eventos son de toda la delegación).
- `GET /v1/events` → `{ generatedAt, season, events: EventSummary[] }`, con
  `EventSummary { id, name, startDate, endDate, startsAt, endsAt }` (días de
  Madrid). **Qué eventos** (`sticpa_pl_ev_clasificar`): de la delegación
  dueña, que tocan el curso (1 sep - 31 ago), con fecha de inicio, de **50
  días o menos**, sin el de sesiones semanales ni el de reuniones. Los
  nacionales no salen (`plans/043`: «para más adelante»).
- `GET /v1/events/:id/roll` → `EventRoll { generatedAt, event, sessions,
  marksBySession, people, notGoing, activity }`. Un evento fuera de la lista
  de arriba → `forbidden`, exista o no.
  - `sessions`: `kind: 'event'`; `[]` = el evento no tiene días en el CRM.
  - `marksBySession`: `sessionId → personId → { mark, reason? }` (nunca
    `null`: sin marcar = no está).
  - `people` (se marcan) y `notGoing` («No van»: cancelada, rechazada, sin
    invitación, no participa; llevan `registrationStatus`). **Una vez por
    persona** (con dos inscripciones, la activa). `EventPerson { person,
    schoolLevel, role, stage, homeGroup, otherDelegation, activityGroupIds }`.
    Curso: el de la inscripción o el de la relación de participante vigente
    más reciente. Etapa: del curso (primaria → `mic`; ESO, Bachillerato, FP →
    `com`), si no la del grupo, si no la de la ficha. `role: 'monitor'` =
    inscrito como organizador **o** con relación vigente de monitor o
    acompañamiento; `'team'` = inscrito como «equipo». Los monitores no
    llevan curso ni `homeGroup`. Sin texto de salud: solo `badges`.
  - `activity { tabs, groups, members }`: de la delegación dueña y de ese
    evento. Los grupos anulados no salen, **salvo** con el evento terminado y
    alguien dentro. Un miembro no inscrito lleva `personId: null` (o uno que
    no está en `people`): se enseña con su `name` y no se marca. Sin el
    módulo en el CRM, todo vacío. La pestaña es `tipo|tanda en minúsculas`
    (la misma clave que Comunica Tools).
- `PUT /v1/events/:id/roll` `{ clientId, sessionId | null, day, marks }` →
  `WriteResult` + `{ sessionId, counts { came, missed }, skipped }`.
  - Solo gente de `people`; el resto vuelve en `skipped`, sin error. Motivo
    hasta 255 (`validation`). **Lo no enviado no se toca** (una marca no se
    borra, como en el plugin).
  - Con `sessionId: null`, busca la sesión de `day` releyendo sin caché y, si
    no hay, **la crea**: la hora del evento si ese día empieza o acaba, si no
    las 9:00; una hora; del dueño del evento. Dos envíos del mismo día crean
    UNA sesión. La app solo manda `null` si hoy cae dentro de las fechas del
    evento.
  - No crea `RollCall` (no cuenta en el Resumen de coordinación).
  - `applied` solo si al releer está todo; si no, `crm_unavailable` y la cola
    reintenta (sin duplicar: misma sesión del día y mismo `clientId`).

### Avisos en el móvil (plan 08)

Registro del móvil y preferencias. Lo que manda el servidor va como
**requisitos** (abajo), no como rutas: no hay más endpoints que estos dos.

- `POST /v1/devices` `DeviceRegistration` → `WriteResult`. Alta o cambio,
  **idempotente por `deviceId`** (y por `clientId`). Lo manda la cola del
  móvil (`key: 'device'`: gana la última) y solo si algo cambió.

  ```
  DeviceRegistration { clientId, deviceId,        // UUID v4 del móvil; con otra persona, otro
    pushToken,                                    // ExponentPushToken[…], el mismo proyecto de Expo que el Panel
    platform: 'ios' | 'android', appVersion,
    channels: { rollCall: 'comunica-listas', groups: 'comunica-grupos' },  // los que crea ESTE bundle
    prefs: { rollCallDue: boolean, groupChanges: boolean } }
  ```

- `DELETE /v1/devices/:deviceId` → 204. Al salir, **directo (no por la
  cola)**, con la sesión aún viva y 3 s de tope, antes del `logout`. Solo el
  tuyo: el de otra sesión → `forbidden`; uno que ya no existe, 204.
- Las dos con sesión (401 sin ella). Ninguna se guarda en la caché del
  móvil (`persist: false`).
- **El `data` de cada aviso** (`ComunicaPushData`, zod en `contract.ts`):
  `{ source: 'comunica', v: 1, id: 'comunica:<uuid>', type:
  'rollcall_due' | 'group_changed' | 'outbox_pending', groupId?, sessionId? }`.
  **Sin texto libre** (lo vigila un test) y **sin rutas**: la app decide a
  dónde va (`utils/comunica/noticeRoutes.ts`). `groupId`/`sessionId` con
  forma `[A-Za-z0-9_-]{1,64}`; otra versión, otro tipo o ids raros → la app
  abre la portada.

**Requisitos para el plan del servidor** (no se diseñan aquí):

1. Guardar los dispositivos. **Un `pushToken`, un dispositivo y una
   persona**: si llega con otro `deviceId`, el anterior se borra. Al cerrar
   o revocar una sesión, borrar sus dispositivos. Borrar los que Expo
   devuelva como `DeviceNotRegistered`.
2. Mandar por la Expo Push API, como el Panel, con el `channelId` que
   declaró el móvil en `channels` (nunca uno escrito a mano: un canal que la
   app no declara, Android lo tira), `data` según `ComunicaPushData`, **sin
   `badge`** (pisaría el contador de la campana) y sin `categoryId`. Si el
   proyecto de Expo tiene la seguridad de push activada, su token de acceso
   va como secreto del servidor.
3. **Ni nombres completos ni salud** en el título, el cuerpo o `data`: la
   pantalla bloqueada la ve cualquiera y el texto pasa por Expo, Apple y
   Google. Solo nombre del grupo, fecha y recuentos; si hace falta un nombre,
   el de pila y la inicial («Lucía H.», decisión `avisos-nombres`, con
   `shortChildName()`; con dos, «Lucía H. y 1 más»).
4. «¿Has pasado lista?»: a los monitores vigentes del grupo, una vez por
   sesión y grupo, **después** del fin de la sesión y solo si no hay lista
   (ni pasada ni «sin registro»), en grupos que pasan lista; nada entre las
   22:00 y las 8:00 de Madrid. Texto: «¿Has pasado lista?» / «C1 · Los Peques,
   sábado 25 de octubre. Si ya la tienes en el móvil, ábrela y se sube
   sola.» Canal `channels.rollCall`; `data` con `groupId` y `sessionId`.
5. «Novedades en tu grupo»: altas y bajas de chavales en los grupos donde la
   persona es monitor, agrupadas (una al día por grupo como mucho). Texto:
   «Novedades en C1 · Los Peques» / «1 chaval nuevo y 1 baja». Canal
   `channels.groups`; `data` con `groupId`.
6. Respetar `prefs`. Con las dos en `false`, no se manda nada a ese móvil.

«Tienes N listas sin subir» (`outbox_pending`) no lo manda el servidor: lo
programa el propio móvil, que es el único que sabe qué hay en su cola.

**Al evento del plan 07** se le añaden, para «Compartir»: `share: { url,
kind: 'public' | 'area' } | null` (la URL la calcula el servidor: la página
pública `…/actividades/?e=<slug o id>` si `web_publicar_c`, y si no la ficha
del área `…/ap/?internalpage=single_stic_events&action=detail&id=…`; `null`
= no se comparte), `place?` y `registrationClosesOn?` (`YYYY-MM-DD`, el día
de fin cuenta entero) y, si se quiere el «aún no abierta», `registrationOpensOn?`.
Mientras no lleguen, la app calcula el enlace igual con `published` y `slug`
(`utils/comunica/eventShare.ts`).

### Mis datos de monitor (plan 09)

- `GET /v1/me/monitor` → `MonitorProfile` (`generatedAt`, los campos
  editables, `files` y `options`). Solo la propia persona y solo con papel
  `monitor` (el id sale del token); si no, 403. **Se guarda en el móvil** (son
  sus datos, sin salud) y se borra al salir. `null` = sin indicar (no es un
  «no»). Campos: `monitorSince` (año de 4 cifras; el CRM guarda `AAAA-01-01`),
  `monitorOf` (`mic`, `com`, `lc`, `apoyo`, `other`), `preMonitors1/2`
  (`no`, `in_progress`, `finished`), `preMonitorsYear` (texto, ≤ 255), `mat`,
  `dat`, `fa` (`no`, `in_progress`, `internship`, `pending_certificate`,
  `certified`), `matCourse` (una clave de `options.matCourses`),
  `datYearAndSchool`, `faYearAndSchool` (≤ 255), `foodHandling` (bool),
  `congresses` (claves de `options.congresses`), `academicBackground`,
  `volunteeringDescription`, `volunteeringPrograms` (≤ 4000),
  `sexOffenceCertificateMode` (`automatic` = `1`, `manual` = `0`, `null` =
  vacío). `files` (`sexOffenceCertificate`, `mat`, `dat`, `otherTraining`):
  los «archivo subido» del CRM, **solo lectura**. `options`: `{ value, label }`
  que da el servidor (crecen cada año). Traducción a nombres del CRM: tabla
  «Datos» de `docs/planes/area-nativa/09-mis-datos-de-monitor.md`.
- `PATCH /v1/me/monitor` `{ clientId, changes }` → `WriteResult`. **Estricto**:
  una clave de más (`files`, un nombre del CRM) → `validation` / `bad_body`;
  una opción que no existe → `validation` / `bad_option`. `changes` lleva SOLO
  lo que cambia, pero la app manda en cada entrada TODO lo que difiere de lo
  último confirmado (en la cola gana la última). El servidor no reescribe lo
  que no cambia y no duplica con el mismo `clientId`. Va por la cola
  (`me.monitor`).
- `POST /v1/me/documents` (multipart: `clientId`, `kind`, `file`) →
  `WriteResult`. `kind`: `sex_offence_certificate`, `mat`, `dat`,
  `other_training`. PDF, JPG o PNG de 1 byte a 6 MB; si no, `validation` con
  `empty_file`, `file_too_big` o `bad_file_type`. Crea un Documento con su
  categoría (`legal_cert_delitos`, `formacion_titulo_mat`, la del DAT —ver las
  preguntas del plan— y `formacion_titulo_otros`), lo ata a la persona, sube la
  revisión, pone su «archivo subido» y lo asigna a la delegación. **Directo,
  con conexión: la app no lo pone en la cola** (el archivo no se guarda en el
  móvil); reintentar va con el mismo `clientId`.

### Varias delegaciones (plan 17)

Quien colabora con otra delegación (coordina Burriana siendo de Castellón)
trabaja con la que elige en un selector. Origen: `sticpa_pl_delegation()`,
`sticpa_pl_team_delegations()` y «Varias delegaciones» de
`PASAR-LISTA-COORDINACION.md` del plugin (23/10/2026).

- `Me.teamDelegations: Delegation[]` (opcional): la de la ficha **la
  primera** y cada una donde tenga una relación **vigente** de monitor,
  coordinación o acompañamiento. Ser participante no cuenta. Sin el campo, la
  app entiende que solo hay la de la ficha. `Me.delegation` sigue siendo la de
  la ficha: manda en lo personal (planes 11-16).
- **Cabecera `X-Comunica-Delegation: <id>`** en toda petición de equipo
  (Pasar Lista, Grupos y fichas, Coordinación, eventos, y `GET /v1/me`). Sin
  cabecera, la de la ficha. Si no es una de `teamDelegations`, 403 con
  `reason: 'wrong_delegation'`. No la llevan: `/v1/auth/…`, `/v1/me/monitor`,
  `/v1/me/documents`, `/v1/devices`, `/v1/profiles/…` y `/v1/web-pass` (lo
  personal), y el servidor la ignora ahí.
- `GET /v1/me` con la cabecera devuelve `roles` y `scope` **de esa
  delegación**: la coordinación de Burriana no vale en Castellón. Una relación
  sin delegación cuenta solo en la de la ficha.
- `GET /v1/groups/:id` lleva `delegationId` y se sirve para **cualquier**
  grupo de las delegaciones del equipo (no solo la de trabajo): si no es la de
  trabajo, la app cambia el selector (un enlace o un aviso a un grupo de
  Burriana abre Burriana).
- **Las escrituras** llevan la cabecera de la delegación con la que se
  hicieron: la cola guarda la delegación en cada entrada y sube con esa,
  aunque luego se cambie el selector.

### Salud

- `GET /v1/people/:id/health` → `{ generatedAt, personId, items: [{ kind,
  text }] }`, con `kind` en `allergies`, `intolerances`, `treatments`,
  `illnesses` y `other`; solo los campos con texto. Solo con
  `canSeeHealth` (si no, 403) y de alguien de la delegación. La app la pide
  con conexión, la tiene un minuto en memoria y no la guarda nunca.
  Mientras no se decida `salud-no`: con «datos de salud» a «No», `items`
  vacío (lo que hace el globo del plugin).

## 4. Lo que vendrá

Cada plan de pantallas añade su trozo al ejecutarse (catálogo en el plan 00
§3): familias (11-16) y el pase a la web del legado
(`POST /v1/web-pass`, plan 10).
