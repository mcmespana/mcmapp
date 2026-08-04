# Plan 004: Sincronización bidireccional de hábitos y revisiones de Contigo (+ tests de authHelpers)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 2d2822c..HEAD -- mcm-app/utils/authHelpers.ts mcm-app/hooks/useContigoHabits.ts mcm-app/hooks/useReaderBookmarks.ts "mcm-app/app/(tabs)/contigo/revision.tsx"`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW-MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `2d2822c`, 2026-07-18

## Why this matters

Contigo (evangelio/oración/revisión diaria) es el área más activa del
desarrollo reciente. Los hábitos y revisiones se **escriben** a
`users/{uid}/contigo/habits|revisions` cuando hay sesión, pero **nada los lee
de vuelta**: no existe `fetchContigoHabits` ni `fetchContigoRevisions`. Al
reinstalar la app o cambiar de dispositivo, el usuario logueado pierde todo su
historial de rachas y su heatmap aunque los datos estén en la nube. Los
bookmarks SÍ tienen hidratación (`fetchContigoBookmarks` + merge en
`useReaderBookmarks`) — este plan replica ese patrón ya validado para hábitos
y revisiones, y añade los tests que faltan a la capa `authHelpers` (la única
capa de mutación de datos por usuario, hoy sin ningún test — incluye
`deleteUserData`, relevante para borrado de cuenta).

## Current state

- `mcm-app/utils/authHelpers.ts` (verificado, archivo completo leído):
  - `:13-25` `stripUndefined` — recursivo, guarda de todos los writes.
  - `:95-106` `syncContigoHabit(uid, date, record)` → `set` en
    `users/${uid}/contigo/habits/${date}`, catch → `logger.error`.
  - `:137-152` `fetchContigoBookmarks(uid)` — **el patrón a replicar**:

    ```ts
    export async function fetchContigoBookmarks(
      uid: string,
    ): Promise<StoredBookmark[]> {
      try {
        const bookmarksRef = ref(db(), `users/${uid}/contigo/bookmarks`);
        const snap = await get(bookmarksRef);
        if (!snap.exists()) return [];
        const val = snap.val() as Record<string, StoredBookmark>;
        return Object.values(val).filter(
          (b): b is StoredBookmark => !!b && typeof b === 'object' && !!b.date,
        );
      } catch (err) {
        logger.error('[authHelpers] fetchContigoBookmarks:', err);
        return [];
      }
    }
    ```

  - `:155-169` `syncContigoRevision(uid, date, data)` → `set` en
    `users/${uid}/contigo/revisions/${date}`.
  - `:89-92` `deleteUserData(uid)` → `remove(users/${uid})`, lanza si falla.

- `mcm-app/hooks/useContigoHabits.ts`:
  - `DayRecord` se exporta de este hook (lo importa authHelpers `:4`).
  - `:55-70` `saveRecords` (verificado):

    ```ts
    const saveRecords = async (
      newRecords: Record<string, DayRecord>,
      changedDate?: string,
    ) => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newRecords));
        setRecords(newRecords);
        if (authUser && changedDate && newRecords[changedDate]) {
          syncContigoHabit(authUser.uid, changedDate, newRecords[changedDate]);
        }
      } catch (err) {
        logger.error('Failed to save contigo habits:', err);
      }
    };
    ```

- `mcm-app/hooks/useReaderBookmarks.ts:39-59` — **exemplar de hidratación**
  (verificado): efecto con `[authUser]` que carga local primero y, si hay
  sesión, `fetchContigoBookmarks` + merge + `setBookmarks(merged)`.

- Patrón de test a seguir: `mcm-app/__tests__/choirSessionService.test.ts`
  (mockea `firebase/database` y asserta paths y payloads de `set`/`get`).

## Commands you will need

| Purpose   | Command (desde `mcm-app/`)     | Expected on success |
|-----------|---------------------------------|---------------------|
| Install   | `npm ci`                        | exit 0              |
| Typecheck | `npx tsc --noEmit`              | exit 0              |
| Tests     | `npx jest authHelpers --ci` / `npx jest --ci` | all pass |
| Lint      | `npm run lint`                  | 0 errors            |

## Scope

**In scope**:
- `mcm-app/utils/authHelpers.ts` (añadir `fetchContigoHabits`, `fetchContigoRevisions`)
- `mcm-app/hooks/useContigoHabits.ts` (hidratar en login + merge)
- `mcm-app/app/(tabs)/contigo/revision.tsx` (hidratar revisiones si esa pantalla lee historial local — verificar primero cómo carga)
- `mcm-app/__tests__/authHelpers.test.ts` (crear)
- `mcm-app/CHANGELOG.md`

**Out of scope**:
- `useReaderBookmarks.ts` — ya funciona; es solo referencia.
- Cola de reintentos offline para writes fallidos (mejora aparte, tracked).
- Cambiar `saveRecords` a functional updater (hallazgo CORRECTNESS-07, aparte).
- Reglas RTDB (los paths `users/$uid` ya permiten leer al dueño).

## Git workflow

- Branch: `advisor/004-contigo-sync-bidireccional` desde `main`.
- Commits por paso, estilo repo, p.ej.
  `fix(contigo): hidratar hábitos y revisiones desde la nube al iniciar sesión`.
- No push / no PR salvo que el operador lo pida.

## Steps

### Step 1: `fetchContigoHabits` y `fetchContigoRevisions` en authHelpers

Añade a `utils/authHelpers.ts`, calcando la forma de `fetchContigoBookmarks`:

- `fetchContigoHabits(uid): Promise<Record<string, DayRecord>>` — lee
  `users/${uid}/contigo/habits`, devuelve `{}` si no existe o en error
  (logueando). Filtra valores no-objeto.
- `fetchContigoRevisions(uid): Promise<Record<string, unknown>>` — igual con
  `users/${uid}/contigo/revisions`.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 2: Hidratación + merge en `useContigoHabits`

En el efecto de carga inicial del hook (donde hoy solo se lee AsyncStorage),
tras cargar lo local y si `authUser` existe: `fetchContigoHabits(uid)` y
fusiona con lo local con esta semántica de merge (documéntala en un
comentario): **por fecha, gana el registro que tenga más campos marcados; a
igualdad, el local** (un usuario nunca "des-marca" al fusionar; así un remoto
antiguo no borra progreso local reciente). Persiste el resultado fusionado en
AsyncStorage y, para las fechas donde lo local aportó algo que el remoto no
tenía, re-sincroniza con `syncContigoHabit`. El efecto debe depender de
`authUser` (como en `useReaderBookmarks.ts:39-59`).

**Verify**: `npx jest contigo --ci` → pass (tests existentes siguen verdes).

### Step 3: Hidratación de revisiones

Localiza dónde `revision.tsx` (o su hook) carga el historial local de
revisiones. Aplica el mismo patrón: local primero, merge remoto si hay sesión
(gana el que exista; a igualdad, local). Si el almacenamiento de revisiones
resulta no tener lectura local de histórico (solo escribe), limita el paso a
hidratar el registro del día actual y reporta el alcance real en tu resumen.

**Verify**: `npx tsc --noEmit` → exit 0; `npm run lint` → 0 errors.

### Step 4: Tests de `authHelpers`

Crea `__tests__/authHelpers.test.ts` siguiendo el mock-pattern de
`choirSessionService.test.ts`. Casos mínimos:
- `stripUndefined`: objeto anidado con `undefined`, array con objetos,
  primitivo — claves undefined eliminadas recursivamente.
- `syncContigoHabit`: `set` llamado con path `users/u1/contigo/habits/2026-07-18`
  y payload sin `undefined`.
- `syncContigoBookmark(null)` → `remove` del path correcto.
- `writeUserOnLogin`: payload de `update` con claves aplanadas
  (`'mcm/profileType'`, `'meta/lastSeenAt'`) y `createdAt` solo si no existe
  (mockea `get().exists()` true/false).
- `deleteUserData`: `remove` sobre `users/u1` y que **propaga** el error
  (los sync tragan, este lanza — assert de ambos comportamientos).
- `fetchContigoHabits`: devuelve `{}` si `!exists()`, filtra basura, `{}` y
  log en error.

**Verify**: `npx jest authHelpers --ci` → all pass.

### Step 5: CHANGELOG

Entrada: hábitos/revisiones de Contigo se restauran al iniciar sesión en un
dispositivo nuevo (antes solo subían).

**Verify**: `npx jest --ci` → all pass (suite completa).

## Test plan

Descrito en Step 4. Además, un test del merge del Step 2 si extraes la
función de fusión como helper puro (recomendado:
`utils/contigoMerge.ts` + test — sigue la regla del repo "cada util extraído
sale con su test").

## Done criteria

- [ ] `npx tsc --noEmit` exit 0; `npm run lint` 0 errors
- [ ] `npx jest --ci` exit 0 — incluye `authHelpers.test.ts` con ≥8 asserts nuevos
- [ ] `grep -n "fetchContigoHabits" mcm-app/utils/authHelpers.ts mcm-app/hooks/useContigoHabits.ts` → definición + uso en el hook
- [ ] Simulación (test o manual): local vacío + remoto con 3 fechas → el hook expone las 3 fechas tras hidratar
- [ ] `git status` limpio fuera del scope; CHANGELOG + `plans/README.md` actualizados

## STOP conditions

- Los excerpts no coinciden con el código vivo (drift).
- El shape real de `DayRecord` en RTDB difiere del tipo local (datos legacy
  con otro formato) — reporta ejemplos en vez de forzar el cast.
- La pantalla de revisión no tiene ningún almacenamiento local legible
  (Step 3) y el cambio requeriría rediseñar su flujo — reporta el hallazgo.
- El merge exige decidir entre pisar remoto o local en un caso no cubierto
  por la regla dada — no inventes una tercera semántica; reporta.

## Maintenance notes

- La semántica de merge (gana el más completo; a igualdad, local) queda como
  contrato — cualquier futura "cola de reintentos offline" debe respetarla.
- Si se añade un campo nuevo a `DayRecord`, el merge por "más campos marcados"
  lo cuenta automáticamente, pero revisad que el campo sea booleano-ish.
- Follow-up deliberadamente fuera de este plan: reintentos con backoff de los
  sync (TODO.md ya lo recoge para `useFirebaseData`) y el functional-updater
  de `saveRecords` (CORRECTNESS-07 del audit).
