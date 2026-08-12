# Plan 008: Caché compartida en `useFirebaseData` y calendario con stale-while-revalidate

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 2d2822c..HEAD -- mcm-app/hooks/useFirebaseData.ts mcm-app/hooks/useCalendarEvents.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (hook central de datos — cubierto por tests existentes)
- **Depends on**: none (recomendado DESPUÉS de 001-005 por ser el cambio de más riesgo)
- **Category**: perf
- **Planned at**: commit `2d2822c`, 2026-07-18

## Why this matters

`useFirebaseData` mantiene estado **por instancia**: cada consumidor del
mismo path repite el `JSON.parse` de la caché AsyncStorage (síncrono, en el
hilo JS, durante el arranque), el `transform`, y sus propios round-trips a
Firebase (`updatedAt` + `hidden`). El nodo `songs` — el más grande — tiene
3 consumidores simultáneos (Categories, SongList, SelectedSongs, vivos a la
vez por `freezeOnBlur`). El calendario duplica el problema con un agravante:
`useCalendarEvents` se monta en Home Y en Calendario, cada instancia descarga
y parsea TODOS los ICS, y la caché local solo se usa si estás **offline** —
online el usuario espera la red completa aunque haya datos cacheados
(no hay stale-while-revalidate). Un fallo por calendario se traga con
`catch {}` vacío (sin logger, contra la convención del repo).

## Current state

- `mcm-app/hooks/useFirebaseData.ts` (archivo completo verificado, 143
  líneas): efecto con `[path, storageKey, transform]`; caché AsyncStorage
  (`${storageKey}_data|_updatedAt|_hidden`); gate por `updatedAt` (líneas
  63-101); descarga completa sin caché (103-128); recuperación de caché
  corrupta (48-53); flag `isMounted`. Sin estado a nivel de módulo, sin
  dedupe de llamadas en vuelo.
- Consumidores de `songs` (verificados): `app/screens/CategoriesScreen.tsx:76-79`
  y `app/screens/SongListScreen.tsx:89-95` con transform `filterSongsData`;
  `app/screens/SelectedSongsScreen.tsx:170-172` SIN transform (inconsistencia
  a conservar tal cual — ojo, NO unificar el transform aquí: SelectedSongs
  necesita también las canciones ocultas para playlists antiguas, verificar
  antes de tocar).
- `mcm-app/hooks/useCalendarEvents.ts:154-227` (verificado):

  ```ts
  const cachedStr = await AsyncStorage.getItem('calendar_events');
  if (!connected && cachedStr) {          // ← caché SOLO offline
    setEventsByDate(JSON.parse(cachedStr));
    setLoading(false);
    return;
  }
  const map: Record<string, CalendarEvent[]> = {};
  for (let i = 0; i < calendars.length; i++) {
    ...
    } catch {}                             // ← fallo por calendario silencioso
  }
  ```

- Test existente que protege el hook: `mcm-app/__tests__/useFirebaseData.test.ts`
  — léelo entero antes de tocar el hook; debe seguir verde sin modificarlo
  (si necesitas tocarlo, STOP y justifica).
- React Compiler está ACTIVO (`babel.config.js` con `react-compiler`) — no
  añadas `useMemo`/`useCallback` manuales; el problema aquí es
  cross-instancia, no de re-render.

## Commands you will need

| Purpose   | Command (desde `mcm-app/`)            | Expected on success |
|-----------|----------------------------------------|---------------------|
| Install   | `npm ci`                               | exit 0              |
| Typecheck | `npx tsc --noEmit`                     | exit 0              |
| Tests     | `npx jest useFirebaseData --ci` y suite completa | all pass  |
| Lint      | `npm run lint`                         | 0 errors            |

## Scope

**In scope**:
- `mcm-app/hooks/useFirebaseData.ts`
- `mcm-app/hooks/useCalendarEvents.ts`
- `mcm-app/__tests__/useFirebaseData.test.ts` (solo AÑADIR casos)
- `mcm-app/__tests__/useCalendarEvents.test.ts` (crear, si extraes helpers puros)
- `mcm-app/CHANGELOG.md`

**Out of scope**:
- Los consumidores (pantallas) — la API del hook NO cambia
  (`{ data, loading, offline, hidden }`).
- Reintentos con backoff / sync en background (TODO.md ya los recoge aparte).
- Mover el calendario a un provider/context — sería mejor arquitectura pero
  cambia `app/_layout.tsx` (12 providers, deuda tracked); la caché a nivel de
  módulo consigue el mismo dedupe sin tocar el árbol. NO añadas providers.
- `parseICS` — extraer/testearlo es el hallazgo TEST-04, plan aparte.

## Git workflow

- Branch: `advisor/008-cache-compartida` desde `main`.
- Commits por paso: `perf(data): ...`.
- No push / no PR salvo que el operador lo pida.

## Steps

### Step 1: Caché de módulo + dedupe en `useFirebaseData`

Añade a nivel de módulo (encima del hook):

```ts
type CacheEntry = {
  parsed: unknown;          // resultado de JSON.parse de _data (SIN transform)
  updatedAt: string | null;
  hidden: boolean;
  inflight: Promise<void> | null;  // fetch remoto en curso para este path
};
const nodeCache = new Map<string, CacheEntry>(); // key = storageKey
```

Semántica (conservadora, misma API):
1. Al montar, si `nodeCache` tiene entrada para `storageKey`, úsala en vez de
   `AsyncStorage.getItem + JSON.parse` (aplica `transform` por instancia —
   los transforms difieren entre consumidores, el caché guarda lo CRUDO).
2. La fase remota (check de `updatedAt` + posible descarga) se coalesce: si
   hay `inflight` para ese path, espera esa promesa en lugar de lanzar otra;
   al resolverse, relee la entrada de caché y actualiza el estado local.
3. Cuando la descarga remota actualiza datos, actualiza `nodeCache` Y
   AsyncStorage (como hoy), y resuelve la promesa para los que esperan.
4. La recuperación de caché corrupta (líneas 48-53) también invalida la
   entrada de `nodeCache`.

Cuidado con: instancias que montan con el mismo path y distinto transform
(caso real: `songs`); el estado `offline` sigue siendo por instancia; y NO
retengas en el Map errores — en catch, limpia `inflight`.

**Verify**: `npx jest useFirebaseData --ci` → los tests existentes pasan SIN
modificarlos.

### Step 2: Tests nuevos del dedupe

Añade a `__tests__/useFirebaseData.test.ts` (sin tocar los existentes):
- Dos hooks montados con el mismo `path`/`storageKey` → `AsyncStorage.getItem`
  de `_data` se llama una sola vez y `get()` de `updatedAt` una sola vez.
- Segundo mount DESPUÉS de completarse el primero → sirve datos desde el
  caché de módulo (0 llamadas nuevas a `getItem` de `_data`).
- Transforms distintos sobre el mismo path → cada hook recibe su transform
  aplicado.
- Expón un helper `__resetNodeCacheForTests()` para aislar tests.

**Verify**: `npx jest useFirebaseData --ci` → all pass, ≥3 tests nuevos.

### Step 3: Calendario — stale-while-revalidate + log de errores + dedupe

En `useCalendarEvents.ts`:
1. **Caché primero SIEMPRE**: si `cachedStr` existe, `setEventsByDate` +
   `setLoading(false)` inmediatamente (online u offline). Si offline, return
   como hoy; si online, continúa a revalidar en background y actualiza estado
   al terminar.
2. **Logger en el catch por calendario**: sustituye `} catch {}` por
   `} catch (e) { logger.error('[calendar] fallo cargando calendario', i, e); }`
   (import `logger` de `@/utils/logger`).
3. **No pisar caché completa con parcial**: si alguno de los calendarios
   falló, NO sobrescribas `calendar_events` en AsyncStorage (mantén la última
   completa); actualiza solo el estado en memoria.
4. **Dedupe entre Home y Calendario**: módulo-level, igual que Step 1 —
   una promesa `inflight` keyed por la lista de URLs (p.ej.
   `calendars.map(c => c.url).join('|')`), de modo que dos monturas
   concurrentes compartan un solo ciclo fetch+parse.

**Verify**: `npx tsc --noEmit` exit 0; `npm run lint` 0 errors.

### Step 4: Suite completa + CHANGELOG

Corre toda la suite. Entrada de CHANGELOG: mejora de rendimiento en la capa
de datos (dedupe) y calendario visible al instante desde caché (cambio de
lógica de datos = SÍ se documenta).

**Verify**: `npx jest --ci` → 28+ suites verdes.

## Test plan

- Step 2 cubre el hook central.
- Para el calendario: si extraes la lógica de "merge y política de caché" a
  helpers puros, testéalos en `__tests__/useCalendarEvents.test.ts`; el ciclo
  completo con fetch es aceptable dejarlo sin test de integración (no hay
  infra de mock de fetch en el repo — no la inventes aquí).

## Done criteria

- [ ] `npx jest --ci` exit 0 — tests existentes de `useFirebaseData` INTACTOS y verdes + ≥3 nuevos
- [ ] `npx tsc --noEmit` exit 0; `npm run lint` 0 errors
- [ ] `grep -n "catch {}" mcm-app/hooks/useCalendarEvents.ts` → 0 coincidencias
- [ ] Con caché presente y online, el calendario muestra datos cacheados antes de revalidar (visible en la lógica: `setEventsByDate` desde caché precede al fetch)
- [ ] `git status` limpio fuera del scope; CHANGELOG + `plans/README.md` actualizados

## STOP conditions

- Los tests existentes de `useFirebaseData` requieren modificación para
  pasar — señal de cambio de semántica observable; para y reporta cuál.
- El shape de la inconsistencia de `songs` (SelectedSongs sin
  `filterSongsData`) resulta ser un BUG y no una decisión (p.ej. muestra
  borradores) — no lo "arregles" aquí; repórtalo.
- La revalidación online del calendario provoca parpadeo/reordenación
  visible que empeora la UX (si puedes ejecutar la app) — reporta antes de
  añadir lógica de diffing.
- Cualquier necesidad de tocar `app/_layout.tsx` o los consumidores.

## Maintenance notes

- El caché de módulo vive lo que viva el proceso JS — en OTA/reload se vacía
  solo. No añadir TTL salvo evidencia de necesidad.
- Si en el futuro se adopta react-query/SWR (MEJORAS.md lo menciona como
  no-adoptado), este dedupe es exactamente lo que aportaría — la migración
  puede sustituir `nodeCache` sin tocar consumidores si la API del hook se
  mantuvo.
- El indicador `offline` por instancia queda ligeramente redundante con el
  dedupe; unificarlo es cosmético y se dejó fuera a propósito.
