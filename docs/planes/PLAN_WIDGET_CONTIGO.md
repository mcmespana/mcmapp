# Plan — Widgets de Contigo (pantalla de inicio)

> Objetivo: **tres widgets** de pantalla de inicio que saquen Contigo fuera de
> la app — los 3 hábitos diarios, la racha, y el evangelio del día.
> Fecha: 2026-06-21. Ampliado el 2026-09-19 con los widgets 2 y 3
> (decisión del usuario: los tres, no solo el de hábitos).

## 1. Viabilidad

- Los widgets son **código NATIVO** (iOS: WidgetKit/SwiftUI; Android: App Widget
  con RemoteViews). **NO es OTA** → requiere build de tienda y commit `[skip-ota]`.
- En Expo se hace con un **config plugin de targets nativos**:
  `@bacons/apple-targets` / `expo-apple-targets` (iOS) y, para Android, un módulo
  nativo o `react-native-android-widget`.
- La app ya tiene todos los datos que piden los tres:
  - hábitos y racha → `contexts/ContigoHabitsContext.tsx` (`records` por día y
    `getStreak('reading' | 'prayer' | 'revision')`), hoy en AsyncStorage +
    `users/{uid}/contigo/habits` cuando hay sesión;
  - evangelio del día → `hooks/useDailyReadings.ts`, alimentado por el scraper
    de `scraper-lecturas/` vía GitHub Action.
- **Los tres widgets comparten toda la fontanería** (target nativo, App Group,
  deep links). El primero cuesta casi todo; el segundo y el tercero, una
  fracción. Por eso se hacen juntos y no en tres releases.

## 2. Compartir datos app ↔ widget (clave)

El widget NO puede leer AsyncStorage **ni hablar con Firebase**: no ejecuta JS.
Todo lo que pinte tiene que haberlo dejado escrito la app en un **contenedor
compartido**:

- iOS: **App Group** + `UserDefaults(suiteName:)` (o un JSON en el contenedor
  del grupo).
- Android: `SharedPreferences` compartidas / `DataStore` + el provider del widget.
- Un solo *payload* para los tres widgets, escrito en cada cambio relevante:

```jsonc
{
  "date": "2026-09-19",
  "reading": true,        // hábitos
  "prayer": false,
  "revision": false,
  "streak": 12,           // racha (la de oración, ver §3.2)
  "gospelRef": "Lc 15, 1-10",   // evangelio del día
  "gospelTitle": "La oveja perdida",
  "gospelHook": "¿Quién de vosotros que tiene cien ovejas…"
}
```

- Al marcar un hábito, y al refrescar las lecturas del día, escribir aquí
  **además** de en AsyncStorage, y pedir refresco
  (`WidgetCenter.reloadAllTimelines()` en iOS).
- ⚠️ **El widget se queda viejo si nadie abre la app.** El evangelio cambia a
  medianoche pero el payload solo se actualiza cuando la app corre. Mitigación:
  escribir de una tacada los próximos 2-3 días de lecturas (el scraper ya los
  publica) y que la *timeline* de WidgetKit vaya pasando de uno a otro sola. Si
  se agota, pintar la fecha del dato en vez de mentir.

## 3. Los tres widgets

### 3.1 — Los 3 hábitos (el original)

- **Tamaño pequeño/mediano**: 3 círculos/iconos (📖 Evangelio · 🙏 Oración · ✦
  Revisión), marcados/no marcados, con la fecha y un progreso "2/3".
- **Tap** → deep-link a la sección correspondiente de Contigo
  (`/(tabs)/contigo/...`) vía URL scheme / universal link (expo-router ya maneja
  deep links).
- **Marcar desde el widget** (iOS 17+): con **App Intents** se puede togglear sin
  abrir la app (interactivo). Si no, el tap abre la pantalla y se marca allí.

### 3.2 — La racha

Un número grande y **un estado visual que cambia según cuánto llevas**. Es el
widget "de premio": lo que engancha es ver subir el contador y que la cosa
cambie de aspecto al cruzar un tramo.

| Racha       | Qué se ve                                                        |
| ----------- | ---------------------------------------------------------------- |
| 0 días      | Apagado, en gris, invitando: "Empieza hoy"                       |
| 1-2 días    | Una chispa, color tenue                                          |
| 3-6 días    | Llama pequeña, color de marca                                    |
| 7-29 días   | Llama grande + sello de semana; el número manda en la tarjeta    |
| 30+ días    | Tratamiento especial (fondo propio, la llama ocupa toda la tarjeta) |

- **Qué racha**: la de **oración** (`getStreak('prayer')`), que es la que ya
  preside la pantalla de Contigo (`HeroCard` + `StatCard` 🔥). Una sola, no tres:
  tres contadores en una tarjeta de 150 px no se leen.
- **Tap** → `/(tabs)/contigo`.
- ⚠️ **Sobre las animaciones, la verdad incómoda**: un widget **no anima en
  bucle**. WidgetKit redibuja solo cuando la *timeline* avanza, y ahí sí hay
  transición entre estados (iOS 17+, `.contentTransition`); Android con
  RemoteViews prácticamente no tiene nada. Así que "diferentes animaciones según
  la racha" se entrega como: **estados visuales distintos por tramo** en el
  widget + **la animación de verdad dentro de la app**, al abrirla desde él
  (subida del contador, celebración al cruzar 7 y 30). Es donde además se ve
  mejor.

### 3.3 — El evangelio del día

El más simple y probablemente el que más se queda puesto.

- **Una línea que diga qué toca hoy**: "Hoy, Lucas 15, 1-10" + el título del día
  (`readings.info.titulo`) y, si cabe, la primera línea del evangelio.
- **Un icono bonito** (el libro abierto de Contigo, en el dorado/azul de la
  sección) y la fecha pequeña.
- **Tap** → directo a `/(tabs)/contigo/evangelio`, sin pasar por la home.
- Tamaño pequeño (cita + icono) y mediano (cita + título + primera línea).
- Datos ya resueltos: `readings.evangelio.cita`, `readings.info.titulo`,
  `readings.evangelio.texto`.

## 4. Recordatorio (Carismochito / notificación)

- **Notificación local diaria** (p.ej. por la noche) si quedan hábitos sin marcar:
  "Te faltan 2 de 3 hoy ✦" → al tocar, abre Contigo. Usa `expo-notifications`
  (notificación local programada; no requiere el panel).
- Vincular con Carismochito: que la mascota "recuerde" dentro de la app si hay
  hábitos pendientes (overlay sutil), reutilizando el sistema del modo.

## 5. Pasos

1. Añadir el config plugin de targets (iOS primero) → build de desarrollo.
2. App Group + escribir el payload de §2 al marcar un hábito y al refrescar
   lecturas.
3. Widget 3.1 (hábitos) en SwiftUI + deep links. Es el que valida la fontanería.
4. Widgets 3.2 (racha) y 3.3 (evangelio) sobre el mismo target y el mismo payload.
5. (Opcional) App Intents para marcar desde el widget.
6. Notificación local diaria de recordatorio.
7. Android como segunda fase (y con expectativas recortadas en 3.2: sin
   transiciones).

## 6. Avisos

- ⚠️ **Build de tienda** (nativo), no OTA. Planificar para una release.
- ⚠️ Mantener sincronizado el formato de datos compartidos con
  `useContigoHabits` para no divergir.
- Empezar por **iOS** (WidgetKit es más directo con Expo targets); Android después.
- **Atajo para probar el apetito sin gastar una build**: cualquiera de los tres
  funciona antes como tarjeta en la Home de la app, por OTA. Si la racha no
  engancha en la Home, no va a enganchar en la pantalla de bloqueo.
