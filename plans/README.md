# Implementation Plans

Generados por la skill `improve` (auditoría **deep**) el 2026-07-18, sobre el
commit `2d2822c`. Ejecutar en el orden de la tabla salvo que las dependencias
digan otra cosa. Cada executor: lee el plan completo antes de empezar, respeta
sus STOP conditions y actualiza tu fila al terminar.

> Selección: la auditoría corrió de forma no interactiva; se escribieron
> planes para los 8 hallazgos de mayor leverage (impacto ÷ esfuerzo,
> ponderado por confianza). El resto queda en el backlog de abajo.

## Execution order & status

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 001  | Escapar metadatos de canción en el WebView del cantoral (XSS) | P1 | S | — | TODO |
| 002  | Fechas locales: "hoy" UTC en Home/Calendario y fecha de reflexión | P1 | S | — | TODO |
| 003  | Reflexiones: escritura atómica + conservar texto si falla | P1 | S | 002 (misma pantalla, coordinar) | TODO |
| 004  | Contigo: sync bidireccional de hábitos/revisiones + tests authHelpers | P1 | M | — | TODO |
| 005  | Scraper: vacío=error, fecha inválida vetada, pytest en CI, workflow sin inyección | P1 | M | — | TODO |
| 006  | Higiene de deps (4 muertas, jest dup) + pinear CLIs en pipelines | P2 | S | — | TODO |
| 007  | Privacidad: respuestas de encuestas dejan de ser legibles públicamente (reglas versionadas) | P1* | M | — (deploy bloqueado por Integración D) | TODO |
| 008  | Caché compartida en useFirebaseData + calendario stale-while-revalidate | P2 | M | mejor tras 001-005 | TODO |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (con motivo) | REJECTED (con motivo)

## Dependency notes

- **003 tras 002**: ambos tocan `ReflexionesScreen.tsx` (003 respeta la línea
  de fecha que 002 cambia). Ejecutables en cualquier orden, pero no en
  paralelo.
- **007**: el cambio al fichero versionado es ejecutable ya; el **despliegue**
  de reglas sigue bloqueado por el prerequisito documentado en
  `docs/SEGURIDAD.md` (auth real en mcmpanel — "Integración D" de
  `docs/planes/PLAN_INTEGRACIONES.md`). El plan NO despliega nada.
- **008 al final**: es el cambio con más radio de acción (hook central de
  datos); mejor con el resto de fixes ya asentados.

## Quick wins sin plan propio (una línea cada uno, hacer de pasada)

- `notifications/usePushNotifications.ts:370` — el `catch {}` vacío de
  `registerAndSaveToken` traga todos los fallos de registro push pese a que
  el docstring promete "logging detallado": añadir `logger.error(...)`.
- `app/screens/ReflexionesScreen.tsx:18` — único uso del `useToast` de
  `heroui-native`; el resto del repo usa `@/contexts/AppToastContext`
  (misma API). Lo corrige el plan 003 de paso.
- `components/ui/TabScreenWrapper.ios.tsx` — es cross-platform (branch
  interno `Platform.OS !== 'ios'`) pero lleva sufijo `.ios` y se importa con
  extensión explícita en 2 sitios: renombrar a `TabScreenWrapper.tsx`.
- Docs desactualizados (corregir en una pasada): `mcm-app/CLAUDE.md` dice
  "16 ficheros / 150 tests" (hay 28 / 267) y "app inicializada en
  `hooks/firebaseApp.ts`" (es `utils/firebaseApp.ts`); `TODO.md` lista el
  React Compiler como pendiente (ya está activo en `babel.config.js` +
  `app.json`); `README.md` raíz instala `expo-cli` deprecado y enseña
  `eas build` directo contradiciendo la regla de CLAUDE.md; MEJORAS.md §11
  describe husky/CI de un estado anterior (ya resuelto).

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
