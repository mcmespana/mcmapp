# Plan — MCM Cantoral (fork de MCM App solo con el cantoral)

> **Estado:** 📝 plan cerrado el 21/11/2026 con **todas las decisiones
> contestadas** (§4) y mergeado en `main` de `mcmapp`. **Sin empezar.**
> **Maqueta A/B hecha** (21/11): <https://claude.ai/artifact/TBGfc98GLHTma1vhY1wqHa>
> — elegir dirección e Izan cierra el estilo (`03` §8). Siguiente: **el fork
> en la cuenta de GitHub de Izan** (`01` §0). Los bugs del cantoral de MCM App
> (§3, 4-5, y los dos menores) **ya están arreglados en `main`** (21/11);
> la Fase 1 de Navidad sigue sin hacer (`mcm-app/TODO.md`).
> **Respuestas originales:** página
> <https://claude.ai/artifact/KDnnYJnwrYgxQB5zSPcakn> (colección `decisiones`).
> **Dónde vivirá:** al crear el fork, esta carpeta se copia entera a
> `docs/planes/` del repo nuevo y allí sigue viva. En `mcmapp` se queda como
> registro de por qué existe el fork y del **Paquete MCM App** (§5): lo que
> hay que hacer **aquí**.

---

## 1. Qué es, en una frase

Una app **standalone** que solo tiene el cantoral —con todas sus
funciones— pensada para **estudiar, preparar, ensayar y sobre todo actuar en
directo**, que se publica en las tiendas como **MCM Cantoral**, lee la misma
base de datos que MCM App y **sale en modo Navidad** para ser la herramienta
de los **Villancicos Solidarios** (sábado **19/12/2026**, Cuatro Esquinas,
3-4 maestros).

Para qué la quiere el usuario, en su orden:

1. Estudiar y aprenderse canciones en casa.
2. Preparar el repertorio de una eucaristía de un coro (o importarlo y
   prepararse las canciones).
3. Ensayar en grupo: apuntes para todos, para ciertos instrumentos o para mí.
4. **Actuar en directo — lo más crítico**: útil, fácil, pocos toques, pasos
   automáticos de canción siguiendo al que dirige, tamaño adaptado a móvil o
   iPad, fácil de importar y de seguir, con mis apuntes a la vista.
5. Administrar: editar canciones.
6. **Villancicos Solidarios**: un recital de ~8 h en la calle, ~60
   canciones en bloques de una hora ya preparados, 3-4 maestros pasando
   canciones y mandando avisos («¡cantamos más fuerte!»). **Por la wifi
   local** del router que ya se lleva para la mesa de sonido.

## 2. Lo que pidió el usuario de entrada (21/11/2026)

| # | Decisión |
| - | -------- |
| T-01 | App standalone **solo con el cantoral**, publicada aparte como **MCM Cantoral** |
| T-02 | **Misma base de datos** de Firebase; idealmente solo lee `songs` (las reglas, más adelante y con paciencia) |
| T-03 | **Sin usuarios.** Si hace falta designar administradores, con un **código** que se pueda guardar en Firebase |
| T-04 | **Estilo visual distinto** para que se note que es otra app; las reglas de colores por secciones y territorios de MCM App **no aplican**; se busca el mejor diseño posible manteniendo las funcionalidades |
| T-05 | **Sin barra de pestañas y sin FAB**: botones abajo, en la línea del menú de vidrio actual |
| T-06 | **Nativo siempre** |
| T-07 | **Documento de trazabilidad** breve con las divergencias: el fork tiene vida propia, y lo que se pueda llevar a MCM App se lleva **sin prisa** ([`DIVERGENCIAS.md`](DIVERGENCIAS.md)). **El cantoral de MCM App solo puede crecer, nunca decrecer** |
| T-08 | Sale en **modo Navidad funcional** (no estético) para Villancicos Solidarios |
| T-09 | Repensar flujos y diseño a fondo; se pueden usar skills de diseño |
| T-10 | Specs: wifi local para pasar canciones · todo el cantoral offline · el maestro ofrece su cantoral más nuevo por wifi · apuntes por perfil de instrumento · avisos de maestros estilo ProPresenter · pedal Bluetooth · emojis y reacciones · afinador · subcategorías fáciles en `songs.json` · nunca re-descargar si ya está en local y primera descarga a prueba de fallos · notación de partituras (riffs, melodías), con IA si ayuda |

## 3. Lo que salió al planificar (y cambia cosas)

Comprobado en el código de `mcmapp` (`main`, `257f5f4`) y del repo
`mcmapp-cantoral`:

1. **El repertorio de villancicos no está en el cantoral.** La categoría
   *N. Navidad* está **vacía** y los 11 bloques de 2025 tienen todas las
   canciones sin enlazar. Los importadores ya están en el admin del
   cantoral. Lo hace el usuario («no te preocupes, lo haremos»).
2. **Las subcategorías ya existen en los datos** pero **ninguna app las
   usa**: la «Fase 1» de `mcmapp-cantoral/docs/PROMPT_APP_NAVIDAD.md` está
   sin ejecutar. El marcado (`<i>` 2ª voz…) afecta a **las dos apps**. Y si
   la tienda tarda, el plan B es ver las canciones en MCM App: **MCM App
   tiene que tener Navidad bien antes del 19/12** (Paquete MCM App, §5).
3. **No hay canciones empaquetadas**: la primera vez sin internet el cantoral
   sale vacío. El fork lleva una semilla en el binario (`02` §3).
4. 🐞 **Sugerir una canción obliga a todos a re-bajar el cantoral**
   (`SuggestSongModal` escribe `songs/updatedAt`). Bug de MCM App, **arreglado el 21/11**.
5. 🐞 **En el coro en vivo, cambiar de tono borra la letra a los
   seguidores** (`current` se reemplaza entero). Bug de MCM App, **arreglado el 21/11**.
6. **El pedal Bluetooth solo funciona de verdad en la web** (`04` §8).
7. MCM App tiene **una sola lista**: el fork necesita varios repertorios.
8. La **versión mínima** de MCM App **bloquearía** al fork si la leyera.
9. Enlaces y el tipo de fichero `.mcm` **chocarían** entre las dos apps.
10. Multipeer (iOS) y Nearby (Android) **no hablan entre sí**: la wifi local
    es TCP + Bonjour, sobre **el router del evento** (`04` §5).
11. En iOS, **una app en segundo plano no puede servir**: el móvil del
    maestro no puede ser el único servidor. Por eso hay un **equipo base**
    enchufado junto al router y relevo automático (`04` §5.2).
12. GitHub no deja forkear dentro del mismo propietario (`mcmespana`): el
    fork se hace **en la cuenta de Izan** (fork normal de GitHub, solo copia
    `main`; por eso todo se mergea a `main` antes) (`01` §0).
13. **Las reglas de Firebase y las Cloud Functions son de `mcmapp`**: el fork
    no despliega reglas, y su función va en un *codebase* propio para no
    borrar las de MCM App (`01` §2.9, `06`).
14. **ChordSheetJS es GPL-2.0** y el repo no tiene licencia. Se acepta así y
    se mira más adelante (A-06).

## 4. Decisiones contestadas (21/11/2026)

| ID | Decisión | Respuesta | Cómo queda en el plan |
| -- | -------- | --------- | --------------------- |
| D-01 | Fecha y meta | **19/12**, tiendas como objetivo. «No hay miedo»; si no llega, se ven las canciones en MCM App | Calendario de `07`; el Paquete MCM App deja Navidad bien en MCM App |
| D-02 | Arreglos y Fase 1 de Navidad en MCM App primero | **Sí, pero después**: el 21/11 el usuario pidió **solo documentarlos** y no esperar a ellos para el fork | Documentados en `mcm-app/TODO.md`; se hacen donde llegue antes (MCM App o el fork) y se llevan al otro con un parche (§5) |
| D-03 | Identificadores | **Los propuestos** (`com.familiaconsolacion.mcmcantoral`, `com.mcmespana.mcmcantoral`, `mcmcantoral`) | `01` §2.1 |
| D-04 | Carpeta `mcm-app/` | **No: la app en la raíz del repo, y limpiar** («hay mucha mierda») | `01` §2.8; portar con `--relative`/`--directory` (`DIVERGENCIAS.md` §4) |
| D-05 | Dirección visual | **Maqueta con A y B y se decide allí.** Aprovechar lo nativo. **Izan acabará de decidir el estilo** | `03` §6 y §8: maqueta para Izan; tema por tokens para que su estilo entre sin tocar pantallas |
| D-06 | Icono | **Claude propone; se empieza y se acaba en Canva** | `03` §6 |
| D-07 | Wifi local para el evento | **Sí, tiene que entrar.** Hay router (dos o tres) para la mesa de sonido | Fase 3 del evento; equipo base + relevo; lista del router (`04` §5, `07` §4) |
| D-08 | Maestros | **PIN de 4 dígitos** muy fácil | `04` §4 |
| D-09 | Admin por código | **«Una especie de contraseña y ya»**: quien la sabe, es admin. Por dentro, sesión anónima + función (invisible) | `06` |
| D-10 | Directo en la nube | **Reutilizar `/choirSessions`** con campos nuevos | `04` §4 |
| D-11 | Apuntes compartidos | **Dentro del repertorio primero**; por coro después | `05` §6 |
| D-12 | Palabras | **Repertorio · Directo · Maestro · Apunte**; «Bloque» solo dentro de un evento. Pensado también para el modo normal tras Navidad | `03` §3 |
| D-13 | Web | **`mcm-cantoral.expo.app`** | `01` §2.1 |
| D-14 | Satélites | **Todos** | `01` §1 |
| D-15 | Analítica | Sentry + Aptabase, **en una segunda fase**: ahora no | Se quedan instalados y **apagados** (sin claves); se encienden en la Fase 5 |
| D-16 | IA para partituras | Tararear primero, IA después. **Más importante: poder escribir el riff en la web del admin del cantoral** de forma sencilla | `05` §5: editor ABC en el admin del cantoral primero |
| D-17 | Botones de volumen | **En las dos plataformas**, con un interruptor remoto por si Apple se queja | `04` §8 |
| D-18 | Reacciones | Para todos; **lo importante son los avisos de los maestros** | `04` §6-§7 |
| D-19 | Configuración del modo Navidad | **Fichero en el repo del cantoral** (por ahora) | `02` §7 |
| D-20 | Seguir por sección | **Sí, «muy bueno»**, para el evento. Y que el maestro pueda decir **«ahora hacemos esta estrofa / este puente»** | Fase 3, después de lo básico (`04` §10) |
| D-21 | Congelar el cantoral en directo | **No**: se actualiza en cuanto hay algo nuevo | `02` §3.3: se aplica al momento, sin saltar de canción ni de posición |
| D-22 | Cantoral de MCM App | **Se queda** (y solo crece) | — |
| D-23 | Por dónde va un directo (propuesta del usuario, 21/11) | Al abrirlo se elige **wifi del coro, internet o los dos**; viene marcado lo que encaja con la conexión de quien dirige (con datos y sin wifi, *Solo internet*); solo elige quien dirige y se puede cambiar en pleno directo | `04` §2 bis |

**Aclaraciones**

| ID | Respuesta |
| -- | --------- |
| A-01 | 19/12/2026, **Cuatro Esquinas**, **3-4 maestros** como mucho |
| A-02 | Cuenta de Play «de organización, creo»; con MCM App fue bien → sin prueba de 12 personas |
| A-03 | Repo: **fork en la cuenta de GitHub de Izan**, nombre **`mcmcantoral`** (sigue la costumbre `mcmapp`, `mcmpanel`, `mcmbank`). Se puede transferir a `mcmespana` más adelante. `mcmapp-cantoral` se queda como está: son las canciones de las dos apps |
| A-04 | El repertorio de villancicos lo meten ellos |
| A-05 | No hay pedal ni iPad para probar ahora; ya se verá |
| A-06 | Licencia: se acepta así, más adelante |
| A-07 | Editor antes de enero: **sí, si no cuesta mucho** → al final de la Fase 4, si da tiempo |
| A-08 | Ensayo general: sí, sin agobios |

**Ideas sueltas**: **sí** a I-06 (cuenta atrás al cambio de bloque) e I-07
(resumen al acabar) → entran en la Fase 3. **Luego**: I-01 «Canta con
nosotros», I-02 pantalla grande, I-04 aviso push de directo, I-08 modo
proyección para la misa. **No**: I-03 pulso compartido, I-05 comprar router
(ya hay).

## 5. Fases y orden

| Fase | Qué | Dónde | Documento | Antes del 19/12 |
| ---- | --- | ----- | --------- | --------------- |
| **Paquete MCM App** | Bugs 4 y 5 de §3 + comparación numérica de `updatedAt` + textos «24 h» del coro + **Fase 1 de Navidad**. **Bugs y textos: ✅ hechos en `main` (21/11).** Fase 1 de Navidad: sin hacer (`mcm-app/TODO.md`). Se hace donde llegue antes —MCM App o el fork— y se lleva al otro con un parche | `mcmapp` y/o fork | [`02`](02-datos-offline.md) §8-§9 | ✅ (Navidad en MCM App es el plan B) |
| **0** | Repo, identidad, poda, **app en la raíz y limpieza**, shell sin pestañas, CI, **spike de wifi local**, TestFlight/Play interna | fork | [`01`](01-arranque-y-poda.md) | ✅ |
| **1** | Catálogo offline (semilla, ficheros, atómico, nunca re-bajar), repertorios múltiples, bloques, modo Navidad | fork + cantoral | [`02`](02-datos-offline.md) | ✅ |
| **2** | Diseño: estilo elegido sobre la maqueta (Izan) → `design.md` → tokens → Inicio, Atril, Repertorio, iPad | fork | [`03`](03-diseno-y-flujos.md) | ✅ |
| **3** | **Directo**: protocolo → nube → **wifi local** (equipo base, relevo, pasar el cantoral) → avisos, reacciones, presencia → pedal y volumen → seguir por sección, cuenta atrás de bloque, resumen | fork | [`04`](04-directo.md) | ✅ |
| **4** | Tiendas, ensayo con el router, evento. Si da tiempo: admin por código + editor | fork + usuario | [`07`](07-tiendas-y-villancicos.md), [`06`](06-administracion.md) | ✅ (admin, si da tiempo) |
| **5** | Apuntes por capas, partituras (editor ABC en el admin del cantoral primero), analítica encendida, ideas «luego» | fork + cantoral | [`05`](05-apuntes-y-partituras.md) | ❌ (enero) |
| **6** | Llevar a MCM App lo importable, sin prisa | `mcmapp` | [`DIVERGENCIAS.md`](DIVERGENCIAS.md) | ❌ |

**En paralelo y fuera del código**: villancicos en el repo del cantoral
(usuario), estilo final (Izan, sobre la maqueta) e icono y fichas de tienda
(Canva + Claude). El **Paquete MCM App** se hace cuando el usuario lo pida.

**Calendario**

| Semana | Qué |
| ------ | --- |
| S0 · 21-23 nov | Plan mergeado en `main` · **maqueta A/B** · fork en la cuenta de Izan · Fase 0 (con el spike de wifi local el primer día) |
| S1 · 24-30 nov | Fase 0 cerrada → TestFlight + Play interna · Fase 1 · Izan cierra el estilo sobre la maqueta · icono en Canva |
| S2 · 1-7 dic | Fase 2 (con el estilo de Izan) · Fase 3: protocolo, nube y **wifi local** |
| S3 · 8-13 dic | Fase 3: avisos, reacciones, pedal/volumen, sección, cuenta atrás, resumen · **enviar a revisión ~9 dic** · ensayo con el router del evento |
| S4 · 14-18 dic | Arreglos del ensayo por OTA · publicar · modo Navidad encendido · admin si da tiempo |
| 19 dic | 🎄 Cuatro Esquinas |

## 6. Cómo se ejecuta este plan

1. **Una fase por sesión** (o dos si son cortas), en el orden de §5. Antes de
   empezar una fase, leer su documento entero.
2. Todo está decidido. Si al ejecutar sale algo nuevo de verdad, se pregunta
   agrupado, con recomendación.
3. En el fork, cada fase cierra con: tests en verde, entrada en el
   `CHANGELOG.md` del fork (fecha y hora), fila de `DIVERGENCIAS.md` si
   aplica, y la línea de OTA (`OTA: ✅ — solo JS.` / `OTA: ❌ — requiere
   build nativo…`).
4. Modelo: **Opus** para lo que decide (protocolo de directo, wifi local,
   catálogo, identidad, diseño); **Sonnet** para lo mecánico (borrar áreas,
   tests, textos). Está marcado en cada tabla de tareas.
5. Este README se actualiza al cerrar cada fase.

## 7. Investigación (21/11/2026, resumen)

| Tema | Elegido | Plan B | Notas |
| ---- | ------- | ------ | ----- |
| Wifi local | `react-native-tcp-socket` 6.4 + `react-native-zeroconf` 1.0-rc | Módulo Expo propio (Network.framework / NsdManager) | tcp-socket va por la capa de compatibilidad de la Nueva Arquitectura: **spike el día 1**. Permisos: TN3179 (iOS), `ACCESS_LOCAL_NETWORK` (Android 17) |
| Pedal | `expo-key-event` 1.9 | Módulo propio con `UIKeyCommand` + `wantsPriorityOverSystemBehavior` | El foco se pierde con modales: re-escuchar. iOS esconde el teclado con un pedal conectado |
| Volumen como pedal | `react-native-volume-manager` 2.2 | — | iOS: norma 2.5.9; interruptor remoto en `cantoralConfig` |
| Afinador | El de hoy (`react-native-audio-api` + `pitchy`) | `react-native-pitchy` (C++) | Añadir calibración de La |
| Partituras | ABC + `abcjs` 6.7 (en el WebView de la app y en el admin del cantoral) | — | ChordSheetJS 18 deja pasar `{start_of_abc}` con `delegates`; soundfont empaquetada para escuchar sin red |
| Brillo / pantalla | `expo-keep-awake` (ya), `expo-brightness` con restaurar | — | SDK 58: iPad siempre redimensionable |
| Skills | `expo/skills` (`expo-native-ui`, `expo-ui`, `expo-design-system`, `expo-module`…), Callstack, Software Mansion, Vercel | — | Instalación en `03` §8 |

## 8. Riesgos

| Riesgo | Prob. | Impacto | Qué se hace |
| ------ | ----- | ------- | ----------- |
| No llegar al 19/12 con todo | Media | Alto | Orden de §5 estricto; seguir por sección y admin son lo primero que cae; MCM App como plan B para ver canciones |
| Wifi local: `react-native-tcp-socket` no va en SDK 58 | Media | Alto | Spike el día 1 de la Fase 0; si falla, módulo propio desde ese día |
| Wifi local: el router aísla clientes o no deja pasar Bonjour | Media | Alto | Lista del router (`07` §4.3) y prueba en el ensayo; QR con IP como respaldo; nube en paralelo si el router tiene internet |
| El móvil del maestro se bloquea y deja de servir | Alta (iOS) | Alto | Equipo base enchufado + relevo automático entre maestros (`04` §5.2) |
| Repertorio sin meter a tiempo | Media | Muy alto | Lo llevan ellos; MCM App lo enseña igual |
| El pedal pierde el foco | Media | Medio | Hook que re-escucha; plan B `UIKeyCommand`; botones de volumen |

## 9. Documentos de este plan

| Documento | Qué |
| --------- | --- |
| [`01-arranque-y-poda.md`](01-arranque-y-poda.md) | Fase 0: repo, identidad, qué se borra, app en la raíz, shell sin pestañas, tests, CI, spike |
| [`02-datos-offline.md`](02-datos-offline.md) | Catálogo offline, nodos que se leen, subcategorías, repertorios, bloques, modo Navidad, bugs de MCM App |
| [`03-diseno-y-flujos.md`](03-diseno-y-flujos.md) | Situaciones de uso, principios, arquitectura, pantallas, flujos con toques, identidad visual, nativo, skills |
| [`04-directo.md`](04-directo.md) | Protocolo, nube, wifi local con equipo base, maestros, avisos, reacciones, pedal y volumen, sección, cuenta atrás, resumen |
| [`05-apuntes-y-partituras.md`](05-apuntes-y-partituras.md) | Capas de apuntes, anclaje, ABC en el admin y en la app, teclado de piano, tararear, IA |
| [`06-administracion.md`](06-administracion.md) | Admin por código sin usuarios (explicado en sencillo); maestro ≠ admin |
| [`07-tiendas-y-villancicos.md`](07-tiendas-y-villancicos.md) | Calendario, tiendas, contenido, router, guion del día |
| [`DIVERGENCIAS.md`](DIVERGENCIAS.md) | Plantilla del documento de trazabilidad del fork |
