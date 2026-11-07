# Plan 004: Un solo dueño para los hábitos de Contigo — las 4 pantallas dejan de pisarse

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 40c6566..HEAD -- mcm-app/hooks/useContigoHabits.ts "mcm-app/app/(tabs)/contigo/"`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2 (pérdida de datos de usuario real, pero requiere cuidado)
- **Effort**: M
- **Risk**: MED — persistencia de datos existentes; NO cambiar el formato de
  almacenamiento, solo QUIÉN escribe
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `40c6566`, 2026-08-05

## Why this matters

`useContigoHabits` guarda TODO el mapa de hábitos (`Record<fecha, DayRecord>`)
desde el estado de CADA instancia del hook, y hay **cuatro instancias vivas** a
la vez en el stack de Contigo (index, evangelio, oración, revisión). Cada
`setReadingDone`/`setPrayerDone`/`setRevisionDone` construye
`{...records, [date]: …}` sobre el `records` **cerrado en el closure de esa
instancia** y lo escribe entero en AsyncStorage. Secuencia real: marcas el
evangelio leído en `evangelio`, luego completas la revisión en `revision` sin
que esa pantalla se haya remontado — la instancia de `revision` escribe SU mapa
(que no vio el cambio) y el `readingDone` desaparece del disco, llevándose la
racha y los contadores. El re-sync remoto tampoco salva: `syncContigoHabit`
solo sube la fecha cambiada. El usuario ve des-completarse un hábito que
completó, en silencio. La solución: un único dueño del mapa (provider) del que
las cuatro pantallas consumen.

## Current state

- `mcm-app/hooks/useContigoHabits.ts` (~200 líneas) — hook con estado propio
  por instancia. Piezas clave:

Estado e hidratación (líneas 28-84): `useState<Record<string, DayRecord>>({})`,
efecto que carga de AsyncStorage (`STORAGE_KEY = '@contigo_habits'`) y, con
sesión, fusiona con RTDB vía `mergeContigoHabits` y re-sube `datesToResync`.

Escritura (líneas 89-156) — el patrón del bug:

```ts
const saveRecords = async (newRecords, changedDate?) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newRecords));  // mapa ENTERO
  setRecords(newRecords);
  if (authUser && changedDate && newRecords[changedDate]) {
    syncContigoHabit(authUser.uid, changedDate, newRecords[changedDate]);
  }
};

const setReadingDone = async (date, done) => {
  const record = ensureRecord(date);
  const newRecords = {
    ...records,                                   // ← records del CLOSURE (stale)
    [date]: { ...record, readingDone: done, timestamp: Date.now() },
  };
  await saveRecords(newRecords, date);
};
// setPrayerDone y setRevisionDone: misma forma
```

- Los 4 puntos de montaje (verificados por grep):
  - `mcm-app/app/(tabs)/contigo/index.tsx:57`
  - `mcm-app/app/(tabs)/contigo/evangelio.tsx:131`
  - `mcm-app/app/(tabs)/contigo/oracion.tsx:235`
  - `mcm-app/app/(tabs)/contigo/revision.tsx:89`
- El repo YA tiene el patrón provider+hook para exactamente esto:
  `mcm-app/contexts/` contiene 16 contexts; usar como ejemplar
  `contexts/SelectedSongsContext.tsx` (estado compartido con acciones,
  consumido por hook) y la pirámide de providers de `app/_layout.tsx`.
  **PERO**: este provider debe montarse en el layout de Contigo, no en el
  root — buscar `app/(tabs)/contigo/_layout.tsx`; si existe, envolver ahí;
  si no existe, STOP condition (ver abajo).
- Helpers ya testeados que NO cambian: `utils/contigoMerge.ts`
  (`mergeContigoHabits`, con test), `utils/authHelpers.ts`
  (`syncContigoHabit`/`fetchContigoHabits`, con test), `utils/localDate.ts`.
- Convenciones: comentarios en español, logger central, imports `@/`, ningún
  archivo nuevo >400 líneas, tests de comportamiento (no snapshots).

## Commands you will need

| Purpose   | Command (desde `mcm-app/`)     | Expected on success |
|-----------|--------------------------------|---------------------|
| Install   | `npm ci`                       | exit 0              |
| Typecheck | `npx tsc --noEmit`             | exit 0              |
| Tests     | `npm test -- contigo`          | all pass            |
| Tests     | `npm test`                     | all pass            |
| Lint      | `npm run lint`                 | exit 0              |

## Scope

**In scope**:

- `mcm-app/hooks/useContigoHabits.ts` (se convierte en fachada del context, o
  se traslada su cuerpo al provider)
- `mcm-app/contexts/ContigoHabitsContext.tsx` (crear)
- `mcm-app/app/(tabs)/contigo/_layout.tsx` (montar el provider)
- Los 4 archivos de pantalla SOLO si la firma del hook cambia (objetivo:
  que NO cambie — mismos nombres devueltos)
- `mcm-app/__tests__/contigoHabitsContext.test.ts` (crear)

**Out of scope** (do NOT touch):

- `utils/contigoMerge.ts`, `utils/authHelpers.ts` — lógica pura ya testeada.
- El FORMATO de `@contigo_habits` en AsyncStorage — ni una clave más ni menos
  (los datos existentes de los usuarios deben leerse tal cual).
- `utils/contigoBookmarks.ts` (subrayados) — otro dominio, otro hallazgo
  ([BUG-02]).
- `components/contigo/HomeWidgets.tsx` — gigante planificado en PLAN_CALIDAD;
  si consume el hook, debe seguir funcionando sin ediciones.
- Las pantallas gigantes de Contigo más allá de la línea del hook.

## Git workflow

- Branch: la que indique el operador (o `advisor/004-contigo-habits-single-writer`).
- Estilo: `fix(contigo): un solo dueño del mapa de hábitos — las pantallas dejaban de verse entre sí`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: crear `ContigoHabitsContext` moviendo el cuerpo del hook

Crear `mcm-app/contexts/ContigoHabitsContext.tsx`:

- `ContigoHabitsProvider` contiene TODO el cuerpo actual de
  `useContigoHabits` (estado, hidratación local+remota del efecto,
  `saveRecords`, getters y setters) — mover, no reescribir.
- Dos cambios de robustez al mover (los únicos):
  1. Los setters usan **updater funcional** en vez del closure:
     `setRecords(prev => …)` y la escritura a AsyncStorage sale del valor
     `prev` actualizado. Patrón:

     ```ts
     const setReadingDone = (date: string, done: boolean) =>
       mutateRecords(date, (rec) => ({ ...rec, readingDone: done, timestamp: Date.now() }));

     // mutateRecords centraliza: setRecords(prev => next) + persistencia + sync
     ```

  2. La persistencia se **serializa** con una cola de promesas interna
     (`queueRef.current = queueRef.current.then(write)`) para que dos taps
     rápidos no intercalen sus `setItem`.
- El value del context expone EXACTAMENTE la API pública actual del hook
  (mirar qué desestructuran las 4 pantallas: `todayStr`, `getRecord`,
  `ensureRecord`, `setReadingDone`, `setPrayerDone`, `setRevisionDone`,
  `isRevisionDone`, `reloadRecords`, `isLoading`, `records`, etc. — copiar la
  lista real del hook, no esta).

**Verify**: `npx tsc --noEmit` → exit 0 (el archivo nuevo compila; nada lo usa
aún).

### Step 2: `useContigoHabits` pasa a ser la fachada

Reescribir `mcm-app/hooks/useContigoHabits.ts` como:

```ts
export function useContigoHabits() {
  const ctx = useContext(ContigoHabitsContext);
  if (!ctx) throw new Error('useContigoHabits necesita ContigoHabitsProvider');
  return ctx;
}
```

re-exportando los tipos (`DayRecord`, `PrayerDuration`, `Emotion`) desde donde
vivan ahora (moverlos al context o dejarlos en el hook — pero que los imports
existentes `from '@/hooks/useContigoHabits'` sigan compilando sin tocar a los
consumidores).

**Verify**: `npx tsc --noEmit` → exit 0. Si algún consumidor rompe, la API del
value no replica la del hook — corregir el value, no el consumidor.

### Step 3: montar el provider en el layout de Contigo

En `mcm-app/app/(tabs)/contigo/_layout.tsx`, envolver el árbol con
`<ContigoHabitsProvider>`. Comprobar también con
`grep -rn "useContigoHabits(" mcm-app/app mcm-app/components mcm-app/hooks`
si hay consumidores FUERA de `(tabs)/contigo/` (p. ej. widgets de la Home);
si los hay, el provider debe subir al ancestro común mínimo (probablemente
`app/(tabs)/_layout.tsx`) — anotar dónde quedó y por qué.

**Verify**: `npx tsc --noEmit` + `npm run lint` → exit 0.

### Step 4: test del bug original

`mcm-app/__tests__/contigoHabitsContext.test.ts` con `renderHook` (patrón de
`__tests__/useSongProcessor.test.ts`, que ya usa renderHook con providers):

1. **El caso del bug**: un solo provider, dos componentes consumidores; el
   consumidor A llama `setReadingDone(hoy, true)`; el consumidor B llama
   `setRevisionDone(hoy, true)`; afirmar que el registro final en
   AsyncStorage (mock) tiene AMBOS flags a true.
2. Dos llamadas rápidas seguidas desde el mismo consumidor → ambas persisten.
3. La hidratación inicial lee `@contigo_habits` con el formato actual (fixture
   con un par de fechas) y `getRecord` las devuelve tal cual.

**Verify**: `npm test -- contigo` → all pass, incluidos los 3 nuevos.

## Test plan

- Los 3 casos del Step 4 (el nº 1 DEBE fallar contra el código viejo — es el
  test de regresión del bug).
- `npm test` completo verde: los tests existentes de `contigoMerge` y
  `authHelpers` no deben requerir ningún cambio (si lo requieren, algo se
  tocó fuera de scope).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc --noEmit` y `npm run typecheck:tests` exit 0
- [ ] `npm test` exits 0 con los 3 tests nuevos
- [ ] `grep -c "useState<Record<string, DayRecord>>" mcm-app/hooks/useContigoHabits.ts` → 0
      (el hook ya no tiene estado propio)
- [ ] `grep -rn "ContigoHabitsProvider" mcm-app/app/` → exactamente un punto de montaje
- [ ] Las 4 pantallas de Contigo no aparecen en `git diff --name-only` (o solo
      con cambios de import si fue imprescindible — justificarlo en el commit)
- [ ] El formato de `@contigo_habits` no cambió (el fixture del test 3 lo fija)
- [ ] `plans/README.md` actualizado
- [ ] Entrada en `mcm-app/CHANGELOG.md` (fix de pérdida de datos: SÍ)

## STOP conditions

Stop and report back (do not improvise) if:

- No existe `app/(tabs)/contigo/_layout.tsx` ni un ancestro claro donde montar
  el provider — la estructura de rutas difiere de la asumida.
- Hay consumidores de `useContigoHabits` fuera de Contigo Y fuera de
  `(tabs)` (p. ej. en el root o en onboarding): el ancestro común sería el
  root layout y eso cambia el coste/riesgo del plan.
- El test 1 del Step 4 PASA contra el código viejo (entonces el diagnóstico
  del plan está mal y hay que re-evaluar, no seguir).
- Cualquier pantalla de Contigo necesita ediciones más allá de imports.

## Maintenance notes

- Con un solo dueño, `reloadRecords()` (el reload manual al enfocar) puede
  quedar obsoleto — NO quitarlo en este plan; anotar como follow-up.
- El Widget de Contigo planificado (`docs/planes/PLAN_WIDGET_CONTIGO.md`,
  build 2.2) leerá este mismo estado vía App Group: este provider es el punto
  natural donde engancharlo — quien lo implemente debe pasar por aquí.
- Revisor: vigilar que la cola de persistencia no reordene escrituras
  (`then`-chain, no `Promise.all`) y que el efecto de hidratación siga
  fusionando con remoto UNA vez por sesión de auth, no por pantalla (eso es
  ya una mejora colateral: antes se hacía 4 veces).
- Relacionado, fuera de scope: el mismo patrón read-modify-write sin lock en
  bookmarks y notificaciones ([BUG-02]).
