# BACKLOG.md — Fuente única de verdad del orden de ejecución

> **Qué es esto:** el único sitio donde se decide **qué se hace ahora, qué es
> lo siguiente, y qué está bloqueado por una decisión tuya**. Antes de este
> documento la información vivía repartida entre `plans/README.md`,
> `docs/planes/*.md` y conversaciones sueltas — este archivo la sustituye
> como punto de entrada. Los documentos técnicos de detalle (`plans/00X-*.md`,
> `docs/planes/PLAN_*.md`) siguen siendo la referencia profunda de CADA ítem;
> este documento solo dice **el orden y quién decide qué**.
>
> **Regla para cualquier agente/conversación que retome este trabajo:** lee
> este documento ENTERO antes de tocar nada. No re-derives prioridades desde
> cero ni mires solo `plans/README.md` o un `docs/planes/PLAN_*.md` suelto.
>
> Última actualización: 2026-07-22.

---

## 🧭 Puntero rápido

> **Si el usuario dice "seguimos": el siguiente ítem no empezado de la Cola
> Principal (abajo) es el que toca.** Ahora mismo eso es el **Plan 005**.
>
> Actualiza esta caja cada vez que se cierra un ítem — es lo primero que
> lee cualquiera que retome esto.

| | |
|---|---|
| **Ahora mismo (en curso / siguiente)** | Plan 005 (scraper) |
| **Después** | Plan 008 (Opus) |
| **Bloqueado, no tocar sin preguntar** | Integración D, Widget de Contigo, Panel Pañuelo |
| **Oportunista (solo si piden hueco)** | Calidad Fase 1, Integraciones resto, bolsa nativa |
| **Hecho hoy** | ✅ Plan 004 (2026-07-22) — ver `mcm-app/CHANGELOG.md` |

---

## 📜 Protocolo de trabajo (léelo antes de ejecutar nada)

1. **"Seguimos"** → coge el primer ítem **no completado** de la Cola
   Principal (§1). Si tiene 🔒 (bloqueado por decisión), **para y pregunta**
   usando la pregunta exacta de la tabla de §4 — no lo ejecutes a ciegas, no
   inventes la decisión. Si no tiene 🔒, ejecútalo siguiendo su documento
   técnico (`plans/00X-*.md` tiene pasos/STOP conditions/done criteria
   literales; `docs/planes/PLAN_*.md` es más abierto, usa criterio).
2. **Al terminar un ítem**: actualiza (a) el puntero rápido de arriba, (b) la
   fila de la Cola Principal (§1), y (c) el estado en el documento de origen
   (`plans/README.md` para tácticos, la cabecera del `PLAN_*.md` para
   estratégicos). Si hubo cambio de código real, entrada nueva en
   `mcm-app/CHANGELOG.md` (fecha+hora, arriba del todo — regla del CLAUDE.md
   raíz).
3. **"Me sobran tokens [esta semana], ¿por dónde seguimos?"** (o cualquier
   variante de "tengo hueco/capacidad de sobra") → **esto NO avanza la Cola
   Principal**. Es una señal distinta: muestra el estado actual de este
   backlog (Cola Principal + Bolsa Oportunista de §2) y deja que el usuario
   reprioridad. La sugerencia por defecto para ese hueco es **Calidad · Fase
   1** (descuartizar gigantes, §2.A), pero no la ejecutes sin confirmar — el
   usuario puede preferir otra cosa de la bolsa.
4. **Nunca ejecutes un ítem 🔒 sin preguntar primero**, aunque parezca
   evidente qué elegir. Son decisiones de producto/seguridad del usuario, no
   del ejecutor.
5. **Integración D es cross-repo**: la parte de este repo (`mcmapp`) es solo
   D3 (completar `database.rules.json`). D1/D2/D4/D5 viven en `mcmpanel`, que
   normalmente NO está en el scope de la sesión — hay que pedir al usuario
   que lo añada (`add_repo`) antes de tocar esa parte.

---

## 1. Cola Principal (orden secuencial — "seguimos" avanza aquí)

| # | Ítem | Modelo | 🔒 Decisión | Estado | Documento técnico |
|---|---|---|---|---|---|
| 1 | **Plan 004** — Contigo: sync bidireccional de hábitos/revisiones + tests `authHelpers` | Sonnet | No | ✅ **DONE** (2026-07-22) | `plans/004-contigo-sync-bidireccional.md` |
| 2 | **Plan 005** — Scraper: vacío=error, fecha vetada, pytest en CI, workflow sin inyección | Sonnet | No | ⏳ Siguiente | `plans/005-scraper-fiabilidad-y-ci.md` |
| 3 | **Plan 008** — Caché compartida `useFirebaseData` + calendario stale-while-revalidate | **Opus** — revisar rendimiento real (medir antes/después, no solo análisis estático); es el cambio de mayor radio de todo el backlog | No (aprobado, ejecutar con cuidado) | ⏳ Pendiente | `plans/008-cache-compartida-firebase-calendario.md` |
| 4 | **UI Nativa** — headers nativos + componentes unificados | Sonnet (Fable en la cola mecánica de Fase 2) | Parcial — 3 decisiones bloquean partes concretas, no todo (ver §4) | 🟡 En curso (Fase 1 casi hecha) | `docs/planes/PLAN_UI_NATIVA.md` |
| 5 | **Integración D** — Seguridad Firebase | Opus | **Sí** — D2 + repo `mcmpanel` (ver §4) | ⏳ Pendiente, importante pero no urgente | `docs/planes/PLAN_INTEGRACIONES.md` §"Integración D" |
| 6 | **Widget de Contigo** | Opus | **Sí** — ¿release de tienda ya? (ver §4) | ⏳ Al final | `docs/planes/PLAN_WIDGET_CONTIGO.md` |
| 7 | **Carismochito** (ejecutar bien §1–4) + **Panel Pañuelo** (concepto nuevo) | Sonnet (Opus solo el icono nativo §5) | Panel Pañuelo: **sí**, falta el plan funcional | ⏳ Cierre final | `docs/planes/PLAN_CARISMOCHITO.md` + `docs/planes/PLAN_PANEL_PANUELO.md` |

**Notas de orden:**
- El **4** (UI Nativa) puede avanzar en lo no bloqueado (Fase 2: migrar
  `TextInput`→`AppTextField`, `AppPrimaryButton`, `EmptyState`…) mientras se
  resuelven las 3 decisiones que sí bloquean partes concretas.
- El **5** (Integración D) ya NO es la urgencia máxima de antes: la app está
  en **beta privada**, no en gran producción, así que no hay riesgo de
  incidente inminente. Sigue siendo importante hacerlo bien antes de escalar
  a más usuarios — por eso se queda en la cola, pero sin prisa y bloqueado
  por D2.
- El **6** (Widget) y el **7** (Carismochito + Panel Pañuelo) son
  deliberadamente el cierre: los dos requieren decisión/plan previo y el
  Widget además exige comprometer una build de tienda.

---

## 2. Bolsa oportunista (fuera de la Cola Principal — no la avanza "seguimos")

### A. Calidad · Fase 1 — descuartizar los gigantes
- **Trigger exclusivo:** el usuario dice algo tipo *"me sobran tokens esta
  semana, ¿por dónde seguimos?"* (ver Protocolo §3). No se ejecuta por
  iniciativa propia ni entra en la Cola Principal.
- **Modelo:** Sonnet.
- **Detalle:** `docs/planes/PLAN_CALIDAD.md` Fase 1 (`SelectedSongsScreen`,
  `onboarding.tsx`, `(tabs)/index.tsx`…).

### B. Integraciones — resto (A2, C1–C4, E1)
- **Trigger:** "cuando estén" — oportunista, sin fecha fija; hacerlo cuando
  haya hueco o cuando el resto de piezas cross-repo estén listas. No bloquea
  nada ni es prioritario.
- **Modelo:** Sonnet (Fable para C2/C3, son copiar/documentar).
- **Detalle:** `docs/planes/PLAN_INTEGRACIONES.md` secciones A2, C, E1.

### C. Bolsa nativa — para "el día que hagamos una build de tienda"
> Todo esto es código nativo (no OTA). No tiene sentido hacer una build de
> tienda por una sola cosa — cuando se decida hacer una, revisar esta lista
> y empaquetar todo lo que esté listo en esa misma build.

| Qué | Origen | Nota |
|---|---|---|
| **PR #261** — fix modo alpha: `disableAntiBrickingMeasures` para el override del canal OTA preview | [github.com/mcmespana/mcmapp/pull/261](https://github.com/mcmespana/mcmapp/pull/261) — ya abierta, código listo | Solo necesita mergear + la próxima build de tienda para surtir efecto |
| iPad: landscape nativo (`UISupportedInterfaceOrientations~ipad`) | `mcm-app/TODO.md` (prioridad alta) | Los layouts de iPad ya están listos, falta activar la orientación |
| NSE iOS — imagen en notificación del sistema | `docs/planes/PLAN_INTEGRACIONES.md` A4.4 / `TODO.md` | Nuevo target iOS, requiere config plugin |
| Android — channels de notificación por tipo | `docs/planes/PLAN_INTEGRACIONES.md` A4.2 | Cross-repo: el panel debe mandar `channelId` |
| Sentry / crash reporting | `docs/planes/PLAN_CALIDAD.md` Fase 6 | Decisión de cuenta/proveedor pendiente |
| Icono alternativo Carismochito | `docs/planes/PLAN_CARISMOCHITO.md` §5 | 🔒 decisión — ¿compensa para un modo efímero? |

> Solo encontré **una** PR abierta que mencione explícitamente necesitar una
> build de tienda (#261). Busqué también por "EAS"/"App Store"/"Play
> Store"/"código nativo"/"no OTA" y no apareció una segunda — si tenías otra
> en mente, dime cuál y la reviso.
>
> El resto de PRs abiertas son de **Bolt/Jules** (`bolt-*`, `jules-*`) —
> confirmado que se ignoran, tal como pediste.

### D. Deuda futura (no ejecutar salvo que se decida más adelante)
- **Multilenguaje (i18n)** — catalán/portugués/inglés. Por ahora **no**. Si
  algún día se decide, ver `docs/planes/archivo/MEJORAS.md` §10 (razonamiento
  archivado) y usar `i18n-js` + `expo-localization` desde el principio (el
  coste de extraer strings después es ~10× mayor).

### E. Tarea pequeña — enlaces legales en "Más"
- Añadir 3 enlaces discretos en `MasHomeScreen` (o donde encaje mejor en la
  pestaña Más) a: **condiciones de uso**, **aviso legal**, **política de
  cookies** — ya publicados en la web.
- 🔒 **Necesito las 3 URLs** antes de poder implementarlo — no debo
  inventarlas. Pásamelas cuando quieras hacer esto (encaja bien como tarea de
  "me sobran tokens").
- Prioridad baja, no bloquea nada.

---

## 3. Anulados

### Plan 007 — Privacidad de respuestas de encuestas
**Anulado el 2026-07-22.** Decisión de producto: el panel **debe** poder ver
nombres/respuestas de encuestas — es una funcionalidad deseada, no un bug. El
diseño actual (`.read: true` en `/surveys` y `/activities`) se mantiene tal
cual. Motivo adicional: la app está en **beta privada**, no en gran
producción, así que no hay urgencia de exposición real. Banner de anulación
añadido en `plans/007-privacidad-respuestas-encuestas.md` y estado marcado
`REJECTED` en `plans/README.md`. **Si en el futuro aparece un bug real de
reglas** (no relacionado con esta visibilidad deseada del panel — p. ej. una
ruta que debería estar protegida por otro motivo), evaluarlo aparte; no
reabrir este plan tal cual, su premisa ya no aplica.

---

## 4. Decisiones pendientes — preguntar ANTES de ejecutar

| Decisión | Bloquea | Dónde consultar el contexto | Qué preguntar |
|---|---|---|---|
| **D2** — modelo de auth del panel (Firebase Auth + `/admins` vs mover escrituras a `api/`) | Integración D | `docs/planes/PLAN_INTEGRACIONES.md` §"Integración D" | "¿Qué modelo de auth para el panel — Firebase Auth+`/admins` o mover escrituras a funciones `api/`? Y ¿añado el repo `mcmpanel` a la sesión para poder tocarlo?" |
| **3 decisiones de UI** — qué pantallas van a header nativo plano vs floating glass; primitiva de pulsación estándar; ¿Contigo/Eventos mantienen paleta propia o se alinean a marca? | UI Nativa (Fases 1 resto y 4; Fase 2/3 no bloqueadas) | `docs/planes/PLAN_UI_NATIVA.md` §4 | Las 3 preguntas literales de esa sección |
| **Release de tienda para el Widget** — ¿se compromete ya? ¿iOS primero? ¿App Intents interactivos o solo abrir la app? | Widget de Contigo | `docs/planes/PLAN_WIDGET_CONTIGO.md` | "¿Arrancamos el Widget de Contigo? Implica una build de tienda dedicada — ¿cuándo?" |
| **Icono nativo Carismochito (§5)** | Bolsa nativa / Carismochito | `docs/planes/PLAN_CARISMOCHITO.md` §5 | "¿Compensa el icono alternativo para un modo que es efímero (se activa agitando)?" |
| **Plan funcional del Panel Pañuelo** | Panel Pañuelo | `docs/planes/PLAN_PANEL_PANUELO.md` (stub) | "¿Nos sentamos a diseñar la mecánica de chapas/modelo 3D, o esperamos a después de Carismochito §1–4?" |
| **URLs de los 3 documentos legales** | Tarea "enlaces legales" (§2.E) | este documento | "Pásame los links de condiciones de uso, aviso legal y política de cookies" |

---

## 5. Archivado

Documentos obsoletos, movidos a `docs/planes/archivo/` para no confundir a
quien busque el plan vigente (siguen ahí por si hace falta consultarlos, pero
ya no son la referencia activa):

- **`MEJORAS.md`** → `docs/planes/archivo/MEJORAS.md`. Era la foto de un
  análisis de mayo 2026; sus acciones ya se repartieron entre `TODO.md`,
  `PLAN_CALIDAD.md` y este backlog. Las dos decisiones que seguían abiertas
  ahí (i18n, privacidad) están recogidas en §2.D y §2.E de este documento.
- **`RESUMEN_EJECUTIVO.md`** — retirado (no archivado, se creó y se
  descartó en la misma sesión). Su contenido está fusionado aquí.
