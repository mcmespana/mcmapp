# AGENTS.md — MCM App Monorepo

> Guía para agentes IA trabajando en este repositorio.

## Estructura del monorepo

```
/                           ← Raíz del monorepo
├── mcm-app/               ← App principal (Expo/React Native)
├── portadas-albumes/      ← Assets de portadas
├── CLAUDE.md              ← Instrucciones para agentes (este repo)
├── AGENTS.md              ← Este archivo
├── NOTIFICACIONES.md      ← Sistema de notificaciones push
└── README.md
```

**Todo el código está en `mcm-app/`.** Lee `mcm-app/CLAUDE.md` y `mcm-app/AGENTS.md` antes de cualquier cambio.

## Stack técnico

- **Expo 55** + **React Native 0.83** + **React 19.2** + **TypeScript**
- **UI Library:** `heroui-native` v1.0.0 (Tailwind v4 via Uniwind)
- **Backend:** Firebase Realtime Database
- **Cantoral:** ChordSheetJS (ChordPro → HTML)
- **Navegación:** expo-router (Stack + Tabs)

## Reglas para agentes

1. **Trabaja siempre desde `mcm-app/`** para cambios de código
2. **UI = heroui-native** — No uses react-native-paper (eliminado). Consulta docs en `mcm-app/.heroui-docs/native/` o con el skill `heroui-native`
3. **Documenta en `mcm-app/CHANGELOG.md`** cambios significativos
4. **No toques `.env.local`** — contiene credenciales Firebase
5. **Builds EAS:** usa los scripts `npm run eas:build:*` de `mcm-app/`, nunca `npx eas-cli build` directamente

## HeroUI Native — Referencia rápida

heroui-native es la biblioteca UI de la app. Tiene **37 componentes** con patrón compound.

### Componentes más usados en esta app

| Componente | Import | Uso |
|------------|--------|-----|
| `Card` | `heroui-native` | Tarjetas — usa `Card.Body` (NO `.Content`) |
| `useToast` | `heroui-native` | Notificaciones imperativas |
| `HeroUINativeProvider` | `heroui-native` | Provider raíz (en `_layout.tsx`) |
| `Button` | `heroui-native` | Botones con `Button.Label` |

### Documentación de componentes

```bash
# Desde mcm-app/
node .agents/skills/heroui-native/scripts/get_component_docs.mjs <ComponentName>
node .agents/skills/heroui-native/scripts/list_components.mjs
```

Docs locales en `mcm-app/.heroui-docs/native/`.
MCP server configurado en `mcm-app/.mcp.json`.

### Actualizar docs HeroUI Native

```bash
cd mcm-app
npx heroui-cli@latest agents-md --native --output AGENTS.md
```

## Comandos rápidos

```bash
# Desde mcm-app/
npm start                              # Dev server
npm run web                            # Web
npm run lint && npm run format         # Lint + format
npx tsc --noEmit                       # TypeScript check
npm run eas:build:ios -- --profile production    # Build iOS
npm run eas:build:android -- --profile production # Build Android
```
