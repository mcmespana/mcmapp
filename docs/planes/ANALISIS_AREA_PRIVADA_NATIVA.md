# Área privada nativa — análisis de implicaciones

> **Qué es esto:** qué supone rehacer el área privada de Comunica como
> pantallas **nativas** de MCM App, con un **backend nuevo** que no sea el
> plugin de WordPress. Es un análisis, **no un plan: no se ejecuta.** El plan
> se escribe cuando estén tomadas las decisiones de §10 y después de la build
> 2.1/2.2. Las decisiones se marcan en la página
> <https://claude.ai/artifact/B3ABkV5CYJLUTo2hnWW8t5> (colección `decisiones`
> de su base de datos; se releen con la herramienta de datos del artefacto).
>
> Fecha: 2026-10-21. Repos mirados: `mcmapp`, `comunicaAreaPrivada`,
> `mcm-sinergia-mcp`, más el manual de SinergiaCRM y la infraestructura de
> Vercel y Supabase (solo lectura).

---

## 0. En diez líneas

1. **Lo lento no es la WebView: es esperar al CRM.** Una pantalla de monitores
   espera al CRM hasta 8 veces, ~350 ms cada vez, y recarga la página entera de
   WordPress. Guardar una lista son 8 esperas.
2. **Una app nativa que siga preguntando al CRM en directo seguiría siendo
   lenta.** La velocidad sale de no esperarle: una **copia propia** de los datos
   que hacen falta (espejo), puesta al día con el CRM cada pocos minutos, y una
   **cola** que sube por detrás lo que se escribe. Es justo lo que dejó previsto
   `comunicaAreaPrivada/docs/comunica/DECISION-BBDD-ESPEJO.md` para «una app
   nativa que quiera API propia».
3. La app guarda en el móvil lo último que vio: **abre al instante y pasa lista
   sin cobertura**. El monitor no ve nunca una rueda esperando al CRM.
4. Piezas: pantallas nativas · API propia · espejo + sincronizador · cola de
   escrituras al CRM · login. Más la convivencia con el plugin.
5. Dos cosas que se piden a SinergiaTIC lo simplifican mucho: un **usuario de
   solo lectura de la base de datos** del CRM (el manual dice que lo dan) y una
   **instancia clonada de pruebas** (`/TEST`). Hoy solo existe el CRM de
   producción.
6. Alcance recomendado: **primero monitores** (Pasar Lista, Mis grupos, fichas,
   coordinación). Las familias siguen en la WebView hasta una segunda fase.
7. El plugin se queda para la web. Cuando arranque lo nativo, lo nuevo de
   monitores se hace solo en nativo.
8. Lo más delicado: la sincronización (relaciones y borrados), la seguridad
   (la API es la única que filtra por delegación, rol y familia) y los datos
   de salud de menores en móviles de voluntarios.
9. Coste de infraestructura: ~25-50 €/mes. Esfuerzo: §11.
10. Calendario: después de la 2.1/2.2, en una rama aparte. Lo que tarda
    (peticiones a SinergiaTIC, protección de datos) se puede pedir ya (§13).

---

## 1. Por qué va lenta hoy

El área privada es PHP dentro de una página de WordPress (Astra + Elementor) en
un hosting compartido. Cada toque es una **recarga completa**, y cada pantalla
pide sus datos al CRM por la API v4.1 en el momento.

| Pantalla (monitores, un sábado normal) | Esperas al CRM | Solo esperando |
|---|---|---|
| Pasar Lista: portada | 3 | ~1 s |
| Marcar | 5 | ~1,8 s |
| **Guardar la lista** | **8** | **~2,8 s** |
| Ficha del participante | 5 | ~1,8 s |
| Primera lista de monitores de una reunión (14 sin inscribir) | ~22 (eran ~75) | ~8 s |

Cifras de la auditoría del 09/10/2026
(`comunicaAreaPrivada/plans/042-pulido-integral/auditoria-velocidad.md`),
contadas con los dobles de los tests en el modo real de esta instancia (sin
enlaces anidados); los lotes del 10-11/10 han quitado alguna. La de monitores,
de `docs/comunica/PASAR-LISTA-ESTADO.md` §1. Una espera son ~350 ms con
keep-alive; **la primera de cada página son ~1,9 s** porque abre la conexión TLS
(`plans/archive/027`). Además, la hoja de los formularios públicos iba en todas
las pantallas (+140 ms de pintado en un móvil medio, VEL-1).

Ya se ha exprimido lo barato: caché de 24 h/5 min, calentado nocturno, 6
llamadas en paralelo, tandas. Lo que queda es estructural: **el CRM está en el
camino de cada toque.**

## 2. Qué la hace rápida de verdad

```
HOY        App ─► WebView ─► WordPress ─► CRM      (1-8 esperas de ~350 ms por pantalla)

PROPUESTO  App (datos en el móvil) ─► API propia ─► Espejo (Postgres en la UE)
                 abre al instante        ~50-150 ms        ▲              │
                                                           │ cada pocos   │ cola de
                                                           │ minutos      ▼ escrituras
                                                           └──────── SinergiaCRM
```

- **Lectura:** la app pinta lo que tiene guardado y refresca por detrás contra
  la API, que lee del espejo (milisegundos, sin red externa).
- **Escritura:** la marca se guarda en el móvil (al instante), sube a la API
  (~100 ms) y queda en el espejo; una cola la sube al CRM con reintentos. El
  estado «pendiente de subir al CRM» se ve, no se esconde (la lección del plan
  033).
- **El CRM sigue siendo la fuente de la verdad.** El espejo es una caché con
  forma de tabla: se puede vaciar y reconstruir. Nada vive solo en el espejo
  salvo la cola, mientras no ha subido.

**La alternativa descartada** es una «pasarela» que pregunte al CRM en directo
(con tandas y caché). Es más simple, pero cada primera carga y cada guardado
siguen pagando al CRM, y si el CRM va lento o se cae, la app también. Vale para
pantallas de poco uso; no para Pasar Lista.

## 3. Las piezas que hay que construir

### 3.1 Espejo + sincronizador

- **Qué guarda:** solo lo que usan las pantallas nativas (ver Anexo A), no el
  CRM entero. Volumen: miles de filas, no millones (~12 delegaciones × ~20
  grupos × ~12 chavales).
- **De dónde lo lee — dos caminos:**
  - **Con usuario de lectura de la BBDD del CRM** (recomendado): SQL directo
    sobre las tablas, incluidas las de relaciones y las filas borradas. Una
    sincronización completa en segundos y la incremental por `date_modified`
    sin trampas. El manual de SinergiaCRM lo ofrece («SinergiaTIC puede
    proporcionar usuarios con derechos de lectura»), con acceso remoto al
    puerto de la BBDD; lo normal es que pidan una **IP fija** de origen.
  - **Solo por la API:** v4.1 con SQL en `query`, como el plugin. Funciona,
    pero las relaciones salen por consultas aparte, los borrados hay que
    buscarlos con `deleted=1`, y heredamos todas las trampas (§6). Más lento y
    más código.
- **Cuándo:** incremental cada 5-10 min, completa de madrugada, y «refrescar
  este grupo» bajo demanda. El CRM no avisa de cambios (no hay webhooks), así
  que siempre es por consulta.
- **Lo que escribe el propio backend** se refleja en el espejo en el mismo
  momento (no espera a la sincronización).

### 3.2 Cola de escrituras al CRM

- Cada escritura entra en una tabla `outbox` con su estado (`pendiente`,
  `subida`, `error`), intentos y último error.
- **Idempotente:** cada marca/lista lleva un id generado en el móvil; reintentar
  no duplica. (El plugin sufrió duplicados de inscripciones y asistencias: ver
  `PASAR-LISTA-ESTADO.md` §1.)
- Escribe por la **API v4.1** reutilizando lo aprendido en el plugin:
  importes sin «.00», el pago que nace sin persona, el `_ida` dentro del
  `set_entry`, tandas con `set_entries`.
- Errores visibles: «2 listas pendientes de subir al CRM» en la app y aviso a
  quien mantiene si algo lleva horas atascado.

### 3.3 API propia

- TypeScript. Es **la única puerta**: la app nunca ve credenciales del CRM ni
  de la base de datos.
- **Toda la autorización vive aquí**, igual que hoy en el plugin: el usuario
  técnico del CRM lo puede todo y los grupos de seguridad no filtran nada
  (`CLAUDE.md` de `comunicaAreaPrivada`). Delegación (`assigned_user_id`), rol,
  familia, propiedad de cada id, audiencia de eventos, permiso de salud.
- Un test-guardarraíl falla si un endpoint no pasa por la comprobación de
  sesión y de delegación (como `SecurityTest` en el plugin).
- Contrato escrito (OpenAPI o esquemas zod) del que la app saca sus tipos.

### 3.4 Login

Hoy hay cuatro puertas (`docs/ACCESO.md` del plugin): correo con enlace mágico
**y** código de 6 cifras en el mismo mensaje, DNI/NIE (manda el correo a la
dirección guardada), contraseña (`stic_pa_password_c`, en claro: SEC-03) y un
token permanente `?token=` sin caducidad.

Propuesta para nativo:

- **Correo o DNI → código de 6 cifras** (y el enlace, que abre la app: los
  enlaces universales de `comunica.movimientoconsolacion.com` ya están
  configurados en `app.json` y el plugin ya sirve `/.well-known/`).
- **Sesión larga** (meses) con token de refresco rotatorio en el almacén
  seguro del móvil; se puede revocar uno a uno. Bloqueo opcional con Face ID.
- **Sin contraseña ni token permanente.** SEC-03 no aplica a lo nativo.
- Los correos los manda el backend con Resend (ya lo usa el Guardián). Hoy
  salen con `wp_mail()` del hosting y caen en spam (`docs/email-entregabilidad.md`).
- Arreglo de paso: hoy, si dos fichas comparten correo, entra la primera. En
  nativo, tras el código, si hay varias se elige.
- Familias: tras entrar, la lista de perfiles (uno mismo + hijos por
  `stic_Personal_Environment`) como hoy.

### 3.5 La app

- **Dónde:** dentro de la pestaña `comunica`, que ya tiene ruta, hueco en la
  barra y entradas de catálogo. Un stack nativo propio, con el modelo de
  `mas.tsx`. Mientras convivan, la pestaña decide qué enseña: la parte nativa
  si el perfil o la delegación la tienen activada (`/profileConfig`), y la
  WebView para lo demás.
- **Datos en el móvil:** caché de consultas persistida y una cola de
  escrituras persistente que se reanuda al volver la red (p. ej. TanStack
  Query con persistencia; hoy la app no usa ninguna librería de este tipo). Los
  ids se generan en el móvil.
- **Lo sensible no va en AsyncStorage:** está sin cifrar y en Android tiene un
  tope de 6 MB. Base de datos local cifrada (`expo-sqlite` con SQLCipher) con la
  clave en `expo-secure-store`. Al cerrar sesión se borra todo.
- **Se reaprovecha de la app:** `hooks/useNetworkStatus.ts`,
  `components/OfflineBanner.tsx`, `utils/storageMutex.ts`, el patrón
  stale-while-revalidate de `hooks/useFirebaseData.ts`, `utils/logger`, Sentry,
  `utils/haptics.ts`, `expo-image` (fotos con caché en disco).
- **Diseño:** `design.md` (raíz) manda: nativo antes que custom (cabecera,
  buscador y pull-to-refresh del sistema), componentes aprobados
  (`AppTextField`, `AppPrimaryButton`, `SegmentedControl`, `EmptyState`,
  `SectionHeader`, `StatCard`, `PressableFeedback`), tokens, territorio
  institucional y su checklist (fontScale ×1,3, 44 pt, etiquetas de
  accesibilidad).
- **Web:** el mismo código correría en `mcm.expo.app` con react-native-web si
  la API acepta CORS y lo nativo queda fuera del grafo de web
  (`tabsLayoutWebSafety.test.ts`). De entrada, la web de la app sigue con el
  `<iframe>` al plugin.

Paquetes nativos nuevos (cada uno exige build de tienda): `expo-secure-store`,
`expo-sqlite` (con SQLCipher) y `expo-local-authentication`. Posibles más
adelante: `expo-image-picker` (fotos y documentos, fase de familias) y
`expo-background-task` (subir la cola con la app cerrada). `expo-notifications`,
`expo-camera` y el NFC ya están.

## 4. Qué hay que rehacer

La especificación completa son el código y los documentos del plugin
(`comunicaAreaPrivada/docs/comunica/`, con `PASAR-LISTA-README.md` de índice).
Esto es el mapa, por fases.

**Roles** (todos son `Contacts`; no hay usuarios de WordPress):

- **Familiar:** el lado B de un `stic_Personal_Environment` vigente
  (`father|mother|legal|carer`). Ve a sus hijos y paga.
- **Miembro:** cualquier marca de `stic_relationship_type_c` que no sea
  `familiar_menor`. No existe un rol «laico».
- **Monitor:** la marca `monitor`.
- **Coordinación y acompañamiento:** las marcas `coordinacion_mic_com` y
  `acompanamiento_mic_com` abren el menú; el alcance sale de sus relaciones
  vigentes en `stic_Contacts_Relationships` (etapa y segmento;
  `sticpa_pl_coord_scope()`). Son dos fuentes que pueden no coincidir.

**Fase 1 — monitores** (tamaño según el inventario del plugin):

| Pantalla | Qué hace | Tamaño |
|---|---|---|
| Pasar Lista: portada | Atajo a hoy, listas pendientes, evento de hoy, cola del móvil, reunión sin pasar | M |
| Árbol de grupos | Etapas y grupos, buscador, historial de sesiones | M |
| **Marcar y guardar** | 4 estados con motivo, «han venido todos», gesto largo, otra fecha, «sin registro», marcas del grupo, faltas seguidas. Escribe asistencias, inscripción si falta y la lista | **XL** |
| Ficha del participante | Contacto (WhatsApp según permiso), familia, asistencia, avisos 1-3, salud (con permiso), autorizaciones, pañuelo | L |
| Grupos y fichas | Por grupos, cursos y A-Z, fotos, globo de salud, «sin grupo», «Asignar grupos» | L |
| Resumen de grupos | Recuentos, tira de listas, datos por revisar, vincular a grupo | L |
| Lista de monitores | Sábado o reunión: todos en verde, se marcan las faltas | L |
| Reuniones | Estado y alta de reuniones | M |
| Coordinación («Tu equipo») | Reunión pendiente, listas, directorio por etapa, monitores sin grupo | M |
| Ficha del monitor y seguimientos | % de sábados, reuniones, grupos, «en regla», incidencias/valoraciones/acompañamiento | L |
| **Pasar lista en un evento** | Eventos de hoy y del curso, por etapa y curso, otras delegaciones aparte, «no van» | **XL** |
| Grupos de actividad | Pestañas (patrullas, habitaciones…) y pasar lista por grupo | M |
| Mis datos de monitor | Formación, trayectoria, certificado de delitos sexuales, títulos | M |

**Fase 2 — familias y miembros:** portada, elegir participante, mis datos,
datos del familiar (FAM-02 pendiente), eventos y su ficha (el cuerpo sale del
renderizador compartido `inc/eventos-cuerpo.php`, que habría que portar),
inscribirse (alta corta o formulario web avanzado del CRM), mis inscripciones,
pagos, documentos y calendario. El **pago con tarjeta** es Redsys a través del
formulario web del CRM: en nativo se abre en el navegador del sistema
(`expo-web-browser` ya está) y se vuelve a la app. Al ser un servicio físico
(una actividad), las tiendas permiten pagarlo fuera de la app.

**No se rehace:** usuario y contraseña, el token permanente, la
administración de WordPress (tokens en lote, «entrar como») y los procesos
nocturnos (siguen en GitHub Actions).

**Volumen** (inventario del plugin, fechas distintas): ~150 grupos en todo el
CRM; Castellón, ~2.000 relaciones, 210 participantes vigentes y 32 monitores;
~165 monitores en total; ~24 sesiones por etapa y curso.

## 5. Reglas que no se pueden perder

Las que ya cumple el plugin y el backend nuevo tiene que llevar en tests desde
el primer día:

- **La seguridad es nuestra.** El usuario técnico lo ve todo: cada consulta se
  filtra a mano por la delegación de quien entra (`assigned_user_id`,
  `sticpa_pl_delegation()`). Nada interdelegacional.
- **Con la base de datos de lectura, ni siquiera queda el filtro de los grupos
  de seguridad.** Hoy el usuario técnico de la API no alcanza los registros
  asignados a «Administrador MCM» (`PASAR-LISTA-CAMPOS-CRM.md`, entorno
  personal de Solete). Leyendo las tablas, aparecerán. Puede ser bueno (datos
  más completos), pero lo que se enseña lo decide la API, no el CRM.
- **Propiedad de cada id** que llegue en una petición (`sticpa_user_owns_record()`);
  cambiar de perfil solo a uno mismo o a sus hijos; lista negra de campos
  (`id`, `deleted`, `assigned_user_id`, credenciales, token).
- **Alcance de coordinación y acompañamiento** por sus relaciones vigentes
  (etapa y segmento; sin ellos, toda la delegación).
- **Lo que se crea va asignado a la delegación**; lo de un evento, al
  `assigned_user_id` del evento (plan 041).
- **No se cachea lo que no se ha podido resolver** (rol vacío, «no tiene
  hijos» porque el CRM no contestó: plan 040).
- **Vigencia:** fin vacío o `0000-00-00` = vigente.
- **Pasar Lista:** los chavales empiezan sin marcar y guardar sin marcas no
  escribe; «sin registro» = lista `omitida`; los monitores empiezan en verde y
  se escribe `yes`; nunca una asistencia sin inscripción; no se reescribe lo
  que no cambia; no se pasa lista de sesiones futuras; porcentajes sobre
  sesiones celebradas (el de un monitor, con 4 marcas o más); racha = 3 faltas
  seguidas; avisos numerados y nunca con fecha futura.
- **Seguimientos:** incidencias y valoraciones las escribe coordinación y las
  leen coordinación y acompañamiento; las de acompañamiento, solo
  acompañamiento; nadie ve las suyas.
- **Privacidad:** WhatsApp al menor solo con `ajmcm_menorwhatsapp_c`; foto y
  salud dan 403 (no 404) fuera de la delegación; **el texto de salud nunca va
  a la caché del móvil**, solo la clave «salud» (`MIS-GRUPOS.md`); IBAN
  enmascarado; un permiso vacío no es un «no».
- **Fase 2:** audiencia de eventos (ámbito, perfil y curso a la vez; ante la
  duda no se esconde), plazos, y todo lo del dinero (`EVENTOS.md` §10, plan
  041).

## 6. Trampas del CRM que hereda el backend

Con la base de datos de lectura desaparecen las de **lectura**; las de
**escritura** siguen (las escrituras van por la API). Detalle en
`PASAR-LISTA-ESTADO.md` §3 y `CAMPOS.md` del plugin.

- **Lectura:** `get_relationships` no trae los enlaces anidados (hay que pedir
  el campo plano `…_ida`); filtrar por un `…_ida` da 400 en varios módulos;
  `max_results=0` corta en 20 y `total_count` puede ser −1; pedir un campo que
  no existe tumba la consulta; los vacíos no llegan; los borrados no se ven;
  textos con entidades HTML; fechas en UTC sin zona.
- **Escritura:** los errores llegan como un 200 con `{number,name}` (`11` =
  sesión caducada); los enlaces van dentro del `set_entry` en su campo plano;
  importes sin «.00»; el pago que genera el CRM nace sin persona; una fecha ISO
  con zona se ignora y se guarda la hora actual; `set_entries` sin respuesta no
  se reintenta para no duplicar.
- **La API no valida los desplegables:** las claves salen de `CAMPOS.md`.

**Dudas que el inventario encontró en la documentación del plugin** (conviene
cerrarlas antes del plan; no se ha elegido ninguna): `ajmcm_dirigido_a_c`
(`CAMPOS.md` dice etapas, el código espera tipos de relación);
`ajmcm_notificado_el_c` (`CAMPOS.md` lo da por creado, el código dice que no);
claves sin confirmar de `LIS_listas.estado` y `stic_FollowUps.type`; al
guardar «Mis datos» se manda `0` en los consentimientos sin marcar, que
convierte un «sin contestar» en un «no»; y `EVENTOS.md` §10.4,
`PASAR-LISTA-SEGUIMIENTOS.md` y `PASAR-LISTA-RECUENTOS.md` §5 van por detrás
del código.

## 7. Implicaciones para la app (`mcmapp`)

- **Calendario de versiones.** `main` va por la 2.1.0 (sin publicar todavía:
  falta compilar, probar los canales de Android y las fichas de privacidad,
  `docs/desarrollo/BUILD_AGOSTO_2026.md`); las tiendas siguen en la 2.0.0. La
  2.2 (noviembre-diciembre, `BACKLOG.md` §C-bis) lleva los widgets de Contigo y
  App Check. Lo nativo empezaría después.
- **La rama aparte no molesta a la publicación.** Un push a `main` no publica
  nada; la OTA de producción solo sale con push a `production` y la de preview
  con push a `preview`. Una rama larga (p. ej. `area-privada-nativa`) se prueba
  con builds de desarrollo de EAS hechas desde ella, o mergeándola a `preview`
  como se hace con el cantoral.
- **Para que la rama no se pudra:** código nuevo en carpetas propias, tocar lo
  mínimo de lo compartido y mergear `main` cada semana. Choques casi seguros:
  la cabecera del CHANGELOG, `firebase-seed/profileConfig.json`,
  `constants/tabsCatalog.ts`, `app.json` y `package-lock.json`.
- **Paquetes nativos en la 2.2.** La runtime es una cadena fija (`"2.1.0"`):
  un binario compilado antes no tiene los paquetes que se añadan después. Si
  `expo-secure-store`, `expo-sqlite` y `expo-local-authentication` entran en la
  2.2 sin usarse (como se hizo con el NFC el 19/10), cuando lo nativo esté
  listo puede salir **por OTA** a la 2.2, sin esperar otra build de tienda.
- **Piloto con interruptor.** `/profileConfig` ya admite overrides
  `perfil:delegación`, así que se puede encender en una sola delegación. Ojo:
  valida contra los `KNOWN_*` del bundle, así que el código tiene que llegar
  antes que el interruptor.
- **Identidad de verdad.** Hoy el perfil (familia/monitor/miembro) y la
  delegación se los declara cada usuario en el onboarding y nadie los
  comprueba; tampoco hay vínculo entre la cuenta Google/Apple de la app y su
  ficha del CRM. Con el área nativa la app sabe quién es de verdad: puede
  rellenar perfil y delegación (y los topics de push) con datos del CRM.
- **Delegaciones: hacen falta equivalencias.** La app usa slugs propios (14
  locales + `mcm-espana` + `internacional`); el CRM usa `assigned_user_id`, y
  además `ajmcm_procendencia_c` (con `madird` [sic]) y `ajmcm_delegacion_c`
  con otras claves (`vilareal`). A la app le faltan Ciutadella, Huétor, Reus y
  Tortosa. No hay tabla que los una: hay que hacerla.
- **Tiendas.** Las fichas de privacidad (App Store y «Seguridad de los datos»
  de Google Play) tendrán que declarar datos de contacto y de salud vinculados
  a la persona. La 2.1 las está rellenando ahora: buen momento para dejarlas
  previstas. Durante la revisión de Apple el panel ya quita Comunica de las
  pestañas; con lo nativo, igual, o una cuenta demo con datos ficticios.
- **Firebase no se toca.** El área nativa no guarda nada en Firebase (sus
  reglas nuevas siguen sin desplegar: razón de más para no meter ahí datos de
  menores). `comunica-gestion` (la WebView al propio CRM, para gestores) sigue
  igual.
- **Misma vara de calidad:** typecheck estricto, lint sin warnings nuevos,
  tests guardarraíl (`docs/planes/PLAN_CALIDAD.md` §0), y tests de contrato
  contra la API.

## 8. Implicaciones para el plugin y la web

- **El plugin se queda.** Sirve la web: familias desde el navegador,
  monitores desde el ordenador, el formulario de inscripción del CRM y el TPV.
  En la app, lo nativo sustituye a la WebView por fases y lo no migrado sigue
  en WebView.
- **Doble mantenimiento mientras convivan.** Cada novedad de monitores en el
  plugin es una más que copiar en nativo. Por eso se propone (§10) que, en
  cuanto arranque lo nativo, lo de monitores en el plugin pase a solo arreglos.
  El plan 043 no se ve afectado: va antes.
- **Escrituras que hace el plugin «al leer».** Ver Pagos rellena
  `banking_concept`; ver una inscripción reclama los pagos con tarjeta y cierra
  los intentos abandonados. Mientras las familias sigan en la web, lo sigue
  haciendo el plugin. Si algún día migran, pasan a tareas programadas del
  backend.
- **Guardián Nocturno y cumpleaños** (GitHub Actions del plugin) siguen igual:
  escriben recuentos en el CRM, avisan y calientan la caché de la web. El
  backend nuevo no los necesita.
- **`CAMPOS.md` sigue siendo la fuente de la verdad** de los campos, y los
  documentos de Pasar Lista son la especificación funcional. Hay que seguir
  manteniéndolos.
- **Se reabre una decisión cerrada, a sabiendas.** En julio de 2026 se decidió
  «WebView y sin backend propio» (`docs/archivo/decision-plataforma-app.md` del
  plugin). Lo que ha cambiado: Pasar Lista existe, es lo más usado en el móvil
  y es lo que más sufre al CRM.

## 9. Infraestructura: lo que ya hay y lo que haría falta

**Lo que ya hay** (mirado el 21/10/2026, solo lectura):

| Pieza | Estado | Qué supone aquí |
|---|---|---|
| Supabase, org «MCM Developers» | Plan **gratis**, 2 proyectos (`mcmbank`, `mcmvotaciones`) en `eu-central-1`; creada desde la integración de Vercel | El gratis admite 2 proyectos activos: uno nuevo exige Pro, o una organización aparte |
| Vercel, equipo «MCM Developers» | 11 proyectos, entre ellos `mcp-sinergia` (el MCP). Plan no visible; todo apunta a Hobby | Hobby es para uso personal no comercial y sus crons son diarios: no vale para el sincronizador |
| Firebase `mcmapp-39b71` | RTDB + Auth; functions en `us-central1` con Node 20 | No relacional, fuera de la UE y con las reglas nuevas sin desplegar: no es sitio para el espejo |
| GitHub Actions del plugin | Guardián (00:30 UTC) y cumpleaños (06:00 UTC), API V8 + Resend | Se retrasan 20-27 min y GitHub los apaga a los 60 días sin actividad: no valen para sincronizar cada pocos minutos |
| Resend | Ya en uso (avisos del Guardián, cumpleaños) | Sirve para los códigos de acceso |
| Clientes del CRM en TS/JS | MCP `lib/sinergia/` (V8, ~980 líneas) y `.github/scripts/guardian/crm.mjs` (V8, reintenta 429/5xx) | Se copian auth, cliente y errores (~530 líneas). **Ninguno habla v4.1**: ese cliente se escribe nuevo, con `inc/stic-class-6.php` como especificación |

Mismo patrón que **MCM Bank**: Next.js + Supabase en `eu-central-1`, con un
MCP que guarda sus tokens con hash y se pueden revocar uno a uno. El de
SinergiaCRM no (un solo secreto compartido).

**Lo que haría falta:**

- **Postgres en la UE:** proyecto nuevo de Supabase en `eu-central-1`.
- **Dónde corre la API:** Supabase Edge Functions (misma región que la base de
  datos, sin otra factura) o un Next.js en Vercel con plan Pro.
- **Tareas programadas:** `pg_cron` de Supabase.
- **Si SinergiaTIC exige IP fija** para leer su base de datos: el sincronizador
  va en un servidor pequeño con IP fija (Fly.io, Hetzner…).
- **Un usuario técnico del CRM propio**, con permisos mínimos. No se comparte
  con el plugin ni con el MCP: así se audita por separado y un cambio no rompe
  al otro.
- **Correo:** Resend, con el dominio ya verificado.
- **Sentry:** un proyecto para el backend.

| Concepto | €/mes aprox. |
|---|---|
| Supabase Pro (organización aparte con un proyecto) | ~25 |
| (si se sube de plan la organización actual, sus 3 proyectos pagan cómputo) | (~45) |
| Servidor con IP fija, solo si SinergiaTIC lo exige | ~5 |
| Vercel Pro, solo si la API va en Vercel | ~20 |
| Resend (gratis hasta 3.000 correos/mes), Sentry (plan actual) | 0 |
| **Total** | **~25-50** |

Precios de memoria (no consultados hoy): confirmar antes de contratar.

## 10. Decisiones

**Ya decidido por el propietario** (mensaje del 21/10/2026): backend nuevo
desde cero (no el plugin, por velocidad), en una rama muy separada, y después
de la 2.1/2.2.

**Pendientes**, con su recomendación. Se marcan en la página de decisiones
(<https://claude.ai/artifact/B3ABkV5CYJLUTo2hnWW8t5>); el id es el documento
de la colección `decisiones`:

| id | Pregunta | Recomendación |
|---|---|---|
| `alcance` | ¿Qué va nativo primero? | Monitores; familias siguen en la WebView hasta la fase 2 |
| `velocidad` | ¿De dónde sale la velocidad? | Copia propia (espejo) + cola de escrituras |
| `sinergiatic` | ¿Qué se pide a SinergiaTIC? | Las dos cosas: usuario de lectura de la BBDD e instancia `/TEST` |
| `almacen` | ¿Dónde viven los datos y el servidor? | Supabase, proyecto nuevo en la UE (Pro) |
| `repo` | ¿Dónde vive el código del servidor? | Repo nuevo; del MCP se copia el cliente, no se comparte |
| `login` | ¿Cómo se entra? | Código por correo (o DNI), sesión de meses, sin contraseña |
| `offline` | ¿Qué funciona sin cobertura? | Pasar lista y ver mis grupos |
| `salud` | ¿Salud sin cobertura? | Solo la marca, como hoy; el detalle con conexión |
| `extras` | Extras nativos en la primera versión | Avisos push y Face ID; lo demás después |
| `plugin` | ¿Qué pasa con el plugin? | Se queda para la web |
| `congelar` | ¿El plugin sigue creciendo en monitores mientras tanto? | Solo arreglos desde que arranque lo nativo |
| `paquetes` | ¿Paquetes nativos en la 2.2? | Sí, sin usarlos todavía |
| `piloto` | ¿Cómo se lanza? | Piloto con una delegación y vuelta a la web |
| `tecnicas` | Lo técnico que se da por hecho (abajo) | Vale |

**Lo técnico que se da por hecho** (se puede vetar en la tarjeta `tecnicas`):
TypeScript en todo; toda la autorización en un módulo de la API con test
guardarraíl; escrituras al CRM por la API v4.1 con lo aprendido en el plugin;
cada escritura con id propio para que reintentar no duplique; la app abre con
lo guardado y refresca por detrás, y lo sensible va cifrado; un usuario técnico
del CRM nuevo, solo para esto; el diseño y los componentes de `design.md`;
Sentry en la app y en el servidor.

## 11. Esfuerzo

Orden de magnitud, en semanas de trabajo con agentes y con el propietario
revisando y probando. Se afina en el plan.

| Bloque | Semanas |
|---|---|
| Backend base: repo, esquema, cliente v4.1, sincronizador, cola, login, autorización | 6-9 |
| App base: navegación, datos en el móvil, cola, login, bloqueo | ~2 |
| Pasar Lista: portada, árbol, marcar y guardar | 2-3 |
| Ficha del participante y Grupos y fichas | 1,5-2 |
| Coordinación, monitores, reuniones y seguimientos | 2-3 |
| Pasar lista en eventos y grupos de actividad | 1,5-2 |
| Piloto con una delegación y ajustes | 2-3 |
| **MVP de monitores** | **~17-24 (4-6 meses)** |
| Fase 2: familias y miembros | +8-12 |

- Sin usuario de lectura de la BBDD, el sincronizador por API suma 2-3
  semanas y es la parte más frágil.
- Lo que más pesa no es escribir pantallas: es que el backend y la
  sincronización estén bien antes de que se vea nada. Por eso la prueba
  técnica de §13 va antes del plan.
- Referencia: en julio de 2026 se estimaron 2-3 meses solo para lo de
  familias, con WordPress de backend y sin espejo ni modo sin conexión
  (`docs/archivo/decision-plataforma-app.md` del plugin).

## 12. Riesgos

| Riesgo | Qué lo frena |
|---|---|
| **Un fallo de autorización enseña datos de otra delegación o de otra familia** | Toda la autorización en un solo módulo de la API; test guardarraíl que falla si un endpoint no la usa; tests por rol con datos de dos delegaciones; revisión de seguridad antes del piloto |
| **El espejo se queda rancio o incompleto** (relaciones, borrados) | Usuario de lectura de la BBDD; reconciliación completa cada noche; «actualizado hace N min» visible; «refrescar» bajo demanda |
| **Escrituras que no llegan al CRM y nadie se entera** | Cola con estado visible, reintentos, idempotencia y aviso si algo lleva horas atascado |
| **Datos de salud de menores en móviles de voluntarios** | Decisión explícita (§10), cifrado, bloqueo, borrado al salir, evaluación de impacto |
| **Doble mantenimiento plugin + nativo** | Fases cortas; congelar lo de monitores en el plugin al arrancar |
| **La rama larga diverge de `main`** | Carpetas propias, merge semanal de `main`, paquetes nativos pronto (2.2) |
| **No hay CRM de pruebas** | Pedir `/TEST`; si no llega, una delegación de prueba con datos ficticios en el real |
| **Carga sobre el CRM** | Con la BBDD de lectura, casi ninguna; por API, incremental y con concurrencia limitada |
| **SinergiaTIC actualiza el CRM y cambia algo** | `CAMPOS.md` + tests de contrato contra `/TEST` |
| **Proveedor nuevo y su coste** | El espejo se reconstruye desde el CRM; es Postgres estándar, se puede mover |

## 13. Lo que se puede adelantar ya (sin plan)

Nada de esto toca la 2.1/2.2 ni escribe código de producción:

1. **Tomar las decisiones** de la página de §10.
2. **Pedir a SinergiaTIC** (foro de soporte) el usuario de lectura y la
   instancia `/TEST`. Es lo que más tarda y no depende de nosotros. Borrador:

   > Hola. Somos el Movimiento Consolación para el Mundo (instancia
   > `movimientoconsolacion.sinergiacrm.org`). Estamos preparando una app
   > móvil para nuestros monitores que necesita leer datos del CRM con
   > agilidad. Querríamos pedir dos cosas:
   > 1. Un usuario de **solo lectura** de la base de datos de nuestra
   >    instancia, como explica la página «Información para
   >    desarrolladores». ¿Con qué condiciones (IP de origen fija, conexión
   >    cifrada, qué tablas)?
   > 2. Una **clonación de nuestra instancia en `/TEST`** para hacer pruebas
   >    sin tocar los datos reales.
   >
   > Gracias.

3. **Protección de datos.** Hablar con quien lleve el RGPD: evaluación de
   impacto (datos de menores y de salud con una tecnología nueva), contrato de
   encargado con el proveedor (Supabase), registro de actividades y aviso de
   privacidad.
4. **Paquetes nativos en la 2.2**, si se decide así.
5. **Tabla de equivalencias de delegaciones** (CRM ↔ app), §7.
6. **Prueba técnica**, en cuanto haya `/TEST` o usuario de lectura, en el repo
   del backend y sin tocar la app: sincronizar una delegación entera y medir
   cuánto tarda; escribir una lista de asistencia de punta a punta por la
   cola; comprobar que reintentar no duplica (crear con id propio,
   `new_with_id` en v4.1).
7. **Mantener al día** `CAMPOS.md` y los documentos de Pasar Lista: son la
   especificación.

---

## Anexo A. Borrador del espejo

Punto de partida: la fase 3 de `DECISION-BBDD-ESPEJO.md` del plugin (pensada
para `wpdb`, se migra «casi tal cual»). Cada tabla del espejo lleva `crm_id`
(clave), `date_modified`, `deleted` y `synced_at`. Los campos, los de
`CAMPOS.md`; nada inventado.

| Tabla | Del CRM | Para qué |
|---|---|---|
| `delegaciones` | usuarios de delegación (`assigned_user_id`) | Filtrar todo; equivalencia con el slug de la app |
| `personas` | `Contacts` (solo los campos que se pintan) | Chavales, monitores, familias. Salud: solo un booleano |
| `salud` | campos de salud de `Contacts` | Aparte; solo con conexión y con permiso; nunca a la caché del móvil |
| `entornos` | `stic_Personal_Environment` | Familia: quién es tutor de quién |
| `grupos` | `ajmcm_GRUPOS` | Árbol, segmentos, `ajmcm_pasar_lista_c` |
| `relaciones` | `stic_Contacts_Relationships` | La pieza central: persona-grupo-papel-vigencia |
| `eventos`, `sesiones` | `stic_Events`, `stic_Sessions` | Sábados, reuniones, eventos |
| `inscripciones`, `asistencias` | `stic_Registrations`, `stic_Attendances` | Lo que se marca |
| `listas` | `LIS_listas` | El acto de pasar lista (`pasada`/`omitida`) |
| `avisos`, `seguimientos` | `AVI_avisos`, `stic_FollowUps` | Ficha del participante y del monitor |
| `grupos_actividad` | `GAC_grupos`, `GAC_miembros` | Pestañas del evento (solo lectura) |

Tablas propias: `sync_estado` (por tabla: último `date_modified`, última
pasada completa, errores), `outbox` (la cola: tipo, carga, estado, intentos,
último error, quién, cuándo, ids del CRM al subir), `sesiones_app` (tokens de
refresco con hash, dispositivo, `revocado_en`), `codigos_acceso` (hash,
intentos, caducidad) y, si se decide, `auditoria` (quién abrió la salud de
quién).

## Anexo B. Borrador de la API

Solo para dar idea del tamaño; el contrato de verdad se escribe en el plan.

```
Acceso      POST /acceso/codigo        (correo o DNI → manda código + enlace)
            POST /acceso/verificar     (→ tokens + perfiles: uno mismo e hijos)
            POST /acceso/refrescar · POST /acceso/salir
Yo          GET  /yo                   (persona, roles, delegación, alcance, permisos)
Monitores   GET  /monitor/hoy          (grupos, sesiones de hoy, pendientes, reunión)
            GET  /grupos · GET /grupos/:id          (chavales, monitores, marcas)
            GET  /grupos/:id/sesiones?desde=        (sesiones + listas + asistencias)
            PUT  /sesiones/:id/grupos/:g/lista      (marcas; idempotente; → pendiente_crm)
            GET  /personas/:id/ficha · GET /personas/:id/salud (no se cachea)
            POST /personas/:id/avisos
Coordinac.  GET  /coordinacion/equipo · /resumen · /reuniones
            PUT  /sesiones/:id/lista-monitores · POST /reuniones
            GET  /monitores/:id · POST /monitores/:id/seguimientos
Eventos     GET  /eventos/hoy · GET /eventos/:id/pasar-lista · PUT …/lista
Estado      GET  /sync/estado (última sincronización, cola) · POST /sync/refrescar
Fase 2      /familia/perfiles · /eventos · /inscripciones · /pagos · /documentos
```
