# Changelog — MCM App

> Registro de cambios importantes. Agentes IA: documentad aquí los cambios significativos.
> NO documentar: ajustes cosméticos, typos, refactors sin cambio funcional.

## Formato

```
## [fecha] — Descripción breve
- Qué cambió y por qué
- Archivos principales afectados
```

---

## 2026-03-01 — Mantenimiento general y reorganización de documentación

### Cambios funcionales
- **Cantoral activado**: `cancionero: true` en `constants/featureFlags.ts`
- **ErrorBoundary global**: nuevo `components/ErrorBoundary.tsx`, envuelve toda la app en `_layout.tsx`
- **Splash screen más rápido**: reducido de 1.5s a 0.9s (3 repeticiones en HelloWave)

### Limpieza de código
- Eliminados componentes muertos: `ReportBugsModalNew.tsx`, `ReportBugsModalFixed.tsx`, `ReportBugsModalSimple.tsx`, `.bak`, `.broken`, `.complex`
- Eliminados scripts de debug: `test-calendar-fix.js`, `test-firebase.js`, `test-new-logic.js`
- Eliminado `jest.config.js` y dependencias de test (jest-expo, @testing-library/*, react-test-renderer)
- Eliminado `dotenv` de dependencies (solo se usaba en script eliminado)
- Movido `eslint-config-expo` de dependencies a devDependencies
- Script `npm test` cambiado a placeholder hasta que se configuren tests

### Documentación
- Creado `CLAUDE.md` en raíz del monorepo (orientación para agentes)
- Reescrito `mcm-app/CLAUDE.md` con referencia técnica completa
- Creado `CHANGELOG.md` y `TODO.md`
- Simplificado `README.md` para humanos con chuletas de comandos
- Consolidado 4 archivos `NOTIS_*.md` + `PANEL_NOTIFICACIONES_NEXTJS.md` → `NOTIFICACIONES.md`
- Eliminado `agents.md` (duplicado de `AGENTS.md`)

## 2025-11 — Estado conocido al crear esta documentación

- App publicada en stores (Android + iOS) y web
- Cantoral (`cancionero`) desactivado via feature flag (`cancionero: false`)
- Tab "Comunica" desactivada y movida a `app/(tabsdesactivados)/`
- Sistema de notificaciones push: cliente implementado, backend (panel Next.js) pendiente
- 4 componentes ReportBugsModal* sin usar (reemplazados por AppFeedbackModal)
- No hay tests de Jest escritos
- Contraseña del panel secreto hardcodeada ("coco" en SecretPanelModal.tsx)
