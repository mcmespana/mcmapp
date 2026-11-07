# Plan 007: `useFirebaseData` — no re-ejecutar el `transform` ni estrenar identidad cuando nada cambió

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 40c6566..HEAD -- mcm-app/hooks/useFirebaseData.ts mcm-app/__tests__/useFirebaseData.test.ts`
> On a mismatch with the "Current state" excerpts, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW — toca el hook central de datos, pero el cambio es un memo
  puro con test; el comportamiento visible no debe cambiar en nada
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `40c6566`, 2026-08-05

## Why this matters

Tras la fase remota, el hook relee la caché de módulo y aplica el `transform`
**incondicionalmente**, aunque `refreshRemote` haya salido por la vía rápida
de "el `updatedAt` remoto es igual al local" y `parsed` sea el MISMO objeto.
Como el transform crea un objeto nuevo, `setData` recibe una identidad nueva
para datos idénticos: React re-renderiza, y todos los `useMemo` aguas abajo
recomputan. En el cantoral —la familia de pantallas más usada— hay 3
consumidores vivos del nodo `songs` a la vez y dos de ellos pasan
`filterSongsData` (que copia todas las categorías y filtra todas las
canciones): cada ciclo de navegación paga ~6 pasadas por el corpus entero y
un re-render de listas ya pintadas, para cero cambio visible.

## Current state

- `mcm-app/hooks/useFirebaseData.ts` — hook central de datos (caché módulo +
  AsyncStorage + refresh coalescido con retry). Piezas:

Caché de módulo (l.24-31) — guarda lo CRUDO a propósito (dos consumidores del
mismo path pueden tener transforms distintos; comentario en l.14-20):

```ts
type CacheEntry = {
  parsed: unknown; // JSON.parse de `_data`, SIN transform
  updatedAt: string | null;
  hidden: boolean;
  inflight: Promise<void> | null;
};
const nodeCache = new Map<string, CacheEntry>();
```

El efecto (l.186-264, resumido) — `applyParsed` transforma y setea, y se llama
DOS veces: al servir caché (l.213 o l.237) y de nuevo tras el refresh (l.257),
sin comparar si `parsed` cambió:

```ts
const applyParsed = (parsed: unknown, isHidden: boolean) => {
  if (parsed === undefined) return;
  const transformed = transform ? transform(parsed) : (parsed as T);
  if (isMounted) {
    setData(transformed);        // ← identidad nueva SIEMPRE que hay transform
    setHidden(isHidden);
  }
};
/* …fase caché: applyParsed(cached.parsed, …) … */
await refreshRemote(path, storageKey, hasLocalCache, localUpdatedAt);
const fresh = nodeCache.get(storageKey);
if (fresh) applyParsed(fresh.parsed, fresh.hidden);   // ← incondicional
```

- `refreshRemote` (l.90-168) sale temprano sin tocar `parsed` cuando
  `localUpdatedAt === remoteUpdatedAt` (la vía común en el día a día).
- Consumidores calientes con transform: `app/screens/CategoriesScreen.tsx:82-85`
  y `app/screens/SongListScreen.tsx:193-199` (ambos `filterSongsData`),
  `app/screens/SelectedSongsScreen.tsx:245-247` (tercera instancia del nodo).
- Ya existe `mcm-app/__tests__/useFirebaseData.test.ts` con
  `__resetNodeCacheForTests()` — usar ese fichero y su arnés.
- Convenciones: comentarios en español explicando el PORQUÉ (el archivo está
  lleno de ellos — imitar el tono), logger central.

## Commands you will need

| Purpose   | Command (desde `mcm-app/`)        | Expected on success |
|-----------|-----------------------------------|---------------------|
| Install   | `npm ci`                          | exit 0              |
| Typecheck | `npm run typecheck` + `npm run typecheck:tests` | exit 0 |
| Tests     | `npm test -- useFirebaseData`     | all pass            |
| Tests     | `npm test`                        | all pass            |

## Scope

**In scope**:

- `mcm-app/hooks/useFirebaseData.ts`
- `mcm-app/__tests__/useFirebaseData.test.ts` (ampliar)

**Out of scope** (do NOT touch):

- Los consumidores (`CategoriesScreen`, `SongListScreen`,
  `SelectedSongsScreen`) — no deben notar nada.
- `withRetry`, `refreshRemote` y el manejo de `inflight` — auditados y
  correctos; no "mejorarlos" de paso.
- `utils/filterSongsData.ts` — el transform en sí no cambia.

## Git workflow

- Branch: la que indique el operador (o `advisor/007-usefirebasedata-transform-memo`).
- Estilo: `perf(data): useFirebaseData deja de re-transformar y re-renderizar sin cambios`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: memo del transform por instancia

Dentro del efecto (o con un `useRef` a nivel de hook), guardar el último par
`(src, out)` aplicado por ESTA instancia:

```ts
// Última aplicación del transform de ESTA instancia: si el crudo no cambió
// de identidad, reutilizamos el resultado para no estrenar objeto (evita
// re-renders y recomputar useMemo aguas abajo sin ningún cambio real).
const lastApplied = useRef<{ src: unknown; out: T } | null>(null);

const applyParsed = (parsed: unknown, isHidden: boolean) => {
  if (parsed === undefined) return;
  let transformed: T;
  if (lastApplied.current && lastApplied.current.src === parsed) {
    transformed = lastApplied.current.out;
  } else {
    transformed = transform ? transform(parsed) : (parsed as T);
    lastApplied.current = { src: parsed, out: transformed };
  }
  if (isMounted) {
    setData(transformed);
    setHidden(isHidden);
  }
};
```

Con esto, la segunda llamada post-refresh con el mismo `parsed` entrega la
MISMA identidad → `setData` con valor idéntico → React se salta el re-render.
No hace falta condicionar la llamada de l.257: el memo la vuelve inocua.

Nota: el memo es POR INSTANCIA (useRef), no en `nodeCache` — respeta el
diseño documentado en l.14-20 (transforms distintos por consumidor). No
meter el resultado transformado en la caché de módulo.

**Verify**: `npm run typecheck` → exit 0.

### Step 2: tests

En `__tests__/useFirebaseData.test.ts` (con su arnés existente):

1. **Identidad estable**: transform espía (`jest.fn` que envuelve un filtro);
   montar el hook, dejar que sirva caché y complete el refresh con
   `updatedAt` igual → el transform se llamó UNA vez y `result.current.data`
   mantiene la misma referencia entre ambas fases
   (capturarla tras la primera y comparar con `toBe`).
2. **Datos nuevos → transform nuevo**: refresh que SÍ trae `updatedAt`
   distinto y data nueva → el transform se llama de nuevo y la referencia
   cambia.
3. **Sin transform**: path sin transform sigue funcionando (data = crudo).

**Verify**: `npm test -- useFirebaseData` → all pass, incluidos los 3.

## Test plan

- Los 3 casos del Step 2; el 1 debe FALLAR contra el código actual (dos
  llamadas al transform y referencia nueva) — es el test de regresión.
- `npm test` completo verde.

## Done criteria

- [ ] `npm run typecheck` + `npm run typecheck:tests` exit 0
- [ ] `npm test` exits 0; el test de identidad estable existe y pasa
- [ ] El diff de `useFirebaseData.ts` toca SOLO `applyParsed` y el ref nuevo
      (revisable con `git diff`)
- [ ] `git status` limpio fuera del scope
- [ ] `plans/README.md` actualizado
- [ ] Entrada en `mcm-app/CHANGELOG.md` (afecta al comportamiento de datos
      del hook central: SÍ, breve)

## STOP conditions

- Los excerpts no coinciden (drift).
- El test 1 PASA contra el código viejo (diagnóstico equivocado → re-evaluar).
- Algún consumidor depende de recibir identidad nueva en cada refresh (se
  manifestaría como un test de pantalla roto o un efecto que deja de
  dispararse) → parar y reportar cuál.

## Maintenance notes

- Si algún día el transform deja de ser estable entre renders (una arrow
  function inline con closure cambiante), el memo por `src` seguiría siendo
  correcto pero escondería el transform nuevo hasta que cambien los datos.
  Convención implícita actual: los transforms son funciones module-level
  (`filterSongsData`) — mantenerla.
- Revisor: comprobar con React DevTools (o un console.count temporal en
  desarrollo) que Categories/SongList ya no re-renderizan tras el refresh
  sin cambios.
