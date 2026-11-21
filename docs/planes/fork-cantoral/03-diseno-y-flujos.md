# 03 · Diseño y flujos — cómo se usa MCM Cantoral

> Parte del plan [`README.md`](README.md). Esto es lo que más hay que pensar:
> **la app es la misma funcionalidad que el cantoral de MCM App, pero no se
> parece a ella**. Las reglas de territorios y colores por sección de MCM App
> (`design.md` del monorepo, §2-§3) **no aplican**. Lo que sí se hereda es la
> forma de trabajar: tokens en el código, nada de hex sueltos, guardarraíles
> que fallan solos, nativo antes que custom.

---

## 1. Quién, dónde y con qué manos

Antes de una sola pantalla, las situaciones reales. Cada decisión de abajo
sale de una de estas:

| Situación | Dispositivo | Manos | Luz y ruido | Lo que pide |
| --------- | ----------- | ----- | ----------- | ----------- |
| **Estudiar en casa** | Móvil o iPad, sentado | Libres | Normal | Buscar rápido, escuchar la grabación, transponer, apuntar |
| **Preparar la misa del domingo** | Móvil (o el ordenador por la web) | Libres | Normal | Montar un repertorio por momentos, importar el del coro, tono por canción |
| **Ensayar en grupo** | iPad en el atril o móvil | Una ocupada (guitarra) | Parroquia, se habla | Apuntes para todos / para mi instrumento / para mí, saltar a una canción |
| **Actuar en directo (misa)** | iPad en atril, móvil en la mano | **Ocupadas tocando** | Penumbra, silencio | Cero toques: sigue al que dirige, pedal, letra grande, mis apuntes a la vista |
| **Villancicos Solidarios (8 h en la calle)** | Móvil, de pie | Frío, **guantes**, una mano | Sol o noche, ruido de calle | Unirse en 1 toque, avisos del maestro que se vean sin buscar, batería y datos que aguanten |
| **Maestro de villancicos** | Móvil o iPad | Una mano | Calle | Pasar canción en 1 toque, mandar «¡más fuerte!» en 1-2 toques, ver quién le sigue |

**Consecuencias directas** (no negociables):

- **Directo = cero toques para quien sigue y uno para quien dirige.** Todo lo
  demás de la app es secundario a esto.
- **Objetivos táctiles grandes en directo**: mínimo 56 pt (no 44) en los
  controles del atril y del maestro — guantes y prisa.
- **Contraste para sol y para penumbra**: el atril tiene «Escenario» (oscuro,
  negro real en OLED) y «Sol» (claro de contraste máximo) a un toque.
- **Pulgar abajo**: lo frecuente vive en la barra inferior, nunca en las
  esquinas de arriba.
- **Nada de texto pequeño en directo**: los avisos del maestro se leen a un
  metro.

---

## 2. Principios de diseño de MCM Cantoral

1. **El atril es la app.** Hay una sola vista de canción —el Atril— y es la
   misma al estudiar, al ensayar y en directo. El directo no es otra pantalla:
   es una capa encima del Atril (seguir, avisos, reacciones).
2. **Contexto, no modos.** No hay un interruptor «modo ensayo / modo
   concierto». La app ofrece lo que toca según lo que estás haciendo: abres un
   repertorio → «Empezar» y «Dirigir»; hay un directo de tu coro → sale arriba
   del todo con «Unirme».
3. **Nativo siempre.** API del sistema → `@expo/ui` (SwiftUI/Compose) →
   `heroui-native` → propio. Cabecera nativa, título grande, búsqueda nativa,
   menús contextuales nativos, hojas con detents nativos, Liquid Glass en
   iOS 26, Material 3 en Android.
4. **Sin barra de pestañas y sin FAB.** Una sola pila de navegación con
   **barras de herramientas inferiores de vidrio, contextuales por pantalla**
   (en iOS, la barra del sistema —como Notas o Mail en iOS 26—; en Android, la
   *floating toolbar* de Material 3 Expressive). Decisión del usuario: «me
   cargaría el FAB y que sean unos botones abajo».
5. **Lo personal no estorba.** Apuntes, tono y tamaño son tuyos y se ven
   siempre que quieras, pero nunca tapan la letra.
6. **Funciona sin red, siempre.** Todo el cantoral vive en el dispositivo
   desde la primera vez (ver [`02-datos-offline.md`](02-datos-offline.md)). La
   red solo añade (actualizar, directo por la nube, compartir).
7. **iPad no es un móvil grande.** En iPad hay barra lateral + atril, columnas
   en horizontal y atajos de teclado/pedal.

---

## 3. Arquitectura de información

```
Inicio  (una pila; título grande «Cantoral»)
├── Directo (tarjeta que solo sale cuando hay algo: «● Coro X — dirige David · Unirme»)
├── Repertorios ─► Repertorio ─► Atril (secuencial)
│                    ├── ▶ Empezar        (yo solo, pasando canciones)
│                    └── 📡 Dirigir       (abre un directo con este repertorio)
├── Cantoral ─► Categoría (con subcategorías) ─► Atril
├── Búsqueda (título, letra, autor, etiqueta) ─► Atril
└── Ajustes (hoja): Aa, notación, mi instrumento, mi coro, administrador…

Hojas a un toque desde donde haga falta: Afinador/Metrónomo · Tono · Apuntes ·
Avisos (maestro) · Unirse a un directo (QR / cerca de ti / código)
```

**Vocabulario de la interfaz** (decisión D-12): *Cantoral*, *Repertorio*
(lo que en MCM App es «Tu selección»/playlist; en datos sigue siendo
`playlist`), *Directo*, *Dirige / Maestro*, *Sigue*, *Aviso*, *Apunte*,
*Arreglo* (el `{arr:}` oficial de la canción, como en MCM App). *Bloque*
solo aparece **dentro de un evento** (los packs de villancicos). Todo tiene
que tener sentido en el **modo normal**, después de Navidad: la app es para
todo el año y el modo Navidad es una capa encima, no el centro.

---

## 4. Pantallas clave

Bocetos de intención, no de píxeles. Los píxeles se deciden en la maqueta
(§8) antes de programar.

### 4.1 Inicio

```
┌──────────────────────────────────────────┐
│ Cantoral                          (⚙︎)   │  ← título grande nativo
│ ┌──────────────────────────────────────┐ │
│ │ ● EN DIRECTO  Coro Consolación CS    │ │  ← solo si hay un directo de tu coro
│ │   dirige David · 14 siguiendo [Unirme]│ │     o uno cerca (wifi local)
│ └──────────────────────────────────────┘ │
│ Repertorios                    Ver todos │
│ [Eucaristía 23 nov · 12] [Ensayo · 8] →  │  ← el primero: el próximo / el último tocado
│ Cantoral                                 │
│  A  Entrada                         19 › │
│  B  Gloria                           7 › │
│  …                                       │
│ ★ Destacadas: [Adviento] [María] …       │
├──────────────────────────────────────────┤
│ (🔍 Buscar canción, letra o autor…) (♪) (+)│ ← barra inferior de vidrio
└──────────────────────────────────────────┘
```

- **Modo Navidad** (configurado desde Firebase, ver `02`): arriba sale la
  tarjeta del evento («Villancicos Solidarios · sáb 19 dic»): bloques con su
  hora, «Unirme al directo» grande, y la categoría Navidad con sus
  subcategorías encabeza el cantoral. Es **funcional**, no estético.
- (♪) abre Afinador/Metrónomo. (+) = nuevo repertorio / unirse a un directo
  / escanear QR (menú nativo).

### 4.2 Atril (la canción)

```
┌──────────────────────────────────────────┐
│ ‹  Noche de paz                  Sol · C2 │  ← cabecera mínima; se esconde en inmersivo
│                                          │
│   [letra con acordes — la hoja actual]   │
│   │ Intro: solo guitarra   ← {arr:}      │
│   ✎ Bajo: entra en el 2º estribillo ←apunte│
│                                          │
│ ┌ Aviso del maestro: ¡MÁS FUERTE! ─────┐ │  ← cinta (solo en directo); empuja, no tapa
├──────────────────────────────────────────┤
│ (‹)   3 / 12 ▾   (›)    (Aa) (♯♭) (✎) (⋯)│ ← barra inferior
└──────────────────────────────────────────┘
```

- **La hoja de canción de MCM App se queda** (`utils/songSheet*.ts`: cortes
  por frase, acordes que vuelan, columnas en iPad, modo atril con pedal,
  estribillos plegados). Es el mejor trabajo del cantoral y vive en la zona
  espejo (ver [`DIVERGENCIAS.md`](DIVERGENCIAS.md)). Lo que cambia es todo lo
  de alrededor: barra, cabecera, tema, capas.
- `3 / 12 ▾` abre la lista del repertorio en una hoja para saltar.
- **Inmersivo**: a los pocos segundos se apagan cabecera y barra (ya existe:
  `useImmersiveChrome`); un toque las devuelve. En directo como seguidor la
  barra se queda en una píldora mínima con el estado.
- **Aa**: tamaño, «Ajustar a la pantalla», Escenario/Sol/Sistema, acordes
  sí/no (cantantes), estribillos plegados.
- **♯♭**: tono y cejilla (de este repertorio si viene de uno).
- **✎**: capas de apuntes (Todos · Mi instrumento · Solo yo), ver `05`.
- **⋯**: compartir, PDF, enlaces y audios, editar (admin), informar de un
  fallito, afinador.

### 4.3 Repertorio

```
│ Eucaristía 23 nov             (Compartir)│
│ Coro Consolación CS · 12 · ~38 min       │
│  1 Entrada   Alma misionera   Re · C2  🎺│
│  2 Gloria    Gloria a Dios    Sol        │
│  ── Pausa: homilía ──                    │
│  …                                       │
├──────────────────────────────────────────┤
│   (▶ Empezar)      (📡 Dirigir)      (⋯) │
```

- Cada elemento lleva **tono, cejilla, notas** de ese día (el formato de los
  packs de villancicos, ver `02`) y puede ser una **pausa** («presentación de
  la hucha», «homilía»).
- Importar: la última de mi coro (1 toque), QR, enlace, archivo `.mcm`,
  **o desde un directo** («Guardar este repertorio» al terminar).
- Montar: por momentos de la misa (las categorías ya son momentos: Entrada,
  Gloria, Salmo…), con «Cantos para el domingo» como sugerencia.

### 4.4 Directo — quien dirige

- Al pulsar «Dirigir»: una hoja con el PIN de 4 cifras y **por dónde va el
  directo** — *Los dos* (marcado de serie) · *Solo wifi del coro* · *Solo
  internet* (`04` §2 bis). Un toque más y empieza.

- En móvil: el mismo Atril con la barra del maestro: **‹ ›** grandes,
  **📣 Avisos** (rejilla de avisos predefinidos, 1 toque = enviado),
  **👥 14** (quién sigue, con su instrumento), menú con «Ceder/compartir el
  mando» y «Cerrar el directo».
- En iPad horizontal: **consola** de dos columnas — repertorio a la
  izquierda (tocar = mandar esa canción), atril a la derecha, avisos abajo.
- El pedal pasa página y, al final de la canción, pasa de canción (ya
  existe en el modo atril de pantalla completa).
- **Secciones**: un toque en un trozo de la letra = «estamos aquí»; el
  botón ¶ abre la lista de secciones de la canción para anunciar «ahora
  hacemos esta estrofa / este puente» (`04` §10).

### 4.5 Directo — quien sigue

- Unirse: tarjeta de Inicio, «Cerca de ti» (wifi local), QR o enlace. La
  primera vez pregunta tu nombre (opcional) y **tu instrumento** (para los
  avisos dirigidos y la capa de apuntes).
- El Atril cambia solo de canción. Píldora «● Siguiendo a David» con el
  estado de la conexión (nube / wifi local / sin conexión, «última canción
  recibida hace 2 min»).
- **Ir por libre**: puedes mirar otra canción; la píldora pasa a «Volver al
  directo» y un toque te devuelve.
- **Avisos**: cinta abajo que empuja la letra (no la tapa), destello opcional
  del borde + vibración para «atención». Se apagan solos.
- **Reacciones**: 🔥 🙌 👏 😂 🎄 ❤️ suben por un carril estrecho a la derecha,
  agregadas («🔥×12»). Se pueden silenciar.

---

### 4.6 Equipo base (el servidor del directo por wifi local)

Un móvil o tablet enchufado junto al router (ver `04` §5.2). Pantalla
pensada para mirarla de lejos desde la mesa de sonido:

- Arriba, grande: **canción actual** y la siguiente, con su tono.
- Bloque en curso, hora prevista frente a la real, cuenta atrás al cambio.
- **Conectados**: cuántos por wifi y cuántos por la nube, y qué maestros.
- Estado del router (red, IP) y el **QR del directo** para quien llegue.
- Brillo bajo y pantalla siempre encendida; un toque largo para salir (que
  nadie lo cierre sin querer).

## 5. Flujos (con el número de toques como métrica)

| Flujo | Camino | Toques objetivo |
| ----- | ------ | --------------- |
| Unirme al directo de mi coro (o del evento) | Abrir app → **Unirme** | **1** |
| Montar el equipo base | (+) → Directo → «Este dispositivo es el equipo base» | 3, una vez |
| Unirme a un directo por QR | Abrir app → (+) → Escanear → apuntar | 2 + apuntar |
| Pasar canción (maestro) | **›** o pedal | **1** (0 con pedal al final de página) |
| Pasar canción (seguidor) | — | **0** |
| Mandar «¡Más fuerte!» | 📣 → «Más fuerte» | **2** |
| «Ahora hacemos el puente» (maestro) | ¶ → «Puente» | **2** |
| Encontrar una canción | Barra → escribir 3 letras → tocar | 1 + texto |
| Importar la última de mi coro | Inicio → Repertorios → «Traer la última» | 2 |
| Montar y dirigir la misa | Repertorio → 📡 Dirigir → Empezar (PIN y «los dos» ya puestos) | 2 desde el repertorio |
| Apuntar «entra el bajo aquí» | Toque largo en la línea → escribir → capa | 2 + texto |

Un flujo nuevo no entra si su camino crítico pasa de estos números sin
justificarlo en `DIVERGENCIAS.md`.

---

## 6. Identidad visual — maqueta con A y B; el estilo lo cierra Izan

**Decisión D-05**: se hace la maqueta con las direcciones **A y B** y se
decide sobre ella. **Izan acabará de decidir el estilo**; lo que se haga
aquí es la base. Y **aprovechar lo nativo** (Liquid Glass, materiales,
controles y menús del sistema): cuanto más nativo, menos estilo propio hay
que mantener.

Consecuencia técnica: el tema vive **entero en tokens**
(`constants/theme.ts`: colores por rol en claro, oscuro, Escenario y Sol;
radios; tipografía de la hoja), y las pantallas solo usan roles. Así el
estilo final de Izan entra cambiando tokens, sin tocar pantallas.

Ninguna usa el azul MCM ni la paleta por secciones. Las tres comparten
tipografía del sistema para la interfaz (nativo) y la hoja de canción con su
letra elegible.

| | **A · Escenario** (en la maqueta) | **B · Rúbrica** (en la maqueta) | **C · Nativo puro** (descartada como dirección; sus piezas nativas se usan en las dos) |
| - | ------------------------------- | --------------- | ------------------- |
| Idea | El atril de noche: tinta casi negra y una luz cálida de vela | El libro de cantos: papel, tinta y el rojo de las rúbricas del misal | Colores del sistema con un solo acento |
| Modo por defecto | Oscuro primero (claro bien hecho también) | Claro primero | El del sistema |
| Acento | Ámbar cálido (acordes, acción principal) | Rojo litúrgico (acordes, títulos de sección) | Un tono del sistema (p. ej. índigo) |
| Fuerte en | Directo en penumbra, calle de noche, batería OLED | Estudiar, imprimir, aire «de cantoral» | Coste cero, se ve «de Apple/Google» |
| Débil en | Al sol necesita el tema «Sol» | El rojo recuerda al acento de MCM App | Poca personalidad: «otra app más» |

Recomendación de partida para la maqueta: **A**, porque el caso crítico
(directo) es de penumbra y de calle. En directo el Atril pasa a
«Escenario» solo (negro real), y «Sol» queda a un toque — eso se mantiene
gane la dirección que gane.

Reglas que se mantienen con cualquier dirección:

- Acordes distinguibles **también sin color** (peso/estilo), por daltonismo.
- Contraste de la letra ≥ 7:1 en el Atril (AAA), no solo 4,5.
- Tokens en `constants/theme.ts` del fork, con su test de contraste y el
  trinquete de números mágicos heredado (se reescriben los valores, se
  conserva el mecanismo).
- **Icono** (D-06): Claude propone opciones **en Canva** (hay conector) con
  la dirección elegida, y se termina allí con Izan; se exporta a 1024 px y
  se generan los tamaños con el script de iconos. Nombre en tienda:
  **MCM Cantoral**.

---

## 7. Plataforma: lo nativo concreto

| Pieza | iOS | Android | Web |
| ----- | --- | ------- | --- |
| Navegación | Una `Stack` de expo-router, título grande | Igual, top app bar M3 | Igual |
| Barra inferior | `Stack.Toolbar` en la parte de abajo (UIToolbar con Liquid Glass) — **verificar en el spike de Fase 0** que expo-router 58 la ofrece; si no, `GlassActionGroup` existente | *Floating toolbar* M3 (vía `@expo/ui` Compose si está; si no, propia sobre `GlassSurface` sólido) | Barra fija abajo |
| Búsqueda | `headerSearchBarOptions` (en iOS 26, abajo) | Search bar M3 | Campo |
| Menús | Menú contextual nativo (`Stack.Toolbar.Menu`, `@expo/ui`) | Menú M3 | Menú web |
| Hojas | `formSheet` con detents | Bottom sheet M3 con asa | Modal |
| iPad | Barra lateral + atril (split), Stage Manager por tamaño de ventana | Tablets: igual | — |
| Teclado/pedal | Captura nativa de teclas (ver `04`) | Igual | `keydown` (ya existe) |
| Iconos | SF Symbols (`IconSymbol`) | Material Symbols | Material |

Se eliminan: `expo-native-compact-tabs`, `CompactTabBar`, `TabScreenWrapper`
y todo `components/tabs/`, el FAB de canción (`SongControls`) como FAB — sus
acciones se reparten entre la barra inferior y el menú ⋯.

---

## 8. Proceso de diseño (antes de programar pantallas)

1. **Maqueta** de 6 pantallas en móvil y iPad —Inicio (normal y modo
   Navidad), Atril, Atril en directo (seguidor con aviso), Consola del
   maestro, Repertorio, Equipo base— en las direcciones A y B, como artefacto
   de diseño compartible con **Izan**, que cierra el estilo (D-05).
   **Hecha el 21/11/2026**: <https://claude.ai/artifact/TBGfc98GLHTma1vhY1wqHa>
   (lienzo con las dos filas, A arriba y B abajo: Inicio en modo Navidad,
   Atril siguiendo al maestro, maestro en el móvil —avisos en A, «ahora
   hacemos…» en B— y consola del maestro en iPad; cada pantalla tiene un
   ajuste de color de acento para probar variantes). Para que la vea Izan,
   hay que compartirla desde su menú «Compartir».
2. Se escribe el **`design.md` del fork** (prescriptivo, corto, como el del
   monorepo pero con sus propias reglas) y `constants/theme.ts`.
3. Guardarraíles: contraste de tokens, trinquete de números mágicos, sin
   rayitas de color en bordes (se heredan las que apliquen), y uno nuevo:
   **ningún control del Atril en directo por debajo de 56 pt**.
4. Pantallas, en el orden de `README.md`.

### Skills para el agente que diseñe

Instalar en el fork (además de las que ya trae `.agents/skills/`:
`baseline-ui`, `improve-ui`, `fixing-accessibility`,
`fixing-motion-performance`, `gestures`):

- **`expo/skills`** (oficiales de Expo, MIT):
  `npx skills@latest add expo/skills --skill '*'`. Las que importan aquí:
  `expo-native-ui` (estilos que se sienten nativos, colores semánticos,
  controles, iconos; sustituye a la antigua `building-native-ui`),
  `expo-ui` (componentes de `@expo/ui` sobre SwiftUI y Jetpack Compose),
  `expo-design-system` (tokens y auditoría de deriva), `expo-router`,
  `expo-animation`, `expo-module` (para los módulos de pedal y wifi local),
  `eas-app-stores`, `eas-update`, `eas-workflows`.
- **Callstack** `react-native-best-practices` (rendimiento: FPS, arranque,
  memoria): `npx skills@latest add callstackincubator/agent-skills --skill react-native-best-practices`.
- **Software Mansion** `react-native-best-practices` (Reanimated 4,
  gestos, worklets y **audio**, que toca el afinador):
  `npx skills add software-mansion-labs/skills`.
- **Vercel** `vercel-react-native-skills` (listas, animación, navegación):
  `npx skills add vercel-labs/agent-skills --skill vercel-react-native-skills`.

Las que ya trae el repo (`ibelick`, `emilkowalski`, `shadcn`) son sobre todo
de web; se quedan, pero mandan las de arriba para lo nativo.

### Checklist de una pantalla del fork

- [ ] ¿Se entiende entornando los ojos? ¿Qué es título, qué es acción?
- [ ] ¿Escenario, Sol, claro y oscuro? ¿Letra del sistema enorme?
- [ ] ¿iPad en horizontal y vertical, y ventana pequeña de Stage Manager?
- [ ] ¿Toques del flujo dentro de la tabla de §5?
- [ ] ¿Controles de directo ≥ 56 pt? ¿Nada tapa la letra?
- [ ] ¿Nativo antes que propio?
