# 18 — «Eventos que gestionas»: el check-in de un evento desde la app

> **Estado:** 🟡 hecho contra el servidor falso (26/11/2026, rama
> `claudito/admiring-heisenberg-50a4b8`) · **Depende de:** 00, 01, 05 (la
> ficha), 07 (la lista larga) · **Servidor:** `comunicaMiddleware`
> (`src/contract-managed-events.ts`, `src/app/managed-events.ts`,
> `docs/GESTOR-EVENTO.md`) · **Comunica Tools:** `docs/GESTORES-EVENTO.md` y
> `docs/CHECKIN.md`.

## Para qué

En Comunica Tools, la coordinación dueña de un evento (por ejemplo, uno
nacional de ECE, que no «tiene personas» de una delegación) nombra **gestores**:
personas del CRM. Desde la MCM App, un gestor ve a **todos** los inscritos de
ese evento —de su delegación o no—, abre sus fichas, escribe notas y marca
quién ha **llegado** (el check-in). Es lo mismo que el check-in de Comunica
Tools y se guarda en el mismo sitio (Supabase `comunicatools.event_checkins`):
lo que se marca en la app se ve allí y al revés, en directo.

- **Nada va al CRM.**
- **No es la asistencia** por días de «Pasar lista en un evento» (plan 07):
  aquella va al CRM y es de la delegación; esta es la llegada al evento.
- **No pide papel de equipo**: lo da el nombramiento. Un gestor puede ser una
  madre que ayuda en la puerta.

## Datos (contrato)

Copia del original del middleware en `services/comunica/contract.ts`, bloque
«Gestor de un evento (plan 18)». En prosa, en
[`docs/contratos/COMUNICA_API.md`](../../contratos/COMUNICA_API.md) («Gestor de
un evento»).

| Ruta | Qué | En el móvil |
|---|---|---|
| `GET /v1/managed-events` | los eventos que gestiona (acabados hace > 30 días, fuera), con inscritos activos y llegados | se guarda |
| `GET /v1/managed-events/:id` | el evento, `registrations` (sin salud, solo `badges`), `checkins`, `since`, `rooms` | se guarda (es lo que se usa en la puerta) |
| `GET /v1/managed-events/:id/checkins?since=` | lo cambiado desde `since` (solo Supabase, barato) | se mezcla en el evento |
| `POST /v1/managed-events/:id/checkin` | `{ registrationIds, to: in/absent/pending, at? }` | por la cola |
| `POST /v1/managed-events/:id/note` | `{ registrationId, note }` (vacía, la borra; 300 tras limpiar) | por la cola |
| `GET /v1/managed-events/:id/people/:pid` | la ficha: teléfonos, correo, familia, autorizaciones, marcas | se guarda (como la de Grupos) |
| `GET /v1/managed-events/:id/people/:pid/health` | la salud | **nunca** |
| `…/people/:pid/photo?v=` | la foto (las `photoUrl` ya apuntan aquí) | caché de imágenes |

`Me.managesEvents: true` enciende la entrada. Errores: 403
`event_out_of_scope` / `person_out_of_scope` / `registration_out_of_scope`
(exista o no), 503 `crm_unavailable` con `reason: 'no_checkin_store'`. Estas
rutas **no llevan** la delegación de trabajo (`delegation.ts`, `PERSONAL`).

## En el móvil

- **Entrada** (`gestor/ManagedHomeEntry.tsx`): en la portada del equipo (debajo
  del evento de hoy) y en la de familia (debajo del saludo). Un evento en
  marcha sale como tarjeta que abre el check-in; siempre, la fila «Eventos que
  gestionas».
- **Lista** (`/comunica/gestion`): hoy, próximos y pasados, con
  «llegados/inscritos» y los cambios sin subir.
- **Check-in** (`/comunica/gestion/[eventId]`): «87 / 120 han llegado» con su
  barra y «N faltan · M no vienen»; buscador sin tildes y por trozos (nombre,
  curso, delegación, habitación, nota); agrupar por nombre, delegación (la
  dueña primero), curso (monitores y equipo detrás), papel o habitación (solo
  si `rooms` no está vacío; «Habitación 101 · planta 1 · Casa X»); chips
  pegados Todos / Faltan / Están / No vienen / Con nota. Cada fila
  (`CheckinRow`, que NO es la fila de asistencia del plan 04) con «Llega»
  grande, o la hora y deshacer, o «No viene» y deshacer; habitación e icono de
  nota junto al nombre; las canceladas al final, apagadas. Mantener pulsado (o
  el botón de la cabecera) selecciona varios: «Llegan (N)» / «No vienen» y «Los
  que faltan aquí».
- **Ficha** (`/comunica/gestion/[eventId]/persona/[personId]`): identidad con
  la habitación, «No puede irse solo/a a casa», la llegada (marcar, «No viene»,
  deshacer, quién la marcó), la nota editable, marcas y salud (botón aparte,
  `HealthSheet` con `eventId`), contacto de la persona y de su familia
  (`ContactRow` de la ficha de Grupos: llamar, WhatsApp, correo) y
  autorizaciones plegadas.

### Sin cobertura y en directo

- Marcar y anotar van a la **cola** del área (`outbox.ts`, kinds `checkin` y
  `checkin-note`): se ven al momento (lo de la cola se pinta ENCIMA de lo del
  servidor) y suben solos, con la hora en que se marcaron (`at`; el servidor
  la acepta de las últimas 48 h).
- Una marca es una **tanda** (un POST con varias inscripciones). Volver a
  marcar a alguien lo saca de las tandas que aún no han subido, para que el
  orden de subida no resucite lo de antes (`planCheckin`). La nota es una
  entrada por inscripción (gana la última).
- **Sondeo** (`useCheckinPolling`): cada 4,5 s, `checkins?since=` solo con la
  pantalla a la vista, la app en primer plano y sin saber que no hay red. Lo
  que llega se mezcla por `updatedAt` en el evento guardado; lo pendiente en
  la cola sigue mandando hasta que sube.
- Lo que el servidor **rechaza** (403, validación) no se pinta como hecho:
  aviso arriba con «Descartar».

### Lógica pura

`utils/comunica/checkin.ts`: mezcla, lo de la cola, cifras, buscador por
trozos, chips, secciones, notas (`cleanNote`, como Comunica Tools) y la lista
de eventos. Tests: `__tests__/comunica/checkinLogic.test.ts`.

## Servidor falso

`services/comunica/fake/managedEvents.ts`. Gestionan `coordination` (tres
eventos) y `memberNoKids` (uno; sin papel de equipo). Un encuentro de ECE en
marcha (gente de Villaclara, Puerto Alto, Monteluz y sin delegación,
monitores, equipo, canceladas, habitaciones en dos casas, llegadas, «no
viene» y notas), uno próximo sin habitaciones y uno pasado. Mando
`othersCheckIn`: en cada sondeo «Comunica Tools» marca a alguien. Tests:
`managedEventsFake.test.ts` y las pantallas en `checkinScreens.test.tsx`.

## Pendiente

- Verlo en un móvil con el servidor real (la migración de Comunica Tools,
  `20261126_alojamientos_y_gestores`, está **sin aplicar**).
- El mando `othersCheckIn` no está en el Laboratorio Alpha (solo en
  `__comunicaFake` y en los tests).
- El recordatorio de «listas sin subir» (plan 08) no cuenta los check-ins.
- Preguntas abiertas del contrato: ver «Dudas» abajo.

## Dudas del contrato (para el middleware, no cambiadas aquí)

1. `POST …/checkin` no lleva `clientId`: es idempotente para un mismo `to` y
   `at`, pero si una tanda sube dos veces con un cambio de otro en medio, la
   segunda pisa lo de otro. Con la tanda por la cola es raro (solo si el
   servidor escribe y la respuesta se pierde).
2. `CheckinState` sin fila = «falta»; si en Comunica Tools se borra una fila
   (no se hace hoy), el sondeo no lo trae.
3. `ManagedRegistration` no lleva la etapa ni el grupo de los sábados: agrupar
   por etapa no se puede (sí por curso).
4. La ficha (`ManagedPerson`) se guarda en el móvil, como la de Grupos
   (`persist: true`): lleva teléfonos y familia de gente de otras delegaciones.
   Si se prefiere que no, es cambiar `persist` en `ROUTES`.
