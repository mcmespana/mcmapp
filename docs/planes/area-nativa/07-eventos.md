# 07 — Pasar lista en un evento y grupos de actividad

> **Estado:** 🟢 listo para ejecutar en `nuevoComunicaChulo` · **Depende de:** 04
> (y con él 00, 01 y 03) · **Tamaño:** L · Índice y reglas comunes: [`README.md`](README.md).

## Para qué y para quién

Para **cualquiera del equipo** (monitor, coordinación, acompañamiento) de la
delegación que organiza una salida —convivencia, excursión, campamento— y quiere
saber **«¿estamos todos en el autobús?»**. Lo pidió el propietario el 10/10/2026:
ágil, rápido y que aguante si falla la red. **Es el caso estrella del modo sin
cobertura** (decisión `offline`): la puerta del autobús, la casa de colonias, el
monte.

Dos piezas: **la lista del autobús** (los inscritos, por etapa y curso, para
marcar quién está: una asistencia por persona marcada en la sesión del día) y
**los grupos de actividad** (patrullas, habitaciones… los crea y reparte
Comunica Tools): pestañas **de solo lectura** («¿en qué habitación está
Lucía?») y la misma lista de marcar, partida por esos grupos.

**Se reutiliza el plan 04, no se copia:** `MarkControl` (toque y pulsación
larga con motivo), la fila de persona con acceso a la ficha, el borrador en el
móvil, «Han venido todos», la barra de guardar con recuentos, la regla de qué
sesión se ofrece y la entrada en la cola (`enqueueWrite`). Mandan sus nombres.
Si a algo le falta lo que pide esta pantalla (que «Están todos» toque solo lo
que se ve, una variante de avatar), **se amplía allí, con su test**.

**Fuera de este plan:** los **eventos nacionales** (de ECE u otra delegación:
en el plugin no salen, «nada interdelegacional», y el propietario los dejó
**«para más adelante»**, `plans/043`, quizá con un papel de coordinación
nacional que aún no tiene clave en `CAMPOS.md`; el servidor no los ofrece). Los
eventos en la ficha del chaval → plan 05. «Crear la sesión de hoy» de los
eventos semanales y de reuniones → planes 04 y 06. Escribir grupos de actividad
(es de Comunica Tools), «tu patrulla» para familias y F2: no están en el plugin.

## Especificación de origen

Todo en `/home/user/comunicaAreaPrivada/`:

| Qué | Dónde |
|---|---|
| Uso, qué eventos, quién sale, qué se escribe, sin cobertura, seguridad | `docs/comunica/PASAR-LISTA-EVENTOS.md` §1-§5 |
| Pestañas, qué se ve, pasar lista por grupos, «la misma lista del día» | `docs/comunica/GRUPOS-ACTIVIDAD.md` |
| 50 días y sesión del día aprobados; nacionales y fotos «más adelante» | `plans/043-decisiones-del-10-10.md` |
| «Primero se lee, luego se marca» (F8, sin decidir) | `docs/comunica/PROPUESTAS-FUNCIONALIDADES-2026-10.md` F8 |
| Delegación filtrada a mano · campos (solo servidor) | `docs/comunica/EVENTOS.md` §1 · `CAMPOS.md` «Grupos de actividad», `participation_type` |
| La pantalla entera | `pages/single_stic_pasar_lista_evento.php` |
| Reglas de la lista (`sticpa_pl_ev_*`) y de los grupos (`sticpa_gac_*`) | `inc/stic-pasar-lista-eventos.php`, `inc/stic-grupos-actividad.php` |
| Tarjeta de hoy y fila de la portada | `pages/single_stic_pasar_lista.php` 111-120 y 429-441 |
| Filtro, buscador, pliegue, «a la vista», cola con el día | `js/stic-pasar-lista.js`, `isVisible()` y «Lista de un evento» |

**Donde el documento y el código no coinciden, manda el código:** la tarjeta
de la portada sale solo si el evento **empieza o acaba hoy** (no «en marcha»,
que sí cuenta como «hoy» en la pantalla de eventos); la fila «Pasar lista en un
evento» sale **siempre que haya eventos**, no solo «si no hay ninguno hoy»
(§1.1); y en una pestaña de grupos un monitor va arriba como «Monitor/a» **solo
si el grupo es «con monitor»** (el documento dice «monitores primero» sin más).

## Pantallas y rutas

Carpeta `app/(tabs)/comunica/eventos/` (la crea este plan). Si la fase 2 trae
los eventos de familias, irán en otra carpeta: esta es la de pasar lista.

| Ruta | Qué es | Del plugin |
|---|---|---|
| `eventos/index.tsx` | **Elegir evento**: los de hoy (tarjetas), «Próximos», «Ya pasados este curso» | `single_stic_pasar_lista_evento` sin `evento` |
| `eventos/[eventId].tsx` | **El evento.** Parámetros: `view` (`list` o la clave de una pestaña), `by` (pasar lista por esa pestaña), `group` (con ese grupo ya elegido), `session` | con `evento`, `grupos`, `por`, `grupo`, `sesion` |

- Cambiar de pestaña (`view`) es `router.setParams` (no apila: «atrás» vuelve a
  los eventos). «Pasar lista por patrullas» y «de este grupo» son `router.push`
  con `by`/`group` (atrás vuelve a la pestaña). «Ver por cursos» quita `by`.
- **Portada del plan 04**: este plan le añade la tarjeta del evento de hoy,
  arriba del todo, y la fila «Pasar lista en un evento · N este curso» debajo de
  los grupos (`TodayEventCard`, `EventsEntryRow` en `components/comunica/eventos/`).
- La ficha es la del plan 05 (`personId` + `groupId`), solo si la persona tiene
  grupo de los sábados en la delegación.

## Datos

### Contrato (`services/comunica/contract.ts`)

**Dos ajustes al catálogo del plan 00**, que se apuntan en
`docs/contratos/COMUNICA_API.md`: `GET /v1/events/today` pasa a ser **`GET
/v1/events`** (una sola ruta da hoy y el curso; la app clasifica), y **`GET
/v1/events/:id/activity-groups` se sirve dentro de `GET /v1/events/:id/roll`**
(el plugin ya pide grupos y miembros en la misma tanda que los inscritos, y así
lo que tiene que funcionar sin cobertura es una sola consulta).

```
GET /v1/events        → { generatedAt, season: '2026-2027', events: EventSummary[] }
EventSummary          { id, name, startDate, endDate, startsAt, endsAt }      // días YYYY-MM-DD (Madrid)

GET /v1/events/:id/roll → EventRoll
EventRoll             { generatedAt, event: EventSummary,
                        sessions: SessionSummary[],                // kind 'event'; [] = el evento no tiene días
                        marksBySession: Record<sessionId, Record<personId, MarkEntry>>,
                        people: EventPerson[],                     // los que van (se marcan)
                        notGoing: EventPerson[],                   // «No van»
                        activity: { tabs: ActivityTab[], groups: ActivityGroup[], members: ActivityMember[] } }
MarkEntry             { mark: 'yes'|'partial'|'no_justified'|'no_unjustified', reason?: string }
EventPerson           { person: PersonSummary,                     // schoolLevel = curso; null en monitores
                        role: 'participant'|'monitor'|'team',
                        stage: 'mic'|'com'|'lc'|null,
                        homeGroup: { id, code } | null,            // grupo de los sábados de la delegación
                        otherDelegation: Delegation | null,        // null = de la delegación del evento
                        activityGroupIds: string[],
                        registrationStatus?: 'cancelled'|'rejected'|'not_invited'|'did_not_take_part' } // solo en notGoing
ActivityTab           { key, type: ActivityType, batch: string|null, groupCount }
ActivityGroup         { id, tabKey, name, type: ActivityType, capacity: number|null, withMonitors: boolean }
ActivityMember        { groupId, tabKey, role: 'monitor'|'participant', personId: string|null, name }
ActivityType          'patrol'|'dynamics'|'room'|'olympics'|'cleaning'|'subgroup'|'clan'|'house'|'large_group'|'other'

PUT /v1/events/:id/roll  body EventRollWrite → EventRollWriteResult
EventRollWrite        { clientId, sessionId: string|null, day: 'YYYY-MM-DD', marks: Record<personId, MarkEntry> }
EventRollWriteResult  WriteResult & { sessionId, counts: { came, missed }, skipped: personId[] }
```

`schoolLevel`: las claves que fije el plan 04/05; aquí hacen falta su orden y
su nombre corto («3 EP»…«6 EP», «1 ESO»…«4 ESO», «1 Bach», «2 Bach», «FP GM»,
«FP GS», «Universitario», «Otros») en `utils/comunica/schoolLevels.ts`.

**Lo que promete el servidor** (va en prosa en `COMUNICA_API.md`, para el repo
del servidor, con la referencia al plugin; el falso lo cumple igual):

- **Quién puede:** `monitor`, `coordination` o `accompaniment`; el alcance de
  coordinación no recorta (los eventos son de toda la delegación).
- **Qué eventos** (`sticpa_pl_ev_clasificar`, `_eventos`): de la delegación
  (dueña del evento), que tocan el curso (1 sep - 31 ago), con fecha de inicio,
  de **50 días o menos**, sin el de sesiones semanales ni el de reuniones. Fuera
  de esa lista, `forbidden`, exista o no.
- **Quién sale** (`sticpa_pl_ev_lista`, §3): una vez por persona (con dos
  inscripciones, la activa). Curso: el de la inscripción o (hoy siempre) el de
  la relación de participante vigente **más reciente de la propia persona**.
  Etapa: del curso (primaria → MIC; ESO, Bachillerato y FP → COM), si no la del
  grupo, si no la de la ficha. `monitor` = inscrito como organizador **o** con
  relación vigente de monitor o acompañamiento (manda sobre la de participante);
  `team` = inscrito como «equipo». `notGoing` = cancelada, rechazada, sin
  invitación, no participa; lo demás (también vacío) se marca.
- **Grupos de actividad** (`sticpa_gac_grupos`, `_miembros`, `_visibles`): de la
  delegación dueña y de ese evento; los anulados no salen, salvo con el evento
  terminado y alguien dentro. Un miembro no inscrito (un monitor que no se
  apuntó) lleva `personId` nulo o fuera de `people`: se enseña con su `name` y no
  se marca. Sin el módulo en el CRM, `activity` va vacío.
- **Al escribir** (`sticpa_pl_ev_guardar`, `_sesion_del_dia`): solo gente de
  `people` (el resto vuelve en `skipped`, sin error) y los cuatro estados; motivo
  hasta 255 (`validation`). Lo no enviado **no se toca** (una marca no se borra,
  como en el plugin). Con `sessionId: null`, busca la sesión de `day` releyendo
  sin caché y, si no hay, **la crea** (hora del evento si ese día empieza o
  acaba, si no las 9:00; una hora; del dueño del evento). **No crea `RollCall`**
  (no cuenta en el Resumen de coordinación). `applied` solo si al releer están
  todas; si no, `crm_unavailable` y la cola reintenta sin duplicar.

### En el móvil

- `['comunica','events']`, persistida, `staleTime` 5 min.
  `['comunica','events',eventId,'roll']`, **persistida** (es lo que se usa sin
  cobertura), `staleTime` 1 min: el día de la salida la gente se apunta y se
  desapunta. Las dos se refrescan al abrir, al volver a la app y al reconectar.
- **Precarga** (decisión de este plan; el plugin solo guarda lo visitado): con
  conexión, al pintar la portada o la lista de eventos, se piden ya las listas
  de los eventos de **hoy y de los dos días siguientes**. Quien no abrió el
  evento antes de perder la cobertura la tiene igual.
- **Nada de salud**: `EventPerson` solo lleva `PersonSummary.badges`.
- **Cola** (plan 01): `key: 'event-roll:<eventId>:<sessionId | new-<día>>'`,
  `kind: 'event-roll'`, payload `EventRollWrite` con **todas** las marcas
  puestas de esa lista (gana la última), nunca un `null`. Optimista sobre
  `marksBySession` (con `new-<día>` mientras no haya sesión); al aplicarse se
  refresca y aparece la sesión creada.
- **El día** de una lista sin sesión es el del primer toque del borrador (el
  «hoy» del plan 04) y viaja en el payload: un envío que sube mañana crea la
  sesión de hoy (§4 del documento). Días distintos, borradores distintos.

### Servidor falso (`services/comunica/fake/`)

En la delegación ficticia A: una **convivencia que empieza hoy** (2 días, con
sesiones y grupos: «Patrullas» con un grupo vacío y un monitor no inscrito,
«Habitaciones» con plazas y una pasada de cupo), una **excursión de hoy sin
sesiones**, una próxima, una pasada (grupos anulados con gente, que se ven) y
las que no deben salir (semanal, una de 60 días, una de B → `forbidden`). Gente
inventada: varios cursos y dos etapas, tres de B, sin curso, sin etapa, sin
grupo de los sábados, monitores por inscripción, por relación y de «equipo»,
canceladas, rechazadas y una persona con una cancelada vieja y una activa.
Mandos nuevos: «la relectura falla» (`crm_unavailable`) y la fecha de «hoy».

## Comportamiento y reglas que no se pueden perder

**Elegir evento** (`single_stic_pasar_lista_evento.php` 68-131):

- Cabecera «Eventos», debajo «Curso 2026-2027»; arriba, lo que quedó sin subir
  (`useOutboxStatus()`).
- Clasifica la app con la fecha de hoy (`classifyEvents`, puro), para que lo
  guardado siga bien al día siguiente sin cobertura: **hoy** (empieza, acaba o
  está en marcha; en ese orden), **próximos** (el más cercano arriba) y **«Ya
  pasados este curso»** (el más reciente arriba; también se marcan).
- Hoy: tarjeta con cápsula de fecha, «Hoy empieza» / «Hoy termina» / «En
  marcha» / «Hoy» (un solo día), el nombre y «Pasar lista». El resto, filas con
  nombre y fechas cortas («10 – 12 oct», «28 sep – 2 oct»). Más de 8: buscador.

**La lista del autobús** (`single_stic_pasar_lista_evento.php` 212-555):

- Cabecera: el nombre; debajo «10 – 12 oct · 47 personas» (monitores
  incluidos). **Nadie empieza marcado**: confirmado no es «está en el autobús».
- **Qué sesión**: la regla del plan 04 (`sticpa_pl_pick_session`: la de hoy, si
  no la última que pasó, si no la próxima), en la app sobre `sessions`; con dos
  o más, selector del día. Si no es la de hoy: «Es la lista del sábado 15 de
  noviembre, 10:00». **Sin sesiones**: «Este evento no tiene días en el CRM. Al
  guardar se crea la lista del sábado 15 de noviembre.»
- **Orden** (`sticpa_pl_ev_secciones_html`): los de la delegación por etapa
  (MIC, COM, LC, «Sin etapa») y curso («4 EP · 19», «Sin curso» al final);
  luego **otras delegaciones** por delegación y etapa («COM · Villanueva»);
  luego **«Monitores · N»** (o «Monitores y equipo»), **plegados**, vengan de
  donde vengan; y al final **«No van»**, apagados, con su chip («Cancelada»,
  «Rechazada», «Sin invitación», «No participa»), sin marcar. Por apellidos sin
  acentos, ñ tras n (tabla fija de `sticpa_pl_ev_clave_nombre`, sin `Intl`).
- **Debajo del nombre**: curso corto · código del grupo de los sábados · hasta
  tres grupos del evento («4 EP · M4.1 · Patrulla 3 · Hab. 12»; etiqueta corta
  de `sticpa_gac_etiqueta_corta`). Monitores: «Monitor/a» o «Equipo» delante,
  sin curso y avatar en el acento. Otra delegación: pastilla con la suya.
- **Chips** (`sticpa_pl_ev_chips_html`): «Todos 47», uno por curso con cuántos
  (sin contar monitores), «Monitores N» el último. Solo si hay dos o más. Van
  **pegados arriba** al bajar. Tocar uno deja solo ese curso y **vuelve arriba
  de la lista**; tocarlo otra vez lo quita. «Monitores» abre su pliegue.
- **Buscador** («Buscar por nombre»): nombre, curso, grupo, delegación y grupos
  del evento, sin acentos; filtra también «No van» y abre el pliegue si hay
  alguien dentro. Sin nada: «Nadie coincide con lo que buscas.» Títulos y
  números de sección cuentan lo que se ve.
- **Marcar**: el gesto del plan 04 (toque: sin marcar → vino → no vino → sin
  marcar; pulsación larga: parcial o justificada con motivo, y «Ver ficha» si
  tiene grupo de los sábados).
- **«Están todos»** marca **solo lo que está sin marcar y solo lo que se ve**
  (con un chip puesto, ese curso; nunca lo plegado). Con alguna marca: «El
  resto está (N)»; sin nadie por marcar, apagado.
- **Guardar**: barra abajo con «N están · N faltan · N sin marcar» («están» =
  vino y parcial) y «Guardar lista» / «Guardar (N sin marcar)». Sin ninguna
  marca: «No has marcado a nadie, así que no se ha guardado nada.» y no se
  encola. Al aplicarse: «Lista guardada · 12 están, 1 falta».
- Sin inscritos: «Todavía no hay nadie inscrito en este evento.» (y «No van» si
  hay). Evento ajeno o inexistente (`forbidden`): «Este evento no está entre los
  de tu delegación de este curso.» con «Ver los eventos».

**Grupos de actividad** (`GRUPOS-ACTIVIDAD.md`, `sticpa_gac_*`):

- **Pestañas**: «Lista» y una por agrupación, con su número de grupos. Nombre:
  la tanda si la hay («Mitades»), si no el tipo en plural («Patrullas»,
  «Habitaciones», «Dinámica», «Agrupaciones»…). Orden: el de los tipos y, dentro,
  por tanda. Sin grupos, no hay pestañas y la pantalla es solo la lista.
- **Una pestaña** (solo lectura, **ningún control de marcar**): «4 grupos · 32
  personas», «Pasar lista por patrullas» y cada grupo con su nombre y «7/8
  plazas» (pasado de cupo, en aviso) o su número. **Monitores primero** (en
  grupos «con monitor»), luego participantes por apellidos («1 ESO · C1»,
  «Cancelada»). Con grupo de los sábados la fila abre su ficha; si no, quieta.
  Vacío: «Nadie todavía»; con gente, «Pasar lista de este grupo». Al final «Sin
  patrulla» / «Sin habitación» / «Sin grupo». Buscador («Buscar a alguien o un
  grupo»): «Lucía» la deja bajo su grupo, «patrulla 3» deja ese grupo. Evento
  terminado: «El evento ya ha terminado: así quedaron los grupos.»
- **Pasar lista por grupos** (`by`): la misma lista, mismo gesto, mismo
  «Están todos», misma cola. Cambia el reparto: una sección por grupo (monitores
  y participantes juntos, sin pliegue), «Sin patrulla» al final, y chips por
  grupo (con `group`, ese chip ya puesto). Arriba: «Lista por patrullas. Ver por
  cursos». Los no inscritos salen en la cabecera de su grupo: «Sin inscripción,
  no se marca: Ana, Luis». Una persona, un grupo por pestaña.
- ⚠️ **Es la misma lista del día**: autobús y habitaciones escriben en la misma
  sesión; la última marca manda y lo no marcado no se toca. Comparten borrador
  y entrada en la cola.

## Estados

| Estado | Elegir evento | El evento |
|---|---|---|
| Cargando | Esqueleto de tarjeta y filas | Esqueleto de cabecera, chips y diez filas |
| Vacío | `EmptyState`: «Tu delegación no tiene eventos este curso. Las sesiones de los sábados están en Pasar lista.» | «Todavía no hay nadie inscrito en este evento.»; pestaña: «Esta agrupación no tiene grupos.» |
| Error | `AreaState` con «Reintentar»; `forbidden` con su texto | Igual |
| Sin conexión | Lo guardado, clasificado con la fecha de hoy, y `SyncBadge` | **Se marca y se guarda igual**: «Sin cobertura. Puedes marcar: se guardará en el móvil.» Sin la lista guardada: «Necesitas conexión la primera vez» (plan 01) |
| Pendiente de subir | Resumen de la cola arriba | `UploadStatus` en la barra: «Guardado en el móvil. Se enviará solo al volver la cobertura.» → «Subiendo…» → «Lista guardada · …»; atascada: «No se ha podido enviar lo que quedó pendiente.» con reintentar. Borrador sin guardar: «Cambios sin guardar · los datos están solo en tu móvil» y, al volver, «Tienes marcas sin guardar de antes.» |

## Traducción del diseño

Se queda igual: qué se enseña, el orden, las palabras («Están todos», «No van»,
«Sin curso», «Monitores»), los cuatro estados y sus iconos. Cambia por ser app
(reglas del plan 03 §3):

- Cabecera nativa; el subtítulo es la primera línea del contenido. Día: pastilla
  en `headerRight` («sáb 15») que abre un `BottomSheet` (el del plan 04).
  Buscador nativo (`headerSearchBarOptions`); los chips, pegados
  (`stickyHeaderIndices`), el buscador no, como en el plugin.
- Tarjeta de hoy: `RecordCard` + `DateCapsule`, entera es el enlace (sin botón
  que lo repita). Secciones con `SectionHeader` y su número.
- Pestañas: `SegmentedControl` si son 2-3 (lo normal); con más, fila deslizable
  con la forma de los chips y `accessibilityRole="tab"` (si choca al verlo, a
  `PLAN_DISENO.md`).
- Pliegue: cabecera pulsable con chevron y `accessibilityState.expanded`.
  `SectionList` virtualizada, sin animaciones de entrada. Otra delegación:
  `AppChip` con el acento de `theme.ts` (magenta en el plugin; `territorio`).
  Cupo pasado: `warning` y el número lo dice («9/8 plazas»).
- `BottomActionBar` para guardar. Hápticos: `h.select` en los chips,
  `h.formSuccess` al aplicarse. Avatar con iniciales y la foto si llega
  (`expo-image`, en segundo plano): sí a las fotos en las listas de un evento
  (16/10/2026).

## Tareas

| # | Tarea | Cómo se comprueba |
|---|---|---|
| 1 | Esquemas zod de «Datos» en `contract.ts` y su apartado en `docs/contratos/COMUNICA_API.md` (con los dos ajustes al catálogo y lo que promete el servidor) | Typecheck; test que parsea un ejemplo válido de cada tipo y rechaza un `mark: null` en `EventRollWrite` |
| 2 | Servidor falso: fixtures, `GET /v1/events`, `GET/PUT /v1/events/:id/roll` (crear sesión del día, `skipped`, `forbidden`, filtros de 50 días y semanales) y los dos mandos | Tests del falso: lo escrito se relee; dos `PUT` con `sessionId: null` y el mismo día crean **una** sesión |
| 3 | `utils/comunica/events.ts`: `classifyEvents`, fechas cortas, «Hoy empieza/termina/En marcha/Hoy» | Tests con fechas fijas, cambio de curso el 1/09 y evento de un día |
| 4 | `utils/comunica/eventRoll.ts`: secciones (delegación, etapa, curso, monitores, «No van»), chips y recuentos, búsqueda sin acentos, «a la vista», clave de orden por apellidos, payload y clave de la cola | Tests (ver «Tests») |
| 5 | `utils/comunica/activityGroups.ts`: nombre de pestaña, «Sin …», etiqueta corta, armado de una pestaña y reparto por grupos | Tests portados de los `test_gac_*` del plugin |
| 6 | Hooks `useEvents`, `useEventRoll`, `useSaveEventRoll` (cola `event-roll`, optimista) y la precarga | Tests con el falso: optimista, sube al reconectar, sesión nueva tras aplicarse |
| 7 | Pantalla `eventos/index.tsx` | Capturas web a 375 px, claro y oscuro: con hoy, sin hoy, más de 8 (buscador), vacía |
| 8 | Portada: `TodayEventCard` y `EventsEntryRow` en la portada del plan 04 | Captura; test: la tarjeta sale con `start`/`end` hoy y no con «en marcha» |
| 9 | `eventos/[eventId].tsx`, vista lista: secciones, chips pegados, buscador, marcar (plan 04), «Están todos», barra, selector de día, avisos, «No van», forbidden | Capturas (chips, otra delegación, pliegue abierto y cerrado, «No van», sin sesiones) y tests de pantalla |
| 10 | Sin cobertura de punta a punta: borrador, cola, día de la lista sin sesión, `UploadStatus` | Test con el falso sin conexión → marcar → guardar → reconectar → aplicada; captura de cada estado |
| 11 | Vista de una pestaña de grupos (solo lectura) y las pestañas | Capturas (cupo pasado, grupo vacío, «Sin patrulla», evento terminado); test: ningún `MarkControl` |
| 12 | Pasar lista por grupos (`by`, `group`) | Test: chip ya puesto con `group`; no inscritos en la cabecera; misma clave de cola que por cursos |
| 13 | 🔒 **Opcional, no está en el plugin**: «Solo mirar» (F8, «primero se lee, luego se marca»): la misma lista sin marcar, abriendo fichas. **Solo si el propietario da GO a F8** y dice quién la ve; sin texto de salud (decisión `salud`) | Revisión del propietario |
| 14 | Entrada en `mcm-app/CHANGELOG.md` | Revisión |

## Tests

En `__tests__/comunica/`, con el servidor falso.

- **Puros** (`utils/comunica/`): hoy/próximo/pasado y su orden; la app agrupa
  pero no recalcula etapa ni curso; otras delegaciones detrás y por nombre;
  monitores fuera de los chips de curso; «Están todos» **nunca** pisa una marca
  ni toca lo escondido o plegado; el payload solo lleva marcas no nulas de gente
  de `people`; la clave de la cola separa `new-2026-11-15` de otro día;
  «Álvarez» con la A y la ñ detrás de la n; etiqueta corta («Habitación 12» se
  queda, «12» → «Hab. 12»); armado de pestaña (no inscrito sin marca,
  «Cancelada», «Sin patrulla», monitor arriba solo en grupos «con monitor»).
- **De pantalla**: marcar, guardar y releer; sin sesiones → aviso con la fecha
  → al aplicarse aparece la sesión; `forbidden` con su texto; buscador que abre
  el pliegue; chip que filtra y cuenta; pestaña y «Pasar lista de este grupo».
- **Guardarraíles**: sin texto de salud en estos esquemas (lo recorre el de
  00); ninguna escritura de grupos de actividad en el contrato; la pestaña no
  pinta `MarkControl`; y el caso estrella de punta a punta: lista guardada,
  falso sin conexión, marcar, guardar, reconectar, aplicada.

## Preguntas abiertas

1. 🔒 (tarjeta `futuras`) **Sesiones futuras.** El plugin deja marcar la próxima sesión de un evento
   que aún no ha llegado y, si no tiene días, crearía la sesión **de hoy**,
   fuera de sus fechas. El análisis (§5) dice «no se pasa lista de sesiones
   futuras». ¿Se bloquea (app y servidor) o se deja como el plugin? **Mientras
   se decide, lo mismo que el plan 04** (revisión del 21/10, para que los tres
   planes hagan lo mismo): el día de hoy se marca aunque no haya empezado; un
   día posterior se ve pero no se marca; y la sesión de hoy solo se crea si hoy
   cae dentro de las fechas del evento.
2. 🔒 (tarjeta `marcas-autobus`) **Marcas F3 en el autobús** («No se va solo/a», «Sin fotos», «Alergia o
   tratamiento»): el plugin no las pinta aquí (F3 era para las listas de grupo);
   el contrato ya las trae en `badges`. ¿Se enseñan? Mientras tanto, no.
3. **F8, «Solo mirar»** (tarea 13): sin GO ni NO GO, ni regla de quién la ve
   (todo el equipo de la delegación o solo los monitores inscritos al evento).
