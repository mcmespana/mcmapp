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
> Última actualización: 2026-08-07.

---

## 🧭 Puntero rápido

> **Todo gira ahora mismo alrededor de la build de tienda de agosto.** Lo nativo
> —SDK 57, la barra flotante, Reanimated 4, NSE de iOS, Sentry, analítica, icono
> de Carismochito y el subrayado nativo— **ya está en `main`**: la rama
> `claude/compact-tabs-bar-uxxaoz` se mergeó en la
> [PR #313](https://github.com/mcmespana/mcmapp/pull/313) el 2026-08-04, así que
> no hay ninguna rama en vuelo que esperar. Nada de eso puede salir por OTA.
>
> **Si el usuario dice "seguimos"**: lo que toca es sacar la build adelante —
> paso a paso completo en `docs/desarrollo/BUILD_AGOSTO_2026.md`. La Cola
> Principal (§1) se reanuda cuando la build esté publicada.

|  |  |
| --- | --- |
| **Ahora mismo** | **Build de tienda 2.1 — agosto de 2026.** Falta: crear las cuentas de Sentry y Aptabase y meter las claves (§2 del doc de build), validar en dispositivo (§5), publicar (§6) |
| **Bloqueado por ti** | Integración D2 (modelo de auth del panel) · Panel Pañuelo (falta plan funcional) |
| **Bloqueado fuera** | Que el Panel mande `channelId` y `mutableContent` · política de privacidad y fichas de las tiendas (obligatorio antes de publicar, ver §6 del doc de build) |
| **Después de la build** | Integración D → **Build 2.2 (nov-dic): Widget + App Check** → Carismochito + Panel Pañuelo |
| **Oportunista** | Calidad Fase 1 (gigantes), Integraciones resto |
| **Cerrado hoy** | Los 15 planes de la auditoría `/improve` (`plans/001`–`015`), ejecutados el 2026-08-07 — ver §2.A-bis |
| **Cerrado** | Los 8 planes tácticos (archivados en `archivo/tacticos/`), UI Nativa Fase 1, PR #298 |

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
| 1   | **Plan 004** — Contigo: sync bidireccional de hábitos/revisiones + tests `authHelpers`  | Sonnet                                       | No                                                                      | ✅ **DONE** (2026-07-22)                                                                                                                                                                                                                                                                | `archivo/tacticos/004-…`                                |
| 2   | **Plan 005** — Scraper: vacío=error, fecha vetada, pytest en CI, workflow sin inyección | Sonnet                                       | No                                                                      | ✅ **DONE** (2026-07-22)                                                                                                                                                                                                                                                                | `archivo/tacticos/005-…`                                   |
| 3   | **Plan 008** — Caché compartida `useFirebaseData` + calendario stale-while-revalidate   | **Opus**                                     | No                                                                      | ✅ **DONE** en `main` (2026-07-22). **NO cherry-pickeado a producción a propósito**: toca el hook central y cambia comportamiento visible del calendario; validar en dispositivo (vía `preview`, con la próxima build de tienda) antes de producción. No corre prisa (es perf, no bug). | `archivo/tacticos/008-…`                      |
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

### A-bis. Auditoría `/improve` (`plans/001`–`015`) — ✅ HECHA (2026-08-07)

Los 15 planes de la auditoría del 2026-08-05 (los que este documento marcaba como
"candidatos a la bolsa oportunista") se ejecutaron de una tirada en la rama
`claude/backlog-tokens-burn-ofndhx`. Estado y desviaciones de cada uno en
`plans/README.md`. Resumen de lo que arreglaron, por si hace falta el contexto:

- **Bugs de datos visibles**: listeners de Firebase que nunca se quitaban; días
  duplicados/perdidos del calendario al cruzar el cambio de hora y horas del ICS
  1-2 h desfasadas; hábitos de Contigo que se des-completaban solos porque cuatro
  pantallas se pisaban el mapa; notificaciones y subrayados que desaparecían por
  escrituras concurrentes en AsyncStorage; playlists compartidas duplicadas al
  cambiar de código.
- **Release**: guard de cambios nativos y gate de tests antes de cada OTA
  (`verify.yml` como fuente única), y el exit code del scraper deja de decir
  "fallaron todas las fuentes" cuando fallan tres fechas de una.
- **Rendimiento**: ICS en paralelo con ventana de frescura, `useFirebaseData` sin
  re-transformar de balde, muro de Compartiendo virtualizado, páginas del pager de
  materiales sin remontarse, y −290 KB de bundle recortando el calendario
  litúrgico.
- **Deuda**: costura `services/firebaseWrites.ts` (todas las escrituras de UI con
  reintentos y una sola forma), poda de la caché de lecturas, y limpieza de seis
  módulos muertos y cuatro dependencias sin uso.

**Dos cosas quedan pendientes de ti**: quitar `expo-insights` (es nativo y es
telemetría de EAS Insights — sale limpio en `expo-doctor`, pero es tu decisión) y
`npx expo export --platform web`, que está **roto** y lo ejecuta `deploy-web.yml`
en cada push a `production` (detalle en `mcm-app/TODO.md` §1-bis).

### B. Integraciones — resto (A2, C1–C4, E1)

- **Trigger:** "cuando estén" — oportunista, sin fecha fija; hacerlo cuando
  haya hueco o cuando el resto de piezas cross-repo estén listas. No bloquea
  nada ni es prioritario.
- **Modelo:** Sonnet (Fable para C2/C3, son copiar/documentar).
- **Detalle:** `docs/planes/PLAN_INTEGRACIONES.md` secciones A2, C, E1.

### C. Bolsa nativa — la build de tienda de agosto de 2026

> **Estado: la build YA está en marcha y su contenido está en `main`.** La
> "súper rama" `claude/compact-tabs-bar-uxxaoz` se mergeó en la PR #313
> (2026-08-04); esta sección ya no es una lista de espera, es el **contenido de
> esta build** más lo que aún se puede meter antes de compilar. Revisión:
> 2026-08-07.

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
| ✅ **NSE iOS** — imagen en la notificación del sistema | `plugins/withNotificationServiceExtension.js` + `targets/notification-service/` | Target de Xcode nuevo, creado por config plugin propio. Bundle id `…​.MCMNotificationService`: EAS pide credenciales la primera vez |
| ✅ **Sentry** (`@sentry/react-native`) | `utils/sentry.ts` | Sin `EXPO_PUBLIC_SENTRY_DSN` no reporta nada; el SDK nativo va en el binario para poder encenderlo luego por OTA |
| ✅ **Icono alternativo Carismochito** | `expo-alternate-app-icons` + `utils/appIcon.ts` | Iconos generados con `npm run icons:alt` |
| ✅ **Analítica** (`@aptabase/react-native`) | `utils/analytics.ts` + `constants/analyticsEvents.ts` | Sin identificadores persistentes, servidores UE. Sin `EXPO_PUBLIC_APTABASE_KEY` no manda nada |
| ✅ **"Subrayar" en el menú nativo** | `modules/highlight-menu/` | Módulo local de Expo. El modo lápiz se mantiene como respaldo y para web |

#### C.3 — Cambios que exigen algo FUERA de la app

| Qué | Quién | Estado |
| --- | ----- | ------ |
| **Política de privacidad + fichas de las tiendas** | Usuario | La analítica obliga a actualizar la política de privacidad, la ficha de privacidad de App Store y el formulario de Data Safety de Play **antes** de publicar. Aptabase no manda identificadores persistentes, lo que simplifica la declaración, pero hay que hacerla |
| **Cuenta de Sentry y de Aptabase** | Usuario | Crear proyecto, copiar claves y meterlas como secrets de EAS y de GitHub. §2 de `BUILD_AGOSTO_2026.md` |
| **`channelId` en el push** | MCM Panel | El Panel debe mandar `channelId` top-level con el mismo valor que `data.category` (`general` → `default`). Sin él todo cae en `default` como hasta ahora; **con un `channelId` que la app no declare, Android no entrega la notificación**. Tabla cerrada en `docs/contratos/NOTIFICACIONES_CONTRATO.md` §8 |
| **Probar los channels en un Android real** | Usuario | Requisito que ya fijaba `TODO.md`: verificar heads-up/sonido por canal antes de mergear a `production`. Los canales aparecen en los ajustes del sistema de todos los Android y sus preferencias no se pueden revertir a mano |

### C-bis. Build 2.2 — noviembre/diciembre de 2026

Decidido el 2026-08-03: estas dos son NATIVAS y **no entran en la 2.1**. Se
guardan para la siguiente build de tienda.

| Qué | Estado | Por qué se aplaza |
| --- | ------ | ----------------- |
| **Widget de Contigo** (WidgetKit iOS / App Widget Android + App Group) | 0% | Es una feature entera, no un extra. `docs/planes/PLAN_WIDGET_CONTIGO.md` |
| **Firebase App Check** (DeviceCheck / Play Integrity) | 0% | Arrastra `@react-native-firebase` entero junto al SDK JS que ya se usa, y un *enforcement* mal configurado deja sin datos a toda la base instalada. Además la Integración D (reglas) sigue abierta, que es el agujero de verdad |

#### C.4 — Sigue bloqueado por una decisión tuya

| Qué | Qué falta decidir |
| --- | ----------------- |
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

| Decisión                                                                                                               | Bloquea                        | Dónde consultar el contexto                          | Qué preguntar                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **D2** — modelo de auth del panel (Firebase Auth + `/admins` vs mover escrituras a `api/`)                             | Integración D                  | `docs/planes/PLAN_INTEGRACIONES.md` §"Integración D" | "¿Qué modelo de auth para el panel — Firebase Auth+`/admins` o mover escrituras a funciones `api/`? Y ¿añado el repo `mcmpanel` a la sesión para poder tocarlo?"                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Plan funcional del Panel Pañuelo**                                                                                   | Panel Pañuelo                  | `docs/planes/PLAN_PANEL_PANUELO.md` (stub)           | "¿Nos sentamos a diseñar la mecánica de chapas/modelo 3D, o esperamos a después de Carismochito §1–4?"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

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
