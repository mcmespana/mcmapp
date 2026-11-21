# 04 · Directo — seguir al maestro, avisos, reacciones, wifi local y pedal

> Parte del plan [`README.md`](README.md). **Lo más crítico de la app.**
> Cubre: «actuar en directo… automáticos pasos de canciones con el modo
> coro», «conexión wifi local para pasar canciones», «si estás en un coro por
> wifi sin internet y el maestro tiene un cantoral más actualizado, lo
> ofrece», «avisos de los maestros a los esclavos… como los mensajes de
> ProPresenter a las pantallas de escenario», «reacciones que pueden usar
> todos» y «pasar con pedal Bluetooth».

---

## 1. Cómo funciona hoy el «coro en vivo» de MCM App (comprobado)

- Nodo `/choirSessions/<choirId | código de 4 cifras>` =
  `{ v, master: {deviceId, name?, lastSeen}, playlist, current, createdAt,
  startedAt, updatedAt, lastActivity, expiresAt, choirId?, choirName? }`.
- El líder publica `current = {filename, transpose, capoOverride, screen,
  title, author, songKey, capo, content, firebaseCategory, updatedAt}` al abrir
  una canción (detalle o pantalla completa). Los seguidores escuchan **todo el
  nodo** con `onValue` y abren la canción con el `content` del líder (así
  funciona aunque no la tengan en su catálogo).
- 🐞 **Bug**: al cambiar tono o cejilla (`SongDetailScreen.tsx:661-666,
  703-707`) se hace `update({current: {filename, transpose, screen}})`, que
  **reemplaza** `current` entero: se pierden `content`, `title` y
  `firebaseCategory`; en pantalla completa los seguidores dejan de seguir y
  quien entra después recibe la letra vacía. Arreglo en MCM App ya (ver
  `02` §8).
- Sin presencia (nadie sabe cuántos siguen), un solo líder, la lista del
  líder se copia **solo al unirse** (cambios posteriores no llegan), la
  caducidad real es 12 h + 12 h si hay actividad (los documentos dicen 24 h).
- La contraseña `coco` para tomar el mando se comprueba **en el cliente**.
- Sin conexión: el SDK de Firebase no guarda nada en disco; el seguidor se
  queda en la última canción y no hay alternativa local.

## 2. Qué tiene que hacer el directo del fork

1. **Seguir**: el seguidor cambia de canción solo, sin tocar nada, en < 1 s.
2. **Varios maestros** (villancicos: 1-3) sin pisarse.
3. **Avisos** del maestro: cinta abajo que no tapa la letra, destello de
   atención, dirigidos a todos o a un instrumento, predefinidos de 1 toque.
4. **Reacciones** de todos, discretas y silenciables.
5. **Presencia**: el maestro ve cuántos le siguen y con qué instrumento.
6. **Dos caminos a la vez**: nube (Firebase) y wifi local (sin internet).
   El seguidor usa el que llegue primero.
7. **Resistente**: si se cae la red, el seguidor sigue con lo último y con
   su catálogo local; al volver, se pone al día solo.
8. **Compatible con MCM App**: un móvil con MCM App puede seguir a un
   maestro del fork (canción a canción, sin avisos) porque lo nuevo es
   **aditivo** sobre `/choirSessions`.

## 3. Protocolo (independiente del camino)

Todo el directo es un **estado** del maestro más **eventos** sueltos. Un
reductor puro (`liveReducer`) aplica lo que llega; los dos caminos (nube y
local) solo transportan estos mensajes. Con tests puros.

```ts
// Estado autoritativo (lo último manda por `seq`)
type LiveState = {
  sessionId: string;             // la clave en /choirSessions
  seq: number;                   // sube en cada cambio del maestro
  repertorio: { id: string; hash: string; items: RepertorioItem[] };
  index: number;                 // canción actual en el repertorio
  song: { category: string; filename: string; contentHash: string;
          transpose?: number; capo?: number };
  section?: number;              // v2: estrofa/estribillo actual (opcional)
  by: { deviceId: string; name?: string };
  catalogUpdatedAt: number;      // versión del cantoral del maestro
  at: number;
};

type LiveEvent =
  | { t: 'aviso'; id: string; kind: 'cinta' | 'destello' | 'cuenta';
      text: string; preset?: string; to?: 'todos' | Instrumento;
      ttlMs: number; from: string; at: number }
  | { t: 'reaccion'; e: string; from: string; at: number }
  | { t: 'apunte'; apunte: Apunte; from: string; at: number }   // ver 05
  | { t: 'fin'; at: number };
```

- **Canción que el seguidor no tiene igual**: si el `contentHash` del
  maestro no coincide con el de su catálogo, el seguidor pide/usa el
  `content` que va en el repertorio de la sesión. Nunca se queda en blanco.
- **El repertorio se mantiene al día**: si el maestro lo cambia durante el
  directo (añade una canción), llega a todos (hoy solo se copia al unirse).
- **Cantoral más nuevo en el maestro**: si `catalogUpdatedAt` del maestro >
  el del seguidor, se le ofrece «El maestro tiene un cantoral más nuevo ·
  Actualizar» — por la nube si hay internet, o **por la wifi local desde el
  propio móvil del maestro** si no (§5.4).

## 4. Camino 1: la nube (Firebase) — para Villancicos

Sobre el mismo nodo, **solo campos nuevos** (MCM App los ignora) — decisión D-10 (la alternativa es un nodo nuevo `/cantoralLive`, que rompe la compatibilidad con MCM App):

```
/choirSessions/<clave>
  master, current, playlist, …           ← lo de siempre (lo sigue leyendo MCM App)
  v: 2
  state: LiveState                        ← estado completo del protocolo
  masters/<deviceId>: { name, at }        ← varios maestros
  masterPinHash: "…"                      ← PIN de maestro (huella)
  presence/<deviceId>: { name?, inst?, app: 'cantoral'|'mcmapp', at }
  avisos/<pushId>: LiveEvent(aviso)       ← se podan: solo los últimos 20
  reacciones/<pushId>: LiveEvent(reaccion)← se podan: solo el último minuto
```

- **Escribir `current` como siempre** además de `state`, para que MCM App
  siga funcionando de seguidor. Y escribirlo **campo a campo** (el bug).
- **Avance de canción** con transacción sobre `state/seq`: si dos maestros
  pulsan a la vez, gana uno y el otro ve el resultado.
- **Presencia** con `onDisconnect().remove()` + latido cada 30 s; el
  contador del maestro cuenta los vistos en el último minuto.
- **Suscripciones separadas** (`state`, `avisos` con `limitToLast(20)`,
  `reacciones` con `limitToLast(30)`, `presence` solo el maestro) en vez de
  `onValue` del nodo entero: menos datos por cambio.
- **Ritmo**: reacciones agregadas en el cliente y como mucho 1 por segundo
  por dispositivo; avisos sin límite para maestros.
- **Caducidad**: se mantiene la de hoy (y se documenta la real).
- Reglas: hoy `choirSessions/$code` permite escribir a cualquiera con la
  clave; **no hace falta tocarlas para Villancicos**. Más adelante, con el
  `uid` anónimo (`06`), se puede exigir `auth != null` y limitar `state`
  a `masters`.

### Maestros y PIN (D-08)

- Quien crea el directo es maestro y ve un **PIN de 4 cifras** y un **QR de
  maestro**. Quien lo escanee o lo escriba entra como maestro
  (`masters/<deviceId>`). Seguir no pide nada.
- «Ceder el mando» y «dejar de dirigir» desde el menú del maestro.
- Para Villancicos: el directo del evento se crea antes (clave fija en
  `cantoralConfig.event.liveKey`) y los 2-3 maestros entran con el PIN. Los
  demás pulsan «Unirme» en la tarjeta del evento.

## 5. Camino 2: wifi local sin internet — Fase 5 (o antes si D-07)

### 5.1 Cómo

- El móvil/iPad del maestro abre un **servidor local** (WebSocket o TCP con
  líneas JSON) y se **anuncia por Bonjour/mDNS** (`_mcmcantoral._tcp`).
- Los seguidores ven «Cerca de ti: Coro X — dirige David» y se conectan. Si
  la red bloquea el descubrimiento (pasa en wifis de hotel/parroquia con
  aislamiento), el QR del directo lleva también `ip:puerto`.
- Mismo protocolo que la nube. El maestro publica **por los dos caminos a la
  vez** si tiene internet; el seguidor descarta duplicados por `seq`.
- **Librerías** (investigación del 21/11/2026, ver `README.md` §7):
  - Servidor y cliente: **`react-native-tcp-socket`** 6.4.3 (mantenida, iOS
    y Android, `Server.listen()`). Es un módulo del puente antiguo que va por
    la capa de compatibilidad de la Nueva Arquitectura: **probarlo en una
    build de desarrollo de SDK 58 el primer día**.
  - Descubrimiento: **`react-native-zeroconf`** 1.0.0-rc (módulo C++ de la
    Nueva Arquitectura, RN ≥ 0.82, Expo ≥ 55), publica y busca servicios.
  - Mensajes en JSON por líneas (o con prefijo de longitud), latido y
    reconexión automática: iOS suspende los sockets en segundo plano, así
    que se reconecta al volver a primer plano.
  - **Plan B**: módulo Expo propio y pequeño (`modules/live-local/`) con
    `NWListener`/`NWBrowser` de Network.framework en iOS (Bonjour y WebSocket
    incluidos) y `NsdManager` + `ServerSocket` en Android.
  - **Descartado**: UDP broadcast (librería sin mantener y en iOS exige un
    permiso especial de Apple), Multipeer/Nearby (**no hablan entre iOS y
    Android**: lo dice la propia `expo-nearby-connections`), y BLE (sin modo
    periférico decente y no aguanta 60 conexiones).
- **La web no puede seguir por wifi local** (un navegador no abre TCP, y una
  página HTTPS no puede abrir `ws://` a una IP local). En la web, solo nube.

### 5.2 Permisos

- **iOS** (nota técnica TN3179 de Apple): `NSLocalNetworkUsageDescription`
  y `NSBonjourServices` (`_mcmcantoral._tcp`) en `app.config.ts`. Piden
  permiso de «red local» los **seguidores** (conectar) y cualquier
  operación Bonjour; el **maestro escuchando no**. El aviso sale una vez y
  iOS puede negar la primera operación antes de que la persona conteste:
  hay que reintentar. Explicarlo antes con una pantalla propia. El
  simulador no lo implementa: probar en dispositivos. **No hace falta** el
  permiso especial de multicast (Bonjour del sistema no lo necesita).
- **Android**: hoy basta `INTERNET`. **Android 17 (targetSdk 37)** exige
  `ACCESS_LOCAL_NETWORK` en tiempo de ejecución para TCP local entrante y
  saliente; el seguidor puede evitarlo con el selector del sistema de NSD.
  Comprobar el targetSdk de SDK 58.
- Wifis de invitados con **aislamiento de clientes** hacen imposible el
  P2P: detectarlo y sugerir el router de viaje.

### 5.3 Dónde no hay wifi (la calle)

- **Punto de acceso del móvil del maestro**: **no fiable**. El de un iPhone
  admite pocos dispositivos (Apple no publica cifra; contar con ~5) y,
  **desde iOS 18, el IPv4 entre clientes del punto de acceso dejó de
  funcionar** (Apple recomienda no depender de él). Android: hasta ~10.
  Si se usa: dirección por Bonjour, nunca fija, y con IPv6.
- **Router de viaje** (30-40 €, con batería externa): la opción seria para
  un coro de más de ~8 personas sin internet. Recomendación de compra, no
  de código.
- En la práctica, en Villancicos casi todo el mundo tiene datos: la nube
  sirve, y la wifi local es el plan B (decisión D-07).

### 5.4 Pasar el cantoral por la wifi local

- En la conexión, el seguidor dice su `catalogUpdatedAt`. Si es más viejo
  que el del maestro, se le ofrece; si acepta, el maestro le manda el
  catálogo (300-400 KB hoy; con Navidad, ~0,5 MB) en trozos con su sha256,
  y se aplica con la misma escritura atómica del catálogo (`02` §3.2).
- **Siempre se ofrece, nunca se impone**, y **nunca a mitad de canción**: se
  aplica al terminar el directo salvo que el seguidor lo pida ya. Las
  canciones del repertorio en curso ya le llegan con el estado (§3).

## 6. Avisos (estilo «stage message» de ProPresenter)

| Tipo | Cómo se ve en los seguidores | Ejemplo |
| ---- | ---------------------------- | ------- |
| **Cinta** | Franja abajo, encima de la barra, letra grande; **empuja** la hoja hacia arriba mientras está (no la tapa); se va sola a los 8 s o al tocarla | «Repetimos el estribillo» |
| **Destello** | La cinta + el borde de la pantalla late 2 veces + vibración (con «reducir movimiento»: borde fijo) | «¡Más fuerte!» |
| **Cuenta** | Cinta con cuenta atrás | «Empezamos en 2 min» |

- **Dirigidos**: a todos o a un instrumento («Bajos: fuera»). Quien no es de
  ese instrumento no lo ve.
- **Predefinidos de 1 toque** en la rejilla del maestro. Por defecto: «Más
  fuerte», «Más suave», «Repetimos estribillo», «Última estrofa», «Solo
  voces», «Todos», «Atención», «Pausa», «Seguimos», «Cambio de tono».
  Los de Villancicos vienen de `cantoralConfig.livePresets` («¡Hucha!»,
  «Cambio de bloque», «Feliz Navidad final»…). Más un campo libre.
- El maestro ve qué mandó y cuándo; el seguidor tiene un historial corto.

## 7. Reacciones

- 🔥 🙌 👏 😂 🎄 ❤️ (la lista sale de `cantoralConfig`; en Navidad, con 🎄).
- Suben por un **carril estrecho a la derecha**, como mucho 5 a la vez, y se
  agregan («🔥×12»). Nunca sobre la letra.
- Silenciables por cada uno; el maestro puede apagarlas para todos.
- Son lo único del directo que **no** es crítico: si van mal, se apagan.

## 8. Pedal Bluetooth y teclado

Hoy: dentro de la hoja (WebView) hay un `keydown` que pasa página con
flechas, AvPág/RePág, espacio e Intro; los atajos de la app
(`useKeyboardShortcut`) **solo funcionan en web**. En iOS/Android **no hay
captura nativa de teclas**: el pedal solo funciona si el WebView tiene el
foco, y no se le da. **No está garantizado que un pedal funcione en móvil.**

Plan:

1. **`expo-key-event`** 1.9.0 (módulo Expo, iOS/Android/web, Nueva
   Arquitectura): una vista oculta con el foco recibe las teclas (iOS
   `pressesBegan`, Android `onKeyDown`) y las manda a JS con códigos tipo
   web (`ArrowRight`, `PageDown`, `Enter`…). **Ojo**: un campo de texto, un
   modal o una hoja le roban el foco; hay que volver a escuchar al
   cerrarlos (hook `usePedal` que lo haga solo).
   **Plan B** (más robusto): módulo propio de ~100 líneas con `UIKeyCommand`
   y `wantsPriorityOverSystemBehavior = true` en iOS (si no, desde iOS 15
   las flechas se las come el sistema) y `dispatchKeyEvent` en Android vía
   plugin de configuración.
2. Mapeo por defecto, **todas las teclas comunes** (cada pedal y cada modo
   manda unas: los AirTurn traen flechas en un modo y AvPág/RePág en otro):
   derecha/abajo/AvPág/espacio/Intro = **siguiente página, y al final,
   siguiente canción**; izquierda/arriba/RePág = atrás. Pulsación larga =
   canción siguiente/anterior. Ajustes → «Pedal» con «pulsa el pedal para
   probar».
3. Para el maestro, pasar de canción con el pedal **publica** en el directo.
4. Con un pedal conectado **iOS esconde el teclado en pantalla** (la
   búsqueda no sale): avisarlo en Ajustes → Pedal (los pedales tienen un
   botón para alternar).
5. **Botones de volumen como pedal**: en iOS va contra la norma 2.5.9 de
   Apple (no alterar los botones físicos) y no detecta pulsaciones con el
   volumen al tope. Como mucho, opción **solo Android** (decisión D-17).
6. **Probar con un pedal real en iPad y en Android** antes de dar por
   buena la fase (está pendiente desde `PLAN_HOJA_CANCION.md`).

## 9. Tamaño y pantalla en directo

- Al entrar en directo: pantalla siempre encendida (ya existe por foco),
  tema Escenario, controles a 56 pt, y **«Ajustar a la pantalla»** (la hoja
  ya sabe repartir en columnas y achicar hasta un 20 % en iPad).
- El tamaño de letra se guarda **por tipo de pantalla** (móvil / tablet),
  porque la misma persona usa los dos.
- iPad: horizontal con columnas; consola del maestro (`03` §4.4). **SDK 58
  compila con el SDK de iOS 27 y las apps de iPad pasan a ser
  redimensionables sí o sí**: nada de bloquear la orientación; la
  maquetación responde al tamaño de la ventana (Split View, Stage Manager).
- **Brillo** (opcional, «Subir brillo en directo»): `expo-brightness`. En
  iOS cambia el brillo **del sistema**: guardar el anterior y devolverlo al
  salir y al pasar a segundo plano.
- Sugerir «No molestar» y «Acceso guiado» (la app no puede activarlos).

## 10. Ideas para después (no entran en Villancicos)

- **Sección actual**: el maestro toca «estribillo» y a los seguidores se les
  resalta/desplaza ahí (`state.section`).
- **Pulso compartido**: el metrónomo del maestro como pulso visual en todos.
- **Pantalla grande**: un dispositivo en modo «proyección» (solo letra,
  enorme) conectado a una tele o proyector, siguiendo el directo.
- **«Canta con nosotros»**: un QR en la hucha para que el público abra la
  web y vea la letra que se está cantando (seguidor de solo lectura, sin
  instalar nada).
- **Aviso al abrir**: «Tu coro está en directo» como notificación (necesita
  push; hoy el fork no lo lleva).

## 11. Tareas

| # | Tarea | Fase | Modelo |
| - | ----- | ---- | ------ |
| 4.0 | Arreglo del bug de `current` y caducidad documentada en MCM App | pre-fork | Sonnet |
| 4.1 | `liveReducer` + tipos + tests (orden por `seq`, duplicados, canción sin hash, repertorio vivo) | 3 | Opus |
| 4.2 | Camino nube: `state`, `masters`, PIN, transacción de avance, presencia con `onDisconnect`, suscripciones separadas, compatibilidad `current` | 3 | Opus |
| 4.3 | UI seguidor: píldora de estado, ir por libre/volver, cinta, destello, reacciones | 3 | Opus |
| 4.4 | UI maestro: barra, rejilla de avisos, presencia, ceder mando; consola iPad | 3 | Opus |
| 4.5 | Pedal: captura nativa de teclas + mapeo + prueba | 3 | Opus |
| 4.6 | Prueba de carga: 1 maestro + 30 seguidores simulados (web) en la nube | 3 | Sonnet |
| 4.7 | Camino local: servidor + Bonjour + QR con ip + mismo protocolo + doble camino | 5 (o 3 si D-07) | Opus |
| 4.8 | Pasar el cantoral por la wifi local | 5 | Opus |
