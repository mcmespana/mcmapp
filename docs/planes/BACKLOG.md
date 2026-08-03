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
> Última actualización: 2026-08-01.

---

## 🧭 Puntero rápido

> **Si el usuario dice "seguimos": el siguiente ítem no empezado de la Cola
> Principal (abajo) es el que toca.** Ahora mismo eso es **UI Nativa** — y ojo:
> tiene 🔒 3 decisiones de producto que bloquean partes (ver §4), así que
> antes de ejecutar hay que preguntar.
>
> Actualiza esta caja cada vez que se cierra un ítem — es lo primero que
> lee cualquiera que retome esto.

|                                         |                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ahora mismo (en curso / siguiente)**  | UI Nativa — **Fase 2** (componentes), ~65-70% hecho; queda `SegmentedControl`, chips/pills, tokens, y los formularios de Contigo + `SecretPanelModal` (pendientes de verificación en dispositivo / grandes)                                                                                                                                                                        |
| **Después**                             | Integración D 🔒 → Widget de Contigo 🔒 → Carismochito + Panel Pañuelo                                                                                                                                                                                                                                                                                                             |
| **Bloqueado, no tocar sin preguntar**   | Integración D, Widget de Contigo, Panel Pañuelo                                                                                                                                                                                                                                                                                                                                    |
| **Oportunista (solo si piden hueco)**   | Calidad Fase 1, Integraciones resto, bolsa nativa                                                                                                                                                                                                                                                                                                                                  |
| **Pendiente de dev build (no mergear)** | `claude/compact-tabs-bar-uxxaoz` — Expo SDK 57 + barra de pestañas flotante compacta. Código nativo: hay que validarlo en dispositivo antes de mergear. Al validarlo se desbloquea la actualización de dependencias de terceros (ver `mcm-app/TODO.md`) para meterlo todo en la misma release de tienda                                                                            |
| **Hecho**                               | ✅ Plan 004, ✅ Plan 005 + resumen visible, ✅ Plan 008 (en `main`, pendiente de validar en dispositivo antes de producción), ✅ PR #298 (fix modo alpha), ✅ UI Nativa Fase 1 + Fase 2 parcial (PRs #301-#304, `AppTextField`/`AppPrimaryButton`/`EmptyState` — #301-#303 ya en producción vía cherry-pick, #304 solo en `main`) — ver `mcm-app/CHANGELOG.md` y `plans/README.md` |

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

| #   | Ítem                                                                                    | Modelo                                       | 🔒 Decisión                                                             | Estado                                                                                                                                                                                                                                                                                  | Documento técnico                                                        |
| --- | --------------------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | **Plan 004** — Contigo: sync bidireccional de hábitos/revisiones + tests `authHelpers`  | Sonnet                                       | No                                                                      | ✅ **DONE** (2026-07-22)                                                                                                                                                                                                                                                                | `plans/004-contigo-sync-bidireccional.md`                                |
| 2   | **Plan 005** — Scraper: vacío=error, fecha vetada, pytest en CI, workflow sin inyección | Sonnet                                       | No                                                                      | ✅ **DONE** (2026-07-22)                                                                                                                                                                                                                                                                | `plans/005-scraper-fiabilidad-y-ci.md`                                   |
| 3   | **Plan 008** — Caché compartida `useFirebaseData` + calendario stale-while-revalidate   | **Opus**                                     | No                                                                      | ✅ **DONE** en `main` (2026-07-22). **NO cherry-pickeado a producción a propósito**: toca el hook central y cambia comportamiento visible del calendario; validar en dispositivo (vía `preview`, con la próxima build de tienda) antes de producción. No corre prisa (es perf, no bug). | `plans/008-cache-compartida-firebase-calendario.md`                      |
| 4   | **UI Nativa** — headers nativos + componentes unificados                                | Sonnet (Fable en la cola mecánica de Fase 2) | No — las 3 decisiones que bloqueaban partes ya están resueltas (ver §4) | 🟡 En curso — Fase 1 ✅, Fase 2 ~65-70% (`AppTextField`/`EmptyState` mayormente hechos, `AppPrimaryButton` parcial, `SegmentedControl`/chips/tokens sin empezar)                                                                                                                        | `docs/planes/PLAN_UI_NATIVA.md`                                          |
| 5   | **Integración D** — Seguridad Firebase                                                  | Opus                                         | **Sí** — D2 + repo `mcmpanel` (ver §4)                                  | ⏳ Pendiente, importante pero no urgente                                                                                                                                                                                                                                                | `docs/planes/PLAN_INTEGRACIONES.md` §"Integración D"                     |
| 6   | **Widget de Contigo**                                                                   | Opus                                         | **Sí** — ¿release de tienda ya? (ver §4)                                | ⏳ Al final                                                                                                                                                                                                                                                                             | `docs/planes/PLAN_WIDGET_CONTIGO.md`                                     |
| 7   | **Carismochito** (ejecutar bien §1–4) + **Panel Pañuelo** (concepto nuevo)              | Sonnet (Opus solo el icono nativo §5)        | Panel Pañuelo: **sí**, falta el plan funcional                          | ⏳ Cierre final                                                                                                                                                                                                                                                                         | `docs/planes/PLAN_CARISMOCHITO.md` + `docs/planes/PLAN_PANEL_PANUELO.md` |

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

- **Trigger exclusivo:** el usuario dice algo tipo _"me sobran tokens esta
  semana, ¿por dónde seguimos?"_ (ver Protocolo §3). No se ejecuta por
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

### C. Bolsa nativa — la build de tienda de agosto de 2026

> **Estado: la build YA está en marcha.** La rama
> `claude/compact-tabs-bar-uxxaoz` es la "súper rama" que se lleva todo lo
> nativo acumulado. Ya no es una lista de espera: es el **contenido de esta
> build** más lo que aún se puede meter antes de compilar. Revisión: 2026-08-03.

#### C.1 — Ya dentro de la rama (se publica con esta build)

| Qué | Dónde | Nota |
| --- | ----- | ---- |
| ✅ **Expo SDK 55 → 57**, RN 0.83 → 0.86, React 19.2.3 | `package.json` | El cambio nativo más grande de la build; es lo que obliga a compilar de todas formas |
| ✅ **Barra de pestañas flotante** (`expo-native-compact-tabs` 0.2.0) | `components/tabs/` | Módulo nativo NUEVO + `patch-package` (`postinstall`) |
| ✅ **Parche del módulo de tabs** | `patches/expo-native-compact-tabs+0.2.0.patch` | Dos arreglos: escala de los iconos (`normalisedToIconBox`) y relayout de safe area al volver del onboarding (`didMoveToWindow`/`safeAreaInsetsDidChange`) |
| ✅ **Reanimated 4.5.1 + `react-native-worklets`** | toda la app | Migración completa de `Animated`/`PanResponder`; nativo |
| ✅ **iPad landscape** (`UISupportedInterfaceOrientations~ipad`) | `app.json` | Falta **probar en iPad físico** (ver `TODO.md` §1) |
| ✅ **Fix modo alpha** (`disableAntiBrickingMeasures`) | [PR #298](https://github.com/mcmespana/mcmapp/pull/298) | Ya estaba en `main`; el toggle no surtía efecto hasta esta build |
| ✅ **Reproductor multimedia** (YouTube con `Referer`, PiP de audio) | `components/song-media/` | Recuperado de `production` el 2026-08-03 |
| ✅ **Channels Android por categoría** | `constants/notificationChannels.ts` | **No es nativo** (es runtime), pero se estrena aquí — ver C.3 |

#### C.2 — Aprobado y pendiente de escribir (entra en esta build si da tiempo)

| Qué | Decisión | Estado |
| --- | -------- | ------ |
| **NSE iOS** — imagen en la notificación del sistema | ✅ "Sí, adelante" (2026-08-03) | **Pendiente**. Target iOS nuevo + config plugin. `richContent.image` no pinta nada en iOS sin esto |
| **"Subrayar" en el menú nativo de selección** | ✅ "Escríbelo entero, yo compilo" (2026-08-03) | **Pendiente**. Alcance mínimo: un item "Subrayar" que abra la barra de colores que YA existe; el modo lápiz actual se mantiene |

> Sobre el subrayado: replanteado el 2026-08-03 — `HighlightableReading` ya
> renderiza con un `TextInput` de solo lectura, que en iOS **es** un `UITextView`
> real. No hace falta sustituir la vista nativa (que era el grueso del trabajo
> estimado); el riesgo se mueve a interponer un proxy del delegado
> `textView(_:editMenuForTextIn:suggestedActions:)`, que React Native ya ocupa.
> Detalle en `docs/funcionalidades/SUBRAYADO.md`.

#### C.3 — Cambios que exigen algo FUERA de la app

| Qué | Quién | Estado |
| --- | ----- | ------ |
| **`channelId` en el push** | MCM Panel | El Panel debe mandar `channelId` top-level con el mismo valor que `data.category` (`general` → `default`). Sin él todo cae en `default` como hasta ahora; **con un `channelId` que la app no declare, Android no entrega la notificación**. Tabla cerrada en `docs/contratos/NOTIFICACIONES_CONTRATO.md` §8 |
| **Probar los channels en un Android real** | Usuario | Requisito que ya fijaba `TODO.md`: verificar heads-up/sonido por canal antes de mergear a `production`. Los canales aparecen en los ajustes del sistema de todos los Android y sus preferencias no se pueden revertir a mano |

#### C.4 — Sigue bloqueado por una decisión tuya

| Qué | Qué falta decidir |
| --- | ----------------- |
| **Sentry / crash reporting** (`PLAN_CALIDAD.md` Fase 6) | Cuenta y proveedor. `utils/logger.ts` ya expone `setReporter`, así que la app está preparada; falta el SDK nativo. Si se quiere en ESTA build hay que decidirlo antes de compilar |
| **Icono alternativo Carismochito** (`PLAN_CARISMOCHITO.md` §5) | ¿Compensa para un modo efímero (se activa agitando)? Persiste fuera de la app y en Android exige `activity-alias` |
| **Widget de Contigo** (`PLAN_WIDGET_CONTIGO.md`) | Es una build dedicada, no un extra de ésta: WidgetKit + App Group. ¿Se compromete y para cuándo? |

> ⚠️ **Guardarraíles ≠ build de tienda.** Lo que se buscaba en `PLAN_CALIDAD.md`
> son los guardarraíles de la **Fase 0**, que es explícitamente OTA-safe (lint,
> tests, CI). Lo único de ese plan que pide build de tienda es Sentry (Fase 6).

> **Nada de esta rama puede salir por OTA.** Lleva SDK nuevo, módulos nativos
> nuevos y un parche nativo: una OTA con este bundle crashearía en los binarios
> instalados. Orden obligatorio: validar dev build → merge a `main` → build de
> producción iOS + Android → tiendas → mover `production`.

> PRs abiertas: solo #261 mencionaba explícitamente necesitar build de tienda.
> #306 (barra de tabs alternativa) se **cerró** el 2026-08-03: la sustituye el
> enfoque de esta rama con `expo-native-compact-tabs`, que mantiene el
> `UITabBarController` nativo y todos los iconos visibles al compactarse. El
> resto de PRs abiertas son de Bolt/Jules (`bolt-*`, `jules-*`) y se ignoran.

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

| Decisión                                                                                                               | Bloquea                        | Dónde consultar el contexto                          | Qué preguntar                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **D2** — modelo de auth del panel (Firebase Auth + `/admins` vs mover escrituras a `api/`)                             | Integración D                  | `docs/planes/PLAN_INTEGRACIONES.md` §"Integración D" | "¿Qué modelo de auth para el panel — Firebase Auth+`/admins` o mover escrituras a funciones `api/`? Y ¿añado el repo `mcmpanel` a la sesión para poder tocarlo?"                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ~~**3 decisiones de UI**~~ ✅ **RESUELTAS (2026-07-22)**                                                               | UI Nativa                      | `docs/planes/PLAN_UI_NATIVA.md` §4                   | **(1) Headers**: nativo plano en pantallas "lista+detalle" (Revisión, Materiales, Horario, sub-pantallas de evento), floating glass solo donde aporta identidad (heros de evento). **(2) Pulsación**: `PressableFeedback` (heroui) como primitiva única de contenido — es la opción con feedback nativo más consistente y ya soportada por la librería; barras de navegación siguen con bar items nativos. **(3) Color**: Contigo (warm) y Eventos (color por evento) **mantienen su paleta propia** — es identidad intencional; documentar como temas con nombre, no forzar alineación a marca. |
| **Release de tienda para el Widget** — ¿se compromete ya? ¿iOS primero? ¿App Intents interactivos o solo abrir la app? | Widget de Contigo              | `docs/planes/PLAN_WIDGET_CONTIGO.md`                 | "¿Arrancamos el Widget de Contigo? Implica una build de tienda dedicada — ¿cuándo?"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Icono nativo Carismochito (§5)**                                                                                     | Bolsa nativa / Carismochito    | `docs/planes/PLAN_CARISMOCHITO.md` §5                | "¿Compensa el icono alternativo para un modo que es efímero (se activa agitando)?"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Plan funcional del Panel Pañuelo**                                                                                   | Panel Pañuelo                  | `docs/planes/PLAN_PANEL_PANUELO.md` (stub)           | "¿Nos sentamos a diseñar la mecánica de chapas/modelo 3D, o esperamos a después de Carismochito §1–4?"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **URLs de los 3 documentos legales**                                                                                   | Tarea "enlaces legales" (§2.E) | este documento                                       | "Pásame los links de condiciones de uso, aviso legal y política de cookies"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

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
