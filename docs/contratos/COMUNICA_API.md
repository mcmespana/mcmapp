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
§3): coordinación (06), eventos (07), avisos (08), mis
datos de monitor (09), familias (11-16) y el pase a la web del legado
(`POST /v1/web-pass`, plan 10).
