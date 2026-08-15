# Plan 011: Recortar el calendario litúrgico embebido — 318 KB y 76 años para servir dos

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 40c6566..HEAD -- mcm-app/components/contigo/LiturgicalBadge.tsx mcm-app/assets/calendario-liturgico.json`
> On a mismatch with the "Current state" excerpts, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW — recorte de datos puro; el fallback a "Tiempo Ordinario" ya
  existe para años fuera de rango. El único riesgo real es que el recorte
  caduque en silencio → por eso el generador y el test de vigencia
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `40c6566`, 2026-08-05

## Why this matters

`components/contigo/LiturgicalBadge.tsx` importa estáticamente
`assets/calendario-liturgico.json`: **318 KB** cubriendo los años 2025→2100.
Metro inlinea el JSON en el bundle JS, así que cada OTA descarga y cada
arranque evalúa ~300 KB de datos de los que >95% no se usará en años: las
consultas solo tocan el año de la fecha mostrada. Recortarlo a una ventana
rodante (año actual ±3) deja el mismo comportamiento con ~4% del peso, y un
generador con test de vigencia evita que la ventana caduque sin avisar.

## Current state

- `mcm-app/assets/calendario-liturgico.json` — 318.101 bytes, un objeto con
  clave por año (`"2025"`, `"2026"`, … `"2100"`), cada año con `tiempos[]`
  (`{id, nombre, inicio, fin}`), `fechas_especiales[]`, `domingos_adviento[]`,
  `domingos_cuaresma[]`.
- `mcm-app/components/contigo/LiturgicalBadge.tsx` — único consumidor
  (verificado por grep). Import y fallback:

```tsx
import liturgicalCalendar from '@/assets/calendario-liturgico.json';   // l.3

export function getLiturgicalInfo(dateStr: string) {
  const [year] = dateStr.split('-');
  const calYear = liturgicalCalendar[year as keyof typeof liturgicalCalendar];
  if (!calYear)
    return {
      color: 'success' as ChipColor,
      name: 'Tiempo Ordinario',
      hex: '#3A7D44',
    };                                                                  // l.17-22 ← fallback ya existe
  /* …fechas especiales, Gaudete/Laetare, tiempos… */
}
```

- Se renderiza desde las tres rutas de Contigo (index, evangelio, oracion) y
  hay tests que ejercitan `getLiturgicalInfo` — comprobar con
  `grep -rn "getLiturgicalInfo\|LiturgicalBadge" mcm-app/__tests__/` qué años
  usan los fixtures antes de recortar.
- Scripts de generación existentes como referencia de estilo:
  `mcm-app/scripts/generate-tab-icons.js` y `generate-alt-icons.js`
  (registrados en `package.json` como `icons:tabs`/`icons:alt`).
- OJO OTA: el JSON va en el bundle JS, así que el recorte SÍ sale por OTA sin
  build de tienda (no es cambio nativo). No hace falta `[skip-ota]`.

## Commands you will need

| Purpose   | Command (desde `mcm-app/`)      | Expected on success |
|-----------|---------------------------------|---------------------|
| Install   | `npm ci`                        | exit 0              |
| Typecheck | `npm run typecheck`             | exit 0              |
| Tests     | `npm test -- liturgical`        | all pass            |
| Tamaño    | `wc -c assets/calendario-liturgico.json` | < 40000 (era 318101) |

## Scope

**In scope**:

- `mcm-app/assets/calendario-liturgico-completo.json` (crear — la tabla
  completa 2025-2100 se PRESERVA aquí, fuera del bundle: `assets/` solo
  inlinea lo importado, un JSON sin import no pesa en el bundle. Verificarlo:
  ningún `require`/`import` debe apuntarle salvo el script)
- `mcm-app/assets/calendario-liturgico.json` (recortar — sigue siendo el que
  importa el badge, mismo nombre para no tocar el import)
- `mcm-app/scripts/generate-liturgical-window.js` (crear)
- `mcm-app/package.json` (script `liturgical:window`)
- `mcm-app/__tests__/liturgicalWindow.test.ts` (crear)

**Out of scope** (do NOT touch):

- `components/contigo/LiturgicalBadge.tsx` — ni el import ni la lógica
  cambian (esa es la gracia del recorte con mismo nombre).
- Los tests existentes del badge (si sus fixtures caen dentro de la ventana;
  si no, ver STOP).

## Git workflow

- Branch: la que indique el operador (o `advisor/011-liturgical-json-window`).
- Estilo: `perf(contigo): calendario litúrgico recortado a ventana rodante (−280 KB de bundle)`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: preservar la tabla completa

`git mv mcm-app/assets/calendario-liturgico.json mcm-app/assets/calendario-liturgico-completo.json`
y comprobar con `grep -rn "calendario-liturgico" mcm-app --include='*.ts*' --include='*.js'`
que NADA importa el `-completo` (solo el script del Step 2 lo leerá con `fs`).

**Verify**: el grep muestra solo el import roto del badge (se arregla en el
Step 2 al regenerar el recortado) y ninguna otra referencia.

### Step 2: generador de la ventana

`mcm-app/scripts/generate-liturgical-window.js` (Node puro, estilo de los
scripts `generate-*-icons.js`): lee `-completo.json`, toma
`[añoActual-1 … añoActual+3]` (el año anterior también: en enero se consultan
fechas de diciembre y los `tiempos` litúrgicos cruzan el año civil), escribe
`calendario-liturgico.json` con solo esas claves, ordenadas. Registrar en
`package.json`: `"liturgical:window": "node scripts/generate-liturgical-window.js"`.
Ejecutarlo.

**Verify**: `wc -c mcm-app/assets/calendario-liturgico.json` → <40 KB;
`node -e "const c=require('./mcm-app/assets/calendario-liturgico.json'); console.log(Object.keys(c))"`
→ exactamente 5 años, del actual−1 al actual+3.

### Step 3: test de vigencia (el candado contra la caducidad silenciosa)

`__tests__/liturgicalWindow.test.ts`:

1. El JSON recortado contiene el año actual (`new Date().getFullYear()`) y
   el siguiente. **Este test es el que fallará en CI cuando la ventana esté
   a punto de caducar** — ese es su trabajo; el mensaje de fallo debe decir
   exactamente qué comando correr (`npm run liturgical:window` + commit).
2. `getLiturgicalInfo` de una fecha del año actual devuelve un tiempo real
   (name ≠ 'Tiempo Ordinario' para una fecha de Adviento conocida del año en
   curso, tomada del propio JSON para no hardcodear).
3. `getLiturgicalInfo('2099-06-15')` (fuera de ventana) devuelve el fallback
   'Tiempo Ordinario' sin lanzar.

**Verify**: `npm test -- liturgical` → all pass; `npm run typecheck` → exit 0.

## Test plan

- Los 3 tests del Step 3. El 1 convierte la caducidad de la ventana en un
  fallo de CI con instrucciones, en vez de un badge silenciosamente verde
  para siempre.

## Done criteria

- [ ] `wc -c mcm-app/assets/calendario-liturgico.json` < 40000
- [ ] `-completo.json` existe con las 76 claves y nadie lo importa
      (`grep -rn "liturgico-completo" mcm-app --include='*.ts*'` → solo el
      script con `fs`)
- [ ] `npm test` exits 0 con los 3 tests nuevos; los tests existentes del
      badge siguen verdes
- [ ] `npm run liturgical:window` es idempotente (correrlo dos veces → sin
      diff)
- [ ] `plans/README.md` actualizado
- [ ] Entrada en `mcm-app/CHANGELOG.md` (−280 KB de bundle y proceso nuevo de
      regeneración: SÍ se documenta, breve)

## STOP conditions

- Aparece OTRO importador de `calendario-liturgico.json` además del badge.
- Los tests existentes del badge usan fixtures de años fuera de la ventana
  (p. ej. 2030): NO recortar esos años a ciegas — ampliar la ventana del
  generador para cubrirlos o consultar al operador, y reportarlo.
- La estructura interna del JSON difiere de la descrita (claves distintas de
  `tiempos`/`fechas_especiales`/…).

## Maintenance notes

- Cadencia: correr `npm run liturgical:window` una vez al año (el test de
  vigencia avisará). Candidato natural a paso de un workflow anual si alguna
  vez molesta.
- Si el archivo `-completo` estorba en el repo (~310 KB versionados), puede
  moverse a `firebase-seed/` — decisión estética, no técnica.
- Revisor: confirmar en el diff del bundle (o simplemente por el tamaño del
  asset) que la mejora llega a la OTA siguiente.
