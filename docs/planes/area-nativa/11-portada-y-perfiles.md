# 11 — Portada de familia y perfiles

> **Estado:** 🟢 listo para ejecutar en `nuevoComunicaChulo` · **Depende de:** 00, 01, 02, 03 ·
> **Tamaño:** M · **Índice:** [README.md](README.md)

## Para qué y para quién

Para quien entra y no es solo del equipo: familias y miembros del MCM. Es su portada: qué puede hacer
(los bloques del menú), qué tiene cerca («Próximas actividades») y, si tiene hijos, a quién está
viendo. Y deja a los planes de familias (12-16) la pieza que todos usan: **`useActiveProfile()`**, la
persona que se está viendo (uno mismo o un hijo), con «¿A quién ves?», el cambio rápido «Viendo a» y
la elección previa cuando un enlace llega a una familia con varios hijos.

Los tres casos del plugin (`inc/stic-family.php` l. 26-40), con su nombre en el contrato:

| Plugin | `Audience` | Quién | Qué ve |
|---|---|---|---|
| `miembro` | `member` | Miembro del MCM (cualquier marca que no sea solo `familiar_menor`), tenga hijos o no | Lo de cualquier miembro; a sus hijos, con el selector |
| `familiar` | `guardian` | Familiar y nada más, viéndose a sí mismo | Sus datos, sus pagos y las tarjetas de sus hijos |
| `participante` | `child` | Un familiar viendo a un hijo | El área entera, con los datos del hijo |

## Especificación de origen

En `/home/user/comunicaAreaPrivada/`; manda el código.

| Qué | Dónde |
|---|---|
| Portada: saludo, tarjetas de hijos, aviso del certificado, bloques, orden, agenda | `pages/single_stic_home.php` (entera) |
| Secciones, orden y etiquetas por audiencia; selector «Viendo a»; nombre corto; tarjeta de perfil | `menu.php` l. 6-116 y 209-379 |
| Descripción e icono de cada sección | `sinergiacrm-private-area.php` l. 441-557 (`sticpa_section_meta`) |
| Familiar, miembro, vigencia, hijos, audiencia, secciones visibles, aterrizaje, enlace con varios hijos, a dónde se vuelve al cambiar | `inc/stic-family.php` (entera) |
| Viendo a un hijo no se pasa lista | `inc/stic-equipo.php` l. 118-123 |
| Audiencia y aviso del certificado | `inc/stic-comunica-roles.php` l. 209-314 |
| «¿A quién quieres ver/apuntar?» | `pages/single_stic_profile_selection.php` |
| Cambio de perfil: id validado, `dest` y `volver` | `inc/stic-action.php` l. 10-100; `inc/stic-security.php` l. 422-460 (`sticpa_allowed_profile`) |
| Aterrizaje, enlace profundo, salir | `sinergiacrm-private-area.php` l. 988-1102 y 1237-1280 |
| «Próximas actividades» | `inc/stic-calendar.php` l. 723-857 y, de dónde sale, l. 254-512 |
| Decisiones | `plans/043-decisiones-del-10-10.md` filas 1 (CAR-1), 3 (FAM-a8), 7 (FAM-a13) y 8 (FAM-a11); `plans/042-pulido-integral/auditoria-familias.md` FAM-a1, a8, a11, a13, a14; `auditoria-carcasa.md` CAR-1 y CAR-5; `docs/ACCESO.md` §4.b; `docs/design-system.md` §6 |

## Pantallas y rutas

| Ruta o pieza (en `app/(tabs)/comunica/`) | Qué |
|---|---|
| `index.tsx` (la puerta del plan 01) | Monta `AreaHome` en sus casos 3 y 4; si «hay que elegir» (abajo), `perfiles` |
| `perfiles.tsx` | «¿A quién quieres ver?» / «¿A quién quieres apuntar?». Parámetro `destino`: un destino del plugin ya validado por `links.ts` (plan 10) |
| `AreaHome` (`components/comunica/inicio/`) | **Una sola portada**, un scroll y un pull-to-refresh: arriba lo del equipo (`PasarListaHome`, plan 04) si hay papel de equipo; debajo, `MemberHome` |
| `MemberHome` | Saludo, hijos, «Actividades», «Próximas actividades», «Tu perfil» |
| `ActiveProfileBar` + `ProfileSwitcherSheet` (`components/comunica/perfiles/`) | «Viendo a · Lucía ▾» y la hoja «Ver como…». La ponen arriba las pantallas de 12-16 |
| `hooks/comunica/useActiveProfile.ts`, `useMyProfiles`, `useProfileScope` | Ver «Datos» |
| `utils/comunica/profiles.ts`, `home.ts` | Lógica pura |
| `UpcomingAgenda` (`components/comunica/inicio/`) | «Próximas actividades», con `useCalendar` y `upcomingAgendaItems` del plan 16 |

La portada no conoce las rutas de otros planes: abre **destinos del plugin**
(`{ internalpage: 'list_stic_events' }`, `{ internalpage: 'single_stic_events', action: 'detail', id }`)
con la función de `links.ts` del plan 10, que ya sabe qué pantalla nativa (o el legado) toca.

## Datos: su trozo del contrato

**Convención para todos los planes de familias**: lo de la persona que se ve cuelga de
`/v1/profiles/:pid/…`. El servidor comprueba en **cada** petición que `pid` es quien ha entrado o un
hijo con relación vigente (`sticpa_allowed_profile`); si no, `forbidden` (403, nunca 404). Las claves
de consulta llevan el `pid` (`['comunica', bloque, pid, …]`): cambiar de hijo no borra nada y volver
es instantáneo.

```
GET /v1/me/profiles[?fresh=1] → { generatedAt, self: ProfileRef, children: ProfileRef[] }
ProfileRef  { id, firstName: string | null, lastName: string | null, gender: 'female' | 'male' | null }
```

- **Papeles `member` y `guardian` de `Me`** (plan 00), para el servidor: `guardian` ⇔ `children` no
  está vacía; `member` ⇔ en `stic_relationship_type_c` hay alguna clave que no es `familiar_menor`
  (`sticpa_es_miembro_por_tipo_de_relacion`, `stic-family.php` l. 114-137) o un papel de equipo.
- **Vigencia, una sola regla** (`sticpa_relacion_vigente`, l. 197-222): empezada (o sin inicio) y fin
  vacío, `0000-00-00` o futuro. ⚠️ El plugin la incumple en un sitio: `check_user_adult()`
  (`sinergiacrm-private-area.php` l. 988-1020), que decide si eres familiar, filtra en SQL
  `start_date <= hoy AND (end_date >= hoy OR end_date IS NULL)` y deja fuera un inicio nulo y un fin vacío o
  `0000-00-00`, que la lista de hijos sí cuenta. El servidor usa la buena para las dos cosas.
- **No se contesta un vacío que no se ha podido resolver** (l. 364-376, plan 040): si el CRM no
  contesta, `crm_unavailable`, nunca `children: []`. Un hijo cuyo nombre no llega sale igual, con
  nombres `null` («Participante» en pantalla): perder el acceso es peor que un nombre feo (l. 332-356).
- Los hijos, por nombre (en el plugin, en el orden que dé el CRM). `gender` sale de `stic_gender_c` y
  sirve para «Yo mismo» / «Yo misma»; con `null`, la heurística del plugin (`sticpa_guess_self_label`,
  `menu.php` l. 287-312), portada tal cual.
- **Agenda: sin ruta propia.** Como en el plugin, sale de los datos del calendario
  (`sticpa_gather_calendar_data`): `GET /v1/profiles/:pid/calendar` y `upcomingAgendaItems(data, hoy,
  5)` del **plan 16** (misma clave `['comunica','calendar',pid]`, así la portada calienta el
  calendario). La regla (`sticpa_home_agenda_items`): primero los eventos abiertos al perfil activo que
  empiezan hoy o después, por fecha; luego las sesiones próximas de sus eventos, por fecha; cinco como
  mucho; hora solo si la tiene y no es 00:00. Si este plan se ejecuta antes que el 16, añade esa ruta,
  su esquema y esa función tal como los define el 16, y el 16 los reutiliza.
- **En el móvil**: los perfiles con `persist: true` (nombres de los propios hijos: nada de lo sensible
  del añadido de familias), clave `['comunica','perfiles']`, en el espacio de la persona y borrados al
  salir. **La elección** (`{ activeId, chosen }`) va al almacén por persona del plan 01 y se borra al
  salir.
- Sin escrituras: cambiar de perfil es estado del móvil. No hay cola.
- **Servidor falso**: solo familiar con dos hijos (uno sin nombre), con uno y con ninguno; monitora con
  una hija (`monitor` + `member` + `guardian`); miembro sin hijos; uno del equipo sin hijos. Mandos:
  «el CRM no contesta a los hijos» (503) y «un hijo nuevo» (lo trae el siguiente `fresh=1`). Un `pid`
  ajeno da 403 en todas las rutas `/profiles/:pid`. La agenda, con los datos de calendario del 16 (un
  hijo con abiertos y sesiones con y sin hora; otro sin nada).

## Comportamiento y reglas que no se pueden perder

**Audiencia** (`audienceFor(me, activeId)`, `stic-family.php` l. 388-421): viendo a un hijo, `child`;
viéndose, `guardian` si es familiar y no miembro; si no, `member`.

**A quién se ve al entrar** (`initialProfile`; `sticpa_bootstrap_family` y `sticpa_landing_page`,
l. 536-590 y 719-736):

| Quién | Al abrir |
|---|---|
| No es familiar | Él mismo, portada |
| Familiar y miembro | Él mismo; a los hijos, con el selector |
| Solo familiar, un hijo | Ese hijo, elegido solo (cuenta como elegido) |
| Solo familiar, varios | `perfiles`: «¿A quién quieres ver?» |
| Solo familiar, ninguno | Él mismo |

La elección se recuerda (en el plugin vivía en una sesión de un año). Si el hijo recordado ya no viene en
`children` (relación terminada), se vuelve a aplicar la tabla.

**Enlace con varios hijos** (FAM-a1, `sticpa_family_must_choose_first`, l. 611-623): si un enlace (plan
10) lleva a una pantalla de familia y quien entra es solo familiar, con dos o más hijos y **sin haber
elegido nunca**, primero `perfiles` con el destino; al elegir (un hijo o él mismo) se va **al destino**,
no a la portada. Si el destino es un evento o una inscripción (`single_stic_events`,
`single_stic_registrations`): «¿A quién quieres apuntar?» y «Elige a quién y te llevamos directo a la
actividad.»; si no, «¿A quién quieres ver?» y «Elige a quién quieres ver. Puedes cambiar desde arriba
cuando quieras.». Una vez elegido, los enlaces pasan sin preguntar, **salvo** que el destino sea de
una sección que la audiencia activa no tiene: un solo familiar viéndose a sí mismo y un enlace a un
evento también va a `perfiles` con el destino, como dice el plan 13 (el plugin le abre el evento a
ella y «Inscribirme» la apuntaría a ella: el mismo fallo que FAM-a1, por otra puerta).

**«¿A quién ves?»** (`single_stic_profile_selection.php`): una tarjeta por hijo y la propia al final.
Tarjeta: inicial, **nombre corto** («Lucía Messeguer»: nombre y primer apellido, FAM-a11), etiqueta
«Viéndolo ahora» solo en la activa («Yo» en la propia, sin «Participante») y acción «Seguir aquí» /
«Elegir» / «Entrar» (la propia). Al abrirla se pide `fresh=1`: es donde se mira «quiénes son los míos»
y así aparece el hijo recién vinculado (l. 36-46). Sin hijos: «Todavía no tienes participantes
vinculados» · «Cuando la organización vincule a tus participantes, aparecerán aquí automáticamente. Si
crees que falta alguien, contacta con tu referente.», y la tarjeta propia.

**«Viendo a»** (`menu.php` l. 209-276): con hijos, arriba de cada pantalla de familia,
`ActiveProfileBar`: «Viendo a» y el nombre corto (o «Yo mismo» / «Yo misma»). Abre «Ver como…»: los
hijos (el activo marcado), «Yo mismo/a» y «Ver todos los perfiles…» (→ `perfiles`).

**Cambiar sin volver a la portada** (FAM-a8, `sticpa_family_switch_destination`, l. 677-713): cada
pantalla declara con `useProfileScope('shared' | 'personal')` si es **compartida** (lista de eventos,
ficha de un evento, calendario: no son de nadie) o **personal** (una inscripción, un pago, unos datos).
En una compartida, cambiar se queda y recarga con el `pid` nuevo **si esa sección se le enseña a la
nueva audiencia** (un solo familiar que se elige a sí mismo no tiene Eventos ni Calendario: portada).
En una personal, a la portada.

**Equipo y familia en una sola portada** (CAR-1, decisión del 10/10): lo del equipo primero (plan 04,
con el aviso del certificado del plan 09 dentro: nunca dos veces) y debajo `MemberHome`, encabezado por
`ActiveProfileBar`. **Decisión de este plan:** lo del equipo es de quien ha entrado y se enseña
siempre, también viendo a un hijo; el selector solo cambia la parte de familia. El plugin lo esconde
(`stic-equipo.php` l. 118-123) porque la sesión entera pasaba a ser el hijo, y una monitora que miró a
su hija se quedaba sin «Pasar lista» hasta cambiar de vuelta (pregunta 1).

**`MemberHome`**, en este orden (`single_stic_home.php`):

1. **Saludo**: «Hola, Marta 👋», siempre con el nombre de pila de quien ha entrado (sin nombre,
   «¡Te damos la bienvenida! 👋»), y la entradilla: viendo a un hijo, «Aquí ves los datos de
   **Lucía** y le inscribes a las actividades.»; `guardian`, «Aquí están tus datos y lo que se cobra de
   tu cuenta. Las inscripciones y los documentos de quienes tienes a tu cargo están en su ficha.»; si
   no, «Tu espacio personal. Elige una sección para empezar.». Se oculta con su × («Ocultar el saludo
   (volverá dentro de un mes)»), recordado un mes en el almacén por persona.
2. **«A quién tienes a tu cargo»** (solo `guardian` con hijos): las tarjetas de `perfiles`, con la
   acción «Ver su ficha» (FAM-a11: la misma tarjeta en los dos sitios).
3. **«Actividades»** (`homeSections`, la regla de `sticpa_visible_sections`, l. 468-510): `member` y
   `child`, Eventos, «Mis inscripciones» («Inscripciones» viendo a un hijo), Calendario, Pagos y
   Documentos; `guardian`, solo Pagos y el bloque se llama **«Tus pagos»** (el dinero sale de su
   cuenta). Sin bloque «Tu perfil», «Tus secciones». Cada fila con la descripción de
   `sticpa_section_meta`: «Las actividades a las que te puedes apuntar.», «A qué estás apuntado y en qué
   estado está.», «Tus actividades, día a día.», «Tus pagos y recibos, con su estado.», «Tus
   documentos, para verlos y descargarlos.».
4. **«Próximas actividades»**, solo si se enseña Calendario y hay algo (vacía, no se pinta): cápsula
   (día de la semana, día, mes), punto de color (abierto / sesión), título, el evento debajo en las
   sesiones y, a la derecha, la pastilla «Inscríbete» o la hora. Toque: la ficha del evento o de la
   sesión. Al pie, «Ver calendario» como secundario (FAM-a13).
5. **«Tu perfil»**: «Mis datos» o «Datos de Lucía» (`sticpa_datos_de_label`; plan 12) y «Mis datos de
   monitor» si es monitor y se ve a sí mismo (plan 09). «Tus datos personales, de contacto, MCM, salud y
   RGPD.» y «Tu trayectoria, formación y certificado de delitos sexuales.».

**Nombres** (puros, `profiles.ts`): `firstNameOf` (la primera palabra: «María José» → «María», como
`sticpa_nombre_de_pila`), `shortName`, `initialOf` («·» sin nombre) y `selfLabel`.

**El legado viendo a un hijo** (respuesta a la pregunta del plan 10 §8): el destino del enlace mágico
no admite perfil (`sticpa_login_destination_args`: `internalpage`, `action`, `id`, `from`), pero el
cambio de perfil del plugin es un GET con sesión: tras el pase, cargar
`admin-post.php?action=single_stic_profile_selection&profile_selected_id=<hijo>&dest=<destino>` pone la
sesión en ese hijo (validado por `sticpa_allowed_profile`) y lleva al destino.

## Estados

| Pantalla | Cargando | Vacío | Error | Sin conexión |
|---|---|---|---|---|
| Portada (`MemberHome`) | Esqueleto: saludo, cinco filas, agenda | Agenda vacía: no se pinta; las secciones siempre están | Solo la agenda puede fallar («Reintentar» en su sitio): las secciones salen de `Me` y de la elección | Lo guardado (el calendario se guarda, plan 16) + `SyncBadge`; el selector funciona |
| `perfiles` | Tres tarjetas de esqueleto | El texto de arriba + la tarjeta propia | `AreaState` + «Reintentar»; con 503 y algo guardado, lo guardado y un aviso | Lo guardado; sin nada, «Necesitas conexión la primera vez» |
| Selector | — | Sin hijos no se pinta | — | Con lo guardado |

Pendiente de subir: no hay escrituras; la cola del área se ve en la parte del equipo (plan 04).

## Traducción del diseño

- **Igual**: el orden de los bloques, sus etiquetas y descripciones, «Viendo a» siempre a la vista, la
  tarjeta de perfil con inicial, la agenda.
- **Cambia por ser app**: cabecera nativa «Inicio», con un botón de avatar a la derecha que abre «Tu
  cuenta» (plan 02, donde vive «Salir», como el último elemento del menú del plugin tras CAR-5); el
  saludo es texto (título y cuerpo), no un bloque de degradado (FAM-a13, `design.md` §8); los mosaicos
  → **filas agrupadas**, una superficie por bloque (`SectionHeader` + filas `PressableFeedback` con
  `IconSymbol`, título, descripción y chevron, sin «Entrar ›»: la fila entera es el toque); en `isWide`,
  filas a dos columnas y la agenda en columna aparte, como el escritorio del plugin; agenda con
  `DateCapsule` y `StatusChip`; el selector, botón de 44 pt (FAM-a11) que abre `BottomSheet`; `perfiles`,
  una columna en el móvil y rejilla en `isWide`, con la acción escrita solo en ancho (en el móvil, la
  flecha, como el plugin).
- Sin el «Cambiando de participante…»: cambiar es instantáneo y lo nuevo pinta su esqueleto.
- Accesibilidad: «Lucía Messeguer, viéndolo ahora. Seguir aquí»; «Viendo a Lucía. Cambiar de persona»;
  agenda «Sábado 25 de octubre, 10:30, Sesión 4, Catequesis COM». Hápticos: `h.tap` al abrir la hoja,
  `h.select` al elegir. Sin animaciones de entrada en listas.
- Skills: `building-native-ui`, `heroui-native`, `make-interfaces-feel-better`; para revisar,
  `fixing-accessibility`, `baseline-ui`, `fixing-motion-performance` e `improve-ui`.

## Qué no se hace (desactivado en el plugin)

| Qué | Prueba |
|---|---|
| «Compromisos de pago» como sección | `menu.php` l. 90, comentada |
| «Darse de baja» | `menu.php` l. 91, comentada |
| «Mis sesiones» y «Mis asistencias» como listados | Fuera de `getSticMenuElements` (l. 64-87); solo queda su descripción en `sticpa_section_meta` |
| «Usuario y contraseña» | Está en el menú (l. 87) pero no se porta: decisión `login` (análisis §4, plan 02); su enlace va a «Tu cuenta» |
| «Datos del familiar» (forma de pago) | `single_stic_tutor_profile` fuera del menú; FAM-02 bloqueado. Ver plan 12 |
| `?rol_debug` y `?familia_demo=1` | `single_stic_home.php` l. 106-111; `single_stic_profile_selection.php` l. 50-59: depuración, la cubre el servidor falso |
| «¿A quién apuntas?» con el estado de cada hijo en la ficha del evento (FAM-a14) | Propuesta F6, «GO con matices» (`docs/comunica/PROPUESTAS-FUNCIONALIDADES-2026-10.md`); el plugin no la tiene |

## Qué va a la web y por qué

Nada: todo lo de este plan es nativo.

## Enlaces que llegan aquí

| `internalpage` (y parámetros) | Pantalla |
|---|---|
| Ninguna, o `single_stic_home` | Portada, con la regla de «a quién se ve al entrar» |
| `single_stic_profile_selection` | `perfiles` (recarga los hijos) |
| Cualquier destino de familia cuando «hay que elegir» | `perfiles?destino=…` y, al elegir, el destino |

## Tareas

| # | Tarea | Cómo se comprueba |
|---|---|---|
| 1 | Contrato: `ProfileRef`, `/me/profiles` y la convención `/profiles/:pid` con su `allowedProfile` en el falso; si el 16 no está, su `/calendar` | Tests de esquemas; 403 con un `pid` ajeno |
| 2 | Servidor falso: personas y mandos de «Datos» | Tests: el 503 nunca es `[]`; «un hijo nuevo» llega con `fresh=1` |
| 3 | `profiles.ts` y `home.ts`: audiencia, entrada, «hay que elegir», a dónde se va al cambiar, secciones y etiquetas, nombres, «Yo mismo/a» (y `upcomingAgendaItems` si el 16 no está) | Unitarios |
| 4 | `useMyProfiles`, `useActiveProfile` (proveedor en `comunica/_layout.tsx`, dicho en el commit), `useProfileScope` | Tests de hooks con el falso: la elección sobrevive a reabrir; salir la borra |
| 5 | `perfiles.tsx` con `ProfileCard`, destino y recarga | Test + capturas 375 px, claro y oscuro: dos hijos, ninguno, «¿A quién quieres apuntar?» |
| 6 | `ActiveProfileBar` y `ProfileSwitcherSheet` | Tests: compartida se queda; personal vuelve; `guardian` a sí mismo desde Eventos vuelve |
| 7 | `MemberHome` y `AreaHome`, con `PasarListaHome` (04) como contenido sin scroll propio (si el 04 ya lo tiene, se separa en un commit aparte); la puerta del 01 en sus casos 3 y 4 | Capturas de las seis personas del falso, 375 px e `isWide`, claro y oscuro, `fontScale` 1,3 |
| 8 | «Hay que elegir» en `links.ts` (plan 10) | Test: enlace a un evento, dos hijos sin elegir → `perfiles` → elegir → la ficha |
| 9 | Este bloque en `docs/contratos/COMUNICA_API.md` (con la convención `/profiles/:pid`) y `CHANGELOG.md` | Revisión |

## Tests

- **Unitarios** (`__tests__/comunica/`): `audienceFor` (tres casos y familiar-miembro);
  `initialProfile` (las cinco filas; elección recordada válida y ya no vigente); `mustChooseFirst` (no
  con elección hecha, con un hijo, siendo miembro ni en la propia `perfiles`; sí con `guardian`
  viéndose y un destino de evento); `switchDestination` (compartida, personal, sección no visible);
  `homeSections` y etiquetas (`guardian` → «Tus pagos»; hijo → «Inscripciones» y «Datos de Lucía»;
  monitor viéndose → «Mis datos de monitor»); `shortName({ firstName: 'Lucía', lastName: 'Messeguer
  Villarroya' })` → «Lucía Messeguer»; `selfLabel` (`gender` primero; si falta, Carmen → «Yo misma»,
  vacío → «Yo mismo/a»). La agenda se prueba en el 16 (`upcomingAgendaItems`); aquí, que sin
  Calendario no se pide.
- **De pantalla con el falso**: cada persona ve sus bloques; dos hijos entran a `perfiles` y uno entra
  directo en su ficha; cambiar de hijo trae su agenda; el 503 de hijos no guarda una lista vacía.
- **Guardarraíles**: toda consulta de los bloques de familia (12-16) lleva `pid` en la clave (test que
  recorre las claves registradas); todas las rutas `/profiles/:pid` del falso dan 403 a un `pid` ajeno.

## Preguntas abiertas

1. **El equipo viendo a un hijo** (decisión de este plan, contra el código): el plugin esconde «Pasar
   lista» y compañía mientras se ve a un hijo; aquí se enseñan siempre, porque son de quien ha entrado.
   ¿Conforme?
2. **`yo/index.tsx` lo reclaman dos planes**: el 02 («Tu cuenta») y el 09 («Mis datos de monitor»).
   Este plan enlaza por destino y no le afecta, pero hay que mover uno (propuesta: `yo/monitor.tsx`).
3. **Documento contra código**: `docs/design-system.md` §6.2 dice que el familiar a secas no ve Pagos;
   el código (`sticpa_visible_sections`) y el propio §6.5 dicen que sí. Se sigue el código.
