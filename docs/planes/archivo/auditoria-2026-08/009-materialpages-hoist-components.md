# Plan 009: Sacar del render los dos componentes definidos dentro de `MaterialPagesScreen`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 40c6566..HEAD -- mcm-app/app/screens/MaterialPagesScreen.tsx`
> On a mismatch with the "Current state" excerpts, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW — extracción mecánica; el único cuidado son las variables
  capturadas del closure (`styles`, `fecha`, `width`, `height`, `fontScale`)
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `40c6566`, 2026-08-05

## Why this matters

`MaterialPagesScreen` (el pager de materiales de evento) define DOS
componentes dentro del cuerpo del componente padre: `IntroPageItem` y
`ContentPageItem`. Cada render del padre crea un TIPO de componente nuevo, así
que React desmonta y remonta cada página visible en vez de actualizarla: el
`ScrollView` de cada página pierde su posición de scroll, `FormattedContent`
(el renderizador BBCode→HTML) se reconstruye de cero, y los círculos
decorativos se re-aleatorizan (su `useMemo` interno muere con cada remontaje).
Es exactamente la clase de bug que ya se coló una vez en el repo (el
`ActionButton` remontándose en cada render, anotado en `mcm-app/TODO.md`
§Mantenimiento), y el React Compiler NO puede arreglarla: es identidad
estructural, no memoización.

## Current state

- `mcm-app/app/screens/MaterialPagesScreen.tsx` (~250 líneas) — pantalla
  pager (`FlatList` horizontal) de páginas de material.

Las definiciones inline (l.70-112 y l.114+; nótese qué capturan del closure —
`styles` con memo en l.65-68, `fecha`, `width`, `height`, `fontScale`):

```tsx
const styles = React.useMemo(
  () => createStyles(scheme, introBackgroundColor, fontScale),
  [scheme, introBackgroundColor, fontScale],
);

const IntroPageItem = ({ actividad }: { actividad: Actividad }) => {
  const circlesData = React.useMemo(() => generateRandomCircles(5), []);
  return (
    <View style={[styles.introPage, { width }]}>
      {/* …círculos decorativos + emoji + nombre + fecha formateada desde `fecha` … */}
    </View>
  );
};

const ContentPageItem = ({ item }: { item: Pagina }) => {
  const content = item.texto ? (
    <FormattedContent text={item.texto} scale={fontScale} />
  ) : null;
  if (Platform.OS === 'web') {
    /* …alturas aproximadas calculadas con `height`… */
```

- Consumo: `renderItem` (~l.184-189) del `FlatList` pager (~l.243-253) con
  `getItemLayout`.
- Convención del repo para extracciones: subcomponentes a
  `components/<área>/` (patrón de `components/evaluation/`,
  `components/preview-channel/` — extraídos de pantallas en 2026-06-28,
  ver `docs/planes/PLAN_CALIDAD.md` Fase 1.9). Aquí el área natural es una
  carpeta nueva `components/materiales/` o módulo-level en el mismo archivo:
  **elegir módulo-level en el mismo archivo** (la pantalla no es un gigante
  de PLAN_CALIDAD y crear carpeta para dos piezas es sobre-estructura; si el
  archivo superara 400 líneas con el cambio — no debería, es mover — entonces
  sí extraer a `components/materiales/`).

## Commands you will need

| Purpose   | Command (desde `mcm-app/`)   | Expected on success |
|-----------|------------------------------|---------------------|
| Install   | `npm ci`                     | exit 0              |
| Typecheck | `npm run typecheck`          | exit 0              |
| Tests     | `npm test`                   | all pass            |
| Lint      | `npm run lint`               | exit 0              |
| Smoke web | `npm run web` (manual)       | pager de materiales navega y conserva scroll |

## Scope

**In scope**:

- `mcm-app/app/screens/MaterialPagesScreen.tsx`

**Out of scope** (do NOT touch):

- `components/FormattedContent.tsx`
- Cualquier otra pantalla con el mismo patrón si apareciera — anotar en el
  informe, no ampliar.

## Git workflow

- Branch: la que indique el operador (o `advisor/009-materialpages-hoist-components`).
- Estilo: `perf(materiales): las páginas del pager dejan de remontarse en cada render`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: hoist a módulo-level con props explícitas

Mover `IntroPageItem` y `ContentPageItem` FUERA del componente (módulo-level,
encima de `MaterialPagesScreen`), convirtiendo cada captura de closure en
prop:

- `IntroPageItem`: props `{ actividad, styles, width, fecha }`.
- `ContentPageItem`: props `{ item, styles, fontScale, height }` (y `width`
  si lo usa la rama nativa).

Tipar `styles` con `ReturnType<typeof createStyles>`. El `useMemo` de los
círculos se queda dentro de `IntroPageItem` — al estabilizar el tipo, ahora sí
sobrevive entre renders (que es su intención).

**Verify**: `npm run typecheck` → exit 0.

### Step 2: actualizar `renderItem`

`renderItem` pasa las props nuevas. Mantener `getItemLayout` intacto. Si
`renderItem` era una arrow inline, dejarla inline (el Compiler la memoiza;
lo que importa es que el TIPO de los items ya es estable).

**Verify**: `npm run typecheck` + `npm run lint` → exit 0; `npm test` → verde.

### Step 3: smoke manual

`npm run web` → abrir un material de evento con varias páginas: (a) deslizar
a la página 2, hacer scroll dentro, deslizar a la 3 y volver — el scroll de
la 2 se conserva; (b) los círculos decorativos de la intro NO cambian de
posición al interactuar con la pantalla.

**Verify**: ambas observaciones ciertas (anotarlas en el informe final).

## Test plan

- No hay tests de render de pantallas en el repo (decisión registrada en
  TODO.md); la verificación es typecheck + suite existente + smoke del Step 3.
  NO añadir render tests aquí (pertenecen al plan ya registrado en TODO.md).

## Done criteria

- [ ] `npm run typecheck` y `npm run lint` exit 0; `npm test` verde
- [ ] `grep -n "const IntroPageItem" mcm-app/app/screens/MaterialPagesScreen.tsx`
      → la definición está ANTES de la línea donde empieza
      `export default function MaterialPagesScreen` (comprobable con los
      números de línea del grep)
- [ ] Ídem `ContentPageItem`
- [ ] `git status` limpio fuera del archivo
- [ ] `plans/README.md` actualizado
- [ ] Sin entrada de CHANGELOG (refactor interno sin cambio funcional — regla
      del repo: NO se documenta)

## STOP conditions

- Los excerpts no coinciden (drift).
- Alguna de las dos definiciones captura estado del padre que cambia por
  interacción (no solo `styles`/dimensiones/`fecha`) — entonces el hoist
  necesita más props de las listadas y hay que re-evaluar si alguna rompe la
  igualdad referencial que el pager espera.
- El archivo supera 400 líneas tras el movimiento (no debería — es mover, no
  añadir): extraer entonces a `components/materiales/` como dice Current
  state.

## Maintenance notes

- Regla que este plan ejemplifica (ya implícita en el repo): NUNCA definir
  componentes dentro del render. El lint `react/no-unstable-nested-components`
  la detectaría — proponerla al revisor como candidata a `eslint.config.js`
  (fuera de scope activarla aquí).
- Revisor: mirar el diff con `--color-moved` — debe ser movimiento casi puro.
