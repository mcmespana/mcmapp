# Animaciones — auditoría contra la skill `animate-expo`

> Fecha: 2026-08-19 · Skill: [`emilkowalski/skills` → `animate-expo`](https://github.com/emilkowalski/skills)
> (instalada en el proyecto, entrada en `mcm-app/skills-lock.json`).

La skill es de **construcción**, no de review: fija el orden de decisiones
(¿debe animarse? → propósito → herramienta → propiedades → curva → hilo →
press → háptica → movimiento reducido) y una tabla de "nunca envíes esto".
Este documento es el resultado de pasarla por encima del código actual.

## Resumen

Lo que la app ya hace bien (y no hay que tocar):

- **Tabs nativas** (`expo-native-compact-tabs`), sin slide entre pestañas — que
  es justo lo que la skill prohíbe explícitamente.
- **Reanimated 4 + worklets + gesture-handler** ya instalados y con
  `GestureHandlerRootView` envolviendo la app en `app/_layout.tsx`.
- **Ningún `setState` dentro de un `onUpdate`** de gesto ni de scroll. Este es
  el fallo nº1 de rendimiento en RN y aquí no aparece ni una vez.
- **Ninguna animación de `height`/`width`/`margin`/`flex`**, ni de `elevation`,
  ni de `intensity` de `BlurView`. Todo va por `transform` + `opacity`.
- **Ninguna háptica por frame**: las 8 pantallas que usan `expo-haptics` la
  disparan en el commit, no en el arrastre.
- Tokens centralizados en `mcm-app/constants/animations.ts` en vez de números
  mágicos repartidos.

Falsos positivos revisados y descartados:

- Los tres `Easing.in(...)` (`CarismochitoOverlay` ×2, `CarismochitoMascot`) son
  **salidas** que se van de pantalla y un tramo de un bucle de balanceo. La
  regla "nunca ease-in" es para entradas y movimientos dentro de pantalla.

## Hecho en esta pasada

1. `constants/animations.ts` — añadidas las curvas canónicas de la skill
   (`motionEasings.out/inOut/sheet`) y los muelles en forma de dos parámetros
   de Apple (`springs.settle/snap/sheet`, con `duration` + `dampingRatio`, no
   mass/stiffness/damping). Se añaden AL LADO de `reaEasings`, sin tocar el
   feel de lo ya afinado.
2. `components/ui/PressableScale.tsx` — respeta "reducir movimiento" del
   sistema (`useReducedMotion`), usa la curva `out` de la skill y pasa a
   `.get()`/`.set()` (la forma que el React Compiler sí entiende).
3. `components/ui/CelebrationBurst.tsx` — con movimiento reducido deja solo el
   emoji apareciendo y yéndose, sin las 12 partículas volando; y el emoji ya no
   arranca en `scale(0)` sino en `0.9` (nada en el mundo real aparece de la nada).

## Pendiente, por orden de valor

1. **Movimiento reducido en el resto de la app.** Era **cero** antes de esta
   pasada: ni un `useReducedMotion` ni un `ReduceMotion.System` en todo el
   código. Es la regla dura nº4 de la skill y además accesibilidad real.
   Siguientes candidatos: `CarismochitoOverlay` (confeti + mascota + shake),
   `contexts/AppToastContext.tsx`, `components/contigo/BreathingPhase.tsx`,
   `components/evaluation/SuccessPhase.tsx`.
2. **`components/BottomSheet.tsx` → Reanimated.** Es el caso más gordo: usa
   `PanResponder` + core `Animated` + `useNativeDriver`, o sea las tres
   primeras filas del "Never Ship" a la vez. Un `PanResponder` cruza el puente
   en cada frame del arrastre. La reescritura es `Gesture.Pan()` + shared value
   - `withSpring({ duration: 300, dampingRatio: 0.8, velocity })`, y de paso
     entra el umbral por **velocidad o distancia** (hoy un flick corto no cierra)
     y la resistencia elástica en el borde. Cambio grande: merece su propio PR.
3. **`components/contigo/ReaderSettingsSheet.tsx`** — el `PanResponder` del
   slider de tamaño de letra. Más pequeño que el anterior; `Gesture.Pan()` +
   `Haptics.selectionAsync()` en cada detente sería la versión correcta.
4. **`runOnJS` → `scheduleOnRN`** (`react-native-worklets`). Deprecado en
   Reanimated 4; aparece en ~12 ficheros. Migración mecánica y de bajo riesgo,
   pero conviene hacerla de una vez y no a trozos.
5. **`.value` → `.get()`/`.set()`** — ~254 usos. Misma API, pero el acceso
   directo a `.value` es la forma que el React Compiler no puede seguir.
   Mecánico también; candidato a un commit propio, sin mezclar con nada.
6. **Core `Animated` de react-native** en 8 ficheros (`WordleScreen`,
   `notifications`, `PlaylistRow`, `OTAUpdatePrompt`, `SongListItem`,
   `NotificationListItem`, `CarismochitoDialogs`, `BottomSheet`). Los que no
   tocan un dedo funcionan; los que sí (BottomSheet) son el punto 2.
7. **120fps en iPhones ProMotion** — `CADisableMinimumFrameDurationOnPhone` no
   está en `app.config.ts`. Los SDK recientes de Expo lo ponen por defecto, así
   que hay que **confirmarlo en el `Info.plist` generado** antes de añadirlo a
   mano; si se añade, es cambio nativo → `[skip-ota]` y build nueva.

## Cómo se valida

Nada de esto se juzga en Expo Go ni en el simulador: build de release, en el
Android más lento que soportemos, y probando el gesto de verdad — lanzarlo con
un flick, interrumpirlo a mitad, invertirlo.
