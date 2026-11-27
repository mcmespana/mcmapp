# 18 — «Eventos que gestionas»: el check-in de un evento desde la app

> **Estado:** 🟡 hecho contra el servidor falso (26/11/2026, rama
> `claudito/admiring-heisenberg-50a4b8`); **vuelta de diseño y habitaciones**
> el 27/11/2026 (misma rama, §«Vuelta de diseño») · **Depende de:** 00, 01, 05 (la
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
| `GET /v1/managed-events/:id` | el evento, `registrations` (sin salud, solo `badges`), `checkins`, `since`, `rooms`, `roomExtras` (lo puesto a mano en las habitaciones) | se guarda (es lo que se usa en la puerta) |
| `GET /v1/managed-events/:id/checkins?since=` | lo cambiado desde `since` (solo Supabase, barato) | se mezcla en el evento |
| `POST /v1/managed-events/:id/checkin` | `{ registrationIds, to: in/absent/pending, at? }` | por la cola |
| `POST /v1/managed-events/:id/note` | `{ registrationId, note }` (vacía, la borra; 300 tras limpiar) | por la cola |
| `POST /v1/managed-events/:id/room` | `{ registrationIds, roomId \| null }`; solo habitaciones del evento (422 `room_not_in_event`); pasarse de plazas se deja | por la cola (`checkin-room`) |
| `GET /v1/managed-events/:id/people/:pid` | la ficha: teléfonos, correo, familia, autorizaciones, marcas y `monitor` (o `null`) | se guarda (como la de Grupos) |
| `GET /v1/managed-events/:id/people/:pid/health` | la salud | **nunca** |
| `GET /v1/managed-events/:id/people/:pid/personal` | datos personales completos, con documento (`PersonalData`) | **nunca** |
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
- **Lista** (`/comunica/gestion`): hoy y próximos arriba, con
  «llegados/inscritos» y los cambios sin subir; **los pasados, abajo y
  plegados** («Pasados (3)», en gris).
- **Check-in** (`/comunica/gestion/[eventId]`): «87 / 120 han llegado» con su
  barra y «N faltan · M no vienen»; el buscador (sin tildes y por trozos:
  nombre, curso, delegación, habitación, nota); «Filtros» (hoja con agrupar
  —nombre, delegación con la dueña primero, curso, papel o habitación— y
  afinar —con nota, con o sin habitación, papel, delegación—, con el número de
  lo puesto en el botón y una línea «Con nota · Villaclara · Quitar» encima de
  la lista) y «Habitaciones» (la vista); el interruptor **«Habitación al
  llegar»**; chips pegados Todos / Faltan / Están / No vienen. Cada fila
  (`CheckinRow`, que NO es la fila de asistencia del plan 04): el nombre con
  la línea entera, la **etiqueta de habitación** con el color de su ocupación
  (se toca y se cambia; «Sin hab.» si no tiene), papel, curso, delegación y
  marcas; a la derecha «Llega» grande, o la hora y deshacer, o «No viene» y
  deshacer. Mantener pulsado (o el botón de la cabecera) selecciona varios:
  «No vienen», «Habitación» y «Llegan (N)».
- **Habitaciones** (`/comunica/gestion/[eventId]/habitaciones`,
  `gestor/RoomsScreen.tsx`): las cifras («36 con habitación · 8 sin»,
  «39/52 plazas»), el aviso si alguna se pasa, el buscador; «Sin habitación»
  primero (lo que queda por hacer) y luego cada planta con sus habitaciones,
  su gente (y si ha llegado) y lo puesto a mano. Tocar a alguien abre el
  selector (con «Ver ficha»).
- **Selector de habitación** (`gestor/RoomSheet.tsx` + `useRoomPicker`): hoja
  con fichas de un toque. Arriba la última usada (si cabe), luego las que
  tienen gente y hueco, las vacías y, detrás de «Ver N llenas o pasadas», las
  que no caben. Cada ficha: código, planta, barrita y «2/4 · quedan 2»
  (cuenta `roomExtras`). Busca por código, planta o casa (con más de 9
  habitaciones). «Quitar la habitación» si tiene. Lo elegido va a la cola y
  sale un aviso «Lucía García → Hab. 102 · Deshacer» (cada uno vuelve a la suya
  de antes).
- **Ficha** (`/comunica/gestion/[eventId]/persona/[personId]`): la de Grupos
  con sus piezas (cabecera, `QuickButtons`, `ContactRow`, `ConsentsFold`,
  `PersonalFold`) y lo del evento encima. Orden: identidad → **En el evento**
  (llegada; habitación con «Cambiar»; nota, que se lee y se edita con
  «Editar») → **A tener en cuenta** («No puede irse solo/a a casa», marcas y
  el botón de la salud) → botones al tutor 1 → Contacto → **Monitor/a**
  (desplegado, si tiene) → Autorizaciones y Datos personales (plegados).

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

`utils/comunica/checkin.ts`: mezcla, lo de la cola (llegada, nota y
habitación), cifras, buscador por trozos, chips, la hoja «Filtros»
(`CheckinRefine`, `refineOptions`), secciones, notas (`cleanNote`, como
Comunica Tools) y la lista de eventos. `utils/comunica/rooms.ts`: orden
natural, ocupación con `roomExtras`, el orden del selector, la vista por
plantas, cifras y el deshacer. `monitorSummary` (`utils/comunica/monitorProfile.ts`):
los datos de monitor para leer. Tests: `checkinLogic.test.ts`,
`roomsLogic.test.ts` y `monitorProfileRules.test.ts`.

## Servidor falso

`services/comunica/fake/managedEvents.ts`. Gestionan `coordination` (tres
eventos) y `memberNoKids` (uno; sin papel de equipo). Un encuentro de ECE en
marcha (gente de Villaclara, Puerto Alto, Monteluz y sin delegación,
monitores con sus datos de monitor, equipo, canceladas, habitaciones en dos
casas —una llena por plazas reservadas, una pasada por un sacerdote puesto a
mano, una vacía—, llegadas, «no viene», notas y datos personales con DNI), uno
próximo sin habitaciones y uno pasado. Mando
`othersCheckIn`: en cada sondeo «Comunica Tools» marca a alguien. Tests:
`managedEventsFake.test.ts` y las pantallas en `checkinScreens.test.tsx`.

## Vuelta de diseño (27/11/2026)

El propietario pidió afinar: los pasados abajo, un menú de check-in con menos
ruido, fichas «clavadas» a las de Grupos con lo del evento por prioridad, y
cambiar de habitación rápido. Decisiones y por qué:

1. **Pasados plegados y sin peso.** Ya no se trabaja en ellos (el servidor
   los da 30 días): un «Pasados (3)» en gris al final, con chevron y
   `accessibilityState.expanded` (regla 7 de `AREA_NATIVA_DISENO.md`). Si no
   hay nada hoy ni después, una frase lo dice.
2. **Check-in: lo que se usa cada segundo, arriba y grande; lo de vez en
   cuando, en una hoja.** Agrupar y los filtros de pocas veces (con nota,
   habitación, papel, delegación) salen de la lista a «Filtros»; en la
   lista solo quedan el buscador, los chips de llegada (lo que se toca todo
   el rato) y «Llega». El botón lleva el número de lo puesto y, encima de la
   lista, una línea dice qué se está filtrando y lo quita: un filtro que no
   se ve es una lista que «ha perdido» gente.
3. **El nombre no se corta.** La habitación pasa a la segunda línea, con la
   etiqueta delante del curso: el nombre tiene todo el ancho que deja «Llega».
4. **La habitación, muy visible y de un toque.** Etiqueta con el color de la
   ocupación (verde con hueco, ámbar llena, rojo pasada; los tokens de
   estado de la app, como los de Comunica Tools), que se toca para cambiar.
   Toque de 44 pt con `hitSlop` (encima y debajo solo está la propia fila).
5. **Elegir habitación como en Comunica Tools**, en hoja inferior y con el
   orden que reparte más rápido (`roomOptions`). Sin el sexo de los
   inscritos (el contrato no lo trae), las fichas no dicen chicas y chicos:
   el lector oye quién hay dentro y la vista «Habitaciones» lo enseña.
6. **«Habitación al llegar»** es preferencia del móvil
   (`useBoolPreference`, la misma pieza que «Asignar grupos»).
7. **Con elegidos, «Llegan (N)» a lo ancho debajo** de «No vienen» y
   «Habitación»: tres botones en una fila a 375 pt cortaban las palabras.
8. **Ficha: la de Grupos, con lo del evento encima** y en el orden de la
   puerta: llegada → habitación → nota → avisos. «No puede irse solo/a a
   casa» pasa a «A tener en cuenta» (no repite la pastilla). Los botones al
   tutor 1 son los de Grupos; mientras no ha llegado, la acción principal es
   «Ha llegado» y el de llamar va en card (una sola acción principal).
   **Monitor/a desplegado antes de los pliegues**: lo abierto arriba y lo
   plegado cerrando la ficha, como en Grupos. La nota se lee sin un campo
   abierto (se edita con «Editar»).

## Pendiente

- Verlo en un móvil con el servidor real (la migración de Comunica Tools,
  `20261126_alojamientos_y_gestores`, está **sin aplicar**).
- El mando `othersCheckIn` no está en el Laboratorio Alpha (solo en
  `__comunicaFake` y en los tests).
- El recordatorio de «listas sin subir» (plan 08) no cuenta los check-ins.
- Ver en un móvil con el servidor real el cambio de habitación (y que el
  middleware ya está desplegado con `roomExtras`: si no, la app lo toma como
  `[]` y sigue).
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
   Si se prefiere que no, es cambiar `persist` en `ROUTES`. Desde el 27/11
   lleva también los datos de monitor.
5. `ManagedRegistration` no trae el sexo: el selector no puede decir
   «chicas y chicos» dentro de cada habitación ni ordenar por ello como
   Comunica Tools (sus habitaciones «con gente del otro sexo» van detrás).
   Haría falta un `gender` en `ManagedRegistration`.
6. `POST …/room` no lleva `clientId` (como `checkin`): mover a varios y que la
   respuesta se pierda solo repite lo mismo, pero si entretanto otro les
   cambia la habitación, la repetición lo pisa.
7. `roomExtras` no lleva `updatedAt` ni sale en `checkins?since=`: lo puesto a
   mano en Comunica Tools se ve al volver a abrir el evento (o al tirar para
   refrescar), no en directo.
