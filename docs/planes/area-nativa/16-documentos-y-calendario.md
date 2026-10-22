# 16 — Documentos y calendario

> **Estado:** 🟢 listo para ejecutar en `nuevoComunicaChulo` · **Depende de:** 01, 03 y 11 (se
> coordina con 09, 10 y 13) · **Tamaño:** L · **Índice:** [README.md](README.md)

## Para qué y para quién

Dos pantallas del bloque «Actividades» del menú del plugin (`menu.php` l. 69-78), en nativo:
**Documentos** (ver, abrir, compartir, subir, renombrar, sustituir el archivo y borrar los
documentos de la persona que se está viendo, más el **abridor de archivos** que usa también el plan
13 para los de un evento, `sticpa_evento_archivo`) y **Calendario** (el mes con puntitos, las
sesiones de tus eventos coloreadas por asistencia, las bandas de los eventos con plaza y de los
abiertos a inscripción, la lista del día, la agenda y el detalle de una sesión).

Para quien mira su propia área (monitor, miembro) y para un familiar que ve a un hijo
(`useActiveProfile()`, plan 11). **Un familiar que solo es familiar y se ve a sí mismo no tiene
ninguna de las dos** (lista blanca `sticpa_visible_sections`, `inc/stic-family.php` l. 468-510; el
plugin solo la esconde del menú): la app no le enseña la entrada. Funciona con conexión; el
calendario se guarda para abrir rápido.

## Especificación de origen

| Qué | Dónde (`/home/user/comunicaAreaPrivada/`) |
|---|---|
| Lista: título, tarjeta, orden, vacío, descarga a un toque | `pages/list_stic_documents.php` (entera); `inc/stic-documents.php` l. 28-238 |
| Tipo de archivo por extensión | `sticpa_document_kind()`, `inc/stic-documents.php` l. 69-87 |
| Ficha, subir, editar, borrar | `pages/single_stic_documents.php` (entera) |
| Handler: propiedad, descarga, borrado con firma, subir | `inc/stic-action.php` l. 193-293; `download_document()` l. 1403; `plans/archive/003-…uploads.md` |
| Propiedad, firma (CSRF), extensiones y 6 MB, «ya no está disponible» | `inc/stic-security.php` l. 143-150, 266-269, 382-394, 475-496, 504-518 |
| Documentos de un evento | `inc/stic-event-web.php` l. 24-35, 63-149, 285-363; `docs/comunica/EVENTOS.md` §9.3 |
| Datos, colores, estados y bandas del calendario | `inc/stic-calendar.php` l. 46-200, 263-516, 578-721 |
| Página y ajustes del calendario | `pages/single_stic_activities_calendar.php` (entera) |
| Mes en el móvil: puntitos + lista del día | `plans/archive/022-calendar-month-mobile.md` «Segunda vuelta»; `js/stic-init.js` l. 41-290 |
| Detalle de una sesión y su propiedad | `pages/single_stic_sessions.php`; `inc/stic-security.php` l. 382-394; `inc/stic-action.php` l. 358-390 |
| En la app | `components/calendar/SwipeableMonthCalendar.tsx`, `app/(tabs)/calendario.tsx`, `hooks/useCalendarEvents.ts`; plan 09 (`FileField`, `useDocumentUpload`) |

**Código contra documento.** El comentario de `stic-calendar.php` l. 171 dice que Comunica «no
distingue asistencia parcial ni falta justificada»; Pasar Lista ya escribe `partial` y
`no_justified` (`CAMPOS.md` l. 253). Manda el código (se juntan, regla C4) y va a preguntas.

## Pantallas y rutas

| Ruta (`app/(tabs)/comunica/…`) | Qué |
|---|---|
| `documentos/index.tsx` | «Mis documentos» / «Documentos de Lucía»; botón «Subir» en la cabecera |
| `documentos/subir.tsx` | «Subir un documento» (`presentation: 'formSheet'`) |
| `documentos/[id].tsx` | Ficha: abrir, compartir, nombre y descripción, sustituir el archivo, eliminar |
| `archivo.tsx` | Visor a pantalla completa (imagen o PDF) con «Compartir». **Compartido con el plan 13** |
| `calendario/index.tsx` | «Calendario»: Mes / Agenda |
| `calendario/sesion/[id].tsx` | «Sesión» (`formSheet`, detents medio y completo) |

Código: `components/comunica/documentos/`, `components/comunica/calendario/` (`DayList`,
`CalendarLegend`, `AgendaList`), `comun/FileQuickAction.tsx`; `hooks/comunica/` (`useDocuments`,
`useDocumentWrites`, `useOpenFile`, `useCalendar`, `useSessionDetail`); `utils/comunica/files.ts`,
`documents.ts`, `calendar.ts`. El formulario (archivo, nombre, descripción) es tan pequeño que usa
las piezas del plan 09 (`comun/form/`: `FormField`, `FileField`), no un motor declarativo.
Entradas: la portada de familias y el menú de cuenta; el «Revisarlo en Documentos →» del 09 deja
de abrir `web.tsx` y viene aquí.

**Qué va a la web y por qué:** nada. El enlace compartido de un documento, si lo tiene, se abre con
`expo-web-browser`: es un enlace externo, no una página del área.

### Qué no se hace (desactivado en el plugin)

| Qué | Prueba |
|---|---|
| «Mis sesiones» como listado | No está en `getSticMenuElements()` (`menu.php` l. 69-78) ni en ningún enlace; solo el «Volver» y la tarjeta de «no disponible» de `single_stic_sessions.php` (l. 4, 39, 50). Su icono sigue en `sinergiacrm-private-area.php` l. 496 |
| «Mis asistencias» como listado | Igual: fuera del menú; ningún enlace en el código (`sinergiacrm-private-area.php` l. 500, solo el icono) |
| Crear, editar o borrar una sesión | `single_stic_sessions.php` l. 27-45 pinta botones, pero no hay `admin_post_single_stic_sessions` en `inc/stic-action.php` |
| Cambiar estado, categoría o enlace compartido de un documento | Fuera del formulario de subir y editar (`single_stic_documents.php` l. 159-175): solo se leen |
| F1 «Añadir al calendario» y suscripción | Sin `.ics` ni `webcal` en el plugin; `PROPUESTAS-FUNCIONALIDADES-2026-10.md` §F1 y `plans/043-…` l. 177-180 lo dejan pendiente |

### Enlaces que llegan aquí (para el mapa del plan 10)

| `internalpage` (y `action`/`id`) | Pantalla nativa |
|---|---|
| `list_stic_documents` | `documentos/index` |
| `single_stic_documents` `action=create` | `documentos/subir` |
| `single_stic_documents` `action=edit\|detail` `id` | `documentos/[id]` |
| `admin-post.php?action=single_stic_documents&download=true&id=` | `documentos/[id]`, que abre el archivo al llegar |
| `single_stic_activities_calendar` | `calendario/index` (Mes) |
| `single_stic_sessions` `action=detail` `id` | `calendario/sesion/[id]` |
| `single_stic_sessions` `action=create\|edit\|delete` (sin handler) | `calendario/index` |
| `list_stic_sessions` (desactivada) | `calendario/index` en Agenda (es la lista de tus sesiones) |
| `list_stic_attendances` (desactivada) | `calendario/index` en Mes (el color es la asistencia) |
| `admin-post.php?action=sticpa_evento_archivo&e=&d=` | Ficha del evento (plan 13), que abre ese archivo |

## Datos

Todo cuelga de `/v1/profiles/:pid/…` (plan 11; `pid` es uno mismo o un hijo con relación vigente,
`sticpa_allowed_profile`). Claves: `['comunica', 'documents', pid]`, `['comunica', 'calendar', pid]`.

| Ruta | Envía → Devuelve | Notas |
|---|---|---|
| `GET …/documents` | → `{ generatedAt, documents: DocumentSummary[] }` | Los de la relación `documents` del perfil |
| `GET …/documents/:id` | → `{ generatedAt, document: DocumentDetail }` | Ajeno o inexistente → `forbidden` |
| `GET …/documents/:id/file` | → bytes, `Content-Type` y `Content-Disposition` con el nombre saneado | Sin archivo → `not_found` |
| `POST …/documents` | multipart `clientId`, `name`, `description?`, `file` → `WriteResult` (`crmIds.documentId`) | 6 MB y extensiones de la regla 6; estado «Active»; relación con `pid` |
| `PATCH …/documents/:id` | multipart `clientId`, `name?`, `description?`, `file?` → `WriteResult` | Un archivo nuevo es una revisión nueva |
| `DELETE …/documents/:id?clientId=` | → `WriteResult` | Borrado lógico; nunca por `GET` ni por enlace |
| `GET …/calendar` | → `CalendarData` | Ventana −14 … +12 meses (`stic-calendar.php` l. 544-553) |
| `GET …/sessions/:id` | → `{ generatedAt, session: SessionDetail }` | Solo con inscripción activa (no cancelada) a su evento; si no, `forbidden` |
| `GET …/events/:eid/files/:fid` | → bytes, `inline` | El archivo cuelga de ese evento **y** el evento es para `pid` (audiencia); si no, `forbidden` |

```
DocumentSummary { id, name: string, fileName: string | null, status: { key, label } | null,
                  activeOn: 'YYYY-MM-DD' | null, expiresOn: 'YYYY-MM-DD' | null }
DocumentDetail  DocumentSummary & { description: string | null,
                  category: { key, label } | null, sharedLink: string | null }
CalendarData    { generatedAt, sessions: CalendarSession[],
                  registeredEvents: CalendarEvent[], openEvents: CalendarEvent[] }
CalendarSession { id, name, eventId, eventName, startsAt, endsAt: string | null, attendance: Mark }
CalendarEvent   { id, name, startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' | null }
SessionDetail   CalendarSession & { description: string | null }
EventFile       { id, title, mimeType, isImage }   // si el plan 13 ya la define, se usa la suya
```

- **Para el plan del servidor:** `attendance` es el `Mark` del glosario (el clasificador tolerante,
  `sticpa_classify_attendance` l. 90-145, vive allí). `openEvents` va filtrado por la audiencia del
  perfil (`sticpa_filter_events_for_viewer`, l. 486) y sin los que tienen plaza; `registeredEvents`
  no (es tu agenda); las inscripciones canceladas no cuentan (l. 361). Archivos de evento: solo PDF,
  JPG, PNG, GIF y WEBP (sin SVG, `stic-event-web.php` l. 63-75).
- **Propiedad** (`sticpa_user_owns_record`): un documento es tuyo si está en la relación
  `documents` de `pid`; si el CRM no contesta, **no**. La relación del nuevo sale del `pid`
  comprobado, nunca del cuerpo.
- **En el móvil:** documentos, `persist: false` (un nombre como «Informe médico» ya es sensible):
  solo en memoria. El calendario sí se guarda (actividades, fechas y marcas; ni documento, ni
  dirección, ni correo) y se borra al salir (plan 01). **Los archivos no se quedan**: se bajan a
  `cacheDirectory/comunica/open/` y se borran al cerrar el visor, al volver la app a primer plano,
  al abrir Documentos y siempre al salir.
- **Cola** (plan 01): subir con `key: 'documents.create.<clientId>'`, copiando el archivo a
  `documentDirectory/comunica/uploads/` como el 09 (la copia se borra al aplicarse y al salir);
  editar con `key: 'documents.edit.<id>'` llevando **todo** lo que difiere de lo confirmado (la
  lección del 09); borrar con `key: 'documents.delete.<id>'`, que descarta la edición pendiente.
  Optimista: la subida sale arriba con `UploadStatus`; lo borrado se va y vuelve si acaba `failed`.
- **Cliente** (`services/comunica/`): `downloadFile(path) → { localUri, fileName, mimeType }` con la
  cabecera de sesión (`expo-file-system/legacy` con `createDownloadResumable`, como ya usa la app)
  y `fileSource(path) → { uri, headers }` para `expo-image` (el `photoSource` del plan 05). En web,
  un `Blob`. Ninguna pantalla construye URLs.
- **Servidor falso:** miembro y familia con dos hijos (`pid` ajeno → 403); PDF y PNG mínimos en los
  fixtures, un documento sin archivo, uno caducado y uno en «Draft»; un curso con ~24 sesiones y
  las cuatro marcas más sin marcar, una convivencia con plaza sin sesiones, una inscripción
  cancelada y un evento de otra delegación (no salen), dos abiertos; un evento con un PDF y tres
  imágenes para el 13; con «CRM caído», las subidas esperan en la cola.

## Comportamiento y reglas que no se pueden perder

**Documentos**

1. **Título** «Mis documentos» o, viendo a un hijo, «Documentos de {nombre}» (`list_stic_documents.php`
   l. 21-25). **Vacío:** «Todavía no tienes documentos» / «Todavía no hay documentos de {nombre}»,
   «Aquí guardas y descargas lo tuyo (lo suyo): autorizaciones, certificados, justificantes.» y
   «Subir un documento» como principal (`stic-documents.php` l. 142-155).
2. **Tarjeta** (`stic-documents.php` l. 165-234): cápsula con el **tipo** (`documentKind`, l. 69-87:
   JPEG→JPG, DOCX→DOC…; sin extensión, icono de archivo), el nombre (o el del archivo), «Del {fecha
   en lenguaje humano}» si la hay y **un chip**: «Caducado» en rojo si `expiresOn` < hoy (hora de
   Madrid, en la app); si no, el estado con color por clave. **Sin** el nombre del archivo (l. 167-172).
3. **Orden:** lo caducado al final y apagado; el resto, lo más reciente arriba (l. 157-163).
4. **Tocar la tarjeta abre la ficha, nunca descarga** (l. 221-225). La descarga es un botón redondo
   de 44 pt **hermano** de la tarjeta («Descargar {nombre}» para el lector), solo si hay archivo
   (l. 205-219); aquí abre el archivo (C1).
5. **Ficha:** tipo y nombre del archivo, fecha, caducidad, estado, categoría y enlace compartido
   (solo lectura, `single_stic_documents.php` l. 159-175); nombre y descripción editables;
   «Sustituir archivo»; «Eliminar documento» al final. Un 403: «Este documento ya no está
   disponible», «Vuelve al listado y entra de nuevo desde ahí.» y «Volver» (`stic-security.php`
   l. 504-518); nunca «no es tuyo».
6. **Subir:** se elige el archivo y rellena el nombre (sin extensión, editable). Se valida **antes**
   de encolar, como el handler antes de escribir (`stic-action.php` l. 255-262): más de 0 bytes,
   6 MB como mucho («Ese archivo pesa más de 6 MB») y extensión de `pdf, jpg, jpeg, png, gif, heic,
   webp, doc, docx, odt, xls, xlsx, ods, txt` (`stic-security.php` l. 475-478; «Ese tipo de archivo
   no se puede subir»). El plugin deja crear un documento **sin archivo**; aquí «Subir documento» no
   se activa sin él. En iOS, el texto del 09: «¿Lo tienes en papel? Escanéalo con Notas o Archivos
   y elígelo aquí.»
7. **Borrar** (`stic-action.php` l. 204-240): el documento es del `pid` (lo comprueba el servidor),
   la acción es **genuina** y hay confirmación. La firma del plugin evita que un enlace ajeno borre
   al abrirse (CSRF); aquí: `DELETE` solo con el token en la cabecera (nunca cookie ni `GET`),
   ningún enlace del mapa del plan 10 lleva a borrar, y `remove()` solo sale del botón destructivo
   del `Alert` «Eliminar documento» / «¿Seguro que quieres borrar este documento? No se puede
   deshacer.» (de tú, como el área; el genérico del plugin va de usted).
8. **Mensajes:** el plugin no enseña ninguno al subir mal o borrar (`single_stic_documents.php` solo
   declara el de éxito). Aquí: `UploadStatus` en la tarjeta, toast «Documento subido» /
   «Documento eliminado», y el mensaje del servidor si acaba en `failed`.
9. **Cambiar de perfil:** la lista y el calendario recargan con el nuevo; ficha, visor, subir o
   sesión vuelven a su lista (el plugin manda las fichas a la portada, `stic-family.php` l. 691-711).

**Abrir archivos** (documentos y eventos, `useOpenFile`)

- C1. Imagen → `archivo.tsx` con `expo-image`. PDF → `archivo.tsx` con `react-native-webview`
  (el visor del sistema en iOS; `allowingReadAccessToURL` a la carpeta) y pestaña nueva en web.
  PDF en Android y el resto de tipos → hoja del sistema con `expo-sharing` (`mimeType`, `UTI`, y
  `anchor` en iPad). «Compartir» siempre en la cabecera del visor y en la ficha.
- C2. Sin conexión no se abre: «Necesitas conexión para abrir el documento». Mientras baja, el
  botón enseña el progreso; si falla, «No se ha podido descargar. Inténtalo otra vez.»
- C3. Un archivo de evento se pide siempre con su evento (`…/events/:eid/files/:fid`), nunca por la
  ruta de documentos: no son tuyos, son del evento (EVENTOS.md §9.3).

**Calendario**

- C4. **Color de una sesión** (`stic-calendar.php` l. 152-200): si empieza después de ahora,
  «Próxima», tenga la marca que tenga; si no, `yes` «Asististe», `no_unjustified` «No asististe»,
  `null` «Sin registrar»; `partial` y `no_justified` se juntan con esos dos mientras sus estados
  estén apagados (`sticpa_calendar_enabled_states`, nadie los enciende): una constante, ver preguntas.
- C5. **Bandas de evento** de día completo: «Con plaza» y «Abierto a inscripción», **salvo** si el
  evento ya aporta sesiones (l. 584-596: un curso de octubre a mayo taparía el mes). Un evento de
  varios días marca **todos** sus días.
- C6. **Mes:** desde el lunes, sin semanas de relleno ni días de otros meses; hasta 4 puntitos por
  día; tocar un día pinta debajo «Martes, 14 de octubre» y una fila por actividad (punto, nombre,
  «17:30 · {evento} · {estado}» o «Todo el día · …», chevron) o «No hay actividades este día». Al
  cambiar de mes se elige hoy si cae dentro, si no el día 1. Título «Octubre 2025». **Agenda:** el
  mes por días; vacío, «No hay actividades en estas fechas». Leyenda bajo la rejilla, sin frase:
  Próxima, Asististe, No asististe, Sin registrar, Abierto a inscripción, Con plaza (l. 689-721).
- C7. **Destinos:** sesión → `calendario/sesion/[id]`; abierto a inscripción → ficha del evento
  (plan 13, no el formulario: l. 621-627); con plaza → la lista de inscripciones. Los dos últimos
  con la función del plan 10 que resuelve un `internalpage` a su ruta (o `openLegacy` si no la hay).
- C8. **Sesión:** nombre, «sábado 25 de octubre», «17:30 – 19:00» (`sticpa_time_range_text`: si
  cruza la medianoche o no tiene fin, solo el inicio), estado en chip, el evento (toque → su ficha)
  y la descripción. Sin inscripción activa: «Esta sesión ya no está disponible».
- C9. Apuntarse (plan 13) invalida `['comunica', 'calendar', pid]`, como `sticpa_calendar_flush_cache()`
  (`stic-action.php` l. 589, 647). Para la portada de familias, `upcomingAgendaItems(data, hoy, 5)`
  (`sticpa_home_agenda_items`, l. 728-790: primero los abiertos, luego las próximas sesiones).

## Estados

| Pantalla | Cargando | Vacío | Error / 403 | Sin conexión | Pendiente |
|---|---|---|---|---|---|
| Documentos | 3 tarjetas esqueleto | Regla 1 | «Reintentar» | Lo que haya en memoria; si nada, «Los documentos se ven con conexión» | Subidas arriba con `UploadStatus`; atascada → «Reintentar» / «Descartar» |
| Ficha | Esqueleto | — | 403 de la regla 5 | «Abrir» y «Guardar» avisan (C2) | Nombre y descripción con «Guardado en el móvil» |
| Subir | — | — | Error de validación bajo el campo | Se encola igual | Vuelve a la lista con la tarjeta pendiente |
| Calendario | Rejilla esqueleto | Mes sin nada: C6 | «Reintentar» | Lo guardado + `SyncBadge` | — (no escribe) |
| Sesión | Esqueleto en la hoja | — | «Esta sesión ya no está disponible» | Si está en el calendario guardado, desde ahí | — |

## Traducción del diseño

- **Se queda igual:** `RecordCard` + `DateCapsule` con el tipo en el hueco del mes, el botón
  redondo de descarga y no una barra, el chip por clave (neutro ante la duda), lo caducado apagado,
  los textos, la leyenda bajo la rejilla y el patrón móvil del 022 (puntitos + lista del día).
- **Cambia por ser app:** «Subir» en la cabecera nativa (`AppIconButton`); subir y la sesión en
  `formSheet`; `Alert` destructivo; visor a pantalla completa con «Compartir»; deslizar para
  refrescar. El calendario reutiliza `SwipeableMonthCalendar` (el deslizar de mes ya está) con una
  prop opcional `markingType` (`'multi-dot'` aquí, `'multi-period'` por defecto; dicho en el
  commit) y Mes/Agenda en `SegmentedControl` como la pestaña Calendario. En iPad y web anchos, mes
  y día en dos paneles como `calendario.tsx`: se copia el patrón, no se importa la pantalla.
- **Colores** de `theme.ts` (plan 03): Próxima, el informativo; Asististe y No asististe, éxito y
  error; Sin registrar, neutro; Abierto, el acento del área; Con plaza, el primario. Ningún hex.
- Hápticos: `h.select` al tocar un día, al cambiar de mes y al abrir la confirmación; `h.remove`
  al borrar; `h.formSuccess` cuando una subida se aplica. Cada día con su resumen en el
  `accessibilityLabel` («14 de octubre, 2 actividades»).
- **Skills**, si la sesión las tiene: `building-native-ui`, `heroui-native`, `animate-expo` y
  `make-interfaces-feel-better` al construir; `fixing-accessibility`, `baseline-ui`,
  `fixing-motion-performance` e `improve-ui` al revisar cada pantalla.

## Tareas

| # | Tarea | Cómo se comprueba |
|---|---|---|
| 1 | Contrato y falso de documentos (rutas, tipos, bytes de fixtures, 403 de otro `pid`) | Tests de esquemas; el falso guarda, borra y vuelve a leer; `pid` ajeno → 403 |
| 2 | Contrato y falso de calendario, sesión y archivos de evento | Tests: la cancelada y la de otra delegación no salen; sesión sin inscripción → 403 |
| 3 | `utils/comunica/files.ts` (validación, tipo, MIME por extensión, nombre seguro) y `documents.ts` (nombre visible, caducado, orden). Si el 09 ya tiene la validación en `monitorProfile.ts`, se mueve aquí con su lista de certificados (`pdf, jpg, jpeg, png`) | Tests puros |
| 4 | `utils/comunica/calendar.ts`: colores (C4), bandas (C5), días de un evento largo, puntitos por día, día elegido al cambiar de mes, leyenda, `upcomingAgendaItems` | Tests puros |
| 5 | Cliente: `downloadFile`, `fileSource`, limpieza de `comunica/open/` y `comunica/uploads/` (en el borrado de salir del 01, dicho en el commit) | Test: tras cerrar el visor y al salir no queda nada |
| 6 | `useOpenFile` y `archivo.tsx` (C1-C3) | Capturas web de imagen y PDF; test del reparto por tipo y plataforma |
| 7 | `documentos/index.tsx` con tarjetas, botón de descarga y vacío | Captura 375 px claro/oscuro; test con el falso: orden y caducado |
| 8 | `documentos/[id].tsx`: lectura, editar por la cola, sustituir, eliminar con `Alert` | Test: editar dos veces sin conexión lo lleva todo; borrar solo tras confirmar |
| 9 | `documentos/subir.tsx` con `FileField` del 09 y la cola | Test con el selector simulado: 7 MB y `.exe` rechazados; con «CRM caído» espera y luego sale |
| 10 | Prop `markingType` en `SwipeableMonthCalendar`, `calendario/index.tsx` (Mes, día, leyenda, Agenda) | Captura de un mes con las cuatro marcas; la pestaña Calendario de la app sigue igual (su test) |
| 11 | `calendario/sesion/[id].tsx` | Test: con inscripción se ve; sin ella, «Esta sesión ya no está disponible» |
| 12 | Visibilidad (plan 11), cambio de perfil (regla 9), filas del mapa de enlaces para el plan 10, enlace del 09 | Test de la puerta: el familiar solo familiar no ve las entradas |
| 13 | `CHANGELOG.md` y el plan marcado en el README | Revisión |

## Tests

- **Puros:** `documentKind` con `x.JPEG`, `a.b.docx`, sin extensión, `x.toolong`, `x.p_f`; caducado
  ayer, hoy y sin fecha; orden; validación con 0 bytes, 6 MB justos y + 1, mayúsculas, `heic` (sí en
  documentos, no en certificados); futura con `no_unjustified` sigue «Próxima», pasada sin marca
  «Sin registrar», `partial` → «Asististe»; evento de tres días con puntito en los tres; banda
  oculta si hay sesiones; el día 1 cuando hoy no cae en el mes.
- **De pantalla, con el falso:** lista → ficha → abrir → visor; subir sin conexión y reconectar;
  borrar con el CRM caído y que vuelva; calendario de un hijo distinto del de otro hijo.
- **Guardarraíles:** la consulta de documentos es `persist: false` y nunca llega al almacén;
  `cacheDirectory/comunica/open/` y `documentDirectory/comunica/uploads/` vacíos tras salir; ningún
  enlace del mapa lleva a borrar; ningún fichero de `documentos/` ni `calendario/` hace `fetch` ni
  arma URLs del servidor; los archivos de evento no pasan por la ruta de documentos.

## Preguntas abiertas

1. 🔒 (`fotos-documentos`) **Cámara y galería.** Mientras, solo `expo-document-picker`. Si entra
   `expo-image-picker`, «Hacer una foto» y «Elegir de la galería» van en el `FileField` del 09 y
   sirven aquí también (JPG, sin recortar).
2. **«Parcial» y «Justificada» en el calendario.** Pasar Lista los escribe y el calendario los junta:
   una falta justificada sale en rojo, «No asististe». ¿Se copia así (el código de hoy) o se
   encienden los dos, con su color y su fila en la leyenda? Es una constante.
3. **Delegación del documento subido.** El formulario la manda, pero `sticpa_forbidden_fields()` la
   quita (`stic-security.php` l. 143-150): lo subido desde el área no queda asignado a su
   delegación, contra la regla del `CLAUDE.md` del plugin. ¿El servidor lo asigna a la de la persona?
4. **PDF en Android.** Sin `expo-intent-launcher` (nativo, no está) no hay «Abrir con…»: la hoja de
   compartir no siempre ofrece un visor de PDF. ¿Se añade en una build o se queda la hoja?
5. **Borrar un certificado** (el que sube el plan 09) desde aquí no apaga su indicador en la ficha
   del monitor (tampoco en el plugin): el aviso del 09 no vuelve. ¿Se queda así?
6. Los campos de `Documents` (`status_id`, `category_id`, `stic_shared_document_link_c`) y sus
   claves no están en `CAMPOS.md`; el servidor los necesita (la app pinta neutro ante la duda).
