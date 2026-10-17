# Hoja de canción — cómo se pinta una canción

> Qué hace la app con el ChordPro de una canción para que se lea bien en un
> móvil, en un iPad y a un metro del atril. Código: `mcm-app/utils/songSheet.ts`
> (modelo + HTML), `mcm-app/utils/songSheetLayout.ts` (CSS + script de
> maquetación dentro del WebView), `mcm-app/utils/songDocument.ts` (el
> documento entero, puro) y `hooks/useSongProcessor.ts` (el estado de React).
> Cómo escribir un `.cho` que aproveche todo esto: `docs/CAMPOS_CANCIONES.md`
> §4.6 del repo `mcmapp-cantoral`. Plan y decisiones:
> [`PLAN_HOJA_CANCION.md`](../planes/PLAN_HOJA_CANCION.md).

## Por qué no `HtmlDivFormatter`

ChordSheetJS sigue parseando y transportando, pero ya no pinta. Su formateador
parte cada línea en columnas que van **de acorde a acorde**, no por palabras,
y en un móvil el salto de línea caía donde caía el acorde («a / SOL / quí»).
El arreglo del 2026-10-03 juntaba las columnas de una misma palabra, pero la
columna seguía siendo de acorde a acorde: «Miembro de / un pueblo, tengo
familia.». Además dejaba un renglón vacío de acordes encima de cada línea sin
acordes.

El PDF de la playlist (`utils/playlistPdfHtml.ts`) también usa ya esta hoja
(desde el 2026-10-10, ver «PDF de la playlist» más abajo).

## Modelo (`buildSheet`)

`Song` de ChordSheetJS → secciones → líneas → **palabras** (`SheetAtom`). Una
palabra es la unidad que nunca se parte; un acorde a media palabra es el
segundo trozo de su palabra.

- **Secciones**: estrofa, estribillo, puente, instrumental (solo acordes) y
  nota (solo comentarios). Se abre sección nueva en cada línea en blanco **y**
  en cada cambio de tipo de línea: un `{soc}` pegado a la estrofa ya no se
  queda dentro de ella.
- **Etiquetas** desde `{c: Estribillo}`, `{c: Puente}`, `{c: Intro}`,
  `{c: Estrofa 2}`: no se pintan como comentario, etiquetan la sección que
  empieza ahí.
- **Marcas de revisión** (`{comment: ♩ REVISAR ACORDES}`, «PENDIENTE»,
  «TO DO») salen de la letra y van a la cabecera como «Acordes sin revisar».
- **Líneas de solo acordes** (`[G] [C] [D] x2`): línea de acordes, sin renglón
  de letra.
- **Acorde sobre un hueco** (`[G] al oírlo`): va con la palabra siguiente, así
  un renglón nunca empieza por un hueco.
- **Numeración**: con dos o más estrofas se numeran solas. Si el `.cho` trae
  «1. » al principio de una estrofa (o `{c: Estrofa 3}`), se quita de la letra
  y se respeta ese número; entonces no se numeran las demás.
- **Repeticiones**: cada estribillo se compara con los anteriores por la letra
  normalizada (sin tildes, puntuación, mayúsculas ni «(bis)»). Idéntico →
  repetición exacta; parecido ≥ 80 % (distancia de edición por palabras) →
  repetición «con cambios». También se mira si lleva los mismos acordes (un
  estribillo que sube de tono tiene la misma letra y no).
- **Referencias** — `{chorus}`, `{chorus: Etiqueta}` o una línea que solo dice
  «ESTRIBILLO» / «(Coro)»: como en ChordPro, el último estribillo antes de la
  referencia (o el de esa etiqueta). Se pinta entero.
- **Estribillo sin marcar**: un bloque de 2+ líneas que aparece idéntico dos
  veces se trata como estribillo.

## HTML (`renderSheetHtml`)

- Cada repetición sale **dos veces**: completa (`.rep-full`) y plegada en un
  `<details class="rep-fold">` con su primera frase. La clase `compact` del
  `<body>` decide cuál se ve: cambiar de vista no recarga el WebView.
- `data-line` (número de línea en el ChordPro original) solo en modo admin,
  para el toque largo de los arreglos (`ARREGLOS.md`).
- El texto ya llega escapado (`useSongProcessor` escapa el ChordPro antes de
  parsear) y no se vuelve a escapar.

## Maquetación (`SHEET_LAYOUT_JS`, dentro del WebView)

Un string ES5 (Hermes no guarda el fuente de las funciones). Los tests lo
evalúan tal cual (`__tests__/songSheetLayout.test.ts`).

1. **Acordes que vuelan**: el acorde no ocupa ancho; solo si dos acordes
   chocarían se ensancha la letra entre ellos, y a media palabra una raya
   tenue la une («acércate──.»).
2. **Cortes**: si una línea no cabe, programación dinámica sobre las palabras:
   primero el menor número de renglones; luego cortar tras punto (0), coma
   (2), antes de «y/que/porque…» (3), antes de preposición (5), cualquier otro
   sitio (8), y nunca detrás de un artículo, posesivo o preposición (18). Los
   renglones de continuación llevan sangría.
3. **Columnas (iPad)**: si la canción entera cabe en pantalla a 2–3 columnas,
   achicando la letra hasta un 20 % si hace falta, se reparte en columnas. Si
   no, una columna a su tamaño. En el móvil nunca caben dos columnas.

Se recoloca al cargar, al girar, al cargar las fuentes, al abrir un estribillo
plegado y cada vez que el puente de estilos (`__SONG_BRIDGE__`) cambia letra,
tamaño, acordes o vista.

**Sin script** (la pantalla completa en web mete el HTML con `innerHTML`, que
no ejecuta scripts): las líneas se parten solas con `flex-wrap`, por palabras
enteras, y cada acorde ocupa su ancho. Peor sitio para cortar, pero nunca a
media palabra.

## Opciones (`SettingsContext`)

| Ajuste         | Dónde                                                                          | Por defecto |
| -------------- | ------------------------------------------------------------------------------ | ----------- |
| `compactView`  | Menú de la canción → «Plegar estribillos repetidos» (solo si alguno se repite) | No          |
| `verseNumbers` | «Letra y vista» → Números                                                      | Sí          |
| `songMap`      | «Letra y vista» → Mapa (solo si la canción tiene mapa que enseñar)             | No          |
| `fontFamily`   | «Letra y vista» → Fuente                                                       | Sistema     |
| `chorusStyle`  | «Letra y vista» → Estribillo                                                   | Negrita     |
| `featuredTags` | Onboarding → «Destacadas» o Etiquetas → Editar → Destacar (atajos arriba del cantoral)                   | Ninguna     |

**Onboarding** (`components/song-onboarding/CantoralOnboarding.tsx`, lógica
en `utils/cantoralOnboarding.ts`): se abre solo la primera vez que se entra
en el cantoral (`cantoralOnboarding` < `CANTORAL_ONBOARDING_VERSION`; súbela
para que todos lo vuelvan a ver) y siempre con el «?» del header. Pregunta
por acordes y notación, completa/compacta, estilo del estribillo, letra y
etiquetas, y cada respuesta se ve al momento en una canción de verdad
(`pickPreviewSong`: una con estrofas, acordes y estribillo repetido) que baja
sola a lo que cambia (`SongDisplay` → `scrollTo`). Se cierra en cualquier
paso; lo tocado se queda, porque son ajustes normales.

La letra por defecto pasó de monoespaciada a la del sistema el 2026-10-09: la
monoespaciada gasta un 30 % más de ancho. `migrateSongSettings` cambia una vez
a quien tuviera la monoespaciada o la «Sans-Serif» vieja; quien vuelva a
elegir la monoespaciada se la queda.

## Segunda vuelta (2026-10-09)

- **Huecos**: renglón partido pegado; otra línea del `.cho` `--gap-line`;
  una línea en blanco `--gap-sec`; dos o más, o un estribillo, `--gap-big`.
  «Más aire» (`airy`) los abre todos.
- **Líneas partidas de PDF**: se unen si la siguiente empieza en minúscula y
  la línea pasa de 70 caracteres, o de 60 sin puntuación final.
- **Variantes del estribillo** (`chorusStyle`): `negrita` (raya + negrita,
  de serie desde el 2026-10-10), `raya`, `mayus`, `clasico`, `sangrado`;
  `chorusLabel` quita la etiqueta.
- **iPad**: en columnas, `auto-compact` pliega las repeticiones; si girando
  cabría entera, `.rot-hint` lo avisa.
- **Modo atril** (`pagedFullscreen`, pantalla completa nativa): columnas de
  la altura de la pantalla en páginas; toque (tercio izquierdo = atrás),
  deslizar o teclas (flechas, AvPág/RePág, espacio, Intro: lo que mandan los
  pedales). `__SONG_LAYOUT__.page(±1)`.

## El admin del cantoral pinta igual (2026-10-10)

La vista previa del admin (`mcmapp-cantoral/scripts/admin`, el «script C»)
usa **este mismo código**: `utils/songDocumentBundle.ts` lo expone como
`window.MCMSheet.render(chordPro, opciones)` y `npm run build:sheet-bundle`
(esbuild) lo empaqueta en `mcmapp-cantoral/scripts/admin/static/mcm-sheet.js`,
que se commitea en el cantoral. Allí se pinta en un iframe del tamaño real de
un móvil o un iPad, también al lado del editor Raw mientras se escribe.

- `useSongProcessor` solo guarda el estado; el HTML sale de
  `buildSongDocument` (`utils/songDocument.ts`), sin React ni React Native.
  Las letras viven en `constants/songFonts.ts` por lo mismo.
- `__tests__/songDocumentBundle.test.ts` comprueba que el paquete pinta byte a
  byte lo mismo que el hook (en web), que sus valores por defecto son los de
  `SettingsContext` y que se puede empaquetar (si alguien mete un import de
  React Native en la hoja, salta).
- **Al cambiar la hoja**: `npm run build:sheet-bundle` y commitear
  `mcm-sheet.js` en el cantoral, o el admin enseñará la versión anterior.
- **El editor Visual** (el de arrastrar acordes, el que más se usa) se
  parece a la app: acordes azules sin pastilla maciza, el estribillo con la
  raya amarilla y en negrita, la marca «ESTRIBILLO», intros como fila de
  acordes y comentarios en cursiva gris; y con «📱 Ver en el móvil» lleva la
  hoja de verdad al lado, bajando a la par. Arreglado de paso: las intros
  (letra de solo espacios) salían como un «1» con los acordes amontonados,
  porque Alpine toma por número una cadena como `"   "` en un `x-for`.

## Pantalla completa (2026-10-10)

`app/screens/SongFullscreenScreen.tsx`; qué canción y con qué tono, en
`utils/fullscreenSong.ts` (puro, con tests).

- **Se entra** con el botón ⛶ de la cabecera de la canción (antes solo desde
  el menú «⋯») y se sale con la ✕ o Esc (teclado, también con el foco en la
  letra). En web, **F** pone o quita la pantalla completa **del navegador**
  (sin barra de direcciones, para el proyector); con ella puesta, el Esc se lo
  queda el navegador y al salir se cierra la presentación igual
  (`hooks/useBrowserFullscreen.ts`). Sin la API (Safari de iPhone), F cierra.
- **Mismo tono y cejilla** con los que se estaba viendo: antes volvía siempre
  al original. Y la letra viva (los arreglos recién añadidos por el admin).
- **Pasar de canción** sin salir: botones ‹ 3 / 8 › abajo a la izquierda,
  deslizar en horizontal, flechas ← →, y en modo atril pasar de la última
  página (toque, deslizar o pedal) lleva a la siguiente canción. La hoja lo
  avisa con el mensaje `{ type: 'sheet-nav', dir }`. Al cerrar, el detalle se
  queda en la canción a la que se haya llegado (`popTo`).
- **Coro**: quien escucha sigue la canción del líder sin salir de la pantalla
  completa (aviso «Siguiendo al coro»); el líder publica la canción a la que
  pase (`screen: 'fullscreen'`).
- **Web**: la canción va en un iframe (como en el detalle), así que corre la
  maquetación y también hay modo atril con teclado o pedal. La hoja recibe el
  foco al entrar, así que el pedal pasa página **sin hacer clic antes**, y con
  los controles escondidos también se esconde el **cursor**. Las teclas que
  se pulsan con el foco en la hoja se reenvían a los atajos de la pantalla
  (ver «Teclado del iframe»).
- **Pantalla siempre encendida** (`hooks/useKeepAwakeWhileFocused.ts`): en el
  detalle y en la pantalla completa, por foco y no por montaje.
- **Los controles se apagan solos** (`hooks/useImmersiveChrome.ts`): a los
  3,5 s sin tocar nada se desvanecen (‹ › , atril, play) y la ✕ se queda
  atenuada; vuelven con cualquier toque, tecla, rueda o movimiento del ratón.
  Dentro de la hoja, el documento de pantalla completa lleva `FS_TOUCH_JS`,
  que avisa con `{ type: 'sheet-touch' }`. En modo atril el toque también
  pasa página (es su gesto). Con lector de pantalla no se esconden nunca;
  en web no se pregunta, porque react-native-web contesta siempre que sí.
- Arreglado de paso: el `{arr:}` multiplicaba dos veces el tamaño de la letra
  y, en pantalla completa o con la letra grande, salía más grande que ella.

## PDF de la playlist (2026-10-10)

`utils/playlistPdfHtml.ts` pinta el cuerpo de cada canción con
`buildSheet` + `renderSheetHtml` y `SHEET_CSS`, como la app (antes,
`HtmlDivFormatter`, que ni escapaba el texto ni sabía de estribillos
repetidos). Sin `SHEET_LAYOUT_JS`: en papel no hay pantalla que medir, así que
una línea que no cabe se parte por palabras enteras.

- El estribillo, la etiqueta y los números de estrofa salen como los tiene
  cada uno en la app (`chorusStyle`, `chorusLabel`, `verseNumbers`); los
  acordes, en un azul más oscuro (en papel el de la app se queda flojo).
- **Ni una estrofa ni un estribillo partidos entre dos páginas.** Una canción
  que cabe en lo que queda de página no se parte. Una más larga que una
  página (`estimateSongHeightPt`, a ojo con las medidas de `SHEET_CSS`) no
  salta de página entera, que solo dejaba media página en blanco: empieza
  donde toque y se parte entre secciones. El título nunca se queda solo al
  pie con la intro.
- **Opciones nuevas** en «Exportar a PDF»: «Estribillos repetidos en una
  línea» (la vista compacta; de serie, la que tenga en la app) y «A dos
  columnas» (casi todas las canciones caben en una página; de serie, no). Con
  las dos, una playlist de 6 canciones pasa de 12 páginas a 8.
- Tests en `__tests__/playlistPdfHtml.test.ts`.

## Tercera vuelta (2026-10-17)

### Mapa de la canción

Una línea discreta encima de la letra con el orden de la canción:
«1 · E · 2 · E×2» (estrofas numeradas, E estribillo, P puente, ×N si se repite).
`buildSongMap` / `renderSongMapHtml` en `utils/songSheet.ts`; CSS en
`utils/songSheetLayout.ts`.

- **Cuándo sale**: solo con estribillo o puente que ubicar y al menos tres
  pasos (`songMapWorthShowing`). Si no, no hay mapa ni opción «Mapa».
- **Ajuste «Mapa»** (`songMap`, apagado de serie): el HTML lleva siempre el
  mapa, oculto, y lo enseña la clase `show-map` del `<body>`; cambia en vivo
  por el puente de estilos, sin recargar.
- Si ocultar acordes cambia el mapa (había intros), van dos versiones
  (`mp-all` / `mp-lyr`) y `chords-hidden` elige.

### Atajos de teclado del detalle (web)

`←` / `→` canción anterior o siguiente, `+` / `−` transponer (con o sin Shift),
`C` acordes, `F` pantalla completa, `Esc` atrás. Se apagan con una hoja o un
modal encima y fuera del foco (`SongDetailScreen`, `hooks/useKeyboardShortcut.ts`).

### Teclado del iframe

Un `keydown` dentro del iframe no sube a la ventana, así que tras hacer clic en
la letra dejaban de funcionar ⌘K y los atajos. `makeKeydownForwarder`
(`utils/songDisplayBridge.ts`) reemite cada tecla (menos Tab) en la ventana de
la app y, si un atajo la consume, cancela la original. Lo usan `SongDisplay` y
la pantalla completa.

### Transponer y cambiar la notación sin recargar

`utils/songDisplayBridge.ts`: transponer o cambiar la notación reconstruye el
HTML, que antes recargaba el WebView entero (parpadeo y vuelta arriba).
`SongDisplay` decide con `nextSongView`:

- **Intercambia el contenido del `<body>`** (`swapBodyScript`) si la página
  está lista, es la misma canción (`docKey`) y la **carcasa** no cambia
  (`documentShell`: cabecera con el CSS, etiqueta `<body>` con sus clases y los
  `<script>`). Conserva el scroll y los estribillos plegados abiertos, y vuelve
  a maquetar.
- **Recarga** si es otra canción, si cambia el modo admin (otros scripts), si
  cambia el CSS horneado (otro tema) o si hay spinner.
- **Regla para la hoja**: lo que depende del tono o de la notación debe ir en
  el contenido del `<body>`, nunca en el `<head>` ni en los scripts, o cada
  cambio de tono volvería a recargar. `__tests__/songDisplayBridge.test.ts` lo
  vigila.

### Imprimir una canción (web)

«Imprimir» en el menú de la canción (solo web, `SongControls`): abre la hoja en
papel (`utils/printSong.ts`, como el PDF de la playlist) con el tono, la
cejilla y la vista que se tienen ahora. Espera a que carguen estilos y fuente
con `utils/printWhenReady.ts`. Si el navegador bloquea la ventana, un aviso pide
permitir las emergentes.

### Aviso de «gira la pantalla»

Solo en pantallas **táctiles** (`navigator.maxTouchPoints`, `canRotate`): en un
monitor no tiene sentido girar nada.

### Enlace a una canción

`/cancion?f=<fichero>` (`app/cancion.tsx`): resuelve el fichero contra el
catálogo y abre la canción en el cantoral. En web, el detalle escribe ese mismo
enlace en la barra de direcciones (`hooks/useSongWebLocation.ts`): F5 vuelve a
la canción y copiar la URL sirve para pasarla. También lo abre la paleta ⌘K.
