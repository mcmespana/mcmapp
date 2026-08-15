# Plan 014: Un módulo de escrituras Firebase — las ~11 escrituras de UI ganan retry y una sola forma

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 40c6566..HEAD -- mcm-app/components/AppFeedbackModal.tsx mcm-app/components/ReportBugsModal.tsx mcm-app/components/SuggestSongModal.tsx mcm-app/app/screens/EvaluacionScreen.tsx mcm-app/app/screens/EvaluacionAppScreen.tsx mcm-app/app/screens/SurveyScreen.tsx`
> On a mismatch with the "Current state" excerpts, STOP.

## Status

- **Priority**: P3
- **Effort**: M — mecánico pero con ~9 call sites casi sin cobertura de
  tests; por eso se hace por tandas con smoke por tanda
- **Depends on**: none (compone bien con el plan 006: las escrituras remotas
  no necesitan su lock, pero comparten filosofía de "helpers que encapsulan")
- **Category**: tech-debt
- **Planned at**: commit `40c6566`, 2026-08-05

## Why this matters

Las escrituras a Firebase están repartidas por ~10 archivos de UI, cada uno
repitiendo el ritual completo (`getDatabase(getFirebaseApp())` → `ref` →
`push`/`set`) y re-decidiendo por su cuenta la forma del payload (timestamp
`Date.now()` vs ISO, campos de identidad, manejo de error). Mientras tanto,
`mcm-app/CLAUDE.md` afirma "Único punto de escritura: `ReflexionesScreen`" —
falso, y ES el mapa que leen los agentes: cada escritura nueva se copia del
primer ejemplo que se abre. Coste concreto adicional: `useFirebaseData` ganó
reintentos con backoff (`withRetry`) de los que NINGUNA escritura se
beneficia — una evaluación o un reporte de bug enviados con wifi flojo se
pierden con un toast de error, sin reintento. Este plan crea la costura
(`services/firebaseWrites.ts`), migra los call sites por tandas y corrige el
CLAUDE.md.

## Current state

- Call sites con `getDatabase(getFirebaseApp())` en UI (grep verificado):
  - `components/AppFeedbackModal.tsx:106-120` — feedback (`app/feedback/<cat>`, push+set)
  - `components/ReportBugsModal.tsx:~67` — bugs
  - `components/SuggestSongModal.tsx:~64` — sugerencias de canción
  - `components/SecretPanelModal.tsx:~155,~249` — panel admin (2 usos)
  - `app/screens/EvaluacionScreen.tsx:~62,~95` — evaluación de evento
  - `app/screens/EvaluacionAppScreen.tsx:~55,~79` — evaluación de la app
  - `app/screens/SurveyScreen.tsx:~78,~116` — encuestas
  - `app/screens/SongDetailScreen.tsx:~235,~504` — cantoral (¿lecturas o
    escrituras? VERIFICAR al abrir: si son `get`, quedan fuera)
  - `app/screens/ReflexionesScreen.tsx:~249` — reflexiones (el "único" según
    el doc)
  - `app/screens/WordleScreen.tsx:~287` — **CONGELADO, no tocar** (decisión
    en CLAUDE.md)

Excerpt del patrón repetido (AppFeedbackModal.tsx:106-120):

```ts
const db = getDatabase(getFirebaseApp());
const feedbackRef = ref(db, `app/feedback/${selectedCategory}`);
const newFeedbackRef = push(feedbackRef);
await set(newFeedbackRef, {
  text: feedbackText.trim(),
  timestamp: Date.now(),
  platform: Platform.OS,
  status: 'pending',
  reportedAt: new Date().toISOString(),
  category: selectedCategory,
  userName: profile.name || 'Anónimo',
  userProfileType: profile.profileType ?? 'sin-perfil',
  userDelegation: resolved.delegationLabel || 'Sin delegación',
});
```

- Reutilizables ya existentes:
  - `withRetry` exportado de `hooks/useFirebaseData.ts` (l.70-84; delays 0,4 s
    → 1,2 s). OJO: reintentar un `push`+`set` NO es idempotente si el `push`
    se regenera en cada intento — el helper debe generar la key UNA vez y
    reintentar solo el `set` (eso sí es idempotente: misma key, mismo valor).
  - Patrón de servicio con validación y tests:
    `services/choirSessionService.ts` + su test.
  - La limpieza de `undefined` con `JSON.parse(JSON.stringify(...))` usada en
    `cloudPlaylistService.ts:77`.
- La frase FALSA a corregir: `mcm-app/CLAUDE.md`, sección "Patrón de datos",
  punto 5: "Único punto de escritura: `ReflexionesScreen` (reflexiones)".
- Convenciones: servicios en `services/`, español, logger central, ningún
  archivo nuevo >400 líneas.

## Commands you will need

| Purpose   | Command (desde `mcm-app/`)     | Expected on success |
|-----------|--------------------------------|---------------------|
| Install   | `npm ci`                       | exit 0              |
| Typecheck | `npm run typecheck` + `npm run typecheck:tests` | exit 0 |
| Tests     | `npm test -- firebaseWrites`   | all pass            |
| Tests     | `npm test`                     | all pass            |
| Smoke web | `npm run web` (manual, por tanda) | el formulario migrado envía OK |

## Scope

**In scope**:

- `mcm-app/services/firebaseWrites.ts` (crear)
- `mcm-app/__tests__/firebaseWrites.test.ts` (crear)
- Los call sites listados EXCEPTO WordleScreen (congelado) y SecretPanelModal
  (gigante en PLAN_CALIDAD Fase 1.6 — migrar sus 2 usos SOLO si el cambio es
  de <10 líneas por uso; si exige reordenar el archivo, dejarlo y anotarlo)
- `mcm-app/CLAUDE.md` (solo la frase del "Patrón de datos" §5)

**Out of scope** (do NOT touch):

- `app/screens/WordleScreen.tsx` — congelado por decisión.
- `hooks/useFirebaseData.ts` — solo se IMPORTA `withRetry` (si no está
  exportado con nombre reutilizable, moverlo a un util compartido es
  aceptable como único cambio allí — un `export` más, cero lógica).
- `services/choirSessionService.ts`, `cloudPlaylistService.ts` — ya son
  servicios; no unificarlos aquí.
- Las RUTAS y FORMAS de payload existentes — la migración es de mecanismo,
  no de esquema: cada byte escrito debe quedar igual (el panel los lee).

## Git workflow

- Branch: la que indique el operador (o `advisor/014-firebase-writes-service-seam`).
- **Un commit por tanda** (ver Steps) — si una tanda sale mal, se revierte
  sola. Estilo: `refactor(data): feedback y bugs escriben vía firebaseWrites`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: la costura

`services/firebaseWrites.ts` con dos primitivas y ninguna lógica de dominio:

```ts
/** push+set con retry SEGURO: la key se genera UNA vez, se reintenta solo
 *  el set (idempotente: misma key, mismo valor). */
export async function pushWithRetry(path: string, payload: object): Promise<string>;

/** set con retry sobre una ruta concreta. */
export async function setWithRetry(path: string, payload: object): Promise<void>;
```

Ambas: limpian `undefined` (`JSON.parse(JSON.stringify(...))`), usan
`withRetry`, loggean el fallo final con la ruta (sin el payload — puede
llevar texto del usuario) y relanzan para que el caller pinte su error.

**Verify**: `npm run typecheck` → exit 0.

### Step 2: tests de las primitivas

`__tests__/firebaseWrites.test.ts` (arnés de mocks de
`choirSessionService.test.ts`):

1. `pushWithRetry`: éxito → un solo `push`, un `set`, devuelve la key.
2. `pushWithRetry` con `set` que falla una vez y luego funciona → el `push`
   se llamó UNA vez, el `set` dos (el test que fija la no-regeneración de
   key), con timers falsos para el backoff.
3. Fallo definitivo → relanza tras agotar reintentos.
4. `undefined` en el payload → no llega al `set`.

**Verify**: `npm test -- firebaseWrites` → all pass.

### Step 3: migrar por tandas, con smoke por tanda

Orden (de menos a más delicado), un commit cada una:

- **Tanda 1**: `AppFeedbackModal`, `ReportBugsModal`, `SuggestSongModal` —
  formularios push+set puros. Smoke: enviar un feedback en `npm run web`
  contra el Firebase de dev y verlo llegar (o, sin credenciales, verificar
  con el mock/log que la ruta y el payload son idénticos byte a byte al
  patrón viejo).
- **Tanda 2**: `EvaluacionScreen`, `EvaluacionAppScreen`, `SurveyScreen`.
- **Tanda 3**: `ReflexionesScreen` (respetar su `update()` multi-path si lo
  usa — mirar `utils/reflexiones.ts`: si la escritura ya vive en un util
  testeado, SOLO enrutar su interior por `setWithRetry`/`withRetry` sin
  cambiar la forma) y `SongDetailScreen` (solo si sus 2 usos son escrituras).
- **Tanda 4 (condicional)**: los 2 usos de `SecretPanelModal` si son <10
  líneas cada uno.

En cada archivo migrado: desaparecen los imports de
`getDatabase`/`ref`/`push`/`set` de `firebase/database` (quedan solo los de
lectura si los hay).

**Verify por tanda**: `npm run typecheck` + `npm test` verdes; smoke del
formulario migrado.

### Step 4: corregir el mapa

En `mcm-app/CLAUDE.md`, "Patrón de datos" §5, sustituir "Único punto de
escritura: `ReflexionesScreen` (reflexiones)" por una frase que apunte a la
costura: escrituras de UI vía `services/firebaseWrites.ts` (listar los
dominios: feedback, bugs, sugerencias, evaluaciones, encuestas, reflexiones)
+ los servicios dedicados (coro, playlists, push).

**Verify**: `grep -n "Único punto de escritura" mcm-app/CLAUDE.md` → sin
resultados.

## Test plan

- Los 4 tests del Step 2 (el 2 es el centinela de idempotencia del retry).
- La suite completa tras cada tanda.

## Done criteria

- [ ] `npm run typecheck` + `npm run typecheck:tests` exit 0; `npm test` verde
- [ ] `grep -rln "getDatabase(getFirebaseApp())" mcm-app/app mcm-app/components --include='*.tsx'`
      → solo `WordleScreen.tsx` (congelado), más `SecretPanelModal.tsx` y/o
      `SongDetailScreen.tsx` si quedaron justificadamente fuera (anotado en
      el informe)
- [ ] Las rutas y payloads escritos son idénticos a los previos (revisable
      por diff: solo cambia el mecanismo)
- [ ] La frase falsa de CLAUDE.md ya no existe
- [ ] `plans/README.md` actualizado
- [ ] Entrada en `mcm-app/CHANGELOG.md` (cambio de arquitectura de datos: SÍ)

## STOP conditions

- Los excerpts no coinciden (drift).
- Un call site resulta escribir una FORMA distinta según plataforma o perfil
  que la primitiva no puede expresar sin lógica de dominio → dejar ese sitio
  sin migrar, anotarlo, seguir con el resto.
- `SongDetailScreen` usa transacciones u `onDisconnect` (no visto en el
  audit, pero no se leyó entero) → fuera de la primitiva, reportar.
- Cualquier tentación de "ya que estoy" cambiar un payload o una ruta.

## Maintenance notes

- La costura habilita lo siguiente (fuera de este plan): cola offline de
  escrituras, telemetría de fallos de envío, y las reglas de validación de
  Firebase por ruta (Integración D) tendrán UN lugar donde mirar qué escribe
  la app.
- Revisor: el diff de cada tanda debe ser mecánico — imports fuera,
  primitiva dentro, payload intacto. Cualquier línea de payload cambiada es
  un red flag.
- Si el plan 001 corrió antes, `pushNotificationService` ya no exporta `off`
  — sin relación, pero los diffs de imports pueden rozarse: rebase trivial.
