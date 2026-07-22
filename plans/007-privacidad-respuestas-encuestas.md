# Plan 007: Dejar de exponer públicamente las respuestas (con nombre real) de encuestas y evaluaciones

> ⛔ **ANULADO (2026-07-22) — no ejecutar.** Decisión de producto: el panel
> **debe** poder ver nombres/respuestas de encuestas, es una funcionalidad
> deseada y no un bug. El diseño actual (`.read: true` en `/surveys` y
> `/activities`) se mantiene tal cual. Motivo adicional: la app está en
> **beta privada**, no en gran producción, así que no hay urgencia de
> exposición real. Si en el futuro aparece un bug de reglas **no
> relacionado** con esta visibilidad deseada del panel, evaluarlo aparte —
> la premisa de este plan concreto ya no aplica. Ver
> `docs/planes/BACKLOG.md` §3. El resto del documento se deja como
> referencia técnica (útil si algún día se retoma el análisis).

> **Executor instructions** (histórico, ya no aplica — ver anulación arriba): Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 2d2822c..HEAD -- mcm-app/database.rules.json docs/SEGURIDAD.md mcm-app/utils/surveyIdentity.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1 (impacto) — **ejecutable ya solo en su parte de reglas versionadas**; el despliegue está bloqueado por el prerequisito del panel (ver STOP conditions)
- **Effort**: M
- **Risk**: MED (coordinación cross-repo con mcmpanel)
- **Depends on**: none en este repo; despliegue bloqueado por "Integración D" (auth real del panel, `docs/planes/PLAN_INTEGRACIONES.md`)
- **Category**: security (privacidad/PII)
- **Planned at**: commit `2d2822c`, 2026-07-18

## Why this matters

Las respuestas de encuestas y evaluaciones de eventos **no anónimas** guardan
nombre real, tipo de perfil, delegación y uid (`buildIdentityFields`). En las
reglas versionadas, `/surveys` y `/activities` tienen `.read: true` en la
raíz del nodo, que **cascada** hasta `respuestas/$deviceId` — cualquiera con
la URL pública de la base puede listar y descargar todas las respuestas con
esos datos personales, correlados por dispositivo. Es exposición de PII de
menores/jóvenes de un movimiento religioso: impacto alto.

Matiz importante (verificado): estas reglas versionadas **aún no están
desplegadas** (`docs/SEGURIDAD.md` lo prohíbe hasta que mcmpanel tenga auth
real) y las reglas vivas de la consola son "probablemente más abiertas". Este
plan corrige el **fichero versionado** — la fuente de verdad que se
desplegará — y deja verificado el camino para cuando el prerequisito del
panel se cumpla. Corregirlo ahora evita heredar la fuga el día del deploy.

## Current state

- `mcm-app/database.rules.json:197-210` (verificado):

  ```json
  "surveys": {
    ".read": true,
    "$surveyId": {
      "updatedAt": { ".write": true, ... },
      "respuestas": {
        "$deviceId": { ".write": true }
      }
    }
  }
  ```

  La cascada de `.read: true` alcanza `respuestas/*`. Lo mismo en
  `activities` (`:91-104`): `.read: true` en la raíz cubre
  `$event/evaluacion/respuestas/$deviceId`.

- Contraste con el patrón correcto ya usado en el mismo fichero,
  `app/evaluations` (`:181-186`): el `.read` está en `$deviceId`, no en la
  raíz → no enumerable.

- `mcm-app/utils/surveyIdentity.ts:56-71` (verificado) — los campos escritos:

  ```ts
  export function buildIdentityFields(opts: {...}): Record<string, string> {
    if (opts.anonymous) return {};
    const fields: Record<string, string> = {
      userName: opts.name || 'Anónimo',
      userProfileType: opts.profileType ?? 'sin-perfil',
      userDelegation: opts.delegationLabel || 'Sin delegación',
    };
    if (opts.authUid) fields.userId = opts.authUid;
    return fields;
  }
  ```

- La app: ¿lee alguna vez `respuestas` de vuelta? Verificación previa
  (Step 1) — el diseño del contrato (`docs/contratos/ENCUESTAS_CONTRATO.md`)
  dice que la app solo escribe su propia respuesta; el lector es el panel
  (hoy sin auth — ese es el bloqueo).

- `docs/SEGURIDAD.md:28-42` — bloque "⚠️ NO DESPLIEGUES ESTAS REGLAS TODAVÍA"
  con el prerequisito (panel con Firebase Auth + allowlist `/admins` o
  escrituras movidas a funciones server-side).

- `.github/workflows/deploy-firebase-rules.yml` — despliega el fichero al
  hacer push a `production` si el secret existe. Coexiste con el "no
  desplegar todavía" del doc: deja constancia escrita de esa tensión (Step 4).

## Commands you will need

| Purpose        | Command                                       | Expected on success |
|----------------|-----------------------------------------------|---------------------|
| Validar sintaxis | `npx firebase-tools@14 database:rules:canary --help` no aplica en local sin proyecto; usa el lint de abajo | — |
| Lint JSON-with-comments | `node -e "const s=require('fs').readFileSync('mcm-app/database.rules.json','utf8'); new Function('return('+s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/.*$/gm,'')+')')()"` | exit 0 (parsea) |
| Tests app      | `cd mcm-app && npx jest surveys --ci`          | all pass            |
| Grep de lectura | `grep -rn "respuestas" mcm-app --include="*.ts" --include="*.tsx" -l` | solo escrituras |

## Scope

**In scope**:
- `mcm-app/database.rules.json` (nodos `surveys` y `activities` únicamente)
- `docs/SEGURIDAD.md` (tabla de secciones + nota de la corrección)
- `mcm-app/CHANGELOG.md`

**Out of scope**:
- Desplegar las reglas (bloqueado por SEGURIDAD.md — NO lo hagas).
- mcmpanel (otro repo) — la migración de su lector de respuestas es el
  prerequisito documentado, no parte de este plan.
- `utils/surveyIdentity.ts` y las pantallas de encuesta — el shape de
  escritura no cambia.
- Los nodos `songs`, `pushTokens`, `playlistShares`, `choirSessions` —
  hallazgos aparte (SEC-03) o tradeoffs documentados.

## Git workflow

- Branch: `advisor/007-privacidad-encuestas` desde `main`.
- Commit: `security(rules): respuestas de encuestas/evaluaciones dejan de ser legibles públicamente (fichero versionado)`.
- No push / no PR salvo que el operador lo pida. **Nunca a `production`**
  (dispararía el workflow de deploy).

## Steps

### Step 1: Confirmar que la app no lee `respuestas`

```bash
grep -rn "respuestas" mcm-app/app mcm-app/components mcm-app/hooks mcm-app/utils mcm-app/services --include="*.ts" --include="*.tsx"
```

Revisa cada hit: deben ser solo construcciones de path de ESCRITURA
(`set`/`update`) o el check `hasUserAnswered` (que lee
`users/$uid/surveysAnswered`, no `respuestas`). Si algún código de la app LEE
`surveys/*/respuestas` o `activities/*/evaluacion/respuestas`, STOP — el
cambio de reglas lo rompería.

**Verify**: lista anotada de hits, todos de escritura.

### Step 2: Reescribir el nodo `surveys`

Sustituye el bloque por uno donde la lectura pública queda SOLO en la config
y el índice, no en las respuestas (sigue el patrón de `app/evaluations`):

```json
"surveys": {
  "_index": { ".read": true },
  "$surveyId": {
    ".read": true,
    "respuestas": {
      ".read": false,
      "$deviceId": { ".write": true }
    },
    "updatedAt": {
      ".write": true,
      ".validate": "newData.isString() || newData.isNumber()"
    }
  }
}
```

⚠️ Nota RTDB: en Firebase RTDB las reglas de lectura **cascadan hacia abajo y
no se pueden revocar** en un hijo — por eso `.read: true` NO puede quedarse en
la raíz `surveys`; hay que bajarlo a `_index` y a `$surveyId` con el `false`
explícito… y aun así `".read": false` bajo `$surveyId` NO anula el `true` del
padre. **La única forma efectiva es que el `true` nunca cubra `respuestas`**:
deja `.read` en los hijos que sí son públicos (`_index`, y dentro de
`$surveyId` los subárboles de config: `config`, `preguntas`, `estado`,
`updatedAt`… los que existan según `docs/contratos/ENCUESTAS_CONTRATO.md` y
`mcm-app/firebase-seed/surveys.json`) y NO pongas `.read` ni en `$surveyId`
ni en `respuestas`. Ajusta la lista de hijos públicos leyendo el seed real.

**Verify**: el comando de parseo de "Commands" → exit 0; los paths que la app
lee de encuestas (busca `useFirebaseData` con path `surveys` en
`hooks/useActiveSurveys.ts` y las pantallas de encuesta) quedan todos bajo
subárboles con `.read: true`. Lista cada path leído por la app y su regla.

### Step 3: Ídem para `activities/$event/evaluacion/respuestas`

En el nodo `activities`, el `.read: true` de la raíz cubre todo el evento
(horario, materiales… que SÍ son públicos). Mueve la lectura pública del
nivel raíz a los hijos públicos de `$event` de forma que
`evaluacion/respuestas` quede sin `.read` (denegado por defecto), manteniendo
`evaluacion/config` (o el subárbol de config que exista en
`mcm-app/firebase-seed/eventos/`) legible. Misma cautela de cascada que en
Step 2. Las escrituras existentes (`compartiendo`, `respuestas/$deviceId`)
no cambian.

**Verify**: parseo exit 0 + lista de paths de evento que la app lee
(`grep -rn "activities/" mcm-app/hooks mcm-app/app --include="*.ts*"` y
`constants/events.ts`) con su regla de lectura correspondiente.

### Step 4: Documentar en SEGURIDAD.md

- Actualiza la tabla de secciones: `surveys/*/respuestas` y
  `activities/*/evaluacion/respuestas` pasan a "Lectura: denegada (solo
  Admin SDK)".
- Añade una línea al bloque "NO DESPLIEGUES": "el panel además deberá leer
  las respuestas con Admin SDK/función server-side cuando se despliegue
  (antes las leía en claro)".

**Verify**: `grep -n "respuestas" docs/SEGURIDAD.md` refleja el nuevo estado.

### Step 5: CHANGELOG

Entrada en `mcm-app/CHANGELOG.md` (cambio en Firebase = SÍ se documenta).

**Verify**: entrada arriba del todo con fecha y hora.

## Test plan

No hay framework de test de reglas en el repo. La verificación es:
(a) parseo del fichero, (b) el mapa exhaustivo path-leído-por-la-app → regla
que lo cubre (Steps 2-3), (c) `npx jest surveys --ci` verde (la lógica de
encuestas de la app no cambia). Opcional si hay entorno: el emulador de
Firebase (`firebase emulators:start --only database`) permite probar
lecturas anónimas contra las reglas nuevas — no es requisito.

## Done criteria

- [ ] En el fichero versionado, ningún `.read: true` cubre `respuestas` (ni por cascada) en `surveys` ni en `activities`
- [ ] Todos los paths que la app lee de encuestas/eventos siguen cubiertos por `.read: true` (mapa documentado en el resumen final del executor)
- [ ] El fichero parsea (comando de "Commands" exit 0)
- [ ] SEGURIDAD.md actualizado (tabla + prerequisito del panel ampliado)
- [ ] `npx jest --ci` exit 0; `git status` limpio fuera del scope
- [ ] CHANGELOG + fila en `plans/README.md` actualizadas

## STOP conditions

- La app SÍ lee `respuestas` en algún flujo (Step 1) — reporta el flujo.
- No puedes determinar la lista de subárboles públicos reales de una encuesta
  (seed ausente o contrato ambiguo) — reporta con lo que hayas encontrado en
  `firebase-seed/surveys.json` y el contrato.
- Cualquier tentación de desplegar para "probar" — NO: el bloque de
  SEGURIDAD.md lo prohíbe explícitamente; el deploy es decisión humana con
  el prerequisito del panel cumplido.
- Los hits de `activities` muestran pantallas que leen el nodo `$event`
  ENTERO de una vez (`onValue`/`get` en la raíz del evento) — el cambio de
  Step 3 las rompería; reporta el diseño alternativo (mover respuestas fuera
  del subárbol del evento) en vez de improvisarlo.

## Maintenance notes

- El día que se despliegue (post-Integración D): probar primero en un
  proyecto/instancia de staging si existe; verificar que el panel lee
  respuestas vía Admin SDK; y monitorizar los logs de reglas denegadas.
- Toda encuesta nueva hereda el patrón: config pública, respuestas
  write-only. El contrato `ENCUESTAS_CONTRATO.md` debería recogerlo.
- Relacionado no incluido: los códigos de 4 dígitos de
  `playlistShares`/`choirSessions` anulan en la práctica su "no enumerable"
  (hallazgo SEC-03) — decisión de producto pendiente (longitud/UX del código).
