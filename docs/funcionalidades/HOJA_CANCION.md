# Hoja de canción — cómo se pinta una canción

> Qué hace la app con el ChordPro de una canción para que se lea bien en un
> móvil, en un iPad y a un metro del atril. Código: `mcm-app/utils/songSheet.ts`
> (modelo + HTML), `mcm-app/utils/songSheetLayout.ts` (CSS + script de
> maquetación dentro del WebView), conectado en `hooks/useSongProcessor.ts`.
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

El PDF de la playlist (`utils/playlistPdfHtml.ts`) **sigue** con
`HtmlDivFormatter`: en papel A4 no hay problema de ancho.

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
| `verseNumbers` | «Tipo de letra» → Estrofas (solo si la canción lleva números)                  | Sí          |
| `fontFamily`   | «Tipo de letra» → Fuente                                                       | Sistema     |

La letra por defecto pasó de monoespaciada a la del sistema el 2026-10-09: la
monoespaciada gasta un 30 % más de ancho. `migrateSongSettings` cambia una vez
a quien tuviera la monoespaciada o la «Sans-Serif» vieja; quien vuelva a
elegir la monoespaciada se la queda.
