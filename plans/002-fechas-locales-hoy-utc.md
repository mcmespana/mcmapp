# Plan 002: Calcular "hoy" y las fechas de reflexión en hora local (no UTC)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 2d2822c..HEAD -- "mcm-app/app/(tabs)/index.tsx" "mcm-app/app/(tabs)/calendario.tsx" mcm-app/app/screens/ReflexionesScreen.tsx mcm-app/hooks/useContigoHabits.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `2d2822c`, 2026-07-18

## Why this matters

La app es para usuarios en España (UTC+1/UTC+2). Tres sitios construyen la
fecha "YYYY-MM-DD" con `toISOString()`, que convierte a UTC:

1. **Home**: `todayStr` resulta ser **ayer durante todo el año** (medianoche
   local → 22:00/23:00 UTC del día anterior), así que los eventos de ayer
   aparecen en "próximos eventos" cada día.
2. **Calendario**: entre las 00:00 y la 01:00/02:00 locales, el día
   seleccionado por defecto y la marca de "hoy" apuntan a ayer.
3. **Reflexiones**: una reflexión compartida después de medianoche (o con
   fecha elegida en el picker) se guarda con el día anterior.

El repo ya tiene el patrón correcto (`localISO` en `useContigoHabits.ts`,
comentado "no UTC drift") — hay que promoverlo a `utils/` y usarlo.

## Current state

- `mcm-app/app/(tabs)/index.tsx:129-139` (dentro de un helper de agrupación de
  eventos):

  ```ts
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  ...
  const sortedDates = Object.keys(eventsByDate)
    .filter((date) => date >= todayStr)
    .sort();
  ```

- `mcm-app/app/(tabs)/calendario.tsx:115-117`:

  ```ts
  const todayStr = new Date().toISOString().split('T')[0];

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  ```

- `mcm-app/app/screens/ReflexionesScreen.tsx:216` (dentro de `addReflexion`):

  ```ts
  fecha: fecha.toISOString().slice(0, 10),
  ```

  (`fecha` por defecto es `new Date()` — :236 — o la fecha del
  `DateTimePicker`.)

- Patrón correcto ya existente, `mcm-app/hooks/useContigoHabits.ts` (~:218):

  ```ts
  // ── Pure helpers (local-time, no UTC drift) ────────────────────────────────
  function localISO(d: Date = new Date()): string {
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
  }
  ```

Convenciones: imports con alias `@/`, TypeScript estricto, helpers puros en
`utils/` con test (regla del repo: cada util extraído sale con su test).

## Commands you will need

| Purpose   | Command (desde `mcm-app/`) | Expected on success |
|-----------|-----------------------------|---------------------|
| Install   | `npm ci`                    | exit 0              |
| Typecheck | `npx tsc --noEmit`          | exit 0              |
| Tests     | `npx jest --ci`             | all pass            |
| Lint      | `npm run lint`              | 0 errors            |

## Scope

**In scope**:
- `mcm-app/utils/localDate.ts` (crear)
- `mcm-app/__tests__/localDate.test.ts` (crear)
- `mcm-app/app/(tabs)/index.tsx` (solo las líneas del excerpt)
- `mcm-app/app/(tabs)/calendario.tsx` (solo las líneas del excerpt)
- `mcm-app/app/screens/ReflexionesScreen.tsx` (solo la línea del excerpt)
- `mcm-app/hooks/useContigoHabits.ts` (solo para reexportar/importar el helper)
- `mcm-app/CHANGELOG.md`

**Out of scope**:
- La expansión multi-día de `hooks/useCalendarEvents.ts` (:200-211) usa
  `toISOString` pero es un roundtrip UTC autoconsistente
  (`new Date('YYYY-MM-DD')` parsea como UTC) — NO lo toques.
- Cualquier otro sitio con fechas (contigo/evangelio, oracion) — ya usan sus
  propios helpers locales.
- No unifiques aquí los arrays de meses/días duplicados (deuda aparte,
  DEBT-02 del audit).

## Git workflow

- Branch: `advisor/002-fechas-locales` desde `main`.
- Commit sugerido: `fix: calcular "hoy" y fechas de reflexión en hora local (bug UTC)`.
- No push / no PR salvo que el operador lo pida.

## Steps

### Step 1: Crear `utils/localDate.ts` con test

Crea `mcm-app/utils/localDate.ts` exportando `localISO(d: Date = new Date()): string`
con la implementación exacta del excerpt de `useContigoHabits.ts`. Crea
`__tests__/localDate.test.ts` (patrón: cualquier test de utils existente, p.ej.
`__tests__/songUtils.test.ts`) con casos: fecha fija de mediodía; fecha a las
00:30 hora de Madrid construida con `new Date(2026, 6, 18, 0, 30)` → devuelve
`2026-07-18` (esto fallaría con `toISOString` si el runner corre en TZ CET;
para hacerlo determinista, asserta que `localISO(new Date(2026, 6, 18, 0, 30))`
=== `'2026-07-18'` — es cierto en cualquier TZ porque usa getters locales).

**Verify**: `npx jest localDate --ci` → pass.

### Step 2: Cambiar `useContigoHabits.ts` a importar el helper compartido

Elimina la función local `localISO` del hook e importa
`{ localISO }` desde `@/utils/localDate`. No toques `offsetISODate` ni
`getMondayWeek` (usan `localISO` — actualiza solo la referencia).

**Verify**: `npx jest contigo --ci` → pass; `npx tsc --noEmit` → exit 0.

### Step 3: Corregir los tres puntos UTC

1. `index.tsx`: sustituye las 3 líneas del excerpt por
   `const todayStr = localISO();` (importa desde `@/utils/localDate`).
2. `calendario.tsx`: `const todayStr = localISO();`.
3. `ReflexionesScreen.tsx`: `fecha: localISO(fecha),`.

**Verify**: `npx tsc --noEmit` → exit 0; `npm run lint` → 0 errors.

### Step 4: CHANGELOG

Entrada nueva arriba: fix de fecha UTC en Home/Calendario/Reflexiones
(bug visible de usuario — sí se documenta).

**Verify**: `npx jest --ci` → all pass.

## Test plan

- `__tests__/localDate.test.ts`: mediodía, 00:30 local, cambio de mes
  (31-ene → localISO correcto), padding de ceros.
- Los tests existentes de contigo (`contigoBookmarks`, etc.) siguen verdes
  tras el paso 2.

## Done criteria

- [ ] `npx tsc --noEmit` exit 0
- [ ] `npx jest --ci` exit 0 con los tests nuevos de `localDate`
- [ ] `grep -rn "toISOString" "mcm-app/app/(tabs)/index.tsx" "mcm-app/app/(tabs)/calendario.tsx" mcm-app/app/screens/ReflexionesScreen.tsx` → sin coincidencias en los puntos del excerpt (la expansión multi-día de useCalendarEvents NO estaba en estos archivos)
- [ ] `git status` limpio fuera del scope
- [ ] CHANGELOG.md + fila en `plans/README.md` actualizadas

## STOP conditions

- Los excerpts no coinciden con el código vivo.
- Encuentras MÁS consumidores de `todayStr` en `index.tsx`/`calendario.tsx`
  cuyo comportamiento dependa del valor UTC (p.ej. comparaciones con claves
  generadas también en UTC) — repórtalo antes de cambiar la semántica.
- El test del paso 1 falla en CI por timezone del runner — no "arregles" el
  test con toISOString; reporta.

## Maintenance notes

- Regla a futuro: cualquier clave de fecha `YYYY-MM-DD` visible por el usuario
  se construye con `localISO`, nunca con `toISOString`. Un grep periódico de
  `toISOString().split` / `toISOString().slice` en `app/` es un buen check de
  review.
- Si algún día la app sale de España, revisar si las claves deben ser TZ del
  dispositivo (actual) o TZ fija Europe/Madrid (el scraper de lecturas usa
  Europe/Madrid).
