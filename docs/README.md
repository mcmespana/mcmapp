# Documentación — MCM App

> Índice de toda la documentación del monorepo. La documentación específica del
> código de la app vive junto a él, en [`mcm-app/`](../mcm-app/CLAUDE.md).

## Funcionalidades

Cómo funciona cada sistema de la app, de principio a fin.

| Documento | Qué cubre |
| --------- | --------- |
| [NOTIFICACIONES.md](funcionalidades/NOTIFICACIONES.md) | Sistema de notificaciones push: cliente implementado, backend, plan de pruebas |
| [EVENTOS.md](funcionalidades/EVENTOS.md) | Sistema de eventos (Jubileo, encuentros, retiros…): paths de Firebase y cómo añadir un evento nuevo |
| [ENCUESTAS.md](funcionalidades/ENCUESTAS.md) | Sistema de encuestas y evaluaciones (guía funcional) |
| [ARREGLOS.md](funcionalidades/ARREGLOS.md) | Directiva `{arr:}` del cantoral (anotaciones de arreglos) + prompt del generador ChordPro |

## Contratos de datos (App ↔ MCM Panel)

Formatos acordados entre la app y el panel de administración (`mcmpanel`).
Si cambias uno de estos formatos, actualiza el contrato.

| Documento | Qué cubre |
| --------- | --------- |
| [NOTIFICACIONES_CONTRATO.md](contratos/NOTIFICACIONES_CONTRATO.md) | Payload de notificaciones push: rutas, `actionButtons[]`, segmentación |
| [ENCUESTAS_CONTRATO.md](contratos/ENCUESTAS_CONTRATO.md) | Estructura de encuestas/evaluaciones en Firebase |
| [PANEL_PERFILES.md](contratos/PANEL_PERFILES.md) | Sistema de perfiles: nodo `/profileConfig`, delegaciones, visibilidad |

## Planes técnicos

> ★ **Empieza por [`BACKLOG.md`](planes/BACKLOG.md)** — es la fuente única de
> verdad del orden de ejecución de TODOS los planes (tácticos de `plans/` +
> estratégicos de aquí abajo), qué está bloqueado por una decisión pendiente,
> y el protocolo de trabajo ("seguimos", "me sobran tokens"). Consúltalo
> antes de priorizar nada.

| Documento | Qué cubre |
| --------- | --------- |
| [BACKLOG.md](planes/BACKLOG.md) | ★ Orden de ejecución, decisiones pendientes, protocolo de trabajo |
| [PLAN_CALIDAD.md](planes/PLAN_CALIDAD.md) | Plan de saneamiento de código por fases (archivos gigantes, contexts, tipos, tests) |
| [PLAN_INTEGRACIONES.md](planes/PLAN_INTEGRACIONES.md) | Auditoría de integraciones app ↔ panel ↔ cantoral (2026-07): arreglos aplicados y acciones pendientes ejecutables una a una |
| [PLAN_UI_NATIVA.md](planes/PLAN_UI_NATIVA.md) | Unificación de UI y componentes nativos (headers, botones, inputs, color) |
| [PLAN_CARISMOCHITO.md](planes/PLAN_CARISMOCHITO.md) | Modo Carismochito: onboarding, colección, comportamiento |
| [PLAN_WIDGET_CONTIGO.md](planes/PLAN_WIDGET_CONTIGO.md) | Widget nativo de hábitos diarios de Contigo |
| [PLAN_PANEL_PANUELO.md](planes/PLAN_PANEL_PANUELO.md) | Concepto nuevo (sin plan funcional aún): colección de chapas en un pañuelo 3D |
| [`plans/`](../plans/README.md) | Planes tácticos numerados (001–008), ejecutables paso a paso |
| [archivo/MEJORAS.md](planes/archivo/MEJORAS.md) | 🗄️ Archivado — análisis técnico de mayo 2026, superseded por lo de arriba |

Las tareas accionables derivadas de estos planes están en
[`mcm-app/TODO.md`](../mcm-app/TODO.md).

## Desarrollo

Referencia técnica sobre cómo está construida la app por dentro.

| Documento | Qué cubre |
| --------- | --------- |
| [DESIGN.md](desarrollo/DESIGN.md) | Sistema de diseño (tokens, colores, tipografía, glass, componentes) |
| [TABS_MAINTENANCE.md](desarrollo/TABS_MAINTENANCE.md) | Implementación dual de tabs (iOS NativeTabs vs Android/Web) |

## Seguridad

| Documento | Qué cubre |
| --------- | --------- |
| [SEGURIDAD.md](SEGURIDAD.md) | Reglas de Firebase RTDB, despliegue de reglas, gestión de credenciales |

## Documentación dentro de `mcm-app/`

Documentos que viven junto al código por convención (las herramientas y los
agentes los buscan en el raíz del proyecto).

| Documento | Qué cubre |
| --------- | --------- |
| [CLAUDE.md](../mcm-app/CLAUDE.md) | Referencia técnica completa de la app (arquitectura, convenciones, Firebase) |
| [AGENTS.md](../mcm-app/AGENTS.md) | Guía rápida de agentes IA (heroui-native, patrones) |
| [CHANGELOG.md](../mcm-app/CHANGELOG.md) | Registro de cambios (desde mayo 2026; lo anterior en [CHANGELOG-ARCHIVO.md](CHANGELOG-ARCHIVO.md)) |
| [TODO.md](../mcm-app/TODO.md) | Tareas pendientes de mantenimiento y mejora |
| [firebase-seed/README.md](../mcm-app/firebase-seed/README.md) | JSONs de ejemplo/seed para importar en Firebase RTDB |

## Datos de referencia

- [`mcm-app/firebase-seed/`](../mcm-app/firebase-seed/) — JSONs que reflejan la estructura real de los nodos de Firebase (perfiles, encuestas, eventos como el Jubileo 2025 o la Visita del Papa). Útiles como plantilla para crear contenido nuevo sin acceso a Firebase.
