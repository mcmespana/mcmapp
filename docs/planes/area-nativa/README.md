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

Las decisiones que faltan (`ipfija`, `tecnicas`) son del servidor, y la app no
las nota: **la app solo habla con un contrato**, y detrás de él el servidor
puede leer el CRM por SQL, por la API o desde un espejo. Así que el front se
construye entero contra un **servidor falso** dentro de la propia app (plan
00), con datos inventados, y el día que exista el servidor de verdad se cambia
una variable.

Lo que sí afecta al front ya está decidido: alcance (todo, monitores primero), sin cobertura
(pasar lista y grupos), salud (solo la marca), login (código, con el correo de
la cuenta ya puesto), extras (avisos y compartir), lanzamiento (para todos, con
vuelta atrás). Lo de front que sigue abierto (tabla de abajo) son detalles de
pantalla: cada plan dice qué hace mientras tanto y dónde cambiaría.

**El riesgo de adelantarse** es pequeño: si al construir el servidor el
contrato necesita un retoque, se cambia en un sitio (`services/comunica/contract.ts`)
y el typecheck señala todo lo que toca.

---

## Lo que sigue abierto (🔒, en la página de decisiones)

Ninguna bloquea empezar 00-03. Cada plan dice qué hace mientras tanto.

| Tarjeta | Pregunta | Afecta a |
|---|---|---|
| `diseno` | Cómo se traduce el diseño (recomendado: pantalla a pantalla) | 03 |
| `territorio` | De qué color va el área nativa (y los colores del pañuelo, avisos y segmentos) | 03, 04, 05 |
| `dni` | Si un DNI no existe, ¿se dice? | 02 |
| `futuras` | ¿Se pasa lista de un día que aún no ha llegado? (mientras, no) | 04, 06, 07 |
| `desmarcar` | Quitar una marca guardada, ¿la borra en el CRM? | 04 |
| `salud-no` | Si la familia dijo «no» a la salud, ¿la ficha la enseña? | 05 |
| `alcance-coord` | Qué ve quien coordina o acompaña varias etapas | 06 |
| `marcas-autobus` | Marcas del grupo en la lista del autobús | 07 |
| `avisos-nombres` | Nombres de chavales en los avisos del móvil | 08 |
| `fotos-documentos` | Fotos con la cámara para títulos (paquete nuevo en la 2.2) | 09 |

Antes de ejecutar un plan, se leen las respuestas de la página (colección
`decisiones`) y se aplican.

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

### Estado (24/10/2026)

| Plan | Estado |
|---|---|
| 00 | ✅ Hecho: contrato (compartido + Pasar Lista), cliente, servidor falso con mandos, selector, `COMUNICA_API.md`. Los mandos viven en el **Laboratorio Alpha** («Comunica nueva»), no en `SecretPanelModal` (que es el editor de canciones) |
| 01 | ✅ Hecho: carpeta `comunica/` con puerta y legado, `ComunicaAreaProvider` (consultas, sesión, caché guardada POR PERSONA sin la salud, cola), `useAreaQuery`/`useMe`, `outbox.ts` (gana la última, mismo `clientId`, atascada a los 5, sube al encolar/reconectar/volver/abrir), borrador por lista, estados de pantalla y guardarraíles. **Pendiente de la 2.2**: cambiar AsyncStorage por `expo-sqlite` en `storage.ts` (`setStorageBackend`). Falta el panel de diagnóstico |
| 02 | 🟡 Hecho: contrato y falso del acceso (código `123456`, dos fichas, límites, enlace), `session.ts` (acceso en memoria, refresco que rota, 401 → refresca y repite, revocada sin borrar la cola), pantallas «Entra en tu área» (correo de la cuenta ya puesto / DNI), código de 6 casillas, «¿Quién eres?» y «Tu cuenta» con «Salir». Enlace `acceso_app` hecho con el plan 10. **Falta** `expo-secure-store` (2.2; hasta entonces, con el servidor de verdad el refresco vive en memoria) |
| 03 | 🟡 Hecho: `theme.ts` provisional, los componentes de §4 y la página `muestra`. **Falta**: el catálogo de pantallas (tarea 1; los artboards ya se pueden capturar con Playwright) y la decisión `territorio` (tarea 3) |
| 04 | 🟡 Primer corte: portada (atajo, «Te faltan N listas», otros grupos, por etapa) y marcar/guardar contra el servidor falso. **Falta**: borrador y cola, árbol de grupos, historial, evento de hoy, coordinación en la portada y el resto de reglas del plan |
| 05 | 🟡 Hecho (24/10/2026, commits `9b66ff6`, `4db00e9`, `b6c09df` y el de documentación): contrato y servidor falso (familia, autorizaciones, salud por campos, fotos, sueltos, avisos, eventos, pañuelo, «curso cerrado»), reglas puras con tests, hooks con precarga de tus fichas, Grupos y fichas (tres vistas, chips, buscador, «Asignar grupos»), un grupo, «Sin grupo» con «Vincular», hoja de salud y la ficha entera; marcar abre la ficha con la sesión; salir vacía las fotos. **Falta**: buscador nativo de cabecera (`headerSearchBarOptions`, va dentro de la lista como en el árbol del 04), enlace a la ficha del monitor (plan 06), tests de pantalla con `screenSmoke`, y las decisiones 🔒 `salud-no` y `territorio` (pañuelo y avisos con colores provisionales de la app); preguntas 2 y 3 siguen como el plugin |
| 10 | ✅ Hecho: enrutador de tres estados (tipo, seed, `PANEL_PERFILES.md`), `links.ts` con el mapa de todas las páginas del plugin y su validación, `+native-intent.ts` (todo el dominio a la pestaña; el legado sigue recibiendo `acceso_magico` y destino; la nativa canjea el token con `exchange`, pregunta si el enlace es de otra persona, abre la pantalla nativa o el legado con pase), `openLegacy` + `web.tsx` con cabecera nativa e interceptación, `intentFilters` de Android con los prefijos (**para la 2.2**) y, en el plugin (rama `nuevoComunicaChulo`, **sin desplegar**), el `apple-app-site-association` con todo el dominio. Al hacer cada pantalla nativa, se registra en `NATIVE` de `links.ts` |

> ⚠️ **Antes de mergear esta rama a `main`**: quitar `EXPO_PUBLIC_COMUNICA_API: "fake"`
> del perfil `production` de `mcm-app/eas.json`. Se puso el 24/10/2026 para que
> la build de TestFlight lanzada desde esta rama enseñe el área nativa (con el
> Laboratorio Alpha) con datos inventados; en `main` el área de producción no
> debe encenderse sin servidor de verdad.

00 → 01 → 02 → 10 van en fila. 03 puede ir a la vez. Después, 04-09
(monitores) y 11-16 (familias) se pueden repartir entre varias sesiones,
porque cada uno vive en sus carpetas; dentro de familias, 11 va primero.

**Construir el área entera** = ejecutar estos 17 planes y, aparte, los del
servidor. Lo que el plan del servidor tiene que dar sale de la sección «Datos»
de cada uno (`docs/contratos/COMUNICA_API.md`, plan 00 tarea 7).

---

## Reglas comunes (valen para todos los planes)

### Dónde va el código

| Qué | Dónde |
|---|---|
| Rutas | `app/(tabs)/comunica/` — carpeta con `_layout.tsx` (Stack), como `contigo/`. Sustituye a `app/(tabs)/comunica.tsx` (plan 01) |
| Pantallas por bloque | `app/(tabs)/comunica/pasar-lista/`, `grupos/`, `coordinacion/`, `eventos/`, `yo/` |
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
- Escrituras por la **cola** (`outbox.ts`): se guardan en el móvil al instante,
  suben solas y la pantalla enseña su estado. Nada de esperar con una rueda.
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
- Paquetes nativos: los de la 2.2 (`expo-secure-store`, `expo-sqlite`,
  `expo-local-authentication`) llegan a la rama al mergear `main`. Si un plan
  necesita otro, para y pregunta. Los JS puros (TanStack Query, zod) se
  añaden sin preguntar.
- No se toca nada del CRM ni del plugin desde estos planes.
- Al terminar un plan, se marca hecho en esta tabla con fecha y commit.
