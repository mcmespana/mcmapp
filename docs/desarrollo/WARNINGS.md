# Warnings del compilador de React — qué queda y por qué

> **Antes de "arreglar los warnings", lee esto.** Los que quedan están
> clasificados abajo uno a uno. La mayoría son falsos positivos estructurales:
> perseguirlos empeora el código.
>
> Estado: **36 warnings, 0 errores** (2026-10-31, `npm run lint`). Es el
> **techo**: es lo que hay y no debe subir. Historial: 111 (2026-08-15) → 51 →
> 39 (2026-08-19, la migración de `.value` a `.get()`/`.set()` en los shared
> values de Reanimated se llevó los falsos positivos) → 38.

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
# Reparto por regla (el grep sobre la salida de texto cuenta también las pistas
# de cada mensaje; es más fiable el JSON, limitado a lo que lintea `expo lint`):
npx eslint app components -f json | node -e "const c={};JSON.parse(require('fs').readFileSync(0)).forEach(f=>f.messages.forEach(m=>c[m.ruleId]=(c[m.ruleId]||0)+1));console.log(c)"
```

> `expo lint` **solo recorre `app/` y `components/`**. `hooks/`, `contexts/` y
> el resto no entran en la cuenta (hoy tienen ~18 avisos más del mismo patrón
> "ref al último callback"). No cambia nada de lo que sigue, pero que no te
> sorprenda si lanzas `eslint` a pelo y sale otra cifra.

---

## Reparto actual (36)

| Regla                                     | Nº  | Veredicto                                                         |
| ----------------------------------------- | --- | ----------------------------------------------------------------- |
| `react-hooks/refs`                        | 16  | Patrón oficial "ref al último callback" — se quedan               |
| `react-hooks/set-state-in-effect`         | 7   | 2 de código congelado · 5 a mirar si se toca el fichero           |
| `react-hooks/immutability`                | 5   | "Variable antes de declararla" y escrituras en refs — caso a caso |
| `react-hooks/purity`                      | 3   | 1 de código congelado · 2 de `Date.now()` al construir un payload |
| `max-lines`                               | 3   | **Exentos por decisión** del usuario (2026-08-15)                 |
| `react-hooks/preserve-manual-memoization` | 2   | Informativos                                                      |

---

## 1. `immutability` (5) — ya no quedan los de Reanimated

Antes eran 12 falsos positivos de Reanimated (`sharedValue.value = withTiming(...)`).
La migración a `.get()`/`.set()` los eliminó. Quedan cinco:
`components/contigo/BreathingPhase.tsx`, `components/tabs/useTabScroll.ts` (2),
`components/NotificationsBottomSheet.tsx` y `app/screens/SelectedSongsScreen.tsx`
("usada antes de declararse" y escrituras sobre refs). Ninguno ha dado problema
observable y todos están en código con tests. **Si tocas uno de esos ficheros
por otro motivo, míralo de paso**; no merecen una sesión dedicada.

## 2. `refs` — el patrón del "ref al último callback" (16) — se quedan

**Ficheros:** `components/BottomSheet.tsx`, `components/SongDisplay.tsx`,
`components/contigo/ReaderSettingsSheet.tsx`,
`components/contigo/HighlightableReading.tsx`,
`components/playlist/ChoirSheet.tsx`, `components/playlist/QrScannerModal.tsx`,
`components/tabs/tabBarController.ts`. (`mas.tsx` y `visitapapa.tsx`
dejaron de existir al pasar a carpetas de rutas, 2026-10-31.)

El patrón es siempre el mismo:

```tsx
const onCloseRef = useRef(onClose);
onCloseRef.current = onClose; // ← el warning apunta aquí
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

`app/onboarding.tsx`, `app/(tabs)/index.tsx` y
`app/screens/SelectedSongsScreen.tsx` (los tres por encima de 1.000 líneas).

El usuario decidió el 2026-08-15 que **los gigantes se quedan gigantes**: quien
edita este código es siempre una IA, que lee el archivo entero de una vez, y
para ella la misma lógica repartida en seis ficheros cuesta más, no menos.
Razonamiento completo en `docs/planes/PLAN_CALIDAD.md` §0 y `BACKLOG.md` §2.A.

El techo de 1.000 líneas del ESLint se mantiene **como aviso para código
nuevo**, no como deuda a saldar.

Dos más del área nativa, apagados en su primera línea con
`eslint-disable max-lines` y el motivo (28/10/2026, plan 07):
`services/comunica/contract.ts` (el contrato es UN sitio: partirlo crea
importaciones circulares con `ROUTES`) y `services/comunica/fake/index.ts` (el
corazón del falso; lo de cada plan grande ya vive aparte, `coordination.ts`,
`events.ts`). Un fichero nuevo que pase de 1.000 **no** se apaga así sin
apuntarlo aquí.

## 4. Código congelado (3) — no se toca por definición

`app/screens/WordleScreen.tsx` (2 × `set-state-in-effect`, 1 × `purity`).
El Wordle está congelado a propósito como código de referencia (ver
`mcm-app/CLAUDE.md`): no se refactoriza, no se le añade nada.

## 5. `purity` en `ReflexionesScreen` (2) — mirar si se toca el fichero

`Date.now()` / `localISO(fecha)` al construir el payload que se sube a
Firebase. No es impuro en el sentido que importa (el valor no se pinta, se
manda), pero si algún día se toca esa pantalla, moverlo al `onPress` en vez de
al cuerpo del componente lo arregla gratis. No merece un cambio dedicado.

## 6. `set-state-in-effect` sueltos (5) y `preserve-manual-memoization` (2)

`components/AddToHomeBanner.tsx`, `components/BottomSheet.tsx`,
`components/playlist/ChoirSheet.tsx`, `app/notifications.tsx`,
`app/screens/SelectedSongsScreen.tsx` (y la memoización de `notifications.tsx` y
`NotificationsBottomSheet.tsx`). Son efectos que sincronizan con algo externo
(abrir/cerrar una hoja, leer `localStorage`); funcionan. **Si tocas uno de esos
ficheros por otro motivo, míralo de paso.**

---

## Lo que sí se pide

**No añadas warnings nuevos.** Si tras tu cambio `npm run lint` pasa de 36,
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
