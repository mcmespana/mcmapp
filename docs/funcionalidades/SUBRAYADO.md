# Subrayado de lecturas (Contigo → Evangelio)

> Cómo funciona el subrayado de las lecturas del día, por qué el texto se
> renderiza como se renderiza, y qué falta (build nativa) para meter "Subrayar"
> dentro del menú nativo de iOS/Android.

## Piezas

```
utils/highlightRanges.ts                   Lógica pura: rangos, paleta, add/remove, spans
utils/readingSegments.ts                   normalizeReadingText() → texto CANÓNICO
utils/contigoBookmarks.ts                  HighlightSource + HIGHLIGHT_SOURCES + persistencia
hooks/useReaderBookmarks.ts                Persistencia local + RTDB por usuario
hooks/useReadingHighlights.ts              Estado de subrayado de TODAS las fuentes del día
components/contigo/HighlightableReading.tsx  El componente de texto (selección nativa)
components/contigo/HighlightActionBar.tsx  Barra flotante: colores pastel + goma + Listo
components/contigo/ReadingCard.tsx         Tarjeta plegable de cada lectura
app/(tabs)/contigo/evangelio.tsx           Pantalla que lo une todo
```

## Modelo de datos

Los subrayados se guardan como **rangos de caracteres** (`{start, end, color,
text}`) sobre el **texto canónico** de cada fuente, no como frases sueltas. El
texto canónico lo produce `normalizeReadingText()` y es exactamente la cadena
que se renderiza, así que los offsets siempre cuadran.

Fuentes subrayables (`HighlightSource`, en orden de pantalla):

| Fuente       | De dónde sale                   |
| ------------ | ------------------------------- |
| `evangelio`  | `readings.evangelio.texto`      |
| `comentario` | `readings.evangelio.comentario` |
| `lectura1`   | `readings.lectura1.texto`       |
| `salmo`      | `readings.salmo.texto`          |
| `lectura2`   | `readings.lectura2.texto`       |

Se persisten dentro del bookmark del día (`highlights[source]`), local en
AsyncStorage y en RTDB (`users/<uid>/contigo/bookmarks/<fecha>`) si hay sesión.
Subrayar auto-crea el bookmark para no perder ni el subrayado ni el texto.

**Para añadir una fuente nueva** basta con: añadirla a `HighlightSource` y a
`HIGHLIGHT_SOURCES`, mapear su texto crudo en `rawTexts` dentro de
`useReadingHighlights`, y pasar `canonical/ranges/onSelectionChange` de esa
clave al componente. Nada más — no hay memos ni handlers que duplicar.

## Por qué el texto es un `TextInput` de solo lectura

`<Text selectable>` de React Native no da una experiencia de selección decente
en iOS: se apoya en una vista de texto recortada, sin el menú completo del
sistema (Herramientas de escritura / Apple Intelligence, Traducir, Buscar,
Compartir). Un `TextInput` multilínea de solo lectura **es** un `UITextView`
real, así que el texto se comporta como en Notas o Safari.

Reglas del componente `HighlightableReading`:

- **iOS**: `TextInput` de solo lectura (`editable={false}`) SIEMPRE, tanto
  leyendo como subrayando. No se cambia de componente al entrar en modo
  subrayar → no se pierde la selección ni salta el layout.
- **Android**: `Text selectable` al leer (menú nativo de copiar, y sin el riesgo
  de que "Pegar" meta texto en la lectura) y `TextInput` al subrayar, que es la
  única forma de conocer los offsets exactos de la selección.
- **Web**: `Text` seleccionable al leer y `TextInput` con `value` al subrayar —
  React Native Web no admite hijos dentro del `<textarea>`, así que en web los
  colores se ven al salir del modo subrayar. Limitación conocida y aceptada.

Los tramos de color se pasan como **hijos `<Text>`** del `TextInput` (React
Native los convierte en la cadena atribuida nativa), no como un `value` plano.
Por eso los subrayados siguen visibles dentro del modo subrayar.

## Pendiente: "Subrayar" en el menú nativo (requiere build de tienda)

Hoy el flujo es: botón del rotulador en el header → modo subrayar → seleccionar
→ elegir color en la barra flotante. Lo ideal sería seleccionar texto en
cualquier momento y que el **menú nativo del sistema** tuviera un ítem
"Subrayar" con sus colores, sin modo aparte.

Eso **no se puede hacer desde JS**: hay que tocar código nativo, con lo que
implica un **build de tienda** (no vale una OTA) y commit con `[skip-ota]`.

### iOS

- Módulo nativo (Expo Module o view manager) que envuelva un `UITextView`.
- Implementar `textView(_:editMenuForTextIn:suggestedActions:)` (iOS 16+) y
  devolver un `UIMenu` con un submenú "Subrayar" y una `UIAction` por color de
  `HIGHLIGHT_COLORS`.
- La acción emite un evento a JS con `{start, end, color}` (los offsets ya
  vienen del `selectedRange` del `UITextView`, que es lo mismo que consumimos
  hoy vía `onSelectionChange`).
- Mantener el resto de acciones sugeridas para no perder Copiar / Herramientas
  de escritura / Traducir.

### Android

- Custom `ActionMode.Callback2` sobre el `TextView`/`EditText`
  (`setCustomSelectionActionModeCallback`) añadiendo un ítem "Subrayar".
- Mismo contrato hacia JS: `{start, end, color}`.

### Cuando se haga

1. `HighlightableReading` pasa a envolver la vista nativa; el resto (rangos,
   paleta, persistencia) no cambia — el contrato ya es `{start, end, color}`.
2. La barra flotante y el modo subrayar se pueden mantener como camino
   alternativo (accesible, y el único disponible en web).
3. Commit con `[skip-ota]` + avisar de que hace falta build de tienda:
   `npm run eas:build:ios -- --profile production`.

## Notas de comportamiento

- Al aplicar un color NO se sale del modo subrayar: como el subrayado ya se ve
  dentro del modo, se pueden marcar varias frases seguidas.
- La selección es "pegajosa": se conserva la última selección no vacía porque
  iOS puede colapsar la selección nativa antes de que llegue el `onPress` del
  chip de color.
- Al entrar en modo subrayar, las tarjetas de lecturas se abren una vez; a
  partir de ahí manda el usuario (el toggle de la tarjeta funciona normal).
