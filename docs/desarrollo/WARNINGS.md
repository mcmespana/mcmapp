# Warnings del compilador de React — qué queda y por qué

> **Antes de "arreglar los warnings", lee esto.** Los 51 que quedan están
> clasificados abajo uno a uno. La mayoría son falsos positivos estructurales:
> perseguirlos empeora el código.
>
> Estado: **51 warnings, 0 errores**. Revisión completa: 2026-08-15 (se venía
> de 111). 860 tests en verde, `tsc` limpio.

## Contexto

El React Compiler está activado (`experiments.reactCompiler: true` en
`app.json`) y su plugin de ESLint (`react-hooks/*`) analiza el código con
reglas mucho más estrictas que las clásicas. **Son avisos, no bugs**: el
compilador te dice "aquí no puedo garantizar la memoización", no "esto está
roto". La app funciona.

La regla de la casa: **no se silencia nada con `eslint-disable`** salvo que ya
estuviera y esté justificado. O se arregla de verdad, o se documenta aquí por
qué se queda.

## Cómo contarlos

```bash
cd mcm-app
npm run lint 2>&1 | tail -3                       # total
npm run lint 2>&1 | grep -oE 'react-hooks/[a-z-]+|max-lines' | sort | uniq -c | sort -rn
```

---

## Reparto actual (51)

| Regla | Nº | Veredicto |
| ----- | -- | --------- |
| `react-hooks/immutability` | 19 | 12 falsos positivos de Reanimated · 7 a revisar caso a caso |
| `react-hooks/refs` | 18 | Patrón oficial "ref al último callback" — se quedan |
| `react-hooks/set-state-in-effect` | 6 | 2 de código congelado · 4 legítimos (sincronizar con algo externo) |
| `react-hooks/preserve-manual-memoization` | 2 | Informativos |
| `react-hooks/purity` | 3 | 1 de código congelado · 2 de `Date.now()` al construir un payload |
| `max-lines` | 3 | **Exentos por decisión** del usuario (2026-08-15) |
| `react-hooks/exhaustive-deps` | 2 | Deps ajustadas a mano a propósito, con `eslint-disable` y comentario |

---

## 1. `immutability` en Reanimated (12) — falso positivo, NO tocar

**Ficheros:** `components/ui/PressableScale.tsx`,
`components/calendar/SwipeableMonthCalendar.tsx`,
`components/evaluation/WizardButton.tsx`,
`components/contigo/BreathingPhase.tsx`, `app/onboarding.tsx`.

Todos hacen `sharedValue.value = withTiming(...)`. **Escribir `.value` ES la
API de Reanimated**: un shared value existe para mutarse fuera del ciclo de
render de React, que es justo lo que le permite animar en el hilo de UI. El
compilador ve una asignación a algo que considera inmutable y avisa.

Arreglarlo significaría dejar de usar Reanimated. No hay nada que hacer aquí
hasta que Reanimated y el compilador se pongan de acuerdo aguas arriba.

## 2. `refs` — el patrón del "ref al último callback" (18) — se quedan

**Ficheros:** `components/BottomSheet.tsx`, `components/SongDisplay.tsx`,
`components/contigo/ReaderSettingsSheet.tsx`,
`components/contigo/HighlightableReading.tsx`,
`components/playlist/ChoirSheet.tsx`, `components/tabs/tabBarController.ts`,
`app/(tabs)/mas.tsx`, `app/(tabs)/visitapapa.tsx`, y alguno más.

El patrón es siempre el mismo:

```tsx
const onCloseRef = useRef(onClose);
onCloseRef.current = onClose;   // ← el warning apunta aquí
```

Sirve para que algo creado **una sola vez** (un `PanResponder`, un handler de
WebView, un callback de animación) llame siempre a la versión más reciente de
la prop sin tener que recrearse. Es el patrón que la propia documentación de
React recomienda mientras `useEffectEvent` no sea estable, y sin él estos
componentes se quedarían con el callback del primer render — que es un bug de
verdad, no un aviso.

**Cuando `useEffectEvent` salga de experimental, esta categoría entera se
puede migrar de golpe.** Es la única acción pendiente real, y no depende de
nosotros.

## 3. `max-lines` (3) — exentos por decisión

`app/onboarding.tsx` (1.756), `app/(tabs)/index.tsx` (1.196) y
`app/screens/SelectedSongsScreen.tsx` (~1.790).

El usuario decidió el 2026-08-15 que **los gigantes se quedan gigantes**: quien
edita este código es siempre una IA, que lee el archivo entero de una vez, y
para ella la misma lógica repartida en seis ficheros cuesta más, no menos.
Razonamiento completo en `docs/planes/PLAN_CALIDAD.md` §0 y `BACKLOG.md` §2.A.

El techo de 1.000 líneas del ESLint se mantiene **como aviso para código
nuevo**, no como deuda a saldar.

## 4. Código congelado (3) — no se toca por definición

`app/screens/WordleScreen.tsx` (2 × `set-state-in-effect`, 1 × `purity`).
El Wordle está congelado a propósito como código de referencia (ver
`mcm-app/CLAUDE.md`): no se refactoriza, no se le añade nada.

## 5. `purity` en `ReflexionesScreen` (2) — mirar si se toca el fichero

`Date.now()` / `localISO(fecha)` al construir el payload que se sube a
Firebase. No es impuro en el sentido que importa (el valor no se pinta, se
manda), pero si algún día se toca esa pantalla, moverlo al `onPress` en vez de
al cuerpo del componente lo arregla gratis. No merece un cambio dedicado.

## 6. El resto (7 `immutability` sueltos + 2 `preserve-manual-memoization`)

`components/tabs/useTabScroll.ts`, `components/tabs/tabBarController.ts`,
`components/NotificationsBottomSheet.tsx`, `app/notifications.tsx`,
`app/screens/SelectedSongsScreen.tsx`.

Son los únicos que podrían esconder algo real. Ninguno ha dado problema
observable y todos están en código con tests. **Si tocas uno de esos ficheros
por otro motivo, míralo de paso**; no merecen una sesión dedicada.

---

## Lo que sí se pide

**No añadas warnings nuevos.** Si tras tu cambio `npm run lint` pasa de 51,
el nuevo es tuyo y se arregla antes de commitear. Ese es el único guardarraíl
que se mantiene activo.

## Historial

- **2026-08-15** — 111 → 51. Arreglado de verdad, sin silenciar:
  `useRef(new Animated.Value(x)).current` → `useAnimatedValue(x)` (9 sitios en
  `BottomSheet`, `OTAUpdatePrompt`, `CarismochitoDialogs`); los dos
  `PanResponder` de `BottomSheet` a un solo `useMemo`; `ReadingCalendarSheet`
  al patrón oficial de ajuste de estado; `exhaustive-deps` reales en
  `QrScannerModal`, `evangelio` y `SelectedSongsScreen`; imports muertos; y los
  dos efectos de auto-import de `SelectedSongsScreen` movidos detrás de las
  dependencias que leían (accedían en zona muerta).
