# CLAUDE.md — MCM App Monorepo

> Archivo de orientación para agentes IA. El código de la app está en `mcm-app/`.

## Estructura del repositorio

```
/                           ← Raíz del monorepo
├── mcm-app/                ← App principal (Expo/React Native) — LEE mcm-app/CLAUDE.md
│   ├── CLAUDE.md           Referencia técnica completa (arquitectura, convenciones, Firebase)
│   ├── TODO.md             Tareas pendientes de mantenimiento y mejora
│   ├── CHANGELOG.md        Registro de cambios
│   └── firebase-seed/      JSONs de seed/plantilla para Firebase (perfiles, encuestas, eventos)
├── docs/                   ← Documentación del monorepo — ÍNDICE en docs/README.md
│   ├── funcionalidades/    Notificaciones push, eventos, encuestas, arreglos y etiquetas del cantoral
│   ├── contratos/          Contratos de datos App ↔ MCM Panel (notificaciones, encuestas, perfiles)
│   ├── planes/             BACKLOG.md (★ orden de ejecución) + README.md (★★ qué plan está VIVO y cuál HECHO)
│   │   └── archivo/        🗄️ Planes YA EJECUTADOS o anulados — NO se re-ejecutan
│   ├── desarrollo/         Sistema de diseño, tabs, build de tienda y WARNINGS.md
│   └── SEGURIDAD.md        Reglas Firebase RTDB y gestión de credenciales
├── scraper-lecturas/       ← Scraper Python de lecturas litúrgicas (corre vía GitHub Action)
├── portadas-albumes/       ← Assets de portadas de álbumes (imágenes)
└── README.md               ← Guía rápida para humanos (setup, builds, releases)
```

## Reglas para agentes

1. **Trabaja siempre desde `mcm-app/`** para cualquier cambio de código de la app
2. **Lee `mcm-app/CLAUDE.md`** antes de hacer cualquier cambio — contiene la arquitectura, convenciones y referencia técnica completa
3. **Consulta `docs/README.md`** para localizar la documentación de funcionalidades (notificaciones, eventos, encuestas), contratos con el panel y planes técnicos
4. **Documenta cambios importantes en `mcm-app/CHANGELOG.md`** — entrada nueva arriba del todo, con **fecha Y hora** (`## YYYY-MM-DD HH:MM — Título`). NO documentes cambios cosméticos (colores, padding, etc.), SÍ documenta: nuevas pantallas, cambios de navegación, cambios de lógica de datos, cambios en perfiles/visibilidad, nuevas dependencias, cambios en Firebase
5. **Consulta `mcm-app/TODO.md`** para ver la lista de tareas pendientes de mantenimiento y mejora
6. **No toques archivos `.env.local`** — contienen credenciales de Firebase
7. **Que algo NO sea OTA no es un motivo para no hacerlo, ni un riesgo a debatir.** El usuario decide cuándo le viene mal esperar al siguiente build nativo. Si un cambio lleva código nativo: añade `[skip-ota]` al commit y cierra la respuesta con UNA línea al final, sin dramatizar ni repetirlo en el cuerpo del texto:
   - `OTA: ❌ — requiere build nativo (paquetes: [lista]). Commit con [skip-ota].`
   - `OTA: ✅ — solo JS.`
     (detalles del workflow en OTA de `mcm-app/CLAUDE.md`)
8. **Sin acceso a Firebase, usa `mcm-app/firebase-seed/`** como referencia de la estructura real de los nodos (perfiles, encuestas, eventos como el Jubileo 2025) para construir JSONs nuevos
9. **Antes de retomar o priorizar cualquier plan/tarea de fondo, lee `docs/planes/BACKLOG.md` ENTERO** — es la fuente única de verdad del orden de ejecución, qué está bloqueado por una decisión pendiente del usuario, y el protocolo de trabajo (qué hacer cuando dicen "seguimos" o "me sobran tokens"). No priorices desde cero ni mires un solo `PLAN_*.md` suelto sin pasar antes por ahí.
10. **Un plan dentro de `docs/planes/archivo/` está HECHO o ANULADO: NO lo re-ejecutes.** El índice de qué sigue vivo es `docs/planes/README.md`. Al terminar un plan, muévelo a `archivo/` **en el mismo commit** que cierra el trabajo — dejarlo en su sitio con una cabecera de "✅ hecho" no basta, ya provocó que dos sesiones ejecutaran los mismos 15 planes en paralelo.
11. **Antes de "arreglar los warnings" del linter, lee `docs/desarrollo/WARNINGS.md`** — los 51 que quedan están clasificados y justificados uno a uno; casi todos son falsos positivos de Reanimated o del patrón de "ref al último callback". Lo que sí se pide es no añadir warnings NUEVOS.
12. **Los archivos gigantes se quedan gigantes** (decisión del usuario, 2026-08-15). No trocees por tamaño; trocea solo por testabilidad. Razonamiento en `docs/planes/PLAN_CALIDAD.md` §0.

## Comandos rápidos (desde mcm-app/)

```bash
npm start              # Servidor de desarrollo
npm run web            # Versión web
npm run lint           # ESLint
npm run format         # Prettier
npm test               # Jest
npx tsc --noEmit       # Typecheck
```

### Builds EAS

**NUNCA uses `npx eas-cli build` directamente** — usa los scripts npm que limpian symlinks de Claude Code:

```bash
npm run eas:build:ios -- --profile development      # iOS para dispositivo
npm run eas:build:ios -- --profile production       # iOS para App Store
npm run eas:build:android -- --profile development  # Android para dispositivo
npm run eas:build:android -- --profile production   # Android para Play Store
```

## Documentación por tema

| Tema                                                                     | Documento                                                                    |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Notificaciones push (sistema completo)                                   | `docs/funcionalidades/NOTIFICACIONES.md`                                     |
| Contrato de notificaciones con el panel                                  | `docs/contratos/NOTIFICACIONES_CONTRATO.md`                                  |
| Eventos (Jubileo, encuentros, retiros…)                                  | `docs/funcionalidades/EVENTOS.md`                                            |
| Calendarios ICS y su precacheo (Cloud Function)                          | `docs/funcionalidades/CALENDARIOS.md`                                        |
| Coros y playlists compartidas                                            | `docs/funcionalidades/COROS.md`                                              |
| Encuestas/evaluaciones                                                   | `docs/funcionalidades/ENCUESTAS.md` + `docs/contratos/ENCUESTAS_CONTRATO.md` |
| Sistema de perfiles (App ↔ Panel)                                        | `docs/contratos/PANEL_PERFILES.md`                                           |
| Seguridad y reglas Firebase                                              | `docs/SEGURIDAD.md`                                                          |
| Orden de ejecución de planes (★ leer primero)                            | `docs/planes/BACKLOG.md`                                                     |
| Qué plan está VIVO y cuál ya está HECHO (★★)                             | `docs/planes/README.md`                                                      |
| **"Me sobran créditos"** → subir cobertura de tests (receta paso a paso) | `docs/desarrollo/COBERTURA.md`                                               |
| Warnings del linter: cuáles quedan y por qué                             | `docs/desarrollo/WARNINGS.md`                                                |
| Cómo organizar código que solo edita una IA                              | `docs/planes/PLAN_CALIDAD.md` §0                                             |
| Plan de saneamiento de código                                            | `docs/planes/PLAN_CALIDAD.md`                                                |
| Etiquetas del cantoral (`{tags:}`)                                       | `docs/funcionalidades/ETIQUETAS.md`                                          |
| Sistema de diseño / tabs                                                 | `docs/desarrollo/DESIGN.md` + `docs/desarrollo/TABS_MAINTENANCE.md`          |
| Build de tienda de agosto 2026 (paso a paso)                             | `docs/desarrollo/BUILD_AGOSTO_2026.md`                                       |
| Arreglos del cantoral (`{arr:}`)                                         | `docs/funcionalidades/ARREGLOS.md`                                           |
| Etiquetas del cantoral (`{tags:}`)                                       | `docs/funcionalidades/ETIQUETAS.md`                                          |
| Subrayado de lecturas (Contigo)                                          | `docs/funcionalidades/SUBRAYADO.md`                                          |
