# RESUMEN_EJECUTIVO — Todos los planes de la MCM App

> Vista de pájaro de **las dos familias de planes** del repo: los tácticos
> numerados de `plans/` (skill `improve` de shadcn) y los estratégicos de
> `docs/planes/`. Para cada uno: categoría, estado, riesgo (ordenados de mayor a
> menor), qué requiere tu intervención y qué no, y el modelo recomendado
> (Fable / Sonnet / Opus) priorizando lo **más cerrado** (listo para arrancar sin
> decisiones abiertas).
>
> **Fecha:** 2026-07-22.

## Las dos familias

| Familia | Carpeta | Qué son | Nº |
| --- | --- | --- | --- |
| **A — Tácticos** | `plans/` | Planes de implementación **numerados y ejecutables paso a paso** (STOP conditions, done criteria, comandos de verificación). Generados por la skill `improve` de shadcn (auditoría deep, 2026-07-18, PR #297). **Lo más cerrado del repo.** | 8 (001–008) |
| **B — Estratégicos** | `docs/planes/` | Planes **temáticos/de dirección** (calidad, integraciones, UI, features). Más abiertos, con fases y decisiones de producto. | 6 |

> Corrección a una nota anterior: **sí existen los planes de shadcn** — están en
> `plans/` (raíz), no en `docs/planes/`, por eso no aparecían al mirar solo esa
> carpeta.

## Cómo leer la recomendación de modelo

| Modelo | Cuándo | Perfil |
| --- | --- | --- |
| **Fable** ⚡ | Lo más cerrado | Mecánico, 100 % especificado, reversible: `git mv`, tokens, quitar `: any`, cambiar un componente por otro |
| **Sonnet** ⚖️ | Punto medio | Feature/refactor de un repo con patrón claro y tests; algo de criterio |
| **Opus** 🧠 | Lo más abierto/arriesgado | Cross-repo, seguridad, nativo (Swift/WidgetKit), decisiones arquitectónicas, ambigüedad |

---

## Familia A — Planes tácticos `plans/` (001–008)

| # | Título | Cat. | Prio | Esf | Estado | Riesgo | ¿Te necesita? | Modelo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Escapar metadatos de canción en el WebView (XSS) | Seguridad | P1 | S | ✅ **DONE** | — | No | — |
| 002 | Fechas locales: "hoy" UTC en Home/Calendario/reflexión | Bug | P1 | S | ✅ **DONE** | — | No | — |
| 003 | Reflexiones: escritura atómica + conservar texto si falla | Bug | P1 | S | ✅ **DONE** | — | No | — |
| 006 | Higiene de deps (4 muertas) + pinear CLIs en pipelines | Deuda | P2 | S | ✅ **DONE** | — | No | — |
| 004 | Contigo: sync bidireccional de hábitos/revisiones + tests | Bug | P1 | M | ⏳ **TODO** | 🟢 Bajo-medio | **No** — patrón ya validado (bookmarks), con tests | **Sonnet** |
| 005 | Scraper: vacío=error, fecha inválida vetada, pytest en CI, workflow sin inyección | Bug+Seguridad | P1 | M | ⏳ **TODO** | 🟢 Bajo | Casi no — opcional rotar service account | **Sonnet** |
| 007 | Privacidad: respuestas de encuestas dejan de ser públicas (reglas versionadas) | Seguridad/PII | P1* | M | ⏳ **TODO** | 🟠 Medio (cross-repo) | Edit del fichero: no · **Deploy: SÍ** (bloqueado por Integración D) | **Sonnet** (edit) / **Opus** (deploy) |
| 008 | Caché compartida en `useFirebaseData` + calendario stale-while-revalidate | Perf | P2 | M | ⏳ **TODO** | 🟠 Medio (hook central) | No, pero hacer al final | **Opus** |

**Los 4 pendientes, de un vistazo:**
- **004** — hoy los hábitos de Contigo se suben a la nube pero **no se leen de vuelta**: reinstalar/cambiar de móvil = pierdes rachas y heatmap aunque estén en RTDB. Replica el patrón ya validado de bookmarks + añade tests a `authHelpers` (hoy sin ninguno, e incluye `deleteUserData` = borrado de cuenta).
- **005** — el scraper de lecturas puede **fallar en silencio** (0 datos = Action verde) o escribir la lectura del día bajo la clave `unknown`; además tiene un test en rojo que nadie ve (no hay pytest en CI) y una **inyección de script** en el workflow (`${{ inputs.date }}` crudo en un job con el service account de Firebase Admin).
- **007** — las respuestas **no anónimas** de encuestas (nombre real, delegación, uid de menores/jóvenes) son **legibles públicamente** por la cascada de `.read: true` en `/surveys` y `/activities`. El fichero de reglas se arregla ya; el **deploy** sigue bloqueado por la Integración D (auth del panel).
- **008** — `useFirebaseData` cachea por instancia: el nodo `songs` se re-parsea 3 veces, y el calendario descarga todos los ICS en cada pantalla sin usar caché estando online. Es el cambio de **más radio** (hook central) → dejar para el final, tras 001–005.

> **Backlog auditado sin plan propio** (en `plans/README.md`): códigos de 4
> dígitos brute-forceables en playlists/coro (SEC-03, decisión de producto),
> centralizar escrituras RTDB repetidas en ~30 archivos (DEBT-01), duplicación de
> constantes de fecha (DEBT-02), varios tests (cloudPlaylistService, parser ICS…).

---

## Familia B — Planes estratégicos `docs/planes/`

| # | Plan / frente | Categoría | Estado | Riesgo | ¿Te necesita? | Modelo |
| --- | --- | --- | --- | --- | --- | --- |
| B1 | **Integraciones · D (Seguridad Firebase)** | Backend/Seguridad · cross-repo | ⏳ Pendiente · **MÁXIMA** | 🔴 Muy alto (incidente prod) | **SÍ** — decisión auth (D2) + deploy + smoke test | **Opus** |
| B2 | **Widget de Contigo** | Feature nativa | ⚪ Sin empezar | 🟠 Alto (nativo, store, no OTA) | **SÍ** — comprometer release + App Group/cuenta Apple | **Opus** |
| B3 | **UI Nativa** | UI/UX · Design System | 🟡 Fase 1 casi hecha | 🟠 Medio-alto (regresiones visuales) | **SÍ** — 3 decisiones de producto | **Sonnet** (+Fable) |
| B4 | **Plan de Calidad** | Deuda técnica/Refactor | 🟡 F0 hecha, F1 parcial | 🟡 Medio→🟢 bajo | Poco — verificar en dispositivo | **Sonnet** F1/F5 · **Fable** F2/F4/F7 · **Opus** F3/F6 |
| B5 | **Integraciones · resto (A/B/C/E)** | Integraciones app↔panel↔cantoral | 🟢 Mayoría hecho | 🟢 Bajo (salvo A2) | Puntual — B4 smoke test, E1 elegir | **Sonnet** (+Fable C2/C3) |
| B6 | **Carismochito** | Feature/Gamificación | ⚪ Sin empezar | 🟢 Bajo (OTA, salvo §5) | Ligera — copy + decidir icono | **Sonnet** (Opus §5) |
| — | **MEJORAS.md** | Diagnóstico (no ejecutable) | 📄 Foto de análisis | — | Decisión i18n + privacidad | **N/A** |

**Detalle de los estratégicos (por riesgo):**
- **B1 · Integración D (Seguridad Firebase)** — 🔴 lo más arriesgado de todo. Las reglas reales de prod están abiertas y hay un workflow listo para desplegar; lanzarlo antes de D1–D3 rompe el panel entero. **Necesita tu decisión de auth (D2: Firebase Auth+`/admins` vs mover escrituras a `api/`)** y tu entorno para desplegar. Modelo: **Opus**.
- **B2 · Widget de Contigo** — todo nativo (WidgetKit/SwiftUI, App Group, App Intents) → **build de tienda, no OTA**. Necesitas comprometer una release. Modelo: **Opus**.
- **B3 · UI Nativa** — Fase 1 (headers) casi lista; queda pulido del glass iOS 26 y la Fase 2 (componentes). Riesgo por regresiones visuales → verificar en dispositivo. **3 decisiones de producto bloquean fases** (floating vs nativo; primitiva de pulsación; paleta de Contigo/Eventos). Modelo: **Sonnet**, **Fable** en la cola mecánica.
- **B4 · Plan de Calidad** — el estratégico **más cerrado**: Fase 0 hecha, Fase 1 parcial. **Fable** para F2 (mover carpetas), F4.1 (quitar `: any`), F7 (tokens); **Sonnet** para F1 (gigantes) y F5 (tests); **Opus** para F3 (contexts) y F6 (Sentry, nativo).
- **B5 · Integraciones resto** — casi todo hecho (A1/A3/A4.1/A4.3, B1–B4). Quedan A2 (proteger endpoints push), C1–C4, E1 (cantoral solo-lectura). Aditivo y de bajo riesgo. B4 pide un smoke test contra Firebase real; E1 pide elegir opción. Modelo: **Sonnet**.
- **B6 · Carismochito** — §1–4 son overlay OTA de bajo riesgo (comportamiento, onboarding, aparición global, colección con login); §5 (icono nativo) es build de tienda. Modelo: **Sonnet** (Opus solo §5).
- **MEJORAS.md** — diagnóstico, no se ejecuta; sus tareas ya se migraron a `TODO.md`/`PLAN_CALIDAD.md`. Decisiones abiertas que siguen: i18n (§10) y política de privacidad (§7.4).

---

## Orden global por riesgo (mayor → menor)

1. 🔴 **B1 · Integración D (Seguridad Firebase)** — único con riesgo de incidente en prod. **Bloqueado por tu decisión.**
2. 🟠 **007 · Privacidad de respuestas** (edit ya; deploy atado a D) — PII de menores.
3. 🟠 **B2 · Widget de Contigo** — nativo, store, no OTA.
4. 🟠 **B3 · UI Nativa** — regresiones visuales; decisiones de producto.
5. 🟠 **008 · Caché central `useFirebaseData`** — hook de datos de más radio.
6. 🟡 **B4 · Calidad · Fase 1 (gigantes)** — refactor con cero cambios de comportamiento.
7. 🟢 **004 · Contigo sync**, **005 · Scraper** — cerrados, bajo riesgo, sin decisiones.
8. 🟢 **B5 · Integraciones resto**, **B6 · Carismochito**, **Calidad F2/F4/F7** — aditivos/mecánicos.

## Priorización recomendada (lo más cerrado primero)

**Listo para arrancar YA, sin esperar decisiones tuyas:**

1. **Plan 004 (Contigo sync)** y **Plan 005 (Scraper)** → **Sonnet**. Son los planes **más cerrados de todo el repo**: paso a paso, con tests y criterios de salida; sin dependencias ni decisiones. Empezar por aquí.
2. **Calidad · Fase 1** (seguir gigantes: `SelectedSongsScreen`, `onboarding`, Home) → **Sonnet**.
3. **Calidad · F2/F4/F7** + **Plan 007 (edit de reglas)** + **UI Fase 2 (componentes)** → **Fable/Sonnet** (mecánico).
4. **Carismochito §1–2** (OTA) → **Sonnet**.
5. **Plan 008 (caché central)** → **Opus**, pero al final (tras 001–005).

**Bloqueado hasta que decidas:**
- **Integración D** — elige el modelo de auth (D2) antes de nada. Máxima prioridad de seguridad; también desbloquea el **deploy** del Plan 007.
- **UI Fases 1(resto)/4** — identidad visual (floating vs nativo, paleta).
- **Widget de Contigo** — ¿va a una release de tienda?
- **Carismochito §5** y **A4.2/A4.4** — nativo/dispositivo, decisión explícita.

**Regla de oro:** un PR = un tema; cero cambios de comportamiento en los refactors;
verificar con la app corriendo, no solo typecheck.

## En una frase

Lo **urgente** es la **Integración D** (único riesgo de incidente), pero necesita
tu decisión primero. Lo **más rentable y cerrado para lanzar hoy sin fricción** son
los **planes tácticos 004 y 005** (Sonnet) y las **migraciones mecánicas** de
Calidad F2/F4/F7 y UI Fase 2 (Fable).
