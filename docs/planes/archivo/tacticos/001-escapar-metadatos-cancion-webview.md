# Plan 001: Escapar metadatos de canción antes de inyectarlos en el WebView del cantoral

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 2d2822c..HEAD -- mcm-app/hooks/useSongProcessor.ts mcm-app/components/SongDisplay.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `2d2822c`, 2026-07-18

## Why this matters

El nodo `/songs/data` de Firebase RTDB es escribible públicamente (decisión
documentada en `docs/SEGURIDAD.md` §3.1: el "panel secreto" usa una contraseña
en el código, no Firebase Auth). Eso convierte **todo el contenido de las
canciones en entrada no confiable**. `hooks/useSongProcessor.ts` interpola
`author`, `title` y otros campos **sin escapar** dentro del HTML que se
renderiza en un `react-native-webview` con JavaScript habilitado y
`originWhitelist={['*']}`. Un título/autor manipulado se convierte en marcado
activo (scripts) que se ejecuta en el WebView de cada dispositivo que abre la
canción — puede hablar con el bridge `window.ReactNativeWebView`, navegar a
cualquier URL o pintar UI de phishing. Esto va **más allá** del tradeoff
documentado ("escritura pública = spam/vandalismo"); es ejecución de código.

## Current state

Archivos relevantes:

- `mcm-app/hooks/useSongProcessor.ts` — genera el HTML completo de la canción.
  Ya existe un helper `escapeHtml` en el propio archivo (~línea 146) que hoy
  solo se usa para el contexto de errores de parseo:

  ```ts
  // useSongProcessor.ts:146
  const escapeHtml = (s: string): string =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  ```

  Interpolaciones sin escapar (verificadas):

  ```ts
  // useSongProcessor.ts:546-548
  if (author && !isFullscreen) {
    metaInsert += `<div class="song-meta-author">${author}</div>`;
  }
  // useSongProcessor.ts:575
  if (author) fsMeta += `<span class="fs-author">${author}</span>`;
  // useSongProcessor.ts:590
  fsHeader = `<div class="fs-header">${title ? `<div class="fs-title">${title}</div>` : ''}${fsMeta ? `<div class="fs-meta">${fsMeta}</div>` : ''}</div>`;
  ```

  (Los badges de `displayKey`/`capo`/`transpose` en :556-570 y :576-589 pasan
  por `convertChord`/`transposeKey` o son numéricos — revisa si `key` puede
  contener texto libre del ChordPro y escápalo también si es el caso.)

- `mcm-app/components/SongDisplay.tsx` — renderiza ese HTML:

  ```tsx
  // SongDisplay.tsx:194-197
  <WebView
    ref={webViewRef}
    originWhitelist={['*']}
    source={{ html: songHtml }}
  ```

- La letra/acordes pasan por ChordSheetJS `HtmlDivFormatter` — verificar en el
  paso 3 si escapa HTML embebido; si no, ampliar el escape a ese camino.

Convenciones: TypeScript estricto, logger central `@/utils/logger` (nunca
`console.*`), Prettier con comillas simples. Tests en `mcm-app/__tests__/`
con jest; `__tests__/useSongProcessor.test.ts` ya existe — úsalo como patrón.

## Commands you will need

| Purpose   | Command (desde `mcm-app/`)             | Expected on success |
|-----------|----------------------------------------|---------------------|
| Install   | `npm ci`                               | exit 0              |
| Typecheck | `npx tsc --noEmit`                     | exit 0              |
| Tests     | `npx jest useSongProcessor --ci`       | all pass            |
| Lint      | `npm run lint`                         | 0 errors            |

## Scope

**In scope** (únicos archivos a modificar):
- `mcm-app/hooks/useSongProcessor.ts`
- `mcm-app/components/SongDisplay.tsx`
- `mcm-app/__tests__/useSongProcessor.test.ts`
- `mcm-app/CHANGELOG.md` (entrada nueva arriba, formato `## YYYY-MM-DD HH:MM — Título`)

**Out of scope** (NO tocar aunque parezca relacionado):
- `components/SecretPanelModal.tsx` y la contraseña del panel — tradeoff
  documentado aparte (SEGURIDAD.md §3.1), no lo "arregles" de pasada.
- `mcm-app/database.rules.json` — las reglas NO deben desplegarse aún
  (SEGURIDAD.md bloque "NO DESPLIEGUES").
- `utils/formatText.ts` (BBCode) — sink distinto, hallazgo aparte.
- Cualquier cambio en el protocolo `postMessage` del WebView existente.

## Git workflow

- Branch: `advisor/001-escape-song-webview` desde `main`.
- Commits estilo repo (español, prefijo tipo `fix:`), p.ej.
  `fix(cantoral): escapar metadatos de canción antes de inyectar en el WebView`.
- No push / no PR salvo que el operador lo pida.

## Steps

### Step 1: Escapar todas las cadenas de origen Firebase interpoladas en el HTML

En `useSongProcessor.ts`, aplica `escapeHtml(...)` a `author`, `title` y a
cualquier otra cadena derivada del ChordPro (p.ej. `key` si es texto libre) en
TODOS los puntos de interpolación listados en "Current state" (:547, :575,
:590 y los badges si aplica). Si `escapeHtml` está declarado más abajo del
primer uso, muévelo arriba del archivo (es una arrow function — no tiene
hoisting).

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 2: Endurecer el WebView

En `SongDisplay.tsx`:
1. Sustituye `originWhitelist={['*']}` por `originWhitelist={['about:*']}`
   (el HTML se carga inline vía `source={{html}}`, que resuelve como
   `about:blank`).
2. Añade `onShouldStartLoadWithRequest` que solo permita la carga inicial
   (`about:blank`) y devuelva `false` para todo lo demás (los estilos y el
   bootstrap van inline; no hay navegaciones legítimas). Si algún flujo
   existente abre enlaces desde la canción, STOP condition.

**Verify**: `npx jest useSongProcessor --ci` → pass; arranque manual si hay
entorno: la canción renderiza igual (título, autor, acordes, transpose).

### Step 3: Verificar el camino de la letra (ChordSheetJS)

Escribe un test que meta `<script>` y `<img onerror=...>` en (a) el título,
(b) el autor y (c) una línea de letra de un ChordPro de prueba, y asserta que
el HTML resultante NO contiene las etiquetas activas (deben aparecer
escapadas `&lt;script&gt;`). Si el caso (c) falla porque `HtmlDivFormatter`
no escapa, añade un pre-escape del contenido de letra antes de formatear —
pero verifica primero con el test, no asumas.

**Verify**: `npx jest useSongProcessor --ci` → all pass, incluidos los 3 casos nuevos.

### Step 4: CHANGELOG

Añade entrada en `mcm-app/CHANGELOG.md` (arriba del todo, con fecha y hora):
cambio de seguridad en el render del cantoral.

**Verify**: `npm run lint` → 0 errors.

## Test plan

- Nuevos tests en `__tests__/useSongProcessor.test.ts` (seguir el patrón de
  los tests existentes en ese archivo): título malicioso, autor malicioso,
  letra maliciosa → HTML sin etiquetas activas; y un caso de regresión de que
  `&` en un título normal ("Tú & Yo") se muestra bien (una sola vez escapado).
- `npx jest useSongProcessor --ci` → todo verde.

## Done criteria

- [ ] `npx tsc --noEmit` exit 0
- [ ] `npx jest --ci` exit 0, con ≥3 tests nuevos de escape
- [ ] `grep -n 'originWhitelist' mcm-app/components/SongDisplay.tsx` no contiene `'*'`
- [ ] Las líneas :547/:575/:590 (o sus equivalentes tras el cambio) pasan por `escapeHtml`
- [ ] `git status` no muestra archivos modificados fuera del scope
- [ ] Entrada en CHANGELOG.md y fila actualizada en `plans/README.md`

## STOP conditions

- Los extractos de "Current state" no coinciden con el código vivo (drift).
- Existe un flujo legítimo que navega desde el WebView de canción (buscar
  `onShouldStartLoadWithRequest`/`Linking` en `SongDisplay.tsx` y el HTML
  generado); en ese caso reporta antes de bloquear navegaciones.
- El test del paso 3(c) muestra que ChordSheetJS ya escapa y tu pre-escape
  produce doble escape visible — revierte el pre-escape y deja solo el test.
- Cualquier cambio necesario en el protocolo `postMessage` (fuera de scope).

## Maintenance notes

- Cualquier campo nuevo del ChordPro que se interpole en el HTML del WebView
  debe pasar por `escapeHtml` — el review de PRs futuros sobre
  `useSongProcessor.ts` debe vigilarlo.
- Si algún día el cantoral añade enlaces dentro de la canción, el
  `onShouldStartLoadWithRequest` del paso 2 tendrá que permitir esquemas
  concretos (https a dominios conocidos), no volver a `['*']`.
- Endurecimiento de fondo pendiente (fuera de este plan): auth real para el
  panel del cantoral (SEGURIDAD.md §3.1, PLAN_INTEGRACIONES Integración D).
