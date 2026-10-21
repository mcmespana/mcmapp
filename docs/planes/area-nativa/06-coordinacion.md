# 06 — Coordinación

> **Estado:** 🟢 listo para ejecutar en `nuevoComunicaChulo` · **Depende de:** 04, 05 · **Tamaño:** L · **Índice:** [README.md](README.md)

## Para qué y para quién

Lo que hace quien **coordina** o **acompaña** a los monitores, en nativo: saber si
se pasó lista el sábado, pasar la lista de los monitores (de un sábado o de una
reunión de programación), crear reuniones, encontrar a un monitor y leer su
ficha con sus seguimientos. Coordinación lo ve todo; acompañamiento ve «Tu
equipo», el resumen y las fichas, pero no la lista de monitores ni las
reuniones (las monta coordinación). Un monitor raso solo ve el **Resumen de
grupos** (en el plugin lo ve cualquiera del equipo) y nunca una ficha de monitor.

**Este plan no inventa una segunda pantalla de marcar.** La lista de monitores
es la pantalla de marcar del plan 04 en modo `monitors` (§Comportamiento, 2): sus
filas, su `MarkControl`, su hoja del gesto largo, su barra de guardar, su
selector de sesión y su lógica de `utils/comunica/`. Si el 04 les dio otros
nombres que los que se citan aquí, se usan los suyos.

## Especificación de origen

Todo en `/home/user/comunicaAreaPrivada/`. **Manda el código**; las diferencias
con los documentos, al final de esta sección.

| Qué | Documento | Código |
|---|---|---|
| Pantalla «Coordinación» y «Tu equipo» | `docs/comunica/PASAR-LISTA-COORDINACION.md` §5 bis-§5 quater | `pages/single_stic_coordinacion.php`; `inc/stic-pasar-lista-ui.php` (`sticpa_pl_directorio_monitores_html`, `sticpa_pl_reunion_pendiente`, `sticpa_pl_nav_row_html`) |
| Quién es del equipo, papeles y chip | §5 bis; `design.md` §6.4 | `inc/stic-equipo.php` (`sticpa_equipo_papeles`, `…_papel_principal`), `inc/stic-comunica-roles.php` |
| Alcance | §2 | `inc/stic-pasar-lista-crm.php` (`sticpa_pl_coord_scope`, `…_scoped_groups`, `…_coord_monitors`, `…_monitors_of`, `…_is_acompanante`); `inc/stic-pasar-lista.php` (`…_coord_scope_label`, `…_scope_matches`) |
| Resumen de grupos | `PASAR-LISTA.md` §6.5; `PASAR-LISTA-RECUENTOS.md` §6; artboard `design/pasar-lista/Resumen.dc.html` | `pages/single_stic_pasar_lista_resumen.php`; `inc/stic-pasar-lista-ui.php` (`…_tiras_por_etapa`, `…_ultima_sesion_estado`); `inc/stic-pasar-lista.php` (`…_recuento_fresco`, `…_list_mark`) |
| Lista de monitores | COORDINACION §3; `PASAR-LISTA-ESTADO.md` §1 (el bug del guardado y su arreglo) y §2 («Un monitor que lleva varios grupos», «Las ausencias de monitores, con porcentaje») | `pages/single_stic_pasar_lista_monitores.php`; `…-crm.php` (`…_save_monitors`, `…_ensure_registrations`); `…-ui.php` (`…_row_html`, `…_legend_html(true)`); `inc/stic-pasar-lista.php` (`…_next_state_monitor`, `…_seguimiento_aviso`, `…_seguimiento_umbrales`) |
| Reuniones | COORDINACION §1, §5 ter, §6 («El evento de reuniones») | `pages/single_stic_pasar_lista_reuniones.php`; `…-crm.php` (`…_reuniones_event`, `…_es_evento_reuniones`, `…_create_reunion`) |
| Ficha del monitor | COORDINACION §4 | `pages/single_stic_pasar_lista_monitor.php`; `…-crm.php` (`…_seguimiento_monitor`, `…_monitor_grupos`, `…_monitor_historico`); `inc/stic-pasar-lista.php` (`…_att_track`, `…_listas_track`, `…_monitor_bloques`) |
| Seguimientos | `PASAR-LISTA-SEGUIMIENTOS.md` §5, §7 | `…-crm.php` (`sticpa_pl_seguimientos`, `…_create_seguimiento`); `inc/stic-pasar-lista.php` (`…_seg_tipos`, `…_seg_readable/_writable`, `…_seg_filter`, `…_seg_can_see_own`, `…_seg_del_curso`) |
| Vincular a un grupo | COORDINACION §3 («Quién sale…»), §8 | `…-crm.php` (`sticpa_pl_assign_group`) |

**Documento y código no coinciden (manda el código):** `PASAR-LISTA.md` §6.5 y
el artboard `Resumen` piden tarjetas por segmento, un % por grupo, cuatro «datos
por revisar» y asignar desde el resumen; el código pinta tarjetas por **etapa**,
dos datos por revisar y, para vincular, enlaza a «Grupos y fichas» (plan 05).
`RECUENTOS.md` §5 dice que el resumen no lee los recuentos: sí los lee (3 días
de frescura). `SEGUIMIENTOS.md` §7 agrupa por trimestre: el código no.

## Pantallas y rutas

En `app/(tabs)/comunica/coordinacion/` (Stack de `comunica/_layout.tsx`):

| Ruta | Pantalla | Quién |
|---|---|---|
| `index.tsx` | **Coordinación**: lo que falta, las tres filas y «Tu equipo» | coordinación, acompañamiento |
| `resumen.tsx` | **Resumen de grupos** | todo el equipo |
| `monitores.tsx?tipo=semanal\|reunion&sesion=` | **Lista de monitores** (de un sábado o de una reunión) | coordinación |
| `reuniones.tsx` | **Reuniones de programación** | coordinación |
| `monitor/[id].tsx?desde=grupo:<gid>` | **Ficha del monitor** y seguimientos | coordinación (su alcance), acompañamiento |

Entradas: un bloque «Coordinación» al final de «Hoy» (plan 04, `index.tsx`),
la fila «Resumen de grupos» de «Hoy» para todo el equipo, y desde el plan 05 el
nombre de cada monitor dentro de un grupo (solo coordinación y acompañamiento)
y la vista «sin grupo». Componentes en `components/comunica/coordinacion/`,
hooks en `hooks/comunica/coordination.ts`, lógica en `utils/comunica/`.

## Datos: su trozo del contrato

Tipos del glosario (`SessionSummary`, `RollCallSummary`, `Mark`, `WriteResult`,
`Me`). Nuevos, en `contract.ts`:

```
TeamMember    { id, firstName, lastName, photoUrl?, groupCodes: string[],
                stage: Stage | null, otherStages: Stage[], schoolLevel?,
                unassigned?: { membershipId, outsideGroupName? } }
StageStrip    { stage, sessions: SessionSummary[]            // celebradas, antigua → reciente
                rows: { group: { id, code, name }, monitors: { id, name }[], monitorsText?,
                        headcount: { participants, monitors, countedAt } | null,
                        cells: ('taken' | 'skipped' | null)[] }[] }   // una por sesión; null = falta
Meeting       { session: SessionSummary, name, durationHours: number | null,
                rollCall: RollCallSummary | null }
Square        { sessionId, date, name?, mark: Mark, reason? }
Phone         { display, tel, whatsapp }
FollowUpType  'incident' | 'assessment' | 'accompaniment'
FollowUp      { id, type: FollowUpType, date: 'YYYY-MM-DD', text, author }
```

| Ruta | Respuesta / cuerpo | Quién (403 si no) | Móvil |
|---|---|---|---|
| `GET /v1/coordination` | `{ generatedAt, weeklyMonitorsRoll: { session, rollCall } \| null, lastSession: StageStrip[], team: TeamMember[] }` — `lastSession`: tiras de la última sesión, grupos de tu alcance; `weeklyMonitorsRoll` solo a coordinación | coord., acomp. | se guarda |
| `GET /v1/coordination/summary` | `{ generatedAt, season, scoped, stripLimit, mine: StageStrip[], rest: StageStrip[], review: { participantsWithoutGroup: {id, firstName, lastName, photoUrl?}[], groupsWithoutCode: {id, name}[] } }` | equipo | se guarda |
| `GET /v1/coordination/monitors-roll?kind=&session=` | `{ generatedAt, kind, event: {id, name} \| null, session: (SessionSummary & {name?}) \| null, sessions: SessionSummary[], rollCall, rows: { member: TeamMember, mark: Exclude<Mark,null> \| null, reason: string \| null, seasonMarks: Mark[] }[] }` — `mark: null` = sin asistencia todavía; `seasonMarks`, una por sesión celebrada del evento de la lista | coord. | se guarda |
| `PUT /v1/sessions/:id/monitors-roll` | `{ clientId, kind, marks: { personId, mark: Exclude<Mark,null>, reason? }[] }` → `WriteResult & { rollCall }` | coord. | **cola** `monitors-roll:<sesión>` |
| `GET /v1/coordination/meetings` | `{ generatedAt, season, meetings: Meeting[] }` (de la más reciente a la más antigua) | coord. | se guarda |
| `POST /v1/meetings` | `{ clientId, name (1-120), date, startTime ('19:00'), durationHours (1·1,5·2·3·4; 1,5) }` → `WriteResult & { meeting }` | coord. | **cola** `meeting:<clientId>` |
| `GET /v1/monitors/:id` | `{ generatedAt, monitor: { …TeamMember, age?, monitorSinceYear?, mobile?: Phone, otherPhone?: Phone, email?, doNotCall }, weekly: { registered, squares: Square[] } \| null, meetings: { registered, squares } \| null, rollCalls: { group: {id, code}, squares: { sessionId, date, state: 'mine'\|'other'\|'skipped'\|'missing' }[] }[], groups: { group: {id, code, name, schoolLevels, inRollCall}, role: 'leads'\|'member', since?, counts, colleagues: {id, name}[] }[], history: { season, current, groups: { code, name, schoolLevels, colleagues }[] }[], paperwork: { compliance: {label, ok, required, note?}[], mcm, training: {label, value, ok, warn?}[], congresses: string[], academic?, personal } }` (`mcm` y `personal`: `{label, value}[]`, etiquetas ya traducidas por el servidor) | coord. (monitor de su alcance), acomp. | se guarda |
| `GET /v1/monitors/:id/follow-ups` | `{ generatedAt, readable: FollowUpType[], writable: FollowUpType[], items: FollowUp[] }` (todos los cursos) | coord., acomp. | **`persist: false`** |
| `POST /v1/monitors/:id/follow-ups` | `{ clientId, type, date, text }` → `WriteResult & { item }` | según `writable` | **cola** `follow-up:<clientId>` |
| `PUT /v1/memberships/:id/group` | `{ clientId, groupId }` → `WriteResult` (la misma ruta que «Asignar grupos» del plan 05: la crea el primero que se ejecute) | coord. | **cola** `membership:<id>` |
| `POST /v1/events/:id/sessions/today` | `{ clientId }` → `WriteResult & { session }` (la comparte el plan 07; si ya existe, se reutiliza) | coord. | cola `session-today:<evento>` |

Claves de consulta: `['comunica','coordination', 'home' | 'summary' | 'meetings' | ['monitors-roll', kind, sesión] | ['monitor', id] | ['monitor', id, 'follow-ups']]`.
El alcance y los papeles salen de `useMe()` (`roles`, `scope`); la pantalla no
los vuelve a pedir.

**Los seguimientos no se guardan en el móvil** (decisión de este plan): son lo
que una persona escribió sobre otra, y las de acompañamiento, lo más privado del
sistema. Van en su ruta, como la salud. La cola guarda el texto de un alta solo
hasta que sube.

**Servidor falso**: tres reuniones (pasada con faltas y motivos, celebrada hace
< 30 días sin lista, futura) **sin ningún monitor inscrito**; dos monitores sin
grupo (comodín y grupo fuera de Pasar Lista); uno en MIC y COM; uno con 3
faltas seguidas, uno < 60 % con ≥ 4 marcas, uno con 3 marcas; seguimientos de
los tres tipos, del curso anterior, de tipo desconocido y sobre la propia
persona de coordinación; un recuento de hace 5 días; un grupo sin código;
chavales sin grupo. Personas: coordinación de toda la delegación, coordinación
COM · COM 2, solo acompañamiento, las dos y monitor raso. Cumple las reglas de
abajo y **cuenta inscripciones** (para el bug del parte de estado §1).

## Comportamiento y reglas que no se pueden perder

1. **Alcance** (`sticpa_pl_coord_scope`): relaciones de coordinación vigentes
   (fin vacío, `0000-00-00` o futuro). Sin etapa ni segmento = toda la
   delegación; con varias, gana la más amplia. El segmento sale del grupo del
   que cuelga la relación; un grupo sin segmento **no** entra en un alcance por
   segmento. Etiqueta (`scopeLabel`): «toda la delegación», «COM», «COM · COM 2»
   (segmento con `_` → espacio y en mayúsculas). Acompañar no da alcance: ve los
   monitores de todos los grupos de la delegación. Coordinar y acompañar no son
   jerárquicos: quien hace las dos ve la unión.
2. **Lista de monitores = marcar del plan 04 en modo `monitors`:** arranca
   **todo en verde** (`mark: null` se pinta `yes`); el toque alterna `yes` ⇄
   `no_unjustified` (desde parcial o justificada, a `no_unjustified`); el gesto
   largo abre la misma hoja (4 estados + «Añadir un motivo»); «Quitar la marca»
   vuelve a verde; volver a «vino» se lleva el motivo. Sin «Han venido todos» y
   sin «Sin registro». Bajo el nombre: grupos · curso (o «Sin grupo asignado») y
   el motivo de cualquier falta o parcial en una línea («Justificada ·
   Examen»), entero en la hoja. Pista: «Están todos en verde. Marca solo a
   quien no vino.» y, bajo la leyenda, «Toca la fila para **marcar una falta**.
   Mantén pulsado para justificarla y escribir el motivo.» Si ya estaba pasada:
   «Esta lista de monitores ya está pasada: N vinieron, N faltas. Si la
   cambias, se actualiza.»
3. **Al guardar se manda `yes` explícito para cada fila**: el cuerpo lleva
   todas, ninguna `null` (el esquema lo rechaza). Aquí el verde es un dato. El
   servidor crea las inscripciones que falten (casi ningún monitor está
   inscrito, y al de reuniones ninguno), no reescribe lo que no cambia, deja la
   lista `taken` con sus números, recorta el motivo a 255 y no duplica con el
   mismo `clientId`. **La app no verifica comparando con lo que tenía**: el
   fallo del 26/09 fue releer con el mapa de antes (parte de estado §1). Cuando
   la cola dice `applied`, se vuelve a pedir la lista, la portada y las
   reuniones, y lo que diga el servidor es la verdad.
4. **Por etapa** (MIC, COM, LC, «Sin etapa»), con cuenta de filas propias;
   una sola etapa no lleva cabecera. Un monitor de dos etapas sale **una vez**,
   en la de su curso más bajo, y la otra sección lo nombra: «También lleva grupo
   de esta etapa: David Soler (MIC). Sale una sola vez, en su otra sección.»
   (se pinta aunque esa sección no tenga filas propias). Orden: curso → grupo
   (natural, C2 antes que C10) → apellido; lo manda el servidor y la app no
   reordena.
5. **Quién sale**: relación de monitor vigente en un grupo de la delegación
   dentro del alcance; la inscripción no cuenta. Los «sin grupo» (vacío o
   comodín) solo los ve quien coordina toda la delegación, en «Sin etapa».
6. **Porcentaje y aviso en la lista**: solo con **4 sesiones marcadas o más**;
   el % pequeño y gris al final de la línea, rojo si < 60 %. Nota roja bajo el
   nombre solo si algo no va: «3 seguidas sin venir» (faltas seguidas al final,
   saltando huecos; umbral 3) o, si no, «55 % de asistencia». Una sesión sin
   marcar no cuenta en el porcentaje. Sobre las sesiones del evento de la lista.
7. **Qué sesión**: en la semanal, el evento de la etapa del alcance o, sin
   etapa, el primero de COM, MIC, LC; la sesión, con la regla y el aviso del
   plan 04 (`pickSession`) y su selector (las futuras no se ofrecen). En una
   reunión, la de `sesion`. La lista semanal **nunca avisa en ámbar**.
8. **Reunión sin pasar**: solo la última celebrada, sin lista y durante 30 días;
   ámbar con «Falta 1 lista» y «Recuperar», en «Hoy» y en Coordinación.
9. **Reuniones**: estado con el idioma del historial de un grupo: ✓ «11
   vinieron · 3 faltas», círculo vacío «sin pasar», «sin registro», o «todavía
   no ha llegado» sin marca. El nombre manda; debajo, fecha · duración. Alta
   detrás de «+ Nueva reunión»: Nombre (foco, «Programación del 2.º
   trimestre»), Día (hoy), Empieza (19:00), Dura (1 · 1,5 · 2 · 3 · 4 h; 1,5).
   El servidor crea el evento del curso si no existe (prefijo «Monitores |
   Reuniones de programación» + curso; el nombre exacto gana).
10. **Resumen**: con alcance acotado, solo lo tuyo se cuenta y «El resto de la
    delegación» va plegado aparte. Tarjeta por etapa: **suma entera o nada**: si
    todos sus grupos tienen recuento de ≤ 3 días (y no futuro), «93
    chavalines» con «8 grupos» y «12 monitores»; si no, «8 grupos» con «sin
    recuento» o «2 sin recuento». «Última sesión · sáb 15 nov» (o «Última sesión
    de cada etapa»), «17 de 23 listas», «6 grupos sin pasarla todavía» o «todas
    pasadas», el % y un chip por grupo que falta (abre esa lista); «sin
    registro» cuenta como hecha. Por grupo: código y nombre, pastilla de la
    última sesión (Al día / Falta / Sin registro / Pasada), quién lo lleva
    (enlace a la ficha para coordinación en lo suyo y acompañamiento), tira y «N
    sin pasar». Datos por revisar: chavales sin grupo (coordinación:
    «Vincularlos a su grupo» → plan 05; los demás: «A su grupo los vincula
    coordinación, desde Grupos y fichas.») y grupos sin código corto. Pie: «La
    tira enseña las sesiones del curso hasta hoy.» o «…las últimas 12 sesiones.»
11. **Coordinación**: cabecera «Coordinación» con el alcance de subtítulo (o
    «Acompañamiento» si solo acompaña). Filas que dicen lo que hay: «Lista de
    monitores» («sáb 15 nov · pasada: 11 vinieron, 3 faltas» / «sin registro» /
    «sin pasar», en gris), «Reuniones de programación» («Crearlas y pasar
    lista») —las dos solo coordinación— y «Resumen de grupos» («sáb 15 nov · 1
    de 2 listas · falta C2», hasta 4 códigos y «y N más»; misma cuenta que el
    resumen). «Tu equipo · N monitores», primero «Sin grupo» (con «Vincular»
    solo para coordinación y el aviso «Tienen relación de monitor, pero no
    cuelgan de ningún grupo de la delegación…») y después por etapa.
12. **Ficha, en este orden** (COORDINACION §4): identidad («C1 · C2 · 4º ESO ·
    23 años · monitor/a desde 2019»); pastilla «Falta: Certificado de delitos
    sexuales · … y N más» si falta algo **obligatorio** (LOPD e imágenes no
    cuentan); WhatsApp y Llamar; el correo con Copiar; «Otro teléfono · para una
    urgencia»; «Ha pedido que no se le llame por teléfono.». **Cómo va este
    curso**, tres pistas nunca promediadas: Sábados (cuadraditos, % o «sin
    datos», «Vino a X de Y · N sábados sin marcar, fuera de la cuenta»; sin
    inscripción, «No está inscrito al evento de sesiones…»), Reuniones (fracción
    «2 de 4», nunca %; «Todavía no ha habido ninguna reunión de programación.» o
    «Todavía no aparece en ninguna lista de reunión.»; cada falta con su reunión
    y su porqué o «sin motivo») y «Listas del C2» (suya /
    de otra persona / falta / sin sesión, con los pies del código y la nota «La
    lista de un grupo la puede pasar quien cubra ese sábado…»). **Sus grupos**
    («lo lleva» / «su grupo», recuentos, «Con Ana, Luis y 3 más»; el que lleva
    abre su lista del plan 04; sin grupo, «Sin grupo asignado» + Vincular),
    **Seguimientos**, **Por dónde ha pasado** (plegable y abierto, solo
    relaciones de monitor) y **el papeleo al final**: En regla, Datos MCM,
    Formación y Datos personales plegados. Sin familia y sin salud. Anterior /
    siguiente sobre «Tu equipo» o, con `desde=grupo:`, los de ese grupo.
13. **Seguimientos** (SEGUIMIENTOS §5): incidencias y valoraciones las
    escribe coordinación y las leen coordinación y acompañamiento; las de
    acompañamiento, solo acompañamiento. **Nadie ve los suyos**: sobre uno
    mismo el servidor devuelve `readable` y `writable` vacíos y la sección **no
    existe** (el código pinta una vacía con un alta que siempre falla: aquí se
    sigue a SEGUIMIENTOS §7). Dos cierres en el servidor (pide solo lo legible y
    vuelve a filtrar); tipo desconocido no se enseña. Por defecto solo este
    curso; «Ver también los de 2025-2026» / «Ver solo los de 2026-2027» sin
    pedir nada (sin fecha, sale siempre). Vacío tranquilo: «Nada apuntado este
    curso.». Alta detrás de «Escribir un seguimiento»: Tipo (solo `writable`,
    con foco), Día (hoy; la fecha del hecho), «Qué pasó» («En dos líneas, para
    acordarse.»). Si puede escribir acompañamiento: «Las notas de acompañamiento
    solo las ve quien acompaña. Ni coordinación ni la propia persona.»
14. **Vincular**: se toca la relación, no la persona; grupo y relación de la
    delegación, comprobados en el servidor; solo coordinación.
15. **Chip y alcance sin frase explicativa** (`design.md` del plugin §6.4): uno
    como mucho, el que más explica (coordinación antes que acompañamiento);
    «Monitor/a» nunca lleva chip.

## Estados

| Pantalla | Cargando | Vacío | Error / 403 | Sin conexión | Pendiente de subir |
|---|---|---|---|---|---|
| Coordinación | esqueleto de filas | «No hay monitores con relación vigente en los grupos de tu alcance.» | 403: «Esta pantalla es de coordinación y acompañamiento. Si crees que deberías verla, avisa a la oficina técnica.» | datos guardados + `SyncBadge` | un «Vincular» en cola: el monitor ya en su etapa con `UploadStatus` |
| Resumen | esqueleto de tarjetas y tiras | «No hay grupos de tu delegación en este curso.» | Reintentar | guardado + `SyncBadge` | — |
| Lista de monitores | esqueleto de filas | sin evento: «No hay evento de sesiones semanales en el curso actual.» / «Todavía no hay ninguna reunión creada.» (→ Reuniones); sin sesiones: «Este evento aún no tiene sesiones.» + «Crear la sesión de hoy»; sin monitores: el vacío de Coordinación | 403: «Esta pantalla es de coordinación.» | se marca y se guarda en la cola: «Sin cobertura. Puedes marcar: se guardará en el móvil.» | barra del plan 04: «Cambios sin guardar · los datos están solo en tu móvil», «Guardada en el móvil», `stuck` |
| Reuniones | esqueleto | `EmptyState` «Todavía no hay reuniones este curso.» con la acción «Nueva reunión» | Reintentar | guardado; el alta va a la cola | reunión nueva con `UploadStatus`; **no se abre su lista hasta que suba** (no tiene id) |
| Ficha | esqueleto de identidad y pistas | — | 403: «Este monitor no está en los grupos de tu alcance.» | ficha guardada; seguimientos: «Los seguimientos necesitan conexión.» | seguimiento nuevo arriba con `UploadStatus` |

## Traducción del diseño

- **Igual que en el plugin**: textos, orden, estados, el verde por defecto, la tira, los cuadraditos y sus leyendas.
- **Cabecera nativa** con título y subtítulo de alcance; refrescar = deslizar.
  «Se vuelve por la puerta por la que se entró» (`desde=`) lo hace el Stack:
  no hace falta parámetro salvo `desde=grupo:` para el anterior/siguiente, que
  usa `router.replace` (atrás vuelve a la lista, no a la ficha anterior).
- **Buscador nativo** (`headerSearchBarOptions`) en Coordinación: «Buscar
  monitor o grupo…», filtra solo «Tu equipo», sin acentos ni mayúsculas.
- **Hojas** (`BottomSheet`) para «Nueva reunión», «Escribir un seguimiento» y
  «Vincular» (lista de grupos de la delegación de `GET /v1/groups` del plan 04,
  los de su curso primero); confirmar descartar con `Alert`.
- **«Hoy»**: al final, para coordinación o acompañamiento, `SectionHeader`
  «Coordinación» con el alcance en gris (coordinación) o `RoleChip`
  «Acompañamiento» (si solo acompaña); filas: la reunión sin pasar en ámbar,
  «Lista de monitores» y «Reuniones de programación» (coordinación: dos puertas a
  la misma pantalla, como en el plugin) y «Tu equipo» → `coordinacion/`.
- **«Última sesión» sin degradado**: en el artboard es un degradado de marca,
  que la app prohíbe fuera de Contigo (`design.md` §8) y que el plan 03 reserva
  a la acción principal. Card estándar con el número grande.
- **Tira y cuadraditos**: celdas de 14 × 7 no se tocan con un dedo (plugin, plan
  042 PL-6): la tira entera es un solo toque → historial del grupo (plan 04), en
  todas las plataformas. Cada pista de la ficha se toca entera y abre una hoja
  con cada sesión, su estado y su motivo (sustituye al `title` de la web).
- Tarjetas de etapa con `StatCard`; chips de tipo de seguimiento con
  `StatusChip` por clave (incidencia ámbar, valoración acento, acompañamiento
  morado LC, todo de tokens; el plugin los pinta con hex en `style=`).
- Ancho (≥ 720, `useResponsiveLayout`): ficha a dos columnas (el papeleo a la
  derecha) y etapas en columnas en «Tu equipo» y el resumen.

## Tareas

| # | Tarea | Cómo se comprueba |
|---|---|---|
| 1 | Esquemas de este plan en `contract.ts`; datos y lecturas en el servidor falso, con sus 403 | Test de esquemas (válido / inválido; `marks` con `null` falla); recorrido «cada ruta tiene datos» del 00 |
| 2 | Escrituras en el falso: lista con inscripciones creadas, reuniones, seguimientos con sus permisos, vincular, sesión de hoy; idempotencia por `clientId` | Tests del falso de §Tests |
| 3 | Lógica pura en `utils/comunica/` (`scope.ts`, `monitorsRoll.ts`, `monitorAlert.ts`, `summary.ts`, `meetings.ts`, `monitorDetail.ts`, `followUps.ts`, `team.ts`) | Unitarios de §Tests |
| 4 | Modo `monitors` en las filas, la hoja y la barra del plan 04 (sin componentes nuevos de marcar) | Tests del 04 en verde + los del modo |
| 5 | `monitores.tsx` (semanal y reunión) con cola, «Crear la sesión de hoy» y relectura al subir | Pantalla con el falso; captura 375 px claro y oscuro |
| 6 | `reuniones.tsx` y la hoja «Nueva reunión» | Ídem |
| 7 | `resumen.tsx` | Ídem, como coordinación COM, toda la delegación y monitor raso |
| 8 | `coordinacion/index.tsx`: filas, «Tu equipo», buscador, «Vincular» | Ídem, como coordinación y como acompañamiento |
| 9 | `monitor/[id].tsx` sin seguimientos (identidad, pistas, grupos, histórico, papeleo, anterior/siguiente) | Ídem; 403 fuera de alcance |
| 10 | Seguimientos: lectura sin persistir, filtro de curso, alta en cola | Guardarraíl de persistencia; pantalla como coord., acomp., ambas y sobre uno mismo |
| 11 | Bloque «Coordinación» y fila «Resumen de grupos» en «Hoy»; enlaces desde el plan 05 (monitores de un grupo → ficha; resumen → «sin grupo») | Capturas de «Hoy» con cada persona |
| 12 | Guardarraíles, `docs/contratos/COMUNICA_API.md` (este trozo) y `mcm-app/CHANGELOG.md` | Tests en verde; revisión |

## Tests

**Unitarios** (`__tests__/comunica/`, sin React):
- `scopeLabel`: delegación, etapa, etapa + segmento, solo segmento.
- Modo monitores: ciclo del toque, «Quitar la marca» → `yes` sin motivo, marcas
  efectivas (una por fila, ninguna `null`, motivo fuera con `yes`, ≤ 255),
  cuentas (parcial cuenta como vino), reparto por etapa y «prestados» (también
  con una sección solo de prestados).
- Aviso: < 4 marcadas → nada; 3 faltas finales saltando huecos; < 60 %; el % de
  la fila solo con ≥ 4.
- Resumen: pastilla y huecos; última sesión (sin registro cuenta, fechas por
  etapa); suma entera o nada (recuento de 3 días, de 4, futuro); línea de
  Coordinación con 5 grupos que faltan («y 1 más»).
- Reuniones: los cuatro estados; reunión sin pasar (31 días o una posterior con
  lista → nada).
- Ficha: pies de las tres pistas, «sin datos», faltas a reuniones con «sin
  motivo», «Ana, Luis y 3 más», pastilla de requisitos sin LOPD.
- Seguimientos: tabla de quién lee y escribe (la usa el falso), uno mismo →
  nada, tipo desconocido fuera, cursos. Buscador (acentos, código) y vecinos.

**De pantalla con el servidor falso:** lista que arranca en verde y manda
todas las filas al guardar; **primera lista de una reunión con monitores sin
inscribir → `applied` y al volver se ven todas las marcas; segunda vez, cero
inscripciones nuevas** (el bug del parte de estado §1); sin conexión → en
cola y sube al reconectar; acompañamiento no ve «Lista de monitores» ni
«Reuniones» y recibe 403 si entra por ruta; coordinación COM · COM 2 no ve
grupos sin segmento; «Sin grupo» solo para toda la delegación y «Vincular» lo
mueve; coordinación no puede elegir «Acompañamiento» como tipo; un monitor
raso no tiene enlaces a fichas en el resumen.

**Guardarraíles:** la consulta de seguimientos no llega al almacén (con el
persistidor real del 01); `monitores.tsx` importa las filas y la hoja de
`components/comunica/pasar-lista/` y `components/comunica/coordinacion/` no
define otra hoja de marcas; ningún texto de `coordinacion/` contiene «porque
coordinas», «porque eres» ni «porque acompañas» (§6.4).

## Preguntas abiertas

1. **MIC y COM en eventos separados** (parte de estado §1, 🔴): quien coordina
   toda la delegación pasa la lista del sábado sobre el evento de COM, y los
   monitores de MIC acabarían inscritos en COM. **Resuelto en la revisión
   (21/10):** cuando el alcance cubre más de una etapa, la lista de monitores
   lleva un `SegmentedControl` de etapa y cada etapa va sobre su evento. Es
   arreglar un fallo conocido, no cambiar una regla.
2. 🔒 (tarjeta `alcance-coord`) **Varias relaciones de coordinación de etapas distintas** (MIC y COM, ninguna
   más amplia): el plugin se queda con la primera que devuelve el CRM; `Me.scope`
   del plan 00 admite listas. ¿La primera o la suma?
3. 🔒 (tarjeta `alcance-coord`) **Alcance de acompañamiento**: el encargo dice «por sus relaciones con etapa
   y segmento»; el código no le da alcance (ve toda la delegación) pero, de
   rebote, **no ve a los monitores sin grupo**. ¿Es lo querido?
4. **El % de sábados en la ficha**: el encargo dice «solo con 4 marcas o más»;
   el código solo aplica el mínimo en la lista, y la ficha lo enseña desde una
   marca. El plan sigue al código.
5. 🔒 (tarjeta `futuras`) **Una reunión futura**: el código deja abrir y guardar su lista; las reglas
   del análisis (§5) dicen «no se pasa lista de sesiones futuras». El plan
   sigue al código y el falso no la bloquea. **Corregido en la revisión
   (21/10):** mientras se decide, lo mismo que el plan 04 (se ve, no se marca),
   para que los tres planes hagan lo mismo.
6. ~~Seguimientos sobre uno mismo~~ **Resuelto:** la regla es «nadie ve ni
   escribe los seguimientos sobre sí mismo», así que la sección no se pinta.
