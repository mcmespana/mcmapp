# CLAUDE.md — MCM App Monorepo

> Archivo de orientación para agentes IA. El código de la app está en `mcm-app/`.

## Estructura del repositorio

```
/                           ← Raíz del monorepo
├── mcm-app/               ← App principal (Expo/React Native) — LEE mcm-app/CLAUDE.md
├── portadas-albumes/      ← Assets de portadas de álbumes (imágenes)
├── README.md              ← Guía rápida para humanos
├── AGENTS.md              ← Definición de agentes especializados
└── NOTIFICACIONES.md      ← Documentación completa del sistema de notificaciones push
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

## Notas sobre notificaciones push

`NOTIFICACIONES.md` documenta el sistema completo de notificaciones push (cliente implementado, backend pendiente). Consultar ese archivo para el estado actual, plan de implementación y guía de pruebas.
