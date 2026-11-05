# AFINADOR.md — Afinador de guitarra del cantoral

> Noviembre de 2026. Solo guitarra, solo afinación estándar (Mi La Re Sol Si
> Mi, La 440). A propósito: tiene que afinar y ya. **Requiere build nativa**
> (`react-native-audio-api`): no sale por OTA.

## Dónde está

| Entrada                                                      | Qué hace                                                                                      |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Menú de la canción (botón flotante) → **Afinar la guitarra** | La entrada principal: es donde está el guitarrista cuando lo necesita                         |
| Cantoral → **⋯** → **Afinador**                              | Para afinar sin abrir una canción. Funciona también sin conexión y sin el cantoral descargado |

Se abre como **hoja** (`presentation: 'formSheet'`, ruta
`/cancionero/afinador`) encima de lo que hubiera: se afina, se cierra y se
sigue con los acordes. En iOS se baja con el dedo o con la X; en web es una
pantalla normal con su flecha de volver.

## Cómo se usa

- Se toca una cuerda: el afinador **reconoce cuál es** y la enciende en la
  fila de cuerdas. La nota sale gigante en el centro del arco.
- La bola recorre el arco de −50 a +50 cents. Naranja con flecha: «Tensa la
  cuerda» (está baja) o «Afloja la cuerda» (está alta).
- Dentro de ±5 cents y aguantando ~⅓ s, se **bloquea**: verde, «Afinada»,
  vibración, y la cuerda queda marcada con un check hasta cerrar el afinador.
  Con las seis, confeti.
- Tocar una cuerda de la fila la **fija**: mide contra ella aunque esté muy
  destemplada (p. ej. una cuerda nueva, que viene casi un tono baja). Tocarla
  otra vez vuelve a automático.
- La pantalla no se apaga mientras está abierto (`useKeepAwakeWhileFocused`).
- La nota sale en la notación del cantoral (Do Re Mi o C D E).

## Cómo funciona

```
micrófono ──► FrameAnalyzer (pitchy) ──► PitchTracker ──► pantalla
services/tuner/   utils/tuner/detectPitch   utils/tuner/pitchTracker   app/screens/TunerScreen
                        hooks/useTuner.ts (ritmo, permisos, ciclo de vida)
```

| Pieza                               | Qué hace                                                                                                                                                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services/tuner/microphone.ts`      | iOS/Android: `AudioRecorder` de `react-native-audio-api` entregando PCM en float, sin fichero. Sesión de iOS en modo `measurement` (sin el procesado de voz del sistema) y `allowHaptics` (iOS apaga la vibración mientras graba) |
| `services/tuner/microphone.web.ts`  | Web: `getUserMedia` (sin cancelación de eco, supresión de ruido ni control de ganancia) + `AnalyserNode` leído en cada fotograma                                                                                                  |
| `utils/tuner/detectPitch.ts`        | Ventana deslizante de 4096 muestras y `pitchy` (método de McLeod, MIT). Da frecuencia, claridad 0–1 y volumen                                                                                                                     |
| `utils/tuner/pitchTracker.ts`       | Lo que hace que se sienta bueno: puerta de volumen/claridad, corrección de saltos de octava, mediana, media exponencial, histéresis de cuerda y de «afinada». Puro y con el reloj inyectado                                       |
| `utils/tuner/notes.ts`              | MIDI fraccionario ↔ Hz, nombres de nota, afinación estándar                                                                                                                                                                       |
| `hooks/useTuner.ts`                 | Abre el micrófono con foco y en primer plano, lo suelta al salir o ir a segundo plano, analiza ~22 veces por segundo y solo repinta cuando la lectura cambia                                                                      |
| `components/tuner/TunerGauge.tsx`   | El arco. Todo lo que se mueve va en el hilo de UI con un muelle                                                                                                                                                                   |
| `components/tuner/TunerStrings.tsx` | La fila de cuerdas                                                                                                                                                                                                                |

Colores: `TunerColors` / `tunerColors(isDark)` en `constants/colors.ts`
(verde y naranja de sistema de Apple, en su versión legible como texto en
claro). Tamaño de la nota: `typography.display` (88).

### Dos trampas que ya mordieron (y su test)

1. **En web el analizador da fotos, no trozos.** Cada lectura del
   `AnalyserNode` es lo último que ha sonado y se solapa con la anterior. Si
   se piden fotos más cortas que la ventana y se encadenan, la ventana queda
   hecha de pedazos repetidos y el tono sale mal (el La 110 se leía a +21
   cents). En web se pide siempre la ventana completa.
   → `__tests__/tunerMicrophoneWeb.test.ts`.
2. **En web, Reanimated no anima colores de un SVG** (`fill`/`stroke` se
   quedan en el primero). El arco pinta capas de color fijo y reparte la
   opacidad entre ellas.

## Permisos

- iOS: `NSMicrophoneUsageDescription` lo ponen el plugin de
  `react-native-audio-api` y el de `expo-image-picker` (que antes lo tenía a
  `false` y **bloqueaba** `RECORD_AUDIO` en Android: ahora lleva el mismo
  texto).
- Android: `RECORD_AUDIO`.
- **Sin** modo de audio en segundo plano ni servicio en primer plano
  (`iosBackgroundMode: false`, `androidForegroundService: false`) y sin FFmpeg
  (`enableFFmpeg: false`): el afinador solo escucha con la hoja delante.
- El audio se analiza en el móvil; no se guarda ni se envía. Las fichas de
  privacidad de las tiendas no cambian (no hay datos recogidos).
- El permiso se pide **al pulsar** «Usar el micrófono», con el porqué delante,
  no nada más entrar.

## Tests

`tunerPitchTracker` (suavizado, octavas, histéresis, cuerda fijada, cambio de
cuerda), `tunerDetectPitch` (las seis cuerdas con armónicos, cuerda que se
apaga), `tunerMicrophoneWeb` (guardarraíl de la trampa 1) y `useTuner`
(permisos, abrir/soltar el micrófono, audio → lectura → cuerda afinada).

## Lo que no hace (a propósito)

Otras afinaciones (Drop D, medio tono abajo…), cambiar el La 440, ukelele o
bajo, metrónomo. Si algún día se quiere, `PitchTracker` ya acepta otra
`tuning`.

## Pendiente de verificar en dispositivo

Los parámetros del tracker (`TRACKER_DEFAULTS`) están probados con señales
sintéticas y en web; falta ajustarlos con una guitarra de verdad en iOS y
Android (puerta de volumen en una sala con ruido, tiempo de «aguanta»).
