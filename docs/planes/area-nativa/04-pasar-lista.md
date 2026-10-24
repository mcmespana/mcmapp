# 04 — Pasar Lista: portada, árbol de grupos, marcar y guardar

> **Estado:** 🟢 listo para ejecutar en `nuevoComunicaChulo` · **Depende de:**
> 00, 01 y 03 · **Tamaño:** XL · Índice y reglas comunes: [`README.md`](README.md)

## Para qué y para quién

Para el **equipo** (la puerta del plan 01 decide quién entra), cada sábado, con
el móvil en una mano y chavales alrededor: ver **tu grupo y la sesión de hoy**
sin buscar, marcar en menos de un minuto y guardar, **también sin cobertura**.
Y de vez en cuando: pasar lista de otro grupo (falta su monitor), recuperar una
semana atrasada sin límite y ver qué listas faltan. El listón: que apetezca.

## Especificación de origen

En `/home/user/comunicaAreaPrivada/`; **manda el código** (pregunta 7).

- `docs/comunica/PASAR-LISTA.md` §4-§7; `PASAR-LISTA-README.md`;
  `PASAR-LISTA-ESTADO.md` §1, §2, §3 (sobre todo 3.2: un doble que miente), §4,
  §5; `PASAR-LISTA-HISTORIAL.md` (por qué el código es así).
- `pages/single_stic_pasar_lista.php`, `_marcar.php`, `_grupos.php` (árbol, e
  historial con `?sesiones=1`).
- `inc/stic-pasar-lista.php` (lógica pura: `sticpa_pl_states`, `_next_state`,
  `_pick_session`, `_absence_streak`, `_group_label`, `_group_buckets`),
  `inc/stic-pasar-lista-ui.php` (textos: `_row_html`, `_sheet_html`,
  `_session_select_html`, `_notice_html`), `inc/stic-pasar-lista-crm.php`
  (`sticpa_pl_save`, `_write_attendances`, `_att_needs_update`, `_check_saved`,
  `_group_streaks`), `js/stic-pasar-lista.js` (`initMarcar`, `queuePush`).
- `design/pasar-lista/{Main,Grupos,Marcar,Estados}.dc.html` (390 px; **el CSS en
  línea es la spec**, trampa §3.3).

## Pantallas y rutas

| Ruta (en `app/(tabs)/comunica/`) | Qué |
|---|---|
| `index.tsx` | Portada «Hoy». La puerta del plan 01 la monta en su caso 3; este plan escribe `components/comunica/pasar-lista/PasarListaHome.tsx` |
| `pasar-lista/grupos.tsx` | Árbol. Parámetro `seccion` (`MIC`, `COM:com_1`…, `?`); sin él, entero |
| `pasar-lista/[groupId]/index.tsx` | Marcar y guardar. Parámetros `sesion` (sin él, la regla) y `desde=resumen` |
| `pasar-lista/[groupId]/historial.tsx` | Historial de listas del grupo |

Cambiar de sesión es `router.setParams` (no apila). Lo de otros planes se abre
por el mapa de enlaces del plan 10 y, hasta que exista, cae en el legado con
`openLegacy` y su `internalpage`: ficha (05, `_ficha` con
`participante`, `grupo`, `sesion`), Grupos y fichas (05), resumen, monitores y
reuniones (06), lista de un evento (07).

## Datos: su trozo del contrato

Tipos del glosario de 00, **más `code: string | null` en `GroupSummary`** (el
«C1» identifica un grupo en todas las pantallas; se añade a 00 y se dice).

```
GET /v1/groups[?fresh=1]   → { generatedAt, season,              // estructura
     groups: (GroupSummary & { code, monitorNames: string[] })[],
     myGroupIds: string[],                                         // puede ser más de uno
     stageEvents: { stage, eventId, sessions: SessionSummary[] }[],
     hiddenGroups: number, participantsWithoutGroup: number }

GET /v1/today[?fresh=1]    → { generatedAt,                       // estado
     rollCalls: RollCallSummary[],          // listas de grupo del curso, toda la delegación
     eventsToday: { id, name, startsAt, endsAt, todayIs: 'single'|'start'|'end' }[],
     eventsThisSeason: number,
     pendingMeeting: { sessionId, date, name } | null }            // solo coordinación

GET /v1/sessions/:sid/groups/:gid/roll[?fresh=1] → RollDetail
   { generatedAt, session: SessionSummary, groupId, roll: RollCallSummary | null,
     monitors: { id, firstName, lastName }[],
     entries: { person: PersonSummary, mark: Mark, note: string,
                previousMarks: Mark[] }[] }   // ≤ 3, celebradas ANTES de esta, la última primero

PUT /v1/sessions/:sid/groups/:gid/roll
   { clientId, action: 'save'|'skip',
     marks: Record<personId, Exclude<Mark, null>>,   // skip: {}
     notes: Record<personId, string> }               // ≤ 255
   → WriteResult & { roll: RollDetail /* RELEÍDO */, rollCall: RollCallSummary,
       notSaved: { personId, reason: 'not_in_group'|'no_registration'|'crm_error' }[] }
```

- Grupos en orden natural de código (M4.2 antes que M4.10; sin código, por
  nombre); personas por primer apellido. `counts.participants` siempre vale (el
  «recuento fresco» del plugin era cosa del recuento nocturno).
- **`GET /v1/groups/:id/sessions` del catálogo de 00 sobra**: el historial sale
  de `/groups` + `/today`, ya en el móvil (también sin cobertura). Se quita al
  ejecutar. `?fresh=1` lo manda el pull-to-refresh: es el `?refrescar=1` del
  plugin (para cuando coordinación acaba de mover a alguien).
- **Quién puede**: cualquier papel de equipo, **cualquier grupo de su
  delegación**, sin límite de antigüedad; fuera, `forbidden`. Quién la pasó y la
  delegación las pone el servidor. **Rechazos** (`validation`):
  `nothing_marked`, `session_in_future`, `already_taken` (`skip` sobre una lista
  ya pasada o sin registro: el plugin no lo ofrece).
- **Nunca una asistencia sin inscripción**: la app manda personas y marcas,
  **nunca ids de inscripción ni de lista**. No estar inscrito es lo normal en la
  primera lista del curso: la crea el servidor; si no puede, esa marca vuelve en
  `notSaved` (`no_registration`). Quien ya no está en el grupo vuelve como
  `not_in_group` (el plugin lo tiraba en silencio).
- **No se reescribe lo que no cambia** (`sticpa_pl_att_needs_update`): ni estado
  ni motivo iguales; un motivo vaciado sí se escribe (borrar es deliberado).

**En el móvil**: las cuatro con `persist: true` (de salud, solo
`badges.healthNote`), claves `['comunica','pasar-lista','groups'|'today']` y
`[…,'roll',sid,gid]`; `staleTime` 12 h la estructura, 5 min el estado.
**Borrador** por lista, a cada toque, en el almacén del plan 01
(`draft:<sid>:<gid>`, por persona, se borra al salir). **Cola**: `key:
roll:<sid>:<gid>`, `kind: 'roll'`, `payload` = el PUT; gana la última; `clientId`
nuevo en cada «Guardar» y el mismo en sus reintentos.

**Servidor falso** (además de 00): sábados de 16:30 a 18:00 en Madrid; listas
pasadas, sin registro y huecos; rachas de 3 (con una justificada) y de 2; marcas
de grupo (y un permiso sin contestar); un grupo vacío; una etapa sin evento; un
monitor con dos grupos; inscripciones que faltan; un evento que empieza hoy; una
reunión sin lista. Aplica rechazos, `notSaved` y «no reescribir», y **cuenta las
escrituras**. Mandos nuevos: **reloj** («sábado 15:00», «domingo 10:00»,
«martes»: el `__stic_pl_now` del plugin) y «no se puede inscribir». Lección
§3.2: responde con **los mismos esquemas zod** que valida el cliente.

## Comportamiento y reglas que no se pueden perder

**Marcas**: «Vino», «Parcial», «Justificada», «No vino» y **sin marcar** (un
quinto estado, no una falta). Vino y Parcial son asistencia; las otras dos,
ausencia (también para la racha). **Qué sesión se propone** (días de Madrid):

| Situación | Sesión | Aviso (`sticpa_pl_notice_html`) |
|---|---|---|
| Hoy hay y no ha empezado | La de hoy | «Empieza a las **16:30** — aún no han llegado». Avisa, no bloquea |
| Hoy, en curso o acabada | La de hoy | — |
| Hoy no hay | La última empezada, sin límite | «Es la sesión de hace N días» (días de calendario, pregunta 6) |
| No ha empezado ninguna | La próxima | «La próxima sesión es el sábado 22 de noviembre» |

Dos el mismo día: la primera. El aviso, solo si la sesión la eligió la regla.
**No se pasa lista del futuro**: una sesión de otro día posterior se enseña sin
poder marcar (filas apagadas, sin «Han venido todos» ni «Sin registro», barra
«Aún no ha llegado» y botón apagado); el servidor la rechaza. Hoy, aunque no haya
empezado, **sí** se marca.

**Portada**, en este orden:

1. «Pasar lista»; debajo, la fecha del atajo («Sábado 15 de noviembre») o el
   curso («2025-2026»).
2. **Cola del móvil** (`useOutboxStatus`, `kind: 'roll'`): «Tienes una lista
   guardada solo en el móvil. Se envía sola con cobertura; si no, ábrela y
   guárdala:» («Tienes N listas…») y una fila por lista, «C1 · 15 nov» (« · no
   se ha podido enviar» si está atascada; sin datos, «Abrir la lista»).
3. **Evento de hoy** (los que empiezan o acaban hoy): cápsula, «Hoy» / «Hoy
   empieza» / «Hoy termina», nombre y «Pasar lista ›» (plan 07).
4. **El atajo**: el primero de tus grupos con su sesión. Pastilla («Hoy», «Hace
   N días», «Próxima»; «Pasada» si tiene lista), «C1 · Los Peques», «1º ESO ·
   16:30 – 18:00 · 11 chavalines» (pasada: «1º ESO · 9 vinieron, 2 ausencias»),
   cápsula y un botón: «Pasar lista» o «Revisar la lista». Sin grupo o sin
   sesión, no hay atajo.
5. **Lo que falta**: de todos tus grupos, la sesión propuesta sin lista (salvo
   la del atajo) y las **anteriores sin lista de las cuatro últimas
   celebradas**, la más reciente arriba. Título ámbar «Te falta 1 lista» / «Te
   faltan N listas»; fila: fecha, grupo debajo, «Recuperar». Con más de cuatro,
   tres y «Y N más · Ver todas» (al historial si son de un grupo; si no, al
   árbol). **Lo que está en la cola no falta.**
6. **Tus otros grupos** (sin sesión, con la próxima por llegar o ya pasados):
   «Tu otro grupo» / «Tus otros grupos», fila «C2 · Els Valents · 2º ESO · sáb 15».
7. **«Pasar lista de otro grupo»**: MIC, COM I, COM II, COM III, COM (sin
   segmento), LC, Sin etapa (solo las que tienen grupos), con su punto y «93
   chavalines» (con cero, «N grupos»); y «Ver todos los grupos · 28 grupos».
8. «Pasar lista en un evento · N este curso» (si N > 0) y «Resumen de grupos».
9. **Coordinación** (solo `coordination`): título con el alcance («toda la
   delegación», «COM II»), la reunión sin lista (ámbar, «Recuperar»), «Lista de
   monitores · Quién ha venido el sábado» y «Reuniones de programación ·
   Crearlas y pasar lista» (plan 06).
10. Sin grupos tuyos: «No tienes ningún grupo asignado como monitor/a, así que
    no hay atajo. Puedes pasar lista de cualquier grupo desde la lista de arriba.»

**Precarga** (decisión `offline`): con conexión, la portada pide por detrás las
listas del atajo y de «Te faltan» (cinco como mucho), para el sábado sin red.

**Árbol**: «Pasar lista» y el curso, o la sección con su punto y «5 grupos».
Primero **tu grupo** («Tu grupo»), luego MIC, COM, LC, Sin etapa. Fila:
**código** en negrita y el nombre solo si añade algo (nunca «C1 · C1»),
«Mercedes · 1º ESO · 10 chavalines», y el círculo de la **última sesión
celebrada** (✓ pasada, hueco ámbar pendiente, «No hubo»), con la leyenda arriba.
**Buscador** desde 8 grupos: «Buscar grupo, monitor o curso…», sin tildes;
vacío: «Ningún grupo coincide con lo que buscas.» Al pie: «N participantes sin
grupo asignado · No aparecen en ninguna lista» (al resumen), «¿Solo quieres
mirar las fichas? Están en Grupos y fichas» y «N grupos más en el CRM sin
marcar para Pasar Lista.»

**Historial**: «Historial de listas»; las celebradas, la última arriba: «sábado
15 de noviembre · 16:30» y «9 vinieron · 2 ausencias», «Sin registro» o «Sin
pasar», con su círculo. Toca → marcar esa fecha.

**Marcar**:

- Cabecera: código y nombre; debajo, monitores y «11 chavalines». A la derecha,
  **el selector** «3 · 15 nov ▾»: una hoja con las celebradas, la más reciente
  arriba, «3 · 15 nov · pasada | falta | sin registro» (el número es la posición
  en el curso). Sin futuras; la abierta sí. Con una sola, el dato sin control.
- Con lista: «Esta lista ya está pasada. Si la cambias, se actualiza.» o «Esta
  sesión está marcada como «sin registro».»
- **«¿No hubo sesión? · Sin registro»**, arriba y pequeño, solo sin lista y
  **siempre con confirmación**: «¿No hubo sesión con este grupo ese día? La
  lista se queda como «sin registro» y se deja de avisar.»; con marcas, «Se
  quedará como «sin registro» y no se guardará ninguna de las marcas que has
  puesto. ¿Seguro?».
- **«Han venido todos»** solo rellena lo **sin marcar**; con alguna marca, «El
  resto ha venido (N)»; sin nadie por marcar, apagado.
- **Tocar la fila**: sin marcar → Vino → No vino → sin marcar; desde Parcial o
  Justificada, a Vino. **Mantener pulsado** (500 ms; moverse cancela) abre la
  **hoja**: quién y «sábado 15 de noviembre · 16:30», los cuatro estados con el
  actual marcado («Parcial · Cuenta como asistencia», «Justificada · No es
  necesario justificar, pero a veces avisan»), el **motivo** («Añadir un motivo
  (opcional)», 255, solo con marca), «Ficha y teléfonos ›» y «Quitar la marca»
  (se lleva el motivo). Cerrarla de cualquier forma guarda lo escrito.
- Bajo el nombre (nombre y primer apellido): hasta tres **marcas del grupo**
  («No se va solo/a», «Sin fotos», «Alergia o tratamiento» sin decir cuál; un
  permiso sin contestar no marca; no se tocan) y la **nota**: «Parcial» o
  «Justificada» y, en rojo, «3 ausencias seguidas» (de la sesión anterior hacia
  atrás; un sin marcar o una asistencia la corta). Sin porcentajes aquí.
- **La flecha**, control aparte de 44 pt, abre la ficha con la sesión. Debajo de
  la lista: la leyenda, «Toca la fila para **vino / no vino**. Mantén pulsado
  para parcial o justificar.» y «Ver todas las fechas».
- **Barra fija**: el estado, los recuentos vivos («9 vinieron · 1 ausencia · 1
  sin marcar», con su plural) y el botón: «Guardar lista», «Guardar (N sin
  marcar)» o «Guardada ✓» (secundario: confirmado y sin cambios).
- **Borrador**: al volver, sus marcas van encima de las del servidor y la barra
  dice «Tienes marcas sin guardar de antes.»; con cambios, «Cambios sin guardar ·
  los datos están solo en tu móvil» (ámbar). Salir con cambios pregunta
  («Guardar» / «Salir sin guardar»; el borrador queda).

**Guardar**:

1. **Sin ninguna marca no se escribe**: no se encola y se dice «No has marcado a
   nadie, así que no se ha guardado nada. Marca al menos a una persona, o usa
   «Sin registro» si no hubo sesión.» «Sin registro» sí, con cero marcas. Con la
   lista pasada y nada distinto de lo del servidor, tampoco se encola.
2. Se encola y se ve al instante, sin rueda; se puede seguir marcando, y volver
   a guardar sustituye la entrada. **Optimista**: se parchean la lista y
   `/today` (sale de «Te faltan», entra en la cola); si acaba en `failed` o
   `stuck`, se relee del servidor y las marcas siguen en el borrador.
3. Mientras sube (`UploadStatus` en la barra): `pending` «Guardado en el móvil.
   Se enviará solo al volver la cobertura.»; `sending` «Guardando…»; `failed`
   «No se ha guardado. Tus marcas siguen aquí: vuelve a guardar.» + «Reintentar»;
   `stuck`, igual + «Descartar» (con confirmación). Sin red, «Sin cobertura.
   Puedes marcar: se guardará en el móvil.»
4. **Al contestar manda lo que releyó el servidor**: `roll` sustituye a la lista
   en caché, `rollCall` a la suya en `/today`, y se invalidan las demás listas
   guardadas del grupo (un guardado rompe o alarga rachas). Lo mandado se compara
   con lo releído (`sticpa_pl_check_saved`): todo está → «Lista guardada · 9
   vinieron, 1 ausencia» («Guardada como «sin registro»»), `h.success`, fuera el
   borrador, y «Ver el resumen» / «Otro grupo»; falta algo (`notSaved` o una
   marca releída distinta) → «N marcas no han quedado guardadas», `h.error`, y
   **el borrador sigue** con lo que no entró. Nunca «guardada» sin comprobarlo.
   Con `status: 'queued'` (el servidor la tiene, el CRM aún no): «Subida. Falta
   que la confirme el CRM.», sin reenviar.
5. `forbidden` → «No tienes acceso a esto»; `validation` → su texto. Ninguno se
   reintenta.

## Estados

| Pantalla | Cargando | Vacío | Error | Sin conexión | Pendiente de subir |
|---|---|---|---|---|---|
| Portada | Esqueleto del atajo + 3 filas | «No hay grupos de tu delegación en este curso. Si crees que es un error, avisa a coordinación.» | `AreaState` + «Reintentar» | Lo guardado + `OfflineBanner` + `SyncBadge` | La cola (punto 2) |
| Árbol | Esqueleto de filas | El mismo texto; el del buscador | Ídem | Ídem | La cola; el círculo del grupo, «pendiente de subir» |
| Historial | Esqueleto | «Todavía no ha habido ninguna sesión.» | Ídem | Funciona (es lo guardado) | `UploadStatus` en esa fecha |
| Marcar | Esqueleto de 8 filas | «Este grupo no tiene a nadie apuntado este curso todavía. Suele pasar al empezar el curso: avisa a coordinación.» + «Volver a mirar» (`fresh=1`) | Ídem; 403 «No tienes acceso a esto» | Con la lista guardada, se marca y guarda; sin ella, «Necesitas conexión la primera vez» | La barra (Guardar 3) |

Más en marcar: «Este grupo no tiene evento de sesiones semanales en el curso
actual. Avisa a coordinación.»; «Este evento aún no tiene sesiones.» (con «Abrir
en la web», pregunta 3); sesión futura, solo lectura.

## Traducción del diseño

**Igual que el plugin**: el orden de la portada, cómo se nombra un grupo, un
círculo con glifo por estado (check, medio disco, guion, cruz; sin marcar, vacío
y punteado) con la leyenda debajo, el ámbar de lo que falta, los textos y
«chavalines» en los recuentos (decisión del propietario, plan 043 fila 4 del
plugin). Colores de estado y de etapa: tokens del plan 03.

**Cambia por ser app**:

- Cabecera nativa (`AreaScreen`); refrescar, **pull-to-refresh**; buscador,
  `headerSearchBarOptions`; el `<select>` de la fecha, botón de cabecera con
  hoja; la barra, `BottomActionBar` (sobre la barra flotante y el teclado).
- Degradado del atajo y filete de «Tu grupo» → `RecordCard` plano o con acento
  (`design.md` §8); «Han venido todos» **sin cascada** (§8).
- Hoja de estados → `BottomSheet` (`@gorhom/bottom-sheet`, ya en la app).
  Gesto largo: `Pressable` con `delayLongPress={500}` y el **anillo que se
  llena** con Reanimated (solo `transform`/`opacity`; con movimiento reducido se
  queda). La pista late cuatro veces y nunca más tras el primer uso.
- Hápticos: `h.select` al cambiar una marca, `h.tap` al abrir la hoja,
  `h.success` / `h.error` al confirmar o fallar.
- Accesibilidad: la fila se lee «nombre, nota, estado», con `accessibilityActions`
  activar, «Parcial», «Justificada» y «Más opciones» (con VoiceOver no hay gesto
  largo); recuentos como región viva; `fontScale` ×1,3 sin cortar el nombre.

## Tareas

| # | Tarea | Cómo se comprueba |
|---|---|---|
| 1 | Contrato: `code` en `GroupSummary`; esquemas de `/groups`, `/today` y roll GET/PUT; métodos de `ComunicaApi` | `typecheck`; test que parsea un ejemplo válido y rechaza uno inválido de cada uno |
| 2 | Servidor falso: datos, reglas, contador de escrituras, reloj y fallos | Tests del falso |
| 3 | `utils/comunica/`: `marks.ts`, `sessions.ts`, `dates.ts`, `groups.ts`, `pending.ts` (lo que ya dejara el plan 03 se reutiliza) | Unitarios |
| 4 | `hooks/comunica/`: `usePlGroups`, `usePlToday`, `useRoll`, `useRollDraft`, `useSaveRoll` (cola, optimista, respuesta) | Tests de hooks con el falso |
| 5 | Portada `PasarListaHome` y precarga | Test + capturas web 375 px, claro y oscuro, con reloj «sábado 15:00» y «martes» |
| 6 | Árbol (secciones, buscador) e historial | Test + capturas (con y sin sección, buscando, historial) |
| 7 | Marcar: filas, toque, gesto largo, hoja, motivo, «Han venido todos», «Sin registro», selector, sesión futura, accesibilidad | Test (también de etiquetas y acciones) + capturas: hoja abierta, teclado, futura, `fontScale` ×1,3 |
| 8 | Guardar: barra, borrador, cola, estados de subida, contraste con lo releído, pasos siguientes, salir con cambios | Tests + capturas de cada estado de la barra con los mandos |
| 9 | Este bloque en `docs/contratos/COMUNICA_API.md`; `mcm-app/CHANGELOG.md` | Revisión |

## Tests

**Unitarios** (`__tests__/comunica/`), uno por regla de arriba: `nextMark`,
`countMarks`, `absenceStreak` (3 con una justificada; un sin marcar o una
asistencia corta), `isFutureSession` (23:30 UTC ya es mañana en Madrid),
`pickSession` (los cuatro casos; domingo 10:00 tras el sábado 16:30 = «hace 1
día»), `rollDiff` / `hasSomethingToSave` (marca, solo motivo, motivo vaciado,
nada cambiado con lista pasada), `fillRestPresent`, `checkSaved`,
`pendingRolls` / `pendingDisplay` (4 → 4 filas; 5 → 3 + «Y 2 más»),
`groupLabel`, `compareGroups` (M4.2 < M4.10), `groupBuckets`,
`sessionPickerOptions` y los formatos de fecha en `es-ES` y Europe/Madrid.

**De pantalla con el falso**: portada (atajo, «Te faltan 2 listas», coordinación
solo a coordinación, sin grupo, evento de hoy, cola atascada); árbol («merce»
encuentra a Mercedes); marcar (ciclo, `longPress` abre la hoja, el motivo
sobrevive a cerrarla, «El resto ha venido (3)» no pisa una falta); guardar (sin
marcas no encola; **guardar dos veces lo mismo = cero escrituras en el falso**;
`no_registration` → «1 marca no ha quedado guardada» y el borrador sigue; sin
red → `pending` y, al volver, aplicado; CRM caído cinco veces → `stuck`; otra
delegación → 403; un PUT a mano a una futura lo rechaza el falso).

**Guardarraíles**: el esquema del PUT no admite ids de inscripción ni de lista;
ningún texto de salud en estas respuestas (el test de 00 las recorre); toda fila
con etiqueta y acciones de accesibilidad; falso y cliente comparten esquemas.

## Preguntas abiertas

1. 🔒 (tarjeta `desmarcar`) **Quitar una marca guardada no la borra**: «sin marcar no se escribe»
   (`sticpa_pl_save`), así que un «Vino» quitado sigue en el CRM y al releer
   vuelve. La app hace lo mismo. ¿Se quiere que quitarla la borre?
2. 🔒 (tarjeta `futuras`) **Sesión futura**: el análisis (§5) y `PASAR-LISTA.md` §6.3 dicen que no se
   pasa lista del futuro, pero si no ha empezado ninguna el plugin propone la
   próxima y deja guardarla. El plan sigue al análisis. Confirmar.
3. **«Crear la sesión de hoy»** (plugin, 16/10/2026): fuera de alcance, WebView. ¿Nativa?
4. **COM II y COM III** son `#7c3aed` y `#be185d` en el plugin: sin token del
   plan 03, son colores nuevos. Se deciden con `territorio` (plan 03 §2).
5. ~~El glosario de 00 no coincide con el plugin~~ **Resuelto:** 00 ya dice
   «No vino», «COM I/II/III» y «chavalines».
6. **«Hace N días»**: el plugin cuenta bloques de 24 h y el domingo por la
   mañana dice «Hace 0 días»; el plan cuenta días de calendario. Confirmar.
7. **Documento contra código (se sigue el código)**: `PASAR-LISTA.md` §4 limita
   la sesión reciente a seis días (el código, no); §6.1, sin grupo se entra al
   árbol (el código pinta la portada con el aviso); §6.6, el buscador del árbol
   encuentra chavales (busca grupo, monitor o curso; los chavales, plan 05); §7,
   Pasar Lista es de monitor y coordinación (el código: todo el equipo,
   `sticpa_equipo_secciones`). El artboard `Marcar` pone «Sin registro» al final;
   el código lo subió arriba con confirmación (plan 042 PL-1).
