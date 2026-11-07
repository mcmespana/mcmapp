# Plan 010: Virtualizar el muro de "Compartiendo" — hoy monta todas las reflexiones a la vez

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 40c6566..HEAD -- mcm-app/app/screens/ReflexionesScreen.tsx`
> On a mismatch with the "Current state" excerpts, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW — el único punto delicado es el layout del hero y el padding
  inferior, que migran a props del FlatList
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `40c6566`, 2026-08-05

## Why this matters

El muro de reflexiones ("Compartiendo") es un `ScrollView` cuyo cuerpo es
`sortedList.map(...)`: cada reflexión jamás publicada se monta y se
re-renderiza entera al entrar y en cada re-render de la pantalla. La lista es
de contenido generado por usuarios y sin límite — es además la única pantalla
de escritura de la app, así que crece durante todo un encuentro. En un Android
modesto con unos cientos de entradas, eso es un tirón visible al entrar al
tab. `FlatList` (que el repo ya usa con tuning en `GruposScreen`) reduce el
coste a las filas visibles. Nota: el TODO.md ya registra "valorar Firestore
para `compartiendo` (paginación)" — esa es la decisión de BACKEND; esto es el
arreglo de cliente, un orden de magnitud más barato y útil gane quien gane.

## Current state

- `mcm-app/app/screens/ReflexionesScreen.tsx` (~560 líneas) — lectura +
  escritura de `jubileo/compartiendo`. La zona a cambiar (l.320-421,
  abreviada):

```tsx
<View style={styles.container}>
  <ScreenHero
    title="Compartiendo"
    subtitle="Comparte aquí una frase, pensamiento o algo que te llevas de estos días"
    floatingHeaderInset
  />
  <PageContainer>
    <ScrollView
      contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
    >
      {sortedList.length === 0 ? (
        <EmptyState icon="auto-stories" title="Aún no hay reflexiones" … />
      ) : (
        sortedList.map((r, i) => {
          const color = pickCardColor(r.id);
          const filled = i % 2 === 0;      // ← diseño alterno usa el índice
          /* …<LongPressable key={r.id} onLongPress={…}> tarjeta entera… */
        })
      )}
    </ScrollView>
  </PageContainer>
  {/* Form bottom sheet debajo */}
</View>
```

- **Ejemplar de FlatList tuneado en el repo**: `app/screens/GruposScreen.tsx`
  (~l.513-515) usa `initialNumToRender`/`windowSize` — copiar esos valores.
- **Ejemplar de EmptyState como parte de lista**: mantener el mismo
  `EmptyState` (componente unificado de UI Nativa Fase 2) vía
  `ListEmptyComponent`.
- La pantalla NO es uno de los gigantes de PLAN_CALIDAD Fase 1 — no hay
  conflicto de planes.
- Convenciones: `keyExtractor` por `r.id` (hoy es la `key`), estilos al final
  del archivo, español.

## Commands you will need

| Purpose   | Command (desde `mcm-app/`)   | Expected on success |
|-----------|------------------------------|---------------------|
| Install   | `npm ci`                     | exit 0              |
| Typecheck | `npm run typecheck`          | exit 0              |
| Tests     | `npm test`                   | all pass            |
| Lint      | `npm run lint`               | exit 0              |
| Smoke web | `npm run web` (manual)       | muro pinta, long-press abre menú, alternancia visual intacta |

## Scope

**In scope**:

- `mcm-app/app/screens/ReflexionesScreen.tsx`

**Out of scope** (do NOT touch):

- La escritura a Firebase de esta pantalla (l.~249) — dominio del plan 014.
- `components/ui/EmptyState`, `ScreenHero`, `PageContainer`.
- Cualquier paginación de datos (eso es la decisión Firestore del TODO).

## Git workflow

- Branch: la que indique el operador (o `advisor/010-reflexiones-flatlist`).
- Estilo: `perf(compartiendo): el muro virtualiza con FlatList`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: extraer la tarjeta a `renderItem`

Mover el cuerpo del `.map` a una función `renderReflexion({ item, index })`
(module-level o `useCallback`, con las dependencias que capture: `scheme`,
`setMenuReflexion`, helpers puros). El diseño alterno usa `index`
(`filled = index % 2 === 0`) — disponible en `renderItem`, no cambia.

**Verify**: `npm run typecheck` → exit 0.

### Step 2: sustituir ScrollView por FlatList

```tsx
<FlatList
  data={sortedList}
  keyExtractor={(r) => r.id}
  renderItem={renderReflexion}
  contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
  ListEmptyComponent={
    <EmptyState icon="auto-stories" title="Aún no hay reflexiones" … />
  }
  initialNumToRender={/* copiar de GruposScreen */}
  windowSize={/* copiar de GruposScreen */}
/>
```

Decisión de layout: `ScreenHero` está HOY fuera del ScrollView (hermano
anterior) — **dejarlo fuera del FlatList también** (no moverlo a
`ListHeaderComponent`): así el cambio no altera el comportamiento de scroll
del hero. Si el hero estuviera dentro del scroller en el código real (drift),
entonces sí `ListHeaderComponent`.

Comprobar si la pantalla engancha `useTabScroll`/`useTabListScroll` (barra
flotante): si el ScrollView llevaba `onScroll`/props de la barra, migrarlas
al FlatList tal cual (ver `components/tabs/useTabScroll.ts` y su uso en otra
pantalla de lista como referencia).

**Verify**: `npm run typecheck` + `npm run lint` → exit 0; `npm test` verde.

### Step 3: smoke manual

`npm run web`: (a) el muro pinta con la alternancia tintada/barra-lateral
intacta; (b) long-press sobre una tarjeta abre el menú contextual; (c) el
estado vacío se ve si no hay datos (forzarlo temporalmente si hace falta, sin
commitear el cambio); (d) el final de la lista no queda bajo la tab bar.

**Verify**: las 4 observaciones anotadas en el informe final.

## Test plan

- Sin render tests nuevos (decisión registrada en TODO.md — no duplicar aquí).
  Verificación = typecheck + suite + smoke.

## Done criteria

- [ ] `npm run typecheck`, `npm run lint` exit 0; `npm test` verde
- [ ] `grep -n "<ScrollView" mcm-app/app/screens/ReflexionesScreen.tsx` → sin
      resultados en la zona del muro (puede quedar alguno en el bottom sheet
      del formulario — solo el muro cuenta)
- [ ] `grep -c "FlatList" mcm-app/app/screens/ReflexionesScreen.tsx` ≥ 1 con
      `keyExtractor` e `initialNumToRender`
- [ ] `git status` limpio fuera del archivo
- [ ] `plans/README.md` actualizado
- [ ] Sin CHANGELOG (refactor de render sin cambio funcional)

## STOP conditions

- Los excerpts no coinciden (drift).
- La pantalla usa el scroller para algo más que el muro (p. ej. el formulario
  vive DENTRO del ScrollView) — el intercambio ya no es local y hay que
  re-plantear.
- La barra flotante exige un scroller concreto que FlatList no satisface con
  las mismas props (improbable: FlatList ES un ScrollView por debajo).

## Maintenance notes

- Si el dataset crece de verdad (cientos de entradas por evento), el
  siguiente paso es paginar la CARGA (la decisión Firestore/RTDB del
  TODO.md) — este plan solo arregla el render.
- Revisor: comparar visualmente par/impar antes y después (el índice ahora
  viene de `renderItem`; un off-by-one invertiría el diseño alterno).
