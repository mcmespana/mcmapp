# Plan 015: Limpieza de módulos muertos y dependencias sin uso

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 40c6566..HEAD -- mcm-app/package.json mcm-app/components mcm-app/hooks`
> Si `package.json` o los módulos citados cambiaron, re-verificar cada
> "cero importadores" con los greps del Step 1 antes de borrar nada.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW para los borrados verificados; MED para `expo-insights` /
  `expo-system-ui` (pueden ser dependencias implícitas del pipeline de
  config de Expo) — por eso van en un paso aparte, condicionado a
  `expo-doctor`
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `40c6566`, 2026-08-05

## Why this matters

Seis módulos de código sin NINGÚN importador tipan, lintan y se mantienen
para nada (~340 líneas), y dos documentos los anuncian como vivos — incluso
hay trabajo pendiente en `TODO.md` asignado a `AppIconButton`, que no monta
nadie: ese TODO es literalmente inejecutable. En el manifest, `ts-jest` y
`copy-webpack-plugin` no los usa nada (jest usa `jest-expo`; no existe config
de webpack — el build es Metro), y `tailwind-merge`/`tailwind-variants` son
transitivas de heroui-native que el app pinnea sin necesidad. Cada entrada
sobrante alarga `npm ci` en CI/EAS y es superficie de advisories que triar.
Además `@expo/config` está en `dependencies` siendo build-time puro.

## Current state

**Módulos con cero importadores** (verificado por grep en `app/`,
`components/`, `hooks/`, `contexts/`, `utils/`, `services/`, `constants/`,
`__tests__/` — el nombre solo aparece en su propia definición):

| Módulo | Líneas | Nota |
| --- | --- | --- |
| `components/SongSearch.tsx` | 24 | listado en CLAUDE.md como vivo |
| `components/ExternalLink.tsx` | 26 | |
| `components/ui/AppIconButton.tsx` | 81 | TODO.md ("Pulido del glass") le asigna trabajo |
| `components/ui/CloseIconButton.tsx` | 80 | |
| `components/ui/GlassCard.tsx` | 117 | |
| `hooks/useUnreadNotificationsCount.ts` | 11 | listado en CLAUDE.md como vivo |

(NO muertos, comprobado: `hooks/useResponsive.ts` se re-exporta vía
`useResponsiveLayout.ts`; los `*.ios.tsx`/`*.web.ts` son resolución de
plataforma de Metro.)

**Manifest** (`mcm-app/package.json`, commit `40c6566`):

- `devDependencies`: `ts-jest` (l.107 — `jest.config.js` usa
  `preset: 'jest-expo'`, ningún transform lo menciona), `copy-webpack-plugin`
  (l.95 — no existe webpack config; el bundler es Metro vía
  `metro.config.js`).
- `dependencies`: `tailwind-merge` (l.80), `tailwind-variants` (l.81) — cero
  imports en el código propio; son deps de heroui-native. `@expo/config`
  (l.24) — solo lo usan `app.config.ts` y
  `plugins/withNotificationServiceExtension.js` (build-time) → debe ser
  devDependency. `expo-insights` (l.46) y `expo-system-ui` (l.59) — sin
  imports en el código, PERO pueden ser usados implícitamente por el config
  pipeline de Expo (`userInterfaceStyle: "automatic"` en app.json tira de
  expo-system-ui en algunos SDKs) → tratar aparte.
- ⚠️ **Regla OTA del repo**: quitar dependencias con código nativo cambia el
  binario → el commit que toque `expo-insights`/`expo-system-ui` lleva
  `[skip-ota]` y se avisa al operador (regla del CLAUDE.md raíz §7). Los
  borrados de código propio y de dev-deps NO lo necesitan.

## Commands you will need

| Purpose   | Command (desde `mcm-app/`)   | Expected on success |
|-----------|------------------------------|---------------------|
| Install   | `npm ci` / `npm install` (regenerar lockfile tras tocar el manifest) | exit 0 |
| Typecheck | `npm run typecheck` + `npm run typecheck:tests` | exit 0 |
| Tests     | `npm test`                   | all pass            |
| Lint      | `npm run lint`               | exit 0              |
| Doctor    | `npx expo-doctor`            | sin errores nuevos respecto a la línea base (correrlo ANTES y DESPUÉS) |
| Web smoke | `npm run web`                | arranca y pinta     |

## Scope

**In scope**:

- Borrar los 6 módulos listados
- `mcm-app/package.json` + `package-lock.json`
- `mcm-app/CLAUDE.md` (quitar `SongSearch` y `useUnreadNotificationsCount` de
  sus listas) y `mcm-app/TODO.md` (quitar la referencia a `AppIconButton` del
  ítem "Pulido del glass", dejando el resto del ítem)

**Out of scope** (do NOT touch):

- `tailwindcss` (l.82 — SÍ se usa: `global.css`), `react-dom`,
  `react-native-web` (target web), `uniwind`.
- El override de `react-native-safe-area-context` para
  `react-native-calendars` (l.111-114) — sin `npm ls` sobre un install real
  no hay veredicto; no tocar.
- `components/ui/GlassSurface.ios.tsx`, `GlassFAB.ios.tsx` — los glass VIVOS.
- Cualquier módulo no listado que "parezca" muerto — este plan borra
  exactamente los verificados.

## Git workflow

- Branch: la que indique el operador (o `advisor/015-dead-code-and-deps-cleanup`).
- **Tres commits separados** (código muerto / dev-deps+misplacement /
  nativos-condicionales) — el tercero con `[skip-ota]` si llega a existir.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: re-verificar y borrar el código muerto

Para CADA uno de los 6 módulos, re-correr el grep de importadores (por nombre
de símbolo y por ruta de archivo, p. ej.:
`grep -rn "SongSearch" mcm-app --include='*.ts*' | grep -v components/SongSearch`).
Con cero resultados → `git rm`. Actualizar CLAUDE.md y TODO.md en el mismo
commit (regla del repo: el doc se mueve con el código).

**Verify**: `npm run typecheck` + `npm run lint` + `npm test` → verdes.

### Step 2: dev-deps muertas y `@expo/config` a su sitio

En `package.json`: eliminar `ts-jest` y `copy-webpack-plugin`; eliminar
`tailwind-merge` y `tailwind-variants` de `dependencies`; mover
`@expo/config` a `devDependencies`. Regenerar lockfile (`npm install`),
luego `npm ci` limpio.

**Verify**: `npm ci` exit 0; `npm test` verde (si `ts-jest` era necesario,
jest lo diría aquí); `npm run typecheck` verde; `npm run web` arranca (si
heroui-native necesitaba los tailwind-* como peers directos, el arranque o el
lint de Metro lo dirá).

### Step 3 (condicional, commit aparte con `[skip-ota]`): los dos nativos

1. Línea base: `npx expo-doctor` ANTES de tocar nada de este paso.
2. Quitar `expo-insights`; correr `npx expo-doctor` y `npx expo config --type public`
   (debe generarse sin errores). Si doctor protesta o el config plugin lo
   lista → restaurar y anotar "en uso implícito".
3. Ídem `expo-system-ui` — con doble atención: `userInterfaceStyle` en
   `app.json` puede requerirlo; si `expo config` avisa o doctor lo pide,
   restaurar.
4. Si AMBOS se restauran, este commit no existe y el plan termina en el
   Step 2 (anotarlo en el README).

**Verify**: `npx expo-doctor` sin errores nuevos vs línea base; `npm run web`
arranca; el commit (si existe) lleva `[skip-ota]` y el informe final avisa al
operador de que el próximo binario de tienda debe compilarse antes de que
este cambio llegue a `production`.

## Test plan

- Sin tests nuevos: la suite existente + typecheck + lint + expo-doctor + web
  smoke SON la verificación de una limpieza.

## Done criteria

- [ ] Los 6 archivos no existen; `grep -rn "SongSearch\|useUnreadNotificationsCount\|AppIconButton\|CloseIconButton\|GlassCard\|ExternalLink" mcm-app --include='*.ts*'`
      → cero resultados fuera de CHANGELOG/docs históricos (GlassCard ≠
      GlassSurface/GlassFAB/GlassActionGroup — cuidado con el grep, usar
      límites de palabra si hace falta)
- [ ] `ts-jest`, `copy-webpack-plugin`, `tailwind-merge`, `tailwind-variants`
      fuera del manifest; `@expo/config` en devDependencies; lockfile
      regenerado y `npm ci` verde
- [ ] `npm test`, `npm run typecheck`, `npm run lint` verdes
- [ ] CLAUDE.md y TODO.md sin referencias a los módulos borrados
- [ ] Si el Step 3 tocó algo: commit separado con `[skip-ota]` y aviso al
      operador en el informe
- [ ] `plans/README.md` actualizado
- [ ] Entrada en `mcm-app/CHANGELOG.md` (borrado de componentes y deps: SÍ,
      breve, listando qué se fue)

## STOP conditions

- Cualquier grep del Step 1 devuelve un importador → ese módulo NO se borra;
  anotar y seguir con los demás.
- El operador tiene una rama en vuelo que adopta alguno de estos componentes
  (no verificable desde aquí) — el informe final debe pedir confirmación
  explícita ANTES de mergear este plan, no antes de ejecutarlo.
- `npm install` produce un lockfile con cambios masivos no relacionados
  (resoluciones que saltan de versión): parar y reportar — puede ser el
  momento equivocado para regenerarlo.
- Metro/web falla al arrancar tras el Step 2 → restaurar los `tailwind-*`
  (serían peers reales) y anotar.

## Maintenance notes

- Herramienta para el futuro (no en este plan): `knip` o `depcheck` en CI
  detectarían esto de forma continua; valorar cuando el ruido de config
  compense.
- `WordleScreen`/`wordle.tsx` NO están en este plan a propósito: congelados
  como referencia por decisión escrita en CLAUDE.md.
- Revisor: el diff del Step 1 debe ser solo borrados + 2 docs; ni una línea
  de lógica.
