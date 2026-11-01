# Pagos con tarjeta en la app y las tiendas (plan 15, regla 13)

> Nota para quien envíe la app a revisión. **Releer las dos normas antes de enviar**: cambian. Última lectura al escribir esto: 1/11/2026, de memoria del plan (no se han vuelto a abrir las páginas de Apple y Google); está pendiente de confirmar con ellas delante.

## Qué se cobra

Un **servicio físico que se consume fuera de la app**: una convivencia, un campamento, un encuentro, una cuota de actividades, la inscripción a un congreso. Nunca contenido digital, nunca un donativo, nunca una suscripción (sin pago ni inscripción no hay pantalla de pago: `PayScreen` sin `pago` ni `inscripcion` no pinta nada).

## Por qué no es una compra integrada

- **Apple**: App Store Review Guidelines **3.1.3(e)**, «Goods and Services Outside of the App»: los bienes y servicios que se consumen fuera de la app se pueden cobrar con medios distintos de la compra integrada.
- **Google Play**: la política de Pagos no exige su sistema de facturación para bienes y servicios físicos.

## Qué hace (y qué no) la app

- **No recoge datos de tarjeta.** El pago ocurre en la página del banco (Redsys), dentro de una hoja con WebView sin JavaScript inyectado, sin leer mensajes de la página, en incógnito y sin cookies compartidas.
- **No concluye «pagado» por su cuenta.** El estado sale siempre del servidor, que lo lee del cobro en el CRM; la vuelta del banco (`ok`/`ko`) solo se anota.
- **No guarda nada de Pagos en el móvil** (importes, conceptos, cuenta enmascarada, correo del pagador): memoria de la sesión. A disco solo va el intento en curso (id, perfil, de dónde sale, hora), sin importes, y se borra al terminar y al salir.
- Importes en céntimos, sin tope; más del doble de lo indicado pide confirmar («el 35 mal escrito»). Lo que se paga es lo que queda como pagado (un descuento, no un pago parcial).

## Fichas de privacidad

Declarar el **historial de pagos** (importes y conceptos de lo pagado por la persona), vinculado a la identidad, para funcionalidad de la app. Los datos de tarjeta **no** los recoge la app.

## Antes de enviar a revisión

1. Releer 3.1.3(e) y la política de Pagos de Google Play.
2. Cuenta demo con **pagos inventados** y la pasarela en modo pruebas (`TPV_TEST`: el 29/09/2026 estaba a 1, `EVENTOS.md` §10.2.1 del plugin; confirmar antes).
3. Revisar que el texto de la pantalla de pago dice qué se paga y que se hace en la página del banco.
4. El pago con tarjeta del servidor está **apagado por defecto** (`MW_FORM_SECRET`, `MW_CARD_FORM_URL`, `MW_PUBLIC_URL`): sin ellas, la app no puede arrancar un pago.
