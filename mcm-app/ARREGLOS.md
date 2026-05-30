# Cantoral — Arreglos (`{arr: ...}`)

Anotaciones de **arreglo** dentro de las canciones del cantoral: indicaciones sutiles
sobre cómo se interpreta una parte ("esta estrofa la cantan Ana y Sara", "aquí entran
los violines", "intro solo guitarra", dinámicas, entradas de voces, etc.).

## Directiva

```
{arr: TEXTO LIBRE}
```

- Es una **directiva propia** del cantoral MCM. ChordPro **no** define una directiva
  estándar para esto (solo `{comment}`/`{c}` y `{comment_italic}`/`{ci}`, que usamos para
  comentarios normales). Por eso adoptamos `{arr:}`, explícita y específica de "arreglos".
- El texto es libre. Una directiva `{arr: ...}` por anotación.
- Colócala en su **propia línea**, justo encima de la línea/sección a la que se refiere.

### Ejemplo

```
{title: Ejemplo}
{arr: Intro: solo guitarra}
[C]Esta es la pri[G]mera estrofa
{arr: Esta parte la cantan Ana y Sara}
[Am]y aquí entran los [F]violines
```

## Cómo se ve en la app

- El texto del arreglo se muestra **alineado a la derecha**, en cursiva, algo más pequeño
  que la letra y en color de acento (rojo MCM `#E15C62`; en modo oscuro `#FF8A80`), con un
  prefijo `"| "` delante. Es deliberadamente sutil: complementa la letra sin competir con
  ella. La alineación a la derecha y la barra `|` son los rasgos que lo hacen identificable
  de un vistazo.
- **Activación (ON por canción):** cualquier canción que contenga `{arr:}` muestra los
  arreglos **activados por defecto**. Se pueden ocultar desde el botón flotante de ajustes
  (acción "Arreglos ON/OFF"), pero ese estado **no se persiste** ni se arrastra a otras
  canciones: al abrir otra canción con arreglos, vuelven a salir activados.
- **Indicación:** la acción "Arreglos" solo aparece en canciones que tienen arreglos.
  Cuando hay arreglos disponibles, el botón flotante muestra un pequeño indicador de color
  de acento (esquina superior izquierda), distinto del punto rojo de "modificaciones".
- **Alcance:** se muestran en el detalle de canción, en pantalla completa (presentación) y
  en la exportación a PDF de playlists.

## Añadir arreglos desde la app (admin)

- **Quién:** solo en **modo admin** (se activa al introducir la contraseña del panel
  secreto, `coco`; el flag `isAdmin` se persiste — ver `contexts/SettingsContext.tsx`).
- **Cómo:** **mantén pulsada** (long-press, ~450 ms) la línea de la canción sobre la que
  quieras anotar. Se abre una hoja (`components/ArrangementInputModal.tsx`) donde escribes
  el texto del arreglo; al confirmar se inserta `{arr: ...}` **encima** de esa línea.
- **En vivo:** el arreglo se ve **al instante** en el dispositivo (se actualiza el ChordPro
  local) y además se **propone como edición** a `songs/ediciones`
  (`contentOld`/`contentNew`, `status: 'arrangement'`) para que el repo lo sincronice al
  `.cho`.
- **Mapeo robusto:** el visor renderiza HTML en un WebView. `HtmlDivFormatter` emite una
  `<div class="row">` por cada línea renderable, en orden de fuente, así que etiquetamos
  cada fila con `data-line` = índice de su línea en el ChordPro original
  (`injectRowLineIndices`). La transposición no cambia el número ni el orden de filas, por
  lo que el índice es **transpose-invariante**. Si por lo que sea los conteos no cuadran,
  no se etiqueta nada (no se arriesga una inserción en el sitio equivocado).

## Detalles técnicos (para mantenimiento)

- `utils/arrangements.ts` centraliza la lógica:
  - `hasArrangements(chordPro)` — detecta si hay `{arr:}`.
  - `preprocessArrangements(chordPro)` — convierte `{arr: T}` en `{comment: @@ARR@@T}`
    **antes** de parsear con ChordSheetJS (así el `HtmlDivFormatter` lo posiciona solo).
  - `postProcessArrangementsHtml(html)` — reetiqueta esos comentarios-centinela como
    `<div class="arrangement">…</div>` y antepone el prefijo `"| "` al texto (sin duplicarlo
    si ya empieza por `|`).
- El toggle de visibilidad usa la clase `arr-hidden` en `<body>` (igual que `chords-hidden`),
  por lo que es un cambio **en vivo** sin reconstruir el HTML (`hooks/useSongProcessor.ts`).
- `utils/playlistPdfHtml.ts` aplica el mismo pre/post-proceso para el PDF.

---

## Prompt para el generador de archivos ChordPro

> Copia este texto en tu gestor/generador de archivos ChordPro para que sepa incorporar
> la directiva de arreglos:

```
Cuando una canción tenga una indicación de ARREGLO (quién canta una parte, qué instrumento
entra, dinámicas, entradas de voces, etc.), añádela con la directiva custom {arr: TEXTO} en
su propia línea, justo encima de la línea o sección a la que se refiere.

Reglas:
- Una directiva {arr: ...} por anotación. El texto es libre.
- No la confundas con {comment:} (que es para comentarios normales). Usa {arr:} solo para
  indicaciones de arreglo/interpretación.

Ejemplo:
{arr: Intro: solo guitarra}
[C]Primera [G]estrofa
{arr: Esta parte la cantan Ana y Sara}
[Am]segunda [F]parte
```
