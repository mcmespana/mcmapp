# Qué revisar y dudas abiertas de la app de familias

> Escrito el 1/11/2026, tras dejar en `main` los planes 11-16 (Izan) y el servidor completo, y tras mirar lo que había hecho David en paralelo. **Es la lista viva de lo que falta mirar**: al cerrar algo, se tacha aquí y se anota en el `CHANGELOG.md`. El detalle del servidor, en `comunicaMiddleware:docs/FASE3.md` y `docs/SIGUIENTE.md`.

## 1. Dónde está cada cosa (1/11/2026)

| Qué                           | Dónde                                                   | Estado                                                                                        |
| ----------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| App, planes 11-16             | `mcmapp` `main` (#358, #362, #363, #364)                | ✅ en `main`, CI en verde; **solo probado contra el servidor falso**                          |
| Servidor, planes 11-16        | `comunicaMiddleware` `main` (hasta #14)                 | ✅ en `main`; **15b (pagar con tarjeta) fusionado pero APAGADO** (sin variables no hace nada) |
| Lo de David                   | `mcmapp` rama `pantallitasDeDavid` y PR #365 (borrador) | Sin fusionar a propósito: ver §2                                                              |
| Área nativa para las familias | Laboratorio Alpha (`comunicaNativa`)                    | Apagada para el público                                                                       |

## 2. Lo que hizo David y cómo se compara

**Qué tiene** (rama `pantallitasDeDavid`, PR #365 en borrador; su propia descripción ya dice «no para fusionar tal cual»): los planes **11** (perfiles y portada), **12** (Mis datos) y **16** (documentos y calendario), hechos por otro camino. Del 13 dejó un borrador parado (`claude/familias-plan-13-borrador`); el 14 y el 15 no los empezó. Las ramas sueltas `claude/familias-plan-12`, `claude/familias-plan-16`, `claude/comunica-familias` y `plan11` son las piezas que luego juntó en `pantallitasDeDavid`.

**Si está mejor o peor.** En conjunto, **`main` está mejor**: cubre 13, 14 y 15 (que David no tiene), tiene más pruebas (942 en `__tests__/comunica` frente a 598), pantallas probadas con el falso también en el 16 (David no tiene pruebas de pantalla del 16) y deja las carpetas de `comunica` sin avisos de lint (la rama de David, 143 avisos, 0 errores). Comprobado: la rama de David pasa sus tests y `typecheck:tests`.

**Pero tiene piezas que van mejor que las mías** (hay que decidir cuáles traer, una a una, en PR pequeñas):

| Pieza de David                                                                                                | Por qué compensa                                                                                                                                                  | Lo mío hoy                                                                            |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| ~~**Calendario**: `SwipeableMonthCalendar` (deslizar de mes), dos paneles en iPad y web ancho~~               | ✅ Traído el 1/11 (PR `claudito/calendario-deslizable`): la rejilla de la pestaña Calendario con puntitos, leyenda y dos paneles; la Agenda sigue con sus flechas | Hecho                                                                                 |
| ~~**Portada con la agenda** (`home.ts`, `upcomingAgendaItems` pintado en `MemberHome`)~~                      | ✅ Hecho el 1/11 (`UpcomingAgenda`): «Próximas actividades» con hasta 5 filas y «Ver calendario»; en la rama de David solo estaba el hueco, no la agenda          | Hecho                                                                                 |
| **«Cambiar foto»** abre la página de «Mis datos» de la web con la sesión puesta                               | Funciona hoy, aunque el servidor aún no reciba fotos                                                                                                              | Pone «llegará pronto» y no hace nada                                                  |
| **Subida de documentos en curso** con `UploadStatus` arriba de la lista, «Reintentar» y «Descartar»           | Es lo que describe el plan 16                                                                                                                                     | Sube y vuelve atrás; si falla, el error sale en la pantalla de subir                  |
| **`FileTransport`** del cliente, con `.web.ts` (`blob:`) y `utiOf` + ancla de iPad al compartir               | Los archivos se abren también en web y el compartir sale bien en iPad                                                                                             | En web no se abre ningún archivo; sin UTI ni ancla                                    |
| **Motor declarativo** de formularios (`forms.ts`, `DeclarativeForm`, `personDetailsSpec.ts`) para «Mis datos» | Es lo que decidía el plan 12 (comprobar con un test que orden y textos son los del plugin)                                                                        | Lo hice a mano con las piezas del 09; orden y textos comprobados con tests, sin motor |
| **`useOpenDestination`**, que resuelve un `internalpage` a su ruta                                            | Para las bandas del calendario y los enlaces de la portada                                                                                                        | Cada pantalla lo resuelve con `nativeHrefFor`/`openLegacy`                            |

**Conflictos.** Fusionar `pantallitasDeDavid` en `main` da **40 ficheros en conflicto** (29 «add/add»: los mismos nombres, hechos dos veces: `perfiles/*`, `documentos/*`, `calendario/*`, rutas de `app/(tabs)/comunica/…`, `fake/profiles.ts`, `utils/comunica/profiles.ts`…), y **44 ficheros más que se fusionarían solos y dejarían dos implementaciones a la vez** (por ejemplo `useMyProfiles.ts` junto a mi `useActiveProfile.tsx`). **No se fusiona la rama entera.** Recomendado: dejarla como referencia y traer las piezas de la tabla en PR pequeñas, cada una con su test; cuando estén, borrar las ramas viejas (§5).

## 3. Cambiado en esta revisión

- **Certificados de monitor (plan 09): 6 MB → 4 MB.** La app dejaba subir hasta 6 MB y el servidor corta en 4 (`MAX_FILE_BYTES` de `document-write.ts`: lo que cabe en una función de Vercel): un certificado de 5 MB pasaba la comprobación de la app y fallaba después con `file_too_big`. Detectado al leer la nota de David. Ya dice 4 MB en la constante, los textos, el contrato y el falso.
- **Middleware: PR #14 (pagar con tarjeta) fusionado a `main`**, apagado por defecto.

## 4. Qué revisar (con una persona delante)

1. **Probar contra el CRM real** (`PRUEBAS-REALES.md` del servidor): lecturas, luego UNA escritura con una persona de prueba. Todo lo de familias se ha hecho con el CRM falso y MariaDB.
2. **Variables y migraciones en producción**: ¿están ya `MW_APP_SECRET` y `MW_AUTH_DB_URL`? (el 31/10 faltaban). Las migraciones `2026103*.sql` y `20261101_comunica_mw_intentos.sql`, en el Supabase de MCM.
3. **Pagar con tarjeta, antes de encenderlo**: revisión humana del código (mueve dinero y comparte la marca firmada con el plugin), TPV de pruebas (`TPV_TEST`; el 29/09 estaba a 1), `MW_FORM_SECRET` igual al `sticpa_form_secret` de WordPress, `MW_CARD_FORM_URL`, `MW_PUBLIC_URL`.
4. **Tiendas**: releer las normas de Apple (3.1.3(e)) y de Google Play; `PAGOS-TIENDAS.md` está escrito de memoria del plan.
5. **Seguridad**: revisión humana de `src/authz/`, `src/http/routes.ts`, `src/app/*-write.ts`, `src/app/profiles.ts` y `src/app/profile-*.ts` antes de abrir `/v1/` a usuarios reales.
6. **Pantallas**: ninguna de familias se ha visto en un móvil ni en el navegador con datos reales; faltan las capturas (375 px, claro y oscuro, letra grande). David tampoco vio las suyas del 12 y el 16.

## 5. Ramas que se pueden borrar (cuando quieras: no lo he hecho)

- Mías, ya en `main`: `claudito/familias-11-perfiles`, `-12-datos`, `-13-eventos`, `-14-inscripciones`, `-15-pagos`, `-15-pagos-fin`, `-16-documentos` y `claudito/revision-david-4mb` (al fusionarse). En el servidor: `claudito/fase3-*` y `claudito/fase2a-acceso`, `fase1-*`, `docs-pendientes`.
- De David, **después** de rescatar lo que valga: `pantallitasDeDavid`, `claude/familias-plan-12`, `claude/familias-plan-16`, `claude/familias-plan-13-borrador`, `claude/comunica-familias`, `plan11`.
- Antiguas sin relación: `wip/plan06-pantallas-a-medias`, `origin/preview` (se actualiza solo desde `main`).

## 6. Dudas abiertas (para decidir)

| #   | Duda                                                                                                                                                                                                                    | Quién decide            | Bloquea                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------- |
| 1   | ¿Qué piezas de David se traen y cuáles se descartan? (tabla del §2). Sugiero, por orden: (calendario deslizable y agenda en la portada ya están), «Cambiar foto» por la web, cola de subidas visible                    | Izan                    | No                            |
| 2   | ¿Se sube la foto desde la app? Hace falta `POST /v1/profiles/:pid/photo` (tope ~4 MB, recorte en el móvil o en el servidor: duda 12 de `FASE3.md`)                                                                      | Izan                    | No                            |
| 3   | Ficha pública de un evento **sin sesión** (`GET /v1/public/events/:slug`, dudas 18-19): hoy la app dice «Entra para apuntarte»                                                                                          | Izan                    | No                            |
| 4   | Clave de «anulado» del CRM y aviso por correo al revisar un pago con tarjeta (dudas 65 y 67 de `FASE3.md`; hoy solo una línea de registro)                                                                              | Izan / David            | Sí, para encender el pago     |
| 5   | ¿El secreto de Vercel y el de WordPress son el mismo? Si no, los intentos de cada lado no se terminan entre sí (duda 64)                                                                                                | David                   | Sí, para encender el pago     |
| 6   | **La tarea diaria `close-card-attempts` falla con 503 cada noche mientras el pago esté apagado** (lanza «no configurado»). Es ruido en el registro de Vercel, no daño. ¿La dejo como no-hacer-nada cuando está apagado? | Izan                    | No                            |
| 7   | Campos de `Documents` (`status_id`, `category_id`, `stic_shared_document_link_c`) y si `date_input` guarda la fecha (dudas 43 y 46; pregunta 6 del plan 16)                                                             | David (mirar en Studio) | No                            |
| 8   | Un documento subido desde el plugin con más de 4,5 MB no se podrá bajar desde la app (límite de respuesta de Vercel, duda 47)                                                                                           | —                       | No                            |
| 9   | «Parcial» y «justificada» se juntan con «Asististe» y «No asististe» (constante `JOIN_PARTIAL_AND_JUSTIFIED`). ¿Se mantiene?                                                                                            | Izan                    | No                            |
| 10  | Con menores de por medio, ¿se repite la evaluación de impacto de protección de datos?                                                                                                                                   | Izan                    | Sí, antes de abrir al público |
| 11  | «Abrir con…» para PDF en Android: llega con los paquetes nativos de la 2.2 (`expo-intent-launcher`); hasta entonces, la hoja de compartir                                                                               | —                       | No                            |
| 12  | Un hijo sin nombre sale como «Participante» en todas partes (decisión del plan 11: perder el acceso es peor que un nombre feo). ¿Vale?                                                                                  | Izan                    | No                            |
| 13  | Con el CRM real, ¿los estados de inscripción y los medios de pago son los que asumimos? (dudas 8, 9, 10, 17, 33 y 34 de `FASE3.md`)                                                                                     | David (probar)          | Sí, para abrir apuntarse      |

## 7. Firmas dentro de «Documentos» (anotado el 1/11/2026, sin diseñar; el propietario lo deja para el futuro)

Idea del propietario, para **la web y la app**: que se vean las firmas dentro de «Documentos». **Subidos** y **Por firmar** arriba, como cosas distintas; los **firmados** pasan a ser un documento más, ordenados por fecha y categoría. Lo que hay (módulo Firmas del CRM, `comunicaTools:docs/FIRMAS.md`), las preguntas abiertas (de dónde sale «por firmar», dónde queda el PDF firmado, tutor y menores, ruta nueva o campo `kind` en `/documents`) y dónde se hace, en `comunicaAreaPrivada:plans/044-firmas-en-documentos.md`. Toca la pantalla de Documentos (planes 16) y una lectura del middleware.

## 8. Marcas del propietario del 1/11/2026

Sábados de los monitores del MIC y rediseño del área nativa: **«Futuro»**. Las ramas viejas de David **no se borran** por ahora. Estados de inscripción y medios de pago, y el pago con tarjeta: **se hará** (con el CRM real). Revisión de seguridad, evaluación de impacto, `MW_CRM_*` y una escritura real: **hechas**.
