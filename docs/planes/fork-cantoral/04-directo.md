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
6. **Dos caminos a la vez**: **wifi local** (el router del evento, con o sin
   internet) y nube (Firebase). El seguidor usa el que llegue primero. En
   Villancicos **manda la wifi local** (decisión D-07: hay router para la
   mesa de sonido); la nube es el respaldo si el router tiene internet o
   alguien se queda fuera de la wifi.
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
  section?: number;              // estrofa/estribillo actual (seguir por sección, §10)
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
  equipo base o el maestro** si no (§5.6).
- **Sin congelar** (decisión D-21): si llega un cantoral nuevo durante el
  directo, se aplica al momento. Si cambia la canción que se está viendo, se
  repinta **en el mismo sitio** (misma canción, misma posición, mismo tono)
  con un aviso discreto «Canción actualizada». Nunca salta de canción.

## 4. Camino 1: la nube (Firebase)

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

- Quien crea el directo **pone un PIN de 4 cifras** (muy fácil, decisión del
  usuario) y ve además un **QR de maestro**. Quien escriba el PIN o escanee
  el QR entra como maestro (`masters/<deviceId>`). Seguir no pide nada.
- El PIN vale igual por la wifi local que por la nube: va en el estado como
  huella (`masterPinHash`) y lo comprueba quien recibe la orden (el equipo
  base o cualquier seguidor).
- «Ceder el mando» y «dejar de dirigir» desde el menú del maestro.
- Para Villancicos: el directo del evento se crea antes (clave fija en
  `cantoralConfig.event.liveKey`) y los **3-4 maestros** entran con el PIN.
  Los demás pulsan «Unirme» en la tarjeta del evento.

## 5. Camino 2: wifi local — **entra para Villancicos** (D-07)

### 5.1 Cómo

- Un dispositivo hace de **servidor local** (TCP con mensajes JSON por
  líneas o con prefijo de longitud) y se **anuncia por Bonjour/mDNS**
  (`_mcmcantoral._tcp`, con la clave del directo en el registro TXT).
- Los seguidores ven «Cerca de ti: Villancicos Solidarios — dirige David» (o
  entran directos desde la tarjeta del evento) y se conectan. Si la red
  bloquea el descubrimiento, el QR del directo lleva también `ip:puerto`
  (IPv4 e IPv6), y se puede imprimir y pegar en el atril.
- Mismo protocolo que la nube. Se publica **por los dos caminos a la vez**
  si hay internet; el seguidor descarta duplicados por `seq`.
- **Librerías** (investigación del 21/11/2026, ver `README.md` §7):
  - Servidor y cliente: **`react-native-tcp-socket`** 6.4.3 (mantenida, iOS
    y Android, `Server.listen()`). Es un módulo del puente antiguo que va por
    la capa de compatibilidad de la Nueva Arquitectura: **spike el primer
    día de la Fase 0** con dos móviles reales.
  - Descubrimiento: **`react-native-zeroconf`** 1.0.0-rc (módulo C++ de la
    Nueva Arquitectura, RN ≥ 0.82, Expo ≥ 55), publica y busca servicios.
  - Latido cada 5 s y reconexión automática: iOS suspende los sockets en
    segundo plano, así que se reconecta al volver a primer plano.
  - **Plan B** (si el spike falla, desde ese mismo día): módulo Expo propio y
    pequeño (`modules/live-local/`) con `NWListener`/`NWBrowser` de
    Network.framework en iOS (Bonjour y WebSocket incluidos) y `NsdManager`
    + `ServerSocket` en Android. Skill `expo-module`.
  - **Descartado**: UDP broadcast (librería sin mantener y en iOS exige un
    permiso especial de Apple), Multipeer/Nearby (**no hablan entre iOS y
    Android**), BLE (no aguanta 60 conexiones) y el punto de acceso del
    móvil (§5.5).
- **La web no puede seguir por wifi local** (un navegador no abre TCP, y una
  página HTTPS no puede abrir `ws://` a una IP local). En la web, solo nube.

### 5.2 Quién sirve: equipo base y relevo

**Problema**: en iOS una app en segundo plano o con la pantalla bloqueada
**deja de servir**. Si el servidor es el móvil de un maestro y lo bloquea o
recibe una llamada, se cae el directo para todos.

**Solución en dos capas**:

1. **Equipo base** (recomendado para el evento): un móvil o tablet
   **enchufado junto al router**, con la app abierta en modo «Equipo base»
   (pantalla siempre encendida, brillo bajo). Es el servidor: guarda el
   estado, lo reparte, recibe las órdenes de los maestros (que se conectan a
   él como clientes con PIN) y pasa el cantoral a quien lo pida. Puede
   enseñar en grande la canción actual y quién está conectado (sirve de
   monitor para la mesa de sonido). Un Android viejo vale; mejor Android que
   iOS para esto (no tiene el permiso de red local para servir y aguanta
   mejor en primer plano).
2. **Relevo automático**: cada maestro conectado tiene una copia del estado.
   Si el servidor deja de contestar (3 latidos), el maestro con la prioridad
   más alta (orden de entrada) **abre su propio servidor** con la misma clave
   y el mismo `seq`, y los seguidores, que lo ven por Bonjour, se pasan
   solos. Sin equipo base también funciona así (el primer maestro sirve),
   con el aviso «No bloquees este móvil: estás sirviendo el directo».

### 5.3 El router del evento (lo que tiene que cumplir)

El usuario tiene dos o tres routers para la mesa de sonido. Para que sirvan:

- **Una sola red** (mismo SSID y misma subred) para todos. Si se usan dos o
  tres routers, **uno con DHCP y los demás en modo punto de acceso
  (puente)** en la misma red: si cada uno hace su propia red, los móviles
  de un router no ven a los del otro.
- **Aislamiento de clientes desactivado** («AP isolation», «client
  isolation», «red de invitados»: nada de eso).
- **Multicast/mDNS permitido** (Bonjour). Si no, el QR con IP lo salva.
- **DHCP con sitio para ~100 dispositivos** (concesión corta, 1-2 h) y
  canales de 2,4 y 5 GHz.
- Con internet o sin él: con internet, además, funciona la nube en paralelo.
- Contraseña sencilla impresa en la hucha/atril, junto al QR del directo.
- **Se prueba en el ensayo** con el mismo router y 10+ móviles.

La app ayuda: si un seguidor está en una wifi pero no encuentra el
directo en 10 s, le dice «¿Estás en la wifi del coro (nombre)? ¿Escaneas el
QR?» y, si tiene datos, se va por la nube.
### 5.4 Permisos

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
  P2P: detectarlo y decirlo (§5.3).
- **Pedir el permiso antes del evento**: el onboarding del modo Navidad
  incluye «Probar la conexión del coro» para que el aviso de red local de
  iOS salga en casa y no en la calle.

### 5.5 Sin router (para otros usos)

- **Punto de acceso del móvil del maestro**: **no fiable**. El de un iPhone
  admite pocos dispositivos (Apple no publica cifra; contar con ~5) y,
  **desde iOS 18, el IPv4 entre clientes del punto de acceso dejó de
  funcionar** (Apple recomienda no depender de él). Android: hasta ~10.
  Si se usa: dirección por Bonjour, nunca fija, y con IPv6.
- Un coro sin router y sin internet: un router de viaje (30-40 €). Para
  Villancicos no hace falta (ya hay router).

### 5.6 Pasar el cantoral por la wifi local

- En la conexión, el seguidor dice su `catalogUpdatedAt`. Si es más viejo
  que el del maestro, se le ofrece; si acepta, el maestro le manda el
  catálogo (300-400 KB hoy; con Navidad, ~0,5 MB) en trozos con su sha256,
  y se aplica con la misma escritura atómica del catálogo (`02` §3.2).
- **Se ofrece con un toque** («El maestro tiene un cantoral más nuevo ·
  Actualizar») y, al aceptarlo, se aplica al momento (D-21) repintando la
  canción actual en el mismo sitio. Ajuste «Actualizar siempre sin
  preguntar». Las canciones del repertorio en curso ya llegan con el estado
  (§3), así que nadie se queda sin la canción aunque diga que no.
- Los envíos se escalonan (no 60 a la vez) y se reanudan si se corta.
- El equipo base guarda el cantoral más nuevo que haya visto (el suyo o el de
  un maestro) y es quien lo reparte.

## 6. Avisos (estilo «stage message» de ProPresenter)

**Es lo más importante del directo después de seguir** (decisión D-18: «sobre
todo para que los maestros manden avisos»). Las reacciones (§7) son un extra.

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
5. **Botones de volumen como pedal** (decisión D-17: **en las dos
   plataformas**): `react-native-volume-manager` 2.2 (Nueva Arquitectura)
   con el indicador de volumen del sistema escondido. Subir = siguiente,
   bajar = anterior. Opción en Ajustes → Pedal, apagada de serie. Matices:
   en iOS solo se ven *cambios* de volumen (con el volumen al tope, «subir»
   no llega: la app lo deja a media escala al activar la opción), y va contra
   la norma 2.5.9 de Apple: por eso hay un **interruptor remoto**
   `cantoralConfig.volumeButtons = { ios: true, android: true }` para
   apagarlo en iOS sin build si la revisión se queja.
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

## 10. Para el evento, después de lo básico

En este orden; si el tiempo aprieta, caen por el final.

1. **Seguir por sección** (D-20, «si mola»): el maestro toca el bloque de la
   canción que se está cantando (estrofa 2, estribillo…) o pasa con el pedal
   de sección en sección, y a los seguidores **se les desplaza y resalta**
   ese trozo. Va en `state.section` (índice de sección de `buildSheet`) y la
   hoja ya sabe hacer `scrollTo`. Si el seguidor está desplazando a mano, no
   se le mueve (solo se resalta).
2. **Cuenta atrás al cambio de bloque** (idea I-06, sí): el maestro (o el
   bloque, por su hora) lanza «Cambio de bloque en 2:00» y sale como cinta
   con cuenta atrás en todas las pantallas.
3. **Resumen al acabar** (idea I-07, sí): el equipo base (o el maestro)
   apunta cada canción con su hora de inicio y fin; al cerrar el directo,
   resumen: canciones cantadas, duración real de cada bloque frente a la
   prevista. Se puede compartir y guardar como repertorio («lo que cantamos
   en 2026») para preparar el año siguiente.

## 10 bis. Ideas para más adelante (contestadas «luego»)

- **«Canta con nosotros»** (I-01): QR en la hucha para que el público vea la
  letra en la web (seguidor de solo lectura por la nube).
- **Pantalla grande** (I-02): un dispositivo en modo «proyección» (solo
  letra, enorme) conectado a una tele o proyector. El equipo base ya es
  medio camino.
- **Aviso «Tu coro está en directo»** (I-04): notificación push (el fork hoy
  no lleva push).
- **Modo proyección para la misa** (I-08): solo letra para la asamblea.
- Descartadas: pulso compartido del metrónomo (I-03).

## 11. Tareas

| # | Tarea | Fase | Modelo |
| - | ----- | ---- | ------ |
| 4.0 | Arreglo del bug de `current` y caducidad documentada en MCM App | Pre-fork | Sonnet |
| 4.S | **Spike**: `react-native-tcp-socket` + `react-native-zeroconf` en una build de desarrollo SDK 58, dos móviles (iOS y Android) en la misma wifi: anunciar, descubrir, conectar, mandar 1.000 mensajes | 0 (día 1) | Opus |
| 4.1 | `liveReducer` + tipos + tests (orden por `seq`, duplicados, canción sin hash, repertorio vivo, relevo) | 3 | Opus |
| 4.2 | Camino nube: `state`, `masters`, PIN, transacción de avance, presencia con `onDisconnect`, suscripciones separadas, compatibilidad `current` | 3 | Opus |
| 4.3 | Camino local: servidor + Bonjour + QR con IP + mismo protocolo + doble camino | 3 | Opus |
| 4.4 | Equipo base (modo servidor/monitor) y relevo automático entre maestros | 3 | Opus |
| 4.5 | Pasar el cantoral por la wifi local (trozos, sha256, escalonado, reanudar) | 3 | Opus |
| 4.6 | UI seguidor: píldora de estado (wifi/nube/sin conexión), ir por libre/volver, cinta, destello, reacciones | 3 | Opus |
| 4.7 | UI maestro: barra, rejilla de avisos, presencia, ceder mando; consola iPad | 3 | Opus |
| 4.8 | Pedal (`expo-key-event` + hook que re-escucha) y botones de volumen con interruptor remoto | 3 | Opus |
| 4.9 | Prueba de carga: 1 equipo base + 3 maestros + 40 seguidores simulados en una red local (script en Node que habla el protocolo) y en la nube | 3 | Sonnet |
| 4.10 | Seguir por sección | 3 (si da tiempo) | Opus |
| 4.11 | Cuenta atrás de bloque y resumen al acabar | 3 | Sonnet |
