# PLAN_CALIDAD.md — Plan de saneamiento de código de la MCM App

> Plan de trabajo para mejorar la calidad del código, reducir la deuda técnica y frenar su crecimiento.
> Complementa a `MEJORAS.md` (análisis transversal de 2026-05-21): aquel documento diagnostica; éste planifica la ejecución con fases, orden y criterios de salida.
>
> **Fecha:** 2026-06-10 · Datos medidos sobre el código actual de `main`, no heredados del análisis de mayo.
>
> **Cómo usarlo:** las fases van en orden de impacto. La Fase 0 es barata y frena el deterioro; hacedla aunque no se haga nada más. Marcad cada ítem al completarlo y anotad el PR. Convenciones del repo: documentar cambios relevantes en `mcm-app/CHANGELOG.md` y mantener `mcm-app/TODO.md`.

---

## Diagnóstico resumido (medido 2026-06-10)

La app **no está rota estructuralmente**: la arquitectura base es razonable (Expo Router, contexts, hooks, `useFirebaseData` con caché AsyncStorage, tokens en `constants/`), hay CI en PRs (typecheck + lint + test), 12 ficheros de test y reglas de Firebase versionadas con workflow de deploy. Buena parte de `MEJORAS.md` ya se ejecutó.

El problema real es **gigantismo de archivos y deuda acumulada por crecer rápido**, más una organización de carpetas que se quedó pequeña:

| Síntoma | Medido hoy | Tendencia |
| --- | --- | --- |
| Archivos > 1.000 líneas | **9** | Eran 2 en mayo — empeora rápido |
| `console.*` en código | 113 | Eran 99 en mayo — sube |
| `: any` explícitos | 63 | — |
| Contexts | 15, anidados en pirámide en `_layout.tsx` | — |
| `prettier/prettier` en ESLint | `warn` (no bloquea) | — |
| Crash reporting | Ninguno — los crashes en producción son invisibles | — |
| LOC totales (app/components/hooks/contexts/utils/services) | ~54.000 | — |

**Los 9 gigantes** (líneas medidas):

| Archivo | Líneas |
| --- | --- |
| `mcm-app/app/onboarding.tsx` | 1.894 |
| `mcm-app/app/screens/SelectedSongsScreen.tsx` | 1.839 |
| `mcm-app/app/(tabs)/index.tsx` | 1.713 |
| `mcm-app/app/(tabs)/contigo/evangelio.tsx` | 1.295 |
| `mcm-app/app/(tabs)/contigo/oracion.tsx` | 1.170 |
| `mcm-app/app/(tabs)/calendario.tsx` | 1.123 |
| `mcm-app/components/SecretPanelModal.tsx` | 1.121 |
| `mcm-app/app/screens/GruposScreen.tsx` | 1.100 |
| `mcm-app/components/contigo/HomeWidgets.tsx` | 1.075 |

(Y en la cola: `notifications.tsx` 994, `EvaluationWizard.tsx` 974, `NotificationsBottomSheet.tsx` 937, `PreviewChannelModal.tsx` 847…)

**Lo grave es la tendencia**: cada feature nueva engorda un archivo existente en vez de extraer. Sin freno, en 6 meses habrá 15 archivos de +1.500 líneas. De ahí que la Fase 0 (guardarraíles) vaya primero.

---

## Fase 0 — Frenar el deterioro (1 día · hacer YA · todo OTA-safe)

Objetivo: que el problema deje de crecer mientras se arregla el resto.

- [x] **0.1 — ESLint como muro** (`mcm-app/eslint.config.js`): _hecho 2026-06-28._
  - [x] `'prettier/prettier': 'error'`.
  - [x] `'no-console': 'error'` — con override solo para `utils/logger.ts` (la migración de `console.*` está completa, 0 en el código).
  - [x] `'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }]` — `warn` a propósito (señala 13 gigantes + archivos nuevos sin bloquear los legacy en CI). Cuando la Fase 1 termine, subir a `error` con `max: 800`.
  - [ ] `'@typescript-eslint/no-explicit-any': 'warn'` → pendiente: hay 66 `: any` en archivos grandes; con `lint-staged --max-warnings=0` activar el `warn` bloquearía cualquier commit que toque esos archivos. Activar al limpiarlos (Fase 4.1) o, si se quiere ya, hacerlo a la vez que se eliminan.
- [x] **0.2 — Logger central** (`mcm-app/utils/logger.ts`): _hecho._ Niveles `debug/info/log/warn/error`; `debug`/`info`/`log` silenciados en producción (gate por `__DEV__`); enganche `setReporter` listo para Sentry (Fase 6). **Migración completada: 0 `console.*` en el código** (test en `__tests__/logger.test.ts`).
- [x] **0.3 — `lint-staged` con ESLint** (raíz `package.json`): _hecho._ Corre `prettier --write` + `eslint --max-warnings=0 --fix` para `mcm-app/**/*.{js,jsx,ts,tsx}`. `.husky/pre-commit` (`npx lint-staged`) restaurado.
- [ ] **0.4 — Regla escrita en `mcm-app/CLAUDE.md`**: _hecho 2026-06-28_ (sección «Convenciones de código»): «Ningún archivo nuevo > 400 líneas; si una pantalla supera 600, extraer componentes/hooks ANTES de añadir la feature.»

**Criterio de salida:** ✅ lint en CI bloquea formato y `console.*`; CI corre `typecheck` + `typecheck:tests` + `lint` + `test` en PRs; regla anti-gigantes documentada. Pendiente solo el `no-explicit-any: warn` (atado a Fase 4.1).

---

## Fase 1 — Descuartizar los 9 gigantes (~2-3 semanas · 1-2 archivos por PR)

Objetivo: ninguna pantalla > 800 líneas; cada pantalla = composición de componentes + un hook de lógica.

**Patrón por archivo** (igual en todos, sin cambiar comportamiento):

1. Extraer subcomponentes visuales a `components/<área>/` (seguir el patrón ya existente de `components/playlist/`, `components/contigo/`, `components/song-media/`).
2. Extraer la lógica de estado/efectos a un hook `use<Pantalla>.ts` en `hooks/`.
3. Extraer helpers puros (formateo, URLs, parsing) a `utils/` **con test** (ver Fase 4).
4. Un PR por archivo. Cero cambios de comportamiento: si aparece un bug, fix en PR aparte.

**Orden por dolor** (frecuencia de cambio × tamaño):

- [ ] **1.1 — `SelectedSongsScreen.tsx` (1.839)** — la más tocada del repo (playlist, coro, PDF, QR). Extraer `usePlaylistActions`, `useChoirActions`, el item de lista, y apoyarse en los modales ya extraídos en `components/playlist/`.
- [ ] **1.2 — `onboarding.tsx` (1.894)** — trocear por paso: `components/onboarding/Step*.tsx` + hook `useOnboardingFlow` con la máquina de estados.
- [ ] **1.3 — `(tabs)/index.tsx` (1.713)** — la Home. Extraer cada widget/sección a `components/home/`.
- [ ] **1.4 — `contigo/evangelio.tsx` (1.295) + `contigo/oracion.tsx` (1.170)** — mismo dominio; sospecha fuerte de duplicación entre ambas. **Antes de trocear, comparar**: lo común va a `components/contigo/` y a un hook compartido; después trocear lo que quede.
- [ ] **1.5 — `calendario.tsx` (1.123)**.
- [ ] **1.6 — `SecretPanelModal.tsx` (1.121)** — panel admin; trocear por sección del panel.
- [ ] **1.7 — `GruposScreen.tsx` (1.100)** — tiene 4 variantes de render con `.map()` anidados (ver MEJORAS §1.4); al trocear, migrar a `SectionList` con `GrupoItem`/`MiembroRow` memoizados (mata dos pájaros).
- [ ] **1.8 — `HomeWidgets.tsx` (1.075)** — un archivo con N widgets dentro; partirlo en un archivo por widget.
- [ ] **1.9 — Segunda ronda** (si hay energía): `notifications.tsx` (994), `EvaluationWizard.tsx` (974), `NotificationsBottomSheet.tsx` (937), ~~`PreviewChannelModal.tsx` (847)~~ **hecho 2026-06-28** → 349 líneas; piezas decorativas extraídas a `components/preview-channel/` (`AnimatedGradients`, `FloatingParticle`, `ConfettiBurst`, `GiantLever`, `LabDecorations`). Gigantes: 13 → 12.

**Verificación de cada PR:** la app corriendo (web como mínimo, `npm run web`), no solo typecheck — extraer componentes rompe sutilmente estilos, gestos y memoización.

**Criterio de salida:** ningún archivo > 800 líneas en `app/` ni `components/`.

---

## Fase 2 — Organización de carpetas y nombres (~1 semana · puede solaparse con Fase 1)

> Pedido explícito: el orden, las carpetas y los nombres de archivo no siempre están bien. Hallazgos concretos y propuesta.

### 2.1 Hallazgos

- [ ] **`app/screens/` dentro de `app/` es una anomalía de Expo Router.** Todo lo que vive bajo `app/` es una ruta para expo-router, pero `app/screens/*` son pantallas de **react-navigation** registradas a mano dentro de stacks (`cancionero.tsx`, `mas.tsx` vía `eventStackScreens.tsx`). Funciona porque algo las excluye o nunca se navega a ellas por URL, pero es el patrón híbrido que más confunde a quien llega de nuevas (y a los agentes IA). **Propuesta:** mover `app/screens/` → `mcm-app/screens/` (fuera de `app/`), que `app/` contenga SOLO rutas expo-router. Cambio mecánico de imports, un PR.
- [ ] **Duplicidad ruta-fina vs pantalla:** `app/wordle.tsx` + `app/screens/WordleScreen.tsx`, `app/evaluacion-app.tsx` + `app/screens/EvaluacionAppScreen.tsx`… El wrapper de ruta es razonable, pero el criterio de cuándo existe wrapper y cuándo la ruta ES la pantalla (p. ej. `onboarding.tsx`, `calendario.tsx`) no está escrito. **Propuesta:** documentar el criterio en `mcm-app/CLAUDE.md` (ruta = wrapper fino que monta la pantalla; pantalla = en `screens/`).
- [ ] **`components/` raíz con ~49 archivos planos** y solo 4 subcarpetas (`contigo/`, `playlist/`, `song-media/`, `ui/`). Conviven sin orden: cantoral (`SongControls`, `SongDisplay`, `SongSearch`, `SongListItem`, `TransposeBottomSheet`, `SongFontBottomSheet`, `SuggestSongModal`, `ArrangementInputModal`, `AlbumCard`), notificaciones (`NotificationsBottomSheet`, `NotificationPermissionBanner`), eventos (`EventItem`, `EventActionButtons`, `EventDetailsBottomSheet`), admin/secret (`SecretPanelModal`, `SecretMenuTrigger`, `PreviewChannelModal`), carismochito (3 archivos), feedback (`AppFeedbackModal`, `ReportBugsModal`, `EvaluationWizard`, `StarRating`, `SurveyBanner`), auth (`LoginSheet`, `LoginNudgeBanner`, `SocialLoginSection`), banners/sistema (`OfflineBanner`, `OTAUpdatePrompt`, `AddToHomeBanner`, `MaintenanceScreen`, `ErrorBoundary`…). **Propuesta de estructura:**

  ```
  components/
  ├── song/          ← cantoral: SongControls, SongDisplay, SongSearch, SongListItem,
  │                     TransposeBottomSheet, SongFontBottomSheet, AlbumCard, SuggestSongModal,
  │                     ArrangementInputModal (+ absorber song-media/)
  ├── playlist/      ← ya existe
  ├── contigo/       ← ya existe
  ├── home/          ← nueva (Fase 1.3)
  ├── onboarding/    ← nueva (Fase 1.2)
  ├── events/        ← EventItem, EventActionButtons, EventDetailsBottomSheet
  ├── notifications/ ← NotificationsBottomSheet, NotificationPermissionBanner
  ├── admin/         ← SecretPanelModal, SecretMenuTrigger, PreviewChannelModal
  ├── auth/          ← LoginSheet, LoginNudgeBanner, SocialLoginSection
  ├── feedback/      ← AppFeedbackModal, ReportBugsModal, EvaluationWizard, StarRating, SurveyBanner
  ├── carismochito/  ← CarismochitoOverlay, CarismochitoMascot, CarismochitoChargeDots
  ├── system/        ← ErrorBoundary, OfflineBanner, OTAUpdatePrompt, AddToHomeBanner,
  │                     MaintenanceScreen, FirebaseConfigErrorScreen, VersionDisplay
  └── ui/            ← ya existe: primitivas genéricas (BottomSheet, ContextMenuSheet,
                        ThemedText, ThemedView, ProgressWithMessage, DateSelector…)
  ```

  Mover en 2-3 PRs mecánicos (solo `git mv` + imports), idealmente cuando la Fase 1 ya haya tocado cada área para no pisarse.
- [ ] **Idiomas mezclados en nombres:** `GruposScreen`, `ContactosScreen`, `ComidaScreen` (español) vs `SongListScreen`, `CategoriesScreen` (inglés); rutas en español (`calendario`, `fotos`, `visitapapa`) — esto último está bien porque son URLs visibles al usuario. **Propuesta de convención** (documentar, aplicar solo al tocar archivos, NO renombrar en masa): rutas de `app/` en español (cara al usuario); código (componentes, hooks, utils, tipos) en inglés; dominio con nombre propio se queda (Carismochito, Wordle, Jubileo).
- [ ] **Nombres de archivo inconsistentes:** `eventStackScreens.tsx` (camelCase) junto a `EventHomeScreen.tsx` (PascalCase) en la misma carpeta. Convención: PascalCase si exporta un componente; camelCase para módulos sin componente (hooks, utils, catálogos).
- [ ] **`utils/` mezcla helpers puros con infraestructura:** `firebaseApp.ts`, `firebaseAuth*.ts`, `platformAuth*.ts` son infraestructura/servicios, no utilidades. **Propuesta:** moverlos a `services/` (donde ya viven `choirSessionService`, `cloudPlaylistService`, `pushNotificationService`); `utils/` queda solo con funciones puras (lo testeable sin mocks).
- [ ] **`styles/` casi vacía** (un solo CSS module de comunica) mientras los tokens viven en `constants/` y los estilos inline en cada componente. No crear nada nuevo: o se elimina `styles/` moviendo el CSS module junto a su pantalla, o se documenta que los tokens van en `constants/` y `styles/` no se usa.
- [ ] **`constants/` es un cajón de sastre** (tokens de diseño + config de Firebase + catálogos de perfiles/tabs + datos de encuestas). Aceptable a corto plazo; si molesta, separar `constants/design/` (colors, spacing, typography, animations, breakpoints, uiStyles) de `constants/config/` (firebase, events, catalogs). Prioridad baja.

### 2.2 Reglas del refactor de carpetas

- Solo `git mv` + actualización de imports por PR — **nunca** mezclar movimientos con cambios de lógica (el diff se vuelve irrevisable y se pierde el blame).
- Actualizar `mcm-app/CLAUDE.md` y `AGENTS.md` con la estructura nueva en el mismo PR que mueve.
- `npx tsc --noEmit` + arrancar la app tras cada PR de movimiento (Metro/expo-router cachean rutas; limpiar con `npx expo start -c` si hay fantasmas).

**Criterio de salida:** `app/` solo contiene rutas; `components/` agrupado por dominio; convención de nombres escrita en CLAUDE.md.

---

## Fase 3 — Contexts y providers (~1 semana)

- [ ] **3.1 — Auditar la pareja `SettingsContext` vs `AppSettingsContext`**: dos contexts con nombre casi idéntico. Averiguar si es duplicación histórica o separación real (cantoral vs app); si se solapan, fusionar; si no, renombrar para que el nombre cuente la diferencia (p. ej. `SongDisplaySettingsContext`).
- [ ] **3.2 — Fusionar contexts afines**: `UserProfileContext` + `ProfileConfigContext` se consumen casi siempre juntos (ya sugerido en MEJORAS §2.2).
- [ ] **3.3 — `AppProviders.tsx`**: componente que encapsule la pirámide de providers; `_layout.tsx` queda legible.
- [ ] **3.4 — Re-renders**: donde se sospeche cascada, **medir primero** con React DevTools Profiler; solo entonces separar `state`/`actions` en contexts gemelos o usar `use-context-selector`. No optimizar a ciegas.

**Criterio de salida:** ≤ 12 contexts, pirámide encapsulada, decisión Settings/AppSettings documentada.

---

## Fase 4 — Tipos y duplicación (~1 semana · solapable con Fase 1)

- [ ] **4.1 — Eliminar los 63 `: any`** módulo a módulo. Al terminar: `'@typescript-eslint/no-explicit-any': 'error'`.
- [x] **4.2 — Incluir `__tests__` en typecheck**: _hecho 2026-06-28._ Creado `tsconfig.test.json` (extiende el base + incluye `__tests__`), script `npm run typecheck:tests`, y añadido como paso del CI (`.github/workflows/ci.yml`). Los tests tipan limpios.
- [ ] **4.3 — Pasada de duplicación con `jscpd`** (informe, no gate de CI). Candidatos ya sospechados: `evangelio.tsx` ↔ `oracion.tsx`, las 4 variantes de render de `GruposScreen`, modales de export.

---

## Fase 5 — Tests donde duele (continuo)

Ya hay 18 ficheros en `__tests__/` / 183 tests (jest-expo + RTL). Prioridades (coinciden con `mcm-app/TODO.md`):

- [x] **5.1 — `useSongProcessor`** (núcleo del cantoral): _hecho 2026-06-28._ `__tests__/useSongProcessor.test.ts` (17 tests) — vía `renderHook` sobre el HTML generado: badges de tono/cejilla/transpose, notación EN/ES, clases de `<body>` (acordes ocultos, tema oscuro), modo presentación y `styleState`.
- [x] **5.2 — `useChoirSession`** (concurrencia maestro/oyentes): _hecho 2026-06-28._ Cubierto a nivel de servicio en `__tests__/choirSessionService.test.ts` (16 tests): validación de código, forma del payload + expiración 2 semanas, limpieza de `undefined`, publicaciones del maestro y traspaso de sesión entre códigos con sus casos de error.
- [ ] **5.3 — Reducers/lógica de los contexts** tocados en Fase 3 (la fusión los vuelve testeables).
- [ ] **5.4 — Regla de trabajo:** cada hook o util extraído en Fase 1 **sale con su test en el mismo PR**. Así la cobertura crece con el refactor, no como proyecto aparte que nunca llega.

---

## Fase 6 — Observabilidad (2-3 días · requiere decisión y build nativo)

- [ ] **6.1 — Sentry** (`@sentry/react-native`): hoy un crash en producción es invisible; `ErrorBoundary` pinta UI pero no reporta. ⚠️ **Código nativo** → build de tienda + commit con `[skip-ota]` (regla del repo).
- [ ] **6.2 — Conectar Sentry como transport** del logger de la Fase 0 (los `error`/`warn` de producción llegan solos).
- [ ] **6.3 — `ErrorBoundary` reporta** a Sentry además de pintar el fallback.

---

## Fase 7 — Tokens de diseño (gradual · sin fecha · regla boy-scout)

- [ ] Migrar `radii`/`shadows`/tipografía inline a los tokens de `constants/` **solo al tocar cada archivo** por otra razón (Fases 1-2 tocarán casi todos). Como proyecto aparte sería un PR de 5.000 líneas que nadie puede revisar.
- [ ] Unificar pesos de fuente y `borderRadius` de modales según `docs/desarrollo/DESIGN.md` (MEJORAS §5.2).

---

## Reglas transversales (válidas para todas las fases)

1. **Un PR = un archivo gigante, un movimiento de carpetas o un tema.** Refactor mezclado con feature = irrevisable.
2. **Cero cambios de comportamiento en Fases 1-4.** Bug encontrado → PR separado.
3. **Verificar con la app corriendo**, no solo con typecheck.
4. **Marcar avances** aquí y en `mcm-app/TODO.md`; cambios relevantes a `mcm-app/CHANGELOG.md`.
5. **Nada de renombrados masivos "porque sí"**: los movimientos de la Fase 2 son los listados, con `git mv`, y se acabó.

## Estimación y orden recomendado

| Fase | Esfuerzo | ¿Solapable? |
| --- | --- | --- |
| 0 — Guardarraíles | 1 día | — (primero) |
| 1 — Gigantes | 2-3 semanas | Con 2, 4, 5 |
| 2 — Carpetas/nombres | 1 semana | Con 1 (coordinar áreas) |
| 3 — Contexts | 1 semana | Tras 1.3 (Home) |
| 4 — Tipos/duplicación | 1 semana | Con 1 |
| 5 — Tests | Continuo | Embebido en 1 |
| 6 — Observabilidad | 2-3 días | Independiente (necesita build nativo) |
| 7 — Tokens | Gradual | Boy-scout |

**Total estimado: 4-6 semanas** a ritmo sostenido. Si solo se hace una cosa: **Fase 0**.
