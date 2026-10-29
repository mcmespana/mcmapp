# 14 — Inscripciones

> Estado: 🟢 listo para ejecutar en `nuevoComunicaChulo` · Depende de: 13 (y con él 01, 03, 11; 10 para el formulario avanzado; 15 para pagar) · Tamaño: L · Índice: [README.md](README.md)

## Para qué y para quién

Para **familias, participantes y miembros**: apuntarse con el **alta corta** (preguntas, cómo se
paga, el IBAN si es domiciliación) o con el **formulario web avanzado del CRM** ya relleno; ver
**«Mis inscripciones»**; y en cada una, **el pago en una línea**, cambiar las respuestas o
**cancelar** mientras el plazo siga abierto. Con el perfil activo del plan 11: la inscripción es
del hijo que se ve y **paga el familiar**. Cobrar con tarjeta es del plan 15: aquí solo se llega.

## Especificación de origen

Todo en `/home/user/comunicaAreaPrivada/`; si documento y código chocan, manda el código.

| Qué | Dónde |
|---|---|
| Preguntas, pago al inscribirse, tarjeta, formulario avanzado, cancelar y modificar | `docs/comunica/EVENTOS.md` §10 |
| Un compromiso por inscripción, del organizador; «compromiso» no se enseña; importes sin «.00» y el pago que nace sin persona | `plans/041-pagos-un-solo-flujo.md` (D-1…D-6, R1-R5, §6); `CLAUDE.md` del plugin |
| Alta corta, ficha y modificar (pantalla) | `pages/single_stic_registrations.php` 30-181 y 278-553 |
| Listado | `pages/list_stic_registrations.php`; `inc/stic-registrations.php` 103-425 |
| Ficha, preguntas, pago, IBAN, compromiso, derechos, avisos tras guardar | `inc/stic-registrations.php` 492-725, 753-1292, 1300-1317, 1529-1654 |
| Estado del pago en una línea | `inc/stic-pay-card.php` 419-544 |
| El guardado (el guard de verdad) | `inc/stic-action.php` 529-807; inscripciones activas 358-527 |
| Puerta y relleno del formulario avanzado | `inc/stic-events.php` 154-307 |
| Comprobar un IBAN | `js/iban.js` (web) y `sticpa_iban_is_valid()` (`inc/stic-registrations.php:1105-1123`) |
| Textos de familia (de quién, sin «inscrito») | `plans/042-pulido-integral/auditoria-familias.md` FAM-a4, a5, a12 |

**Manda el código:** (1) `EVENTOS.md` §10.4 da la inscripción a la delegación de la persona; el
código, **al dueño del evento** (`inc/stic-action.php:740-752`, plan 041 D-1). (2) `EVENTOS.md`
§10.1 dice que los campos de las preguntas están por crear; `CAMPOS.md:949-962` (manda), que están
creados: el servidor, como el plugin, solo los usa si están en la definición del CRM. (3) En el
plugin las fechas del evento en la lista dependen de la caché del calendario
(`inc/stic-registrations.php:91-129`); el servidor las da siempre.

## Pantallas y rutas

| Ruta | Qué | Del plugin |
|---|---|---|
| `actividades/[eventId]/inscribirme.tsx` | El alta corta (o el motivo por el que no) | `single_stic_registrations&action=create&from=stic_events&id=` |
| `inscripciones/index.tsx` | «Mis inscripciones» / «Inscripciones de Lucía» | `list_stic_registrations` |
| `inscripciones/[registrationId]/index.tsx` | La ficha de una inscripción | `…&action=detail&id=` |
| `inscripciones/[registrationId]/modificar.tsx` | «Modificar mi inscripción» | `…&action=edit&id=` |
| `web.tsx` (plan 10) | El formulario avanzado del CRM, relleno | `admin-post.php?action=sticpa_evento_fwa&e=` |

Este plan **sustituye los botones interinos del 13** («Inscribirme» y «Mi inscripción» con
`openLegacy`) por estas rutas. Cambiar de hijo (plan 11) en `inscripciones/[…]` lleva a
`inscripciones/index` del otro: una inscripción es personal (FAM-a8). Quien solo es familiar,
viéndose a sí mismo, no tiene Inscripciones (`sticpa_visible_sections()`): al «¿A quién ves?».

Código: `components/comunica/inscripciones/`, `hooks/comunica/useRegistrations.ts`,
`utils/comunica/` (`iban.ts`, `signupForm.ts`, `registrationList.ts`, `paymentLine.ts`,
`registrationNotes.ts`). La ficha usa la ficha de registro común del plan 13
(`components/comunica/comun/record/`).

**Formularios:** sin motor declarativo: el alta corta tiene cinco campos fijos como mucho y se
monta con las piezas del plan 09 (`comun/form/`: `OptionCards`, `FormField`, `SelectField`).

### Qué va a la web y por qué

| Qué | A dónde | Por qué |
|---|---|---|
| **Formulario web avanzado** (el Foro, el Congreso) | `web.tsx` del plan 10, con la URL rellena que da el servidor y cabecera nativa «Inscripción» | Lo pinta el CRM, cambia en cada evento y pide muchos más datos: rehacerlo sería rehacer el constructor de formularios de SinergiaCRM. **No pasa por `openLegacy`**: es una página pública del CRM, no del plugin, y no necesita sesión de WordPress (el pase mágico sería un salto para nada). Cuando el formulario vuelve al área (`/ap/?internalpage=list_stic_registrations`, `EVENTOS.md` §10.2.2), `web.tsx` lo intercepta como página nativa y abre «Mis inscripciones» refrescada |
| Pagar con tarjeta | Plan 15 | — |
| Todo lo demás | Nativo | Apuntarse es lo importante |

### Qué no se hace (desactivado o quitado en el plugin)

| Qué | Prueba |
|---|---|
| Borrar una inscripción | El botón de `pages/single_stic_registrations.php:241-246` no se pinta nunca (la ficha sale antes, 30-99); el `delete` de `inc/stic-action.php:595-601` no tiene pantalla |
| Alta genérica con un desplegable de eventos (`action=create` sin `from`) | `pages/single_stic_registrations.php:424-444` |
| Cambiar de evento o de estado al modificar | `inc/stic-action.php:622-634`; `EVENTOS.md` §10.3 |
| La palabra y el enlace «compromiso» | `inc/stic-registrations.php:613-615`; plan 041 D-6 |
| Aportación suelta, instrucciones de transferencia por evento | Plan 041 (aparcado D-5; «no se hacen aportaciones sueltas») |
| «Referencia», «Tipo de participación» si es el de siempre, chip «No invitado» | `inc/stic-registrations.php:621-624, 563-572, 432-438` |
| Botón en las tarjetas de la lista | `inc/stic-registrations.php:368-382` |

### Enlaces que llegan aquí (para el mapa del plan 10)

| Enlace | Pantalla nativa |
|---|---|
| `list_stic_registrations` | `inscripciones/index` |
| `single_stic_registrations&action=detail&id=<insc>` (con `msg=pagado`, la vuelta del pago: «esperando al banco») | `inscripciones/[registrationId]` |
| `…&action=edit&id=<insc>` | `inscripciones/[registrationId]/modificar` |
| `…&action=create&from=stic_events&id=<evento>` | `actividades/[eventId]/inscribirme` |
| `…&action=create&eventId=<evento>` (puerta vieja, `inc/stic-action.php:822-828`) | `actividades/[eventId]/inscribirme`; sin id válido, `actividades/index` |
| `…&action=create` sin evento · `…&action=delete` (desactivadas) | `actividades/index` · `inscripciones/[registrationId]` |
| Vuelta del formulario avanzado (`/ap/?internalpage=list_stic_registrations`) | `inscripciones/index`, refrescada |

## Datos: su trozo del contrato

```
GET   /v1/profiles/:pid/events/:eventId/signup      → SignupForm
POST  /v1/profiles/:pid/registrations               SignupWrite → SignupResult
POST  /v1/profiles/:pid/events/:eventId/advanced-form → { url }
GET   /v1/profiles/:pid/registrations               → { generatedAt, items: RegistrationCard[] }
GET   /v1/profiles/:pid/registrations/:rid          → RegistrationDetail
PATCH /v1/profiles/:pid/registrations/:rid          RegistrationEdit → WriteResult
POST  /v1/profiles/:pid/registrations/:rid/cancel   { clientId } → WriteResult

SignupForm   { generatedAt, event: { id, name, startDate, endDate, description: string|null },
               blocked: null | { reason: 'already_registered', registrationId }
                      | { reason: 'audience'|'window', title, message } | { reason: 'advanced_form' },
               questions: Question[], price: number|null,
               paymentMethods: { key: PaymentMethod, label }[],     // solo las que tiene el CRM
               specialNeeds: { label, options: { value, label }[], yesValue, descriptionLabel } }
Question     { n: 1|2, prompt: string|null, options: string[] }    // dos opciones o más
PaymentMethod 'bizum'|'transfer'|'transfer_received'|'cash'|'direct_debit'|'card'
SignupWrite  { clientId, eventId, answers: { n: 1|2, option: number }[],   // nº de opción, desde 1
               payment: { method: PaymentMethod, iban?: string } | null,
               specialNeeds: string|null, specialNeedsDescription: string|null }
SignupResult WriteResult & { registrationId, payment: 'none'|'noted'|'error', cardPaymentId: string|null }
RegistrationEdit { clientId, answers, specialNeeds, specialNeedsDescription }
RegistrationCard { id, title, eventId: string|null, eventStart, eventEnd, signedOn,   // días o null
               schoolLevel: string|null, classLabel: string|null,  // etiquetas; «no aplica» no llega
               status: { label: string, tone: 'ok'|'warn'|'danger'|'neutral' },    // label '' = sin chip
               eventHidden: boolean }
RegistrationDetail RegistrationCard & { amount: number|null, participation: string|null,
               attendancePercent: number|null, attendees: number, answers: string[],
               specialNeeds: string|null, specialNeedsDescription: string|null,
               contacts: { name, relationship: string|null, phone: string|null, email: string|null }[],
               payment: PaymentState,
               manage: { canEdit, canCancel, reason: string|null, until: string|null },
               edit: { questions: (Question & { current: number|null })[], specialNeeds: SignupForm['specialNeeds'] } | null }
PaymentState { state: 'pending'|'returned'|'paid'|'direct_debit'|'no_commitment'|'none',
               amount: number|null, method: PaymentMethod|null, methodLabel: string|null,
               date: string|null, paymentId: string|null }
```

Errores (amplía el de 00 con `reason` y `field`; se apunta en `COMUNICA_API.md`): `conflict` con
`reason` `already_registered` (+ `registrationId`), `advanced_form` o `window_closed`;
`forbidden` con `reason: 'audience'`; `validation` con `field` `answers` o `payment`.

**Lo que promete el servidor** (`prefix_admin_single_stic_registrations()`, prosa en `COMUNICA_API.md`):

1. La persona inscrita es **siempre** `pid`; paga el familiar que ha entrado (o el participante
   adulto) y el hijo es el destinatario (`sticpa_registration_payer`).
2. **El guard es el servidor**: duplicado **sin caché**, audiencia y plazo (los del plan 13), y
   con formulario avanzado no se crea nada. Lo que enseña la app es cortesía.
3. Preguntas: solo las de ese evento; el número de opción se cambia por **su texto**, que es lo
   que se guarda; sin contestar o fuera de rango → `validation` (`sticpa_event_questions_resolve`).
4. Con precio y medios en el CRM: medio obligatorio y de la lista; domiciliación con IBAN válido
   (módulo 97; uno español, 24 caracteres) → si no, `validation` `payment`.
5. La inscripción: confirmada, una persona, como asistente, con fecha de hoy, respuestas y
   necesidades especiales; **de quien organiza el evento** (si no tiene, de la delegación de la
   persona).
6. El pago (si hay precio y medio): **un compromiso** puntual de servicios por el precio (con su
   IBAN si es domiciliación), del mismo dueño, atado a pagador, destinatario e inscripción; si el automatismo del CRM
   ya creó uno, **se completa ese** (el de la renovación cobró dos veces). **Importe sin «.00»**
   (`sticpa_crm_amount`), y **al pago que genera el CRM se le pone la persona**, o no sale en
   Pagos. Si falla, la inscripción se queda y vuelve `payment: 'error'`. Con tarjeta, lo mismo, y
   `cardPaymentId` es el pago pendiente (null si el CRM no lo generó: el plan 15 paga entonces
   por la inscripción, `pagos/pagar?inscripcion=`, como `single_stic_payment_form&registrationId`).
7. Mismo `clientId` = misma inscripción (además del guard de duplicados).
8. Modificar: **solo** respuestas y necesidades especiales; cancelar: estado «cancelada» (no se
   borra), fin hoy y nota en sus compromisos, ningún pago tocado. Los dos solo con
   `sticpa_registration_manage_rights`: no cancelada ni rechazada, evento sin pasar, plazo abierto
   (vacío = abierto); cancelar además si el CRM tiene esa clave y **no es un curso** (más de 31
   días). Si no, `conflict` `window_closed` y no se toca nada.
9. Leer la ficha **reconcilia** el pago con tarjeta (el «reclamar» de
   `sticpa_registration_payment_state`, plan 15). El tono del estado sale de la **clave** del CRM
   (`sticpa_record_status_tone`, con sus negaciones; neutro ante la duda).
10. `advanced-form`: sesión, sin plaza (sin caché), audiencia y plazo; la URL del evento
    desescapada (`&amp;`), solo `http(s)`, con los seis datos de
    `sticpa_event_fwa_prefill_fields()` de `pid` (sin la fecha de nacimiento) y sin pisar lo que
    ya trae. Si no toca, `conflict` y la ficha del evento explica por qué.

### En el móvil

| Clave | Persistida | Por qué |
|---|---|---|
| `['comunica','registrations',pid]` | sí | Títulos, fechas y estados: abre al instante |
| `['comunica','registrations',pid,rid]` | **no** | Teléfonos y correos de los tutores, importes (regla 8 de familias) |
| `['comunica','signup',pid,eventId]` | no, `staleTime` 0 | El guard de duplicados se mira al abrir |

**Inscribirse, modificar y cancelar NO van por la cola** (decisión de este plan): llamada
directa con conexión y `clientId` en memoria para reintentar sin duplicar. La cola guarda el
payload en el móvil y el **IBAN no puede tocar el disco**; hace falta la respuesta al momento (la
plaza, el pago que sigue); y sin cobertura las familias no prometen nada (decisión `offline`). El
IBAN vive solo en el estado del formulario; nunca en `logger` ni en Sentry. Al aplicarse se
invalidan actividades (13), inscripciones, `['comunica','pagos',pid]` (15) y el calendario (16). La URL del
formulario avanzado lleva datos personales: ni se guarda ni se registra.

### Servidor falso

Sobre los fixtures del 13: inscripciones en cada estado de pago y de inscripción (también
rechazada y «no invitado»), una de un evento oculto, una del curso MIC, una con plazo cerrado y una
con tutores. Mandos: «el CRM no genera el pago» (`cardPaymentId: null`), «falla el pago»
(`payment: 'error'`) y «otro dispositivo ya se apuntó» (`conflict` al enviar).

## Comportamiento y reglas que no se pueden perder

**Alta corta** (`pages/single_stic_registrations.php` 278-553):

- Arriba, el resumen: «Te inscribes a» / «Inscribes a Lucía en», nombre, fecha en palabras (nunca
  `31-10-2026`, FAM-a5), descripción y «Ver la actividad».
- **Bloqueos** (en este orden): plaza ya cogida → «Ya tienes tu plaza» / «Lucía ya tiene su
  plaza» y «… ya tiene una inscripción activa para esta actividad. No hace falta repetirla.»;
  audiencia o plazo → su título y texto (plan 13); formulario avanzado → «Esta actividad tiene su
  propio formulario» · «La inscripción se hace en el formulario de la actividad, que pide algún
  dato más. Te lo abrimos con tus datos ya puestos.» con «Ir al formulario de inscripción». Con
  bloqueo, ni un campo: el resumen, el aviso y «Volver».
- Preguntas: un grupo de opciones obligatorio por pregunta; título, la pregunta o «Elige una
  opción» («Elige una opción (2)» si hay dos sin texto).
- Con precio: «¿Cómo pagas?» con el precio al lado; los medios con la **etiqueta del CRM**, su
  icono y «Pago online» bajo la tarjeta; con domiciliación, «IBAN» obligatorio, comprobado al
  salir del campo (`iban.ts`: módulo 97 de `js/iban.js` y los 24 del PHP): «El IBAN no parece válido.»
- Necesidades especiales con la etiqueta del CRM; la descripción solo con la opción «sí» (`yesValue`).
- «Apuntarme» / «Apuntar a Lucía». Si falta algo, no se envía: error en el campo, se va al primero
  y `h.error` («Contesta a todas las preguntas de la actividad.», «Elige cómo vas a pagar.»).
- Al aplicarse: `router.replace` a la ficha nueva con «Listo: ya tienes tu plaza.» / «Listo: Lucía
  ya tiene su plaza.» y `h.formSuccess`; con `payment: 'error'`, el aviso de
  `sticpa_registration_saved_note('pago_error')`. **Con tarjeta**, además se apila encima
  `pagos/pagar?pago=<cardPaymentId>` (plan 15): al volver atrás se cae en la inscripción.
  `already_registered` al enviar → el bloqueo de arriba; red o CRM caído → «No hemos podido
  guardar la inscripción. Inténtalo otra vez en un rato.» con «Reintentar» (mismo `clientId`).

**Formulario avanzado**: «Inscribirme en esta actividad» (plan 13) con `hasAdvancedForm` pide la
URL y abre `web.tsx`; al volver (intercepción o «atrás») se refresca todo: quien terminó ve «Con plaza».

**Mis inscripciones** (`sticpa_registrations_list_html`):

- Título «Mis inscripciones» / «Inscripciones de Lucía». Arriba la nota «Aquí están las
  actividades y eventos a los que te has apuntado. Si quieres ver a cuáles puedes apuntarte, mira
  la sección Eventos.» con el enlace.
- Orden (`registrationList.ts`): lo abierto (ni pasado ni `danger`) por fecha ascendente; luego
  lo cerrado, del más reciente al más antiguo. Fecha: el inicio del evento, si no la del alta.
- Tarjeta: cápsula con el inicio (o la fecha del alta); el nombre del **evento**; la fecha del
  evento o «Te apuntaste el 14 de marzo de 2026»; «2.º ESO · Clase B»; chip del estado con su
  tono; apagada si pasó o es `danger`. Sin botón: tocarla abre la ficha.
- **«Otros eventos»** (los de eventos ocultos): plegado y con su número, abierto si no hay nada más.
- Vacío: «Todavía no tienes ninguna inscripción» / «Todavía no hay inscripciones de Lucía», con su
  texto (`inc/stic-registrations.php:308-320`) y «Ver actividades abiertas».

**Ficha de la inscripción** (`sticpa_registration_detail_html`):

- Cabecera: el nombre, la línea de cuándo y los chips (estado + «Ya celebrado»). Avisos: el de
  después de guardar; estado `danger` «Esta inscripción está en estado «X». Si crees que es un
  error, habla con tu delegación.»; `warn` «Todavía no está confirmada. Tu delegación la revisará
  y te avisará; no hace falta que hagas nada más.»; la descripción de necesidades especiales.
- «Importe de la inscripción» en grande si es mayor que 0. Datos: «Fecha de inscripción» (solo si
  la cabecera lleva las del evento), «Curso escolar», «Clase», «Tipo de participación» (solo si no
  es el de siempre), «Asistencia» («85 %», si > 0), «Personas» (si > 1), «Tu respuesta» / «Tu
  respuesta (2)» y **«Pago»** en una línea (`paymentLine.ts`, de `sticpa_payment_state_ui`):
  - pagado: «110,00 € · Pagado · Tarjeta · 2 de octubre de 2026» con «Ver el pago» (`pagos/[id]`);
  - domiciliado: «60,00 € · Se cobra por domiciliación el 16 de octubre de 2026»;
  - devuelto: «110,00 € · No se pudo cobrar» y el aviso rojo «Este pago no se pudo cobrar. Puedes
    pagarlo con tarjeta o hablar con tu delegación.»;
  - pendiente / sin compromiso: «35,00 € · Pendiente de pagar · Transferencia» (sin medio si es
    tarjeta o no hay compromiso); con transferencia, Bizum o efectivo, «¿Ya lo has pagado? Tu
    delegación lo marcará en cuanto lo vea.»; recién vuelto del pago (`msg=pagado` o un intento
    abierto de `useCardAttempt`, plan 15), «Estamos esperando la confirmación del banco. En unos
    minutos lo verás como pagado.», y al cobrarse «Pago hecho. Ya tienes tu plaza.»
- **La acción**: «Pagar 35,00 € con tarjeta» es la principal si el estado no es `danger` y (hay
  pago pendiente o devuelto con `paymentId`, o no hay compromiso y no ha pasado) y no se está
  esperando al banco: `pagos/pagar?pago=` o `?inscripcion=`. Si no, la principal es «Ver la actividad».
- «Personas de contacto»: cada tutor con parentesco · teléfono · correo y el botón «Llamar a …».
- «¿Necesitas cambiar algo?»: «Modificar mis datos» y «Cancelar mi inscripción», con la nota del
  motivo («Para darte de baja del curso, habla con tu delegación.») o «Hasta el 25 de octubre de
  2026.». Sin derechos y con motivo, el motivo como aviso («El plazo de inscripción ya ha
  terminado. Si necesitas cambiar algo o no puedes ir, habla con tu delegación.»).
- **Cancelar**: confirmación nativa «¿Cancelar tu inscripción?» · «Tu plaza quedará libre.» ·
  «No, mantenerla» / «Sí, cancelar» (destructivo). Hecho: «Inscripción cancelada.»; con el plazo
  cerrado entre medias: «El plazo de inscripción ya ha terminado, así que no se ha cambiado nada.
  Si lo necesitas, habla con tu delegación.»
- **Modificar** («Modificar mi inscripción»): «Tu inscripción a», las preguntas con lo contestado
  marcado y las necesidades especiales; «Guardar cambios» → «Cambios guardados.». Sin derechos:
  «Esta inscripción ya no se puede cambiar» con el motivo y «Ver mi inscripción».

## Estados

| Estado | Inscribirme / Modificar | Mis inscripciones | Ficha |
|---|---|---|---|
| Cargando | Esqueleto del resumen y de dos grupos de opciones | Esqueleto de tres tarjetas | Esqueleto de cabecera y cinco datos |
| Vacío | — | El de arriba | — |
| Error | `AreaState` con «Reintentar»; `forbidden` → «Esta inscripción ya no está disponible» | Igual | Igual, con «Ver mis inscripciones» |
| Sin conexión | Campos visibles si estaban, botón apagado: «Necesitas conexión para apuntarte» (o «para guardar») | Lo guardado con `SyncBadge` | «Necesitas conexión para ver la inscripción» (no se guarda en el móvil) |
| Pendiente de subir | El botón en curso; nada queda en el móvil | — | Cancelar en curso, con el botón ocupado |

## Traducción del diseño

Se queda igual: los textos (sin «inscrito/a»: «plaza», «apuntarse»), el orden de los bloqueos y
de la ficha, una sola acción principal, el pago en una línea, «Otros eventos». Cambia por ser
app (plan 03 §3):

- Alta corta y modificar: pantallas del `Stack`; «Volver» es el atrás del sistema. El resumen del
  evento, neutro (sin degradado: FAM-a5). Opciones con `OptionCards` (tarjeta entera pulsable,
  `accessibilityRole="radio"`, `h.select`), apiladas a 375 y en dos columnas desde 720. El precio
  con cifras tabulares. El IBAN con `autoCapitalize="characters"`, sin autocorrección ni
  autorrelleno, agrupado de cuatro en cuatro al escribir; aparece con un fundido que respeta
  «reducir movimiento». `BottomActionBar` por encima del teclado y de la barra flotante.
- Lista: título grande nativo; `RecordCard` + `DateCapsule`; la nota de arriba con `RecordNote`;
  «Otros eventos» como cabecera pulsable con su número, chevron y `accessibilityState.expanded`.
- Ficha: `RecordHero`, el importe como titular, `FactList`, `RecordNote`. «Pagar … con tarjeta»
  en `BottomActionBar`; «Ver la actividad», en el contenido. Tutores con fila de persona y botón de
  llamar de 44 pt (`tel:`). «Cancelar mi inscripción» en rojo como botón de texto, nunca relleno.
  Confirmación con `Alert` nativo. Hápticos: `h.formSuccess` al apuntarse o guardar, `h.remove`
  al cancelar.

Skills: `building-native-ui`, `heroui-native`, `animate-expo`, `make-interfaces-feel-better`; para
revisar, `fixing-accessibility`, `baseline-ui`, `fixing-motion-performance` e `improve-ui`.

## Tareas

| # | Tarea | Cómo se comprueba |
|---|---|---|
| 1 | Esquemas zod de «Datos», errores con `reason`/`field` y su apartado en `COMUNICA_API.md` (con lo que promete el servidor) | Typecheck; test que rechaza un `SignupWrite` con IBAN y sin domiciliación |
| 2 | Servidor falso: rutas, fixtures, guards (duplicado, audiencia, plazo, formulario avanzado, derechos) y mandos | Tests del falso: duplicado → `conflict`; curso → no cancela; mismo `clientId` → una inscripción |
| 3 | `iban.ts`, `signupForm.ts` (validar y armar el envío), `registrationList.ts`, `paymentLine.ts`, `registrationNotes.ts` | Tests puros (abajo) |
| 4 | Hooks: lista, ficha (`persist: false`), formulario, apuntarse, modificar, cancelar, formulario avanzado; llamadas directas con `clientId` e invalidaciones | Tests con el falso: reintento sin duplicar; claves invalidadas |
| 5 | `inscribirme.tsx` con bloqueos, preguntas, pago, IBAN y necesidades especiales | Capturas 375 px claro/oscuro: con precio, sin precio, domiciliación, cada bloqueo |
| 6 | Formulario avanzado en `web.tsx` con la intercepción de la vuelta; botones del plan 13 a las rutas nativas | Test: abre con la URL del falso; navegar a `/ap/?internalpage=list_stic_registrations` cierra y abre la lista |
| 7 | `inscripciones/index.tsx` | Capturas: lista con «Otros eventos», todo oculto, vacía, hijo |
| 8 | `inscripciones/[registrationId]/index.tsx` con el pago, la acción, los tutores y la gestión | Capturas de los seis estados de pago y de `danger`/`warn` |
| 9 | Enlace al pago del plan 15 (`cardPaymentId`, por inscripción sin compromiso, «Ver el pago») y el estado «esperando» a la vuelta | Test: con tarjeta, al aplicarse se apila el pago sobre la ficha |
| 10 | `modificar.tsx` y cancelar | Tests: lo contestado sale marcado; cancelar pide confirmación; curso sin cancelar |
| 11 | Entradas del mapa de enlaces (plan 10) y `CHANGELOG.md` | Test del mapa con cada enlace de la tabla |

## Tests

En `__tests__/comunica/`, con el servidor falso.

- **Puros**: IBAN (`ES9121000418450200051332` y `DE89370400440532013000` valen; un dígito cambiado
  o un español de 23 no; espacios y minúsculas se limpian); validar el alta (sin contestar, sin
  medio con precio, IBAN solo con domiciliación); el envío lleva opciones desde 1 y nunca IBAN sin
  domiciliación; orden de la lista (`danger` a lo cerrado, lo cerrado al revés) y «Otros eventos»
  abierto si está solo; el pago en sus seis estados y cuándo se ofrece pagar; avisos para uno mismo
  y para un hijo.
- **De pantalla**: apuntarse por transferencia → ficha con «Listo…» y «Pendiente de pagar»; con
  tarjeta → pago del plan 15 con `cardPaymentId`, y sin él, por la inscripción; IBAN malo no envía
  nada; plaza cogida desde otro móvil → bloqueo; formulario avanzado → `web.tsx`; sin conexión →
  botón apagado; modificar y cancelar con plazo abierto y cerrado.
- **Guardarraíles**: tras un alta con domiciliación, el IBAN no está en el almacén de consultas,
  ni en la cola, ni en `logger` (se busca la cadena); la ficha de una inscripción nunca llega al
  disco; ninguna escritura de este bloque usa `enqueueWrite`; ningún cuerpo de petición lleva la
  persona inscrita ni la pagadora (solo el `pid` de la ruta); la URL del formulario avanzado no
  pasa por `logger`.

## Preguntas abiertas

1. (`campos-crm` = «míralos tú», 24/10: ver `CAMPOS.md` del plugin, actualizado) **Necesidades especiales.** `special_needs` no está en `CAMPOS.md`; el plugin trata `1` como
   «sí» (`inc/stic-registrations.php:1686-1690`) y pinta el desplegable que dé el CRM. Mientras,
   el servidor manda las opciones de la definición y `yesValue: '1'`. Hay que mirar sus claves en
   Studio y apuntarlas en `CAMPOS.md`.
2. **Documentación del plugin por detrás del código** (no se elige nada, se avisa): `EVENTOS.md`
   §10.1 (campos de preguntas «por crear», `CAMPOS.md` dice creados) y §10.4 (delegación de la
   persona; el código usa la del organizador). Los campos de respuesta siguen sin verificar por MCP.
