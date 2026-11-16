# El pañuelo virtual

> Documento **vivo**: describe cómo funciona hoy. Lo que falta por hacer y en
> qué orden está en [`../planes/PLAN_PANEL_PANUELO.md`](../planes/PLAN_PANEL_PANUELO.md).
> El contrato de datos con el Panel, en
> [`../contratos/PANUELO_CONTRATO.md`](../contratos/PANUELO_CONTRATO.md).

## Qué es

El pañuelo es lo que identifica a quien es del MCM, y a la gente le encanta
llenarlo de chapas y pines. El pañuelo virtual es eso mismo dentro de la app:
**tu pañuelo en 3D**, del color de tu etapa, con las piezas que has ido
juntando por participar en las actividades.

| Color    | Etapa                       |
| -------- | --------------------------- |
| Rojo     | Etapa infantil              |
| Verde    | Conocimiento                |
| Azul     | Incorporación y crecimiento |
| Amarillo | Opción responsable          |

Lo que se puede hacer hoy:

- **Girarlo** con el dedo (con inercia), acercarlo con dos dedos, y moverlo un
  poco inclinando el móvil: el metal de los pines brilla al pasar la luz.
- **Tocar una pieza**: sale del pañuelo, flota delante y se le puede dar
  vueltas. Debajo aparece su ficha: qué es, de dónde viene y cuándo se
  consiguió. Las medallas que tienen modelo propio ofrecen «Verla de cerca».
- **Decorar**: arrastrar las piezas por el pañuelo, girarlas, quitarlas (vuelven
  a la colección, no se pierden) o volver a ponerlas. **Recolocar** las reparte
  solas sin que se pisen.
- **Tutorial** por secciones, la primera vez y siempre desde el botón de
  información. Sustituye a los textos de ayuda: la pantalla no lleva
  rótulos que expliquen cómo se usa.
- **Cambiar de pañuelo** (de etapa): se pregunta qué hacer con las piezas, el de ahora se guarda como recuerdo, el visor da una vuelta y hay confeti. Ver «Cambio de etapa e historial».
- **Ver los pañuelos anteriores** («Mis pañuelos»), solo para mirarlos.
- **Filtrar la colección**: Todas · Puestas · Sin poner.
- **Canjear un código** de una actividad: la pieza nueva se presenta girando,
  con chispas, y cae en su sitio.
- **Recibir piezas por ir a una actividad** (te pasan lista): al abrir el
  pañuelo se **desvelan** una a una y luego se colocan. Hoy solo con la
  simulación del Laboratorio: ver «Piezas por asistencia».
- **Compartir** una foto del pañuelo.
- **Intercambiar** una pulsera o una chapa común con otra persona, cara a
  cara, con un código o su QR. Hace falta sesión en los dos móviles. Ver
  «Intercambios».

Detalles que le dan vida: las medallas y las cintas **cuelgan de verdad** y se
mecen al girar el pañuelo o inclinar el móvil; en reposo el pañuelo se mece un
poco durante un rato y luego se queda quieto (para no gastar batería); tiene
sombra de suelo. Quien tiene activado «reducir movimiento» en el
sistema no ve el vaivén.

## Dónde está (y dónde debería vivir)

**Hoy: escondido en el Laboratorio Alpha.** El panel «Pañuelo virtual» del
laboratorio abre la pantalla `/panuelo`. Tiene tres botones: abrir el pañuelo,
abrirlo con todas las piezas de muestra, y empezar de cero; y, debajo, la
**simulación de las piezas por asistencia** («Simular asistencia a…»,
«Simular que la quitan», «Borrar la simulación»). **Mientras se
prueba, todas las piezas del catálogo se dan solas al abrir** (`grant: all`);
cómo se repartirán de verdad (por eventos, códigos…) está por decidir.

El interruptor es `global.panuelo` en `/profileConfig`, igual que Carismochito
(`utils/panueloGate.ts`, `hooks/usePanueloAvailable.ts`):

| Valor                 | Modo normal | Laboratorio Alpha encendido |
| --------------------- | ----------- | --------------------------- |
| `"off"`               | Cerrado     | Cerrado                     |
| `"alpha"` (o ausente) | **Cerrado** | **Abierto**                 |
| `"all"`               | Abierto     | Abierto                     |

Para lanzarlo a todo el mundo basta poner `"all"` en Firebase: sin build ni
OTA. Cerrado, la ruta `/panuelo` devuelve a Inicio.

**Dónde debería vivir (recomendación, por decidir):**

1. **No es una pestaña.** La barra admite 6 y los perfiles ya declaran 7
   (`BACKLOG.md` §3): una pestaña nueva sería la primera en caerse a «Más».
2. **Su sitio natural es el perfil de la persona.** El pañuelo es _tuyo_: la
   entrada buena es el **avatar o inicial en la cabecera de Inicio** (donde hoy
   está el engranaje) que abre «Tu pañuelo», con Ajustes y la colección de
   Carismochitos colgando de la misma pantalla.
3. **Y una tarjeta en Inicio cuando hay novedad**: «Tienes una pieza nueva».
   Es lo que hace que la gente vuelva; el resto del tiempo no ocupa sitio.
4. **En el hub de cada evento**, la pieza que se gana por ir, en silueta hasta
   que se consigue.

## Las piezas

Hay siete clases. Todas se **dibujan a partir de datos** (colores, forma,
texto): una pieza nueva es un trozo de JSON en el catálogo, no una imagen ni
una versión nueva de la app.

| Clase     | Qué es                                                     | Se define con                                          |
| --------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| `chapa`   | Chapa de imperdible: redonda, abombada, brillante          | fondo, aro, dibujo o logo, texto en arco, o una imagen |
| `pin`     | Pin esmaltado: metal con la forma recortada                | forma, esmalte (uno o dos colores), metal              |
| `cinta`   | Cinta de tela con rayas, colgando de un imperdible         | colores de las rayas                                   |
| `parche`  | Parche bordado                                             | forma, fondo, borde, dibujo, texto                     |
| `medalla` | Medalla de metal colgando de su cinta                      | metal, cinta, dibujo en relieve, imagen, modelo `.glb` |
| `pulsera` | Pulsera de hilo trenzado: la que se cambia en un encuentro | colores de los hilos, trenzado, texto tejido           |
| `troncho` | El pasador de cuero con el logo: va delante, sobre el nudo | color del cuero                                        |

Las **formas** (corazón, estrella, cruz, luna, llama, vieira, montaña…) son
trazados SVG en `constants/panueloGlyphs.ts`. Es una sola fuente para dos
sitios: el visor 3D las extruye y las pinta, y la app las dibuja en plano en la
colección (`components/panuelo/PanueloItemArt.tsx`). Añadir una forma es añadir
un trazado ahí y su nombre a `PanueloGlyph` (`types/panuelo.ts`).

### Las piezas de verdad

El catálogo que va dentro de la app (`firebase-seed/panuelo.json`) **solo
lleva piezas reales**, fotografiadas: chapas, pines, las dos medallas y el
troncho. Sus modelos y sus caras están en `piezas-3d/` (raíz; ver su README).

- Una **chapa** o un **pin** de verdad lleva `image` (su cara, que es lo que se
  cose) y `glb` (su modelo: la ficha ofrece «Verla de cerca», como las
  medallas). Un pin rectangular usa la forma `card`.
- **Tres tallas**, con `size`: pequeña ≈ 0,7–0,85 · mediana 1 · grande 1,4.
- **El troncho** no se cose en el triángulo: va por delante. Con él puesto,
  la tela se recoge en un cabo que baja desde donde se junta el pañuelo
  (`Panuelo.strand`), el troncho va ceñido a ese cabo y el nudo y las puntas
  quedan justo debajo (como el de verdad, según foto del propietario). Se «lleva puesto» (está en `layout`,
  sin gastar hueco) o no; no se arrastra, no se gira y **no se intercambia**.
  El visor lo recibe aparte (`PanueloViewerState.troncho`) y hoy no se puede
  tocar en el 3D: su ficha se abre desde la colección.
- Las piezas inventadas de antes (una de cada clase) siguen en
  `constants/panueloEjemplo.json`: las usan el **tutorial** —aún no hay
  cinta, parche ni pulsera de verdad— y los tests. Nadie puede conseguirlas.

Cada pieza puede llevar además: de dónde viene (`origin`), una descripción,
rareza (`comun` / `especial` / `unica`), tamaño, si es **secreta** (no sale ni
en silueta hasta que se consigue) y si es **intercambiable**.

### Cómo se consigue una pieza

| `grant.type` | Cómo                                                                                     |
| ------------ | ---------------------------------------------------------------------------------------- |
| `all`        | Se la lleva todo el mundo al abrir el pañuelo dentro de las fechas (bienvenida)          |
| `code`       | Con un código que se enseña en la actividad. El catálogo guarda el hash, no el código    |
| `manual`     | La reparte el Panel escribiendo en el nodo de la persona (p. ej. a los inscritos)        |
| `attendance` | Por ir a un evento (te pasan lista). La concede el servidor; ver «Piezas por asistencia» |

Una pieza recién conseguida —por la vía que sea, también si el Panel la
repartió con la app cerrada— se **presenta** al abrir el pañuelo, una a una. En
un móvil nuevo no se vuelven a presentar las que ya se tenían. Las de
asistencia tienen su propia presentación, el **desvelado**, y no se cosen
solas.

**Sobre las trampas.** El código se valida en el móvil: quien tenga una foto
del código se lleva la pieza desde el sofá. Para un juego de comunidad es
suficiente, y sale por OTA. La validación en servidor está en el plan.

## Cómo está hecho

```
panuelo-3d/                         El visor 3D (three.js). NO lo empaqueta Metro
├── src/main.ts                     Escena, luces, gestos, puente con la app
├── src/cloth.ts                    El pañuelo: geometría y tela
├── src/items.ts                    Las seis clases de pieza, en 3D
├── src/art.ts                      Lo que se pinta en un <canvas>: caras, bordados, trenzados
├── assets/logo-com.png             El logo del COM (máscara blanca)
└── generated/viewer.bundle.json       ⚠️ GENERADO y commiteado (npm run build:panuelo)

app/panuelo.tsx                     La pantalla
components/panuelo/
├── Panuelo3D.tsx                   WebView (nativo) o iframe (web) con el visor dentro
├── panueloViewerHtml.ts            La página que se le da al WebView
├── PanueloItemArt.tsx              Una pieza dibujada en plano (SVG)
├── PanueloCollectionStrip.tsx      La colección
├── PanueloTutorial.tsx             El tutorial: páginas, indicador, botón único y cabecera con X
├── PanueloCollectionFilter.tsx     El filtro (Todas · Puestas · Sin poner) y su vacío
├── PanueloItemDetail.tsx           La ficha de una pieza
├── PanueloRedeemSheet.tsx          Canjear un código
├── PanueloTradeSheet.tsx           Intercambiar: todos los pasos de las dos partes
├── PanueloTradeCode.tsx            El código de un intercambio en grande y su QR
├── PanueloColorSwatches.tsx        Los cuatro colores (grupo de radio)
├── PanueloStageSheet.tsx           La hoja «¿Cambias de pañuelo?»
├── PanueloStageBurst.tsx           El confeti del cambio, del color nuevo
├── PanueloHistorySheet.tsx         La lista «Mis pañuelos»
└── PanueloMemoryView.tsx           Banner y panel al ver un pañuelo anterior
components/preview-channel/PanueloLabPanel.tsx   La puerta del Laboratorio

hooks/usePanuelo.ts                 Estado: catálogo, piezas, colocación, sincronización
hooks/usePanueloStage.ts            Cambio de etapa: hoja, confeti, detección del color de Comunica
hooks/usePanueloScarf.ts            Lee `mcm.scarf` de Comunica (fuera del área)
hooks/usePanueloTutorial.ts         Si el tutorial toca, y que ya se vio
hooks/usePanueloTutorialStage.ts    Qué hace el visor en cada paso del tutorial (y del desvelado)
hooks/usePanueloIntro.ts            El modo a pantalla completa: tutorial o desvelado de piezas nuevas
hooks/usePanueloTrade.ts            El intercambio en curso: pasos, en vivo, recuperación, limpieza
services/panueloTradeService.ts     panueloTrades/{code} en RTDB, siempre con transacciones
services/panueloAwards.ts           Piezas por asistencia: de dónde salen (hoy, la simulación; `// F4:`)
constants/panueloTutorial.ts        Las secciones del tutorial (datos)
utils/panuelo.ts                    Lógica pura: sanear, fusionar, conseguir, decorar
utils/panueloPlacement.ts           Dónde cabe una pieza (lo comparten app y visor)
utils/panueloTrade.ts               Intercambios: las reglas (puras), saneado y opciones
utils/panueloAttendance.ts          La regla de las piezas por asistencia (pura; se copiará a functions/)
scripts/panuelo-subir.js            `npm run panuelo:subir`: sube UNA pieza del catálogo a Firebase
utils/panueloShare.ts               Compartir la foto
utils/sha256.ts                     Hash de los códigos
types/panuelo.ts                    Tipos y el protocolo app ↔ visor
constants/panueloGlyphs.ts          Las formas
firebase-seed/panuelo.json          El catálogo: piezas de verdad (y el que se usa sin catálogo remoto)
constants/panueloEjemplo.json       Piezas inventadas, una de cada clase: tutorial y tests
```

### El visor: un WebView con three.js dentro

Es la misma decisión que con las medallas (`components/medallas/`): un WebView
en vez de `expo-gl`. Un solo código para iOS, Android y web, **sale por OTA** y
se puede probar en un navegador. La diferencia con las medallas es que aquí
three.js va **empaquetado dentro de la app** (≈630 KB), no se descarga: el
pañuelo abre sin red.

- **No hay modelo `.glb` del pañuelo: se calcula.** Es un triángulo entero, atado: NO va
  enrollado ni tiene dobladillo o banda arriba (decisión del propietario,
  2026-11-15, con fotos). Es UNA sola malla, sin corte: la tela de la
  espalda sigue por los hombros y se recoge hacia el nudo (`sidePoint`), nunca
  como un cordel ni como una pieza aparte. Eso, el
  nudo con sus dos puntas y el triángulo de la espalda salen de fórmulas
  (`cloth.ts`). Pesa cero bytes, y la misma fórmula que dibuja el triángulo
  dice dónde y con qué inclinación va cosida cada pieza.
- **La tela está simulada** (`createClothSim` en `cloth.ts`): cada vértice es
  una partícula con inercia unida a sus vecinas por hilos que no se estiran.
  No hay cuerpo debajo: el cuello y el nudo están fijos y cada punto tiende a
  su sitio de reposo. `main.ts` solo le dice cuánto ha girado el pañuelo
  (`stepDrape`); las piezas cosidas la siguen con `offsetAt`. Es lisa, sin
  textura de trama (decisión del propietario). Si va justo en un móvil modesto:
  bajar `NS`/`NT`/`NE` o `CLOTH_ITERATIONS`.
- **Se gira el pañuelo, no la cámara.** La luz y los reflejos se quedan
  quietos, como al darle vueltas a algo en la mano.
- **La app manda.** El visor no decide qué piezas hay ni dónde: pinta el estado
  que le llega (`PanueloCommand`) y avisa de lo que hace el dedo
  (`PanueloEvent`). Los dos tipos están en `types/panuelo.ts`.
- **Solo se pinta cuando algo cambia, y quieto se duerme.** El vaivén en
  reposo dura unos 12 s, se va parando y el bucle deja de pedir fotogramas
  (`wake()` / `invalidate()` en `main.ts` lo despiertan: un toque, una orden,
  la inclinación). Mientras solo se mece pinta a la mitad de fotogramas.
- **Cada pieza ocupa lo suyo.** `itemReach` (`utils/panueloPlacement.ts`) dice
  el radio de cada clase; `nextFreeSlot` busca hueco con eso, sin pegarla al
  borde y dejando el logo para lo último. Al coserla, el visor palpa la tela
  alrededor (`seat()` en `main.ts`) para inclinarla y que no se hunda en un
  pliegue. Si cambias el tamaño de una clase en `items.ts`, cambia su `REACH`.
- El tono es «Neutral», no ACES: el verde del pañuelo tiene que ser EL verde
  del pañuelo (`PanueloColors.cloth`, sacados de fotos de los de verdad).

### ⚠️ Si tocas el visor, regenera el bundle

```bash
npm run build:panuelo        # desde mcm-app/
```

Hay que hacerlo al tocar `panuelo-3d/src/`, `constants/panueloGlyphs.ts`,
`utils/panueloPlacement.ts`, `types/panuelo.ts` o `PanueloColors`, y commitear
`panuelo-3d/generated/viewer.bundle.json`. Si se olvida, lo dice
`__tests__/panueloViewerBundle.test.ts`, que reconstruye el bundle y lo compara
con el commiteado. `three` es solo una herramienta de build
(`devDependencies`): no entra en el bundle de Metro.

### Datos

```
RTDB  /panuelo                          { updatedAt, data: { items: { <id>: pieza } } }
RTDB  /users/{uid}/panuelo              { color, items, layout, layoutAt, gone?, history? }
RTDB  /panueloTrades/{code}             Un intercambio en curso (contrato §4)
AsyncStorage  @panuelo_state            Lo mismo que el nodo del usuario
AsyncStorage  @panuelo_trade_pending    { code, role }: el intercambio a medias, para recuperarlo
AsyncStorage  @panuelo_trade_mine       Los códigos que abrió este móvil, para borrarlos al caducar
AsyncStorage  @panuelo_seen             Ids de las piezas ya presentadas en este móvil
AsyncStorage  @panuelo_tutorial_seen    Versión del tutorial ya vista en este móvil
AsyncStorage  @panuelo_retiradas        Piezas por asistencia quitadas que aún no se han avisado
AsyncStorage  @panuelo_awards_simulados ⚠️ SIMULACIÓN del Laboratorio: { attended, awards }
RTDB  /panueloAwards/{personId}         (F2, aún no existe) Lo concedido por asistencia; solo lo escribe el servidor
AsyncStorage  panuelo_catalog           Caché del catálogo (useFirebaseData)
```

- **Sin catálogo remoto** (nodo sin crear, o sin red la primera vez) se usa el
  de muestra, `firebase-seed/panuelo.json`. Mientras el Panel no tenga su
  editor de piezas, ese ES el catálogo.
- **Sin sesión** el pañuelo se guarda solo en el móvil (la pantalla lo avisa).
- **Con sesión** se junta con la nube (`mergePanuelo`): las piezas se **suman**
  (lo conseguido no se pierde nunca), y el color y la colocación son **de quien
  los tocó el último** (`layoutAt`). Mezclar dos colocaciones pieza a pieza
  dejaría un pañuelo que nadie hizo.
- La colocación se sube con retardo (1,2 s tras el último gesto): arrastrar no
  es escribir en la base de datos.
- **Todo lo que llega de fuera se sanea** (`sanitizeCatalog`,
  `sanitizeUserState`): una pieza mal escrita se descarta entera en vez de
  tumbar la pantalla; los colores tienen que ser hex; las imágenes, `https`.

Analítica: `panuelo_abierto`, `panuelo_pieza_conseguida { clase, via }`,
`panuelo_pieza_retirada { clase }` (una pieza por asistencia que se quita al
corregirse la lista) y
`panuelo_intercambio { paso: abierto | propuesto | aceptado | cancelado, regalo }`.

## Cambio de etapa e historial

El color del pañuelo es la **etapa** de la persona en el movimiento. Cambiar de
color pasa una vez cada varios años y es una pequeña ceremonia, no un
interruptor: por eso los cuatro círculos de color **ya no cambian nada al
tocarlos**.

### Cómo va

1. Tocar un color distinto del actual abre la hoja «¿Cambias de pañuelo?»
   (`PanueloStageSheet`, el mismo patrón de hoja que el canje). Dice que el
   pañuelo de ahora se guarda como recuerdo y ofrece:
   - **Mantener mis chapas y pines**: cambia el color y las piezas se quedan
     cosidas donde estaban.
   - **Empezar de cero la nueva etapa**: cambia el color y las descose todas.
     Siguen en la colección, sin poner: **no se pierden**.
   - **Cancelar**.
     Si el pañuelo de ahora no lleva ninguna pieza cosida, no hay recuerdo que
     guardar y las dos salidas serían la misma: la hoja ofrece un solo botón,
     «Cambiar de pañuelo».
2. En los dos casos el pañuelo de antes se **archiva antes** de cambiar
   (`changeStage` → `archivePanuelo`), **solo si llevaba al menos una pieza
   cosida**: un pañuelo vacío no es un recuerdo.
3. Al cambiar: el visor hace su giro de cambio de color; encima, confeti **del
   color del pañuelo nuevo** (`PanueloStageBurst` sobre `CelebrationBurst`,
   color de `PanueloColors.cloth`, sin emoji), háptico de celebración
   (`h.formSuccess`) y anuncio para el lector de pantalla. Con «reducir
   movimiento» no se monta el confeti.

### El historial («Mis pañuelos»)

**Un recuerdo no es una imagen.** Las piezas se pintan a partir de datos, así
que basta `{ color, at, layout }` y el visor lo vuelve a pintar igual
(`memoryToViewerState`, que reutiliza `toViewerState` y descarta las piezas que
ya no estén en el catálogo).

- Se guardan como mucho los **12 más recientes** (`MAX_PANUELO_HISTORY`).
- Se sincroniza **un recuerdo por escritura** en
  `/users/{uid}/panuelo/history/{at}` (`syncPanueloMemory`), al momento: no
  espera al retardo de la colocación. Con la clave por `at`, dos móviles que
  dejen el mismo recuerdo no lo duplican, y cada uno sube solo el suyo.
- Al juntar móvil y nube los recuerdos se **suman** (`mergePanuelo`), igual que
  las piezas; nunca se borran por el tope remoto.
- «Empezar de cero» del Laboratorio borra también el historial (borra el nodo).

**La entrada** es un botón de icono discreto junto a «Canjear» en la cabecera
de la colección, **solo si hay al menos un recuerdo**. Abre una hoja con los
pañuelos anteriores: color, etapa, «Hasta noviembre de 2026» y cuántas piezas
llevaba.

**Ver uno** cambia el visor principal a ese pañuelo, en solo lectura, con un
banner «Estás viendo tu pañuelo rojo de 2026 · Volver» en el sitio de los
colores y de «Decorar» (que desaparecen, igual que compartir y canjear). El
panel de abajo pasa a ser la lista de sus piezas con su ficha («Lo llevabas en
tu pañuelo rojo»), sin Quitar ni Ponérmela. Se puede girar y tocar una pieza.

Por qué el visor principal y no un segundo visor en una hoja:

- Un solo contexto WebGL. Un segundo WebView 3D en una hoja deja vivos los dos
  a la vez; en un Android modesto es memoria y batería que no hacen falta.
- Reutiliza todo lo ya revisado: gestos, ficha, presentación, anuncios, y la
  alternativa nativa de la colección para quien usa lector de pantalla.
- El giro de cambio de color del visor ya ES la transición entre pañuelos.

### El cajón de la colección: filtro

Un `SegmentedControl` encima de la colección (`PanueloCollectionFilter`):
**Todas** (con las siluetas de las que faltan, como siempre), **Puestas** (las
que tienes y llevas cosidas) y **Sin poner** (las que tienes y no están cosidas:
lo útil al decorar). Con el filtro vacío sale un `EmptyState` breve. Se recuerda
mientras la pantalla está abierta (no se persiste) y entrar en modo decorar no
lo cambia.

## Tutorial

Sustituye a los rótulos y pistas sueltos que había por la pantalla («arrastra
para girarlo», «toca una pieza»…): la pantalla no explica nada por su cuenta,
lo cuenta esto, una vez y a mano cuando se quiera. Las ayudas de accesibilidad
(etiquetas, `accessibilityHint`, anuncios) no se tocaron: no se ven.

### Contenido

`constants/panueloTutorial.ts`, un array de secciones
`{ id, title, body, steps?, rows?, example? }`: `body` es la frase de entrada,
`steps` un «cómo se hace» numerado y `rows` filas «icono + título +
descripción». El comentario de arriba del fichero dice cómo añadir una. Es una
introducción, no un manual: **6–7 pasos como mucho**; lo que va junto a un paso
se funde en una fila más. Solo se cuenta lo que la app hace hoy; los
intercambios entran como una fila de «Tu colección» (un test lo vigila).

| Paso              | Qué lleva                                                  | Ejemplo en el visor                                |
| ----------------- | ---------------------------------------------------------- | -------------------------------------------------- |
| Tu pañuelo        | Gíralo y acércalo · su color es tu etapa · se guarda solo  | Pañuelo verde con dos piezas, para girar           |
| Chapas y pines    | Las seis clases · para todos / con código / repartidas     | Las seis cosidas + dibujadas en plano debajo       |
| Canjear un código | 3 pasos numerados · el enlace con el código escrito        | Una pieza que se presenta (`reveal`)               |
| Verlas de cerca   | Su ficha · medallas con modelo propio                      | Una medalla enfocada (`focus`)                     |
| Tu colección      | Filtrar · **Compartir** · **Intercambiar**                 | Pañuelo con piezas                                 |
| Decorarlo         | 3 pasos numerados · **Recolocar**                          | Modo decorar con una pieza seleccionada (`select`) |
| Cambiar de etapa  | Tú decides (mantener o empezar de cero) · **Mis pañuelos** | La tela pasa de verde a azul (`toColor`)           |

### Cómo se presenta (a la manera de las hojas de introducción de Apple)

La referencia son las hojas «Novedades» y de bienvenida de iOS y las HIG de
onboarding y de `UIPageControl`: pocas páginas, una acción clara y la certeza
de cuántas hay.

- **Una sola acción principal, fija abajo**: un botón ancho (≥ 50 pt, sobre el
  área segura) que dice **«Continuar»** y, en el último paso, **«Empezar»**. No
  hay «Saltar», «Atrás» ni «Siguiente» como botones: salir es la **X** de
  arriba (en cualquier paso) y volver atrás es **deslizar hacia la derecha**.
  Para el lector de pantalla, la acción «Paso anterior» del título, y un
  chevron discreto arriba a la izquierda **solo desde el segundo paso**.
- **Indicador de páginas** como `UIPageControl`: una fila de puntos centrada,
  justo encima del botón; el de ahora alargado y el resto tenues. Es un control
  **ajustable** (`accessibilityRole="adjustable"`, «Paso 3 de 7»,
  incrementar/decrementar). Sin barras que «se iluminan».
- **La mitad de abajo, con presencia**: ~45 % visor / ~55 % contenido
  (`useWindowDimensions`), en ancho la columna lateral. Cada página: título
  grande (`h1`), frase de entrada, y los pasos o filas con su número o icono a
  la izquierda. Texto a la izquierda, márgenes `spacing.lg`, apoyado en el
  fondo (sin tarjeta flotante) con la esquina de arriba redondeada. Si no cabe
  (pantalla baja, letra grande), la página hace scroll; el botón y los puntos
  quedan fijos.
- **Transición**: paginado real (`ScrollView` horizontal con `pagingEnabled`):
  el contenido sigue al dedo 1:1 y al soltar se asienta por distancia o
  velocidad, con el muelle nativo. **El visor no se desliza**: cambia de estado
  cuando la página se asienta. «Continuar» avanza con la misma animación; con
  «reducir movimiento» salta sin animar.
- **Háptico**: `h.select` al cambiar de página, `h.success` al «Empezar».

### A pantalla completa y con un único visor

Mientras dura se **oculta la cabecera nativa** (`navigation.setOptions({
headerShown: false })`) y el tutorial lleva la suya, por debajo de la barra de
estado y del notch: «Tu pañuelo» y la X (44 pt). No es un `Modal` ni hay un
segundo WebView (no se puede mover uno entre árboles sin recargarlo, y dos
contextos WebGL son memoria y batería para nada): es la **misma pantalla
re-maquetada**, con el visor montado en el mismo sitio del árbol. Cada paso lo
deja como lo explica (`usePanueloTutorialStage`): estado de ejemplo del
catálogo de muestra y órdenes (`focus`, `select`, `reveal`; `mode` por prop;
`toColor` cambia la tela). En el ejemplo no se toca nada de lo tuyo: arrastrar,
enfocar o seleccionar se ignoran mientras dura.

### Cuándo sale

Solo, la primera vez; y siempre desde el «?» de la cabecera nativa
(`accessibilityLabel` «Cómo funciona tu pañuelo»; en iOS un
`Stack.Toolbar.Button`, en Android y web un `headerRight`). Se recuerda en
`@panuelo_tutorial_seen` con la **versión** (`PANUELO_TUTORIAL_VERSION`, hoy 4):
al subirla —cuando cambia de verdad una función, no por retocar una frase— se
vuelve a enseñar una vez. Va **primero**: ni el canje de `?codigo=`, ni la
presentación de una pieza nueva, ni la pregunta de cambio de etapa salen hasta
que se cierra.

### Cómo ampliarlo

Añade la sección al array (o una fila a una existente si va junto a ella); si
es una función nueva, sube la versión; pon el cambio aquí y en el CHANGELOG.

## Piezas por asistencia

A ciertos eventos se les asigna una pieza (chapa, pin o medalla): a quien le
**pasan lista** en ese evento le llega sola. El plan entero, con el servidor
que falta, es
[`../planes/PLAN_PANUELO_ASISTENCIA.md`](../planes/PLAN_PANUELO_ASISTENCIA.md).

**Hoy está hecho lo de la app; el servidor no.** La concesión de verdad la
hará una Cloud Function con el pasar lista de Comunica (F2–F4 del plan).
Mientras tanto, la única fuente es una **simulación del Laboratorio Alpha**.

### La regla: la pieza sigue siempre a la asistencia

Decisión del propietario (2026-11-16), sin plazos (`utils/panueloAttendance.ts`,
pura):

- Cuenta «Sí» o «Parcial» en cualquier día del evento (`marks` y `minDays`
  de la pieza lo cambian). Con ir a uno de sus `events` basta.
- **Llega cuando se marca**, aunque sea tarde, y **se quita si se corrige**,
  aunque haga años.
- Lo concedido entra en la colección **en la caja**, sin coserse
  (`reconcileAwards`), y espera su desvelado.
- Si se quita: sin desvelar, **se cae de la cola sin decir nada**; ya
  desvelada o cosida, **sale de la colección (se descose)** y la siguiente
  vez que la pantalla está libre sale **una línea discreta, una sola vez**
  (toast: «Ya no tienes «Chapa de Pascua»: se corrigió la lista de Pascua
  Joven 2027.»). Sin sonido ni háptica de error.
- Si la vuelven a marcar, **llega como nueva**: otra vez a la caja y otra vez
  se desvela.
- **No se intercambian nunca** (`tradeable` se fuerza a `false` al sanear).
- Sin poder leer lo concedido (sin red), no se quita nada.
- Las de muestra del Laboratorio (`via: demo`) no las toca.

### El desvelado

Lo que pidió el usuario: «la siguiente vez que entren y tienen nuevas les sale
una animación y explicación de la nueva chapa o pin o medalla, una por una le
van dando a siguiente y luego ya las pueden colocar».

- **Es el tutorial con otras páginas**, no otra pantalla: el mismo
  `PanueloTutorial` a pantalla completa, el mismo visor y
  `usePanueloTutorialStage` (`hooks/usePanueloIntro.ts`). Una página por
  pieza (`newPiecesSections`): su nombre, «Por ir a {origin}.», clase,
  rareza y descripción, «La conseguiste el…» y, en la última, «Te esperan en
  tu colección».
- Arriba, **tu pañuelo** tal como lo llevas, con la pieza cosida de mentira
  en un hueco libre y **presentándose** (`reveal`: entra girando, con
  chispas). Confeti del primer color de la pieza y anuncio para el lector
  («Pieza nueva, 2 de 3: …»). La primera, con háptico de celebración.
- **«Siguiente»**; en la última, **«Colocarlas»** («Colocarla» si es una) y
  el enlace **«Ahora no»**. La X cierra. Se vuelve atrás deslizando o con el
  chevron. Los puntos dicen «Pieza 2 de 3».
- **«Colocarlas»** abre el modo decorar con el filtro **«Sin poner»** y la
  ficha de la primera abierta («Ponérmela»). Las piezas **esperan en la
  caja**: no se cosen solas.
- **«Ahora no» o la X**: lo enseñado queda visto; lo que falte sale la
  próxima vez que se abra el pañuelo.
- Va **después del tutorial** y **antes** del canje de `?codigo=`, del
  intercambio por enlace y de la pregunta de cambio de etapa.
- **Reducir movimiento**: la pieza aparece quieta (`reveal` con `still`) y
  sin confeti; las páginas cambian sin animar. Sin visor (WebGL no arranca),
  la pieza sale dibujada en plano en su página.
- Las piezas de otras vías (código, intercambio, Panel) siguen con su
  presentación de siempre.

### La simulación del Laboratorio (mientras no hay servidor)

En el panel «Pañuelo virtual» del Laboratorio Alpha:

- **«Simular asistencia a Salida a la sierra»** (y a «Convivencia de otoño» y
  «Pascua joven»): como si te pasaran lista hoy en ese evento del servidor
  falso de Comunica (`f-evt-salida`, `f-evt-convivencia`, `f-evt-pascua`).
  Abre el pañuelo y sale el desvelado. Dan una chapa, un pin y una medalla
  de prueba (en `constants/panueloEjemplo.json`, con `grant: attendance`;
  solo existen en el catálogo mientras hay simulación). Si una pieza de
  verdad del catálogo ya fuera por asistencia, su evento sale también.
- **«Simular que la quitan: …»** (en el evento ya marcado): como si
  corrigieran la lista. Abre el pañuelo: la pieza desaparece y, si ya se
  había desvelado, sale el aviso.
- **«Borrar la simulación»**: se van sus piezas, sin aviso.

Se guarda en este móvil (`@panuelo_awards_simulados`, `{ attended, awards }`)
con la forma de `/panueloAwards/{personId}`, y lo calcula `computeAwards`, la
misma regla que usará el servidor. **Para F4 solo cambia la fuente**:
`loadAwards()` en `services/panueloAwards.ts` (comentario `// F4:`); el
reflejo, las retiradas y el desvelado ya leen de ahí.

### Asignar una pieza a un evento (con IA, sin editor del Panel)

1. Pídele a una sesión de IA: «Haz una chapa de Pascua Joven 2027 para los
   eventos `<id>` y `<id>`» (los ids de evento del CRM; el mismo encuentro en
   dos delegaciones son dos eventos).
2. La IA añade la pieza a `mcm-app/firebase-seed/panuelo.json` con
   `"grant": { "type": "attendance", "events": [ … ] }` siguiendo
   [`PANUELO_CONTRATO.md`](../contratos/PANUELO_CONTRATO.md) (id nuevo en
   `kebab-case`, que no se reutiliza; pieza de verdad, con su `image` y su
   `glb` en `piezas-3d/`), pasa `npm test -- panueloSeed` (ninguna pieza se
   descarta ni pierde nada al sanear) y hace commit.
3. Tú lo subes con **un solo comando**, desde la carpeta `mcm-app` (en
   Windows, con **Git Bash**):

   ```bash
   cd mcm-app
   npm run panuelo:subir -- pascua-joven-2027 --dry-run   # mira qué haría
   npm run panuelo:subir -- pascua-joven-2027             # enseña y pide «s»
   ```

   Hace falta la CLI de Firebase con sesión (`npm install -g firebase-tools`
   y `firebase login`, la de desplegar). Escribe **solo**
   `/panuelo/data/items/<id>` y `/panuelo/updatedAt`; nunca el catálogo
   entero, así que no puede borrar otras piezas. Avisa si va a sustituir una
   pieza distinta y si arriba hay piezas que no están en el repo (no las
   toca). Sin terminal: `--export` deja el JSON de la pieza y explica cómo
   importarlo **dentro de su hijo** en la consola.

El seed es además el catálogo empaquetado: la pieza llega también en la
siguiente OTA como respaldo. **Hasta que exista el servidor (F2–F4), una
pieza por asistencia no le llega a nadie**: solo se puede ver con la
simulación del Laboratorio.

## Recolocar

En modo decorar, el botón «Recolocar» reparte solas todas las piezas cosidas
(`autoArrange` en `utils/panuelo.ts`). Parte de un pañuelo vacío y coloca de
mayor a menor (`itemReach`: medallas y pulseras primero, luego lo pequeño) con
`nextFreeSlot`, que no las pisa y deja el logo para lo último; todas a rotación
0 y, a igualdad de tamaño, por id (el resultado es siempre el mismo). Las
piezas en la caja se quedan en la caja. Pregunta antes (`confirmAsync`) porque
deshace la colocación a mano.

## El color viene de Comunica

El pañuelo es la etapa, y la etapa está en Comunica: `mcm.scarf` de los datos de
la propia persona (`red | green | blue | yellow | cross | none | unknown`).

- **De dónde se lee** (`hooks/usePanueloScarf.ts`): `/panuelo` es de la raíz y
  el `QueryClient` del área vive en el layout de la pestaña, así que no se usan
  sus hooks (`useMe`, `useProfileDetails`…). Sí sirve la capa de servicios, que
  es de módulo: `getComunicaApi()` con la sesión puesta y `initSession()` (lee
  la sesión guardada sin red). Dos peticiones, **solo al abrir el pañuelo**:
  `getMyProfiles()` → `getProfileDetails(self.id)`. No reutiliza la caché del
  área (es otra instancia y esa consulta es personal: `persist: false`, no se
  guarda en el móvil).
- **De quién**: de `profiles.self`, la ficha de la propia persona, **no** de la
  «ficha activa» del área. El pañuelo es de quien ha entrado: un padre que está
  viendo a su hija en el área sigue teniendo el suyo, y los datos de una hija ni
  traen `mcm` (el servidor solo lo da a la audiencia `member`).
- **Qué se hace** (`decideScarfStage`, pura):
  - Comunica da `red|green|blue|yellow`: ese es el color; los círculos no se
    muestran, en su sitio sale la etapa en texto.
  - Nunca se eligió color: se **asigna sin preguntar ni celebrar** (el verde que
    se veía era el de por defecto). Las piezas cosidas que pueda haber son solo
    la de bienvenida.
  - Distinto del guardado: es un cambio de etapa **detectado**. Se abre sola, una
    vez por apertura, la hoja «Tienes pañuelo nuevo» («Llevarme las piezas» /
    «Empezar con el pañuelo limpio» / «Luego»), con recuerdo y confeti. «Luego»
    no cambia nada: se vuelve a preguntar la próxima vez, y mientras tanto el
    aviso «Tienes pañuelo nuevo» del pañuelo la reabre.
  - `none`, `unknown`, `cross`, sin sesión, sin servidor, sin red o con error:
    todo como antes, con los círculos para elegir a mano. Nunca se espera a
    Comunica: se pinta con lo guardado y se corrige si llega otra cosa.
- **Límite**: la sesión de Comunica solo existe si la persona ha entrado alguna
  vez en el área nativa; si no, no hay nada que leer y el pañuelo se elige a
  mano. Sin probar contra el servidor real (solo contra dobles).

## Intercambios

Dos personas, cara a cara, se cambian una pulsera o una chapa, como se hace con
las de verdad. **Una enseña un código, la otra lo escribe, cada una elige qué
da, y se cambian.** El plan con todos los detalles (estados de error, reglas,
pruebas en dos móviles) es
[`../planes/PLAN_PANUELO_INTERCAMBIOS.md`](../planes/PLAN_PANUELO_INTERCAMBIOS.md).

**Qué piezas** (decisión del propietario, 2026-11-16): **pulseras y chapas
comunes** (`isTradeable`). **Nunca medallas ni piezas `unica`** (las de un
evento: se ganan por haber estado), aunque el catálogo diga `tradeable: true`.
El catálogo puede quitar una pulsera o chapa (`tradeable: false`) o sumar un
pin o una chapa especial (`tradeable: true`).

### Cómo va

1. **Ana** toca una pieza suya intercambiable → ficha → **«Intercambiar»**
   (o el botón ⇄ de la cabecera de la colección, que le deja elegir). Nace un
   intercambio `open` con un **código de 6** (sin 0/O ni 1/I/L: se dicta en un
   patio con ruido) que caduca a los **10 minutos**. La hoja lo enseña en
   grande («K7W Q4M») con su QR (`mcmapp://panuelo?intercambio=K7WQ4M`) y
   «Caduca en 9 min».
2. **Luis** escanea el QR con la cámara del sistema (abre la app en la hoja)
   o, dentro del pañuelo, ⇄ → «Tengo un código» → lo escribe o lo escanea.
   Ve la pieza de Ana y elige qué da: una de sus intercambiables (las que Ana
   ya tiene salen deshabilitadas, «Ya la tiene», gracias a `offer.have`) o
   **nada: un regalo**. Pasa a `proposed`.
3. A Ana le llega en vivo («Luis te da «Azul» por tu «Roja»») y acepta, o
   dice «No, gracias». Pasa a `accepted`.
4. **Cada móvil aplica su mitad** al ver `accepted`: sale la pieza que da y
   entra la que recibe, **cosida en el mismo sitio** (un cambio, no un hueco),
   y se sube en una sola escritura (`syncPanueloTradeHalf`: `items/{dada}` a
   `null`, `gone/{dada}`, la recibida y la colocación). La recibida se
   **presenta** en el visor como cualquier pieza nueva.

No se puede recibir una pieza que ya se tiene. Cualquiera de las dos partes
puede echarse atrás antes de aceptar. Un intercambio a la vez por móvil:
mientras hay uno abierto, «Intercambiar» lleva a ese.

**Hace falta sesión (Google/Apple) y red en los dos móviles.** Sin sesión la
hoja enseña el login; sin red, lo dice y no deja seguir.

### Lo que no se ve

- **Todo pasa por transacciones** sobre el nodo entero
  (`services/panueloTradeService.ts`): si dos personas contestan al mismo
  código a la vez, una gana y la otra lee «Otra persona ya ha contestado».
- **Hora del servidor**: la caducidad se mira con `.info/serverTimeOffset`;
  un móvil con la hora mal no ve caducado un intercambio vivo.
- **Recuperación**: el código en curso se guarda en `@panuelo_trade_pending`.
  Si alguien cierra la app justo al aceptar, al volver a abrir el pañuelo se
  aplica lo que faltaba (o se reabre la hoja, si sigue vivo).
- **Limpieza** (decisión del propietario): cada móvil borra al abrir el
  pañuelo los intercambios que abrió y ya caducaron; los aceptados se dejan
  un día, para la recuperación de la otra parte.
- **Lo dado no vuelve**: `gone` apunta lo que se dio; al juntar el móvil con
  la nube, una copia de antes de darla no cuenta. Recuperar luego esa misma
  pieza en otro intercambio sí cuenta (era un fallo latente, arreglado con su
  test en `__tests__/panuelo.test.ts`).

### Reglas de Firebase

Están en `mcm-app/database.rules.json` (`panueloTrades`) con sus pruebas en
`__tests__/databaseRules.test.ts`. **Se despliegan a mano** (decisión del
propietario): el bloque exacto y el paso a paso para la consola están en
[`../desarrollo/FIREBASE_REGLAS.md`](../desarrollo/FIREBASE_REGLAS.md) §8.
Hasta que estén, intercambiar dice «Los intercambios todavía no están
activados en el servidor. Avisa a quien lleva la app.» en vez de un error
crudo.

### El límite que hay que conocer

Cada móvil aplica su mitad porque hoy cada persona solo puede escribir en su
propio nodo. Eso no es atómico ni a prueba de trampas: alguien con ganas
podría quedarse con las dos piezas. Es el **mismo nivel de confianza que los
códigos**, y para un juego entre gente que se conoce vale. El día que haya
servidor (Integración D), el paso 4 lo hace una función con una sola
transacción y nada de lo demás cambia.

## Lo que se sabe que falta

- **Las piezas por asistencia no tienen servidor todavía** (F2–F4 de
  `PLAN_PANUELO_ASISTENCIA.md`): hoy solo llegan con la simulación del
  Laboratorio. **El desvelado no se ha probado en un móvil**: visto en web
  (export con datos de prueba y Playwright). Sin ver: la presentación en el
  WebView de iPhone y Android, el confeti sobre el visor, el háptico, el toast
  de lo retirado y la lectura con VoiceOver/TalkBack.
- **`npm run panuelo:subir` no se ha probado contra Firebase**: solo con
  `--dry-run` y con una CLI de mentira. La primera vez, `--dry-run` antes.

- **El logo del pañuelo rojo.** El de verdad lleva el del MIC; aquí los cuatro
  llevan el del COM porque es el único que hay. Hace falta el archivo.
- **Las miniaturas de las medallas** del Jubileo y de la visita del Papa se
  sirven desde `medallas-3d/thumbs/` vía jsDelivr: **solo existen cuando ya
  están en `main`**. Hasta entonces se ve la medalla dibujada.
- **El catálogo no está en Firebase**: hay que importar
  `firebase-seed/panuelo.json` en `/panuelo/data` y desplegar las reglas
  (`docs/desarrollo/FIREBASE_REGLAS.md`). Sin eso funciona igual, con el
  catálogo de muestra.
- **Accesibilidad sin oír**: la pantalla tiene etiquetas, anuncios y acciones
  para mover piezas sin tocar el 3D, pero nadie lo ha probado con VoiceOver ni
  TalkBack.
- **Tutorial, Recolocar y el color de Comunica no se han probado en un móvil** (ni con el servidor de Comunica real). Sin ver: el pañuelo de ejemplo del tutorial en el visor, el deslizamiento, el aspecto de la barra de arriba al envolver y la lectura con VoiceOver/TalkBack.
- **El cambio de etapa y el historial no se han probado en un móvil.** Sin ver: el confeti sobre el WebView, el giro del visor al pasar a un recuerdo, el háptico y los anuncios con VoiceOver/TalkBack.
- **No se ha probado en un móvil de verdad.** Se ha probado en navegador (el
  visor y la pantalla entera en web). Falta ver en iPhone y Android: el WebView
  transparente, el rendimiento con muchas piezas, la inclinación y compartir.
- **Intercambios sin probar en un móvil.** Falta el ciclo entero con dos
  móviles y dos cuentas (lista en el plan, §7), y desplegar el bloque de
  reglas (`FIREBASE_REGLAS.md` §8). La pieza que se da desaparece sin
  animación (la «vuela» de la Fase 6 del plan no está hecha).
- **Repartir desde el Panel** necesita que el Panel pueda escribir en
  `/users/{uid}` (hoy no puede sin autenticación real: Integración D).
