# 08 — Avisos y compartir

> **Estado:** 🟢 listo para ejecutar en `nuevoComunicaChulo` · **Depende de:** 01 · **Tamaño:** M ·
> **Índice:** [README.md](README.md)

## Para qué y para quién

Para **monitores**. Son los dos extras decididos para la primera versión
(`ANALISIS_AREA_PRIVADA_NATIVA.md` §10, `extras`):

1. **Avisos en el móvil.** Tres, y ninguno más: «¿Has pasado lista?» el día de la sesión, «Tienes N
   listas sin subir» y «Novedades en tu grupo» (un chaval nuevo, una baja). Hoy el área solo habla
   cuando alguien entra, y lo urgente se manda por WhatsApp a mano (F10 de las propuestas).
2. **Compartir un evento** con el texto ya escrito, con la hoja de compartir del sistema (F5), en los
   eventos que ve el monitor (plan 07).

Solo la parte de la app: el permiso, el registro del móvil en **nuestro** servidor, abrir la pantalla
correcta al tocar un aviso, el aviso local y el botón de compartir. Lo que manda el servidor va como
**requisitos** para su plan, sin diseñarlo. Fuera: avisos a familias, rellenar los topics de Firebase
con datos del CRM (análisis §7, «Identidad de verdad») y el puente `sticpa:share` de la WebView (F5
en el plugin; si se hace, que reutilice `buildEventShareMessage()`).

## Especificación de origen

| Qué | Dónde |
|---|---|
| Avisos: propuesta, riesgo («si se manda de más, la gente los desactiva para siempre») y el primero recomendado, la lista sin pasar | `comunicaAreaPrivada/docs/comunica/PROPUESTAS-FUNCIONALIDADES-2026-10.md` F10 |
| Compartir: texto, enlace público o de la ficha, campos | mismo documento, F5 |
| Página pública solo si el evento está publicado: `…/actividades/?e=<slug o id>` | `inc/stic-event-web.php` l. 58 y 229-234; `EVENTOS.md` §9.2 |
| La ficha del área como destino que sobrevive al login | `docs/ACCESO.md` §4.b; `CONTRATO-APP-WEBVIEW.md` §5 |
| Plazo de inscripción: el día de fin cuenta entero; sin fechas = abierta | `EVENTOS.md` §5.2 |
| Qué es una lista que falta | `PASAR-LISTA.md` §6.1 |
| Push de la app hoy: permiso, token Expo, listeners, rutas, campana | `docs/funcionalidades/NOTIFICACIONES.md`; `notifications/usePushNotifications.ts`; `services/pushNotificationService.ts`; `components/NotificationPermissionBanner.tsx` |
| Cómo manda el Panel: Expo Push, `channelId` de una lista cerrada de siete, `data.id`, topics | `docs/contratos/NOTIFICACIONES_CONTRATO.md` §1, §7 y §8 |
| El problema conocido de los canales | `docs/planes/BACKLOG.md`, fila «Roto y sin dueño» y §C.3 |

Lo que dice el código de la app y hay que respetar:

- **Un `channelId` que la app no declara no se entrega en Android**, y al arrancar la app **borra**
  los canales que no están en su catálogo (`notifications/androidChannels.ts`). La importancia de un
  canal no se puede cambiar después de crearlo. Es lo que dejó sin avisos con categoría a `production`.
- **Todo lo que llega en primer plano se guarda en la campana** (`saveReceivedNotificationLocally`),
  y al tocar se navega por `eventId` → `internalRoute` → centro de notificaciones.
- El permiso ya se pide al arrancar (`registerAndSaveToken`) y el token queda en caché
  (`getCachedPushToken()`). Hoy la app no programa ninguna notificación local.

## Pantallas y rutas

| Ruta | Qué |
|---|---|
| `app/(tabs)/comunica/yo/avisos.tsx` | «Avisos en este móvil»: estado del permiso, tres interruptores y «Ajustes del sistema». Se llega desde el menú de cuenta del área (junto a «Salir», plan 02) |
| La pantalla del evento del plan 07 | Este plan solo le añade el botón «Compartir» en la cabecera |
| Destinos al tocar un aviso | Portada `/(tabs)/comunica` (plan 04), marcar ese grupo en esa sesión (plan 04), ficha del grupo (plan 05). Las rutas exactas son las que creen esos planes; un test comprueba que existen |

Código nuevo: `utils/comunica/noticeRoutes.ts`, `outboxReminder.ts` y `eventShare.ts` (puros);
`services/comunica/devices.ts` y `localNotices.ts` (con su `.web.ts` vacío);
`hooks/comunica/useNoticePrefs.ts`; `components/comunica/ComunicaBackground.tsx`, que no pinta nada
(registro del móvil y aviso local) y se monta una vez en `app/_layout.tsx`.

Compartido que se toca, dicho en cada commit: `constants/notificationChannels.ts` y su test,
`notifications/usePushNotifications.ts`, `components/NotificationPermissionBanner.tsx`, una línea de
`app/_layout.tsx` y los dos documentos de notificaciones.

## Datos

```
POST   /v1/devices             DeviceRegistration → WriteResult   (alta o cambio; idempotente por deviceId)
DELETE /v1/devices/:deviceId   → 204                              (al salir)

DeviceRegistration { clientId, deviceId,        // UUID v4 del móvil, guardado con la sesión (session.ts)
  pushToken,                                    // ExponentPushToken[…]: el mismo proyecto de Expo que el Panel
  platform: 'ios' | 'android', appVersion,
  channels: { rollCall: 'comunica-listas', groups: 'comunica-grupos' },  // los que crea ESTE bundle
  prefs: { rollCallDue: boolean, groupChanges: boolean } }

ComunicaPushData { source: 'comunica', v: 1,    // el `data` de cada aviso, con zod en contract.ts
  id,                                           // 'comunica:<uuid>': no choca con los ids del Panel
  type: 'rollcall_due' | 'group_changed' | 'outbox_pending', groupId?, sessionId? }
```

Al evento del plan 07 se le añade `share: { url, kind: 'public' | 'area' } | null`, `place?` y
`registrationClosesOn?` (`YYYY-MM-DD`). La URL la calcula el servidor (la pública si el evento la
tiene; si no, la de la ficha del área): la app no sabe de slugs ni de `internalpage`.

- **Quién puede:** cualquiera con sesión registra su móvil; borrar, solo el suyo (`forbidden` si el
  `deviceId` es de otra sesión).
- **En el móvil:** el `deviceId`, con la sesión (se borra al salir); las preferencias, en
  AsyncStorage (no son sensibles). Nada de esto va a la caché de consultas.
- **Por la cola:** el alta, con `key: 'device'` (gana la última: un cambio de preferencias pisa al
  anterior). El borrado **no** va por la cola, que se vacía al salir: llamada directa con 3 s de tope,
  antes del `logout` del plan 02.
- **Servidor falso:** guarda los dispositivos en memoria y da 401 sin sesión. Mando nuevo en el panel
  secreto, **«Simular aviso»**: programa a 5 s una notificación **local** con el `data` de cada tipo y
  ids de los fixtures. Así se prueban los destinos sin servidor, también en el simulador de iOS (allí
  los push no llegan, los locales sí).

| Aviso | Lo manda | Por qué |
|---|---|---|
| «Tienes N listas sin subir» | **La app** (local) | Solo el móvil sabe qué hay en su cola |
| «¿Has pasado lista?» | **El servidor** | Solo él sabe si otro monitor del grupo ya la pasó o si la sesión cambió; un recordatorio local no se puede anular desde otro móvil |
| «Novedades en tu grupo» | **El servidor** | Las altas y bajas pasan en el CRM |

**Requisitos para el plan del servidor** (no se diseñan aquí):

1. Guardar los dispositivos. **Un `pushToken`, un dispositivo y una persona**: si llega con otro
   `deviceId`, el anterior se borra. Al cerrar o revocar una sesión, borrar sus dispositivos. Borrar
   los que Expo devuelva como `DeviceNotRegistered`.
2. Mandar por la Expo Push API, como el Panel, con el `channelId` que declaró el móvil en `channels`
   (nunca uno escrito a mano), `data` según `ComunicaPushData`, **sin `badge`** (pisaría el contador
   de la campana) y sin `categoryId`. Si el proyecto de Expo tiene la seguridad de push activada, hace
   falta su token de acceso como secreto del servidor.
3. **Ni nombres ni salud** en el título, el cuerpo o `data`: la pantalla bloqueada la ve cualquiera y
   el texto pasa por Expo, Apple y Google. Solo nombre del grupo, fecha y recuentos.
4. «¿Has pasado lista?»: a los monitores vigentes del grupo, una vez por sesión y grupo, **después**
   del fin de la sesión y solo si no hay lista (ni pasada ni «sin registro»), en grupos que pasan
   lista; nada entre las 22:00 y las 8:00 de Madrid. Texto: «¿Has pasado lista?» / «C1 · Los Peques,
   sábado 25 de octubre. Si ya la tienes en el móvil, ábrela y se sube sola.»
5. «Novedades en tu grupo»: altas y bajas de chavales en los grupos donde la persona es monitor,
   agrupadas (una al día por grupo como mucho). Texto: «Novedades en C1 · Los Peques» / «1 chaval
   nuevo y 1 baja».
6. Respetar `prefs`. Con las dos en `false`, no se manda nada a ese móvil.

## Comportamiento y reglas que no se pueden perder

**Permiso.** Se usa el de la app; no se pide otro. Si no está concedido, la portada del área (plan
04) pinta `NotificationPermissionBanner` con `placement="comunica"`: «Activa los avisos» / «Te
recordamos pasar lista y te avisamos si una lista no se ha subido.» Su descarte de 7 días lleva clave
propia (descartarlo en Inicio no lo esconde aquí). Denegado → «Abrir Ajustes», como hoy.

**Registro.** `ComunicaBackground` da de alta el móvil cuando hay sesión del área, permiso y token
(`getCachedPushToken()`; si no hay, antes `tryRegisterPushToken()`). Solo repite el alta si cambia
algo (token, preferencias, versión, `channels`): guarda una huella local. Al **salir** (plan 02):
`DELETE`, cancelar los avisos locales del área y borrar el `deviceId`. En web no se registra nada.

**Canales de Android.** Dos nuevos en el catálogo, marcados `source: 'comunica'` y sin categoría del
Panel, para que el Panel no pueda llegar a ellos por `category`:

| id | Nombre en ajustes | Descripción | Importancia |
|---|---|---|---|
| `comunica-listas` | Comunica · Pasar lista | Recordatorio de pasar lista y listas que no se han subido. | `high` |
| `comunica-grupos` | Comunica · Tus grupos | Chavales que llegan a tus grupos o se van. | `default` |

El color de la luz sale de `constants/colors.ts` (ni un hex nuevo). **Una vez publicados no se quitan
nunca**: si un bundle los quitara, la limpieza del arranque los borraría y el servidor seguiría
mandando a un canal que Android tira sin decir nada. Lo vigila un test. Como todo móvil que se
registra en nuestro servidor lleva un bundle que crea estos canales antes de registrarse, no se
repite lo de la 2.0.

**Al tocar un aviso** (rama nueva y primera en `usePushNotifications.ts`): si `data.source ===
'comunica'`, se valida con zod y decide `routeForComunicaNotice(data)`: `rollcall_due` → marcar ese
grupo en esa sesión; `group_changed` → ficha del grupo; `outbox_pending` → portada. Tipo o versión
desconocidos, o ids con forma rara → portada. **La app nunca navega a una ruta que venga en el
aviso.** El destino hace sus comprobaciones de siempre: sin sesión, el acceso del plan 02; fuera de
alcance, el 403 de `AreaState`. Con el área nativa apagada por el interruptor (plan 01), todo va a
`/(tabs)/comunica`, que es la WebView.

**No van a la campana.** Los avisos del área no se guardan en el historial de notificaciones, ni en
primer plano ni al tocar: son operativos y su sitio es la portada. En primer plano se invalidan las
consultas que tocan (`['comunica','today']`, `['comunica','groups',groupId]`) para que la pantalla
ya lo enseñe. Analítica: `notificacion_abierta` con `categoria: 'comunica'`, sin ids.

**El aviso local de listas sin subir:**

- Cuenta las entradas de la cola que son **listas** (de grupo, de evento y de monitores: planes 04,
  07 y 06) en `pending`, `failed` o `stuck`. Lo demás de la cola no cuenta.
- Al pasar la app a segundo plano con alguna, programa **uno** a los 60 min (si cae entre las 22:00 y
  las 8:30, a las 8:30), con identificador fijo `comunica-outbox` y canal `comunica-listas`. Se
  cancela al volver a la app, al vaciarse la cola y al salir.
- Textos: «Tienes 1 lista sin subir» / «Tienes 2 listas sin subir» + «Abre la app con cobertura y se
  suben solas.»; con alguna `stuck`: «Una lista no se ha podido subir» + «Ábrela para ver qué ha
  pasado.»
- Respeta su interruptor. No necesita servidor ni paquete nuevo: `expo-notifications` ya está.

**Compartir un evento** (F5):

- `Convivencia COM · sáb 15 y dom 16 de noviembre · Benicàssim · Apúntate hasta el 5 de noviembre: <url>`
- Fechas: un día, «sáb 8 de noviembre»; dos seguidos, «sáb 15 y dom 16 de noviembre»; más, «del vie
  31 de octubre al dom 2 de noviembre». El año solo si no es el actual. Nunca `01/07/2026`.
- El lugar, si lo hay. El plazo, solo si la inscripción está abierta y tiene fecha de fin, y **el día
  de fin cuenta entero** (`EVENTOS.md` §5.2): por eso «hasta el 5», no el «antes del 5/11» del
  ejemplo de F5, que le quitaría un día a la gente.
- `Share.share({ message })` con el enlace dentro del mensaje, igual en iOS y en Android. Sin `share`
  no hay botón. En web, `navigator.share` si existe; si no, se copia el texto (`expo-clipboard`) y un
  toast dice «Texto copiado».

## Estados

| Dónde | Qué se ve |
|---|---|
| Avisos — cargando | Esqueleto de tres filas mientras se lee el permiso |
| Avisos — permiso denegado | Banner con «Abrir Ajustes»; los interruptores apagados y explicados: «Primero activa los avisos en Ajustes» |
| Avisos — sin conexión / pendiente de subir | Los interruptores cambian al instante; el alta espera en la cola con su `UploadStatus` |
| Avisos — error | `UploadStatus` «No se ha podido» con Reintentar |
| Avisos — web | `EmptyState`: «Los avisos solo funcionan en la app del móvil» |
| Compartir | Sin `share` no se pinta; sin conexión funciona (el texto sale de lo guardado); si `Share` falla, toast «No se ha podido compartir» |

## Traducción del diseño

- **Igual que en el plugin:** el texto de F5, las fechas en lenguaje humano y el vocabulario («pasar
  lista», «chavales», «sin registro»).
- **Compartir** es un icono en la **cabecera nativa** (`IconSymbol` `square.and.arrow.up` en iOS,
  `share` en Android; se añade al mapeo si no está), de 44 pt y con `accessibilityLabel` «Compartir
  evento», que abre la hoja del sistema. Sobra el «Enviar por WhatsApp / Copiar» que F5 prevé para la
  WebView. La barra de abajo sigue siendo de la acción principal del evento, sin competir.
- **Avisos en este móvil:** `SectionHeader` y filas con el `Switch` de heroui (fuera de modales: dentro
  se ha llegado a pintar invisible), cada una con su línea de explicación en `body`, no en gris
  pequeño. Al pie, «Ajustes del sistema» (`Linking.openSettings`), donde Android enseña cada canal.
- Hápticos `h.toggle` en los interruptores y `h.tap` en compartir. Claro y oscuro a la vez;
  `fontScale` ×1,3 sin cortar.

## Tareas

| # | Tarea | Cómo se comprueba |
|---|---|---|
| 1 | Contrato: `DeviceRegistration`, `ComunicaPushData` y `share`/`place`/`registrationClosesOn` del evento; cliente y servidor falso de dispositivos | Tests de esquemas; el falso guarda, borra y da 401 sin sesión |
| 2 | Canales `comunica-listas` y `comunica-grupos` con `source`; ajustar `notificationChannels.test.ts`; en `NOTIFICACIONES_CONTRATO.md` §8, los dos ids reservados (el Panel no los usa) | Tests de canales; en un Android real, los dos canales en los ajustes |
| 3 | `devices.ts`, `ComunicaBackground` y `useNoticePrefs`: alta por la cola con huella, borrado al salir (enganche en el `logout` del plan 02) | Test con el falso: alta con sesión y sin repetir; borrado al salir; sin permiso no hay alta |
| 4 | `noticeRoutes.ts` y la rama `comunica` de `usePushNotifications.ts`: destino, fuera de la campana, invalidar consultas | Tests puros y test de que un aviso del área no entra en el historial |
| 5 | «Simular aviso» en el panel secreto (solo desarrollo y preview) | En el simulador, tocar cada tipo abre su pantalla |
| 6 | `outboxReminder.ts` y `localNotices.ts`: programar y cancelar el aviso local | Tests puros; test del gancho con `expo-notifications` simulado |
| 7 | `yo/avisos.tsx` y el `placement="comunica"` del banner | Capturas a 375 px en claro y oscuro: concedido, denegado y web |
| 8 | `eventShare.ts` y el botón en la pantalla del evento del plan 07 | Tests del texto; test de pantalla: el botón llama a `Share.share` con el mensaje |
| 9 | Sección del área en `NOTIFICACIONES.md`, `CHANGELOG.md` y el plan marcado en el README | Revisión |

## Tests

- **Puros** (`__tests__/comunica/`): `routeForComunicaNotice` con cada tipo, ids raros, tipo o
  versión desconocidos y área apagada; `outboxReminder` (solo listas, singular y plural, `stuck`, a
  las 21:50 → 8:30 del día siguiente); `buildEventShareMessage` (un día, dos seguidos, cambio de mes
  y de año, sin lugar, plazo pasado, hoy, futuro y vacío, enlace público y del área).
- **De pantalla, con el servidor falso:** `yo/avisos.tsx` concedido, denegado y sin conexión; alta y
  borrado del móvil; el botón de compartir.
- **Guardarraíles:** (1) cada ruta que puede devolver `routeForComunicaNotice` existe como fichero
  bajo `app/(tabs)/comunica/`; (2) `comunica-listas` y `comunica-grupos` siguen en el catálogo con su
  importancia, que no cambia; (3) `channelIdForCategory` nunca devuelve un canal del área; (4)
  `ComunicaPushData` no tiene campos de texto libre.

## Preguntas abiertas

1. **Nombres en los avisos.** El plan los deja fuera (solo grupo, fecha y recuentos), porque la
   pantalla bloqueada la ve cualquiera y el texto pasa por terceros. ¿Te vale «1 chaval nuevo», o
   quieres el nombre de pila?
2. **¿Dónde se ve quién ha llegado o se ha ido?** «Novedades en C1» abre la ficha del grupo (plan 05),
   que enseña quién está, no quién se fue. Para que el aviso de una baja sirva, la ficha necesitaría un
   bloque «Novedades» (altas y bajas de las dos últimas semanas) y el servidor tendría que dárselo.
   ¿Se añade al plan 05?
3. **El texto del plazo.** F5 pone «Apúntate antes del 5/11»; `EVENTOS.md` §5.2 y el código dicen que
   el día de fin cuenta entero. Va «hasta el 5 de noviembre», por el código. ¿Confirmas?
