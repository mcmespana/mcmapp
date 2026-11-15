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
- **Compartir** una foto del pañuelo.

Detalles que le dan vida: las medallas y las cintas **cuelgan de verdad** y se
mecen al girar el pañuelo o inclinar el móvil; en reposo el pañuelo se mece un
poco durante un rato y luego se queda quieto (para no gastar batería); tiene
sombra de suelo. Quien tiene activado «reducir movimiento» en el
sistema no ve el vaivén.

## Dónde está (y dónde debería vivir)

**Hoy: escondido en el Laboratorio Alpha.** El panel «Pañuelo virtual» del
laboratorio abre la pantalla `/panuelo`. Tiene tres botones: abrir el pañuelo,
abrirlo con todas las piezas de muestra, y empezar de cero. Códigos de prueba:
`CONSOLACION`, `PASCUA27`, `CAMINO`, `VERANO`.

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

Hay seis clases. Todas se **dibujan a partir de datos** (colores, forma,
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

Las **formas** (corazón, estrella, cruz, luna, llama, vieira, montaña…) son
trazados SVG en `constants/panueloGlyphs.ts`. Es una sola fuente para dos
sitios: el visor 3D las extruye y las pinta, y la app las dibuja en plano en la
colección (`components/panuelo/PanueloItemArt.tsx`). Añadir una forma es añadir
un trazado ahí y su nombre a `PanueloGlyph` (`types/panuelo.ts`).

Cada pieza puede llevar además: de dónde viene (`origin`), una descripción,
rareza (`comun` / `especial` / `unica`), tamaño, si es **secreta** (no sale ni
en silueta hasta que se consigue) y si es **intercambiable**.

### Cómo se consigue una pieza

| `grant.type` | Cómo                                                                                  |
| ------------ | ------------------------------------------------------------------------------------- |
| `all`        | Se la lleva todo el mundo al abrir el pañuelo dentro de las fechas (bienvenida)       |
| `code`       | Con un código que se enseña en la actividad. El catálogo guarda el hash, no el código |
| `manual`     | La reparte el Panel escribiendo en el nodo de la persona (p. ej. a los inscritos)     |

Una pieza recién conseguida —por la vía que sea, también si el Panel la
repartió con la app cerrada— se **presenta** al abrir el pañuelo, una a una. En
un móvil nuevo no se vuelven a presentar las que ya se tenían.

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
├── PanueloTutorial.tsx             El tutorial: cabecera con X, tarjeta del paso e indicador
├── PanueloCollectionFilter.tsx     El filtro (Todas · Puestas · Sin poner) y su vacío
├── PanueloItemDetail.tsx           La ficha de una pieza
├── PanueloRedeemSheet.tsx          Canjear un código
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
hooks/usePanueloTutorialStage.ts    Qué hace el visor en cada paso del tutorial
constants/panueloTutorial.ts        Las secciones del tutorial (datos)
utils/panuelo.ts                    Lógica pura: sanear, fusionar, conseguir, decorar
utils/panueloPlacement.ts           Dónde cabe una pieza (lo comparten app y visor)
utils/panueloTrade.ts               Intercambios: las reglas (sin pantalla todavía)
utils/panueloShare.ts               Compartir la foto
utils/sha256.ts                     Hash de los códigos
types/panuelo.ts                    Tipos y el protocolo app ↔ visor
constants/panueloGlyphs.ts          Las formas
firebase-seed/panuelo.json          Catálogo de muestra (y el que se usa sin catálogo remoto)
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
AsyncStorage  @panuelo_state            Lo mismo que el nodo del usuario
AsyncStorage  @panuelo_seen             Ids de las piezas ya presentadas en este móvil
AsyncStorage  @panuelo_tutorial_seen    Versión del tutorial ya vista en este móvil
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

Analítica: `panuelo_abierto` y `panuelo_pieza_conseguida { clase, via }`.

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

- **Contenido en datos**: `constants/panueloTutorial.ts`, un array de secciones
  `{ id, title, body, steps?, example? }`. El comentario de arriba del fichero
  dice cómo añadir una. Solo se cuenta lo que la app hace hoy (nada de
  intercambios hasta que tengan pantalla): un test lo vigila.
- **A pantalla completa**: la primera vez y al pulsar el «?» de la cabecera.
  Mientras dura se **oculta la cabecera nativa** (`navigation.setOptions({
headerShown: false })`) y el tutorial lleva la suya, por debajo de la barra de
  estado y del notch: «Tu pañuelo» y una X (44 pt) para salir. Así no hay dos
  títulos ni la cabecera tapando la X. Debajo, el visor grande y, abajo, el
  texto del paso con su indicador, «Atrás» / «Siguiente» (o deslizar) y
  «Entendido» en el último; «Saltar» antes.
- **Un único visor**: no es un `Modal` ni un segundo WebView (un WebView no se
  puede mover entre árboles sin recargarse, y dos contextos WebGL son memoria y
  batería para nada). El tutorial es la **misma pantalla re-maquetada**: el
  visor sigue montado en el mismo sitio del árbol y solo cambia de tamaño al
  desaparecer el panel de la colección, que cede su sitio a la tarjeta del paso.
- **Cada paso ilustra lo que cuenta** (`usePanueloTutorialStage`): el visor
  recibe un pañuelo de ejemplo del catálogo de muestra y las órdenes del paso.

  | Paso              | Ejemplo en el visor                                                 |
  | ----------------- | ------------------------------------------------------------------- |
  | Tu pañuelo        | Pañuelo verde con dos piezas, para girar                            |
  | Las piezas        | Las seis clases cosidas + dibujadas en plano debajo                 |
  | Verlas de cerca   | Una medalla enfocada (`focus`)                                      |
  | Decorarlo         | Modo decorar con una pieza seleccionada (`select`); los pasos 1-2-3 |
  | Recolocar         | Modo decorar con todas las piezas repartidas                        |
  | Canjear un código | Una pieza que se presenta (`reveal`); los pasos 1-2-3               |
  | Tu colección      | Pañuelo con piezas (el filtro Todas · Puestas · Sin poner)          |
  | Compartir         | Pañuelo con piezas                                                  |
  | Cambiar de etapa  | La tela pasa de verde a azul (`toColor`)                            |
  | Mis pañuelos      | Un pañuelo rojo, como un recuerdo                                   |

  En el ejemplo no se toca nada de lo tuyo: arrastrar piezas, enfocar o
  seleccionar se ignoran mientras dura.

- **Cuándo sale**: solo, la primera vez; y siempre desde el «?» de la cabecera
  nativa (`accessibilityLabel` «Cómo funciona tu pañuelo»; en iOS un
  `Stack.Toolbar.Button`, en Android y web un `headerRight`). Se recuerda en
  `@panuelo_tutorial_seen` con la **versión** (`PANUELO_TUTORIAL_VERSION`, hoy
  2): al subirla —cuando cambia de verdad una función, no por retocar una
  frase— se vuelve a enseñar una vez. Va **primero**: ni el canje de
  `?codigo=`, ni la presentación de una pieza nueva, ni la pregunta de cambio
  de etapa salen hasta que se cierra.
- **Cómo ampliarlo**: añade la sección al array; si es una función nueva, sube
  la versión; pon el cambio aquí y en el CHANGELOG.

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

## Intercambios (la base está puesta; falta la pantalla)

La idea: dos personas, cara a cara, se cambian una pulsera o una chapa, como se
hace con las de verdad. **Una enseña un código, la otra lo escribe, cada una
elige qué da, y se cambian.**

Qué piezas se pueden cambiar: las que el catálogo marque con
`tradeable: true`. Si no dice nada, **solo las pulseras** (`isTradeable`). Una
medalla se gana por haber estado; no se cambia.

### Cómo va

1. Ana abre una pieza suya intercambiable y pulsa «Intercambiar». Nace un
   intercambio `open` con un **código de 6 caracteres** (sin 0/O ni 1/I/L: se
   dicta de viva voz en un patio con ruido) que caduca a los **10 minutos**.
2. Ana le enseña el código o su QR a Luis. Luis lo escribe, ve la pieza de Ana
   y elige qué da a cambio — o nada, y entonces es un regalo. Pasa a `proposed`.
3. Ana ve lo que ofrece Luis y acepta. Pasa a `accepted`.
4. Cada móvil aplica **su mitad**: sale la pieza que da y entra la que recibe,
   **cosida en el mismo sitio** del pañuelo (un cambio, no un hueco).

No se puede recibir una pieza que ya se tiene: en el pañuelo cada pieza está
una vez. Cualquiera de las dos partes puede echarse atrás antes de aceptar.

### Qué hay hecho

`utils/panueloTrade.ts`, con sus tests (`__tests__/panueloTrade.test.ts`): las
reglas enteras como funciones puras — `createTradeOffer`, `answerTrade`,
`acceptTrade`, `cancelTrade`, `applyTrade`, los códigos y la caducidad.

Y la pieza que hace que funcione con la nube: el estado apunta lo que se da
(`gone: { <id>: cuándo }`). Sin eso, al juntar el móvil con la nube —que SUMAN
piezas— lo regalado volvería a aparecer. Una pieza se tiene si se consiguió
**después** de darla.

### Qué falta

1. **El servicio** (`services/panueloTradeService.ts`): crear, leer y escuchar
   `panueloTrades/{code}` en RTDB. El patrón es el de `choirSessionService.ts`.
2. **La pantalla**: botón «Intercambiar» en la ficha (ya sale el chip
   «Intercambiable»), hoja con el código y su QR
   (`react-native-qrcode-svg` ya está), hoja para escribirlo o escanearlo
   (`components/playlist/QrScannerModal.tsx`), elegir qué se da, y la
   animación: la pieza que sale vuela fuera y la que entra se presenta.
3. **Subir la mitad de cada uno**: borrar `items/{id}` y escribir `gone/{id}`
   en `users/{uid}/panuelo` (hoy `syncPanueloItem` solo añade).
4. **Las reglas de Firebase** de `panueloTrades` (propuesta, sin desplegar):

   ```json
   "panueloTrades": {
     "$code": {
       ".read": "auth != null",
       ".write": "auth != null && (!data.exists() ? newData.child('offer/uid').val() === auth.uid : (data.child('offer/uid').val() === auth.uid || !data.child('answer').exists() || data.child('answer/uid').val() === auth.uid))",
       ".validate": "newData.hasChildren(['code', 'status', 'createdAt', 'expiresAt', 'offer'])"
     }
   }
   ```

   Los intercambios **necesitan sesión** en los dos móviles.

5. **Limpieza** de intercambios caducados (una Cloud Function programada, o
   que cada móvil borre los suyos al abrir).

### El límite que hay que conocer

Cada móvil aplica su mitad porque hoy cada persona solo puede escribir en su
propio nodo. Eso no es atómico ni a prueba de trampas: alguien con ganas
podría quedarse con las dos piezas. Es el **mismo nivel de confianza que los
códigos**, y para un juego entre gente que se conoce vale. El día que haya
servidor (Integración D), el paso 4 lo hace una función con una sola
transacción y nada de lo demás cambia.

## Lo que se sabe que falta

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
- **Repartir desde el Panel** necesita que el Panel pueda escribir en
  `/users/{uid}` (hoy no puede sin autenticación real: Integración D).
