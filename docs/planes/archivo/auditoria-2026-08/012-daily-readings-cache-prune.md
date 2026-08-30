# Plan 012: Podar la caché de lecturas diarias — hoy crece una clave por día, para siempre

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 40c6566..HEAD -- mcm-app/hooks/useDailyReadings.ts`
> On a mismatch with the "Current state" excerpts, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW — los subrayados/guardados NO viven aquí (los bookmarks
  llevan su propia copia del texto), así que la poda no puede perder datos de
  usuario; el único riesgo es un prefijo demasiado codicioso, y el regex ISO
  lo evita
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `40c6566`, 2026-08-05

## Why this matters

`useDailyReadings` cachea cada día bajo su propia clave
(`@daily_readings_YYYY-MM-DD`, con evangelio + comentario + dos lecturas +
salmo, 5-15 KB por día) y NADA la poda jamás — el grep del prefijo solo
aparece en este archivo. Un usuario diario acumula una clave por día sin tope:
en un año, varios MB que la app nunca reclama, degradando el SQLite de
AsyncStorage en Android sin remedio salvo reinstalar. Además el nodo remoto se
purga a 30 días (limpieza del scraper), así que la copia local vieja no solo
sobra: puede servir lecturas que el scraper corrigió después. De paso, un
detalle del mismo efecto: el `setIsLoading(false)` del camino de caché es la
única escritura de estado sin guard `isMounted`.

## Current state

- `mcm-app/hooks/useDailyReadings.ts` (177 líneas) — único usuario del
  prefijo. Piezas:

```ts
const CACHE_PREFIX = '@daily_readings_';                       // l.33
/* … */
const cacheKey = `${CACHE_PREFIX}${dateStr}`;                  // l.51
let cached = await AsyncStorage.getItem(cacheKey);
/* …fallback a bookmarks si no está en caché (l.56-69)… */
if (cached) {
  if (isMounted) setReadings(foundInBookmarks || JSON.parse(cached));
  setIsLoading(false);   // ← l.73: única escritura SIN guard isMounted
}
/* …fetch de seccion_oracion/lecturas/${dateStr} y… */
await AsyncStorage.setItem(cacheKey, JSON.stringify(parsedReadings));  // l.155 — sin poda jamás
```

- Los guardados del usuario NO dependen de esta caché: los bookmarks llevan
  su propia copia del texto (`utils/contigoBookmarks.ts` — `StoredBookmark`
  incluye `readings`, y el propio hook lo usa como fallback en l.56-69).
- El usuario puede navegar a fechas arbitrarias con el selector
  (`hooks/useAvailableReadingDates.ts` → `ReadingCalendarSheet`), así que la
  caché acumula también fechas pasadas navegadas.
- Helper de fecha local ya existente: `utils/localDate.ts` (`localISO`).
- Convenciones: helpers puros con test, logger central, español.

## Commands you will need

| Purpose   | Command (desde `mcm-app/`)       | Expected on success |
|-----------|----------------------------------|---------------------|
| Install   | `npm ci`                         | exit 0              |
| Typecheck | `npm run typecheck` + `npm run typecheck:tests` | exit 0 |
| Tests     | `npm test -- dailyReadings`      | all pass            |
| Tests     | `npm test`                       | all pass            |

## Scope

**In scope**:

- `mcm-app/hooks/useDailyReadings.ts` (guard de l.73 + disparar la poda)
- `mcm-app/utils/dailyReadingsCache.ts` (crear — la poda como función pura +
  IO fina, para que sea testeable)
- `mcm-app/__tests__/dailyReadingsCache.test.ts` (crear)

**Out of scope** (do NOT touch):

- `utils/contigoBookmarks.ts` — los guardados no se tocan (y su clave
  `@contigo_bookmarks` NO casa con el prefijo, pero el test lo fija igual).
- `hooks/useAvailableReadingDates.ts`, `ReadingCalendarSheet`.
- El scraper y su limpieza remota.
- El TTL/revalidación de entradas vigentes (hoy la caché del día se revalida
  contra Firebase en cada load — eso ya funciona; solo se poda lo viejo).

## Git workflow

- Branch: la que indique el operador (o `advisor/012-daily-readings-cache-prune`).
- Estilo: `fix(contigo): poda la caché de lecturas diarias (crecía sin tope)`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: `utils/dailyReadingsCache.ts`

Dos exports:

```ts
export const DAILY_READINGS_PREFIX = '@daily_readings_';
const KEY_RE = /^@daily_readings_(\d{4}-\d{2}-\d{2})$/;

/** Puras: qué claves borrar. Solo claves que casan EXACTAMENTE con el
 *  patrón prefijo+fecha ISO; cualquier otra clave se ignora. */
export function selectKeysToPrune(
  allKeys: readonly string[],
  todayISO: string,
  retentionDays = 60,
): string[] { /* fecha < hoy − retención → fuera */ }

/** IO: getAllKeys → selectKeysToPrune → multiRemove. Se traga errores con
 *  logger.warn (la poda nunca debe romper la carga de lecturas). */
export async function pruneDailyReadingsCache(): Promise<number> { … }
```

Mover `CACHE_PREFIX` del hook aquí (el hook lo importa) para que no haya dos
copias del prefijo.

**Verify**: `npm run typecheck` → exit 0.

### Step 2: tests de la función pura

`__tests__/dailyReadingsCache.test.ts`:

1. Claves más viejas que la retención → seleccionadas; dentro de la ventana →
   no.
2. Claves ajenas NO casan: `@contigo_bookmarks`, `@daily_readings_` sin fecha,
   `@daily_readings_2026-13-99` sí casa el regex pero es fecha inválida —
   decidir y fijar: el regex la selecciona por comparación de string (es
   "menor" que hoy → se borra; correcto, es basura).
3. Lista vacía → vacío.
4. `pruneDailyReadingsCache` con el mock de AsyncStorage: borra exactamente
   lo seleccionado y devuelve el contador; un `multiRemove` que falla no
   lanza.

**Verify**: `npm test -- dailyReadings` → all pass.

### Step 3: disparar la poda una vez por sesión + guard de isMounted

En `useDailyReadings.ts`:

- Añadir el guard: `if (isMounted) setIsLoading(false);` en l.73.
- Disparar `pruneDailyReadingsCache()` UNA vez por proceso: flag module-level
  (`let pruned = false`) y llamarla (sin await — fire-and-forget con catch)
  al principio del efecto la primera vez. Comentario en español: por qué una
  vez y por qué no bloquea la carga.

**Verify**: `npm run typecheck` + `npm test` → verde.

## Test plan

- Los 4 casos del Step 2 (la pura concentra el riesgo del prefijo codicioso;
  el caso `@contigo_bookmarks` es el centinela de "no borrar datos de
  usuario").

## Done criteria

- [ ] `npm run typecheck` + `npm run typecheck:tests` exit 0
- [ ] `npm test` exits 0 con ≥4 tests nuevos
- [ ] `grep -rn "@daily_readings_" mcm-app --include='*.ts*'` → el literal
      del prefijo vive SOLO en `utils/dailyReadingsCache.ts` (el hook lo
      importa)
- [ ] `grep -n "setIsLoading(false)" mcm-app/hooks/useDailyReadings.ts` →
      todas las apariciones dentro de `if (isMounted)` o en el `finally` ya
      guardado
- [ ] `git status` limpio fuera del scope
- [ ] `plans/README.md` actualizado
- [ ] Entrada en `mcm-app/CHANGELOG.md`

## STOP conditions

- Los excerpts no coinciden (drift).
- Aparece otro consumidor del prefijo al mover la constante.
- El mock de AsyncStorage del repo no implementa `getAllKeys`/`multiRemove`
  (mirar cómo lo mockean los tests existentes; si falta, añadir al mock del
  test nuevo SOLO, no al global compartido — y si eso no basta, reportar).

## Maintenance notes

- Retención de 60 días: cubre de sobra el selector de fechas (el nodo remoto
  solo guarda 30) con margen. Si el selector algún día ofrece histórico
  largo, subir la retención ANTES de ampliar el selector.
- Los guardados de verdad viven en bookmarks — si alguien mueve el fallback
  de bookmarks (l.56-69 del hook), la poda sigue siendo segura, pero
  revisarlo.
- Revisor: el fire-and-forget de la poda no debe retrasar el primer render de
  las lecturas (sin await en el camino caliente).
