# 05 — Grupos y fichas

> **Estado:** 🟡 ejecutado el 24/10/2026 en `nuevoComunicaChulo` (lo que falta, en la tabla de [`README.md`](README.md)) · **Depende de:**
> 00, 01 y 03 · **Tamaño:** L · Índice y reglas comunes: [`README.md`](README.md).

## Para qué y para quién

Para el equipo (monitor, coordinación, acompañamiento) de una delegación. Es
**leer sin pasar lista**: mirar un teléfono, leerse un grupo antes del sábado,
saber a las 18:00 quién no se puede ir solo y, antes de subir fotos, quién no
puede salir. Dos piezas: **«Grupos y fichas»** (la gente por grupos, por cursos
y A-Z, con buscador, fotos y marcas; coordinación reparte desde aquí a quien no
tiene grupo) y **la ficha del participante**, que abre también la pantalla de
marcar del plan 04. Sin cobertura se ve todo menos la salud (decisiones
`offline` y `salud`).

## Especificación de origen

Todo en `/home/user/comunicaAreaPrivada/`. Si documento y código no coinciden,
manda el código.

| Qué | Dónde |
|---|---|
| La pantalla | `docs/comunica/MIS-GRUPOS.md` (entero; sobre todo §4, §5, §7, §8, **§8 bis**, §8 ter) y `pages/single_stic_mis_grupos.php`: sin grupos l.129, curso cerrado l.174-207, sin grupo l.209-258, un grupo l.264-354, Grupos l.393-545, Cursos y A-Z l.547-828 |
| La ficha | `pages/single_stic_pasar_lista_ficha.php` (entera); `docs/comunica/PASAR-LISTA.md` §6.2 (nombre de un grupo), §6.4, §7 |
| Campos | `docs/comunica/CAMPOS.md` §1 (RGPD, autorizaciones, salud, pañuelo, «Llegó VACÍO»); `PASAR-LISTA-CAMPOS-CRM.md` §3 (entorno personal), §6 (avisos), §8 (móvil del chaval) |
| Lógica | `inc/stic-pasar-lista-crm.php`: `sticpa_pl_marcas_de` l.963, `_ficha_fields` l.3714, `_panuelos` l.3739, `_avisos` l.4101, `_create_aviso` l.4200, `_set_panuelo` l.4292, `_family_fetch` l.4408, `_orden_alta` l.4623, `_phone` l.4701, `_participants_without_group` l.4845, `_assign_group` l.4935; `inc/stic-family.php` `sticpa_relacion_vigente` l.197 |
| Reglas puras | `inc/stic-pasar-lista.php`: `_curso_intensidad` l.40, `_absence_streak` l.380, `_att_track` l.1143; `inc/stic-pasar-lista-eventos.php`: `_ev_cursos` l.65, `_ev_de_persona` l.1484 |
| Gestos | `inc/stic-pasar-lista-ui.php` `_marcas_html` l.219, `_grupos_para_curso` l.720; `js/stic-pasar-lista.js`: buscador y chips l.1569-1687, «Asignar grupos» l.1689-1741, globo de salud l.1744-1840 |
| Foto y salud | `inc/stic-action.php`: `stic_pl_photo` l.1611, `stic_pl_salud` l.1673 (403, no 404) |
| Artboards | `design/pasar-lista/Ficha.dc.html`; `Grupos.dc.html` es el árbol de Pasar Lista (de esta pantalla no hay, `MIS-GRUPOS.md` §8) |

**Código contra documento.** El artboard `Ficha` y `PASAR-LISTA.md` §6.4 van por
detrás: ya no hay «REF» (tutor 1 = el primero dado de alta), los «Permisos» de
tres filas son el pliegue «Autorizaciones» de siete, el pliegue «Familia» se
quitó (el correo va con su teléfono) y no hay «Ver por sesión →» ni «En el grupo
desde». Se sigue el código.

## Pantallas y rutas

En `app/(tabs)/comunica/grupos/`; componentes en `components/comunica/grupos/`
(no confundir con `components/grupos/`, los grupos de un evento de la app).

| Ruta | Pantalla | Llega desde |
|---|---|---|
| `grupos/index.tsx` (`?view=groups\|courses\|az`) | «Grupos y fichas» | Portada «Hoy» y pie del árbol de Pasar Lista («¿Solo quieres mirar las fichas?»), plan 04 |
| `grupos/[groupId].tsx` | La gente de un grupo | Tarjeta de grupo |
| `grupos/sin-grupo.tsx` | Quien no está en ningún grupo | Tarjeta del final del índice |
| `grupos/persona/[personId].tsx` (`?groupId=&sessionId=`) | Ficha del participante | Filas de aquí y de marcar (el 04 pasa `sessionId`) |

La ficha de un **monitor** es del plan 06: su nombre dentro de un grupo enlaza
allí solo para coordinación y acompañamiento; hasta que exista, sin enlace.

## Datos

| Ruta | Para qué | Quién (lo comprueba el servidor, y el falso) | En el móvil |
|---|---|---|---|
| `GET /v1/groups` (plan 04) | Vista Grupos | Equipo de la delegación | Se guarda |
| `GET /v1/people` | Cursos, A-Z, sin grupo | Equipo de la delegación | Se guarda |
| `GET /v1/groups/:id` | Un grupo | Equipo; de otra delegación → 403 | Se guarda |
| `GET /v1/people/:id` | Ficha | Equipo; sin relación vigente con tu delegación → 403 | Se guarda, **sin los datos personales** |
| `GET /v1/people/:id/personal` | Datos personales (documento, dirección, correo, centro, talla, nº de persona) | Equipo | **Nunca**: `persist: false`, como la salud |
| `GET /v1/people/:id/health` | Salud | `Me.canSeeHealth`; fuera → 403 | **Nunca**: `persist: false`, `gcTime` 1 min |
| `GET /v1/people/:id/photo?v=` | Miniatura | Equipo; fuera → **403, no 404** | Caché de `expo-image`, vaciada al salir |
| `POST /v1/people/:id/notices` | Poner un aviso | Equipo | Cola `notice:<clientId>` |
| `PUT /v1/people/:id/scarf` | Pañuelo | Equipo | Cola `scarf:<personId>` (gana la última) |
| `PUT /v1/memberships/:id/group` | Vincular a un grupo | **Solo coordinación**; grupo y relación de tu delegación | Cola `membership-group:<id>` |

`scarf` y `memberships` no estaban en el catálogo de 00 para este bloque: la de
`memberships` la define **este plan** (allí iba en 06) y el 06 la reutiliza. De
`GET /v1/groups` (del 04) hacen falta `code?`, `isMine`, `hiddenGroupsCount` y
`counts.participants: number | null` (`null` = no se sabe: «el cero inventado»,
`MIS-GRUPOS.md` §8, lo resuelve el servidor). Si falta algo, se añade a ese
esquema; no se crea otra ruta.

Formas (a `services/comunica/contract.ts`):

```
PeopleIndex        { season, seasonClosed: boolean, people: ParticipantRow[], generatedAt }
ParticipantRow     PersonSummary & { age?, groupId: string | null, unassignedMembershipId? }
SchoolLevel        { key: SchoolLevelKey | null, label }   // null = texto que no se reconoce
SchoolLevelKey     'ep3'…'ep6' | 'eso1'…'eso4' | 'bach1' | 'bach2' | 'fp_gm' | 'fp_gs' | 'university' | 'other'
GroupDetail        { group: GroupSummary, monitors: MonitorRow[], participants: ParticipantRow[], generatedAt }
MonitorRow         { id, firstName, lastName, photoUrl? }                     // sin marcas
ParticipantProfile { person: { id, firstName, lastName, fullName, photoUrl?, age?, schoolLevel? },
                     group: GroupSummary | null,                              // null = sin grupo
                     phones: { own?, emergency? },                            // en bruto
                     guardians: Guardian[],                                   // [0] = tutor 1
                     consents: { goHomeAlone, photos, whatsapp, healthData,
                                 outings, participation, dataProtection },   // boolean | null
                     badges, scarf: Scarf, events: PersonEvent[], notices: Notice[], noticeLimit,
                     attendance: { sessions: SessionSummary[], marks: Record<id, Mark>,
                                   reasons: Record<id, string> } | null,     // null = sin sábados
                     personal: { birthDate?, document?: { kindLabel, number }, address?, school?,
                                 email?, size?, stageLabel?, comLevelLabel?, personNumber? },
                     generatedAt }
Guardian           { id, fullName, firstName?, relationship /* «Madre», '' */, phone?, email? }
PersonEvent        { eventId, name, startsAt, endsAt, status: Mark | 'no_roll' | 'registered' | 'cancelled', reason? }
Notice             { id, date /* YYYY-MM-DD */, reason, placedBy?, familyNotified }   // solo del curso
Scarf              'none' | 'red' | 'green' | 'blue' | 'yellow' | 'cross' | 'unknown'
HealthNote         { personId, items: { kind: 'allergies'|'intolerances'|'treatments'|'illnesses'|'other', text }[], generatedAt }
Escrituras         { clientId, date, reason, familyNotified, sessionId? } · { clientId, scarf } · { clientId, groupId } → WriteResult
```

- `consents` amplía el de 00 con las tres que faltan de `ficha.php` l.984-992.
  `SchoolLevel.label` es la corta del plugin («4 EP», «1 ESO», «1 Bach»), la que
  cabe en un chip; el curso es el de la relación, y si no, el del grupo.
- **Lo calcula la app** (funciones puras, las mismas que el 04 y el optimista):
  porcentaje, horas, racha, número y color de los avisos, orden y color por curso.
- **Para el servidor** (`docs/contratos/COMUNICA_API.md`): fin vacío o
  `0000-00-00` = vigente; familia de los dos lados, sin repetidos y con el
  tutor 1 primero; avisos del curso, fecha recortada a hoy; marcas con el «0»
  explícito; si el CRM no contesta, `crm_unavailable`, **nunca** una lista vacía.

**Servidor falso.** Fixtures inventados: 1-2 familiares por chaval (una familia
sin teléfonos, un chaval sin familia, uno con emergencias, dos de COM con móvil
propio, con y sin permiso de WhatsApp); ~30 % de autorizaciones `null`; salud en
1 de cada 5 (uno con `healthData: false`); foto en la mitad (imágenes abstractas,
nunca caras); ~15 % sin grupo; avisos (2 y 3); un evento del curso; rachas.
Reglas: 403 de la otra delegación; `memberships` solo coordinación; fecha futura
→ hoy; motivo vacío → `validation`; mando «curso cerrado». `ComunicaApi.photoSource(url)`
da la imagen del falso o `{ uri, headers }`: ninguna pantalla importa el falso.

## Comportamiento y reglas que no se pueden perder

**Índice.**

1. **Es de los chavales.** Los monitores solo salen dentro de un grupo y sin
   marcas (`MIS-GRUPOS.md`, nota del 28/09).
2. **Grupos**: «Tus grupos» primero (sin cabecera si no hay más), luego MIC,
   COM, LC y «Sin etapa», con «N grupos». Tarjeta: código en negrita y nombre
   solo si añade, nunca «C1 · C1» (`PASAR-LISTA.md` §6.2); debajo «Tu grupo · COM
   · 1 ESO · 12 chavalines · 2 monitores». Con `participants: null`, sin número.
   «Chavalines» en todo recuento (plan 043 del plugin, fila 4).
3. Al final, **solo si hay alguien**, la tarjeta ámbar «N personas sin grupo»
   («No salen en ninguna lista. Vincúlalas aquí.»; al que no coordina, sin la
   segunda frase) y la nota de `hiddenGroupsCount` (`_grupos_ocultos_html`).
4. **Curso cerrado** (`seasonClosed`): el aviso de `mis_grupos.php` l.205 tal
   cual («…No es un fallo de la aplicación.»). Explica el vacío; el genérico
   solo lo constata.
5. **Cursos y A-Z**: **todos** los participantes vigentes, con grupo o sin él.
   Fila: foto, nombre, marcas y «C1 · 1 ESO · 13 años»; sin grupo, «Sin grupo» en
   ámbar · curso · edad, y abre la ficha igual. Por apellido. En Cursos,
   secciones en orden escolar con «N chavalines»; «Otros» y lo que no se
   reconoce, sin color; «Sin curso» al final y en gris.
6. **Punto de cada curso**: más intenso cuanto más mayores, escala **absoluta**
   y monótona (los anclajes de `_curso_intensidad`, dos por etapa), opacidad
   `0,28 + 0,72 × peso` sobre el color de enlace del tema, que vale en oscuro.
7. **Chips** (Cursos y A-Z): «Todos N», uno por curso con su N (mismo orden que
   las secciones) y «Sin grupo» en ámbar al final. Solo si hay más de un curso o
   si hay sueltos y no lo son todos. Tocar filtra y vuelve al principio; tocar el
   activo lo suelta. Pegados arriba; se combinan con el buscador.
8. **Buscador**: sin acentos ni mayúsculas, sobre nombre y línea de debajo, en
   el móvil; **nunca** sobre el texto de las marcas ni los grupos de «Vincular»
   (`js` l.1569-1586). «Nada coincide con lo que buscas.». En Grupos, código,
   nombre, etapa y curso; el plugin promete «…monitor…» sin tenerlos en la
   tarjeta: si `GET /v1/groups` los trae, se buscan; si no, «Buscar grupo o curso…».
9. **Marcas** (`MIS-GRUPOS.md` §8 bis): como mucho «No se va solo/a», «Sin
   fotos», «Alergia o tratamiento», en ese orden. Las decide el servidor con el
   «0» explícito: **un vacío no es un «no»**, y la app no las deriva. **La de
   salud no dice cuál ni qué**, ni en su `accessibilityLabel` («Alergia o
   tratamiento: ver el detalle»); tocarla abre la hoja de salud (regla 22). En la
   lista de marcar (plan 04) no se toca.

**Un grupo y sin grupo.**

10. Un grupo: «C1 · Los Peques», «COM · 1 ESO · 12 chavalines · 2 monitores»,
    «Buscar por nombre…» y el chip «¿Quién no puede salir en fotos? N» solo si
    N > 0 (quien no contestó no lleva marca). «Monitores» arriba,
    «Participantes» debajo; sin ellos: «Este grupo no tiene participantes con
    relación vigente.»
11. Sin grupo: «Sin grupo · N personas», la explicación de `mis_grupos.php` l.226 (una para
    coordinación, otra para el resto); vacío, «Todo el mundo está en un grupo.
    Nada que revisar.». Las filas **no** abren la ficha (así lo hace el código;
    pregunta 2).
12. **Asignar grupos** (solo coordinación; acompañamiento no). En Cursos y A-Z,
    el interruptor «Asignar grupos», solo si hay sueltos, recordado por móvil
    (preferencia, no dato: `AsyncStorage` `comunica.assignGroups`). Encendido —y
    siempre en «Sin grupo»— cada suelto lleva «Vincular» → hoja con los grupos,
    **los de su curso primero** («C1 · Los Peques (1 ESO)») → «¿Vincular a Lucía
    con C1 · Los Peques?» → cola; la fila pasa a su grupo al momento, con su
    `UploadStatus`. Al resto, sin interruptor y «Vincularlos es cosa de
    coordinación.»; un 403 queda en `failed` con el texto de `mis_grupos.php` l.61. Solo pone
    grupo a una relación **que ya existe**; nunca la crea (`MIS-GRUPOS.md` §7).

**La ficha.**

13. Se abre si la persona tiene relación vigente de participante con tu
    delegación, con grupo o sin él; si no, 403 y «No tienes acceso a esta
    ficha.», sin decir si existe.
14. **Orden** (el del código): identidad (foto sobre iniciales, nombre completo,
    «C1 · Los Peques · COM · 1 ESO · 13 años» o «Sin grupo · 1 ESO · 13 años»)
    → «No puede irse solo/a a casa.» en ámbar, solo con `goHomeAlone === false`
    y la frase sola → botones grandes → lo imprescindible → Contacto → Asistencia
    → Avisos → Salud → Pañuelo → Autorizaciones y Datos personales (plegados) →
    anterior/siguiente.
15. **Botones grandes** al **tutor 1**, el primer familiar con teléfono (ya
    vienen ordenados): «WhatsApp a Marta», «Llamar a Marta (madre)». Si nadie de
    la familia tiene teléfono, no salen.
16. **Contacto**: el móvil propio primero (nombre de pila, etiqueta «Suyo»;
    **WhatsApp solo si `consents.whatsapp === true`**, llamar siempre); cada
    familiar **con o sin número** («Madre · sin teléfono») y su correo debajo;
    «Emergencias» sin WhatsApp. Sin teléfonos de familia o sin familia, los
    textos de `ficha.php` l.605 y l.617. Ni «REF» ni «firma».
17. **Teléfonos** (`_phone`): para llamar, cifras y «+»; para WhatsApp, sin «+»
    y con 34 delante si son 9 cifras. `Linking.openURL` con `tel:`,
    `https://wa.me/…` y `mailto:`, como `app/screens/ContactosScreen.tsx`.
18. **Lo imprescindible**: alergias e intolerancias **con su texto**, «N faltas
    seguidas» (≥ 3) y «N avisos»; si no hay nada, no se pinta. El texto sale de
    la salud (regla 22): sin conexión o sin permiso, en su lugar va la marca
    «Alergia o tratamiento» si `badges.healthNote`.
19. **Asistencia** (`_att_track`): el denominador son las sesiones **marcadas**;
    sin ninguna, «Sin datos» (nunca 0 %); «X h de Y h» de las marcadas; barra;
    «N de M sesiones marcadas» y «N sábados sin lista». Cuadraditos por mes con
    el mes escrito y el último con anillo; los **eventos del curso** en la misma
    fila, en su fecha, **redondos**, fuera del porcentaje y sin los que aún no
    han sido o no van; debajo, cada evento con «10 oct – 11 oct · motivo» y su
    estado («Vino»…, «Sin lista», «Apuntado/a», «No va»). Racha hacia atrás
    desde la última celebrada; un hueco sin marcar **corta**: «Lleva 3 ausencias
    seguidas.». Sin sesiones futuras. Con `attendance: null`, solo eventos.
20. **Avisos** (`PASAR-LISTA-CAMPOS-CRM.md` §6): la sección sale siempre
    («Ningún aviso este curso.»). El número **no se guarda**: sale de ordenar por
    fecha y id, así retirar uno renumera. Escala ámbar → naranja → rojo, puntos y
    «2 de 3»; cada aviso con motivo, «8 nov · lo puso Mercedes» y «Familia
    avisada» / «Familia sin avisar». En `noticeLimit − 1`: «El aviso 3 implica la
    salida del grupo. Habla con coordinación antes.»; en el límite, el texto de
    `ficha.php` l.809. «Añadir un aviso» → hoja con «Qué ha pasado»
    (obligatorio), «Cuándo» (hoy, **nunca después de hoy** en hora de Madrid) y
    «Ya he hablado con la familia» → «Registrar el aviso» → «¿Poner un aviso a
    Lucía? Coordinación lo verá.» → cola. Desde marcar lleva `sessionId`.
21. **Pañuelo**: punto, color y «Cambiar» → hoja con los demás → «¿Cambiar el
    pañuelo de Lucía a Verde?» → cola. Valor desconocido = «Desconocido».
22. **Salud**: solo con `Me.canSeeHealth` y **solo con conexión**; los cinco
    campos con su etiqueta, solo los que tienen texto; sin ninguno, no sale.
    **Nunca** se guarda en el móvil, ni va a un log, a Sentry o a un
    `accessibilityLabel` de lista. Cambio a propósito: el service worker del
    plugin guarda la ficha entera, salud incluida (`stic-pasar-lista-sw.js` l.44-51).
23. **Autorizaciones**: las siete con «Sí», «No» o «Sin contestar»; en la
    cabecera, «Todo autorizado» o «2 sin autorizar · 1 sin contestar».
24. **Datos personales** (con la ciudad en la cabecera), solo filas con dato:
    Nacimiento («30 de julio de 2013»), documento con su tipo, dirección en una
    línea, centro, correo, talla, etapa, nivel COM y nº de persona. Sin sexo.
25. **Anterior / siguiente**: solo si se llegó desde un grupo; la lista del grupo
    por apellido, **sin dar la vuelta** y guardando el hueco del lado que falta.
    Con `router.replace`: «atrás» vuelve al sitio de origen (el `vengo` del
    plugin) y no arrastra `sessionId`.

## Estados

| Pantalla | Cargando | Vacío | Error | Sin conexión | Pendiente de subir |
|---|---|---|---|---|---|
| Índice | Esqueleto de tarjetas y filas | «No hay grupos de tu delegación en este curso. Si crees que es un error, avisa a coordinación.»; en Cursos/A-Z, «No hay participantes con relación vigente en tu delegación.» o el de curso cerrado | «Reintentar» | Lo guardado + `SyncBadge`; la primera vez, el «Necesitas conexión» del 01 | Filas vinculadas con `UploadStatus` |
| Un grupo | Los chavales al instante desde `people` (`placeholderData`), monitores en esqueleto | Regla 10 | «Reintentar»; 403 | Lo guardado, o los chavales de `people` | — |
| Sin grupo | Esqueleto | Regla 11 | «Reintentar» | Lo guardado; «Vincular» se encola igual | Por fila |
| Ficha | Esqueleto de identidad, botones y dos secciones | Cada sección con su texto | «Reintentar»; 403 de la regla 13 | Todo menos la salud: «Sin conexión. La salud solo se ve con conexión.» | Aviso nuevo en su sitio y numerado; pañuelo; los dos con `UploadStatus` |
| Hoja de salud | Dos líneas de esqueleto | «Sin detalle en su ficha.» | «No se ha podido cargar. Mira su ficha.» | El texto de sin conexión de la ficha | — |

## Traducción del diseño

Se queda (plan 03): qué se enseña y en qué orden, los textos de arriba, las
marcas, «chavalines», las fechas en lenguaje humano, la escala de avisos.

Cambia por ser app:

- **Cabecera nativa**, título grande «Grupos y fichas» y el curso debajo;
  deslizar para refrescar; `SegmentedControl` para las tres vistas; buscador
  nativo (`headerSearchBarOptions`) con el texto de cada una. La ficha lleva
  «Ficha» arriba y el nombre grande en la identidad, como el plugin.
- 300 filas en `SectionList` con `useTabListScroll`; chips en una fila horizontal
  pegada arriba (el chip de filtro del calendario si se deja reutilizar; si no,
  uno local: `AppChip` es informativo).
- `PersonRow` + `PersonBadges` y `RecordCard` (plan 03), sin botón que repita el
  toque. Salud, pañuelo, «Vincular» y nuevo aviso en **hojas** (`BottomSheet`);
  confirmaciones con `Alert`; `h.select` al abrir y `h.formSuccess` al encolar.
- Pliegues: secciones plegables con `SectionHeader` y la solapa a la derecha.
- **Cuadraditos**: en el móvil no hay `title`, así que tocar la fila abre una
  hoja con cada sesión («12 sep · Justificada · Examen»); la fila lleva el
  resumen en su `accessibilityLabel`.
- Fotos con `expo-image`: iniciales debajo, `priority="low"`, `recyclingKey`,
  URL con versión; sin `photoUrl` no se pide. Al salir, `Image.clearDiskCache()`
  y `clearMemoryCache()`: vacía también las demás imágenes de la app (se vuelven
  a bajar), el precio de no dejar caras de menores en el móvil.
- Colores de etapa, pañuelo y avisos, de `theme.ts` del área (plan 03); ningún
  hex en un componente.

## Tareas

| # | Tarea | Cómo se comprueba |
|---|---|---|
| 1 | Esquemas de «Datos» en `contract.ts` y métodos de `ComunicaApi` (real y `photoSource`) | Typecheck; test que parsea cada forma y rechaza texto de salud en `ParticipantProfile` |
| 2 | Servidor falso: fixtures, rutas, reglas y mando «curso cerrado» | Tests: 403 de la otra delegación (ficha, salud, foto, grupo), `memberships` como monitor → 403, fecha futura → hoy |
| 3 | `utils/comunica/`: `people.ts` (etapas, cursos, apellido, chips, filtro, vecinos, grupos para vincular), `schoolLevels.ts`, `phone.ts`, `notices.ts`, `consents.ts`; `attendance.ts` si el 04 no lo dejó | Unitarios de abajo |
| 4 | `hooks/comunica/`: `usePeople`, `useGroupDetail`, `useParticipant`, `useHealth` (`persist: false`), `useAssignGroup`, `useSetScarf`, `useCreateNotice` con optimista; precarga de fichas y fotos de **tus** grupos con conexión, de cuatro en cuatro | Con el falso «sin conexión», la ficha de un chaval de tu grupo se abre sin haberla visitado |
| 5 | Índice: tres vistas, chips, buscador, sueltos, grupos ocultos, curso cerrado | Capturas a 375 px, claro y oscuro |
| 6 | Un grupo, «Sin grupo» y «Asignar grupos» | Capturas como coordinación y como monitor; vincular de punta a punta |
| 7 | Hoja de salud desde la marca | Capturas con conexión, sin ella y sin detalle |
| 8 | Ficha I: identidad, «solo a casa», botones, lo imprescindible, contacto | Capturas: COM con y sin WhatsApp, familia sin teléfonos, sin familia |
| 9 | Ficha II: asistencia, eventos y hoja por sesión | Capturas con racha, «Sin datos» y solo eventos |
| 10 | Ficha III: avisos y hoja de nuevo aviso | Capturas con 0, 2 y 3; sin conexión → pendiente → subido |
| 11 | Ficha IV: salud, pañuelo, pliegues, anterior/siguiente | Capturas; el último no da la vuelta |
| 12 | Entradas (pie del árbol y portada del 04, `sessionId` desde marcar) y vaciado de fotos al salir, en el borrado del 01 (dicho en el commit) | Test: salir llama al vaciado |
| 13 | Guardarraíles y entrada en `CHANGELOG.md` (pantallas nuevas) | Fallan al romper la regla; revisión |

## Tests

**Unitarios** (`__tests__/comunica/`):

- `people`: tus grupos primero y etapas en orden; cursos en orden escolar con
  «Otros» y «Sin curso» al final; apellido y luego nombre; cuándo salen los
  chips; «emaus» encuentra «Emaús» y «Ale» no saca a quien solo lleva la marca;
  chip + buscador + «sin fotos» a la vez; vecinos sin vuelta; los grupos de su
  curso primero.
- `schoolLevels`: el peso sube en toda la escalera; lo desconocido, sin color.
  `phone`: `622 14 87 03` → `34622148703`, `+44…` se queda, vacío → nada.
  `consents`: `null` es «Sin contestar»; la solapa en sus tres formas.
- `attendance`: sin marcar fuera del denominador; «Sin datos»; horas de las
  marcadas; «Parcial» cuenta; la racha se corta en un hueco y en un «vino»;
  ni sesiones futuras ni eventos. `notices`: número por fecha e id, retirar el
  del medio renumera, color tope, avisos de límite, el pendiente en su sitio.

**De pantalla** (falso + `screenSmoke`): índice como monitor y como
coordinación; vincular encola, mueve la fila y acaba `applied`; sin interruptor
para un monitor; sin WhatsApp propio con `whatsapp` `null` o `false`; botones al
tutor 1; 403; aviso de mañana imposible; pañuelo con confirmación; salud con y
sin conexión.

**Guardarraíles**: tras recorrer índice, grupo y ficha, ningún texto de salud
de los fixtures está en el almacén persistido (se serializa y se busca); las
marcas solo son booleanos; ningún `accessibilityLabel` de fila o marca lleva
texto de salud; la función que decide el WhatsApp del menor solo dice sí con
`true`; los del 01 siguen en verde.

## Preguntas abiertas

1. ✅ **Salud con `healthData` a «No»** (`salud-no` = «sí, en la ficha, como hoy
   el plugin, por si hay una urgencia», 21/10). La ficha enseña el texto
   (`ficha.php` l.532-537 y l.884-902) y, como en el plugin, **la marca de la
   lista y el globo no** (`_marcas_de` l.976, `stic-action.php` l.1708): el
   servidor devuelve `badges.healthNote = false` en las listas, pero
   `GET /v1/people/:id/health` sí da el texto a quien `canSeeHealth`. La ficha
   abre la salud desde su propia sección, no desde la marca. El falso tiene que
   cambiar a esto (hoy hace lo del globo también en la ficha).
2. **«Sin grupo» no abre la ficha** (`mis_grupos.php` l.235-255) y Cursos y A-Z
   sí desde el 16/10; la razón de `MIS-GRUPOS.md` §7 («sin grupo no hay ficha»)
   ya no vale. ¿Se enlaza también allí?
3. **Dos poblaciones de sueltos.** «Sin grupo» cuenta también a los +18 de papel
   `grupo` (`_participants_without_group`); Cursos y A-Z, solo
   `participante_mic_com` (`mis_grupos.php` l.569). El contrato tiene una lista:
   ¿con o sin los +18?
4. ~~Datos personales en el móvil~~ **Resuelto (revisión del 21/10):** la
   decisión `offline` del propietario solo guarda nombres, fotos, teléfonos de
   los tutores y marcas. Los datos personales van en su propia ruta,
   `GET /v1/people/:id/personal`, con `persist: false`, y la regla 24 se pinta
   solo con conexión («Necesitas conexión para ver los datos personales»).
5. **Colores nuevos.** Pañuelo (7) y escala de avisos (3 y su tinta) son hex
   fijos del plugin, iguales en claro y oscuro; la app no los tiene y
   `design.md` §1 pide preguntar. Con `territorio` = A, entran como tokens del
   territorio Comunica (plan 03 §2).
