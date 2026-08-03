# 📱 Mantenimiento de Tabs - Guía Completa

## 🎯 Arquitectura actual

Desde agosto de 2026 la barra de pestañas tiene **tres** implementaciones, no dos:

| Plataforma | Barra                              | Navegador                                       |
| ---------- | ---------------------------------- | ----------------------------------------------- |
| iOS        | `CompactTabBar` (flotante, nativa) | `NativeTabs` con la barra del sistema oculta    |
| Android    | `CompactTabBar` (flotante, nativa) | `Tabs` de expo-router con `tabBar={() => null}` |
| Web        | Barra clásica, en flujo            | `Tabs` de expo-router                           |

`CompactTabBar` envuelve `NativeCompactTabBar` de
[`expo-native-compact-tabs`](https://github.com/Kellytomi/expo-native-compact-tabs):
al scrollear se **compacta manteniendo todos los iconos visibles**, en lugar de
colapsar a la píldora del sistema que los esconde. Liquid Glass real en iOS 26+,
píldora sólida con cápsula animada en iOS 16.4–18.x y Android.

> ⚠️ Es un control **visual**, no un navegador. Quien navega es expo-router desde
> `onTabSelected`; `selectedIndex` se deriva del `usePathname()`.

### Por qué Android sigue con `Tabs` y no con `NativeTabs`

Porque en Android los headers salen de las `options` de cada `Tabs.Screen`
(`title`, `headerColor`, `headerShown` de `TABS_CONFIG`). Con `NativeTabs` habría
que reconstruirlos pantalla a pantalla sin ganar nada: la barra visible ya no es
la del navegador.

### Ficheros

```
app/(tabs)/_layout.tsx            ← selector por plataforma (3 ramas)
components/tabs/
  IOSTabsLayout.tsx               ← NativeTabs (barra oculta) + overlay
  AndroidTabsLayout.tsx           ← Tabs (barra oculta) + overlay
  WebTabsLayout.tsx               ← barra clásica, sin cambios
  CompactTabBar.tsx               ← la barra flotante en sí
  tabBarController.ts             ← estado compacta/expandida (singleton)
  collapseRule.ts                 ← regla pura de cuándo compactar/expandir
  useTabScroll.ts                 ← engancha una pantalla a la barra
constants/tabsCatalog.ts          ← TABS_CONFIG (orden) + splitTabsForBar
constants/tabIcons.ts             ← mapa estático de PNGs por tab
scripts/generate-tab-icons.js     ← genera esos PNGs (`npm run icons:tabs`)
hooks/useTabBarClearance.ts       ← hueco a reservar al final de un scroll
utils/tabRoutes.ts                ← helpers puros tab ↔ ruta
```

### Los iconos son PNG (y por qué)

No es un capricho: en el límite nativo la barra recibe un `UIImage` (iOS) o un
`Bitmap` (Android). Ninguna librería de iconos cambia eso — SF Symbols,
MaterialIcons o Lucide acabarían igualmente rasterizados ahí. La alternativa
real sería pintar la barra en JS con `react-native-svg`, pero entonces se pierde
lo único por lo que se usa esta librería: que la barra sea nativa (Liquid Glass,
animación de selección de UIKit).

Para que en el día a día nadie toque un PNG a mano, `npm run icons:tabs` los
genera desde el MISMO glifo de MaterialIcons que ya declara `androidIcon` en
`TABS_CONFIG`. Dos detalles del generador que costaron un susto:

- Se dibuja sobre la **caja em** de la fuente, no sobre el bounding box de cada
  glifo. Los glifos de MaterialIcons comparten un em de 512 unidades y están
  diseñados dentro de él; normalizar cada uno a su propia caja los descuadra
  entre sí (`more-horiz` salía 4x más grande de lo que le toca).
- La caja es de **24pt**, que es lo que espera la barra nativa.

### Parche a la librería (`patches/`)

`expo-native-compact-tabs` tiene un bug de escala en iOS: `UITabBarItem` dibuja
la imagen a su tamaño natural en puntos (píxeles ÷ escala) y nunca la
redimensiona, pero la librería carga los ficheros con `UIImage(contentsOfFile:)`,
que **siempre reporta escala 1.0**. Resultado en un build real: un asset @3x se
pinta 3 veces más grande, tapando las etiquetas. En dev con Metro no se ve
porque ahí el fichero llega por http y sí se decodifica con la escala correcta.

El parche (`patches/expo-native-compact-tabs+0.2.0.patch`, aplicado por
`patch-package` en el `postinstall`) normaliza la escala a partir del ancho real
en píxeles, así que el icono mide 24pt venga del fichero que venga. No se puede
resolver mirando el nombre del fichero: los bundlers que hashean los assets
embebidos se comen el sufijo `@3x`.

Android no está afectado: su icono va en una caja fija de 28dp con
`CENTER_INSIDE`, así que el bitmap se ajusta solo.

### Tope de tabs en la barra

`MAX_TAB_BAR_ITEMS = 6` (en `constants/tabsCatalog.ts`). Antes era 5 y venía
impuesto por `UITabBarController`; con barra propia es una decisión de diseño y
se aplica igual en iOS y Android. Los que no caben se muestran como tarjetas en
`MasHomeScreen` vía `splitTabsForBar`. En web se ven todos.

### La barra FLOTA: hay que reservarle hueco

No ocupa layout en iOS ni en Android, así que cada pantalla de tab tiene que
dejar sitio al final de su scroll. Eso y el colapso se resuelven de una vez con
`components/tabs/useTabScroll.ts`:

```tsx
// Pantalla raíz de un tab, con ScrollView
const { scrollRef, onScroll, contentPaddingBottom } =
  useTabScroll("cancionero");

<Animated.ScrollView
  ref={scrollRef}
  onScroll={onScroll}
  scrollEventThrottle={16}
  contentContainerStyle={{ paddingBottom: contentPaddingBottom }}
/>;
```

```tsx
// Con FlatList / SectionList (usa Animated.FlatList)
const { listRef, onScroll, contentPaddingBottom } =
  useTabListScroll<FlatList>("fotos");
```

Reglas:

- La clave es el `name` del tab en `TABS_CONFIG`. Sirve para que **re-tapear el
  tab activo** mande ese scroller arriba del todo.
- Pantallas **anidadas** dentro de un tab (detalle de canción, subrutas de
  Contigo, EventHome apilado desde Más) pasan `null`: colapsan igual, pero no se
  registran para no pisar al scroller raíz del tab.
- Para UI flotante que NO es un scroll (FABs, mini reproductor, barras de
  acciones), usar `useTabBarClearance()` directamente como `bottom`.
- `Comunica` es la excepción: es un WebView, no un scroller de RN. Se engancha a
  su `onScroll` con `useWebViewCollapse()` (por JS, no worklet) para que la barra
  compacte igual, y el hueco de abajo se reserva según la plataforma —
  `contentInset` en iOS, `padding` inyectado en la propia página en Android,
  que no lo admite. Ver `docs/contratos/COMUNICA_WEBVIEW.md` §3.

### Cuándo se compacta y cuándo se expande

La decisión vive en `components/tabs/collapseRule.ts`, una función pura
(`collapseStep`) con directiva `'worklet'`: la llaman los dos caminos —el
worklet de Reanimated de `useCollapsingScroll` y el `onScroll` por JS del
WebView de Comunica— y se prueba sola en `__tests__/collapseRule.test.ts`.

Cuatro reglas, cada una arreglando algo que se notaba en uso:

1. **Umbrales asimétricos.** Compactar cuesta 5 px de recorrido hacia abajo;
   expandir, 40 px hacia arriba. Con umbrales simétricos costaba compactar y
   cualquier temblor del dedo devolvía la barra a grande mientras leías.
2. **El ancla persigue el extremo.** Compactada, el ancla sigue al punto más
   bajo alcanzado; expandida, al más alto. Así el recorrido se mide desde donde
   el usuario dio la vuelta de verdad y no desde donde cambió el estado.
3. **El rebote elástico se recorta** contra `minY` (`-contentInset.top`) y
   `maxY` (`contentSize - viewport + contentInset.bottom`). Sin esto, llegar
   abajo del todo se leía como "el usuario sube" y expandía la barra sola.
4. **Nada se decide hasta que el usuario arrastra** (`interacted`, que lo activa
   `onBeginDrag`). Un scroller recién montado emite su primer evento en el
   offset inicial, y eso expandía la barra al entrar en una pantalla anidada:
   ahora el estado compacto se hereda de la pantalla anterior.

## 📋 Cómo Añadir un Nuevo Tab

### 1. Añadir el tab a la configuración centralizada

En `app/(tabs)/_layout.tsx`, añade un objeto al array `TABS_CONFIG`:

```typescript
const TABS_CONFIG: TabConfig[] = [
  // ... tabs existentes
  {
    name: "nuevoTab",
    label: "Nuevo Tab",
    iosIcon: { default: "star", selected: "star.fill" },
    androidIcon: "star",
    headerColor: TabHeaderColors.nuevoTab, // Opcional
    headerShown: true,
  },
];
```

### 2. Generar el icono PNG del tab

`expo-native-compact-tabs` pinta desde imágenes, no desde SF Symbols ni fuentes
de iconos. En cuanto el tab está en `TABS_CONFIG` con su `androidIcon`:

```bash
npm run icons:tabs   # rasteriza el glifo a assets/tab-icons/<tab>/
```

Y registrar el resultado en `constants/tabIcons.ts` (el mapa es **estático** a
propósito: Metro necesita ver cada `require()` con ruta literal).

### 3. (Opcional) Definir color del header

Si quieres que el tab tenga un color identificativo, añádelo a `constants/colors.ts`:

```typescript
export const TabHeaderColors = {
  // ... colores existentes
  nuevoTab: "#FF5733",
};
```

### 4. Registrar el tab en el Sistema de Perfiles

El antiguo `constants/featureFlags.ts` ya no existe. Ahora la visibilidad por
perfil/delegación se controla desde `/profileConfig` en Firebase RTDB. Hay
que tocar dos sitios:

1. **Catálogo local** (`constants/profileCatalog.ts`): añadir el ID del tab
   a `KNOWN_TABS`. Sin esto el resolver lo descarta como ID desconocido.
2. **Config remota + seed** (`firebase-seed/profileConfig.json` y `/profileConfig/data/profiles/*` en Firebase):
   añadir el nuevo ID al array `tabs` de los perfiles que deban verlo.

### 5. Crear el archivo del tab

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
  calendario: "#31AADF",
  fotos: "#E15C62",
  comunica: "#9D1E74dd",
  nuevoTab: "#TU_COLOR", // Añade aquí el color para tu nuevo tab
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

1. **Separación clara**: iOS, Android y Web están completamente separados
2. **Misma funcionalidad**: Ambos tienen las mismas opciones de tabs
3. **Fácil de extender**: Añadir un tab nuevo requiere cambios en ambos lugares
4. **Consistencia**: Los nombres en `TABS_CONFIG`, `KNOWN_TABS` y `profiles.*.tabs` deben coincidir

### Checklist para Cambios

- [ ] ¿Añado el tab al array `TABS_CONFIG` (`constants/tabsCatalog.ts`)?
- [ ] ¿Genero su PNG con `npm run icons:tabs` y lo registro en `constants/tabIcons.ts`?
- [ ] ¿Defino el color en `TabHeaderColors` (si aplica)?
- [ ] ¿Añado el ID a `KNOWN_TABS` en `constants/profileCatalog.ts`?
- [ ] ¿Añado el ID a `tabs` en cada perfil de `firebase-seed/profileConfig.json` **y** en `/profileConfig/data/profiles/*` de Firebase?
- [ ] ¿Creo el archivo del tab con `TabScreenWrapper`?
- [ ] ¿Engancho su scroller con `useTabScroll` / `useTabListScroll`?
- [ ] ¿Cabe en la barra (`MAX_TAB_BAR_ITEMS`) o va a caer a MasHome?
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
- **Mantener** sincronizados `TABS_CONFIG`, `KNOWN_TABS` y el perfil en Firebase

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
