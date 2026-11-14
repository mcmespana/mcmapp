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
  a la colección, no se pierden) o volver a ponerlas.
- **Cambiar el color** del pañuelo (da una vuelta y cambia de tela).
- **Canjear un código** de una actividad: la pieza nueva se presenta girando,
  con chispas, y cae en su sitio.
- **Compartir** una foto del pañuelo.

Detalles que le dan vida: las medallas y las cintas **cuelgan de verdad** y se
mecen al girar el pañuelo o inclinar el móvil; en reposo el pañuelo se mece un
poco; tiene sombra de suelo. Quien tiene activado «reducir movimiento» en el
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
├── PanueloItemDetail.tsx           La ficha de una pieza
└── PanueloRedeemSheet.tsx          Canjear un código
components/preview-channel/PanueloLabPanel.tsx   La puerta del Laboratorio

hooks/usePanuelo.ts                 Estado: catálogo, piezas, colocación, sincronización
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

- **No hay modelo `.glb` del pañuelo: se calcula.** El rollo del cuello, el
  nudo con sus dos puntas y el triángulo de la espalda salen de fórmulas
  (`cloth.ts`). Pesa cero bytes, y la misma fórmula que dibuja el triángulo
  dice dónde y con qué inclinación va cosida cada pieza.
- **Se gira el pañuelo, no la cámara.** La luz y los reflejos se quedan
  quietos, como al darle vueltas a algo en la mano.
- **La app manda.** El visor no decide qué piezas hay ni dónde: pinta el estado
  que le llega (`PanueloCommand`) y avisa de lo que hace el dedo
  (`PanueloEvent`). Los dos tipos están en `types/panuelo.ts`.
- **Solo se pinta cuando algo cambia.** En modo decorar, quieto, no gasta.
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
RTDB  /users/{uid}/panuelo              { color, items, layout, layoutAt, gone? }
AsyncStorage  @panuelo_state            Lo mismo que el nodo del usuario
AsyncStorage  @panuelo_seen             Ids de las piezas ya presentadas en este móvil
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
- **No se ha probado en un móvil de verdad.** Se ha probado en navegador (el
  visor y la pantalla entera en web). Falta ver en iPhone y Android: el WebView
  transparente, el rendimiento con muchas piezas, la inclinación y compartir.
- **Repartir desde el Panel** necesita que el Panel pueda escribir en
  `/users/{uid}` (hoy no puede sin autenticación real: Integración D).
