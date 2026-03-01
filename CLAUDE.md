# CLAUDE.md — MCM App Monorepo

> Archivo de orientación para agentes IA. El código de la app está en `mcm-app/`.

## Estructura del repositorio

```
/                           ← Raíz del monorepo
├── mcm-app/               ← App principal (Expo/React Native) — LEE mcm-app/CLAUDE.md
├── portadas-albumes/      ← Assets de portadas de álbumes (imágenes)
├── README.md              ← Guía rápida para humanos
├── AGENTS.md              ← Definición de agentes especializados
├── NOTIS_*.md             ← Documentación del sistema de notificaciones push
└── PANEL_NOTIFICACIONES_NEXTJS.md ← Documentación del panel admin (Next.js, no implementado)
```

## Reglas para agentes

1. **Trabaja siempre desde `mcm-app/`** para cualquier cambio de código
2. **Lee `mcm-app/CLAUDE.md`** antes de hacer cualquier cambio — contiene la arquitectura, convenciones y referencia técnica completa
3. **Documenta cambios importantes en `mcm-app/CHANGELOG.md`** — NO documentes cambios cosméticos (colores, padding, etc.), SÍ documenta: nuevas pantallas, cambios de navegación, cambios de lógica de datos, cambios en feature flags, nuevas dependencias, cambios en Firebase
4. **Consulta `mcm-app/TODO.md`** para ver la lista de tareas pendientes de mantenimiento y mejora
5. **No toques archivos `.env.local`** — contienen credenciales de Firebase

## Comandos rápidos (desde mcm-app/)

```bash
npm start              # Servidor de desarrollo
npm run web            # Versión web
npm run lint           # ESLint
npm run format         # Prettier
npm test               # Jest (no hay tests escritos aún)
```

## Notas sobre la documentación NOTIS_*

Los archivos `NOTIS_APP_MEJORAS.md`, `NOTIS_DEVELOP_BACKEND.md`, `NOTIS_GUIA_PRUEBAS.md` y `PANEL_NOTIFICACIONES_NEXTJS.md` documentan un sistema de notificaciones push que está parcialmente implementado. El backend (panel Next.js) no existe aún. La app tiene la parte cliente lista (`mcm-app/notifications/`, `mcm-app/services/pushNotificationService.ts`). Estos archivos son referencia para cuando se retome el desarrollo del backend.
