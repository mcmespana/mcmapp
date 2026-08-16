# Documentación — MCM App

> Índice de toda la documentación del monorepo. La documentación específica del
> código de la app vive junto a él, en [`mcm-app/`](../mcm-app/CLAUDE.md).

## Funcionalidades

Cómo funciona cada sistema de la app, de principio a fin.

| Documento                                              | Qué cubre                                                                                                                                            |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| [LOGIN.md](funcionalidades/LOGIN.md)                   | Inicio de sesión con Google y Apple en iOS, Android y web: arquitectura, variables de entorno, **huellas SHA-1 de Android** y diagnóstico de errores |
| [NOTIFICACIONES.md](funcionalidades/NOTIFICACIONES.md) | Sistema de notificaciones push: cliente implementado, backend, plan de pruebas                                                                       |
| [EVENTOS.md](funcionalidades/EVENTOS.md)               | Sistema de eventos (Jubileo, encuentros, retiros…): paths de Firebase y cómo añadir un evento nuevo                                                  |
| [ENCUESTAS.md](funcionalidades/ENCUESTAS.md)           | Sistema de encuestas y evaluaciones (guía funcional)                                                                                                 |
| [COROS.md](funcionalidades/COROS.md)                   | Coros, playlists compartidas y coro en vivo: `/choirs`, importar «la última», actualizar vs subir nueva, contraseña y caducidad de 24 h              |
| [ARREGLOS.md](funcionalidades/ARREGLOS.md)             | Directiva `{arr:}` del cantoral (anotaciones de arreglos) + prompt del generador ChordPro                                                            |
| [ETIQUETAS.md](funcionalidades/ETIQUETAS.md)           | Etiquetas del cantoral: directiva `{tags:}`, catálogo `songs/tags`, botón del header, nube y pantalla `__TAG__:`                                     |
| [SUBRAYADO.md](funcionalidades/SUBRAYADO.md)           | Subrayado de las lecturas de Contigo: rangos, componente de texto nativo y qué falta (build nativa) para el ítem "Subrayar" del menú del sistema     |
| [CANAL_PREVIEW.md](funcionalidades/CANAL_PREVIEW.md)   | Modo tester ("Laboratorio Alpha"): cómo un dispositivo recibe los OTA de `preview` en vez de los de `production`, y cómo comprobarlo                 |

## Contratos de datos (App ↔ MCM Panel)

Formatos acordados entre la app y el panel de administración (`mcmpanel`).
Si cambias uno de estos formatos, actualiza el contrato.

| Documento                                                          | Qué cubre                                                                                                      |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| [NOTIFICACIONES_CONTRATO.md](contratos/NOTIFICACIONES_CONTRATO.md) | Payload de notificaciones push: rutas, `actionButtons[]`, segmentación                                         |
| [ENCUESTAS_CONTRATO.md](contratos/ENCUESTAS_CONTRATO.md)           | Estructura de encuestas/evaluaciones en Firebase                                                               |
| [PANEL_PERFILES.md](contratos/PANEL_PERFILES.md)                   | Sistema de perfiles: nodo `/profileConfig`, delegaciones, visibilidad                                          |
| [COMUNICA_WEBVIEW.md](contratos/COMUNICA_WEBVIEW.md)               | Comunica embebido: `?app=1`, tema claro/oscuro (`?theme=` + cookie), zona segura, enlaces de acceso del correo |

## Planes técnicos

> ★ **Empieza por [`BACKLOG.md`](planes/BACKLOG.md)** — es la fuente única de
> verdad del orden de ejecución de todos los planes, qué está bloqueado por
> una decisión pendiente,
> y el protocolo de trabajo ("seguimos", "me sobran tokens"). Consúltalo
> antes de priorizar nada.

> ★★ **Y para saber qué plan sigue VIVO y cuál está HECHO, mira
> [`planes/README.md`](planes/README.md).** Regla corta: **lo que está en
> `planes/archivo/` está hecho o anulado — no se re-ejecuta.**

**🟢 Vivos:**

| Documento                                             | Qué cubre                                                                                                                 |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [BACKLOG.md](planes/BACKLOG.md)                       | ★ Orden de ejecución, decisiones pendientes, protocolo de trabajo                                                         |
| [planes/README.md](planes/README.md)                  | ★★ Índice de estado: qué plan está vivo, cuál archivado y cuál es futuro lejano                                           |
| [PLAN_UI_NATIVA.md](planes/PLAN_UI_NATIVA.md)         | Unificación de UI y componentes nativos (headers, botones, inputs, color) — 🟡 Fase 2 en curso                            |
| [PLAN_INTEGRACIONES.md](planes/PLAN_INTEGRACIONES.md) | Integraciones app ↔ panel ↔ cantoral — 🟡 solo queda la **Integración D** (reglas Firebase)                               |
| [PLAN_CALIDAD.md](planes/PLAN_CALIDAD.md)             | Saneamiento de código — 🟡 Fase 0 hecha; **Fase 1 descartada**. Su §0 explica cómo organizar código que solo edita una IA |
| [PLAN_CARISMOCHITO.md](planes/PLAN_CARISMOCHITO.md)   | Modo Carismochito: onboarding, colección, comportamiento                                                                  |

**🔵 Futuro lejano** (no se tocan hasta que el usuario lo pida — decisión de 2026-08-15):

| Documento                                               | Qué cubre                                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [PLAN_WIDGET_CONTIGO.md](planes/PLAN_WIDGET_CONTIGO.md) | Widget nativo de hábitos diarios de Contigo                                   |
| [PLAN_PANEL_PANUELO.md](planes/PLAN_PANEL_PANUELO.md)   | Concepto nuevo (sin plan funcional aún): colección de chapas en un pañuelo 3D |

**🗄️ Archivados — HECHOS o ANULADOS, no re-ejecutar:**

| Documento                                                                         | Qué cubre                                                                                                      |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [`planes/archivo/auditoria-2026-08/`](planes/archivo/auditoria-2026-08/README.md) | Los 15 planes de la auditoría `/improve` — **todos hechos** (#317 y #320)                                      |
| [`planes/archivo/tacticos/`](planes/archivo/tacticos/README.md)                   | Planes tácticos 001–008 — cerrados (el 007, anulado)                                                           |
| [archivo/PLAN_TAGS.md](planes/archivo/PLAN_TAGS.md)                               | Etiquetas del cantoral — ✅ completo (app + generador). Doc viva: [ETIQUETAS.md](funcionalidades/ETIQUETAS.md) |
| [archivo/MEJORAS.md](planes/archivo/MEJORAS.md)                                   | Análisis técnico de mayo 2026, ya repartido en otros documentos                                                |

Las tareas accionables derivadas de estos planes están en
[`mcm-app/TODO.md`](../mcm-app/TODO.md).

## Desarrollo

Referencia técnica sobre cómo está construida la app por dentro.

| Documento                                               | Qué cubre                                                                                                                             |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| [DESIGN.md](desarrollo/DESIGN.md)                       | Sistema de diseño (tokens, colores, tipografía, glass, componentes)                                                                   |
| [TABS_MAINTENANCE.md](desarrollo/TABS_MAINTENANCE.md)   | Implementación dual de tabs (iOS NativeTabs vs Android/Web)                                                                           |
| [FIREBASE_REGLAS.md](desarrollo/FIREBASE_REGLAS.md)     | Reglas de la base de datos: qué falta, qué debe cambiar el Panel y cómo desplegarlas                                                  |
| [BUILD_AGOSTO_2026.md](desarrollo/BUILD_AGOSTO_2026.md) | ★ Paso a paso de la build de tienda: variables de Sentry, credenciales, pruebas                                                       |
| [COBERTURA.md](desarrollo/COBERTURA.md)                 | ★ Receta para subir la cobertura de tests. **Es LA tarea cuando el usuario dice "me sobran créditos"**                                |
| [WARNINGS.md](desarrollo/WARNINGS.md)                   | Los 51 warnings del compilador de React: clasificados uno a uno y por qué cada grupo se queda. **Léelo antes de "arreglar warnings"** |

## Seguridad

| Documento                    | Qué cubre                                                              |
| ---------------------------- | ---------------------------------------------------------------------- |
| [SEGURIDAD.md](SEGURIDAD.md) | Reglas de Firebase RTDB, despliegue de reglas, gestión de credenciales |

## Documentación dentro de `mcm-app/`

Documentos que viven junto al código por convención (las herramientas y los
agentes los buscan en el raíz del proyecto).

| Documento                                                     | Qué cubre                                                                                          |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| [CLAUDE.md](../mcm-app/CLAUDE.md)                             | Referencia técnica completa de la app (arquitectura, convenciones, Firebase)                       |
| [AGENTS.md](../mcm-app/AGENTS.md)                             | Guía rápida de agentes IA (heroui-native, patrones)                                                |
| [CHANGELOG.md](../mcm-app/CHANGELOG.md)                       | Registro de cambios (desde mayo 2026; lo anterior en [CHANGELOG-ARCHIVO.md](CHANGELOG-ARCHIVO.md)) |
| [TODO.md](../mcm-app/TODO.md)                                 | Tareas pendientes de mantenimiento y mejora                                                        |
| [firebase-seed/README.md](../mcm-app/firebase-seed/README.md) | JSONs de ejemplo/seed para importar en Firebase RTDB                                               |

## Datos de referencia

- [`mcm-app/firebase-seed/`](../mcm-app/firebase-seed/) — JSONs que reflejan la estructura real de los nodos de Firebase (perfiles, encuestas, eventos como el Jubileo 2025 o la Visita del Papa). Útiles como plantilla para crear contenido nuevo sin acceso a Firebase.
