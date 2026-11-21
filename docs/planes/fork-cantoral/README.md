# Plan — MCM Cantoral (fork de MCM App solo con el cantoral)

> **Estado:** 📝 escrito el 21/11/2026, **sin empezar**. Pendiente de que el
> usuario conteste las decisiones y cree el repo del fork.
> **Decisiones:** se contestan en la página
> <https://claude.ai/artifact/KDnnYJnwrYgxQB5zSPcakn> (colección `decisiones`); el resumen está en §4.
> **Dónde vivirá:** al crear el fork, esta carpeta se copia entera a
> `docs/planes/` del repo nuevo y allí sigue viva. En `mcmapp` se queda como
> registro de por qué existe el fork y de lo que hay que hacer **aquí** antes
> (§5, «Pre-fork»).

---

## 1. Qué es, en una frase

Una app **standalone** que solo tiene el cantoral —con todas sus
funciones— pensada para **estudiar, preparar, ensayar y sobre todo actuar en
directo**, que se publica en las tiendas como **MCM Cantoral**, lee la misma
base de datos que MCM App y **sale en modo Navidad** para ser la herramienta
de los **Villancicos Solidarios**.

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
   canciones en bloques de una hora ya preparados, 1-3 maestros pasando
   canciones y mandando avisos («¡cantamos más fuerte!»).

## 2. Decisiones ya tomadas (usuario, 21/11/2026)

| # | Decisión |
| - | -------- |
| T-01 | App standalone **solo con el cantoral**, publicada aparte como **MCM Cantoral** |
| T-02 | **Misma base de datos** de Firebase; idealmente solo lee `songs` (las reglas, más adelante y con paciencia) |
| T-03 | **Sin usuarios.** Si hace falta designar administradores, con un **código** que se pueda guardar en Firebase |
| T-04 | **Estilo visual distinto** para que se note que es otra app; las reglas de colores por secciones y territorios de MCM App **no aplican**; se busca el mejor diseño posible manteniendo las funcionalidades |
| T-05 | **Sin barra de pestañas y sin FAB**: botones abajo, en la línea del menú de vidrio actual |
| T-06 | **Nativo siempre** |
| T-07 | **Documento de trazabilidad** breve con las divergencias: el fork tiene vida propia, y lo que se pueda llevar a MCM App se lleva **sin prisa**, cuando haya tiempo y tokens ([`DIVERGENCIAS.md`](DIVERGENCIAS.md)) |
| T-08 | Sale en **modo Navidad funcional** (no estético) para Villancicos Solidarios |
| T-09 | Repensar flujos y diseño a fondo; se pueden usar skills de diseño |
| T-10 | Specs pedidas: wifi local para pasar canciones · todo el cantoral offline · el maestro ofrece su cantoral más nuevo por wifi · apuntes por perfil de instrumento · avisos de maestros estilo ProPresenter · pedal Bluetooth · emojis y reacciones · afinador · subcategorías fáciles en `songs.json` · nunca re-descargar si ya está en local y primera descarga a prueba de fallos · notación de partituras (riffs, melodías), con IA si ayuda |

## 3. Lo que salió al planificar (y cambia cosas)

Comprobado en el código de `mcmapp` (`main`, `257f5f4`) y del repo
`mcmapp-cantoral`:

1. 🚨 **El repertorio de villancicos no está en el cantoral.** La categoría
   *N. Navidad* está **vacía** y los 11 bloques de 2025 tienen todas las
   canciones sin enlazar. Los importadores (Word e IA para el PDF de 2008)
   ya están hechos en el admin del cantoral; falta usarlos y revisar ~85
   canciones. **Es ruta crítica igual que la app** (`07`).
2. **Las subcategorías ya existen en los datos** (el generador publica
   `subcategories`, `subcategory`, `alsoIn`, `duration`) pero **ninguna app
   las usa**: la «Fase 1» de `mcmapp-cantoral/docs/PROMPT_APP_NAVIDAD.md`
   está escrita y sin ejecutar. El marcado (`<i>` 2ª voz…) afecta a **las
   dos apps** a la vez (`02` §4).
3. **No hay canciones empaquetadas**: la primera vez sin internet el cantoral
   sale vacío. El fork lleva una semilla en el binario (`02` §3).
4. 🐞 **Sugerir una canción obliga a todos los móviles a re-bajar el
   cantoral** (`SuggestSongModal` escribe `songs/updatedAt`). Bug de MCM App.
5. 🐞 **En el coro en vivo, cambiar de tono borra la letra a los
   seguidores** (`current` se reemplaza entero). Bug de MCM App (`04` §1).
6. **El pedal Bluetooth solo funciona de verdad en la web**: en iOS/Android
   no hay captura nativa de teclas (`04` §8).
7. MCM App tiene **una sola lista** («Tu selección»): el fork necesita
   varios repertorios (`02` §5).
8. La **versión mínima** de MCM App (`/profileConfig`) **bloquearía** al fork
   si la leyera: el fork tiene su propia configuración (`01` §2.1).
9. Enlaces (`mcm.expo.app/coro`…) y el tipo de fichero `.mcm` **chocarían**
   entre las dos apps: dominio y tipo propios, y se entienden los de la otra.
10. Multipeer (iOS) y Nearby (Android) **no hablan entre sí**; el punto de
    acceso del iPhone **no es fiable desde iOS 18**. Wifi local = TCP +
    Bonjour + router de viaje si no hay wifi (`04` §5).
11. GitHub **normalmente no deja forkear dentro del mismo propietario**:
    repo nuevo con la historia empujada (`01` §0).
12. Los trinquetes de diseño (`noNewMagicNumbers`, `noLooseMotion`) tienen
    **cota inferior**: al borrar media app hay que bajar los topes en el
    mismo commit (`01` §2.7).
13. **ChordSheetJS (la que parsea el ChordPro) es GPL-2.0** y el repo no
    tiene licencia. MCM App ya la usa; con una segunda app en tiendas
    conviene mirarlo (aclaración A-06).

## 4. Decisiones pendientes (resumen; se contestan en la página)

| ID | Pregunta | Recomendación |
| -- | -------- | ------------- |
| D-01 | Fecha del evento y meta | Sábado 19/12 (por confirmar); tiendas como objetivo, TestFlight público + web como plan B |
| D-02 | ¿Arreglos y Fase 1 de Navidad en MCM App **antes** de forkear? | **Sí**: una sesión, sale por OTA, y el fork nace con ello |
| D-03 | Identificadores | `com.familiaconsolacion.mcmcantoral` / `com.mcmespana.mcmcantoral`, esquema `mcmcantoral` |
| D-04 | ¿Mantener la carpeta `mcm-app/`? | **Sí**: mismas rutas = portar sin dolor |
| D-05 | Dirección visual | **A · Escenario** (oscuro con luz ámbar), confirmada con una maqueta |
| D-06 | Icono | Claude propone 3 con la dirección elegida |
| D-07 | ¿Wifi local ya para Villancicos? | **No**: nube + offline para el evento; wifi local en enero |
| D-08 | ¿Cómo se es maestro de un directo? | PIN/QR que enseña quien lo crea |
| D-09 | Admin por código | Auth anónimo invisible + Cloud Function (el NAS no cambia) |
| D-10 | Directo en la nube | Reutilizar `/choirSessions` con campos nuevos (compatible con MCM App) |
| D-11 | Apuntes compartidos | Dentro del repertorio primero; por coro después |
| D-12 | Palabras de la interfaz | Repertorio · Bloque · Directo · Maestro · Apunte |
| D-13 | Web del fork | Sí, en `mcm-cantoral.expo.app` |
| D-14 | Qué satélites del cantoral se quedan | Todos (domingo, lecturas, lo cantado por el coro, sugerir/fallitos, PDF, metrónomo) |
| D-15 | Analítica | Sentry y Aptabase, como MCM App |
| D-16 | IA para partituras | Primero «tararéalo» sin IA; IA después vía NAS |
| D-17 | Botones de volumen como pedal | Solo Android y opcional (en iOS lo prohíbe Apple) |
| D-18 | Reacciones | Para todos, silenciables, el maestro puede apagarlas |
| D-19 | Quién configura el modo Navidad | Fichero en el repo del cantoral, publicado por su workflow |
| D-20 | ¿Seguir por sección (estribillo…) ya? | Después del evento |
| D-21 | ¿Congelar el cantoral durante un directo? | Sí |
| D-22 | ¿Qué pasa con el cantoral de MCM App? | Se queda como está |

Aclaraciones (A-01…A-08) e ideas sueltas: en la página.

## 5. Fases y orden

| Fase | Qué | Dónde | Documento | Para Villancicos |
| ---- | --- | ----- | --------- | ---------------- |
| **Pre-fork** | Bugs de §3 (4, 5) + comparación numérica de `updatedAt` + **Fase 1 de Navidad** (subcategorías, alsoIn, marcado, duración) en código compartido y UI mínima | `mcmapp` (rama de esta sesión → `main`) | [`02`](02-datos-offline.md) §8-§9 | ✅ |
| **0** | Crear el fork, identidad nueva, poda, shell sin pestañas, CI, TestFlight/Play interna | fork | [`01`](01-arranque-y-poda.md) | ✅ |
| **1** | Catálogo offline (semilla, ficheros, atómico, nunca re-bajar), repertorios múltiples, bloques, modo Navidad | fork + cantoral | [`02`](02-datos-offline.md) | ✅ |
| **2** | Diseño: maqueta → `design.md` del fork → tokens → Inicio, Atril, Repertorio, iPad | fork | [`03`](03-diseno-y-flujos.md) | ✅ |
| **3** | Directo por la nube (protocolo, varios maestros, avisos, reacciones, presencia) + pedal | fork | [`04`](04-directo.md) | ✅ |
| **4** | Tiendas, ensayo general, evento | fork + usuario | [`07`](07-tiendas-y-villancicos.md) | ✅ |
| **5** | Wifi local + pasar el cantoral, apuntes por capas, partituras ABC, admin por código + editor | fork | [`04`](04-directo.md) §5, [`05`](05-apuntes-y-partituras.md), [`06`](06-administracion.md) | ❌ (enero) |
| **6** | Llevar a MCM App lo importable, sin prisa | `mcmapp` | [`DIVERGENCIAS.md`](DIVERGENCIAS.md) | ❌ |

**En paralelo y fuera del código**: contenido de villancicos en el repo del
cantoral (usuario, con el admin) y burocracia de las tiendas (`07` §3).

**Calendario** (si el evento es el 19/12): S0 21-23 nov pre-fork + Fase 0 ·
S1 24-30 nov Fase 0 cerrada + Fase 1 + maqueta · S2 1-7 dic Fases 2 y 3 ·
S3 8-13 dic Fase 3 + envío a revisión + **ensayo general** · S4 14-18 dic
arreglos y publicar · 19 dic evento. Detalle en `07` §2.

## 6. Cómo se ejecuta este plan

1. **Una fase por sesión** (o dos si son cortas), en el orden de §5. Antes de
   empezar una fase, leer su documento entero y las decisiones contestadas.
2. Lo que tenga una decisión sin contestar **no se ejecuta**: se pregunta.
3. En el fork, cada fase cierra con: tests en verde, entrada en el
   `CHANGELOG.md` del fork (fecha y hora), fila de `DIVERGENCIAS.md` si
   aplica, y la línea de OTA (`OTA: ✅ — solo JS.` / `OTA: ❌ — requiere
   build nativo…`).
4. Modelo: **Opus** para lo que decide (protocolo de directo, catálogo,
   identidad, diseño); **Sonnet** para lo mecánico (borrar áreas, tests,
   textos). Está marcado en cada tabla de tareas.
5. Este README se actualiza al cerrar cada fase (columna de estado de §5).

## 7. Investigación (21/11/2026, resumen)

| Tema | Elegido | Plan B | Notas |
| ---- | ------- | ------ | ----- |
| Wifi local | `react-native-tcp-socket` 6.4 + `react-native-zeroconf` 1.0-rc | Módulo Expo propio (Network.framework / NsdManager) | tcp-socket va por la capa de compatibilidad: probar el día 1. Permisos: TN3179 (iOS), `ACCESS_LOCAL_NETWORK` (Android 17) |
| Pedal | `expo-key-event` 1.9 | Módulo propio con `UIKeyCommand` + `wantsPriorityOverSystemBehavior` | El foco se pierde con modales: re-escuchar. iOS esconde el teclado con un pedal conectado |
| Volumen como pedal | Solo Android, opcional | — | Norma 2.5.9 de Apple |
| Afinador | El de hoy (`react-native-audio-api` + `pitchy`) | `react-native-pitchy` (C++) | Añadir calibración de La |
| Partituras | ABC + `abcjs` 6.7 en el WebView | — | ChordSheetJS 18 deja pasar `{start_of_abc}` con `delegates`; soundfont empaquetada para escuchar sin red |
| Brillo / pantalla | `expo-keep-awake` (ya), `expo-brightness` con restaurar | — | SDK 58: iPad siempre redimensionable, no bloquear orientación |
| Skills de diseño | `expo/skills` (`expo-native-ui`, `expo-ui`, `expo-design-system`…), Callstack, Software Mansion, Vercel | — | Instalación en `03` §8 |
| Tiendas | — | — | Apple 4.3 (duplicadas) y 4.2; Google 12 probadores/14 días si la cuenta es personal y posterior al 13/11/2023 |

## 8. Riesgos

| Riesgo | Prob. | Impacto | Qué se hace |
| ------ | ----- | ------- | ----------- |
| No llegar al 19/12 con todo | Media | Alto | Orden de §5 estricto; lo de la Fase 5 no entra; plan B TestFlight + web |
| Repertorio de villancicos sin importar a tiempo | **Alta** | **Muy alto** | Empezar ya (S0); Claude puede ayudar en el repo del cantoral |
| Rechazo 4.3 de Apple | Media | Alto | Diferenciación clara + nota a la revisión; TestFlight público |
| Google exige 12 probadores × 14 días | ? | Alto | Mirar la cuenta hoy (A-02); abrir la prueba cerrada en S1 |
| La nube falla en la calle | Baja | Alto | Bloques offline en cada móvil; papel de respaldo |
| `react-native-tcp-socket` no va en SDK 58 | Media | Medio | Plan B módulo propio; no afecta al evento |
| El pedal pierde el foco | Media | Medio | Hook que re-escucha; plan B `UIKeyCommand`; prueba con pedal real |

## 9. Documentos de este plan

| Documento | Qué |
| --------- | --- |
| [`01-arranque-y-poda.md`](01-arranque-y-poda.md) | Fase 0: repo, identidad, qué se borra y en qué orden, shell sin pestañas, tests, CI |
| [`02-datos-offline.md`](02-datos-offline.md) | Catálogo offline, nodos que se leen, subcategorías, repertorios, bloques, modo Navidad, bugs de MCM App |
| [`03-diseno-y-flujos.md`](03-diseno-y-flujos.md) | Situaciones de uso, principios, arquitectura, pantallas, flujos con toques, identidad visual, nativo, skills |
| [`04-directo.md`](04-directo.md) | Protocolo, nube, maestros, avisos, reacciones, wifi local, pedal, pantalla |
| [`05-apuntes-y-partituras.md`](05-apuntes-y-partituras.md) | Capas de apuntes, anclaje, ABC, teclado de piano, tararear, IA |
| [`06-administracion.md`](06-administracion.md) | Admin por código sin usuarios; maestro ≠ admin |
| [`07-tiendas-y-villancicos.md`](07-tiendas-y-villancicos.md) | Calendario, tiendas, contenido, guion del día |
| [`DIVERGENCIAS.md`](DIVERGENCIAS.md) | Plantilla del documento de trazabilidad del fork |
