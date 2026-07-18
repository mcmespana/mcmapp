# Plan 003: Hacer atómica la publicación de reflexiones y no descartar el texto si falla

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 2d2822c..HEAD -- mcm-app/app/screens/ReflexionesScreen.tsx`
> If the file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (composable con Plan 002, que toca otra línea de este mismo archivo — coordinar el orden si se ejecutan ambos)
- **Category**: bug
- **Planned at**: commit `2d2822c`, 2026-07-18

## Why this matters

"Compartiendo" (reflexiones) es la única vía de escritura de contenido de
usuario de la app, usada en eventos con conectividad mala. Hoy tiene dos bugs
de pérdida de datos:

1. **No-atómico**: la reflexión se escribe con dos `set` separados (`data` y
   luego `updatedAt`). Si el segundo falla o la app muere entre ambos, la
   reflexión queda en `data` pero `updatedAt` no cambia — y como TODOS los
   lectores usan `useFirebaseData`, que solo descarga `data` cuando
   `updatedAt` difiere, **el resto de dispositivos no la verá nunca** (hasta
   que otra escritura posterior toque `updatedAt`).
2. **El formulario se limpia aunque falle**: el `catch` solo loguea, y después
   del try/catch se cierra el formulario y se vacían título/contenido
   incondicionalmente. El usuario pierde su texto y cree que se compartió.

## Current state

`mcm-app/app/screens/ReflexionesScreen.tsx:208-239` (verificado):

```ts
async function addReflexion() {
  if (!fecha) return;
  h.tap();
  setSaving(true);
  const nuevo: Reflexion = {
    id: Date.now().toString(),
    titulo: titulo.trim(),
    contenido,
    fecha: fecha.toISOString().slice(0, 10),
    grupal: false,
    autor,
  };
  try {
    const db = getDatabase(getFirebaseApp());
    const newRef = push(ref(db, `${compartiendoPath}/data`));
    await set(newRef, nuevo);
    await set(
      ref(db, `${compartiendoPath}/updatedAt`),
      Date.now().toString(),
    );
    setList([nuevo, ...list]);
    h.formSuccess();
  } catch (e) {
    logger.error('Error adding post', e);
  }
  setShowForm(false);
  setTitulo('');
  setContenido('');
  setFecha(new Date());
  setAutor(getDefaultAuthor());
  setSaving(false);
}
```

Contexto útil del mismo archivo:
- `:145` — `const compartiendoPath = getEventFirebasePath(event, 'compartiendo');`
- `:18` — importa `useToast` de `heroui-native`; `:259` `const { toast } = useToast();`
  y `:273` lo usa: `toast.show({ variant: 'success', label: 'Reflexión copiada' });`
  **Convención del repo**: el resto de la app (14 archivos) usa el `useToast`
  de `@/contexts/AppToastContext` (misma API `toast.show({variant,label,...})`).
  Este archivo es el único que usa el de heroui — cámbialo de paso (1 línea).
- Firebase: `import { getDatabase, ref, push, set } from 'firebase/database'`
  (comprueba la línea de import exacta; añadirás `update`).
- Reglas RTDB (`mcm-app/database.rules.json`): bajo `jubileo/compartiendo` y
  `activities/$event/compartiendo` solo son escribibles `data` y `updatedAt`
  — un `update` multi-path con esas dos claves bajo `compartiendoPath` es
  compatible con las reglas versionadas.

## Commands you will need

| Purpose   | Command (desde `mcm-app/`) | Expected on success |
|-----------|-----------------------------|---------------------|
| Install   | `npm ci`                    | exit 0              |
| Typecheck | `npx tsc --noEmit`          | exit 0              |
| Tests     | `npx jest --ci`             | all pass            |
| Lint      | `npm run lint`              | 0 errors            |

## Scope

**In scope**:
- `mcm-app/app/screens/ReflexionesScreen.tsx`
- `mcm-app/utils/reflexiones.ts` (crear — helper puro para el payload multi-path)
- `mcm-app/__tests__/reflexiones.test.ts` (crear)
- `mcm-app/CHANGELOG.md`

**Out of scope**:
- La línea `fecha: fecha.toISOString().slice(0, 10)` — la corrige el Plan 002.
  Si el Plan 002 ya se ejecutó, respeta su versión (`localISO(fecha)`).
- No refactorices la pantalla (787 líneas — su troceo es PLAN_CALIDAD Fase 1).
- No cambies el modelo `Reflexion` ni el orden/shape del listado.

## Git workflow

- Branch: `advisor/003-reflexiones-atomicas` desde `main`.
- Commit sugerido: `fix(reflexiones): escritura atómica data+updatedAt y conservar el texto si falla`.
- No push / no PR salvo que el operador lo pida.

## Steps

### Step 1: Helper puro + test

Crea `mcm-app/utils/reflexiones.ts`:

```ts
/** Payload multi-path para publicar una reflexión de forma atómica:
 *  escribe la entrada bajo data/<key> y toca updatedAt en la misma op. */
export function buildReflexionUpdate(
  key: string,
  reflexion: object,
  now: number,
): Record<string, unknown> {
  return {
    [`data/${key}`]: reflexion,
    updatedAt: String(now),
  };
}
```

Test en `__tests__/reflexiones.test.ts` (patrón: `__tests__/songUtils.test.ts`):
shape exacto de las claves, `updatedAt` como string.

**Verify**: `npx jest reflexiones --ci` → pass.

### Step 2: Escritura atómica en `addReflexion`

Sustituye los dos `set` por:

```ts
const db = getDatabase(getFirebaseApp());
const newRef = push(ref(db, `${compartiendoPath}/data`));
if (!newRef.key) throw new Error('push() sin key');
await update(
  ref(db, compartiendoPath),
  buildReflexionUpdate(newRef.key, nuevo, Date.now()),
);
```

Añade `update` al import de `firebase/database`.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 3: No limpiar el formulario si falla + toast de error

Reestructura el final de `addReflexion`:
- En el camino de éxito (dentro del `try`, tras `setList`): cerrar formulario
  y limpiar campos (las 5 líneas que hoy están fuera).
- En el `catch`: mantener `logger.error`, añadir
  `toast.show({ variant: 'danger', label: 'No se pudo compartir. Revisa tu conexión.' })`
  y NO tocar `showForm`/`titulo`/`contenido`/`fecha`/`autor`.
- `setSaving(false)` queda en un `finally`.
- Cambia el import de `useToast` a `@/contexts/AppToastContext` (misma API).
  Verifica que `BottomSheet`/`Spinner` siguen importándose de `heroui-native`.

**Verify**: `npm run lint` → 0 errors; `npx tsc --noEmit` → exit 0.

### Step 4: CHANGELOG

Entrada: fix de pérdida de reflexiones (escritura atómica + conservar texto
en error).

**Verify**: `npx jest --ci` → all pass.

## Test plan

- `__tests__/reflexiones.test.ts`: shape del multi-path update (2 claves,
  `data/<key>` y `updatedAt` string).
- Manual/opcional si hay entorno: publicar una reflexión → aparece en la
  lista; simular fallo (modo avión) → toast de error y el texto sigue en el
  formulario.

## Done criteria

- [ ] `npx tsc --noEmit` exit 0 y `npx jest --ci` exit 0 (tests nuevos incluidos)
- [ ] En `addReflexion` hay UNA sola operación de escritura (`update` multi-path); `grep -c "await set(" mcm-app/app/screens/ReflexionesScreen.tsx` no incluye ya las dos llamadas del excerpt
- [ ] El `catch` muestra toast de error y no limpia el formulario
- [ ] `grep -n "useToast" mcm-app/app/screens/ReflexionesScreen.tsx` apunta a `@/contexts/AppToastContext`
- [ ] `git status` limpio fuera del scope; CHANGELOG + `plans/README.md` actualizados

## STOP conditions

- El excerpt no coincide (drift) — p.ej. si el Plan 002 cambió `fecha:`; en
  ese caso continúa respetando esa línea, pero para cualquier otra diferencia
  reporta.
- El `update` multi-path falla contra las reglas en un entorno real por el
  shape de `compartiendoPath` (p.ej. eventos cuyo path no termina en el nodo
  con `data`/`updatedAt`) — reporta con el path concreto.
- El toast de `AppToastContext` no renderiza en esta pantalla (provider
  ausente en la ruta) — usa entonces el de heroui y repórtalo.

## Maintenance notes

- Cualquier futura escritura "contenido + updatedAt" (p.ej. sugerencias de
  canciones en `SuggestSongModal`) debería usar el mismo patrón multi-path;
  hay un hallazgo de deuda (DEBT-01) para centralizar escrituras RTDB.
- Si se añade edición/borrado de reflexiones, reutilizar
  `buildReflexionUpdate` con la key existente.
