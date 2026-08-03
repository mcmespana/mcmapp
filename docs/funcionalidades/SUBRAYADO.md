# Subrayado de lecturas (Contigo → Evangelio)

> Cómo funciona el subrayado de las lecturas del día, por qué el texto se
> renderiza como se renderiza, y cómo está montado el ítem "Subrayar" dentro
> del menú nativo de iOS/Android.

## Piezas

```
utils/highlightRanges.ts                   Lógica pura: rangos, paleta, add/remove, spans
utils/readingSegments.ts                   normalizeReadingText() → texto CANÓNICO
utils/contigoBookmarks.ts                  HighlightSource + HIGHLIGHT_SOURCES + persistencia
hooks/useReaderBookmarks.ts                Persistencia local + RTDB por usuario
hooks/useReadingHighlights.ts              Estado de subrayado de TODAS las fuentes del día
components/contigo/HighlightableReading.tsx  El componente de texto (selección nativa)
modules/highlight-menu/                    Módulo nativo: ítem "Subrayar" en el menú del sistema
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

## Seleccionar texto que YA está subrayado

Si la selección cae sobre un tramo ya subrayado, la barra de acciones deja de
tratarlo como texto nuevo: **marca con un aro el color que ya tiene** y la goma
se anuncia como "quitar el subrayado". Así el mismo gesto sirve para poner,
cambiar de color y quitar.

La lógica es pura y está en `selectionHighlight()` (`utils/highlightRanges.ts`):
dada la selección y los rangos, devuelve `{ color, full }`, o `null` si no toca
ningún subrayado. Si la selección pisa varios colores gana el que cubra más
caracteres; `full` dice si TODA la selección está subrayada o sólo una parte.
El hook `useReadingHighlights` lo expone como `selection` y la pantalla se lo
pasa a `HighlightActionBar`.

Está cubierto por tests en `__tests__/highlightRanges.test.ts`.

## "Subrayar" en el menú nativo del sistema

> Implementado el 2026-08-03 (build de tienda de agosto). **Requiere binario
> nuevo**: no sale por OTA.

Al seleccionar texto en cualquier lectura, el menú del sistema trae un ítem
**"Subrayar"** junto a Copiar / Traducir / Buscar / Herramientas de escritura.
Tocarlo guarda la selección y enciende la barra de colores de siempre. **No hay
que entrar antes en el modo lápiz.**

### Cómo está montado

`modules/highlight-menu/` — módulo local de Expo (se autolinka solo: Expo mira
en `./modules`). Exporta una única vista, `HighlightMenuView`, que **envuelve**
el texto y le añade la acción al menú.

```
modules/highlight-menu/
  ios/HighlightMenuView.swift      proxy del delegate + UIAction
  ios/HighlightMenuModule.swift    definición de la vista y sus props
  android/.../HighlightMenuView.kt ActionMode.Callback
  src/HighlightMenuView.tsx        vista JS (+ .web.tsx, que es un View pelado)
```

**Por qué envuelve el texto en vez de buscar la vista por su tag**: la búsqueda
por tag va contra el UIManager y con la nueva arquitectura ya no es de fiar.
Teniendo el texto dentro, basta recorrer las subvistas hasta el primer
`UITextView` (iOS) o `TextView` (Android). El coste es un nodo de layout extra,
y sólo cuando se pasa `onNativeHighlightRequest`: sin ese prop,
`HighlightableReading` renderiza exactamente el mismo árbol que antes.

**iOS — el proxy del delegate.** Desde iOS 16 el menú se construye en
`textView(_:editMenuForTextIn:suggestedActions:)`, y ese delegate **ya lo ocupa
React Native**. Quitárselo rompería cosas que sí usamos (`onSelectionChange`).
El proxy implementa SOLO ese método y reenvía todo lo demás al delegate original
con `forwardingTarget(for:)`, así que para React Native no cambia nada. El menú
base sigue siendo el que devuelva RN —o el sugerido por el sistema— y la acción
propia se antepone con `replacingChildren`.

**Offsets**: el `NSRange` de iOS y el `selectionStart/End` de Android van en
unidades UTF-16, que es exactamente cómo indexa JavaScript las cadenas. Los
offsets casan con el texto canónico sin convertir nada.

### Lo que NO cambió

- **El modo lápiz sigue ahí, intacto.** Es el único camino en web (no hay menú
  nativo que personalizar) y el respaldo si el menú no llegara a montarse.
- Rangos, paleta, persistencia y el contrato `{start, end, color}`: igual.
- El render de `HighlightableReading` sin `onNativeHighlightRequest`: igual.

### Qué falta por probar en dispositivo

- Que el menú de iOS conserve **todas** las acciones del sistema (Copiar,
  Traducir, Buscar, Herramientas de escritura) con el proxy puesto.
- Que `onSelectionChange` siga llegando en modo lápiz (es lo que el proxy
  podría romper si el reenvío fallara).
- Android: que el ítem salga tanto leyendo (`Text selectable`) como en modo
  lápiz (`TextInput`).

## Notas de comportamiento

- Al aplicar un color NO se sale del modo subrayar: como el subrayado ya se ve
  dentro del modo, se pueden marcar varias frases seguidas.
- La selección es "pegajosa": se conserva la última selección no vacía porque
  iOS puede colapsar la selección nativa antes de que llegue el `onPress` del
  chip de color.
- Al entrar en modo subrayar, las tarjetas de lecturas se abren una vez; a
  partir de ahí manda el usuario (el toggle de la tarjeta funciona normal).
