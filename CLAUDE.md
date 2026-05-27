# CLAUDE.md — MCM App Monorepo

> Archivo de orientación para agentes IA. El código de la app está en `mcm-app/`.

## Estructura del repositorio

```
/                           ← Raíz del monorepo
├── mcm-app/               ← App principal (Expo/React Native) — LEE mcm-app/CLAUDE.md
├── portadas-albumes/      ← Assets de portadas de álbumes (imágenes)
├── README.md              ← Guía rápida para humanos
├── AGENTS.md              ← Definición de agentes especializados
├── NOTIFICACIONES.md      ← Documentación completa del sistema de notificaciones push
└── EVENTOS.md             ← Cómo crear eventos (Jubileo, encuentros, retiros…) y estructura Firebase
```

## 🚨🚨🚨 CRÍTICO: OTA vs Build de Tienda 🚨🚨🚨

> **LEE ESTO ANTES DE CUALQUIER CAMBIO QUE AÑADA PAQUETES**

### ⚠️ Cuándo NO se puede usar OTA (EAS Update)

Los **OTA updates** (Expo/EAS Update) sólo envían el **bundle JavaScript**. NO incluyen código nativo.

**Si el cambio añade cualquiera de estas cosas, la OTA ROMPERÁ LA APP en producción:**

- ❌ Un paquete npm nuevo que tenga módulos nativos (la mayoría de `expo-*`, `react-native-*`)
- ❌ Una actualización de SDK de Expo a una versión mayor
- ❌ Cualquier cambio en `app.json` que afecte a la capa nativa (permisos, plugins, etc.)
- ❌ Cambios en `package.json` que incluyan paquetes con código nativo nuevo

**Por qué crashea:** el bundle JS llama a un módulo nativo que no existe en el binario instalado → crash inmediato al arrancar.

### ✅ Regla para agentes

**ANTES de proponer o hacer commit de un cambio que añada paquetes:**

1. 🔍 **Investiga** si el paquete tiene código nativo (busca `ios/` o `android/` en su repo, o `"nativeModulesDir"` en `package.json`)
2. 🛑 Si tiene código nativo → **el cambio NO puede desplegarse por OTA**
3. 📢 **Avisa al usuario con el bloque de advertencia de abajo**
4. 🏷️ **Añade `[skip-ota]` al mensaje del commit** (o al merge commit) para que el workflow de GitHub Actions NO lance el OTA automático

### 🚫 Bloque de advertencia obligatorio para el usuario

Cuando detectes que un cambio incluye paquetes nativos, COPIA y MUESTRA este mensaje al usuario:

---

> 🚨🚨🚨 **ATENCIÓN: ESTE CAMBIO REQUIERE BUILD DE TIENDA** 🚨🚨🚨
>
> ⛔ **NO se puede desplegar por OTA.** Se han añadido paquetes con código nativo:
> `<lista de paquetes>`
>
> 📦 **Para que funcione en producción hay que:**
> 1. Hacer un **build de producción** (`npm run eas:build -- --profile production`) y subir a App Store / Play Store
> 2. El commit de merge a `production` lleva `[skip-ota]` en el mensaje → el workflow OTA quedará en pausa automáticamente ✅
>
> ⚠️ Si haces merge a `production` sin `[skip-ota]` y sin haber subido el build a tienda, **la app crasheará para todos los usuarios.**

---

### 🏷️ Cómo usar `[skip-ota]`

Incluye `[skip-ota]` en el **mensaje del commit** (o del merge commit a `production`/`preview`):

```
feat: añadir expo-camera para escanear QR [skip-ota]
```

El workflow `.github/workflows/ota-production.yml` detecta esto y **no lanza el OTA**, evitando el crash. En `workflow_dispatch` manual siempre corre (asumiendo que el usuario lo lanzó a propósito).

---

## Reglas para agentes

1. **Trabaja siempre desde `mcm-app/`** para cualquier cambio de código
2. **Lee `mcm-app/CLAUDE.md`** antes de hacer cualquier cambio — contiene la arquitectura, convenciones y referencia técnica completa
3. **Documenta cambios importantes en `mcm-app/CHANGELOG.md`** — NO documentes cambios cosméticos (colores, padding, etc.), SÍ documenta: nuevas pantallas, cambios de navegación, cambios de lógica de datos, cambios en feature flags, nuevas dependencias, cambios en Firebase
4. **Consulta `mcm-app/TODO.md`** para ver la lista de tareas pendientes de mantenimiento y mejora
5. **No toques archivos `.env.local`** — contienen credenciales de Firebase
6. **Si añades paquetes nativos → añade `[skip-ota]` al commit y avisa al usuario** (ver sección crítica arriba)

## Comandos rápidos (desde mcm-app/)

```bash
npm start              # Servidor de desarrollo
npm run web            # Versión web
npm run lint           # ESLint
npm run format         # Prettier
npm test               # Jest (no hay tests escritos aún)
```

### Builds EAS

**NUNCA uses `npx eas-cli build` directamente** — usa los scripts npm que limpian symlinks de Claude Code:

```bash
npm run eas:build:ios -- --profile development     # iOS para dispositivo
npm run eas:build:ios -- --profile production       # iOS para App Store
npm run eas:build:android -- --profile development  # Android para dispositivo
npm run eas:build:android -- --profile production   # Android para Play Store
```

## Notas sobre notificaciones push

`NOTIFICACIONES.md` documenta el sistema completo de notificaciones push (cliente implementado, backend pendiente). Consultar ese archivo para el estado actual, plan de implementación y guía de pruebas.

## Notas sobre eventos (Jubileo y futuros)

`EVENTOS.md` documenta cómo está organizado el sistema de eventos: convención de paths en Firebase (`jubileo/` legacy vs `activities/<nombre>/`), estructura de cada sección (`{ updatedAt, data, hidden? }`), y los tres pasos para añadir un evento nuevo tocando sólo `constants/events.ts` + `MasHomeScreen.tsx`.
