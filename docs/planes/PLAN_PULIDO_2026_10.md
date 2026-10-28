# PLAN_PULIDO_2026_10 — Pasada de rendimiento, diseño, Android y web

> **Estado: 🟢 VIVO, sin ejecutar** (salvo dos arreglos del cantoral, ver
> abajo). Auditoría hecha el 2026-10-16 con 10 agentes de solo lectura; la
> implementación se cortó dos veces por el límite de sesión y no llegó a
> empezar.
>
> **Para retomarlo** («seguimos con el pulido»): relanza el workflow
> [`pulido-2026-10/workflow-implementar.js`](pulido-2026-10/workflow-implementar.js)
> en tres tandas de cuatro paquetes. Antes, genera los `wp-<paquete>.json`
> que lee el script (son el cruce de los dos JSON de abajo) y cambia la
> constante `SP` del script a esa carpeta. Cada paquete trabaja en su propio
> worktree `wip/<paquete>`; luego se integran, se revisan y se publican.

## Qué hay aquí

| Fichero                                                                            | Qué es                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`pulido-2026-10/hallazgos.json`](pulido-2026-10/hallazgos.json)                   | Los **184 hallazgos** verificados contra el código, por área (perf, android, web-ipad, design-a, design-b, animations, hygiene-mcmapp, hygiene-cantoral, carismochito, backlog), cada uno con `file:línea`, evidencia, arreglo concreto, impacto, riesgo, si es OTA y si pide dispositivo o decisión |
| [`pulido-2026-10/paquetes.json`](pulido-2026-10/paquetes.json)                     | El reparto en **12 paquetes** con ficheros casi disjuntos (A cantoral-lista, B1 detalle de canción, B2 hoja/pantalla completa, C web, D Android, E Contigo, F1 Home/Más/notificaciones, F2 calendario/fotos/eventos, G animación, H Carismochito, I docs y limpieza, J repo del cantoral)            |
| [`pulido-2026-10/workflow-implementar.js`](pulido-2026-10/workflow-implementar.js) | El script del workflow, con las notas de cada paquete (qué ficheros son suyos y qué NO tocar)                                                                                                                                                                                                        |

## Hecho

- ✅ `ux-buscador-cantoral-tildes` — el buscador del cantoral no distingue tildes.
- ✅ `perf-songlist-memo-roto-featuredtags` — las filas del cantoral ya no se
  repintan todas en cada tecla.

## Lo más gordo que queda (por impacto)

1. **`perf-firebasedata-cache-await-red`** — `useFirebaseData` espera a la red
   nativa antes de servir la caché en memoria: el «Cargando canciones…» asoma
   en cada categoría.
2. **Android**: iconos del header del cantoral invisibles en oscuro, la barra
   flotante tapa el final de ~12 pantallas, el teclado tapa los formularios de
   las hojas, headers de Contigo y de evento ilegibles, atrás de hardware en el
   onboarding y las encuestas.
3. **Pantalla que se apaga** en el detalle y la pantalla completa de canción
   (`useKeepAwake`; `expo-keep-awake` ya va en el binario con `expo`).
4. **Web de escritorio**: atajos de teclado en la canción, el iframe se come
   las teclas, Cmd+K que busque canciones, título de pestaña, service worker que
   acumula bundles de 8 MB.
5. **Contigo**: 16 sitios con texto en `accent` (2,6:1), pulido del examen del
   día (no dice si ya está guardado, guarda vacío).
6. **Repo del cantoral**: 481 backups versionados, PDF/docx duplicados (~38 MB).

## Decisiones del usuario (2026-10-16)

Respondidas por el usuario. Mandan sobre lo que diga cada hallazgo.

| #   | Tema                                                                 | Decisión                                                                                                                                                                                                                                                                                              |
| --- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Carismochito fuera del laboratorio                                   | ⏳ **Pendiente de Izan** (ver `BACKLOG.md` §4). Mientras, solo se arreglan sus fallos dentro del laboratorio                                                                                                                                                                                          |
| 2   | Tiempo de oración                                                    | **A**: las mismas pastillas, con paso de 5 en 5 y pulsación mantenida                                                                                                                                                                                                                                 |
| 3   | Examen del día, segunda versión                                      | **Nada por ahora** (aparcado; ya no hay que recordárselo). El pulido de la versión actual sí                                                                                                                                                                                                          |
| 4   | Sentry en web                                                        | **Quitarlo** de web (`utils/sentry.web.ts` sin efectos, −865 KB)                                                                                                                                                                                                                                      |
| 5   | Accesos rápidos de la Home                                           | **Color de su pestaña** (como pide `design.md`), si se ve bien                                                                                                                                                                                                                                        |
| 6   | `/notifications`                                                     | **OK** al índice `.indexOn: ["createdAt"]`. Ojo: hoy las reglas vivas NO salen de `database.rules.json` (desplegarlo cambia permisos, es la Integración D), así que el índice hay que añadirlo a mano en la consola de Firebase. Hasta entonces, solo la parte A (no descargar ni procesar dos veces) |
| 7   | Hojas inferiores en pantalla ancha                                   | **A**: ~560 px centradas en web y en iPad                                                                                                                                                                                                                                                             |
| 8   | URL por canción en web                                               | **A**: enlace `/cancion?f=…` que abre la canción                                                                                                                                                                                                                                                      |
| 9   | Abrir `.mcm` desde WhatsApp en Android                               | No se usa: solo arreglar que la URL `content://` no rompa el router. Sin intent filter amplio                                                                                                                                                                                                         |
| 10  | `StatCard`/`TeaserCard`/`GlassFAB`/`TopColorBar` de `components/ui/` | **Borrar** y quitarlos de `design.md`                                                                                                                                                                                                                                                                 |
| 11  | `.jules/` y `.gemini/`                                               | **Borrar**                                                                                                                                                                                                                                                                                            |
| 12  | Generador del calendario litúrgico                                   | Sin respuesta: no se toca                                                                                                                                                                                                                                                                             |
| 13  | Cantoral: `songs-vX.json`                                            | **Solo Firebase**; el workflow deja de commitearlos. En el admin, un botón para exportar el JSON o guardar una versión nueva en el repo                                                                                                                                                               |
| 14  | Cantoral: `tab2chordpro_integrado.py`                                | **No tocar**                                                                                                                                                                                                                                                                                          |
| 15  | Cantoral: `15.benedictus.chordpro`                                   | **Renombrar a `.cho`** tras comprobar que no está ya en otra categoría                                                                                                                                                                                                                                |

## Decisiones pendientes del usuario (no ejecutar sin respuesta)

Están marcadas `needs_user_decision` en `hallazgos.json`; la lista legible está
en la respuesta de la sesión del 2026-10-16 y en `BACKLOG.md` §4.
