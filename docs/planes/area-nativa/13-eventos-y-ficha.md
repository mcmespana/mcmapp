# 13 — Eventos y su ficha

> Estado: 🟢 listo para ejecutar en `nuevoComunicaChulo` · Depende de: 01, 03, 11 (y 08 para compartir, 10 para enlaces) · Tamaño: L · Índice: [README.md](README.md)

## Para qué y para quién

Para **familias, participantes y miembros** (y monitores que se apuntan como miembros): ver **a
qué se pueden apuntar** y **a qué ya se han apuntado**, y leer la ficha entera de una actividad
—cartel, información, documentos, lugar, plazo— con el botón para apuntarse o el **motivo** por
el que no se puede. Es la pantalla por defecto del plugin (`menu.php:99`) y a su ficha se llega
por enlaces de WhatsApp. Todo con el **perfil activo** del plan 11 (`useActiveProfile()`): la
audiencia se mira con el hijo que se ve (`EVENTOS.md` §3.2). Inscribirse y «Mis inscripciones»
son del plan 14; pagar, del 15; el calendario, del 16.

## Especificación de origen

Todo en `/home/user/comunicaAreaPrivada/`; si documento y código chocan, manda el código.

| Qué | Dónde |
|---|---|
| Audiencia, plazos, lugar y mapa, lo que no se pinta; información de la web y documentos | `docs/comunica/EVENTOS.md` §1-§9 |
| Listado en dos bloques | `pages/list_stic_events.php` 52-97; `inc/stic-events.php` 801-935 |
| Ficha | `pages/single_stic_events.php`; `inc/stic-events.php` 955-1082 |
| Plazo, chip, dato y motivo | `inc/stic-events.php` 588-777 |
| Lugar, mapa, opcionales con `skip_zero`, duración | `inc/stic-events.php` 35-136, 484-563, 974-1013 |
| Audiencia, ocultos, textos del motivo | `inc/stic-event-audience.php` 140-158, 329-340, 484-704 |
| Cartel, lema, galería, adjuntos, página pública, endpoint de documentos | `inc/stic-event-web.php` 88-368 |
| El renderizador (HTML del CRM → bloques → HTML) | `inc/eventos-cuerpo.php` (cabecera 22-60, bloques 74-88, enlaces 774-855, pintor 865-1095) |
| Ficha de registro (anatomía, una acción principal, CTA pegada) | `inc/stic-record-view.php` 85-110, 383-410, 622-662 |
| Auditoría de familias (FAM-a1 enlace con varios hijos, a2 CTA pegada, a4 «de quién», a7 sin «Ver detalle», a8 cambiar de hijo sin salir) | `plans/042-pulido-integral/auditoria-familias.md`; hechas según `plans/043-decisiones-del-10-10.md` |
| Compartir (F5) | Plan 08 de este directorio; `PROPUESTAS-FUNCIONALIDADES-2026-10.md` F5 |

**Manda el código:** (1) la ventana del listado es de **14 meses atrás y 12 adelante** por
fecha de inicio (`sticpa_events_window_filter()`, 471-476), no «−3 … +12» como dice el
comentario de `list_stic_events.php:34`; y solo se pintan los que no han pasado. **La regla de
«50 días» no aplica aquí**: es de pasar lista en un evento (plan 07). (2) `EVENTOS.md` §6 dice
que a lo inscrito «sin filtro de audiencia», y el código además le salta el «Ocultar en el área
privada» (`list_stic_events.php:54-79`).

## Pantallas y rutas

Carpeta **`app/(tabs)/comunica/actividades/`** (`eventos/` es del plan 07). El nombre es interno:
**en pantalla dice «Eventos»** (renombrar a «Apuntarse» se decidió que NO, `plans/043:193-194`).

| Ruta | Qué | Del plugin |
|---|---|---|
| `actividades/index.tsx` | «Eventos»: «Para apuntarte» y «Te has apuntado» | `list_stic_events` |
| `actividades/[eventId]/index.tsx` | La ficha del evento | `single_stic_events&action=detail&id=` |
| `actividades/publica/[slug].tsx` | Llega de `/actividades/?e=<slug o id>` (plan 10 §3.3): con sesión busca el evento y hace `router.replace` a la ficha; sin sesión pinta la ficha pública | página pública de comunicaFormularios |

`[eventId]/` es carpeta porque el plan 14 cuelga de ella `inscribirme.tsx`. Cambiar de hijo
(plan 11) aquí **deja en la misma pantalla** con el otro perfil: un evento no es de nadie
(FAM-a8). Quien solo es familiar, viéndose a sí mismo, no tiene Eventos
(`inc/stic-family.php:468-504`): va al «¿A quién ves?» del plan 11, que por el enlace de un
evento y con varios hijos se titula «¿A quién quieres apuntar?» (FAM-a1).

Código: `components/comunica/actividades/` (`EventCard`, `EventDetailView`, `EventBody`,
`EventMedia`, `ImageViewer`), `hooks/comunica/useActivities.ts`, `utils/comunica/`
(`eventWindow.ts`, `eventSignup.ts`, `activityList.ts`, `recordDates.ts`, `bodyLinks.ts`).
**Ficha de registro común** en `components/comunica/comun/record/` (`RecordHero`, `FactList`,
`RecordNote`, `RecordSection`): la anatomía de `stic-record-view.php` que reutilizan 14, 15 y 16.
Si otro plan ya la creó, se reutiliza.

### Qué va a la web y por qué

| Qué | A dónde | Por qué |
|---|---|---|
| «Ver la página pública de la actividad» | Navegador del sistema dentro de la app (`WebBrowser.openBrowserAsync`) | Es la página que se comparte; enseñarla tal cual es su sentido |
| Un enlace del cuerpo a una página de nuestro dominio | `services/comunica/links.ts` (plan 10): nativa si existe, si no `openLegacy` | Un formulario público enlazado desde la convivencia sigue funcionando |
| Inscribirse (alta corta o formulario avanzado) | Plan 14 | — |
| Nada más | — | Ver un evento es lo importante: nativo entero |

Mientras el plan 14 no esté hecho, «Inscribirme» y «Mi inscripción» abren el legado con
`openLegacy({ internalpage: 'single_stic_registrations', action: 'create', from: 'stic_events', id })`
y `action: 'detail'`; el 14 los cambia por sus rutas.

### Qué no se hace (desactivado o quitado en el plugin)

| Qué | Prueba |
|---|---|
| «Ver detalle» en cada tarjeta (lo hace tocarla) | `inc/stic-events.php:908-911` (FAM-a7) |
| Buscador / DataTables en el listado | `pages/list_stic_events.php:18-21`; `EVENTOS.md` §6 |
| La ficha como formulario deshabilitado (`makeForm`) | `pages/single_stic_events.php:3-12` |
| `description` cuando hay información de la web | `inc/stic-events.php:1052-1061`; `EVENTOS.md` §9.2 |
| «Duración» de más de 31 días, «Plazas 0», «Precio 0,00 €» o «Gratis» | `inc/stic-events.php:62-70, 974-987` |
| El campo `type` (sin uso visual) | `EVENTOS.md` §2 |
| Lo ya celebrado en Eventos (está en Inscripciones) | `inc/stic-events.php:811-813, 793-794` |
| F1 «Añadir al calendario» (no hecho: «para más adelante») | `plans/043:177-180` |
| F6 / FAM-a14 «¿A quién apuntas?» con todos los hijos | `PROPUESTAS-FUNCIONALIDADES-2026-10.md` F6, sin GO |

### Enlaces que llegan aquí (para el mapa del plan 10)

| Enlace | Pantalla nativa |
|---|---|
| `internalpage=list_stic_events` | `actividades/index` |
| `internalpage=single_stic_events&action=detail&id=<evento>` | `actividades/[eventId]` |
| `internalpage=single_stic_events` sin `id` o con forma rara | `actividades/index` |
| `/actividades/?e=<slug o id>` | `actividades/publica/[slug]` |
| `admin-post.php?action=sticpa_evento_fwa…` / `sticpa_evento_archivo…` | No llegan: `/wp-admin/*` está excluido (plan 10 §3) |

## Datos: su trozo del contrato

Todo cuelga del perfil activo (`/v1/profiles/:pid/…`, plan 11): el servidor comprueba que `pid`
es uno mismo o un hijo con relación vigente (`sticpa_allowed_profile`). Días en `YYYY-MM-DD`
(Madrid). Ni un nombre del CRM.

```
GET  /v1/profiles/:pid/events                 → ActivityList
GET  /v1/profiles/:pid/events/:eventId        → EventDetail
GET  /v1/profiles/:pid/events/by-slug/:slug   → EventDetail          (slug o id, la regla de la web)
GET  /v1/public/events/:slug                  → EventDetail          (sin sesión; solo publicados; signup: null)
GET  /v1/profiles/:pid/events/:eventId/documents/:documentId        → binario (imagen o PDF)
POST /v1/profiles/:pid/events/:eventId/documents/:documentId/link   → { url, expiresAt }   (2 min)

ActivityList { generatedAt, toSignUp: EventCard[], signedUp: EventCard[] }
EventCard    { id, name, startDate, endDate,              // null si el CRM no la tiene
               place: string|null,                         // lugar, si no dirección
               statusLabel: string|null,                   // etiqueta del CRM; la de «registration» ya es «Inscripciones abiertas»
               window: { opensOn: string|null, closesOn: string|null },
               hasAdvancedForm: boolean, myRegistrationId: string|null }
EventDetail  EventCard & { tagline: string|null, description: string|null,   // texto plano
               timetable: string|null, address: string|null,
               capacity: number|null, price: number|null,  // null si es 0: un 0 no es un dato
               map: { url } | { query } | null,
               cover: ImageRef|null, body: BodyBlock[], gallery: ImageRef[],
               attachments: { documentId, title }[],       // PDF
               publicUrl: string|null,                     // solo si está publicada
               share: { url, kind: 'public'|'area' } | null,   // plan 08
               signup: { audience: { ok: true } | { ok: false, reason: 'delegation'|'profile'|'course', message } } | null }
ImageRef     { documentId } | { url }
Href         { url } | { documentId }
Inline       { t: 'text', v } | { t: 'bold'|'italic', c: Inline[] } | { t: 'link', href: Href, c: Inline[] } | { t: 'break' }
BodyBlock    { type: 'heading', level: 1|2, text: Inline[] } | { type: 'paragraph'|'notice', text: Inline[] }
           | { type: 'list', ordered, start, items: Inline[][], children: Record<number, { ordered, items: Inline[][] }> }
           | { type: 'button', label, href: Href } | { type: 'image', src: ImageRef, caption?, alt? }
           | { type: 'gallery', images: ImageRef[] } | { type: 'video', provider: 'youtube'|'vimeo', id, url }
           | { type: 'divider' }
```

**El cuerpo: lo trocea el servidor, lo pinta la app con componentes nativos.** Decisión de este
plan. El servidor porta `mcm_cuerpo_bloques()` con sus pruebas (`tests/EventWebTest.php` del
plugin) y hace además lo que en el PHP hace quien llama: saca el cartel
(`mcm_cuerpo_sacar_cartel`), cambia los `/archivo.php?d=` del evento por `{ documentId }` y
**autoenlaza** direcciones, correos y teléfonos (`mcm_cuerpo_autoenlaza`, que en el PHP vive en el
pintor), para que esas expresiones no vivan dos veces. Por qué no `react-native-render-html`:

(1) **seguridad**: el HTML lo escribe una persona en el CRM; con bloques la app no interpreta
ni una etiqueta (ni `javascript:`, ni `<iframe>`, ni estilos de Word); (2) **se lee igual que en
la web**: las reglas (título 1 = sección, cita = aviso, enlace solo = botón, imágenes seguidas =
galería) ya están en el troceador, y el PHP dice que los bloques **son el contrato** y que otro
pintor se escribe sobre ellos (`EVENTOS.md` §9.1): la app es ese pintor; (3) **es de la app**:
tokens, claro y oscuro, `fontScale`, accesibilidad por bloque; render-html pinta con sus estilos y
no sabe de vídeos ni de documentos con sesión. Si el servidor no puede trocear, manda párrafos de
texto plano (como el PHP sin DOM). Nunca HTML.

**Lo que promete el servidor** (prosa en `docs/contratos/COMUNICA_API.md`):

- **Listado** (`list_stic_events.php`): eventos con inicio en la ventana −14/+12 meses.
  `signedUp` = los que el perfil tiene con inscripción no cancelada
  (`prefix_user_active_registration_map`), **sin audiencia y sin ocultar**. `toSignUp` = el
  resto, quitando los de «Ocultar en el área privada» y los que no pasan la audiencia
  (`sticpa_filter_events_for_viewer`). Los pasados los quita la app con la fecha de hoy.
- **Audiencia** (`sticpa_event_audience_match`): ámbito, perfil y curso **a la vez**, con las
  dudas a favor de enseñar: sin delegación de quien mira, sin delegación del evento o sin
  poder preguntar los papeles → no se esconde; el curso solo de relaciones **de participante**
  vigentes, `na` no es curso, sin curso no se aplica el filtro; ámbito vacío se deduce (sin
  delegación o del «Administrador MCM» = de todas). `message` con los textos de
  `sticpa_event_audience_notice` (perfil con las etiquetas del CRM: «Esta actividad es solo para
  monitores y monitoras.»).
- **Ficha**: se sirve **aunque no sea para ti** (con el motivo), por id o por slug; lo
  inexistente → `not_found`. Mapa: enlace propio si es `http(s)`, si no `query` con la dirección
  o el lugar (`sticpa_event_map_url`). Textos normalizados y URLs con `mcm_cuerpo_url`.
- **Documentos**: de la relación del evento, solo PDF, JPG, PNG, GIF y WEBP; cartel →
  galería → adjuntos con el reparto de `sticpa_event_web_view`. Se sirven con sesión, si el
  documento es **de ese evento** y el evento es para quien lo pide (`sticpa_event_file_endpoint`);
  si no, `not_found`. Solo se listan los que se servirían. En lo público, solo de eventos
  publicados.

### En el móvil

| Clave | Persistida | `staleTime` | Nota |
|---|---|---|---|
| `['comunica','activities',pid]` | sí | 2 min | Se refresca al abrir, al volver a la app y al reconectar |
| `['comunica','activities',pid,eventId]` | sí | 2 min | Sin datos personales |
| `['comunica','activities','public',slug]` | no | 2 min | Sin sesión no hay espacio de persona (plan 01 §3) |

Imágenes con `expo-image` (caché en disco con `cacheKey` = `documentId`; las de `{ documentId }`
con la cabecera de sesión). PDF: se pide el enlace de 2 min y se abre en el navegador del
sistema; el enlace no se guarda ni se registra. Nada va por la cola: aquí no se escribe.
Familias funcionan **con conexión** (decisión `offline`): la caché solo abre rápido.

### Servidor falso

Delegación ficticia A, familia con dos hijos (5.º EP y 2.º ESO) y un miembro adulto. Eventos:
convivencia COM abierta, con precio y cuerpo con **todos los tipos de bloque**, cartel, imágenes y
PDF, publicada con slug; una sin cuerpo (descripción con saltos de línea); una con formulario
avanzado; sesiones semanales MIC 4.º-6.º EP; una de la delegación B; una solo para monitores; una
de otro curso; una que aún no abre; una cerrada; una que acaba hoy; una pasada; una oculta con el
hijo apuntado y otra sin; una con plazas y precio a 0. Usa el mando «la fecha de hoy» del plan 07.

## Comportamiento y reglas que no se pueden perder

**Listado «Eventos»** (`sticpa_events_list_html`):

- Fuera lo pasado: **por la fecha de fin** (si no hay, la de inicio) **antes de hoy**; un
  evento que acaba hoy sigue. Por fecha de inicio, el más cercano arriba; sin fecha, al final.
- **«Para apuntarte» primero**, «Te has apuntado» después (08/10/2026). Los títulos solo si
  hay los dos bloques.
- Tarjeta (`sticpa_events_cards`): cápsula con el inicio; nombre; la fecha («5 de mayo de 2026»,
  «del 1 al 10 de julio de 2026», «del 28 de septiembre de 2026 al 2 de octubre de 2026»); el
  lugar; y el plazo («Hasta el 25 de octubre de 2026», «Se abre el …») **salvo** si está cerrado
  o ya tiene plaza. Chip por este orden: «Con plaza» (ok) → el del plazo («Inscripción cerrada»
  apagado, «Inscripción no abierta» info) → la etiqueta del CRM (neutro). **Cuando hay fechas,
  mandan las fechas** sobre el estado del CRM.
- Acción al pie (solo si lleva a otro sitio): «Mi inscripción» (con plaza) o «Inscribirme»
  (plazo abierto o sin fechas). Fuera de plazo, ninguna. Tocar la tarjeta abre la ficha.
- Vacío: «No hay actividades próximas ahora mismo» · «Cuando se abra la inscripción de una
  actividad, aparecerá aquí. Las que ya pasaron están en “Inscripciones”.» · «Ver mis
  inscripciones».

**El plazo** (`sticpa_event_registration_window`, puro en `eventWindow.ts`): los dos vacíos =
**abierta** (regla de seguridad); antes del día de apertura = «antes»; **el día de cierre cuenta
entero**, hasta las 23:59:59 de Madrid; si no, abierta.

**Ficha** (`sticpa_event_detail_html`):

- Cabecera: nombre; lema **solo si hay información de la web**; la fecha; chip «Ya celebrado» →
  el del plazo → la etiqueta del CRM.
- Cartel arriba, entero, a su tamaño. Datos, en este orden: «Duración» (solo de 2 a 31 días,
  «3 días»); el plazo (no en lo pasado: «Hasta el …», «Se abre el …», «Cerrada el …»); Lugar,
  Dirección, Horario (texto tal cual), Plazas, Precio. **El primer dato de lugar que haya es el
  botón del mapa** entero, con «Ver en el mapa: …» para el lector de pantalla.
- Texto: con información de la web, sección **«Toda la información»** (cuerpo, galería,
  adjuntos con su nombre del CRM y «PDF», y «Ver la página pública de la actividad»); sin ella,
  **«Sobre esta actividad»** con la descripción y sus saltos de línea. Nunca las dos.
- La acción, por este orden (`eventSignup.ts`, puro): **pasado** → «Esta actividad ya se ha
  celebrado.»; **con plaza** → «Ver mi inscripción» / «Ver su inscripción» y «Ya tienes una
  inscripción para esta actividad.» / «Lucía ya tiene una inscripción para esta actividad.»
  (a quien tiene plaza no se le dice que no es para él); **no es para ti** → el `message`, con
  título «Esta actividad no es para ti», y «Ver otras actividades»; **fuera de plazo** → «La
  inscripción se abre el …» / «El plazo de inscripción terminó el …» (o sus versiones sin
  fecha), título «La inscripción no está abierta», y «Ver otras actividades»; **abierta** →
  «Inscribirme en esta actividad», la única principal, **pegada abajo** (FAM-a2), y con
  formulario avanzado la nota «La inscripción se hace en el formulario de la actividad. Te lo
  abrimos con tus datos ya puestos.» El orden audiencia → plazo importa: a quien es de otra
  delegación, «el plazo terminó» le hace pensar que llegó tarde.
- «Ver mi inscripción» va **directo a la inscripción** (`myRegistrationId`); el plugin lleva a
  la lista porque no tenía el id a mano. Cambio pequeño, decidido aquí.
- **Ficha pública** (sin sesión): lo mismo sin acción de inscribirse; en su sitio «Entra para
  apuntarte», que lleva al acceso del plan 02 y vuelve a esta ficha (con el selector del plan 11
  si hay varios hijos). Sin página pública (no publicada) → «Esta actividad no tiene página
  pública. Entra en tu área para verla.» con «Entrar».
- **Compartir** (plan 08): icono en la cabecera si hay `share`; texto de `buildEventShareMessage()`.
- **Enlaces del cuerpo** (`bodyLinks.ts`, puro): `tel:` y `mailto:` con `Linking`; `{ documentId }`
  como un adjunto; nuestro dominio (`comunica.movimientoconsolacion.com`, también escrito con
  `http://`) por el mapa del plan 10; lo demás, navegador del sistema. Un enlace que no sea
  `http(s)`, `tel:` o `mailto:` no se pinta como enlace.
- **Vídeo**: miniatura (YouTube, `img.youtube.com/vi/<id>/hqdefault.jpg`) o tarjeta (Vimeo) con
  «Ver el vídeo», que abre la app de YouTube o el navegador. Nada de WebView dentro del scroll.

## Estados

| Estado | Eventos | Ficha |
|---|---|---|
| Cargando | Esqueleto de dos tarjetas con cápsula | Esqueleto de cabecera, cartel (proporción 3:4) y cuatro datos |
| Vacío | El de arriba, con su salida | — |
| Error | `AreaState` con «Reintentar» | `not_found`: «Esta actividad ya no está disponible» · «Es posible que se haya retirado. Consulta el resto de actividades abiertas.» · «Ver eventos» |
| Sin conexión | Lo guardado, con lo pasado y el plazo calculados con la fecha de hoy, y `SyncBadge`; «Inscribirme» apagado con «Necesitas conexión para apuntarte» | Igual; imágenes desde la caché; PDF: «Necesitas conexión para abrir el documento» |
| Pendiente de subir | No aplica (no se escribe) | No aplica |

## Traducción del diseño

Se queda igual: qué se enseña y en qué orden, los textos, el orden de los motivos, un solo botón
principal, «cuando hay fechas mandan las fechas», nada de «ETIQUETA: valor». Cambia por ser app
(plan 03 §3):

- Cabecera nativa con título grande «Eventos» (iOS); deslizar para refrescar; `SectionHeader`
  para los dos bloques; `RecordCard` + `DateCapsule` (apagada en lo celebrado). La acción del pie
  de la tarjeta es un botón compacto con el acento del área, no el principal a lo ancho: con
  cinco tarjetas serían cinco degradados (FAM-a13).
- Ficha: el título va en el contenido (`RecordHero`), la cabecera nativa queda con atrás y
  compartir. Cartel con `expo-image` (`contentFit="contain"`, la proporción de la imagen); al
  tocarlo, `ImageViewer` a pantalla completa (cerrar deslizando hacia abajo y con botón). Galería
  en rejilla de dos columnas. **iPad y web ≥ 720** (`useResponsiveLayout().isWide`): cartel a la
  izquierda y el resto a la derecha (`EVENTOS.md` §9.5), dentro de `PageContainer`.
- `FactList`: filas con `IconSymbol`, la etiqueta en `caption` y el dato en `body`; la del lugar
  entera pulsable (44 pt) con flecha. Mapa: con enlace propio, se abre; con búsqueda, **Mapas en
  iOS** (`maps.apple.com/?q=`) y **`geo:0,0?q=`** en Android (elige la app del móvil); en web,
  Google Maps. Es el «que se sienta del sistema» frente al Google Maps fijo del plugin.
- `EventBody`: título 1 en `title` y título 2 en `subhead` en negrita; párrafos `body`
  seleccionables; listas con su marcador y un segundo nivel con más sangría; **aviso** como
  bloque con el tono de información y barra lateral (no una tarjeta dentro de otra); **botón**
  del cuerpo en fantasma (la principal es «Inscribirme»); separador hairline. Enlaces con
  `accessibilityRole="link"` y subrayados.
- `BottomActionBar` solo para «Inscribirme en esta actividad» («Ver mi inscripción» y «Ver otras»
  van en el contenido). Hápticos: `h.tap` en compartir y mapa. «Ver la página pública» va sin «Es
  la que se puede compartir por WhatsApp.»: para eso está el botón de compartir.

Skills para quien lo ejecute: `building-native-ui`, `heroui-native`, `animate-expo` (visor de
imágenes), `make-interfaces-feel-better`; y para revisar cada pantalla `fixing-accessibility`,
`baseline-ui`, `fixing-motion-performance` e `improve-ui`.

## Tareas

| # | Tarea | Cómo se comprueba |
|---|---|---|
| 1 | Esquemas zod de «Datos» en `contract.ts` y su apartado en `COMUNICA_API.md` (con lo que promete el servidor y la decisión de los bloques) | Typecheck; test que parsea un ejemplo de cada `BodyBlock` y rechaza un bloque con `html` |
| 2 | Servidor falso: fixtures de arriba, las seis rutas, audiencia y ocultos, documentos con permiso, slug, público | Tests del falso: el de B sale con `audience.ok: false`; el oculto con plaza en `signedUp`; documento de otro evento → `not_found` |
| 3 | `utils/comunica/recordDates.ts`, `eventWindow.ts`, `eventSignup.ts`, `activityList.ts` | Tests puros (abajo) |
| 4 | `hooks/comunica/useActivities.ts` (lista, ficha, pública, imagen con sesión, enlace de PDF) | Tests con el falso: claves con `pid`, cambio de perfil sin mezclar datos |
| 5 | Ficha de registro común (`components/comunica/comun/record/`) si no existe | Capturas en claro y oscuro con `fontScale` 1,3 |
| 6 | `EventBody`, `bodyLinks.ts`, vídeo e `ImageViewer` | Test de pantalla con todos los bloques; captura del cuerpo de muestra |
| 7 | `actividades/index.tsx` | Capturas 375 px claro/oscuro: dos bloques, uno, vacío, sin conexión |
| 8 | `actividades/[eventId]/index.tsx` con las cinco salidas de la acción y la CTA pegada | Capturas de cada salida y de iPad horizontal; test del orden de motivos |
| 9 | Mapa, adjuntos, galería y «Ver la página pública» | Tests: `Linking` con la URL esperada por plataforma; el enlace de PDF no llega a `logger` |
| 10 | `actividades/publica/[slug].tsx` (con y sin sesión) y el botón de compartir del plan 08 | Test sin sesión → «Entra para apuntarte»; con sesión → `replace` a la ficha |
| 11 | Entradas del mapa de enlaces (plan 10), botones interinos con `openLegacy` y `CHANGELOG.md` | Test del mapa con cada enlace de la tabla |

## Tests

En `__tests__/comunica/`, con el servidor falso.

- **Puros**: plazo vacío = abierta; el día de cierre a las 23:59 aún abierta y a las 00:00 del
  siguiente cerrada (hora de Madrid, también con el cambio de hora); «antes» con y sin fecha; el
  chip del plazo gana a la etiqueta del CRM y «Con plaza» gana a todo; pasado por fin y, sin fin,
  por inicio; orden por inicio con los sin fecha al final; la tarjeta no repite el plazo cerrado
  ni el de lo inscrito; duración solo de 2 a 31; orden de la acción (pasado → plaza → audiencia →
  plazo → abierta) y sus textos para uno mismo y para un hijo; fechas en palabras (un día, mismo
  mes, meses distintos, años distintos); `bodyLinks` con `tel:`, `mailto:`, `http://` de nuestro
  dominio, documento, externo y `javascript:` (no enlaza).
- **De pantalla**: los dos bloques y sus títulos; la ficha de un evento de otra delegación
  explica el motivo y no tiene «Inscribirme»; la de un evento con plaza lleva a la inscripción; un
  evento oculto no sale en «Para apuntarte» pero su ficha por enlace sí deja apuntarse; cambio de
  hijo en la ficha → la misma ficha con el otro perfil.
- **Guardarraíles**: ningún componente de `actividades/` importa `react-native-render-html` ni
  `react-native-webview` (recorre los imports); ningún esquema del contrato de este bloque tiene
  un campo de HTML; los enlaces de PDF y los `documentId` no pasan por `logger`; `price` y
  `capacity` nunca llegan a 0 desde el falso.

## Preguntas abiertas

1. **Documentos de quien ya tiene plaza.** La ficha no le dice «no es para ti» a quien ya está
   apuntado (`inc/stic-events.php:1018-1032`), pero el endpoint de documentos sí lo mira solo por
   audiencia (`inc/stic-event-web.php:331-336`): si le cambian el curso, no puede abrir el PDF de
   su convivencia. Mientras se decide, como el plugin (el servidor no lista lo que no serviría).
   ¿Se le dejan ver?
2. **«Con plaza» con una inscripción rechazada.** Para el plugin, «activa» es cualquiera que no
   esté cancelada (`inc/stic-action.php:494`): una `rejected` sale como «Con plaza» y con «Mi
   inscripción». Se deja igual; ¿debería contar solo lo que no sea cancelado **ni** rechazado?
