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

## Contratos de datos (App ↔ MCM Panel)

Formatos acordados entre la app y el panel de administración (`mcmpanel`).
Si cambias uno de estos formatos, actualiza el contrato.

| Documento | Qué cubre |
| --------- | --------- |
| [NOTIFICACIONES_CONTRATO.md](contratos/NOTIFICACIONES_CONTRATO.md) | Payload de notificaciones push: rutas, `actionButtons[]`, segmentación |
| [ENCUESTAS_CONTRATO.md](contratos/ENCUESTAS_CONTRATO.md) | Estructura de encuestas/evaluaciones en Firebase |
| [PANEL_PERFILES.md](contratos/PANEL_PERFILES.md) | Sistema de perfiles: nodo `/profileConfig`, delegaciones, visibilidad |

## Planes técnicos

| Documento | Qué cubre |
| --------- | --------- |
| [MEJORAS.md](planes/MEJORAS.md) | Análisis técnico transversal (rendimiento, arquitectura, seguridad, DX, CI) con plan priorizado |
| [PLAN_CALIDAD.md](planes/PLAN_CALIDAD.md) | Plan de saneamiento de código por fases (archivos gigantes, contexts, tipos, tests) |

Las tareas accionables derivadas de estos planes están en
[`mcm-app/TODO.md`](../mcm-app/TODO.md).

## Seguridad

| Documento | Qué cubre |
| --------- | --------- |
| [SEGURIDAD.md](SEGURIDAD.md) | Reglas de Firebase RTDB, despliegue de reglas, gestión de credenciales |

## Documentación dentro de `mcm-app/`

| Documento | Qué cubre |
| --------- | --------- |
| [CLAUDE.md](../mcm-app/CLAUDE.md) | Referencia técnica completa de la app (arquitectura, convenciones, Firebase) |
| [CHANGELOG.md](../mcm-app/CHANGELOG.md) | Registro de cambios (desde mayo 2026; lo anterior en [CHANGELOG-ARCHIVO.md](CHANGELOG-ARCHIVO.md)) |
| [TODO.md](../mcm-app/TODO.md) | Tareas pendientes de mantenimiento y mejora |
| [DESIGN.md](../mcm-app/DESIGN.md) | Sistema de diseño |
| [ARREGLOS.md](../mcm-app/ARREGLOS.md) | Directiva `{arr:}` del cantoral (anotaciones de arreglos) |
| [TABS_MAINTENANCE.md](../mcm-app/TABS_MAINTENANCE.md) | Implementación dual de tabs (iOS NativeTabs vs Android/Web) |
| [firebase-seed/README.md](../mcm-app/firebase-seed/README.md) | JSONs de ejemplo/seed para importar en Firebase RTDB |

## Datos de referencia

- [`mcm-app/firebase-seed/`](../mcm-app/firebase-seed/) — JSONs que reflejan la estructura real de los nodos de Firebase (perfiles, encuestas, eventos como el Jubileo 2025 o la Visita del Papa). Útiles como plantilla para crear contenido nuevo sin acceso a Firebase.
