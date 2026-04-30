# 📱 Mantenimiento de Tabs - Guía Completa

## 🎯 Solución Implementada

Se ha implementado una **solución híbrida** que proporciona la mejor experiencia en cada plataforma:

- **iOS**: NativeTabs para compatibilidad con liquid glass
- **Android/Web**: Tabs tradicionales para mejor funcionalidad y visualización

## 🏗️ Arquitectura

### Estructura del archivo `app/(tabs)/_layout.tsx`

```typescript
// Componente principal que decide qué implementación usar
export default function TabsLayout() {
  return (
    <>
      {Platform.OS === 'ios' ? (
        <iOSNativeTabsLayout />  // Para iOS
      ) : (
        <AndroidWebTabsLayout /> // Para Android/Web
      )}
      <StatusBar />
    </>
  );
}
```

## 📋 Cómo Añadir un Nuevo Tab

### 1. Añadir el tab a la configuración centralizada

En `app/(tabs)/_layout.tsx`, añade un objeto al array `TABS_CONFIG`:

```typescript
const TABS_CONFIG: TabConfig[] = [
  // ... tabs existentes
  {
    name: 'nuevoTab',
    label: 'Nuevo Tab',
    iosIcon: { default: 'star', selected: 'star.fill' },
    androidIcon: 'star',
    headerColor: TabHeaderColors.nuevoTab, // Opcional
    headerShown: true,
  },
];
```

### 2. (Opcional) Definir color del header

Si quieres que el tab tenga un color identificativo, añádelo a `constants/colors.ts`:

```typescript
export const TabHeaderColors = {
  // ... colores existentes
  nuevoTab: '#FF5733',
};
```

### 3. Registrar el tab en el Sistema de Perfiles

El antiguo `constants/featureFlags.ts` ya no existe. Ahora la visibilidad por
perfil/delegación se controla desde `/profileConfig` en Firebase RTDB. Hay
que tocar dos sitios:

1. **Catálogo local** (`constants/profileCatalog.ts`): añadir el ID del tab
   a `KNOWN_TABS`. Sin esto el resolver lo descarta como ID desconocido.
2. **Config remota + seed** (`firebase-seed/profileConfig.json` y `/profileConfig/data/profiles/*` en Firebase):
   añadir el nuevo ID al array `tabs` de los perfiles que deban verlo.

### 4. Crear el archivo del tab

Crear `app/(tabs)/nuevoTab.tsx`:

```typescript
import TabScreenWrapper from '@/components/ui/TabScreenWrapper.ios';
import { StyleSheet, Text } from 'react-native';

export default function NuevoTab() {
  return (
    <TabScreenWrapper style={styles.container} edges={['top']}>
      <Text>Contenido de Nuevo Tab</Text>
    </TabScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
```

**Nota importante**:

- El `TabScreenWrapper` automáticamente muestra una barra de color de 4px en la parte superior en iOS si el tab tiene un color definido en `TabHeaderColors`
- En Android/Web funciona como un `SafeAreaView` normal
- **Siempre usa `TabScreenWrapper`** en lugar de `SafeAreaView` para mantener consistencia visual

## 🎨 Personalización de Estilos

### Colores de Header por Tab

Los colores de headers se definen en `constants/colors.ts` en el objeto `TabHeaderColors`:

```typescript
export const TabHeaderColors = {
  calendario: '#31AADF',
  fotos: '#E15C62',
  comunica: '#9D1E74dd',
  nuevoTab: '#TU_COLOR', // Añade aquí el color para tu nuevo tab
};
```

Luego, en la configuración del tab en `_layout.tsx`, simplemente referencia el color:

```typescript
{
  name: 'nuevoTab',
  label: 'Nuevo Tab',
  iosIcon: { default: 'star', selected: 'star.fill' },
  androidIcon: 'star',
  headerColor: TabHeaderColors.nuevoTab, // Referencia al color
  headerShown: true,
}
```

**Comportamiento por plataforma:**

- **Android/Web**: El color se aplica al header completo
- **iOS**: Se muestra una barra de color sutil de 4px en la parte superior (glass effect en el header)

### Iconos

**iOS**: Usar SF Symbols

```typescript
<Icon sf={{ default: 'house', selected: 'house.fill' }} />
```

**Android/Web**: Usar Material Icons

```typescript
<MaterialIcons name="home" color={color} size={size} />
```

## 🔧 Mantenimiento Fácil

### Principios de Diseño

1. **Separación clara**: iOS y Android/Web están completamente separados
2. **Misma funcionalidad**: Ambos tienen las mismas opciones de tabs
3. **Fácil de extender**: Añadir un tab nuevo requiere cambios en ambos lugares
4. **Consistencia**: Los nombres en `TABS_CONFIG`, `KNOWN_TABS` y `profiles.*.tabs` deben coincidir

### Checklist para Cambios

- [ ] ¿Añado el tab al array `TABS_CONFIG`?
- [ ] ¿Defino el color en `TabHeaderColors` (si aplica)?
- [ ] ¿Añado el ID a `KNOWN_TABS` en `constants/profileCatalog.ts`?
- [ ] ¿Añado el ID a `tabs` en cada perfil de `firebase-seed/profileConfig.json` **y** en `/profileConfig/data/profiles/*` de Firebase?
- [ ] ¿Creo el archivo del tab con `TabScreenWrapper`?
- [ ] ¿Pruebo en iOS, Android y Web?

## 🐛 Solución de Problemas

### Problema: El tab no aparece en ninguna plataforma

**Solución**:

1. Verificar que el tab esté en el array `TABS_CONFIG`
2. Verificar que el ID esté en `KNOWN_TABS` (`constants/profileCatalog.ts`) **y** en `tabs` del perfil resuelto (Firebase `/profileConfig/data/profiles/*` y/o `firebase-seed/profileConfig.json`)
3. Verificar que el archivo del tab exista en `app/(tabs)/nombreTab.tsx`

### Problema: Error "View config getter callback for component must be a function"

**Solución**: Los nombres de componentes funcionales deben empezar con mayúscula. Ejemplo:

- ❌ `function iOSNativeTabsLayout()`
- ✅ `function IOSNativeTabsLayout()`

### Problema: Los iconos no se ven en Android/Web

**Solución**: Verificar que el nombre del icono MaterialIcons sea correcto en `TABS_CONFIG`

### Problema: Los iconos no se ven en iOS

**Solución**: Verificar que el nombre del SF Symbol sea correcto en `TABS_CONFIG`

### Problema: La barra de color no aparece en iOS

**Solución**:

1. Verificar que el color esté definido en `TabHeaderColors` en `constants/colors.ts`
2. Verificar que el tab use `headerColor: TabHeaderColors.tuTab` en `TABS_CONFIG`
3. Verificar que la página del tab use `TabScreenWrapper` en lugar de `SafeAreaView`

### Problema: El tab bar en Android está muy abajo y choca con elementos

**Solución**: Ya está solucionado con `height: 75` y `paddingTop: 12`. Si persiste, ajustar estos valores en `_layout.tsx`

## 📱 Resultados por Plataforma

### iOS

- ✅ Compatible con liquid glass
- ✅ SF Symbols nativos
- ✅ Efecto glass en headers
- ✅ Integración perfecta con el sistema
- ✅ Barra de color superior de 4px para indicar sección
- ✅ Sin colisiones visuales

### Android

- ✅ Tabs en la parte inferior (altura optimizada: 75px)
- ✅ Iconos MaterialIcons
- ✅ Colores de header personalizados
- ✅ Funcionalidad completa
- ✅ Sombra mejorada (elevation: 8)
- ✅ Animación suave entre tabs
- ✅ Padding ajustado para evitar colisiones

### Web

- ✅ Tabs en la parte inferior (altura: 80px)
- ✅ Iconos MaterialIcons
- ✅ Responsive design
- ✅ Funcionalidad completa
- ✅ Animación suave entre tabs
- ✅ Padding optimizado para mejor UX

## 🎯 Ventajas de esta Solución

1. **Mantenibilidad**: Código claro y separado por plataforma
2. **Flexibilidad**: Cada plataforma usa su mejor implementación
3. **Consistencia**: Misma funcionalidad en todas las plataformas
4. **Escalabilidad**: Fácil añadir nuevos tabs
5. **Compatibilidad**: iOS mantiene liquid glass, Android/Web funcionan perfectamente
6. **DRY (Don't Repeat Yourself)**: Configuración centralizada en `TABS_CONFIG`
7. **Visual Feedback**: Barra de color superior en iOS, headers coloreados en Android/Web
8. **Animaciones**: Transiciones suaves entre tabs en Android/Web

## 📝 Notas Importantes

- **No modificar** la lógica de `Platform.OS === 'ios'` sin entender las implicaciones
- **Usar `TabScreenWrapper`** en todos los tabs para mantener consistencia visual
- **Definir colores** en `constants/colors.ts` en lugar de hardcodear
- **Configuración centralizada**: Todos los tabs se definen en `TABS_CONFIG`
- **Probar** en todas las plataformas después de cambios
- **Mantener** los feature flags sincronizados

## 🆕 Mejoras Recientes (v2.0)

### Configuración Centralizada

- Todos los tabs ahora se definen en el array `TABS_CONFIG`
- No más duplicación: un solo lugar para configurar cada tab
- Type-safe con TypeScript

### Sistema de Colores Mejorado

- Colores movidos a `constants/colors.ts` con `TabHeaderColors`
- Fácil de mantener y cambiar
- Reutilizable en toda la app

### Indicador Visual de Sección (iOS)

- Barra de color de 4px en la parte superior de tabs con color
- Se muestra automáticamente usando `TabScreenWrapper`
- Sutilmente indica la sección actual sin romper el glass effect

### Mejoras en Android/Web

- Tab bar más alto para evitar colisiones (75px en Android, 80px en Web)
- Padding ajustado para mejor espacio respirable
- Sombra mejorada con `elevation: 8`
- Animación `shift` para transiciones suaves entre tabs

---

_Esta documentación debe actualizarse cada vez que se modifique la implementación de tabs._
