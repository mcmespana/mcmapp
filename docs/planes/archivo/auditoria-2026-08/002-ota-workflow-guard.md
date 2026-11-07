# Plan 002: Blindar los workflows de OTA — diff nativo, `[skip-ota]` en todo el push y gate de tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 40c6566..HEAD -- .github/workflows/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (los cambios fallan "cerrado": lo peor es una OTA retrasada)
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `40c6566`, 2026-08-05

## Why this matters

Una OTA (EAS Update) manda solo el bundle JS. Si ese bundle referencia módulos
nativos que el binario instalado no lleva, **la app crashea en toda la base
instalada** y no se puede arreglar por OTA (hace falta release de tienda). Hoy
la única protección es un marcador `[skip-ota]` escrito a mano y comprobado
sobre UN solo commit (`github.event.head_commit`): en un push de N commits solo
se mira el último, y `workflow_dispatch` se lo salta siempre. Además ni los
workflows de OTA ni el deploy web corren tests/typecheck/lint — el CI solo se
dispara en `pull_request`, así que un push directo llega a todos los
dispositivos sin ninguna verificación. Este plan añade dos redes: un guard
automático que detecta cambios en rutas nativas comparando los SHAs del push
entero, y un job de verificación previo al publish.

## Current state

- `.github/workflows/ota-production.yml` — OTA al canal `production` en cada
  push a esa rama. Líneas 13-19:

```yaml
jobs:
  publish-prod:
    # Salta si el mensaje del commit contiene [skip-ota] (p.ej. cuando se añaden paquetes nativos)
    # En workflow_dispatch siempre corre (el usuario lo lanzó explícitamente)
    if: |
      github.event_name == 'workflow_dispatch' ||
      !contains(github.event.head_commit.message, '[skip-ota]')
```

  Después: setup Node 20 con caché npm, `npm install -g eas-cli@21.0.2`
  (pineado a propósito — NO cambiar), `npm ci` en `./mcm-app`, `eas update
  --branch production`.

- `.github/workflows/ota-preview.yml` — misma estructura y mismo `if` (línea
  ~19), canal `preview`.
- `.github/workflows/deploy-web.yml` — push a `production` → `expo export
  --platform web` + `eas deploy --prod`, sin ningún gate.
- `.github/workflows/ci.yml` — el ÚNICO sitio con verificación, y solo en PRs:

```yaml
on:
  pull_request:
    branches: [main, production, preview]
# jobs.ci.steps: npm ci → npm run typecheck → npm run typecheck:tests → npm run lint → npm test -- --ci
```

- Rutas que implican código nativo en este repo (la lista que el guard debe
  vigilar): `mcm-app/package.json`, `mcm-app/package-lock.json`,
  `mcm-app/app.json`, `mcm-app/app.config.ts`, `mcm-app/eas.json`,
  `mcm-app/patches/`, `mcm-app/plugins/`, `mcm-app/modules/`,
  `mcm-app/targets/`.
  (Nota: `package.json` da falsos positivos con bumps de devDependencies —
  aceptable: el escape es incluir `[skip-ota]`... no; el escape correcto es al
  revés, ver Step 1: el guard solo BLOQUEA si hay diff nativo Y falta
  `[skip-ota]` en el rango. Un falso positivo se resuelve añadiendo
  `[skip-ota]` — que como mucho pospone la OTA — o con el input `force` del
  dispatch.)
- En un evento `push`, `github.event.before` y `github.sha` delimitan el rango
  exacto de commits del push.
- Convención del repo: comentarios de workflow en español explicando el porqué
  (ver los comentarios existentes en `ota-production.yml`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Validar sintaxis YAML | `npx yaml-lint .github/workflows/*.yml` (o `python3 -c "import yaml,glob; [yaml.safe_load(open(f)) for f in glob.glob('.github/workflows/*.yml')]"`) | exit 0 |
| Ver el diff | `git diff .github/workflows/` | solo cambios esperados |

No hay forma de ejecutar los workflows localmente; la validación real es el
primer push (ver Maintenance notes).

## Scope

**In scope** (the only files you should modify):

- `.github/workflows/ota-production.yml`
- `.github/workflows/ota-preview.yml`
- `.github/workflows/deploy-web.yml`
- `.github/workflows/verify.yml` (crear — workflow reutilizable)
- `.github/workflows/ci.yml` (solo si se refactoriza para llamar a verify.yml)

**Out of scope** (do NOT touch):

- `mcm-app/**` — nada de código de app.
- Los secrets/env de los workflows (bloques `env:` con `EXPO_PUBLIC_*`) — se
  quedan exactamente como están; moverlos rompe la OTA.
- La versión pineada de `eas-cli` (21.0.2) — pineada a propósito.
- `.github/workflows/deploy-rules.yml` u otros workflows no listados.

## Git workflow

- Branch: la que indique el operador (o `advisor/002-ota-workflow-guard`).
- Un commit por paso lógico; estilo: `ci(ota): guard de cambios nativos y gate de tests antes de publicar`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: job `guard-native` en los dos workflows de OTA

Añadir un primer job que, en eventos `push`, haga checkout con
`fetch-depth: 0` y ejecute:

```bash
BEFORE="${{ github.event.before }}"
AFTER="${{ github.sha }}"
# Rama nueva o BEFORE inexistente (p. ej. force-push): comparar con el commit anterior
if [ "$BEFORE" = "0000000000000000000000000000000000000000" ] || ! git cat-file -e "$BEFORE" 2>/dev/null; then
  BEFORE="$(git rev-parse "$AFTER"^)"
fi
NATIVE_CHANGES=$(git diff --name-only "$BEFORE" "$AFTER" -- \
  mcm-app/package.json mcm-app/package-lock.json mcm-app/app.json \
  mcm-app/app.config.ts mcm-app/eas.json \
  mcm-app/patches/ mcm-app/plugins/ mcm-app/modules/ mcm-app/targets/)
if [ -n "$NATIVE_CHANGES" ]; then
  if git log --format=%B "$BEFORE".."$AFTER" | grep -q '\[skip-ota\]'; then
    echo "Cambios en rutas nativas + [skip-ota] presente en el push → se salta la OTA."
    echo "skip=true" >> "$GITHUB_OUTPUT"
  else
    echo "::error::Cambios en rutas nativas SIN [skip-ota] en ningún commit del push:"
    echo "$NATIVE_CHANGES"
    exit 1
  fi
fi
```

Semántica resultante (documentarla en un comentario del workflow, en español):

- Diff nativo + `[skip-ota]` en CUALQUIER commit del rango → output
  `skip=true`, la OTA no se publica (comportamiento deseado hoy, pero ahora
  cubre todo el push).
- Diff nativo SIN `[skip-ota]` → el guard FALLA en rojo. Es la situación que
  hoy pasa desapercibida y crashea la base instalada.
- Sin diff nativo → sigue adelante. El check viejo de `head_commit` puede
  eliminarse del `if:` del job de publish (lo sustituye el output del guard).
- `workflow_dispatch`: el guard corre igualmente comparando `HEAD^..HEAD`,
  pero con un input booleano `force` (default `false`) que permite saltárselo
  explícitamente. Así el dispatch deja de ser un bypass silencioso.

El job de publish pasa a declarar `needs: [guard-native, verify]` y
`if: needs.guard-native.outputs.skip != 'true'`.

**Verify**: parseo YAML exit 0; `git diff` muestra el guard en ambos ficheros
con la misma lógica.

### Step 2: workflow reutilizable de verificación

Crear `.github/workflows/verify.yml` con `on: workflow_call`, un job que
replique EXACTAMENTE los pasos de `ci.yml` (checkout, setup-node 20 con
`cache: npm` y `cache-dependency-path: mcm-app/package-lock.json`, `npm ci`,
`npm run typecheck`, `npm run typecheck:tests`, `npm run lint`,
`npm test -- --ci`, todos con `working-directory: ./mcm-app`).

Refactorizar `ci.yml` para que su job llame al reutilizable
(`uses: ./.github/workflows/verify.yml`) — así no hay dos listas que
divergen (misma regla que ya aplica el repo en
`docs/desarrollo/BUILD_AGOSTO_2026.md`: una sola fuente de verdad).

**Verify**: parseo YAML exit 0.

### Step 3: engancharlo a OTA y deploy web

- `ota-production.yml` y `ota-preview.yml`: job `verify` con
  `uses: ./.github/workflows/verify.yml`; publish con
  `needs: [guard-native, verify]`.
- `deploy-web.yml`: job `verify` igual; el deploy con `needs: verify`. (Aquí
  no hace falta `guard-native`: la web no tiene binario de tienda.)

**Verify**: parseo YAML exit 0;
`grep -c "workflows/verify.yml" .github/workflows/*.yml` → aparece en
`ci.yml`, `ota-production.yml`, `ota-preview.yml` y `deploy-web.yml`.

## Test plan

No hay tests de Jest para workflows. La verificación es:

1. Parseo YAML de los 5 ficheros (comando de arriba) → exit 0.
2. Revisión manual del diff contra este plan.
3. Tras el merge, el primer push a `preview` debe mostrar en Actions los jobs
   `guard-native` → `verify` → `publish-preview` encadenados (anotarlo en el
   PR para quien lo valide).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] Los 5 YAML parsean (comando del bloque "Commands") → exit 0
- [ ] `grep -n "head_commit.message" .github/workflows/ota-*.yml` → sin
      resultados (la comprobación de un solo commit ya no existe)
- [ ] `grep -n "fetch-depth: 0" .github/workflows/ota-*.yml` → presente en el
      job del guard de ambos
- [ ] Los jobs de publish de `ota-*.yml` declaran `needs:` con `guard-native`
      y `verify`; `deploy-web.yml` declara `needs: verify`
- [ ] `git status` no muestra cambios fuera de `.github/workflows/`
- [ ] Fila de estado actualizada en `plans/README.md`
- [ ] Entrada en `mcm-app/CHANGELOG.md` (cambio de proceso de release: SÍ se
      documenta)

## STOP conditions

Stop and report back (do not improvise) if:

- Los workflows actuales no coinciden con los excerpts (drift).
- El repo usa GitHub Enterprise/runners con restricciones que impidan
  `workflow_call` local (poco probable; runners `ubuntu-latest` estándar).
- Descubres que `github.event.before` no está disponible en el evento que
  dispara estos workflows (verificar en la doc de Actions si dudas — para
  `push` siempre existe).
- Te ves tentado de "aprovechar" para tocar los `env:` de secrets — no.

## Maintenance notes

- **La lista de rutas nativas del guard es el nuevo punto de mantenimiento**:
  si aparece un directorio nativo nuevo (p. ej. `mcm-app/widgets/`), hay que
  añadirlo al diff de AMBOS workflows de OTA. Considerar extraerla a un
  fichero (`.github/native-paths.txt`) si diverge una vez.
- Falsos positivos esperables: bump de una devDependency pura toca
  `package.json` y disparará el guard. Coste: añadir `[skip-ota]` (se salta
  una OTA) o relanzar con `force`. Es el trade-off correcto: el fallo
  contrario cuesta un crash masivo.
- Revisor del PR: comprobar que `verify.yml` replica los pasos de `ci.yml` al
  100% (mismas versiones, mismos flags) y que `ci.yml` quedó delegando, no
  duplicando.
- Relacionado pero fuera de este plan: corregir la frase de
  `mcm-app/CLAUDE.md` "Único punto de escritura: ReflexionesScreen" (falsa,
  hay ~11 sitios de escritura — hallazgo [DEBT-01] del índice).
