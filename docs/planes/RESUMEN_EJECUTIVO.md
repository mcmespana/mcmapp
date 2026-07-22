# RESUMEN_EJECUTIVO — Planes de la MCM App

> Vista de pájaro de todos los planes de `docs/planes/`: categoría, estado,
> riesgo (ordenados de mayor a menor), qué requiere tu intervención y qué no, y
> el modelo recomendado para ejecutarlo (Fable / Sonnet / Opus), priorizando lo
> que está **más cerrado** (más listo para arrancar sin decisiones abiertas).
>
> **Fecha:** 2026-07-22 · Basado en los 6 documentos de `docs/planes/`.
>
> **Nota:** no existe ningún plan "generado por una skill de shadcn". Los únicos
> planes del repo son los 6 de abajo (idénticos en `main` y en esta rama). La
> única mención a shadcn es un pack de skills instalado (`shadcn/improve`), no
> un plan.

---

## Cómo leer la recomendación de modelo

| Modelo | Cuándo | Perfil de tarea |
| --- | --- | --- |
| **Fable** ⚡ | Lo más cerrado | Mecánico, 100 % especificado, reversible, bajo riesgo: `git mv`, migrar tokens, quitar `: any`, cambiar un componente por otro |
| **Sonnet** ⚖️ | Punto medio | Feature/refactor de un solo repo con patrón claro y tests, algo de criterio pero sin arquitectura nueva |
| **Opus** 🧠 | Lo más abierto/arriesgado | Cross-repo, seguridad, nativo (Swift/WidgetKit), decisiones arquitectónicas, ambigüedad, riesgo de incidente |

---

## Panorama (una fila por frente de trabajo)

| # | Plan / frente | Categoría | Estado | Riesgo | ¿Te necesita? | Modelo |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | **Integraciones · D (Seguridad Firebase)** | Backend / Seguridad · cross-repo | ⏳ Pendiente · prioridad **MÁXIMA** | 🔴 Muy alto (incidente en prod) | **SÍ** — decisión de auth (D2) + desplegar + smoke test | **Opus** |
| 2 | **Widget de Contigo** | Feature nativa (widget) | ⚪ Sin empezar | 🟠 Alto (nativo, store, no OTA) | **SÍ** — comprometer una release + App Group/cuenta Apple | **Opus** |
| 3 | **UI Nativa** | UI/UX · Design System | 🟡 En curso (Fase 1 casi hecha) | 🟠 Medio-alto (regresiones visuales, requiere dispositivo) | **SÍ** — 3 decisiones de producto bloquean fases | **Sonnet** (+ Fable en migraciones) |
| 4 | **Plan de Calidad** | Deuda técnica / Refactor | 🟡 En curso (Fase 0 hecha, Fase 1 parcial) | 🟡 Medio (Fase 1) → 🟢 bajo (resto) | Parcial — verificar en dispositivo; decidir Sentry (F6) | **Sonnet** F1/F5 · **Fable** F2/F4/F7 · **Opus** F3/F6 |
| 5 | **Integraciones · resto (A/B/C/E)** | Integraciones app↔panel↔cantoral | 🟢 Mayoría hecho; quedan C, E1, A2 | 🟢 Bajo (aditivo) · salvo A2 | Parcial — B4 smoke test; E1 elegir opción | **Sonnet** (+ Fable en C2/C3) |
| 6 | **Carismochito** | Feature / Gamificación | ⚪ Sin empezar | 🟢 Bajo (overlay OTA) · salvo §5 nativo | Ligera — taste de copy; decidir icono (§5) | **Sonnet** (Opus solo §5) |
| 7 | **MEJORAS.md** | Diagnóstico / Referencia | 📄 Foto de análisis (no ejecutable) | — (no se ejecuta) | Decisión i18n (§10) y privacidad (§7.4) | **N/A** — es contexto, no un plan de tareas |

---

## Detalle por riesgo (de mayor a menor)

### 🔴 1 · Integraciones — Integración D: Seguridad Firebase
**Categoría:** backend / seguridad, transversal y cross-repo (app + panel).
**Estado:** todo pendiente, marcado como **prioridad MÁXIMA** en el plan.
**Por qué es lo más arriesgado:** hoy las reglas reales de producción están
abiertas y hay un workflow (`deploy-firebase-rules.yml`) listo para desplegar
las reglas del repo; si alguien lo lanza **antes** de D1–D3, rompe el panel
entero. Es el único frente con riesgo de incidente real.
**Te necesita — SÍ, mucho:**
- **D2** — decisión arquitectónica: ¿Firebase Auth (Google) + `/admins/<uid>`, o
  mover todas las escrituras del panel a funciones `api/`? No se puede avanzar sin
  que elijas.
- **D4/D5** — desplegar reglas y hacer smoke test en app y panel; verificar
  `CRON_SECRET` en Vercel. Requiere tus credenciales/entorno.
**Modelo: Opus.** Cross-repo, seguridad y decisiones irreversibles.

### 🟠 2 · Widget de Contigo
**Categoría:** feature nativa (WidgetKit/SwiftUI en iOS, App Widget en Android).
**Estado:** sin empezar.
**Riesgo/complejidad:** todo es **código nativo → build de tienda, no OTA**
(`[skip-ota]`). Necesita App Group + contenedor compartido para pasar el estado
del día de la app al widget, y App Intents (Swift) si quieres marcar sin abrir.
**Te necesita — SÍ:** comprometer una release de tienda, configurar App
Group/cuenta Apple, y decidir alcance (iOS primero; Android 2ª fase; ¿App
Intents sí/no?).
**Modelo: Opus.** Es lo más técnico (Swift/WidgetKit, config plugins de targets,
sincronización app↔widget).

### 🟠 3 · UI Nativa
**Categoría:** unificación de UI + componentes nativos (headers, botones, inputs,
color, tokens).
**Estado:** **Fase 1 (headers) casi completa**; queda pulido fino del glass iOS 26
y decidir los headers "floating" de evento. El grueso pendiente es la Fase 2
(componentes) y siguientes.
**Riesgo:** medio-alto por **regresiones visuales**: extraer/unificar cabeceras y
pulsables rompe estilos, gestos y memoización de forma sutil → hay que **verificar
pantalla a pantalla en dispositivo**.
**Te necesita — SÍ, 3 decisiones de producto que bloquean fases:**
- Fase 1: ¿qué pantallas de Contigo/eventos pasan a header nativo plano y cuáles
  conservan el floating glass?
- Fase 2: ¿componente estándar de pulsación `PressableFeedback` (heroui) o wrapper
  propio?
- Fase 4: ¿Contigo y Eventos mantienen su paleta propia (warm / color por evento)
  o se alinean a marca?
**Modelo: Sonnet** para el grueso; **Fable** para la cola mecánica de Fase 2
(migrar los ~13 `TextInput` a `AppTextField`, `AppPrimaryButton`, `SegmentedControl`,
`EmptyState`, tokens). Los componentes base ya están creados.

### 🟡 4 · Plan de Calidad
**Categoría:** saneamiento de código / deuda técnica (gigantismo de archivos).
**Estado:** **Fase 0 (guardarraíles) hecha** (ESLint muro, logger central, CI,
lint-staged). Fase 1 parcial (Grupos, EvaluationWizard, NotificationsBottomSheet,
PreviewChannelModal ya troceados). Es **el plan más cerrado y estructurado** de
todos: fases, orden, criterios de salida.
**Riesgo:** medio en Fase 1 (refactor con "cero cambios de comportamiento", pero
puede romper estilos/gestos si no se verifica); **bajo** en el resto.
**Te necesita — poco:** verificación en dispositivo por PR; decisión de cuenta
Sentry en Fase 6.
**Modelo por fase:**
- **Fable** ⚡ — Fase 2 (mover carpetas: `git mv` + imports), Fase 4.1 (quitar los
  63 `: any`), Fase 7 (tokens boy-scout). Muy mecánico y cerrado.
- **Sonnet** ⚖️ — Fase 1 (descuartizar los gigantes, con test en el mismo PR) y
  Fase 5 (tests).
- **Opus** 🧠 — Fase 3 (contexts: medir re-renders y decidir fusiones) y Fase 6
  (Sentry: nativo + decisión).

### 🟢 5 · Integraciones — resto (A, B, C, E)
**Categoría:** coherencia app↔panel↔cantoral.
**Estado:** **la mayoría ya hecha** (A1, A3, A4.1, A4.3, B1–B4). Pendientes:
- **A2** — proteger endpoints de envío push (`x-panel-key` + `PANEL_API_KEY`). Sube
  el listón pero la solución real es la Integración D.
- **C1** (derivar `delegationList`), **C2** (unificar seeds), **C3** (documentar
  `appReviewMode`), **C4** (validaciones) — prioridad baja/media, aditivos.
- **E1** — proteger ediciones del cantoral del panel frente al uploader (elegir
  opción a: solo-lectura, recomendada).
- **A4.2** (channels Android) y **A4.4** (NSE iOS) — aparcados por decisión/dispositivo.
**Riesgo:** bajo (aditivo), salvo A2 (toca envío de push).
**Te necesita — puntual:** **B4** requiere un smoke test contra Firebase real
(guardar en el panel mientras un dispositivo escribe una respuesta de evaluación);
**E1** requiere que elijas opción a/b.
**Modelo: Sonnet** (bien definido, un repo por acción); **Fable** para C2/C3
(copiar seed, documentar).

### 🟢 6 · Carismochito
**Categoría:** feature lúdica / gamificación (modo secreto por agitado).
**Estado:** el modo base existe; el plan añade comportamiento, onboarding,
aparición global, colección y (opcional) icono nativo.
**Riesgo:** bajo — §1–4 son **overlay OTA**, no tocan la lógica de pantallas.
Excepción: **§5 (icono alternativo de la app)** es nativo → build de tienda.
**Te necesita — ligera:** taste en el copy del onboarding (§2) y decidir si el
icono nativo (§5) compensa para un modo efímero.
**Modelo: Sonnet** para §1–4 (hay criterio de UX/persistencia con login); **Opus**
solo para §5 (icono nativo).

### 📄 7 · MEJORAS.md
**Categoría:** diagnóstico técnico transversal — **no es un plan de tareas**, es la
foto del análisis de mayo 2026. Sus acciones accionables ya se migraron a
`TODO.md` y a `PLAN_CALIDAD.md`.
**Qué te necesita (decisiones abiertas que siguen ahí):**
- §10 — ¿multilenguaje (catalán/portugués/inglés) sí o no? Si es "no por ahora",
  conviene dejarlo escrito para que los agentes no metan i18n por su cuenta.
- §7.4 — ¿hace falta pantalla de política de privacidad/consentimiento para stores
  europeas + push?
**Modelo: N/A** — se usa como contexto, no se "ejecuta".

---

## Priorización recomendada (lo más cerrado primero)

**Listo para arrancar YA, sin esperar decisiones tuyas** (los más cerrados):

1. **Calidad · Fase 1** (seguir troceando gigantes: `SelectedSongsScreen`,
   `onboarding`, `index` Home…) → **Sonnet**. Es el trabajo más definido del repo.
2. **Calidad · Fase 2/4/7** (mover carpetas, quitar `: any`, tokens) → **Fable**.
   Mecánico y reversible.
3. **UI · Fase 2 cola de componentes** (migrar `TextInput`→`AppTextField`,
   `AppPrimaryButton`, `EmptyState`, `SegmentedControl`) → **Fable/Sonnet**. Base
   ya creada.
4. **Carismochito · §1–2** (comportamiento + onboarding, OTA) → **Sonnet**.
5. **Integraciones · C2/C3/E1** (aditivos de bajo riesgo) → **Fable/Sonnet**.

**Bloqueado hasta que decidas** (no arrancar sin tu input):

- **Integraciones · D** — elige el modelo de auth (D2) antes de nada. **Máxima
  prioridad de seguridad**, pero necesita tu decisión + tu entorno para desplegar.
- **UI · Fases 1(resto)/4** — deciden identidad visual (floating vs nativo, paleta).
- **Widget de Contigo** — decide si va a una release de tienda.
- **Carismochito · §5** y **A4.2/A4.4** — nativo/dispositivo, decisión explícita.

**Regla de oro para todo:** un PR = un tema; cero cambios de comportamiento en los
refactors; verificar con la app corriendo (no solo typecheck), sobre todo en UI y
en la Fase 1 de Calidad.

---

## Resumen en una frase

Si solo se hace **una cosa**: cierra la **Integración D (seguridad)** porque es la
única con riesgo de incidente — pero necesita tu decisión primero. Mientras tanto,
lo **más productivo y cerrado** para lanzar sin fricción es seguir la **Fase 1 del
Plan de Calidad** (Sonnet) y las **migraciones mecánicas** de Calidad F2/F4/F7 y de
UI Fase 2 (Fable).
