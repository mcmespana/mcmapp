# 15 — Pagos y pagar con tarjeta desde la app

> **Estado:** 🟢 listo para ejecutar en `nuevoComunicaChulo` · **Depende de:** 01, 03, 11 y 14
> (y con ellos 00 y 10) · **Tamaño:** L · Índice y reglas comunes: [`README.md`](README.md)

## Para qué y para quién

Para **quien paga**: la madre o el padre que ve a sus hijos, y el miembro o el monitor que se paga
lo suyo (el Congreso de Monitores, una convivencia). Una sola pregunta: **«¿qué debo, de qué y cómo
lo pago?»** (`plans/041` §0). Tres piezas:

1. **Pagos** en tres bloques: *Pendiente de pagar*, *Se cobrará por domiciliación* y *Pagado*
   (más *Otros* para lo raro). La palabra «compromiso» no aparece nunca.
2. **La ficha de un pago**: importe, estado, cómo se pagó, por qué falló si falló y qué hacer.
3. **Pagar con tarjeta en nativo** (lo pidió el propietario): resumen con «Pagar 35,00 €» y «Pagar
   otra cantidad», la pasarela del banco en una **hoja propia** que la app cierra sola al volver, y la
   **reclamación** (atar el pago con tarjeta a lo que se debía) en **nuestro servidor**.

El dinero es **de quien paga** (`inc/stic-family.php` 468-510): un familiar ve Pagos viéndose a sí
mismo (todo lo que paga, con «Para Lucía»); al ver a un hijo, solo lo de ese hijo. Siempre con conexión.

## Especificación de origen

Todo en `/home/user/comunicaAreaPrivada/`:

| Qué | Dónde |
|---|---|
| El modelo (R1-R5), los flujos y las decisiones D-1…D-6 | `plans/041-pagos-un-solo-flujo.md` §4-§6, §9 y §10 |
| Pagar con tarjeta: campos al CRM, marca firmada, campaña, TPV en pruebas | `docs/comunica/EVENTOS.md` §10.2 y §10.2.1 |
| Listado: qué pagos (pagador o destinatario), «Pago hecho» | `pages/list_stic_payments.php` 42-148 y 154-156 |
| Bloques, tarjeta, ficha, IBAN enmascarado, motivo del rechazo | `inc/stic-payments.php` 418-660 (`_list_html`, `_card`, `_detail_html`, `_mask_account`, `_rejection_reason`) |
| Lo que Pagos arregla al leer (de qué compromiso, sin persona, sin nombre) | `inc/stic-payments.php` 184-330 (`sticpa_payments_complete`, `_settle`) |
| ¿Se puede pagar? · ficha | `inc/stic-pay-card.php` 58-66 · `pages/single_stic_payments.php` 57-78 |
| Pantalla de pago: rebotes, datos del pagador, «otra cantidad», doble envío | `pages/single_stic_payment_form.php` (entera) |
| Vuelta KO | `pages/single_stic_payment_error.php` |
| Marca, reclamo, sustitución, abandonados, «anulado» | `inc/stic-pay-card.php` 43-51, 224-397 |
| Estado del pago de una inscripción y sus textos (lo pinta el plan 14) | `inc/stic-pay-card.php` 419-544 |
| Inscripciones sin compromiso (`[insc:]`), «servicio» y no donativo, `m182_excluded`, campaña | `inc/stic-registrations.php` 1349-1505 |
| Medios de pago: solo los del desplegable · quién paga | `inc/stic-registrations.php` 1004-1021 y 1153-1164; `CAMPOS.md` § Compromisos de pago |
| Tono del chip por clave (y las negaciones: `not_paid`, `not_remitted`) | `inc/stic-record-view.php` 622-664 |

**Donde el documento y el código no coinciden, manda el código:** (1) `EVENTOS.md` §10.2.1 asigna el
compromiso con tarjeta a la delegación de quien paga; el código, al dueño **del pago** (o de su
compromiso, o del evento) y solo si no lo hay a la delegación (`single_stic_payment_form.php` 124, 151,
160-165; `plans/041` D-1). (2) El mismo § dice que desde «Mis pagos» sigue habiendo aportación suelta;
el código la quitó (`single_stic_payment_form.php` 45-57). (3) `plans/041` §5.1 deja la ficha de un
compromiso «dentro de Pagos»; nada la enlaza ya (`inc/stic-payments.php` 824, solo la lista
desactivada). (4) `sticpa_payments_without_payer()` (`EVENTOS.md` §10.2, `plans/041` §10) no existe:
lo hace `sticpa_payments_complete()`. **Fallo que no se copia:** «Reintentar el pago» de la vuelta KO
rebota con «No hay nada que pagar aquí» porque va sin parámetros (`single_stic_payment_error.php` 17);
en la app, reintentar vuelve a pagar **el mismo** pago.

## Pantallas y rutas

| Ruta (`app/(tabs)/comunica/…`) | Qué |
|---|---|
| `pagos/index.tsx` | **Pagos**: los bloques, en una `SectionList`. Se llega desde la portada y el menú del plan 11 |
| `pagos/[id].tsx` | **Ficha del pago** |
| `pagos/pagar.tsx` | **Pagar con tarjeta**: resumen, «otra cantidad» y, a la vuelta, el resultado. Parámetros `pago=<id>` o `inscripcion=<id>` (la ficha de la inscripción del plan 14 llega aquí) |
| `pagos/pasarela.tsx` | **La hoja de la pasarela**: `presentation: 'fullScreenModal'`, sin gesto de cerrar, con la WebView |
| `pagos/vuelta.tsx` | Solo para el camino de reserva por el navegador: recibe `mcmapp://comunica/pagos/vuelta?intento=…&r=ok\|ko` y devuelve a `pagar` |

Componentes en `components/comunica/pagos/` (`PaymentCard`, `PaymentDetailView`, `CheckoutSummary`,
`OtherAmountField`, `CardGatewaySheet`, `SimulatedGateway`, `PaymentResult`); hooks `usePayments`,
`usePayment`, `useCardCheckout`, `useCardAttempt`; lógica pura en `utils/comunica/payments.ts` y
`cardAttempt.ts`. **Sin motor de formularios**: el único campo es el importe (`AppTextField`).

### Qué va a la web y por qué

| Qué | Cómo | Por qué |
|---|---|---|
| Nada del plugin | — | Ver, pagar y la vuelta son nativos |
| La pasarela del banco (Redsys) | En la hoja `pasarela.tsx`, no con `openLegacy` | No es una página del plugin ni necesita su sesión; la pinta el banco |

### Qué no se hace (desactivado en el plugin)

| Qué | Prueba |
|---|---|
| Lista «Compromisos de pago» | `menu.php` 90 (comentado); `pages/list_stic_payment_commitments.php` 22-26 (enseña Pagos) |
| Ficha de un compromiso | Solo la enlazaba esa lista (`inc/stic-payments.php` 824); `plans/041` D-6 |
| Aportación o donativo suelto («Hacer una aportación») | `single_stic_payment_form.php` 45-57; `inc/stic-payments.php` 969-972 |
| Crear, editar o borrar un pago | `single_stic_payments.php` 81-226 (sin enlaces); su handler no escribe nada (`inc/stic-action.php` 323-331) |
| Certificado de donaciones | `list_stic_payments.php` 14-21: solo con `sticpa_donations_template_id`, que en Comunica no existe |
| Medio de pago del familiar (FAM-02) | `pages/single_stic_tutor_profile.php` 9-15 y 74-104 (campos que no existen); `TODO.md` FAM-02 `[!]` |
| Tarjeta «Te falta pagar» en la portada y chip «Pendiente de pago» en Eventos | `plans/041`, cabecera: «quedan para después»; no está en el código |
| Instrucciones de transferencia o Bizum en pantalla | `plans/041` D-5, aparcado: van en el correo |

### Enlaces que llegan aquí (para el mapa del plan 10)

| `internalpage` (y parámetros) | Pantalla nativa |
|---|---|
| `list_stic_payments` | `pagos/index` |
| `list_stic_payments&msg=pagado` | `pagos/index` con la nota «Pago hecho. Si aún lo ves pendiente, el banco está terminando de confirmarlo.» |
| `single_stic_payments&action=detail&id=` | `pagos/[id]` |
| `single_stic_payments` con `create`/`edit`/`delete` | `pagos/index` (desactivado) |
| `single_stic_payment_form&paymentId=` | `pagos/pagar?pago=` |
| `single_stic_payment_form&eventId=&registrationId=` | `pagos/pagar?inscripcion=` |
| `single_stic_payment_form` sin nada | `pagos/index` |
| `single_stic_payment_error` | `pagos/index` con la nota «No hemos podido completar el pago. No se ha realizado ningún cargo.» |
| `list_stic_payment_commitments`, `single_stic_payment_commitments` (cualquier `action`) | `pagos/index` (desactivados) |
| `admin-post.php?action=single_stic_payments` o `…_payment_commitments` (solo redirigen a Pagos, `inc/stic-action.php` 304-331) | `pagos/index`. La vuelta de la pasarela **no** pasa por `admin-post`: es `msg=pagado` o `single_stic_payment_error`, arriba |

`single_stic_registrations&…&msg=pagado` es del plan 14 («Pago hecho. Ya tienes tu plaza.», con
`useCardAttempt` de este plan). Un pago empezado en el navegador se termina también aquí: el servidor
reclama cada vez que se abre Pagos o la inscripción.

## Datos: su trozo del contrato

Glosario nuevo (para `00` §1): **Pago** (`stic_Payments`) → `Payment`, «pago»; **intento de pago con
tarjeta** → `CardAttempt`; **pasarela** (TPV de Redsys) → «la pasarela del banco». El compromiso
(`stic_Payment_Commitments`) **no entra en el contrato**: es fontanería.

```
GET  /v1/profiles/:pid/payments                 → { generatedAt, payments: Payment[] }
GET  /v1/profiles/:pid/payments/:id             → PaymentDetail
GET  /v1/profiles/:pid/card-checkout?payment=<id> | ?registration=<id>   → CardCheckout
POST /v1/profiles/:pid/card-attempts            { clientId, source, amountCents, channel } → CardAttempt
POST /v1/profiles/:pid/card-attempts/:id/check  { returned?: 'ok' | 'ko' | 'closed' }       → CardAttemptStatus

PaymentStatus   'pending' | 'scheduled' | 'paid' | 'failed' | 'other'
                // scheduled = domiciliación en remesa; failed = devuelto o rechazado
PaymentMethod   'card' | 'direct_debit' | 'bizum' | 'transfer' | 'cash' | 'other'
Payment         { id, title, forName?, date: 'YYYY-MM-DD' | null, amountCents,
                  status, statusLabel, method, methodLabel, canPayByCard: boolean,
                  confirmingSince?: string }        // hay un intento con vuelta OK aún sin cobrar
PaymentDetail   Payment & { typeLabel?, accountMasked?, bankingConcept?, inKindDescription?,
                  transactionCode?, rejection?: { reason?, date? }, registrationId? }
PaymentSource   { payment: string } | { registration: string }
CardCheckout    { payable: true, concept, amountCents, payer: { name, email }, forName?,
                  returnTo: { registration: string } | 'payments' }
              | { payable: false, reason: 'not_payable' | 'missing_payer_data' | 'nothing_to_pay' }
CardChannel     'sheet' | 'browser'   // hoja con WebView (lo normal) o navegador del sistema (reserva)
CardAttempt     { attemptId, launchUrl, returnUrlPrefix, expiresAt }   // o { attemptId, simulated: true }
CardAttemptState  'started' | 'confirming' | 'paid' | 'failed' | 'abandoned'
CardAttemptStatus { attemptId, state, paidCents?, registrationId?, paymentId? }
```

- **Importes en céntimos** (`amountCents`), sin flotantes; se pintan con `Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })` → «35,00 €».
- **Etiquetas del CRM**: `statusLabel`, `methodLabel` y `typeLabel` salen de su desplegable (nunca la
  clave cruda; medios, **solo los que el desplegable trae**). `method` es solo para la lógica:
  `transfer_received` → `transfer`; lo desconocido (`kind`, «Especie») → `other`. Sin `typeLabel` si
  es «Servicios» (`inc/stic-payments.php` 611-614). **El IBAN entero nunca viaja**: `accountMasked`.
- **Quién puede**: `pid` es uno mismo o un hijo con relación vigente (`sticpa_allowed_profile`); el
  pago, de ese perfil (`sticpa_user_owns_record`). Fuera de eso, `forbidden` (nunca `not_found`).
  Un pago ya no pendiente → `conflict` con `reason: 'not_payable'`.
- **En el móvil, nada de Pagos** (`persist: false` en las tres lecturas: importes, conceptos, cuenta y
  correo del pagador; decisión `offline` y regla 8 de familias): caché en memoria, `staleTime: 0` y
  refresco al enfocar (el plugin no cachea Pagos «es dinero», `list_stic_payments.php` 65-68). A disco
  solo va el **intento en curso** (`attemptId`, `pid`, `source`, hora; sin importes), en el almacén por
  persona del plan 01; se borra al terminar y al salir. **Nada va por la cola**: pagar exige conexión.
- Claves `['comunica', 'pagos', pid]`, `[…, 'detalle', id]`, `[…, 'pagar', 'pago'|'inscripcion', id]`;
  al acabar un intento se invalidan las de pagos del `pid` y las de inscripciones del plan 14.

### Lo que tiene que hacer nuestro servidor (requisito para su plan, no su diseño)

1. **Leer Pagos como el plugin.** Viéndose a sí mismo, los pagos de los que es pagador; viendo a un
   hijo, los de los compromisos de los que el hijo es destinatario (`list_stic_payments.php` 43-148).
   Fuera: intentos de tarjeta sin cobrar, lo pendiente de un compromiso cerrado y lo anulado
   (`inc/stic-payments.php` 434-436). `paid` = clave `paid` o tono «ok» **sin negación**; `failed` =
   tono de peligro. El título, como `sticpa_payment_concept()` (el concepto bancario manda; «Tarjeta
   (vía Redsys)» no es un concepto). `forName` = nombre de pila del destinatario si no es quien se ve.
   `canPayByCard` = como `sticpa_pay_is_payable()` y con el compromiso vivo y sin marca de intento.
2. **Antes de enseñar Pagos o una inscripción, poner en orden** (`sticpa_payments_settle`,
   `sticpa_payments_complete`): reclamar los intentos con marca, terminar las `[pagado:]` a medias,
   ponerle la persona al pago que nació sin ella y el nombre del evento al que no tiene concepto (y no
   volver a mirar en 12 h si no tiene inscripción). Y una tarea diaria que cierre los abandonados.
3. **Preparar el pago** (`card-checkout` y `card-attempts`): las mismas comprobaciones y rebotes que
   `single_stic_payment_form.php` 45-165; los datos del pagador **tal cual están en su ficha**
   (nombre, apellidos, correo, documento), del familiar si se ve a un hijo; si falta alguno,
   `missing_payer_data`. Importe, tipo y dueño **los del pago** (tipo `services` si viene vacío o
   `donation`; dueño: el del pago, o su compromiso, o el evento, o la delegación).
4. **Arrancar en el CRM**: una **página de un solo uso** del servidor (`launchUrl`, caduca en 10 min,
   `Cache-Control: no-store`, nada de su contenido en logs) que hace el POST automático a
   `…/index.php?entryPoint=stic_Web_Forms_save` con los campos de `single_stic_payment_form.php`
   199-226: clase `Donation`, campaña «Pagos con tarjeta» (configurable), `payment_method = card`,
   `periodicity = punctual`, destinatario = el hijo si lo hay, concepto (≤140), descripción con la
   **marca firmada** `[pago:<id>:<hmac16>]` (o `[insc:…]`) y, si cambió, «Importe cambiado por la
   persona al pagar: X (lo indicado era Y).». La marca, **con el mismo formato y el mismo secreto**
   que el plugin (`sticpa_form_secret`, como variable de entorno): así la web y la app terminan los
   intentos de la otra. `redirect_url` y `redirect_ko_url` = la vuelta del punto 5.
5. **La vuelta** (`returnUrlPrefix` = `https://<servidor>/v1/card-return/<attemptId>/`, pública, sin
   datos): apunta `ok`/`ko` en el intento y reclama. Si el intento es del navegador, redirige a
   `mcmapp://comunica/pagos/vuelta?intento=…&r=…`.
6. **Reclamar** (en `check`, en cada lectura del punto 2 y en la tarea diaria), exactamente como
   `sticpa_pay_claim()` + `sticpa_pay_substitute()` + `sticpa_registration_claim_card_commitment()`:
   buscar por la marca; si un pago del compromiso nuevo está `paid`, atarlo a las inscripciones del
   viejo, corregir «Donativo» a su tipo (compromiso y pagos, con `m182_excluded = 1`), ponerle el
   concepto, **cerrar el viejo** (fin hoy, inactivo, nota «Pagado con tarjeta desde la app el …» y
   «Ojo: se pagaron X en vez de Y» si difiere) y pasar su pago sin cobrar a la clave de «anulado» del
   desplegable (o borrarlo si no la hay), y reescribir la marca (`[sustituido:]`, `[atada:]`). Sin
   cobrar y con más de 24 h (fecha del CRM en UTC sin zona): cerrarlo y `[abandonado:]`. Idempotente.
7. **Más seguro que el plugin**: nunca se da algo por pagado por la vuelta OK (solo por el `paid` del
   CRM). Un intento con vuelta OK que el CRM no tiene cobrado no se cierra a las 24 h: se avisa a quien
   mantiene (puede haber dinero sin anotar). Un segundo intento cobrado para el mismo pago (pago doble)
   también avisa. Cada intento, en el diario de escrituras.

**Servidor falso**: una familia inventada con dos hijos y pagos en todos los bloques (transferencia de
110 € y Bizum pendientes, domiciliación devuelta con motivo, otra de 60 € dentro de dos semanas,
tarjeta pagada con nº de operación, cuota de 20 €, una «Especie», una con `confirmingSince`), una
inscripción sin compromiso, un pagador sin documento, un pago de otra familia (403) y un monitor con el
del Congreso. Sus intentos devuelven `simulated: true`: la hoja pinta `SimulatedGateway` («Pagar»,
«Pagar (el banco tarda)», «Rechazar», cerrar) y el falso sustituye en memoria. Solo con
`EXPO_PUBLIC_COMUNICA_API=fake`.

## Comportamiento y reglas que no se pueden perder

1. **Bloques y orden** (`inc/stic-payments.php` 418-485): *Pendiente de pagar* = `failed` o pagable;
   *Se cobrará por domiciliación* = `scheduled`; *Pagado*; *Otros*. Lo que viene, por fecha
   ascendente; lo pagado, lo último arriba. Un bloque vacío no sale.
2. **Lo que se dice en cada caso** (en la tarjeta de la lista, en la ficha y, plan 14, en la inscripción):

| Caso | Qué se le dice |
|---|---|
| Pendiente, tarjeta | Sin línea de medio; «Pagar con tarjeta» |
| Pendiente, Bizum / transferencia / efectivo | Línea con el medio; «Pagar con tarjeta» también (R2); «¿Ya lo has pagado? Tu delegación lo marcará en cuanto lo vea.» (en la inscripción; aquí también en la ficha, ver §Preguntas). Las instrucciones, por correo (D-5) |
| Domiciliación en remesa | Bloque propio, «Por domiciliación», fecha en la cápsula, sin botón; en la ficha, la cuenta enmascarada |
| Devuelto o rechazado | En *Pendiente*, chip rojo con la etiqueta del CRM (o «No se pudo cobrar»); ficha: «Este recibo no se pudo cobrar: <motivo>. Ocurrió el <fecha>.» + «Puedes pagarlo con tarjeta o hablar con tu delegación.» si se puede, o «Ponte en contacto con tu delegación para volver a intentarlo.» |
| Pagado | Línea con el medio; ficha con «Nº de operación» (tarjeta) o «Referencia» |
| Otro medio del desplegable («Especie»…) | Su etiqueta; si está pendiente, se puede pagar con tarjeta |

3. **Chip solo cuando dice algo que el bloque no dice** (un devuelto). Color por **clave**, neutro
   ante la duda: `not_paid` y `not_remitted` nunca en verde (`StatusChip`, plan 03).
4. **Ficha** (`inc/stic-payments.php` 561-660): título = concepto; fecha en lenguaje humano; chip;
   el importe es el dato grande con el medio debajo; luego Tipo (no si es «Servicios»), Cuenta,
   Concepto (si no es el título), Descripción, Para y, la última, la referencia. Acción principal
   «Pagar 35,00 € con tarjeta» solo si `canPayByCard`.
5. **Pagar** (`single_stic_payment_form.php`): un **resumen, no un formulario**. Nada editable salvo
   el importe tras «Pagar otra cantidad» («¿Cuánto vas a pagar?», teclado decimal, coma o punto,
   mínimo 1 €, dos decimales; la nota «Solo si te han dicho que pagues otra cantidad: un descuento,
   una beca, un arreglo con tu delegación. Lo que pagues es lo que quedará como pagado.»). El botón
   repite el importe («Pagar 20,50 €»), se desactiva si no vale y no se puede pulsar dos veces. Se
   trata como **un descuento, no un pago parcial**: lo que no se paga no queda pendiente.
6. **Nunca un donativo.** Sin pago ni inscripción no hay pantalla de pago. Además de la decisión del
   01/10/2026, es lo que permite cobrar fuera de la compra integrada (regla 13).
7. **Pagos de inscripciones antiguas** (sin compromiso, `[insc:]`): se pagan por el precio del
   evento, solo si no ha pasado (`inc/stic-registrations.php` 686-689); lo ofrece la ficha del 14.
8. **Hoja con WebView, no navegador** (el navegador, de reserva y en web, tarea 9): el legado ya hace este tramo
   en `react-native-webview`, la vuelta se corta sin esquema propio y la cabecera es nuestra.
   **La hoja** (`CardGatewaySheet`, WebView con `launchUrl`): cabecera nativa con
   «Cerrar», «Pago con tarjeta» y el dominio que se ve con un candado; `ComunicaTopProgress` al cargar.
   **Sin JavaScript inyectado ni `onMessage`** (la app no lee la página del banco; así además puede
   ir su Apple Pay), `incognito`, `sharedCookiesEnabled={false}`, `setSupportMultipleWindows={false}`.
   `onShouldStartLoadWithRequest` (marco principal): URL que empieza por `returnUrlPrefix` → se corta
   y se lee `ok`/`ko`; esquema que no es `http(s)` (app del banco para confirmar, Bizum, `intent:`) →
   `Linking.openURL`; lo demás se carga. `onNavigationStateChange`, de reserva (redirecciones en Android).
9. **Cerrar a medias**: «Cerrar», el botón atrás de Android y el gesto piden confirmación: «¿Dejar el
   pago? Si ya has pagado, no pasa nada: lo verás como pagado en unos minutos.» (Seguir pagando /
   Salir). Al salir, `check` con `returned: 'closed'`.
10. **La app enseña, arranca y pregunta; el servidor prepara, reclama y decide.** La app nunca escribe
    en el CRM ni concluye «pagado» por su cuenta: el estado sale siempre de `check`.
11. **Estados del intento** (`utils/comunica/cardAttempt.ts`, máquina pura): resumen → *creando* →
    *pagando* (hoja abierta) → *comprobando* (primer `check`) → uno de:
    - **Pagado** (`paid`): `h.formSuccess`; «Pago hecho. Ya tienes tu plaza.» (o «Lucía ya tiene su
      plaza.») si viene de una inscripción, «Pago hecho.» si no; «Ver la inscripción» o «Volver a Pagos».
    - **Pagado pero sin confirmar** (`confirming`): «Pago hecho. Si aún lo ves pendiente, el banco está
      terminando de confirmarlo.»; `check` a los 2, 4, 8, 15 y 30 s y cada 30 s hasta 3 min; luego,
      «Estamos esperando la confirmación del banco. En unos minutos lo verás como pagado.» Mientras
      haya `confirmingSince`, **ni lista, ni ficha, ni inscripción ofrecen pagar** (chip neutro
      «Comprobando el pago»): no se paga dos veces (el plugin solo lo evitaba en la página de vuelta).
    - **KO** (`failed`): `h.error`; «No hemos podido completar el pago» / «No se ha realizado ningún
      cargo. Puedes intentarlo de nuevo o, si el problema continúa, hablar con tu delegación.» (el
      plugin dice «el administrador»); «Reintentar el pago» (intento y `clientId` nuevos) y «Ahora no».
    - **Cancelado** (cerró la hoja a medias): `check` a los 0, 3 y 8 s («Comprobando…»); si sale `paid` o
      `confirming`, como arriba. Si no: «No has terminado el pago» / «No se ha cobrado nada. Si
      llegaste a pagar, lo verás como pagado en unos minutos.» con «Volver a intentarlo».
12. **Si la app se cierra a mitad de pago**: al volver a Pagos o a la inscripción con un intento en
    curso de menos de 24 h, `check`, el resultado una vez y se borra el registro local.
13. **Tiendas.** Se paga un **servicio físico** que se consume fuera de la app (una convivencia, un
    encuentro, una cuota de actividades): Apple lo permite con tarjeta y sin compra integrada (App
    Store Review Guidelines **3.1.3(e)**, «Goods and Services Outside of the App») y Google Play no
    exige su facturación para bienes y servicios físicos (política de Pagos). Por eso, nada de
    donativos ni de contenido digital aquí. La app no recoge datos de tarjeta (van en la página del
    banco); las fichas de privacidad sí declaran el historial de pagos. Releer las dos normas antes de
    enviar a revisión, con pagos inventados en la cuenta demo.

## Estados

| Pantalla | Cargando | Vacío | Error | Sin conexión | Pendiente de subir |
|---|---|---|---|---|---|
| Pagos | Esqueleto de 3 tarjetas con cápsula e importe | `EmptyState`: «No tienes ningún pago» / «Cuando te apuntes a algo que cueste dinero, aquí verás lo que tienes pendiente, lo que se cobrará y lo pagado.» (con el nombre si es un hijo: «Lucía no tiene ningún pago») | «No se ha podido cargar» + Reintentar | Lo de la sesión en memoria con `SyncBadge`; si no hay, «Necesitas conexión para ver tus pagos» | No aplica (no hay cola); un intento en curso sale como «Comprobando el pago» |
| Ficha | Esqueleto | — | 403 o no existe: «Este pago ya no está disponible» / «Consulta el resto de tus pagos.» + «Ver mis pagos» | Igual que Pagos | — |
| Pagar | Esqueleto del resumen | `nothing_to_pay`: «No hay nada que pagar aquí» / «Lo que tengas pendiente de pagar está en Pagos.» | `not_payable`: «Este pago no está pendiente» / «Puede que ya esté pagado o que se cobre por domiciliación. Míralo en Pagos.»; `missing_payer_data`: «Te faltan datos para poder pagar» / «Necesitamos tu nombre, apellidos, correo y documento de identidad…» + «Completar mis datos» (plan 12, en el perfil de **quien paga**, no del hijo) | Botón desactivado y «Necesitas conexión para pagar» | — |
| Pasarela | `ComunicaTopProgress`; si no carga en 20 s o da error: «No se ha podido abrir la pasarela del banco» + «Reintentar» (intento nuevo) y «Abrir en el navegador» | — | Igual | Antes de abrir no se deja; si se cae dentro, la página del banco lo dice y «Cerrar» comprueba | — |

## Traducción del diseño

- **Igual que el plugin**: los tres bloques y sus títulos, la tarjeta de registro (cápsula de fecha,
  concepto, líneas, importe **a la derecha, grande, con cifras tabulares**), el chip solo en lo
  devuelto, la ficha con el importe como dato principal, el resumen de pago con «Paga», «Para» y
  «Cómo», y todos los textos citados.
- **Cambia por ser app**: cabecera nativa con título grande «Pagos» y el selector «¿A quién ves?» del
  plan 11; `SectionHeader` por bloque; deslizar para refrescar; la acción «Pagar con tarjeta» de cada
  tarjeta pendiente va al pie en estilo **secundario** (un solo principal por pantalla, `design.md`);
  en la ficha y en «Pagar», el principal va en `BottomActionBar` (por encima del teclado cuando se
  escribe otra cantidad); «Pagar otra cantidad» es un botón de texto que despliega el campo con
  `h.toggle`; el resultado se pinta en la misma pantalla «Pagar» (icono grande, título, texto, dos
  botones), sin `CelebrationBurst`: es dinero, no un logro. La pasarela, modal a pantalla completa
  sin barra de pestañas. En iPad y web, `PageContainer`; la lista no pasa a dos columnas.
- Importes con `accessibilityLabel` en palabras («35 euros»), la nota como `accessibilityHint` del
  campo, «Cerrar» de la pasarela con su etiqueta, todo ≥ 44 pt.
- **Skills**: `building-native-ui` (rutas, modal, `SectionList`), `heroui-native` (campo y botones),
  `animate-expo` («otra cantidad», paso a resultado), `make-interfaces-feel-better`; para revisar,
  `fixing-accessibility`, `baseline-ui`, `fixing-motion-performance` e `improve-ui` con capturas.

## Tareas

| # | Tarea | Cómo se comprueba |
|---|---|---|
| 1 | Contrato de §Datos en `contract.ts` y servidor falso (fixtures, intentos en memoria, sustitución, `simulated` solo en falso) | Tests del falso: bloques, 403 de otra familia, `not_payable`, `missing_payer_data`, `paid` tras «Pagar», `confirming` → `paid` tras N `check` |
| 2 | `utils/comunica/payments.ts`: bloques y orden, textos por caso (tabla de §Comportamiento 2), céntimos ↔ «35,00 €», leer el importe escrito, ¿cambió? | Unitarios |
| 3 | `utils/comunica/cardAttempt.ts`: máquina de estados, esperas del sondeo, leer la URL de vuelta, ¿es esquema externo? | Unitarios con cada transición |
| 4 | `pagos/index.tsx` con `PaymentCard` y los cinco estados | Test de pantalla con el falso; capturas a 375 px claro y oscuro |
| 5 | `pagos/[id].tsx` | Test: devuelto con y sin «pagable», tarjeta con nº de operación, cuenta enmascarada |
| 6 | `pagos/pagar.tsx`: resumen, otra cantidad, rebotes, sin conexión, doble toque | Tests de pantalla; captura con el teclado abierto |
| 7 | `pagos/pasarela.tsx` + `CardGatewaySheet` + `SimulatedGateway` (este en `components/comunica/pagos/`: pinta los botones, no importa el falso) | Test de la interceptación con URLs de vuelta, de banco y externas; captura de la simulada |
| 8 | Resultado, sondeo, invalidación de consultas, intento en curso en disco y retomarlo | Tests: los cuatro finales, cerrar a medias, app cerrada y vuelta |
| 9 | Reserva por el navegador: «Abrir en el navegador» en la hoja (`expo-web-browser`, `channel: 'browser'`, `pagos/vuelta.tsx`, y que `+native-intent.ts` del plan 10 deje pasar `mcmapp://comunica/pagos/vuelta`) | Test con `openAuthSessionAsync` simulado |
| 10 | Filas de §Enlaces en el mapa del plan 10 y las notas `msg=pagado` y de KO | Test del mapa |
| 11 | La ficha de la inscripción del plan 14 pasa a `pagos/pagar` (si dejó un `openLegacy` provisional, se quita) y usa `useCardAttempt` | Test del 14 actualizado |
| 12 | Guardarraíles (§Tests) | Fallan si se rompe la regla (probarlo una vez en local) |
| 13 | Revisión con las skills, capturas en iPhone, Android y iPad (build de desarrollo, con el servidor de verdad y el TPV en pruebas: confirmar antes `TPV_TEST`, que el 29/09/2026 estaba a 1, `EVENTOS.md` §10.2.1), nota de tiendas (regla 13) en `docs/`, sección de pagos en `docs/contratos/COMUNICA_API.md` y entrada en `mcm-app/CHANGELOG.md` | Revisión del propietario |

## Tests

- **Unitarios** (`__tests__/comunica/`): bloques y orden; `not_paid`/`not_remitted` nunca «ok»; «20,5»,
  «20,50», «20.50» → 2050 céntimos; «0,99», «abc» y vacío no valen; transiciones de `cardAttempt`
  (también «KO pero el CRM dice pagado» → pagado); URL de vuelta con `ok`, `ko` y basura.
- **De pantalla con el falso**: los bloques y la nota «Pago hecho»; ficha devuelta; rebotes de
  «Pagar»; las cuatro salidas de la pasarela simulada; reintentar crea un intento con `clientId`
  nuevo y paga el mismo pago; «Comprobando el pago» quita el botón en lista, ficha e inscripción;
  viendo a un hijo, solo sus pagos y «Para» desaparece.
- **Guardarraíles**: (1) nada de `['comunica', 'pagos', …]` llega al almacén (persistidor real); (2)
  el esquema de `PaymentDetail` no tiene ningún campo de cuenta salvo `accountMasked`, y el falso nunca
  devuelve un IBAN de más de 4 cifras visibles; (3) `CardGatewaySheet` no usa `injectedJavaScript`,
  `injectedJavaScriptBeforeContentLoaded` ni `onMessage` y lleva `incognito` (test sobre el fichero);
  (4) `simulated: true` con un servidor que no es el falso es un error; (5) `launchUrl`, `attemptId`
  y la URL de vuelta no aparecen en ningún `logger.*` (test con `logger` espiado); (6) ninguna ruta de
  pago se monta sin `source` (no hay donativo posible); (7) pagar nunca llama a `enqueueWrite`.

## Preguntas abiertas

- **Intento con vuelta OK que el CRM no cobra en 24 h.** El plugin lo cerraría como abandonado (no sabe
  de la vuelta). El plan pide al servidor **no cerrarlo y avisar** (§Datos 7). ¿De acuerdo, y a quién
  se avisa (correo de la delegación dueña o a quien mantiene)?
- **Pago doble** (dos intentos cobrados para el mismo pago): el plugin no lo detecta. ¿Quién devuelve
  el dinero y por dónde se avisa?
- **«Pagar otra cantidad» no tiene tope** en el plugin (vale 3.500 € por un 35 mal escrito; el banco
  enseña el importe antes de cobrar). Se queda 1:1 salvo que el propietario quiera un máximo.
- **«¿Ya lo has pagado? Tu delegación lo marcará en cuanto lo vea.»** solo sale en la inscripción; el
  plan la pone también en la ficha del pago (mismo caso). Para 1:1 estricto, se quita de la tarea 5.
