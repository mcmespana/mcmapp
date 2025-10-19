# 🚀 Feature Flags y OTA Updates

Este documento explica cómo usar feature flags con OTA (Over-The-Air) updates de Expo para activar/desactivar funcionalidades sin necesidad de una nueva build.

## 📋 Cómo Funciona

### 1. Build Inicial
Cuando haces un build de producción, el código JavaScript incluye los feature flags actuales de `constants/featureFlags.ts`.

**Estado actual:**
```typescript
const featureFlags: FeatureFlags = {
  tabs: {
    index: true,
    mas: true,
    cancionero: false, // ❌ DESACTIVADO en el build
    calendario: true,
    fotos: true,
    comunica: false,
  },
  // ...
};
```

### 2. Activar Feature con OTA Update

Para activar el cantoral (u otra feature) después del build:

#### Paso 1: Cambiar el feature flag
Edita `constants/featureFlags.ts`:
```typescript
const featureFlags: FeatureFlags = {
  tabs: {
    // ...
    cancionero: true, // ✅ ACTIVADO
    // ...
  },
};
```

#### Paso 2: Hacer commit y push a la rama de producción
```bash
git add constants/featureFlags.ts
git commit -m "Enable cancionero tab via OTA update"
git push origin production
```

#### Paso 3: Publicar OTA Update
```bash
# Publicar update al canal de producción
eas update --branch production --message "Enable cancionero feature"
```

#### Paso 4: Los usuarios reciben el update automáticamente
- **Cuando abren la app**: Expo Updates chequea si hay una nueva versión
- **Si hay update**: Lo descarga en background
- **Próxima vez que abren**: Ya ven el cantoral activado

⚠️ **Importante**: La primera vez que abren después del update NO lo verán. Lo verán en la **segunda apertura**.

### 3. Forzar Update Inmediato (Opcional)

Si quieres que los usuarios vean el cambio inmediatamente al abrir la app, puedes usar:

```typescript
// En app/_layout.tsx o donde inicialices la app
import * as Updates from 'expo-updates';

useEffect(() => {
  async function checkForUpdates() {
    if (!__DEV__) {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync(); // Reinicia la app con el nuevo código
      }
    }
  }
  checkForUpdates();
}, []);
```

## 🔄 Workflow Completo

### Escenario: Lanzar app sin cantoral y activarlo después

```bash
# 1. BUILD INICIAL (cantoral desactivado)
# constants/featureFlags.ts tiene cancionero: false
git checkout production
eas build --platform all --profile production

# 2. Los usuarios descargan la app de las stores
# La app NO muestra el tab de cantoral

# 3. ACTIVAR CANTORAL VÍA OTA (cuando esté listo)
# Editar constants/featureFlags.ts: cancionero: true
git add constants/featureFlags.ts
git commit -m "🎵 Enable cancionero tab"
git push origin production

# Publicar OTA update
eas update --branch production --message "Enable cancionero feature"

# 4. Los usuarios abren la app
# Primera apertura: Descarga el update en background
# Segunda apertura: ✅ Ya ven el tab de cantoral
```

## 📊 Configuración Actual

### Expo Updates Config (app.json)
```json
"updates": {
  "url": "https://u.expo.dev/aa9f2d3a-b74a-4169-bad4-e851015e30c6",
  "fallbackToCacheTimeout": 0,
  "checkAutomatically": "ON_LOAD"
}
```

- `checkAutomatically: "ON_LOAD"`: Chequea updates cada vez que se abre la app
- `fallbackToCacheTimeout: 0`: Usa inmediatamente la versión en caché mientras descarga

### EAS Build Channels (eas.json)
- **development**: Para desarrollo local
- **preview**: Para testing interno
- **production**: Para la app en las stores

## 🎯 Feature Flags Disponibles

```typescript
interface FeatureFlags {
  tabs: {
    index: boolean;        // Tab de inicio
    mas: boolean;          // Tab de más opciones
    cancionero: boolean;   // ⭐ Tab de cantoral (OTA)
    calendario: boolean;   // Tab de calendario
    fotos: boolean;        // Tab de fotos
    comunica: boolean;     // Tab de comunica
  };
  defaultTab: string;                // Tab inicial al abrir la app
  showNotificationsIcon: boolean;    // Icono de notificaciones
  showUserProfilePrompt: boolean;    // Prompt de perfil de usuario
}
```

## 💡 Mejores Prácticas

### ✅ DO:
- Usa OTA updates para cambios de código JavaScript
- Usa feature flags para activar/desactivar funcionalidades
- Prueba el OTA update en canal `preview` antes de `production`
- Documenta cada cambio de feature flag en el commit message

### ❌ DON'T:
- No uses OTA updates para cambios nativos (configuración de Info.plist, permisos, etc.)
- No cambies múltiples features a la vez (dificulta debugging)
- No olvides probar que la feature funciona antes de activarla

## 🔍 Verificar OTA Updates

### Ver updates publicados
```bash
eas update:list --branch production
```

### Ver qué versión tiene un usuario
Los usuarios pueden ver en la app:
```bash
# En desarrollo
npx expo start
# Presiona 'm' en la terminal para ver el menú
# Selecciona "Show update information"
```

## 🚨 Rollback de un Feature Flag

Si necesitas desactivar rápidamente una feature:

```bash
# 1. Cambiar el flag a false
# En constants/featureFlags.ts: cancionero: false

# 2. Publicar rollback
git add constants/featureFlags.ts
git commit -m "🔴 ROLLBACK: Disable cancionero due to [reason]"
git push origin production

eas update --branch production --message "Rollback: Disable cancionero"

# Los usuarios lo verán desactivado en la próxima apertura
```

## 📚 Referencias

- [Expo Updates Documentation](https://docs.expo.dev/versions/latest/sdk/updates/)
- [EAS Update Documentation](https://docs.expo.dev/eas-update/introduction/)
- [Feature Flags Best Practices](https://docs.expo.dev/feature-preview/feature-flags/)

---

**Última actualización**: 2025-10-19
**Runtime Version**: 1.0.1
**EAS Project ID**: aa9f2d3a-b74a-4169-bad4-e851015e30c6
