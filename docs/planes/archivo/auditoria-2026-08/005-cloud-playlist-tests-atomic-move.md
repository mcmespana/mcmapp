# Plan 005: Tests para `cloudPlaylistService` y mover playlist con `update()` atómico

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 40c6566..HEAD -- mcm-app/services/cloudPlaylistService.ts mcm-app/__tests__/choirSessionService.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (tests) / LOW-MED (el `update()` atómico — cambio de escritura
  pequeño y bien delimitado)
- **Depends on**: none (comparte patrón de mocks con el plan 001; si ambos se
  ejecutan, coordinar el fichero `__tests__/choirSessionService.test.ts` que
  001 también amplía — no hay conflicto de contenido, solo de merge)
- **Category**: tests
- **Planned at**: commit `40c6566`, 2026-08-05

## Why this matters

`cloudPlaylistService` es **el único sitio de la app donde se BORRAN datos de
usuario en la nube** (playlists compartidas bajo código de 4 dígitos): borrado
perezoso de caducadas en `fetchCloudPlaylist`, `deleteCloudPlaylist`, y el
movimiento de código que hace subir-luego-borrar en dos pasos no atómicos. No
tiene NI UN test — mientras su gemelo estructural `choirSessionService` (mismo
patrón, mismo RTDB mockeado) tiene 16. Una regresión en la comparación de
caducidad (`Date.now() > val.expiresAt`) destruiría silenciosamente todas las
playlists compartidas y nadie lo sabría hasta las quejas. Además, si el borrado
del paso 2 del movimiento falla, quedan dos copias vivas; peor, un fallo a
medias deja estados intermedios. Este plan clona la cobertura del gemelo y
convierte el movimiento en un `update()` multi-path atómico — patrón que el
repo ya usa.

## Current state

- `mcm-app/services/cloudPlaylistService.ts` (112 líneas) — completo, es
  corto. Piezas clave:

```ts
const ROOT = 'playlistShares';
const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6;

// fetchCloudPlaylist (l.41-57): borrado perezoso
if (val.expiresAt && Date.now() > val.expiresAt) {
  try {
    await remove(getRef(code));
  } catch {
    // ignore
  }
  return null;
}
return val;

// changeCloudPlaylistCode (l.91-111): dos pasos NO atómicos
const moved = await uploadCloudPlaylist(newCode, cur.songs, {
  name: cur.name,
  createdAt: cur.createdAt,
});
await deleteCloudPlaylist(oldCode);   // ← si esto falla: playlist duplicada
return moved;
```

- Validación de código en `getRef` vía `isValidCode` de
  `mcm-app/utils/playlistCodes.ts` (lanza con mensaje
  `Código inválido (deben ser ${CODE_LENGTH} dígitos)`).
- `uploadCloudPlaylist` (l.63-80) limpia `undefined` con
  `JSON.parse(JSON.stringify(payload))` antes de `set`.
- **Ejemplar a imitar**: `mcm-app/__tests__/choirSessionService.test.ts` — 16
  tests sobre el mismo SDK mockeado (`firebase/database`), cubre validación de
  código, forma del payload, expiración, limpieza de `undefined` y el cambio
  de código con sus errores. Copiar su arnés de mocks tal cual.
- **Ejemplar del `update()` multi-path atómico**: `choirSessionService.ts`
  usa `update(getRef(code), {...})` con claves con `/` (l.147-153:
  `'master/lastSeen': now`); y el patrón multi-nodo raíz existe en
  `utils/reflexiones.ts`. En RTDB, un `update(ref(db), { 'a/b': valor,
  'c/d': null })` escribe y borra en UNA operación atómica.
- Convenciones: tests en español, describe por función; comentarios español;
  `@/` imports.

## Commands you will need

| Purpose   | Command (desde `mcm-app/`)          | Expected on success |
|-----------|-------------------------------------|---------------------|
| Install   | `npm ci`                            | exit 0              |
| Typecheck | `npm run typecheck:tests`           | exit 0              |
| Tests     | `npm test -- cloudPlaylist`         | all pass            |
| Tests     | `npm test`                          | all pass            |
| Lint      | `npm run lint`                      | exit 0              |

## Scope

**In scope**:

- `mcm-app/__tests__/cloudPlaylistService.test.ts` (crear)
- `mcm-app/services/cloudPlaylistService.ts` (solo `changeCloudPlaylistCode` →
  `update()` atómico; el resto NO se toca)

**Out of scope** (do NOT touch):

- `mcm-app/services/choirSessionService.ts` y su test (dominio del plan 001).
- `mcm-app/utils/playlistCodes.ts` — ya testeado.
- Los consumidores (`SelectedSongsScreen` y modales de playlist) — la firma
  pública del servicio no cambia.
- Las reglas de Firebase (`database.rules.json`) — que el nodo
  `playlistShares` sea abierto es deliberado (lo documenta la cabecera del
  propio servicio, `cloudPlaylistService.ts:1-8`: "Sin permisos: cualquiera
  con el código puede leerla, sobrescribirla o borrarla"); cualquier
  inquietud ahí pertenece a la Integración D, NO a este plan.

## Git workflow

- Branch: la que indique el operador (o `advisor/005-cloud-playlist-tests`).
- Estilo: `test(playlist): cubre cloudPlaylistService y hace atómico el cambio de código`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: tests de caracterización del comportamiento ACTUAL

Crear `__tests__/cloudPlaylistService.test.ts` clonando el arnés de mocks de
`choirSessionService.test.ts`. Casos mínimos (todos contra el código actual,
sin tocar el servicio aún):

1. `getRef` indirecto: código inválido (`'12'`, `'abcd'`, `''`) → lanza con el
   mensaje de `isValidCode`.
2. `fetchCloudPlaylist`: snapshot inexistente → `null`, sin `remove`.
3. `fetchCloudPlaylist`: playlist **caducada** (`expiresAt < Date.now()`) →
   devuelve `null` Y llama a `remove` una vez.
4. `fetchCloudPlaylist`: playlist **vigente** → la devuelve Y **`remove` NO se
   llama** (el test que protege contra la regresión destructiva).
5. `fetchCloudPlaylist`: caducada y el `remove` falla → sigue devolviendo
   `null` sin lanzar.
6. `uploadCloudPlaylist`: payload con `name: undefined` → el objeto pasado a
   `set` NO contiene la clave `name`; `expiresAt = now + 6 meses`;
   `createdAt` respetado si viene en opts.
7. `changeCloudPlaylistCode` mismo código → devuelve la actual; si no existe,
   lanza `'La playlist ya no existe'`.
8. `changeCloudPlaylistCode` destino ocupado → lanza
   `'El nuevo código ya está en uso'` y no escribe nada.
9. `changeCloudPlaylistCode` camino feliz → el destino recibe los songs y
   `createdAt` original, y el origen se borra.

**Verify**: `npm test -- cloudPlaylist` → 9+ tests pasan contra el código
actual (característica primero, refactor después).

### Step 2: `changeCloudPlaylistCode` con `update()` multi-path

Sustituir el par `uploadCloudPlaylist(newCode, …)` + `deleteCloudPlaylist(oldCode)`
por una sola escritura atómica:

```ts
const now = Date.now();
const moved: CloudPlaylist = {
  v: 2,
  songs: cur.songs,
  name: cur.name,
  createdAt: cur.createdAt,
  updatedAt: now,
  expiresAt: now + SIX_MONTHS_MS,
};
const clean = JSON.parse(JSON.stringify(moved));
const db = getDatabase(getFirebaseApp());
await update(ref(db, ROOT), {
  [newCode]: clean,
  [oldCode]: null,        // borrar en la MISMA operación
});
return moved;
```

(Importar `update` de `firebase/database`; mantener las comprobaciones previas
de existencia tal cual — la ventana de carrera entre el check y el update
existe igual que hoy, no empeora y el fallo parcial desaparece.)

Ajustar el test 9 para afirmar que se llamó a `update` UNA vez con ambas
claves (destino=payload, origen=null) y que ya no hay `set`+`remove`
separados.

**Verify**: `npm test -- cloudPlaylist` → all pass;
`npm run typecheck:tests` → exit 0.

## Test plan

- Los 9+ casos del Step 1 (fichero nuevo, patrón
  `choirSessionService.test.ts`), con el 4 como test-centinela de la
  regresión destructiva y el 9 re-anclado al `update()` atómico en Step 2.
- `npm test` completo verde.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run typecheck:tests` exits 0
- [ ] `npm test` exits 0; `__tests__/cloudPlaylistService.test.ts` existe con
      ≥9 tests
- [ ] `grep -n "deleteCloudPlaylist(oldCode)" mcm-app/services/cloudPlaylistService.ts`
      → sin resultados (el movimiento ya no borra en paso separado)
- [ ] `grep -c "update(" mcm-app/services/cloudPlaylistService.ts` → ≥1
- [ ] `git status` limpio fuera de los 2 archivos in-scope
- [ ] `plans/README.md` actualizado
- [ ] Entrada en `mcm-app/CHANGELOG.md` solo por el cambio del movimiento
      atómico (los tests solos no se documentan)

## STOP conditions

Stop and report back (do not improvise) if:

- El arnés de mocks de `choirSessionService.test.ts` no cubre `update` y
  extenderlo exige reescribir el mock global de `firebase/database` usado por
  otros tests.
- Las reglas RTDB rechazan el `update` multi-path sobre `playlistShares`
  (verificable solo en integración — si un consumidor manual reporta
  permission-denied tras el cambio, revertir el Step 2 y dejar los tests).
- Cualquier consumidor depende de que el movimiento sea dos operaciones
  (no debería: la firma y el valor devuelto no cambian).

## Maintenance notes

- El comentario del servicio dice "la purga real se hace por backend más
  adelante" — cuando ese backend exista (`purgeExpiredShares` ya existe para
  otros nodos, ver TODO.md §Backend), el borrado perezoso del cliente puede
  retirarse; los tests 3-5 marcarán el momento.
- Revisor: en el Step 2, vigilar que `JSON.parse(JSON.stringify(...))` siga
  aplicándose (RTDB rechaza `undefined`).
- Si el plan 001 se ejecuta en paralelo, resolver el merge trivial en
  `__tests__/` (ficheros distintos, no hay solape real).
