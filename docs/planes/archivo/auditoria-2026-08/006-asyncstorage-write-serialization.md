# Plan 006: Serializar las escrituras read-modify-write de AsyncStorage — dos escritores concurrentes se pisan en silencio

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 40c6566..HEAD -- mcm-app/services/pushNotificationService.ts mcm-app/utils/contigoBookmarks.ts mcm-app/notifications/usePushNotifications.ts`
> On a mismatch with the "Current state" excerpts, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW-MED — la serialización solo cambia el timing; el riesgo real
  es olvidar un call site, por eso el lock vive DENTRO de los helpers, no en
  los callers
- **Depends on**: none. Si el plan 004 (Contigo habits) ya se ejecutó, su cola
  interna cubre `@contigo_habits` — este plan NO toca ese dominio igualmente.
- **Category**: bug
- **Planned at**: commit `40c6566`, 2026-08-05

## Why this matters

Varios módulos hacen el ciclo `getItem` → parse → mutar → `setItem` sobre la
misma clave de AsyncStorage sin ninguna serialización. Si dos ciclos se
intercalan (dos pushes casi simultáneos, o un push llegando mientras el
usuario toca otro, o el merge remoto de bookmarks al iniciar sesión mientras
el usuario subraya), el segundo `setItem` escribe una copia obsoleta y el
cambio del primero desaparece: notificaciones que se esfuman del historial,
notificaciones que reaparecen como "no leídas", subrayados perdidos. Todos los
fallos son silenciosos (cada catch hace `logger.error` y sigue). El arreglo:
un mutex por clave (cadena de promesas) detrás de los helpers de escritura.

## Current state

- `mcm-app/services/pushNotificationService.ts`:
  - `saveReceivedNotificationLocally` (l.319-357): `getItem(NOTIFICATIONS_HISTORY_KEY)`
    → dedup → `unshift` → `slice(0,100)` → `setItem`. Sin lock.
  - `markNotificationAsRead` (l.390-427): mismo ciclo sobre
    `NOTIFICATIONS_HISTORY_KEY` (map con `isRead: true`) Y un segundo ciclo
    sobre `READ_NOTIFICATIONS_KEY` vía `getReadNotificationIds()` (l.377-385)
    → `readIds.add` → `setItem`.
  - `markAllNotificationsAsRead` (l.432+): misma forma.
- Quién los intercala — `mcm-app/notifications/usePushNotifications.ts`:
  - l.197: el listener de recepción lanza `saveReceivedNotificationLocally(...)`
    sin esperar a nadie.
  - l.286-289: el listener de respuesta encadena
    `saveReceivedNotificationLocally(...).then(() => markNotificationAsRead(...))`.
    Un segundo push que llegue dentro de esa ventana lee el snapshot previo.
- `mcm-app/utils/contigoBookmarks.ts` (subrayados/marcadores de lecturas):
  - `upsertLocalBookmark` (l.83-92), `removeLocalBookmark` (l.95-102) y
    `mergeRemoteBookmarks` (l.108-130): los tres hacen
    `loadLocalBookmarks()` → mutar → `saveLocalBookmarks()` sobre
    `@contigo_bookmarks`. El merge corre al iniciar sesión, concurrente con
    los taps del usuario.

Excerpt del patrón (bookmarks, l.83-92):

```ts
export async function upsertLocalBookmark(
  bookmark: StoredBookmark,
): Promise<StoredBookmark[]> {
  const list = await loadLocalBookmarks();      // ← read
  const next = [bookmark, ...list.filter((b) => b.date !== bookmark.date)].sort(
    (a, b) => b.bookmarkedAt - a.bookmarkedAt,
  );
  await saveLocalBookmarks(next);               // ← write (puede pisar)
  return next;
}
```

- Convenciones: helpers puros en `utils/` con test; logger central; español.

## Commands you will need

| Purpose   | Command (desde `mcm-app/`)       | Expected on success |
|-----------|----------------------------------|---------------------|
| Install   | `npm ci`                         | exit 0              |
| Typecheck | `npm run typecheck` y `npm run typecheck:tests` | exit 0 |
| Tests     | `npm test -- storageMutex`       | all pass            |
| Tests     | `npm test`                       | all pass            |
| Lint      | `npm run lint`                   | exit 0              |

## Scope

**In scope**:

- `mcm-app/utils/storageMutex.ts` (crear)
- `mcm-app/__tests__/storageMutex.test.ts` (crear)
- `mcm-app/services/pushNotificationService.ts` (envolver las 3 funciones)
- `mcm-app/utils/contigoBookmarks.ts` (envolver las 3 funciones)

**Out of scope** (do NOT touch):

- `mcm-app/notifications/usePushNotifications.ts` — los callers no cambian;
  el lock es transparente.
- `mcm-app/hooks/useContigoHabits.ts` / `ContigoHabitsContext` — dominio del
  plan 004 (tiene su propia cola).
- `mcm-app/hooks/useFirebaseData.ts` — sus escrituras son idempotentes por
  diseño (mismo valor, misma clave; documentado en l.61-62); no necesita lock.
- Cualquier otra clave de AsyncStorage no citada: NO hacer pasada global.

## Git workflow

- Branch: la que indique el operador (o `advisor/006-asyncstorage-write-serialization`).
- Estilo: `fix(storage): serializa las escrituras concurrentes de historial, leídas y subrayados`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: `utils/storageMutex.ts`

Crear el helper (≈25 líneas, con comentario en español explicando el porqué):

```ts
const tails = new Map<string, Promise<unknown>>();

/** Serializa por clave: cada `fn` espera a que termine la anterior sobre la
 *  misma clave. Los fallos no rompen la cadena (el tail se resuelve igual). */
export function withStorageLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn); // la anterior falló → esta corre igual
  tails.set(key, run.catch(() => undefined));
  return run;
}
```

**Verify**: `npm run typecheck` → exit 0.

### Step 2: test del mutex

`__tests__/storageMutex.test.ts`:

1. Dos `withStorageLock('k', …)` concurrentes corren en orden (registrar
   marcas de inicio/fin y afirmar que la 2ª empieza tras acabar la 1ª).
2. Claves distintas NO se bloquean entre sí.
3. Un `fn` que rechaza no impide que la siguiente sobre la misma clave corra,
   y el rechazo se propaga a SU caller.

**Verify**: `npm test -- storageMutex` → 3 pass.

### Step 3: envolver los seis call sites

- En `pushNotificationService.ts`: envolver el CUERPO de
  `saveReceivedNotificationLocally`, `markNotificationAsRead` y
  `markAllNotificationsAsRead` en `withStorageLock(NOTIFICATIONS_HISTORY_KEY, …)`.
  Nota: `markNotificationAsRead` toca DOS claves; usar el lock de
  `NOTIFICATIONS_HISTORY_KEY` para toda la función basta (todas las rutas que
  tocan `READ_NOTIFICATIONS_KEY` pasan también por historial en la práctica),
  PERO si `markAllNotificationsAsRead` o algún otro sitio escribe
  `READ_NOTIFICATIONS_KEY` sin pasar por ese lock, anidar
  `withStorageLock(READ_NOTIFICATIONS_KEY, …)` alrededor del segundo ciclo —
  comprobarlo con grep antes de decidir y dejar la decisión comentada.
- En `contigoBookmarks.ts`: envolver `upsertLocalBookmark`,
  `removeLocalBookmark` y `mergeRemoteBookmarks` en
  `withStorageLock(BOOKMARKS_KEY, …)`.
- Las firmas públicas y valores devueltos NO cambian.

**Verify**: `npm run typecheck` → exit 0; `npm test` → suite verde (los tests
existentes de bookmarks/notificaciones, si los hay, sin cambios).

### Step 4: test de concurrencia real sobre un caller

Añadir a un fichero de test nuevo o al del mutex un caso de integración con el
mock de AsyncStorage: disparar `upsertLocalBookmark(A)` y
`upsertLocalBookmark(B)` SIN await entre ellos, esperar ambos, y afirmar que
la lista final contiene A y B (con el código viejo, según el orden de
interleaving, uno puede perderse). Mismo patrón para dos
`saveReceivedNotificationLocally` con notificaciones distintas.

**Verify**: `npm test` → all pass, incluidos los nuevos.

## Test plan

- Los 3 tests del mutex + los 2 de concurrencia de callers (Step 4). El de
  bookmarks debe FALLAR si se quita el `withStorageLock` (comprobarlo
  mentalmente o con una ejecución local revertida).

## Done criteria

- [ ] `npm run typecheck` y `npm run typecheck:tests` exit 0
- [ ] `npm test` exits 0 con ≥5 tests nuevos
- [ ] `grep -c "withStorageLock" mcm-app/services/pushNotificationService.ts` ≥ 3
- [ ] `grep -c "withStorageLock" mcm-app/utils/contigoBookmarks.ts` = 3
- [ ] `git status` limpio fuera del scope
- [ ] `plans/README.md` actualizado
- [ ] Entrada en `mcm-app/CHANGELOG.md`

## STOP conditions

- Los excerpts no coinciden (drift).
- Descubres un tercer módulo con el mismo patrón sobre OTRA clave y la
  tentación de envolverlo: anotarlo en el informe final, no ampliarlo aquí.
- Algún test existente depende del interleaving actual (improbable).
- El mock de AsyncStorage del repo no simula asincronía real (todo resuelto
  síncrono) y el test del Step 4 no puede reproducir el interleaving: dejar
  los tests del mutex + el envoltorio, y reportar que el caso de integración
  no es reproducible en Jest.

## Maintenance notes

- Regla nueva para el futuro (el revisor puede añadirla a
  `mcm-app/CLAUDE.md` §Convenciones si quiere): todo ciclo
  `getItem→mutar→setItem` sobre una clave compartida pasa por
  `withStorageLock`.
- El plan 004 usa su propia cola interna para hábitos; si algún día se
  unifican, `withStorageLock` es el candidato.
- Deferred: `markNotificationAsRead` hace dos escrituras que podrían fundirse
  en una estructura única; no en este plan.
