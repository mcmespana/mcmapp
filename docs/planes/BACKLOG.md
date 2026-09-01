# BACKLOG.md — Fuente única de verdad del orden de ejecución

> **Qué es esto:** el único sitio donde se decide **qué se hace ahora, qué es
> lo siguiente, y qué está bloqueado por una decisión tuya**. Antes de este
> documento la información vivía repartida entre varios sitios y
> conversaciones sueltas — este archivo la sustituye
> como punto de entrada. Los documentos técnicos de detalle (`docs/planes/PLAN_*.md`) siguen siendo la referencia profunda de cada ítem;
> este documento solo dice **el orden y quién decide qué**.
>
> **Regla para cualquier agente/conversación que retome este trabajo:** lee
> este documento ENTERO antes de tocar nada. No re-derives prioridades desde
> cero ni mires un `docs/planes/PLAN_*.md` suelto.
>
> Última actualización: 2026-08-31 (añadido §2.G — diseño).
>
> **Índice de qué plan está vivo y cuál archivado:**
> [`docs/planes/README.md`](README.md). Si un plan está en `archivo/`, está
> HECHO — no se re-ejecuta.

---

## 🧭 Puntero rápido

> **Todo gira ahora mismo alrededor de la build de tienda de agosto.** Todo lo
> nativo (SDK 57, barra flotante, Reanimated 4, NSE de iOS, Sentry, analítica,
> icono de Carismochito, subrayado nativo) **ya está en `main`**: la rama
> `claude/compact-tabs-bar-uxxaoz` se mergeó en la
> [#313](https://github.com/mcmespana/mcmapp/pull/313) el 2026-08-04 y ya no
> existe — si un documento la menciona como viva, está desactualizado. Nada de
> eso puede salir por OTA.
>
> **Si el usuario dice "seguimos"**: lo que toca es sacar la build adelante —
> paso a paso completo en `docs/desarrollo/BUILD_AGOSTO_2026.md`. La Cola
> Principal (§1) se reanuda cuando la build esté publicada.

|                              |                                                                                                                                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Ahora mismo**              | **Build de tienda 2.1 — agosto de 2026.** Falta: crear las cuentas de Sentry y Aptabase y meter las claves (§2 del doc de build), validar en dispositivo (§5), publicar (§6)                  |
| **Bloqueado por ti**         | Integración D2 (modelo de auth del panel) · desplegar las reglas de Firebase (escritas y listas, ver `docs/SEGURIDAD.md`)                                                                     |
| **Bloqueado fuera**          | Política de privacidad y fichas de las tiendas (obligatorio antes de publicar, ver §6 del doc de build) · probar los channels en un Android real                                              |
| **⚠️ Roto y sin dueño**      | **El CI no ejecuta nada desde el 2026-04-10.** Ningún PR se verifica de verdad; hasta arreglarlo, pasa los 4 pasos de `verify.yml` en local antes de mergear. Detalle en `mcm-app/TODO.md` §0 |
| **Después de la build**      | UI Nativa Fase 2 → Integración D → Carismochito                                                                                                                                               |
| **Oportunista**              | Integraciones resto · **Diseño (§2.G)**. **Ya NO**: Calidad Fase 1 (descartada, ver §2.A) ni Etiquetas (§2.C-ter, cerrado)                                                                    |
| **Futuro lejano, sin prisa** | Widget de Contigo · Panel Pañuelo (§1 notas)                                                                                                                                                  |
| **Cerrado**                  | Etiquetas del cantoral (app + cantoral) · los 8 planes tácticos · los 15 de la auditoría `/improve` · UI Nativa Fase 1 · PR #298                                                              |

> **Ojo con el orden al publicar**: `production` dispara la OTA sola. No se
> mueve hasta que las tiendas tengan el binario nuevo, o la gente recibe un
> bundle que su app no puede ejecutar.

---

## 📜 Protocolo de trabajo (léelo antes de ejecutar nada)

1. **"Seguimos"** → coge el primer ítem **no completado** de la Cola
   Principal (§1). Si tiene 🔒 (bloqueado por decisión), **para y pregunta**
   usando la pregunta exacta de la tabla de §4 — no lo ejecutes a ciegas, no
   inventes la decisión. Si no tiene 🔒, ejecútalo siguiendo su documento
   técnico (`docs/planes/PLAN_*.md`).
2. **Al terminar un ítem**: actualiza (a) el puntero rápido de arriba, (b) la
   fila de la Cola Principal (§1), y (c) el estado en el documento de origen
   (la cabecera del `PLAN_*.md` correspondiente). Si hubo cambio de código real, entrada nueva en
   `mcm-app/CHANGELOG.md` (fecha+hora, arriba del todo — regla del CLAUDE.md
   raíz).
3. **"Me sobran tokens/créditos [esta semana]"** (o cualquier variante de
   "tengo hueco/capacidad de sobra") → **esto NO avanza la Cola Principal**.
   La tarea por defecto para ese hueco es **subir la cobertura de tests**:
   abre `docs/desarrollo/COBERTURA.md` y sigue la receta tal cual, sin
   preguntar. Es mecánica, segura (solo añade ficheros a `__tests__/`) y está
   escrita para Sonnet. Si el usuario prefiere otra cosa, enséñale la Bolsa
   Oportunista (§2) y que elija.
   **Si dice "diseño"** (o "unificar la UI", "los colores", "los tokens") →
   `docs/planes/PLAN_DISENO.md`, y empieza por su "Orden sugerido". Es la
   segunda tarea mecánica de esta casa: tareas sueltas, cada una en un commit,
   sin decisiones nuevas salvo las marcadas 🔒.
4. **Nunca ejecutes un ítem 🔒 sin preguntar primero**, aunque parezca
   evidente qué elegir. Son decisiones de producto/seguridad del usuario, no
   del ejecutor.
5. **Integración D es cross-repo**: la parte de este repo (`mcmapp`) es solo
   D3 (completar `database.rules.json`). D1/D2/D4/D5 viven en `mcmpanel`, que
   normalmente NO está en el scope de la sesión — hay que pedir al usuario
   que lo añada (`add_repo`) antes de tocar esa parte.

---

## 1. Cola Principal (orden secuencial — "seguimos" avanza aquí)

| #   | Ítem                                                                                    | Modelo                                       | 🔒 Decisión                                                             | Estado                                                                                                                                                                                                                                                                                  | Documento técnico                                    |
| --- | --------------------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | **Plan 004** — Contigo: sync bidireccional de hábitos/revisiones + tests `authHelpers`  | Sonnet                                       | No                                                                      | ✅ **DONE** (2026-07-22)                                                                                                                                                                                                                                                                | `archivo/tacticos/004-…`                             |
| 2   | **Plan 005** — Scraper: vacío=error, fecha vetada, pytest en CI, workflow sin inyección | Sonnet                                       | No                                                                      | ✅ **DONE** (2026-07-22)                                                                                                                                                                                                                                                                | `archivo/tacticos/005-…`                             |
| 3   | **Plan 008** — Caché compartida `useFirebaseData` + calendario stale-while-revalidate   | **Opus**                                     | No                                                                      | ✅ **DONE** en `main` (2026-07-22). **NO cherry-pickeado a producción a propósito**: toca el hook central y cambia comportamiento visible del calendario; validar en dispositivo (vía `preview`, con la próxima build de tienda) antes de producción. No corre prisa (es perf, no bug). | `archivo/tacticos/008-…`                             |
| 4   | **UI Nativa** — headers nativos + componentes unificados                                | Sonnet (Fable en la cola mecánica de Fase 2) | No — las 3 decisiones que bloqueaban partes ya están resueltas (ver §4) | 🟡 En curso — Fase 1 ✅, Fase 2 ~65-70% (`AppTextField`/`EmptyState` mayormente hechos, `AppPrimaryButton` parcial, `SegmentedControl`/chips/tokens sin empezar)                                                                                                                        | `docs/planes/PLAN_UI_NATIVA.md`                      |
| 5   | **Integración D** — Seguridad Firebase (+ A2)                                           | Opus                                         | **Sí** — D2 + repo `mcmpanel` (ver §4)                                  | ⏳ Pendiente, importante pero no urgente. **Es lo único que queda de PLAN_INTEGRACIONES**: el resto (A, B, C, E) se cerró el 2026-08-12                                                                                                                                                 | `docs/planes/PLAN_INTEGRACIONES.md` §"Integración D" |
| 6   | **Carismochito** (ejecutar bien §1–4)                                                   | Sonnet (Opus solo el icono nativo §5)        | No                                                                      | ⏳ Cierre final                                                                                                                                                                                                                                                                         | `docs/planes/PLAN_CARISMOCHITO.md`                   |

**Fuera de la cola — futuro lejano (decisión del usuario, 2026-08-15):**
**Widget de Contigo** y **Panel Pañuelo** salen de la Cola Principal. Son dos
funcionalidades "muy futuras": _ya se hará, no hay prisa_. No las propongas al
decir "seguimos", no las metas en la bolsa oportunista y **no preguntes por
ellas** — la decisión de cuándo es del usuario y ya la ha tomado: todavía no.
Sus planes siguen en `PLAN_WIDGET_CONTIGO.md` y `PLAN_PANEL_PANUELO.md` para
cuando toque.

**Notas de orden:**

- El **4** (UI Nativa) puede avanzar en lo no bloqueado (Fase 2: migrar
  `TextInput`→`AppTextField`, `AppPrimaryButton`, `EmptyState`…) mientras se
  resuelven las 3 decisiones que sí bloquean partes concretas.
- El **5** (Integración D) ya NO es la urgencia máxima de antes: la app está
  en **beta privada**, no en gran producción, así que no hay riesgo de
  incidente inminente. Sigue siendo importante hacerlo bien antes de escalar
  a más usuarios — por eso se queda en la cola, pero sin prisa y bloqueado
  por D2.
- El **6** (Carismochito) es deliberadamente el cierre: no bloquea a nada y
  nada lo bloquea a él.

---

## 2. Bolsa oportunista (fuera de la Cola Principal — no la avanza "seguimos")

### A. ~~Calidad · Fase 1 — descuartizar los gigantes~~ ❌ DESCARTADO (2026-08-15)

**Decisión del usuario: los archivos grandes se quedan grandes.** No hay
suficiente necesidad como para pagar el troceo, y el argumento que lo motivaba
(un humano no se orienta en 1.800 líneas) ya no aplica: **quien edita este
código es siempre una IA**, que lee el archivo entero de una vez y para la que
la misma lógica repartida en seis ficheros es _más_ cara, no menos.

Concretamente:

- `app/onboarding.tsx` (1.756 líneas) — **se queda como está**, literal: _"es
  una chorrada"_. No lo trocees ni te ofrezcas a hacerlo.
- `app/(tabs)/index.tsx` (1.196 líneas) — se queda.
- `app/screens/SelectedSongsScreen.tsx` (~1.790 líneas) — **el único con
  permiso para tocarse**, y solo si hay una mejora real de por medio (no
  "trocear por trocear"). El 2026-08-15 ya se le movieron los dos efectos de
  auto-import detrás de sus dependencias, que era un problema de verdad.

Lo que SÍ sigue vivo de la calidad es lo que se paga solo: que `npm run lint`,
`npx tsc --noEmit` y `npm test` estén en verde, y no dejar warnings nuevos
(ver §2.F). El techo de `max-lines` del ESLint se queda en 1.000 **como aviso**,
no como deuda a saldar: los tres gigantes actuales están exentos por decisión.

El razonamiento largo sobre cómo organizar código que solo va a editar una IA
está en `docs/planes/PLAN_CALIDAD.md` §0.

### B. ~~Integraciones — resto (A2, C1–C4, E1)~~ ✅ CERRADO (2026-08-12)

Se ejecutaron **B1 completo** (archivar/renombrar eventos desde el panel ya
funciona para todos los eventos, no solo el activo), **C1**, **C3**, **C4** y
**E1**, más un bug de pérdida de datos en `/app` que no estaba en ningún plan (la
sección App del panel borraba `app/evaluations` y `app/evaluationConfig` en cada
guardado). **C2** queda fuera a propósito: los seeds los sincroniza el usuario a
mano. **B4** (smoke test) descartado por improbable.

Lo único que sobrevive de ese plan es **A2** (proteger los endpoints de envío),
que se absorbe en la Integración D de la Cola Principal — es el mismo problema.

Detalle en `docs/planes/PLAN_INTEGRACIONES.md`.

### C. Bolsa nativa — la build de tienda de agosto de 2026

> **Estado: todo lo nativo YA está en `main`.** La "súper rama"
> `claude/compact-tabs-bar-uxxaoz` se mergeó en la
> [#313](https://github.com/mcmespana/mcmapp/pull/313) el 2026-08-04 y ya no
> existe. Esto dejó de ser una lista de espera: es el **contenido de esta
> build**, pendiente solo de compilar y publicar. Revisión: 2026-08-15.

#### C.1 — Ya en `main` (se publica con esta build)

| Qué                                                                  | Dónde                                                                           | Nota                                                                                                                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅ **Expo SDK 55 → 57**, RN 0.83 → 0.86, React 19.2.3                | `package.json`                                                                  | El cambio nativo más grande de la build; es lo que obliga a compilar de todas formas                                                                      |
| ✅ **Barra de pestañas flotante** (`expo-native-compact-tabs` 0.2.0) | `components/tabs/`                                                              | Módulo nativo NUEVO + `patch-package` (`postinstall`)                                                                                                     |
| ✅ **Parche del módulo de tabs**                                     | `patches/expo-native-compact-tabs+0.2.0.patch`                                  | Dos arreglos: escala de los iconos (`normalisedToIconBox`) y relayout de safe area al volver del onboarding (`didMoveToWindow`/`safeAreaInsetsDidChange`) |
| ✅ **Reanimated 4.5.1 + `react-native-worklets`**                    | toda la app                                                                     | Migración completa de `Animated`/`PanResponder`; nativo                                                                                                   |
| ✅ **iPad landscape** (`UISupportedInterfaceOrientations~ipad`)      | `app.json`                                                                      | Falta **probar en iPad físico** (ver `TODO.md` §1)                                                                                                        |
| ✅ **Fix modo alpha** (`disableAntiBrickingMeasures`)                | [PR #298](https://github.com/mcmespana/mcmapp/pull/298)                         | Ya estaba en `main`; el toggle no surtía efecto hasta esta build                                                                                          |
| ✅ **Reproductor multimedia** (YouTube con `Referer`, PiP de audio)  | `components/song-media/`                                                        | Recuperado de `production` el 2026-08-03                                                                                                                  |
| ✅ **Channels Android por categoría**                                | `constants/notificationChannels.ts`                                             | **No es nativo** (es runtime), pero se estrena aquí — ver C.3                                                                                             |
| ✅ **NSE iOS** — imagen en la notificación del sistema               | `plugins/withNotificationServiceExtension.js` + `targets/notification-service/` | Target de Xcode nuevo, creado por config plugin propio. Bundle id `…​.MCMNotificationService`: EAS pide credenciales la primera vez                       |
| ✅ **Sentry** (`@sentry/react-native`)                               | `utils/sentry.ts`                                                               | Sin `EXPO_PUBLIC_SENTRY_DSN` no reporta nada; el SDK nativo va en el binario para poder encenderlo luego por OTA                                          |
| ✅ **Icono alternativo Carismochito**                                | `expo-alternate-app-icons` + `utils/appIcon.ts`                                 | Iconos generados con `npm run icons:alt`                                                                                                                  |
| ✅ **Analítica** (`@aptabase/react-native`)                          | `utils/analytics.ts` + `constants/analyticsEvents.ts`                           | Sin identificadores persistentes, servidores UE. Sin `EXPO_PUBLIC_APTABASE_KEY` no manda nada                                                             |
| ✅ **"Subrayar" en el menú nativo**                                  | `modules/highlight-menu/`                                                       | Módulo local de Expo. El modo lápiz se mantiene como respaldo y para web                                                                                  |

#### C.3 — Cambios que exigen algo FUERA de la app

| Qué                                                | Quién     | Estado                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Política de privacidad + fichas de las tiendas** | Usuario   | La analítica obliga a actualizar la política de privacidad, la ficha de privacidad de App Store y el formulario de Data Safety de Play **antes** de publicar. Aptabase no manda identificadores persistentes, lo que simplifica la declaración, pero hay que hacerla                              |
| **Cuenta de Sentry y de Aptabase**                 | Usuario   | Crear proyecto, copiar claves y meterlas como secrets de EAS y de GitHub. §2 de `BUILD_AGOSTO_2026.md`                                                                                                                                                                                            |
| ~~**`channelId` en el push**~~                     | MCM Panel | ✅ **Hecho.** El Panel manda `channelId` top-level derivado de `data.category` (`general` → `default`) contra una lista cerrada (`api/_lib/push.ts`), verificada contra los 7 canales que declara la app. También manda `mutableContent`. Tabla en `docs/contratos/NOTIFICACIONES_CONTRATO.md` §8 |
| **Probar los channels en un Android real**         | Usuario   | Requisito que ya fijaba `TODO.md`: verificar heads-up/sonido por canal antes de mergear a `production`. Los canales aparecen en los ajustes del sistema de todos los Android y sus preferencias no se pueden revertir a mano                                                                      |

### C-bis. Build 2.2 — noviembre/diciembre de 2026

Decidido el 2026-08-03: estas dos son NATIVAS y **no entran en la 2.1**. Se
guardan para la siguiente build de tienda.

| Qué                                                                    | Estado | Por qué se aplaza                                                                                                                                                                                                               |
| ---------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Widget de Contigo** (WidgetKit iOS / App Widget Android + App Group) | 0%     | Es una feature entera, no un extra. `docs/planes/PLAN_WIDGET_CONTIGO.md`                                                                                                                                                        |
| **Firebase App Check** (DeviceCheck / Play Integrity)                  | 0%     | Arrastra `@react-native-firebase` entero junto al SDK JS que ya se usa, y un _enforcement_ mal configurado deja sin datos a toda la base instalada. Además la Integración D (reglas) sigue abierta, que es el agujero de verdad |

#### C.4 — Sigue bloqueado por una decisión tuya

| Qué                                              | Qué falta decidir                                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| **Widget de Contigo** (`PLAN_WIDGET_CONTIGO.md`) | Es una build dedicada, no un extra de ésta: WidgetKit + App Group. ¿Se compromete y para cuándo? |

> **Paso a paso del día de la build**: `docs/desarrollo/BUILD_AGOSTO_2026.md`
> — variables de Sentry, credenciales de la extensión y checklist de pruebas.

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

### C-ter. ~~Etiquetas del cantoral~~ ✅ CERRADO (2026-08-15)

Completo de punta a punta:

- **Fase 2 (app)** ✅ 2026-08-13 — diseño 1d de Claude Design: botón 🏷️ en el
  header, nube de etiquetas en una hoja, pantalla `__TAG__:<slug>` agrupada por
  categoría con barra de refinamiento. Las 3 decisiones de §7 se resolvieron:
  compartidas, emoji opcional, y el etiquetado desde la app no entra todavía.
- **Fase 1 (`mcmapp-cantoral`)** ✅ 2026-08-15 — el generador parsea `{tags:}` y
  publica `songs/tags`. Era lo único que faltaba para que la funcionalidad
  dejara de estar muerta.

Queda **opcional y sin fecha** la fase 4 (etiquetar desde la propia app con
long-press por la cola `songs/ediciones`, y `liturgicalTime` como etiqueta de
sistema derivada). No está planificada: si se quiere, se decide entonces.

Documentación viva: `docs/funcionalidades/ETIQUETAS.md`. El plan se archivó en
`docs/planes/archivo/PLAN_TAGS.md`.

### F. Warnings del compilador de React — lo que queda es irreducible

Repaso completo el 2026-08-15: **111 → 51 warnings**, sin silenciar ninguno.
Se arreglaron las asignaciones tiradas por render (`useRef(new Animated.Value())`
→ `useAnimatedValue`, los `PanResponder` de `BottomSheet`), varios
`exhaustive-deps` reales, un ajuste de estado que leía y escribía un ref en
render, y los dos efectos de auto-import que leían en zona muerta.

**Los 51 que quedan NO son deuda accionable.** Antes de "arreglarlos", lee
`docs/desarrollo/WARNINGS.md`: están clasificados uno a uno con el motivo por
el que cada grupo se queda. El grueso son falsos positivos estructurales —
Reanimated (`sharedValue.value = …` es su API, no una mutación indebida) y el
patrón oficial de "ref al último callback". Perseguirlos empeora el código.

**Lo que sí se pide:** no añadir warnings NUEVOS. Si un cambio tuyo sube la
cuenta por encima de 51, ese es tuyo y se arregla.

### G. Diseño — unificar tokens y quitar incoherencias

**Documento: [`PLAN_DISENO.md`](PLAN_DISENO.md).** Creado el 2026-08-31 al
escribir [`design.md`](../../design.md), que es ahora la guía prescriptiva de
diseño para agentes.

Es la **tarea por defecto cuando el usuario pide diseño** en un hueco
oportunista. Sus tareas son independientes y caben en un commit cada una.

**Primera pasada ejecutada el 2026-08-31**: renombrados los tokens de marca que
mentían, sombras y radios renombrados/colapsados, los roles de color que
faltaban (de 1.363 hex literales a 793), un solo hook responsive, espejo de
tokens en el panel y `__tests__/designTokens.test.ts` para que no se
desincronice otra vez.

Lo que queda, por si hay que priorizar sin abrir el documento:

- **A5.3** — el guardarraíl que impida hex NUEVOS (lo demás del test ya está).
- **A5.4 / E2** — segunda tanda de hex y los `borderRadius` inline.
- **C** — tipografía: `constants/typography.ts` sigue casi sin importarse y no
  hay escala de pesos aplicada.
- **F4** — cuatro anchuras máximas distintas conviviendo (640/760/960/1200).
- **H8–H10** — hallazgos que necesitan **verse en un dispositivo**: en modo
  oscuro las cards se pintan con el color de fondo (no hay capas), y hay tres
  cambios ya hechos (sombra de toasts, radios, gris secundario) sin verificar.

### D. Deuda futura (no ejecutar salvo que se decida más adelante)

- **Multilenguaje (i18n)** — catalán/portugués/inglés. Por ahora **no**. Si
  algún día se decide, ver `docs/planes/archivo/MEJORAS.md` §10 (razonamiento
  archivado) y usar `i18n-js` + `expo-localization` desde el principio (el
  coste de extraer strings después es ~10× mayor).

### E. ~~Enlaces legales en "Más"~~ ✅ HECHO (2026-08-03)

Los tres enlaces (política de privacidad, términos y condiciones, aviso legal)
están en el pie de "Más", con las URLs de `comunica.movimientoconsolacion.com`
centralizadas en `mcm-app/constants/legalLinks.ts`. Apple y Google exigen que la
política de privacidad se pueda abrir desde dentro de la app, así que además de
tarea pendiente era un requisito de publicación.

---

## 3. Anulados

### Plan 007 — Privacidad de respuestas de encuestas

**Anulado el 2026-07-22.** Decisión de producto: el panel **debe** poder ver
nombres/respuestas de encuestas — es una funcionalidad deseada, no un bug. El
diseño actual (`.read: true` en `/surveys` y `/activities`) se mantiene tal
cual. Motivo adicional: la app está en **beta privada**, no en gran
producción, así que no hay urgencia de exposición real. Banner de anulación
añadido en `archivo/tacticos/007-…` y estado marcado
`REJECTED` en `archivo/tacticos/README.md`. **Si en el futuro aparece un bug real de
reglas** (no relacionado con esta visibilidad deseada del panel — p. ej. una
ruta que debería estar protegida por otro motivo), evaluarlo aparte; no
reabrir este plan tal cual, su premisa ya no aplica.

---

## 4. Decisiones pendientes — preguntar ANTES de ejecutar

| Decisión                                                                                   | Bloquea       | Dónde consultar el contexto                          | Qué preguntar                                                                                                                                                    |
| ------------------------------------------------------------------------------------------ | ------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D2** — modelo de auth del panel (Firebase Auth + `/admins` vs mover escrituras a `api/`) | Integración D | `docs/planes/PLAN_INTEGRACIONES.md` §"Integración D" | "¿Qué modelo de auth para el panel — Firebase Auth+`/admins` o mover escrituras a funciones `api/`? Y ¿añado el repo `mcmpanel` a la sesión para poder tocarlo?" |
| **Plan funcional del Panel Pañuelo**                                                       | Panel Pañuelo | `docs/planes/PLAN_PANEL_PANUELO.md` (stub)           | "¿Nos sentamos a diseñar la mecánica de chapas/modelo 3D, o esperamos a después de Carismochito §1–4?"                                                           |

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
