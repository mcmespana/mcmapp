# Plan 006: Higiene de dependencias (4 paquetes muertos, jest duplicado) y pineo de CLIs en pipelines

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 2d2822c..HEAD -- mcm-app/package.json .github/workflows/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: migration/deps + dx
- **Planned at**: commit `2d2822c`, 2026-07-18

## Why this matters

- Cuatro dependencias declaradas no tienen **ningún** import en el código
  (verificado con grep incluyendo imports dinámicos): `@gorhom/bottom-sheet`,
  `react-native-modal` (además, versión **release-candidate** `^14.0.0-rc.1`),
  `@react-native-picker/picker` y `@react-native-community/slider`. Tres de
  ellas llevan código nativo: engordan el binario y la superficie de
  autolinking en cada build de tienda para nada.
- `jest` está declarado a la vez en `dependencies` y `devDependencies`
  (deriva de manifiesto; un test runner no es dependencia de runtime).
- Los pipelines de release instalan `eas-cli@latest` / `firebase-tools@latest`
  en cada ejecución: una major nueva del CLI puede romper una OTA de
  producción sin que haya cambiado nada en el repo, y dos runs del mismo
  commit pueden comportarse distinto.

**OJO — verificado en el vetado**: `expo-sensors` NO se puede quitar aunque
un grep de imports estáticos no lo encuentre — se carga con **import
dinámico** en `hooks/useShakeDetector.ts:49` (`import('expo-sensors')`).

## Current state

- `mcm-app/package.json` (verificado):
  - `:22` `"@gorhom/bottom-sheet": "^5.2.9"` — 0 imports.
  - `:71` `"react-native-modal": "^14.0.0-rc.1"` — 0 imports, RC.
  - `:27` `"@react-native-picker/picker": "2.11.4"` — 0 imports.
  - `:25` `"@react-native-community/slider": "5.1.2"` — 0 imports.
  - `:64` `"jest": "~29.7.0"` en `dependencies` **y** `:102` en `devDependencies`.
  - Deps que SÍ se usan y NO deben tocarse: `@react-native-community/datetimepicker`
    (ReflexionesScreen), `expo-document-picker` (SelectedSongsScreen),
    `react-native-confetti-cannon` (WordleScreen + CarismochitoOverlay),
    `react-native-qrcode-svg` (ShareQrModal), `expo-sensors` (dinámico,
    useShakeDetector).
- Workflows con `@latest` (verificado):
  - `.github/workflows/deploy-firebase-rules.yml:56` → `npm install -g firebase-tools@latest`
  - `.github/workflows/deploy-web.yml:48` → `npm install -g eas-cli@latest`
  - `.github/workflows/ota-preview.yml:58` → ídem
  - `.github/workflows/ota-production.yml:58` → ídem
  - `mcm-app/package.json:15-17` — scripts `eas:build*` usan `npx eas-cli@latest`
  - `mcm-app/eas.json:2-4` — `"cli": { "version": ">= 16.7.0" }` (suelo, no techo)

## Commands you will need

| Purpose   | Command (desde `mcm-app/`)          | Expected on success |
|-----------|--------------------------------------|---------------------|
| Install   | `npm install` (regenera lockfile)    | exit 0              |
| Typecheck | `npx tsc --noEmit`                   | exit 0              |
| Tests     | `npx jest --ci`                      | all pass            |
| Lint      | `npm run lint`                       | 0 errors            |
| Doctor    | `npx expo-doctor` (opcional, informativo) | sin errores nuevos |

## Scope

**In scope**:
- `mcm-app/package.json` + `mcm-app/package-lock.json`
- `.github/workflows/deploy-firebase-rules.yml`, `deploy-web.yml`,
  `ota-preview.yml`, `ota-production.yml`
- `mcm-app/CHANGELOG.md`

**Out of scope**:
- `expo-sensors`, `@react-native-community/datetimepicker`,
  `expo-document-picker`, `react-native-confetti-cannon`,
  `react-native-qrcode-svg`, `expo-apple-authentication` — usados.
- Consolidar los 3 sistemas de modal/sheet EN USO (deuda DEBT-03, L, aparte).
- Subir versiones de nada — este plan solo elimina y pinea.
- `eas.json` — el suelo `>= 16.7.0` puede quedarse; el pineo va en workflows.

## Git workflow

- Branch: `advisor/006-higiene-deps` desde `main`.
- Dos commits: `chore(deps): eliminar 4 dependencias sin uso y jest duplicado`
  y `ci: pinear eas-cli y firebase-tools en los workflows`.
- **Nota OTA**: eliminar paquetes nativos NO rompe OTA (el JS no los
  referencia; el binario instalado simplemente conserva módulos sin uso hasta
  el próximo build de tienda). NO hace falta `[skip-ota]`. Menciónalo en la
  descripción del commit para el reviewer.
- No push / no PR salvo que el operador lo pida.

## Steps

### Step 1: Re-verificar que las 4 deps siguen muertas

```bash
cd mcm-app
for d in "@gorhom/bottom-sheet" "react-native-modal" "@react-native-picker/picker" "@react-native-community/slider"; do
  echo "== $d =="; grep -rn "$d" --include="*.ts" --include="*.tsx" --include="*.js" \
    app components hooks contexts utils services notifications constants types app.json metro.config.js babel.config.js || true
done
```

**Verify**: cero coincidencias para las cuatro. Si alguna aparece → STOP.

### Step 2: Eliminar del manifest y regenerar lockfile

Quita las 4 entradas de `dependencies` y la entrada `jest` de `dependencies`
(deja la de `devDependencies`). También revisa el bloque `overrides`
(`react-native-calendars` → safe-area-context se queda; no toques overrides).
Ejecuta `npm install` para regenerar `package-lock.json`.

**Verify**: `npm ls jest` → resuelve solo como dev; `npx tsc --noEmit` exit 0;
`npx jest --ci` all pass; `npm run lint` 0 errors.

### Step 3: Pinear CLIs en los 4 workflows

Determina la versión actual estable de cada CLI (la que los workflows han
estado usando con éxito — `npm view eas-cli version` y
`npm view firebase-tools version` en el momento de ejecutar este plan) y
sustituye `@latest` por esa versión exacta en:
- `deploy-firebase-rules.yml:56` (firebase-tools)
- `deploy-web.yml:48`, `ota-preview.yml:58`, `ota-production.yml:58` (eas-cli)

Añade un comentario YAML encima de cada pin:
`# Pineado a propósito — subir deliberadamente, no usar @latest (rompe releases)`.

Deja los scripts `eas:build*` de package.json como están (son interactivos,
de desarrollador local) O pinéalos a la misma versión — elige pinearlos solo
si el cambio es de una línea por script.

**Verify**: `grep -rn "@latest" .github/workflows/*.yml` → 0 coincidencias.

### Step 4: CHANGELOG

Entrada: eliminación de dependencias sin uso (lista) y pineo de CLIs de
release. (Cambio de dependencias = SÍ se documenta según CLAUDE.md.)

**Verify**: `npx jest --ci` → all pass.

## Test plan

No hay tests nuevos (cambio de manifest/CI). La verificación es la suite
existente completa + typecheck + lint tras regenerar el lockfile.

## Done criteria

- [ ] Las 4 dependencias y el `jest` runtime fuera de `package.json`; lockfile regenerado
- [ ] `npx tsc --noEmit`, `npm run lint`, `npx jest --ci` → todos exit 0
- [ ] 0 ocurrencias de `@latest` en `.github/workflows/`
- [ ] `git status` limpio fuera del scope; CHANGELOG + `plans/README.md` actualizados

## STOP conditions

- El Step 1 encuentra un import de cualquiera de las 4 deps (código nuevo
  desde el plan) — sácala del alcance y continúa con el resto.
- `npm install` produce un lockfile con cambios masivos no relacionados
  (señal de registry/config distinto) — reporta en vez de commitear un
  lockfile ruidoso.
- Los workflows usan features de una versión de CLI que no puedas determinar
  — pinea a la última estable y márcalo en el commit para review humana.

## Maintenance notes

- Revisar el pin de `eas-cli` al subir de Expo SDK (suelen ir emparejados).
- La detección de deps muertas debe repetirse tras la consolidación de
  modales (DEBT-03): si `components/BottomSheet.tsx` (custom) absorbe los
  diálogos de playlist, no deberían aparecer deps nuevas.
- Cuidado permanente con los imports dinámicos (`import('...')`) al auditar
  deps — `expo-sensors` es el precedente.
