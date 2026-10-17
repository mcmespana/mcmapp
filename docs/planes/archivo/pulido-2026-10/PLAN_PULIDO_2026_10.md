# PLAN_PULIDO_2026_10 — Pasada de rendimiento, diseño, Android y web

> **Estado: ✅ HECHO y ARCHIVADO (2026-10-17). No se re-ejecuta.** Los 12
> paquetes se implementaron cada uno en su rama `wip/<paquete>` y se integraron
> en `claude/mcm-app-polish-optimize-oilpn0` (y la rama homónima de
> `mcmapp-cantoral`). Resumen en `mcm-app/CHANGELOG.md` (2026-10-17 13:30). Lo
> que quedó fuera a propósito —decisiones nuevas, hallazgos sin paquete y
> comprobaciones en dispositivo— está en `mcm-app/TODO.md`, «Restos del pulido
> de octubre». Las decisiones de Carismochito siguen en `BACKLOG.md` §4.
>
> El script `workflow-implementar.js` se queda como referencia de cómo se
> repartió el trabajo; **no lo relances**.

## Qué hay aquí

| Fichero                                              | Qué es                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`hallazgos.json`](hallazgos.json)                   | Los **184 hallazgos** verificados contra el código, por área (perf, android, web-ipad, design-a, design-b, animations, hygiene-mcmapp, hygiene-cantoral, carismochito, backlog), cada uno con `file:línea`, evidencia, arreglo concreto, impacto, riesgo, si es OTA y si pide dispositivo o decisión |
| [`paquetes.json`](paquetes.json)                     | El reparto en **12 paquetes** con ficheros casi disjuntos (A cantoral-lista, B1 detalle de canción, B2 hoja/pantalla completa, C web, D Android, E Contigo, F1 Home/Más/notificaciones, F2 calendario/fotos/eventos, G animación, H Carismochito, I docs y limpieza, J repo del cantoral)            |
| [`workflow-implementar.js`](workflow-implementar.js) | El script del workflow, con las notas de cada paquete (qué ficheros son suyos y qué NO tocar)                                                                                                                                                                                                        |

## Hecho

Los 12 paquetes (A cantoral-lista, B1 detalle, B2 hoja/pantalla completa,
C web, D Android, E Contigo, F1 Home/Más/notificaciones, F2 calendario/fotos/
eventos, G animación, H Carismochito, I docs y limpieza, J repo del cantoral),
más las decisiones 2, 4–11, 13 y 15 de abajo. Saltados con motivo:
`android-webview-textzoom` (pide decisión, ver TODO), `hyg-scripts-input-tex`
(la auditoría se equivocaba: el admin del cantoral lee `scripts/input/`) y la
parte B de `perf-notificaciones-nodo-entero` (espera al índice manual).

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

## Decisiones que siguen pendientes

Carismochito fuera del laboratorio (`BACKLOG.md` §4) y el generador del
calendario litúrgico (no se toca). Las nuevas que salieron al ejecutar están en
`mcm-app/TODO.md`, «Restos del pulido de octubre».
