# Plan — Widget de Contigo (hábitos diarios)

> Objetivo: un widget de pantalla de inicio donde el usuario vea/marque los **3
> hábitos diarios** de Contigo (Evangelio, Oración, Revisión) y que el modo
> Carismochito (o una notificación) se lo recuerde.
> Fecha: 2026-06-21.

## 1. Viabilidad

- Los widgets son **código NATIVO** (iOS: WidgetKit/SwiftUI; Android: App Widget
  con RemoteViews). **NO es OTA** → requiere build de tienda y commit `[skip-ota]`.
- En Expo se hace con un **config plugin de targets nativos**:
  `@bacons/apple-targets` / `expo-apple-targets` (iOS) y, para Android, un módulo
  nativo o `react-native-android-widget`.
- La app ya tiene los datos: `hooks/useContigoHabits.ts` (records por día:
  `readingDone`, `prayerDone`, `revisionDone`), hoy en **AsyncStorage**.

## 2. Compartir datos app ↔ widget (clave)

El widget NO puede leer AsyncStorage. Hay que escribir el estado del día en un
**contenedor compartido**:

- iOS: **App Group** + `UserDefaults(suiteName:)` (o un JSON en el contenedor
  del grupo). La app escribe `{ date, reading, prayer, revision }`; el widget lo
  lee y pinta los 3 checks.
- Android: `SharedPreferences` compartidas / `DataStore` + el provider del widget.
- Acción: al marcar un hábito en la app, además de AsyncStorage, escribir en el
  almacenamiento compartido y pedir refresco del widget (`WidgetCenter.reloadAllTimelines()` en iOS).

## 3. Diseño del widget

- **Tamaño pequeño/mediano**: 3 círculos/iconos (📖 Evangelio · 🙏 Oración · ✦
  Revisión), marcados/no marcados, con la fecha y un progreso "2/3".
- **Tap** → deep-link a la sección correspondiente de Contigo
  (`/(tabs)/contigo/...`) vía URL scheme / universal link (expo-router ya maneja
  deep links).
- **Marcar desde el widget** (iOS 17+): con **App Intents** se puede togglear sin
  abrir la app (interactivo). Si no, el tap abre la pantalla y se marca allí.

## 4. Recordatorio (Carismochito / notificación)

- **Notificación local diaria** (p.ej. por la noche) si quedan hábitos sin marcar:
  "Te faltan 2 de 3 hoy ✦" → al tocar, abre Contigo. Usa `expo-notifications`
  (notificación local programada; no requiere el panel).
- Vincular con Carismochito: que la mascota "recuerde" dentro de la app si hay
  hábitos pendientes (overlay sutil), reutilizando el sistema del modo.

## 5. Pasos

1. Añadir el config plugin de targets (iOS primero) → build de desarrollo.
2. App Group + escribir estado del día en almacenamiento compartido al marcar.
3. Widget SwiftUI que lee y pinta los 3 hábitos + deep links.
4. (Opcional) App Intents para marcar desde el widget.
5. Notificación local diaria de recordatorio.
6. Android como segunda fase.

## 6. Avisos

- ⚠️ **Build de tienda** (nativo), no OTA. Planificar para una release.
- ⚠️ Mantener sincronizado el formato de datos compartidos con
  `useContigoHabits` para no divergir.
- Empezar por **iOS** (WidgetKit es más directo con Expo targets); Android después.
