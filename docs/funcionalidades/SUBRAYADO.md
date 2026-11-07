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

## Seleccionar primero, tocar el lápiz después

El botón de subrayar de la cabecera **usa la selección que ya hubiera hecha**.
Para eso `HighlightableReading` reporta `onSelectionChange` SIEMPRE que el texto
sea un `TextInput` (en iOS, leyendo y subrayando), no solo dentro del modo lápiz:
si solo escuchara dentro del modo, la selección que había era invisible para JS y
la barra salía pidiendo "selecciona un texto" hasta que movías las asas un pelo.

La selección es "pegajosa" (`useReadingHighlights`): se conserva la última no
vacía. Hace falta por dos motivos —iOS colapsa la selección nativa antes de que
llegue el `onPress` del chip de color, y el propio toque en el botón del lápiz
puede deshacerla—. Quien la limpia de verdad es `exitHighlightMode` (al salir del
modo, al cambiar de día o al elegir otra fecha).

**En Android este camino no existe**: leyendo, el texto es un `Text selectable`
y un `Text` no reporta offsets. El atajo bueno en Android es el ítem "Subrayar"
del propio menú de selección.

## "Subrayar" en el menú nativo del sistema

> Implementado el 2026-08-03 (build de tienda de agosto). **Requiere binario
> nuevo**: no sale por OTA.
>
> ⚠️ **Nunca ha llegado a un binario todavía.** El código estaba, pero
> `.easignore` —que cuando existe SUSTITUYE a `.gitignore` para decidir qué sube
> a EAS— conservaba las reglas `ios/` y `android/` sin barra inicial, que casan a
> cualquier profundidad y se llevaban por delante
> `modules/highlight-menu/{ios,android}`. El módulo subía con su
> `expo-module.config.json` y su JS pero sin Swift, sin Kotlin, sin podspec ni
> `build.gradle`: autolinking lo saltaba en silencio y la app se construía sin el
> ítem. Arreglado el 2026-08-08; la comprobación de que no vuelve está en
> `docs/desarrollo/BUILD_AGOSTO_2026.md` §3.
>
> Mientras el binario no lo lleve, `HighlightMenuView` detecta que el módulo no
> está (`requireOptionalNativeModule`) y renderiza un `View` pelado. Antes
> montaba la vista nativa inexistente, que React Native sustituye por su
> placeholder de "componente sin implementar" — y como esta vista ENVUELVE el
> texto de la lectura, eso se llevaba por delante el render del texto.

Al seleccionar texto en cualquier lectura, el menú del sistema trae un ítem
**"Subrayar"** junto a Copiar / Traducir / Buscar / Herramientas de escritura.
**No hay que entrar antes en el modo lápiz.**

Tocarlo **subraya en el acto**, sin preguntar color: usa el "color de turno"
(`utils/stickyHighlightColor.ts`), uno al azar que se mantiene unos 8 minutos —
así varias frases seguidas salen del mismo color y de un día para otro cambia
solo. La barra de colores aparece igualmente, con el color puesto marcado, así
que cambiarlo o quitarlo sigue siendo un toque; simplemente ya no es obligatorio.
Por dentro es `applyColor(color, { source, sel })`: el segundo argumento existe
para poder pintar en el mismo gesto en que llega la selección, sin esperar a que
el estado se actualice.

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

> ⚠️ **Poner ese delegate hay que hacerlo a la brava** (arreglado el
> 2026-08-09). `RCTUITextView` sobreescribe `setDelegate:` con un
> `if (super.delegate) { return; }` y el comentario "it cannot be changed from
> outside": como el adaptador de RN se pone en el `init`, la asignación normal
> **se ignora en silencio** y el proxy no llegaba a instalarse nunca — por eso
> el ítem no salía ni con el módulo dentro del binario. `forceSetDelegate` llama
> a la implementación de `UITextView` (lo que haría un `super.delegate = …`).
> El enganche se reintenta además en `didAddSubview`, porque el texto se monta
> como hijo después de que la vista contenedora tenga su frame.

**Offsets**: el `NSRange` de iOS y el `selectionStart/End` de Android van en
unidades UTF-16, que es exactamente cómo indexa JavaScript las cadenas. Los
offsets casan con el texto canónico sin convertir nada.

**Reenganche**: las dos plataformas reintentan el enganche en cada layout, y no
solo la primera vez. React Native se reasigna el delegate (iOS) / el
`customSelectionActionModeCallback` (Android) al recrear o reconfigurar el
texto, así que con un enganche único el ítem desaparecía en cuanto el texto se
volvía a montar —cambio de día, de tamaño de letra, de modo— y no volvía hasta
reiniciar. `attachIfNeeded` compara con lo que hay puesto y nunca encadena dos
proxies nuestros.

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
- El texto se renderiza SIN altura impuesta a mano: con `scrollEnabled={false}`
  la mide React Native. Antes se fijaba con `onContentSizeChange` y eso se
  retroalimentaba (la lectura crecía sola) y dejaba la altura del día anterior
  al cambiar de fecha.
- La selección es "pegajosa": se conserva la última selección no vacía porque
  iOS puede colapsar la selección nativa antes de que llegue el `onPress` del
  chip de color.
- Entrar en modo subrayar NO abre las tarjetas de lecturas: las que estuvieran
  cerradas se quedan cerradas (antes se desplegaban todas de golpe).
