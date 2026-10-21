# 00 — Contrato de la API y servidor falso

> **Estado:** 🟢 listo para ejecutar en `nuevoComunicaChulo` · **Depende de:**
> nada · **Tamaño:** M · Índice y reglas comunes: [`README.md`](README.md).

## Para qué

Es la pieza que deja construir toda la app sin servidor. Fija **qué se piden
la app y el servidor** (el contrato), **cómo se llama cada cosa** (el
glosario) y monta un **servidor falso** dentro de la app con datos inventados.
Las pantallas de los planes 04-09 se programan contra el contrato; el día que
exista `mcm-comunica-api`, la app cambia una variable y sigue igual.

El contrato nace aquí porque es lo primero que se construye. Cuando exista el
repo del servidor, el servidor lo implementa tal cual y se decide si se
comparte como paquete o se copia con un test que compare los dos (eso es del
plan del servidor, no de este).

---

## 1. Glosario (obligatorio en contrato, código y pantalla)

| Área privada / CRM | Identificador | En pantalla |
|---|---|---|
| Delegación (`assigned_user_id`) | `delegationId`, `Delegation` | «delegación» |
| Persona (`Contacts`) | `Person`, `personId` | su nombre |
| Chaval/a (relación `participante_mic_com`) | `participant` (papel) | «chaval», «chavala», «chavales» |
| Monitor/a (marca `monitor`) | `monitor` (papel) | «monitor», «monitora», «monitores» |
| Coordinación / acompañamiento | `coordination`, `accompaniment` (papeles) | «Coordinación», «Acompañamiento» (chip, `design.md` del plugin §6.4) |
| Grupo (`ajmcm_GRUPOS`) | `Group`, `groupId` | nombre del grupo |
| Etapa (`level`: mic/com/lc/apoyo) | `stage` | «MIC», «COM», «LC», «Apoyo» |
| Segmento (`ajmcm_segmento_com_c`) | `segment` | «COM 1»… |
| Curso escolar (1º ESO…) | `schoolLevel` | «1º ESO» |
| Curso del año (2025-2026) | `season` | «curso 2025-2026» |
| Relación persona-grupo (`stic_Contacts_Relationships`) | `Membership` | — |
| Evento (`stic_Events`) | `Event` | nombre del evento |
| Sesión (`stic_Sessions`: un sábado, una reunión, un día de evento) | `Session` | su fecha («sábado 25 de octubre») |
| Inscripción (`stic_Registrations`) | `Registration` | no se enseña: es fontanería |
| Asistencia (`stic_Attendances`) | `Attendance`, `mark` | ver estados abajo |
| Lista (`LIS_listas`) | `RollCall` | «lista» |
| Aviso (`AVI_avisos`, nivel 1-3) | `Notice` | «aviso» |
| Seguimiento (`stic_FollowUps`) | `FollowUp` (`incident`, `assessment`, `accompaniment`) | «incidencia», «valoración», «acompañamiento» |
| Grupo de actividad (`GAC_grupos`) | `ActivityGroup` | «patrulla», «habitación»… (su tipo) |
| Familiar (`stic_Personal_Environment`) | `Guardian` | «madre», «padre», «tutor/a» |
| Autorizaciones (`ajmcm_soloacasa_c`, `ajmcm_cesionimagenes_interne_c`, `ajmcm_menorwhatsapp_c`, `ajmcm_datossalud_c`) | `consents.goHomeAlone`, `.photos`, `.whatsapp`, `.healthData` | ver `MIS-GRUPOS.md` del plugin |

**Estados de una marca** (`PASAR-LISTA.md` §6 del plugin): `yes` «Vino»,
`partial` «Parcial», `no_justified` «Justificada», `no_unjustified` «No», y
`null` = **sin marcar** (un quinto estado, no un «no»).

**Estados de una lista** (`RollCall.status`): `taken` «Pasada» (con recuento),
`skipped` «Sin registro», y sin lista = «Pendiente».

**Autorizaciones:** `true`, `false` o `null`. **`null` es «sin contestar», no
«no»** (regla del plugin: «un vacío no es un no»).

## 2. Convenciones del contrato

- **Esquemas zod** en `services/comunica/contract.ts`; los tipos salen de
  ellos (`z.infer`). zod es JS puro: se añade a `package.json` sin preguntar.
- Rutas bajo `/v1/`. JSON. `Authorization: Bearer <token de acceso>`.
- **Errores**: `{ error: { code, message } }` con `code` ∈ `unauthenticated`
  (401), `forbidden` (403, también para lo que no existe fuera de tu alcance:
  nunca 404 que confirme que existe), `not_found`, `validation`,
  `crm_unavailable` (503: el CRM no contesta; la escritura se queda en la
  cola), `conflict`, `rate_limited`.
- **Fechas**: instantes en ISO 8601 con zona (`2026-10-25T10:00:00+02:00`);
  días como `YYYY-MM-DD` en hora de Madrid. La trampa del CRM («UTC sin zona»)
  la resuelve el servidor; la app nunca adivina.
- **Ids**: los del CRM, como cadena opaca. Las escrituras llevan además
  `clientId` (UUID v4 generado en el móvil): reintentar con el mismo
  `clientId` no duplica.
- Toda respuesta de lectura lleva `generatedAt` (hora del servidor), para el
  «actualizado hace N min».
- Nada de nombres del CRM en el contrato (`ajmcm_…`, `stic_…`): el servidor
  traduce. Así un cambio en el CRM no toca la app.
- **La salud nunca viaja en las lecturas que se guardan.** Las listas y fichas
  llevan `hasHealthNote: boolean`; el texto, solo `GET /v1/people/:id/health`,
  que la app pide con conexión y no persiste (plan 01).
- Listas acotadas por alcance (tu delegación, tus grupos): sin paginación en
  esta fase. Si una respuesta supera 1.000 elementos, es un fallo de alcance.

## 3. Tipos compartidos (los define este plan)

```
Delegation       { id, name }
Me               { personId, name, photoUrl?, delegation, roles: Role[],
                   scope: { stages?, segments? } | 'delegation',
                   canSeeHealth: boolean }
Role             'monitor' | 'coordination' | 'accompaniment' | 'member' | 'guardian'
PersonSummary    { id, firstName, lastName, photoUrl?, schoolLevel?,
                   badges: { healthNote, noPhotos, notHomeAlone } }
GroupSummary     { id, name, stage, segment?, schoolLevels[], counts: { participants, monitors } }
SessionSummary   { id, eventId, date, startsAt, endsAt, kind: 'weekly'|'meeting'|'event' }
Mark             'yes' | 'partial' | 'no_justified' | 'no_unjustified' | null
RollCallSummary  { sessionId, groupId?, status: 'taken'|'skipped', takenAt, counts: { came, missed } }
WriteResult      { clientId, status: 'applied'|'queued', crmIds? }
```

Cada plan de pantallas (04-09) define **su trozo** del contrato (rutas y
formas) en su sección «Datos», y al ejecutarse lo añade a `contract.ts` y al
servidor falso. Este plan solo deja lo compartido y la maquinaria.

Catálogo previsto (lo detallan los planes que se indican):

| Bloque | Rutas | Plan |
|---|---|---|
| Acceso | `POST /v1/auth/code`, `POST /v1/auth/verify`, `POST /v1/auth/refresh`, `POST /v1/auth/logout`, `GET /v1/me` | 02 |
| Pasar Lista | `GET /v1/today`, `GET /v1/groups`, `GET /v1/groups/:id/sessions`, `GET /v1/sessions/:id/groups/:gid/roll`, `PUT /v1/sessions/:id/groups/:gid/roll` | 04 |
| Grupos y fichas | `GET /v1/groups/:id`, `GET /v1/people`, `GET /v1/people/:id`, `GET /v1/people/:id/health`, `POST /v1/people/:id/notices` | 05 |
| Coordinación | `GET /v1/coordination/*`, `PUT /v1/sessions/:id/monitors-roll`, `POST /v1/meetings`, `GET /v1/monitors/:id`, `POST /v1/monitors/:id/follow-ups`, `PUT /v1/memberships/…` | 06 |
| Eventos | `GET /v1/events/today`, `GET /v1/events/:id/roll`, `PUT /v1/events/:id/roll`, `GET /v1/events/:id/activity-groups` | 07 |
| Avisos | `POST /v1/devices` (token de push), `DELETE /v1/devices/:id` | 08 |
| Mis datos de monitor | `GET /v1/me/monitor`, `PATCH /v1/me/monitor`, `POST /v1/me/documents` | 09 |

## 4. Servidor falso

- Implementa la **misma interfaz** que el cliente real (`ComunicaApi`, en
  `services/comunica/client.ts`): mismas funciones, mismos tipos. Se elige con
  `EXPO_PUBLIC_COMUNICA_API` = `fake` (por defecto en desarrollo y en los
  tests) o la URL del servidor.
- **Datos inventados y deterministas** (`services/comunica/fake/fixtures/`),
  generados con semilla fija: dos delegaciones ficticias, unos 6 grupos de dos
  etapas, ~60 chavales con nombres inventados, ~8 monitores, un curso con ~24
  sesiones y asistencias variadas (rachas de 3 faltas incluidas), dos eventos
  (uno con grupos de actividad), avisos y seguimientos. Nada sacado del CRM.
- **Mandos** para probar estados: latencia (300 ms por defecto), sin
  conexión, CRM caído (las escrituras devuelven `crm_unavailable`), error en
  una ruta concreta, y «otra persona»: entrar como monitor, como coordinación
  o como acompañamiento. Accesibles desde el panel secreto que ya existe
  (`components/SecretPanelModal.tsx`) solo en desarrollo y en el canal
  preview.
- Guarda lo que se escribe (en memoria), para que guardar una lista y volver
  a abrirla funcione igual que con el servidor de verdad.
- **Las reglas de autorización también en el falso**: si «entras» como
  monitor de la delegación A, los grupos de B dan `forbidden`. Así las
  pantallas aprenden a tratar el 403 desde el principio.

## 5. Tareas

| # | Tarea | Cómo se comprueba |
|---|---|---|
| 1 | Añadir `zod` y crear `services/comunica/contract.ts` con el glosario de tipos de §1-§3 y los errores | `npm run typecheck`; test que parsea un ejemplo válido de cada tipo y rechaza uno inválido |
| 2 | Interfaz `ComunicaApi` y cliente real (`client.ts`): `fetch` a `EXPO_PUBLIC_COMUNICA_API`, cabecera de sesión (la pone el plan 02), parseo con zod, errores tipados, reintento solo en `crm_unavailable`/red | Tests con `fetch` simulado: 200 válido, 200 con forma rota (error tipado y aviso a Sentry vía `logger.error`), 401, 403, 503 |
| 3 | Generador de datos inventados con semilla y fixtures (`fake/fixtures/`) | Test: el generador da siempre lo mismo; ningún nombre coincide con una lista de control de nombres reales (opcional) y no aparece ningún id con forma de id del CRM |
| 4 | Servidor falso (`fake/index.ts`) con los mandos de §4 y autorización por delegación | Tests: latencia, sin conexión, CRM caído, 403 fuera de alcance, lo escrito se vuelve a leer |
| 5 | Selector `EXPO_PUBLIC_COMUNICA_API` (`fake` por defecto fuera de producción; **en producción, sin variable, el área nativa no se enciende**) | Test del selector; `.env.example` documentado |
| 6 | Mandos en el panel secreto (solo desarrollo y preview) | Captura del panel; test de que en producción no aparecen |
| 7 | `docs/contratos/COMUNICA_API.md`: el contrato en prosa (cada ruta, para qué, quién puede) para el equipo del servidor; enlazado desde `docs/README.md` | Revisión del propietario |

## 6. Guardarraíles que deja este plan

- Ningún fichero fuera de `services/comunica/` importa `fake/` (test que
  recorre los imports).
- Cada ruta del contrato tiene datos en el falso (test que lo recorre).
- Ningún esquema del contrato tiene un campo de texto de salud salvo el de
  `/people/:id/health` (test sobre los esquemas).

## 7. Fuera de este plan

El servidor de verdad (repo `mcm-comunica-api`), la caché en el móvil y la
cola (plan 01) y las formas concretas de cada bloque (planes 02, 04-09).
