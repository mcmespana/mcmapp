# Área privada nativa — planes de la app (front)

> **Qué es esto:** los planes para construir en MCM App, en nativo, **toda el
> área privada de Comunica**: monitores (04-09) y familias y miembros (11-16),
> **1:1 en funcionalidad**, partiendo de su diseño y bien adaptada a nativo. Lo
> que está desactivado en el plugin no se hace; lo poco que sea muy complicado
> salta a la web del plugin dentro de la app, con la sesión puesta y sin que se
> note (plan 10). Ejecutarlos es construir el área entera. Solo la app: el
> servidor va en un repo propio (`mcm-comunica-api`, por crear) y tendrá sus
> planes aparte.
>
> **Cómo convive con la de hoy (plan 10):** con el modo alpha encendido se ve
> la nueva; en modo normal, la WebView de siempre, que pasa a ser **el
> legado**. Cualquier enlace de Comunica abre la app en la pantalla que toca.
> Análisis y decisiones: [`../ANALISIS_AREA_PRIVADA_NATIVA.md`](../ANALISIS_AREA_PRIVADA_NATIVA.md)
> y la página <https://claude.ai/artifact/B3ABkV5CYJLUTo2hnWW8t5> (colección
> `decisiones`).
>
> **Rama: `nuevoComunicaChulo`** (decisión del propietario, 21/10/2026). Todo
> lo de aquí se hace en esa rama, que se mantiene viva hasta que salga. No se
> abre PR a `main` sin que el propietario lo pida.
>
> **Cuándo se ejecuta:** cuando el propietario lo diga. Escritos el 21 y el
> 22/10/2026, antes de la 2.2, para adelantar trabajo. Como lo nuevo solo se ve
> en modo alpha, el código puede llegar a los probadores mergeando la rama a
> `preview`, sin tocar `main`.

---

## Por qué se puede hacer el front sin tenerlo todo decidido

Las decisiones del servidor (`ipfija`, `almacen`, `tecnicas`) la app no las
nota: **la app solo habla con un contrato**, y detrás de él el servidor
puede leer el CRM por SQL, por la API o desde un espejo. Así que el front se
construye entero contra un **servidor falso** dentro de la propia app (plan
00), con datos inventados, y el día que exista el servidor de verdad se cambia
una variable.

Lo que sí afecta al front ya está decidido: alcance (todo, monitores primero), sin cobertura
(pasar lista y grupos), salud (solo la marca), login (código, con el correo de
la cuenta ya puesto), extras (avisos y compartir), lanzamiento (para todos, con
vuelta atrás). Y los detalles de pantalla, también (tabla de abajo).

**El riesgo de adelantarse** es pequeño: si al construir el servidor el
contrato necesita un retoque, se cambia en un sitio (`services/comunica/contract.ts`)
y el typecheck señala todo lo que toca.

---

## Decisiones: todas contestadas (24/10/2026)

Las 31 tarjetas tienen respuesta. Copia con la tabla completa y los
comentarios en [`decisiones/`](decisiones/README.md) (la página sigue siendo la
fuente: si el propietario cambia algo allí, se refresca la copia). Lo que
cambia cosas de la app, ya aplicado en cada plan:

| Tarjeta | Respuesta | Dónde |
|---|---|---|
| `diseno` | Traducción pantalla a pantalla, «pero todo full nativo bien hecho» | 03 |
| `territorio` | Territorio «Comunica»: acento violeta `#6c4b9e` («azul morado, más morado») y degradado solo en la acción principal | 03 §2, 04, 05 |
| `dni` | Contestar igual que con el correo | 02 |
| `futuras` | Como el plugin: se marca hoy, la próxima si no ha empezado ninguna, y las reuniones futuras | 04, 06, 07 |
| `desmarcar` | Quitar una marca guardada la borra también en el CRM | 04 |
| `salud-no` | Sí: la ficha enseña la salud aunque la familia dijera «no» (la marca y el globo, no) | 05 |
| `alcance-coord` | La suma de sus relaciones; acompañamiento igual, monitores sin grupo incluidos | 06 |
| `marcas-autobus` | Sí, como en las listas de grupo | 07 |
| `avisos-nombres` | Nombre de pila e inicial: «Lucía H.» | 08 |
| `fotos-documentos` | Sí: `expo-image-picker` entra en la 2.2 (y el texto del permiso de cámara) | 09, 12, 16 |
| `equipo-hijo` | Sí: lo del equipo se ve siempre | 11 |
| `docs-con-plaza` | Sí: con plaza o con audiencia | 13 |
| `aviso-pagos` | Delegación dueña del pago, con copia a la oficina técnica | 15 (servidor) |
| `tope-importe` | Sin tope, pero el importe se lee bien (comas, puntos, miles) y avisa si es más del doble | 15 |
| `calendario-marcas` | Como el plugin (se juntan) | 16 |
| `campos-crm` | Que lo mire Claude en el CRM y lo apunte en `CAMPOS.md` del plugin | 12, 14, 16 |

Del servidor (no tocan la app): `velocidad` = pasarela primero, espejo si
hace falta; `almacen` = Neon, aunque el propietario sigue pensando (quizá
Supabase en un VPS); `ipfija` = servidor pequeño con IP fija si SinergiaTIC
la pide (está mirando un VPS de Hostinger; parece que no la piden); `repo` =
repo nuevo.

**Ojo con el código ya hecho (04 y 05):** se escribió el 23-24/10 sin estas
respuestas. Lo que hay que cambiar está en [`ESTADO.md`](ESTADO.md).

---

## Orden

| Plan | Qué | Depende de | Tamaño |
|---|---|---|---|
| [`00-contrato-y-servidor-falso.md`](00-contrato-y-servidor-falso.md) | El contrato de la API (esquemas zod), el vocabulario y un servidor falso con datos inventados | — | M |
| [`01-cimientos.md`](01-cimientos.md) | Rutas dentro de la pestaña, interruptor nativo/WebView, cliente, caché en el móvil, cola de escrituras, estados de pantalla, guardarraíles | 00 | L |
| [`02-acceso.md`](02-acceso.md) | Entrar con código (correo ya puesto), DNI, enlace mágico, perfiles, salir | 00, 01 | M |
| [`03-traduccion-del-diseno.md`](03-traduccion-del-diseno.md) | Catálogo de pantallas del plugin y reglas para traducirlas a la app | — (en paralelo con 00-02) | M |
| [`04-pasar-lista.md`](04-pasar-lista.md) | Portada, árbol de grupos, marcar y guardar | 00, 01, 03 | XL |
| [`05-grupos-y-fichas.md`](05-grupos-y-fichas.md) | Grupos y fichas, ficha del participante | 00, 01, 03 | L |
| [`06-coordinacion.md`](06-coordinacion.md) | Resumen de grupos, lista de monitores, reuniones, «Tu equipo», ficha del monitor y seguimientos | 04, 05 | L |
| [`07-eventos.md`](07-eventos.md) | Pasar lista en un evento (el autobús) y grupos de actividad | 04 | L |
| [`08-avisos-y-compartir.md`](08-avisos-y-compartir.md) | Avisos en el móvil y compartir un evento | 01 | M |
| [`09-mis-datos-de-monitor.md`](09-mis-datos-de-monitor.md) | Formación, trayectoria, certificado y títulos | 01, 03 | M |
| [`10-enrutador-enlaces-y-legado.md`](10-enrutador-enlaces-y-legado.md) | Modo alpha → nueva, normal → legado; salto a la web con sesión; cualquier enlace de Comunica abre la app donde toca | 00, 01, 02 | L |
| [`11-portada-y-perfiles.md`](11-portada-y-perfiles.md) | Portada de familias y miembros, «¿A quién ves?» y cambio de hijo | 00-03 | M |
| [`12-mis-datos.md`](12-mis-datos.md) | Mis datos y «Datos de» cada hijo, foto, salud, consentimientos | 01, 03, 11 | L |
| [`13-eventos-y-ficha.md`](13-eventos-y-ficha.md) | «Para apuntarte», «Te has apuntado» y la ficha del evento | 01, 03, 11 | L |
| [`14-inscripciones.md`](14-inscripciones.md) | Inscribirse (alta corta), mis inscripciones, modificar y cancelar | 13 | L |
| [`15-pagos.md`](15-pagos.md) | Pagos y arrancar un pago con tarjeta desde la app | 11, 14 | L |
| [`16-documentos-y-calendario.md`](16-documentos-y-calendario.md) | Documentos (ver, subir, borrar) y calendario con asistencia | 01, 03, 11 | M |
| [`17-varias-delegaciones.md`](17-varias-delegaciones.md) | La delegación de trabajo: quien colabora con otra delegación la elige (plugin, 23/10) | 01, 04, 05, 06 | M |

### Estado (28/10/2026)

> Lo que falta **en orden** (arreglos de la revisión del 24/10 antes que planes
> nuevos) está en [`ESTADO.md`](ESTADO.md). Esta tabla dice qué hay de cada plan.

| Plan | Estado |
|---|---|
| 00 | ✅ Hecho: contrato (compartido + Pasar Lista), cliente, servidor falso con mandos, selector, `COMUNICA_API.md`. Los mandos viven en el **Laboratorio Alpha** («Comunica nueva»), no en `SecretPanelModal` (que es el editor de canciones) |
| 01 | ✅ Hecho: carpeta `comunica/` con puerta y legado, `ComunicaAreaProvider` (consultas, sesión, caché guardada POR PERSONA sin la salud, cola), `useAreaQuery`/`useMe`, `outbox.ts` (gana la última, mismo `clientId`, atascada a los 5, sube al encolar/reconectar/volver/abrir), borrador por lista, estados de pantalla y guardarraíles. Desde el 28/10, los cajones van a **SQLite cifrado** (`nativeStores.ts`; AsyncStorage solo en web o sin el paquete) y la cola se apaga al salir (`dispose`). Falta el panel de diagnóstico |
| 02 | ✅ Hecho: contrato y falso del acceso (código `123456`, dos fichas, límites, enlace), `session.ts` (acceso en memoria, refresco que rota, 401 → refresca y repite, revocada sin borrar la cola), pantallas «Entra en tu área» (correo de la cuenta ya puesto / DNI), código de 6 casillas, «¿Quién eres?» y «Tu cuenta» con «Salir». Enlace `acceso_app` hecho con el plan 10. Desde el 28/10, el refresco del servidor de verdad va al **llavero** (`expo-secure-store`, en la 2.1) |
| 03 | 🟡 Hecho: componentes de §4, página `muestra` y **territorio decidido y aplicado** (A, 24/10: acento violeta `#6c4b9e` en `ComunicaColors` de `constants/colors.ts`, degradado solo en la acción principal; commit `9fe7211`). **Falta**: el catálogo de pantallas (tarea 1) y revisar el territorio con capturas |
| 04 | 🟡 Hecho (commit `bc924d1`, arreglos `11420d6` y `edcb622` del 24/10): portada completa (cola del móvil, evento de hoy, atajo, «Te faltan N listas», otros grupos, por etapa, evento/resumen, coordinación, precarga), árbol con buscador, historial, marcar (selector de fecha, hoja de estados con motivo, «Sin registro», rachas, accesibilidad) y guardar con cola, borrador y comprobación de lo releído; decisiones `desmarcar` (borrar) y `futuras` (como el plugin) aplicadas. **Falta**: anillo de la pulsación larga y su pista, buscador de cabecera nativo, tests de pantalla, y lo que liste [`ESTADO.md`](ESTADO.md) |
| 05 | 🟡 Hecho (commits `9b66ff6`, `4db00e9`, `b6c09df`, `68da56a`; `salud-no` aplicada el 24/10 en `33c22c5`: la ficha enseña la salud, la marca de las listas no): Grupos y fichas (tres vistas, chips, buscador, «Asignar grupos»), un grupo, «Sin grupo» con «Vincular», hoja de salud y la ficha entera; marcar abre la ficha con la sesión; salir vacía las fotos. **Falta**: buscador nativo de cabecera, enlace a la ficha del monitor (plan 06), tests de pantalla con `screenSmoke`; preguntas 2 y 3 siguen como el plugin |
| 06 | ✅ Hecho (28/10): Coordinación con «Tu equipo» (Sin grupo, Apoyo, por etapa, otros plegados), buscador de cabecera y «Vincular»; Resumen de grupos (tarjetas por etapa, tiras, qué listas faltan, datos por revisar); lista de monitores (modo `monitors` de la fila y la hoja del 04, una por etapa, filas opcionales «-» de Apoyo y otros grupos, cola y relectura); reuniones y «Nueva reunión»; ficha del monitor con sus tres pistas, grupos, histórico, papeleo y seguimientos (sin guardar en el móvil). Bloque de «Hoy» y enlace desde los monitores de un grupo. Los cambios del plugin del 23-25/10 están aplicados; la delegación de trabajo va en el plan 17. **Falta**: revisarlo en un dispositivo |
| 08 | ✅ Hecho (28/10): registro del móvil en nuestro servidor por la cola (`ComunicaBackground` en la raíz, baja al salir con `addBeforeSignOut`), canales `comunica-listas` y `comunica-grupos` (no se quitan nunca, con test), la rama `comunica` de las notificaciones (fuera de la campana, destino decidido por la app), aviso local de listas sin subir, «Avisos en este móvil» en «Tu cuenta», el banner de permiso en la portada, «Simular aviso» en el Laboratorio y compartir un evento (`eventShare.ts` + `ShareEventButton`). **Falta**: montar el botón en la cabecera de la pantalla del evento (plan 07) y probarlo en un dispositivo |
| 10 | ✅ Hecho: enrutador de tres estados (tipo, seed, `PANEL_PERFILES.md`), `links.ts` con el mapa de todas las páginas del plugin y su validación, `+native-intent.ts` (todo el dominio a la pestaña; el legado sigue recibiendo `acceso_magico` y destino; la nativa canjea el token con `exchange`, pregunta si el enlace es de otra persona, abre la pantalla nativa o el legado con pase), `openLegacy` + `web.tsx` con cabecera nativa e interceptación, `intentFilters` de Android con los prefijos (**para la 2.2**) y, en el plugin (rama `nuevoComunicaChulo`, **sin desplegar**), el `apple-app-site-association` con todo el dominio. Al hacer cada pantalla nativa, se registra en `NATIVE` de `links.ts` |

> **Builds con datos inventados**: el perfil `production` de `mcm-app/eas.json`
> ya **no** lleva `EXPO_PUBLIC_COMUNICA_API=fake` (se quitó el 24/10/2026: en
> `main` el área de producción no debe encenderse sin servidor de verdad, y lo
> vigila `__tests__/comunica/easProfiles.test.ts`). Para una build de TestFlight
> que enseñe el área nativa con el servidor falso:
> `npm run eas:build:ios -- --profile production-comunica-falso`. Ojo: va por el
> canal `production`, así que la siguiente OTA de producción le cambia el bundle
> por uno sin servidor falso. El canal preview (Laboratorio Alpha) ya hornea
> `fake` en su OTA.

00 → 01 → 02 → 10 van en fila. 03 puede ir a la vez. Después, 04-09
(monitores) y 11-16 (familias) se pueden repartir entre varias sesiones,
porque cada uno vive en sus carpetas; dentro de familias, 11 va primero.

**Construir el área entera** = ejecutar estos 18 planes y, aparte, los del
servidor. Lo que el plan del servidor tiene que dar sale de la sección «Datos»
de cada uno (`docs/contratos/COMUNICA_API.md`, plan 00 tarea 7).

---

## Reglas comunes (valen para todos los planes)

### Dónde va el código

| Qué | Dónde |
|---|---|
| Rutas | `app/(tabs)/comunica/` — carpeta con `_layout.tsx` (Stack), como `contigo/`. Sustituye a `app/(tabs)/comunica.tsx` (plan 01) |
| Pantallas por bloque | Equipo: `pasar-lista/`, `grupos/`, `coordinacion/`, `eventos/`, `yo/` (cuenta, avisos y datos de monitor). Familias: `perfiles.tsx`, `datos/`, `actividades/`, `inscripciones/`, `pagos/`, `documentos/`, `calendario/`, `archivo.tsx`. Todo bajo `app/(tabs)/comunica/` |
| Componentes | `components/comunica/<bloque>/` y `components/comunica/comun/` |
| Hooks | `hooks/comunica/` |
| Contrato, cliente, cola, sesión, servidor falso | `services/comunica/` (`contract.ts`, `client.ts`, `outbox.ts`, `session.ts`, `fake/`) |
| Lógica pura (reglas de pasar lista, porcentajes, rachas, fechas) | `utils/comunica/` — sin React, con tests |
| Tests | `__tests__/comunica/` |

Carpetas propias = menos choques con `main` en una rama larga. Lo compartido se
toca lo mínimo y cada vez que se toca, se dice en el commit.

### Vocabulario

El glosario de `00` es obligatorio: un concepto se llama igual en el contrato,
en el código y en la pantalla. Identificadores en inglés (como el resto de la
app), textos de pantalla en castellano y con las palabras del área privada
(«chavales», «pasar lista», «sin registro»…).

### Datos

- **Todo pasa por el cliente de `services/comunica/`.** Ninguna pantalla hace
  `fetch` ni importa el servidor falso (lo comprueba un test, plan 01).
- Lecturas con TanStack Query: clave `['comunica', bloque, ...]`, persistida en
  el móvil salvo lo marcado `persist: false` (la salud, siempre).
- Escrituras de **monitores (04-09)** por la **cola** (`outbox.ts`): se guardan
  en el móvil al instante, suben solas y la pantalla enseña su estado. Nada de
  esperar con una rueda.
- Escrituras de **familias (11-16)**: **directas, con conexión**, con
  `clientId` (el mismo en los reintentos de una acción), **nunca por la cola**:
  datos personales, salud, IBAN y archivos no tocan el disco. Lo de familias
  funciona con conexión (decisión `offline`); la caché solo abre rápido.
- **Familias: todo cuelga de `/v1/profiles/:pid/…`** (plan 11) y las claves
  llevan el `pid`. `persist: false` en lo sensible: datos y salud (12), la
  ficha de una inscripción (14), pagos (15) y documentos (16).
- **Conciliado con el código (24/10):** las claves que citan los planes son
  la final (`['comunica', …]`); en el código se pasa sin `'comunica'`, que lo
  pone `areaKey` de `useAreaQuery`. Cada ruta nueva va al registro de rutas de
  `contract.ts` (con su `persist`), y cada pantalla nativa se registra en
  `NATIVE` de `services/comunica/links.ts` con las filas de su tabla
  «Enlaces que llegan aquí» (hay un test que recorre `PLUGIN_PAGES`). Los
  mandos del servidor falso viven en el Laboratorio Alpha (`ComunicaLabPanel`).
- **Datos inventados** en el servidor falso y en los tests: nombres, teléfonos
  y delegaciones ficticios. Nunca datos reales del CRM, y menos de menores.

### Estados de cada pantalla

Toda pantalla resuelve cinco estados con los componentes de `01`: cargando
(esqueleto, no rueda), vacío (`EmptyState`), error (con «Reintentar»), sin
conexión (datos guardados + «actualizado hace N min») y pendiente de subir.

### Diseño

`design.md` de la app manda, y `03` dice cómo se traduce el área privada:
componentes de `design.md` §7, cabecera y buscador nativos, `PressableFeedback`,
hápticos con `h.*`, `useTabScroll` para que la barra flotante no tape nada,
claro y oscuro a la vez. El listón: moderna, cómoda, rápida, sencilla y que se
adapte (iPhone, Android, iPad y web).

**Skills** (si la sesión las tiene; las de la app están en
`mcm-app/skills-lock.json` y las de UI en el `skills-lock.json` de la raíz):

| Para | Skill |
|---|---|
| Construir pantallas con Expo Router y lo nativo | `building-native-ui` |
| Componentes de heroui-native | `heroui-native` |
| Movimiento y gestos | `animate-expo` |
| Pulido final | `make-interfaces-feel-better` |
| Revisar cada pantalla antes de darla por hecha | `fixing-accessibility`, `baseline-ui`, `fixing-motion-performance` |
| Repaso de un bloque entero con capturas | `improve-ui` |

Una pantalla no está hecha hasta que ha pasado por las de revisión y por el
checklist de `design.md` §10.

### Especificación funcional

La de cada pantalla es el plugin: sus documentos (`comunicaAreaPrivada/docs/comunica/`)
y su código (`pages/`, `inc/`). Cuando el documento y el código no coincidan,
manda el código y se dice. Los campos del CRM, los de `CAMPOS.md`; el front no
ve nombres del CRM, solo los del contrato.

### Cómo se trabaja y se verifica

- Un commit por tarea, en castellano, estilo `feat(comunica): …`. Merge de
  `main` en la rama cada semana.
- Antes de cada commit: `npm run typecheck && npm run typecheck:tests && npm run lint && npm test`
  desde `mcm-app/`. Ni un warning nuevo (`docs/desarrollo/WARNINGS.md`).
- **El área corre en web con el servidor falso**, para poder capturarla desde
  una sesión en la nube (`npx expo export --platform web` + Playwright, a 375 px
  y en claro y oscuro). Las pantallas se miran, no se suponen
  (`design.md` §10). En dispositivo, con build de desarrollo, cuando el
  propietario pueda.
- Paquetes nativos: `expo-secure-store`, `expo-sqlite` (SQLCipher),
  `expo-local-authentication`, `expo-intent-launcher` (abrir PDF en Android,
  plan 16) y `expo-image-picker` (`fotos-documentos`) entran en la **2.1**
  (PR #349, 28/10) y ya están en esta rama. Se cargan detrás de adaptadores
  (`services/comunica/nativeStores.ts` y su `.web.ts`; un test lo vigila). Si un plan necesita otro, para y
  pregunta. Los JS puros (TanStack Query, zod) se
  añaden sin preguntar.
- No se toca nada del CRM ni del plugin desde estos planes, salvo el
  `apple-app-site-association` del plan 10 (hecho en la rama del plugin, sin
  desplegar).
- Al terminar un plan, se marca hecho en esta tabla con fecha y commit.
