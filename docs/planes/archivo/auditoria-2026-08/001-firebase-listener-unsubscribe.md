# Plan 001: Arreglar los `off()` que nunca quitan los listeners de Firebase

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 40c6566..HEAD -- mcm-app/services/choirSessionService.ts mcm-app/services/pushNotificationService.ts mcm-app/__tests__/choirSessionService.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `40c6566`, 2026-08-05

## Why this matters

Dos servicios devuelven una función de "limpieza" que en realidad no quita
nada: pasan a `off(ref, 'value', cb)` la función *unsubscribe* que devolvió
`onValue`, no el callback que se registró. `off` solo elimina la inscripción
cuya identidad de callback coincide, así que la llamada es un no-op silencioso.
Resultado: cada suscripción a una sesión de coro y cada suscripción al
historial de notificaciones queda viva para siempre. En "modo Coro", cambiar
el código de sesión deja el listener del código viejo activo (disparando
`setRemote` con un código obsoleto), y cada entrada/salida apila otro listener
sobre el mismo nodo — en la wifi saturada de un encuentro, ancho de banda y
batería gastados en datos que nadie mira.

## Current state

- `mcm-app/services/choirSessionService.ts` — servicio de sesiones de coro
  (RTDB `choirSessions/{code}`). Líneas 156-171:

```ts
/** Suscripción en tiempo real. Devuelve la función `unsubscribe`. */
export function subscribeChoirSession(
  code: string,
  onChange: (session: ChoirSession | null) => void,
  onError?: (err: Error) => void,
): () => void {
  const r = getRef(code);
  const handler = onValue(
    r,
    (snap) => {
      onChange(snap.exists() ? (snap.val() as ChoirSession) : null);
    },
    (err) => onError?.(err),
  );
  return () => off(r, 'value', handler);   // ← BUG: `handler` es el Unsubscribe, no el callback
}
```

- `mcm-app/services/pushNotificationService.ts` — servicio de notificaciones.
  Líneas 286-308 (dentro de `subscribeToNotifications`):

```ts
const unsubscribe = onValue(notificationsRef, (snapshot) => {
  /* …mapea, ordena y llama a callback(sorted)… */
});

// Retornar función de cleanup
return () => off(notificationsRef, 'value', unsubscribe);   // ← mismo BUG
```

- En el SDK modular de Firebase (`firebase/database`), `onValue(...)` devuelve
  un `Unsubscribe` (`() => void`) que ES la forma correcta de desuscribirse.
  El código compila solo porque `() => void` es estructuralmente asignable al
  tipo del parámetro callback de `off`.
- Consumidor visible: `mcm-app/contexts/ChoirSessionContext.tsx` (~líneas
  162-189) re-suscribe en cada cambio de `code`/`mode` llamando a la limpieza
  rota cada vez.
- Convención del repo: comentarios en español, logging solo vía
  `@/utils/logger` (nunca `console.*`), tests en `mcm-app/__tests__/` con el
  SDK mockeado — ver `mcm-app/__tests__/choirSessionService.test.ts` como
  ejemplar del patrón de mocks.

## Commands you will need

| Purpose   | Command (desde `mcm-app/`)      | Expected on success |
|-----------|---------------------------------|---------------------|
| Install   | `npm ci`                        | exit 0              |
| Typecheck | `npx tsc --noEmit`              | exit 0, sin errores |
| Tests     | `npm test -- choirSession`      | all pass            |
| Tests     | `npm test`                      | all pass            |
| Lint      | `npm run lint`                  | exit 0              |

## Scope

**In scope** (the only files you should modify):

- `mcm-app/services/choirSessionService.ts`
- `mcm-app/services/pushNotificationService.ts`
- `mcm-app/__tests__/choirSessionService.test.ts` (ampliar)

**Out of scope** (do NOT touch, even though they look related):

- `mcm-app/contexts/ChoirSessionContext.tsx` — su lógica de re-suscripción es
  correcta una vez la limpieza funcione; no "mejorarla" de paso.
- `mcm-app/notifications/usePushNotifications.ts` — consumidor, no cambia.
- Cualquier otro `onValue` del repo: NO hacer una pasada global; este plan
  arregla exactamente los dos sitios citados.

## Git workflow

- Branch: la que indique el operador (o `advisor/001-firebase-listener-unsubscribe`).
- Commit style del repo (español, conventional-ish): p. ej.
  `fix(firebase): los unsubscribe de coro y notificaciones no quitaban el listener`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: `choirSessionService.subscribeChoirSession` devuelve el Unsubscribe real

En `mcm-app/services/choirSessionService.ts`, renombrar `handler` a
`unsubscribe` y devolverlo directamente:

```ts
const unsubscribe = onValue(
  r,
  (snap) => {
    onChange(snap.exists() ? (snap.val() as ChoirSession) : null);
  },
  (err) => onError?.(err),
);
return unsubscribe;
```

Si tras esto `off` ya no se usa en el archivo, quitarlo del import de
`firebase/database`.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 2: `pushNotificationService.subscribeToNotifications` igual

En `mcm-app/services/pushNotificationService.ts`, sustituir
`return () => off(notificationsRef, 'value', unsubscribe);` por
`return unsubscribe;`. Quitar `off` del import si queda sin uso.

**Verify**: `npx tsc --noEmit` → exit 0, y
`grep -n "off(" mcm-app/services/choirSessionService.ts mcm-app/services/pushNotificationService.ts`
→ sin resultados (o solo usos legítimos distintos de estos dos).

### Step 3: test de regresión

En `mcm-app/__tests__/choirSessionService.test.ts` (sigue su patrón de mocks
existente), añadir un test que:

1. Mockee `onValue` para devolver un `jest.fn()` como unsubscribe.
2. Llame a `subscribeChoirSession('1234', jest.fn())`.
3. Ejecute la función devuelta y afirme que el unsubscribe mockeado se llamó
   exactamente una vez (`expect(mockUnsubscribe).toHaveBeenCalledTimes(1)`).

Esto fija el contrato "la limpieza devuelta ES el Unsubscribe de onValue".

**Verify**: `npm test -- choirSession` → all pass, incluido el nuevo.

## Test plan

- Nuevo caso en `__tests__/choirSessionService.test.ts` (arriba). Para
  `pushNotificationService` no hay fichero de test hoy; el contrato queda
  cubierto por el cambio simétrico + typecheck. Si el patrón de mock resulta
  trivial de replicar, un test análogo es bienvenido pero no obligatorio.
- Verificación final: `npm test` → toda la suite verde.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm test` exits 0; el nuevo test de unsubscribe existe y pasa
- [ ] `grep -rn "off(r, 'value'" mcm-app/services/` → sin resultados
- [ ] `grep -rn "off(notificationsRef" mcm-app/services/` → sin resultados
- [ ] `git status` no muestra modificaciones fuera de los 3 archivos in-scope
- [ ] Fila de estado actualizada en `plans/README.md`
- [ ] Entrada en `mcm-app/CHANGELOG.md` (formato `## YYYY-MM-DD HH:MM — Título`,
      arriba del todo) — es un fix de bug significativo

## STOP conditions

Stop and report back (do not improvise) if:

- Los excerpts de "Current state" no coinciden con el código vivo (drift).
- `onValue` en la versión instalada de `firebase` NO devuelve una función
  (comprobar `node_modules/firebase/...` o los tipos): la premisa del plan
  sería falsa.
- El mock de `onValue` del test existente no permite capturar el valor de
  retorno sin reescribir el arnés de mocks entero.
- Cualquier test existente de coro falla tras el cambio.

## Maintenance notes

- Revisor: comprobar que NINGÚN sitio llama a la limpieza esperando el viejo
  comportamiento no-op (no debería — era un bug invisible).
- Futuro: cualquier `onValue` nuevo debe devolver su Unsubscribe directamente;
  el patrón `off(ref, 'value', unsubscribe)` es el anti-patrón que este plan
  elimina. Si aparece un tercer servicio de suscripción, considerar un helper
  común.
- Deferred a propósito: los ciclos read-modify-write concurrentes de
  AsyncStorage en `pushNotificationService` ([BUG-02] del índice) — otra
  clase de bug, otro plan.
