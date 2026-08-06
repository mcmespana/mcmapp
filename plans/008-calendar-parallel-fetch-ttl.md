# Plan 008: Descargar los ICS en paralelo y no re-descargarlos en cada montaje

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 40c6566..HEAD -- mcm-app/hooks/useCalendarEvents.ts`
> Este archivo lo toca TAMBIÉN el plan 003 — si 003 ya se ejecutó, el drift es
> esperado: releer el archivo entero y localizar los equivalentes de los
> excerpts antes de seguir. Si la ESTRUCTURA (bucle serial + efecto sin TTL)
> ya no existe, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW-MED — hay que preservar dos invariantes: `calendarIndex`
  posicional y la semántica de `anyFailed` (nunca persistir un parcial)
- **Depends on**: **plans/003-calendar-multiday-dst.md** (mismo archivo;
  ejecutar 003 primero para no pisarse)
- **Category**: perf
- **Planned at**: commit `40c6566`, 2026-08-05

## Why this matters

Los calendarios ICS se descargan **en serie** (`await fetch` dentro de un
`for`), y la ruta con proxy paga además un segundo fetch de fallback
secuencial por calendario. El tiempo hasta calendario fresco es la SUMA de
los round-trips en vez del máximo; con el proxy caído, cada calendario paga
dos timeouts seguidos. Y el efecto revalida TODO en cada montaje del hook —
que está montado a la vez en Home y en Calendario — sin ninguna ventana de
frescura: un paseo Home→Calendario→Home re-descarga y re-parsea todos los
ICS. En la wifi saturada de un encuentro (el caso peor declarado del repo),
esto es la diferencia entre ~1 s y ~10 s, repetida en cada navegación.

## Current state

- `mcm-app/hooks/useCalendarEvents.ts` — todo vive aquí.

El bucle serial (l.172-227, dentro de `fetchAndParseCalendars`; ya existe un
coalescer de inflight por lista de URLs en l.158-170 que NO sobrevive a la
resolución):

```ts
const run = async (): Promise<CalendarFetchResult> => {
  const map: Record<string, CalendarEvent[]> = {};
  let anyFailed = false;
  for (let i = 0; i < calendars.length; i++) {
    const cfg = calendars[i];
    try {
      const proxyBase = process.env.EXPO_PUBLIC_CORS_PROXY_URL;
      /* …fetch por proxy con fallback a fetch directo, en serie… */
      const text = await res.text();
      const events = parseICS(text);
      events.forEach((ev) => {
        const withCal: CalendarEvent = { ...ev, calendarIndex: i };  // ← posicional
        /* …expansión al mapa por fecha… */
      });
    } catch (e) {
      anyFailed = true;   // parcial: NO pisar la caché buena (ver efecto)
      logger.error('[calendar] fallo cargando calendario', i, cfg.url, e);
    }
  }
  return { map, anyFailed };
};
```

El efecto (l.244-302) — stale-while-revalidate con AsyncStorage
(`'calendar_events'`), pero SIN ventana de frescura: `load()` corre entero en
cada montaje/cambio de `calendars`. Semántica de persistencia que hay que
preservar tal cual:

```ts
if (!anyFailed) {
  setEventsByDate(map);           // completo → vista + disco
  AsyncStorage.setItem('calendar_events', JSON.stringify(map)).catch(() => {});
} else if (!hadCache) {
  setEventsByDate(map);           // parcial sin caché → vista, NO disco
}
// parcial CON caché: ni vista ni disco
```

- Referencia del patrón "módulo-level, coalescido, con reset para tests":
  este mismo archivo (`calendarInflight` + `__resetCalendarCacheForTests`,
  l.158-163) y `hooks/useFirebaseData.ts` (nodeCache).
- Tests: si el plan 003 se ejecutó ya existe
  `__tests__/useCalendarEvents.test.ts`; si no, crearlo con su arnés.

## Commands you will need

| Purpose   | Command (desde `mcm-app/`)   | Expected on success |
|-----------|------------------------------|---------------------|
| Install   | `npm ci`                     | exit 0              |
| Typecheck | `npm run typecheck` + `npm run typecheck:tests` | exit 0 |
| Tests     | `npm test -- calendar`       | all pass            |
| Tests     | `npm test`                   | all pass            |

## Scope

**In scope**:

- `mcm-app/hooks/useCalendarEvents.ts`
- `mcm-app/__tests__/useCalendarEvents.test.ts` (crear o ampliar)

**Out of scope** (do NOT touch):

- `parseICS` y la expansión multi-día — dominio del plan 003.
- Los consumidores (`calendario.tsx`, `index.tsx`).
- `useCalendarConfigs.ts`.
- El formato de la caché `'calendar_events'` en AsyncStorage.

## Git workflow

- Branch: la que indique el operador (o `advisor/008-calendar-parallel-fetch-ttl`).
- Estilo: `perf(calendario): ICS en paralelo y ventana de frescura de 5 min`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: paralelizar con `Promise.allSettled` preservando el índice

Extraer el cuerpo del `try` del bucle a una función
`fetchOneCalendar(cfg): Promise<CalendarEvent[]>` (descarga con proxy+fallback
+ `parseICS`; SIN tocar el mapa). Después:

```ts
const results = await Promise.allSettled(calendars.map(fetchOneCalendar));
let anyFailed = false;
results.forEach((r, i) => {
  if (r.status === 'fulfilled') {
    r.value.forEach((ev) => {
      const withCal: CalendarEvent = { ...ev, calendarIndex: i };  // índice POSICIONAL intacto
      /* …misma expansión al mapa (la del plan 003 si ya corrió)… */
    });
  } else {
    anyFailed = true;
    logger.error('[calendar] fallo cargando calendario', i, calendars[i].url, r.reason);
  }
});
```

El merge en orden de `results` mantiene además el orden estable de eventos
por calendario dentro de cada fecha.

**Verify**: `npm run typecheck` → exit 0.

### Step 2: ventana de frescura a nivel de módulo

Junto a `calendarInflight`, añadir:

```ts
// Última descarga COMPLETA por lista de URLs. Dentro de la ventana, los
// montajes nuevos sirven caché sin relanzar la descarga (Home→Calendario→Home
// re-descargaba todos los ICS). 5 min: los calendarios cambian a ritmo humano.
const FRESH_WINDOW_MS = 5 * 60 * 1000;
const lastFullFetch = new Map<string, number>(); // key = urls.join('|')
```

En el efecto, tras servir la caché de AsyncStorage y confirmar red: si
`Date.now() - (lastFullFetch.get(key) ?? 0) < FRESH_WINDOW_MS`, terminar ahí
(la caché ya está pintada). Registrar `lastFullFetch.set(key, Date.now())`
SOLO cuando `!anyFailed` (un parcial no cuenta como fresco). Ampliar
`__resetCalendarCacheForTests()` para limpiar también este mapa.

**Verify**: `npm run typecheck` → exit 0.

### Step 3: tests

Con fetch mockeado (arnés del fichero de tests del calendario):

1. Dos calendarios: ambos fetch se INICIAN antes de que resuelva el primero
   (mock con resolvers manuales → afirmar que ambos fueron llamados antes de
   liberar ninguno).
2. Falla el calendario 0, funciona el 1 → `anyFailed=true`, los eventos del 1
   llevan `calendarIndex: 1` (no 0 — el test que protege el índice posicional).
3. Descarga completa → segundo montaje dentro de la ventana NO llama a fetch;
   tras `__resetCalendarCacheForTests()` sí.
4. Descarga parcial → NO registra frescura (el siguiente montaje sí relanza).

**Verify**: `npm test -- calendar` → all pass.

## Test plan

- Los 4 casos del Step 3; el 2 es el centinela del invariante
  `calendarIndex`, el 4 el de `anyFailed`.
- `npm test` completo verde.

## Done criteria

- [ ] `npm run typecheck` + `npm run typecheck:tests` exit 0
- [ ] `npm test` exits 0 con los 4 tests nuevos
- [ ] `grep -n "for (let i = 0; i < calendars.length" mcm-app/hooks/useCalendarEvents.ts`
      → sin resultados (el bucle serial ya no existe)
- [ ] `grep -c "allSettled" mcm-app/hooks/useCalendarEvents.ts` ≥ 1
- [ ] La semántica de persistencia (completo→disco, parcial→según caché) está
      intacta — revisable en el diff: el bloque del efecto l.283-296 no cambia
- [ ] `git status` limpio fuera del scope
- [ ] `plans/README.md` actualizado
- [ ] Entrada en `mcm-app/CHANGELOG.md`

## STOP conditions

- El plan 003 está IN PROGRESS en otra rama (coordinar antes de tocar el
  mismo archivo).
- La estructura del archivo difiere tanto de los excerpts que los "equivalentes"
  no son identificables.
- Los tests del punto 1 no pueden expresarse con el mock de fetch disponible.

## Maintenance notes

- Si los calendarios crecen (>6-8 feeds), valorar limitar la concurrencia
  (chunks de 4); hoy no hace falta.
- El pull-to-refresh manual (si existe en calendario) debe saltarse la
  ventana: comprobar si `calendario.tsx` expone refresh; si lo hace y pasa
  por este hook, exponer un `force` — SOLO si ya existe ese camino, no
  inventarlo.
- Revisor: vigilar que `lastFullFetch` no se registre en resultados parciales.
