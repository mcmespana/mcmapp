# Implementation Plans

Generados por la skill `improve` (auditoría **deep**) el 2026-07-18, sobre el
commit `2d2822c`. Cada executor: lee el plan completo antes de empezar, respeta
sus STOP conditions y actualiza tu fila al terminar.

> **El orden real de ejecución (combinando estos planes tácticos con los
> estratégicos de `docs/planes/`) vive en `docs/planes/BACKLOG.md`** — esta
> tabla es el detalle de la tanda táctica, no la cola global. Consulta el
> backlog antes de decidir qué toca ahora.

> Selección: la auditoría corrió de forma no interactiva; se escribieron
> planes para los 8 hallazgos de mayor leverage (impacto ÷ esfuerzo,
> ponderado por confianza). El resto queda en el backlog de abajo.

## Execution order & status

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 001  | Escapar metadatos de canción en el WebView del cantoral (XSS) | P1 | S | — | DONE |
| 002  | Fechas locales: "hoy" UTC en Home/Calendario y fecha de reflexión | P1 | S | — | DONE |
| 003  | Reflexiones: escritura atómica + conservar texto si falla | P1 | S | 002 (misma pantalla, coordinar) | DONE |
| 004  | Contigo: sync bidireccional de hábitos/revisiones + tests authHelpers | P1 | M | — | DONE |
| 005  | Scraper: vacío=error, fecha inválida vetada, pytest en CI, workflow sin inyección | P1 | M | — | DONE |
| 006  | Higiene de deps (4 muertas, jest dup) + pinear CLIs en pipelines | P2 | S | — | DONE |
| 007  | ~~Privacidad: respuestas de encuestas dejan de ser legibles públicamente~~ | P1* | M | — | **REJECTED** (2026-07-22, decisión de producto — ver `docs/planes/BACKLOG.md` §3) |
| 008  | Caché compartida en useFirebaseData + calendario stale-while-revalidate | P2 | M | mejor tras 001-005 | TODO |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (con motivo) | REJECTED (con motivo)

## Dependency notes

- **003 tras 002**: ambos tocan `ReflexionesScreen.tsx` (003 respeta la línea
  de fecha que 002 cambia). Ejecutables en cualquier orden, pero no en
  paralelo.
- **007**: ~~el cambio al fichero versionado es ejecutable ya...~~ **REJECTED**
  el 2026-07-22 — decisión de producto, el panel debe ver las respuestas. Ver
  banner de anulación en `plans/007-privacidad-respuestas-encuestas.md` y
  `docs/planes/BACKLOG.md` §3.
- **008 al final**: es el cambio con más radio de acción (hook central de
  datos); mejor con el resto de fixes ya asentados.

## Quick wins sin plan propio (una línea cada uno, hacer de pasada)

- [x] _(hecho 2026-07-19)_ `notifications/usePushNotifications.ts` — el
  `catch {}` vacío de `registerAndSaveToken` ahora loguea con
  `logger.error`.
- [x] _(hecho 2026-07-19)_ `app/screens/ReflexionesScreen.tsx` — `useToast`
  migrado de `heroui-native` a `@/contexts/AppToastContext` (misma API).
- [x] _(hecho 2026-07-19)_ `TabScreenWrapper.ios.tsx` renombrado a
  `TabScreenWrapper.tsx` (era cross-platform; imports sin extensión).
- [x] _(hecho 2026-07-19, parcial)_ Docs: corregidos CLAUDE.md (conteo de
  tests, `utils/firebaseApp.ts`), TODO.md (React Compiler ya activo,
  conteos) y README raíz (`expo-cli` deprecado, chuleta de builds vía
  `npm run eas:build*`). Pendiente: MEJORAS.md §11 (describe husky/CI de un
  estado anterior — es un doc-foto con disclaimer, prioridad mínima).

## Backlog de hallazgos auditados sin plan (candidatos a próxima tanda)

Correctness: mutaciones de hábitos con closure stale (C-07, MED);
`useCalendarEvents` catch vacío por calendario (C-08 — lo cubre el plan 008);
"move code" no atómico en choir/playlist (C-09, MED). Seguridad: entropía de
códigos de 4 dígitos brute-forceables en playlists/coro (SEC-03, HIGH —
requiere decisión de producto sobre UX del código); breakout de atributo en
BBCode `[color=]` (SEC-05, severidad baja); allowlist de esquemas en
`Linking.openURL` de notificaciones (SEC-06, baja). Tests: cloudPlaylistService
(TEST-02), surveyIdentity (TEST-03), parser ICS (TEST-04), render tests de
gigantes (TEST-05, ya tracked), stats de contigo (TEST-06), useReaderBookmarks
(TEST-07). Scraper: validación de shape/contenido antes de escribir
(SCRAPER-03), tests de los caminos de fallback (SCRAPER-06). Deuda:
centralizar escrituras RTDB (`getDatabase(getFirebaseApp())` repetido en ~30
archivos, DEBT-01); constantes de fechas ES duplicadas 7+ veces + `formatDate`
byte-a-byte duplicado (DEBT-02); consolidar los 3 sistemas de modal/sheet EN
USO (DEBT-03, L); test de consistencia catálogo↔seed de perfiles (DEBT-06);
haptics directos fuera del wrapper `h.*` (DEBT-07).

## Dirección de producto (opciones para el mantenedor, no problemas)

1. **Home dinámica (opción A del TODO)** — el mantenedor ya la especificó y
   marcó recomendada; los datos ya existen (evento activo, encuestas, hábitos).
2. **Eventos 100% creables desde el panel** — `constants/events.ts` es la
   única manivela manual del pipeline sin-deploy; PLAN_INTEGRACIONES B1 lo
   nombra como hueco restante.
3. **Command Palette v2** — deep-link a canciones/contenidos (TODO prioridad
   alta + docstring del propio componente) y traerla a nativo.
4. **Listado persistente de encuestas abiertas** — nombrado en
   ENCUESTAS.md "Mejoras futuras"; `useActiveSurveys` + `SurveyBanner` ya
   hacen el trabajo pesado.
5. **Sync del estado leído de notificaciones a la cuenta** — asimetría clara
   con el precedente de bookmarks (`users/<uid>/...`).
6. **La parte OTA-able del plan Contigo** — recordatorio local diario +
   rachas en Home, antes del widget nativo (el propio
   PLAN_WIDGET_CONTIGO §4 la separa).

## Follow-up 2026-07-22 (post-005) — visibilidad del resumen

> Pedido explícito tras 005: los fallos parciales ya rompían el exit code
> correctamente, pero no había ningún resumen visible sin abrir logs
> completos, y el skip por "no es la hora" quedaba enterrado en texto plano.

- **`main.py`**: nuevas `_append_step_summary`/`_build_summary_markdown` —
  al final de cada run (normal o `--cleanup-only`) escriben una tabla
  markdown con el resultado por fuente (`✅ OK` / `❌ N error(es)`) en
  `$GITHUB_STEP_SUMMARY` (pestaña "Summary" del run de Actions). No-op fuera
  de Actions (ejecución local). No cambia exit codes ni ningún
  comportamiento existente — solo visibilidad.
- **Workflow**: el job `check-time` ahora escribe también su veredicto
  (procede / omitido) al step summary, y usa `::notice::` en el caso
  "omitido" para que aparezca como anotación visible en la lista de checks
  del run sin abrir logs — antes quedaba indistinguible de un día con
  scraping real completado.
- 3 tests nuevos (`tests/test_main.py`). Suite 102→105 verde.

## Ejecución 2026-07-22 (plan 005)

- **005**: los 4 pasos aplicados tal como estaba planeado. Sin drift. Entorno
  local necesitó `cffi` (dependencia transitiva rota de `cryptography` en
  este contenedor) para poder importar `firebase.client` en los tests —
  nada que ver con el código del scraper. 5 tests nuevos
  (`tests/test_base.py`: fecha ISO; `tests/test_main.py`: fetch vacío/con
  solo `None`), más el test que estaba en rojo, arreglado. Suite completa
  97→102 verde. Workflow: paso de pytest añadido antes del scraper, y los 4
  inputs (`date`/`dry_run`/`backfill_dominicos`/`cleanup_only`) pasan a leerse
  vía `env:` (`INPUT_*`), ninguno queda interpolado dentro de `run:`.

## Ejecución 2026-07-22 (plan 004)

- **004**: hidratación implementada tal como estaba planeada
  (`fetchContigoHabits`/`fetchContigoRevisions` en `authHelpers.ts`, merge
  puro en `utils/contigoMerge.ts`, efecto en `useContigoHabits.ts` dependiente
  de `authUser`, hidratación de texto en `revision.tsx`). Sin drift real: el
  único cambio detectado en `useContigoHabits.ts` desde que se escribió el
  plan fue el refactor de `localISO` (Plan 002, ya DONE), ajeno al alcance.
  19 tests nuevos (`authHelpers.test.ts` + `contigoMerge.test.ts`). Suite
  completa 32/302 verde, typecheck y lint limpios. Detalle en
  `mcm-app/CHANGELOG.md` 2026-07-22 20:15.

## Ejecución 2026-07-19 (planes 001, 002, 003, 006)

- **001**: además de escapar `author`/`title`/el badge de tono (`key`) en
  `useSongProcessor.ts`, se descubrió durante la ejecución que
  `HtmlDivFormatter` de ChordSheetJS **no escapa nada** de lo que extrae del
  propio ChordPro (`{title:}`, comentarios, letra) — verificado
  empíricamente (`{title: <script>}` → `<h1><script>` literal). Se amplió el
  fix para escapar el ChordPro completo justo antes de parsear (dentro de
  `parseChordPro`), preservando el texto sin escapar para el contexto de
  error (evita doble-escape en la pantalla de error de sintaxis). Efecto
  secundario aceptado y documentado en el código: si la línea del error
  contiene `& < > "` antes del punto exacto del fallo, la columna reportada
  puede desplazarse levemente (la línea sigue siendo correcta).
  **Hallazgo relacionado sin arreglar (fuera de scope de este plan):**
  `utils/playlistPdfHtml.ts` usa el mismo `ChordProParser`+`HtmlDivFormatter`
  sin escapar para el PDF de playlists — mismo patrón vulnerable, consumidor
  distinto. Candidato a un plan 001b.
- **006**: ejecutado y cherry-picked a `production` — se determinó
  OTA-safe: las 4 dependencias eliminadas no tenían NINGÚN import (ni
  estático ni dinámico) antes del cambio, así que el bundle JS es idéntico
  antes/después (el mecanismo de crash de OTA que describe `CLAUDE.md`
  requiere referenciar un módulo nativo AUSENTE del binario — aquí no hay
  ninguna referencia, ni antes ni después). El pin de `eas:build*` en
  `package.json` (scripts de desarrollador local) se dejó deliberadamente en
  `@latest` — el riesgo real está en los pipelines de CI, no en el uso
  interactivo local.
- **004 y 005 quedan pendientes** (esfuerzo M, no "cortitos") para una
  siguiente tanda.

## Findings considered and rejected

- `expo-sensors` "sin uso" (reporte de subagente): **falso** — se carga con
  import dinámico en `hooks/useShakeDetector.ts:49`. No eliminar. (Los greps
  de deps muertas deben incluir `import('...')`.)
- Workflow de deploy de reglas como hallazgo standalone (SEC-04): la tensión
  workflow-vs-doc es real pero el "no desplegar" está documentado y el
  workflow solo se dispara en push a `production` tocando el fichero —
  degradado a nota dentro del plan 007.
- Contraseña hardcodeada del panel del cantoral + escritura pública de
  `/songs`: tradeoff documentado (SEGURIDAD.md §3.1) — no re-reportado; el
  riesgo NUEVO que habilita (XSS) sí tiene plan (001).
- Issues de memoización/re-render (context values, renderItem inline,
  filtrado por tecla): el React Compiler está activo y los memoiza — no son
  hallazgos.
- Expansión multi-día de `useCalendarEvents` con `toISOString`: roundtrip
  UTC autoconsistente, no produce drift — no es bug.
- Wordle dormido, accordion custom, toggle de ExportPdfModal: decisiones
  deliberadas documentadas — no son deuda.
- GitHub Actions versions, pinning del scraper Python, `.env.example`,
  lifecycle del service account en CI: auditados y sanos — sin hallazgos.

## Baseline de verificación (medido en esta auditoría, commit `2d2822c`)

`npx tsc --noEmit` limpio · `npm run lint` 0 errores / 31 warnings
(max-lines) · `npx jest --ci` 28 suites / 267 tests verdes ·
`npm audit --omit=dev`: 1 crítica (websocket-driver vía
`firebase→@firebase/database→faye-websocket`, cadena Node no empaquetada en
el bundle RN — riesgo real bajo, se resuelve con bumps de `firebase`) + 18
moderadas (cadenas build-time de `@expo/config-plugins`).

## Lo que NO cubrió esta auditoría

Rendimiento medido en dispositivo (solo análisis estático); las reglas RTDB
**vivas** de la consola de Firebase (solo el fichero versionado — SEGURIDAD.md
admite que las vivas son "probablemente más abiertas"); el repo mcmpanel
(fuera de este monorepo); `portadas-albumes/` (assets); accesibilidad en
dispositivo real (tracked en TODO); y el contenido de los nodos reales de
Firebase.
