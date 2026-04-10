# Tema Dinámico para iOS - Status Bar Adaptativa

## 🎨 Funcionalidad Implementada

La aplicación ahora cuenta con un sistema de **tema dinámico** que cambia automáticamente el color de la barra de estado de iOS (status bar) según la página actual, similar al comportamiento nativo de iOS.

### Cómo Funciona

Cuando navegas entre las diferentes secciones de la app, la barra de estado superior (donde aparece la hora, batería, señal, etc.) se adapta automáticamente al color predominante de cada página:

- **🏠 Inicio**: Fondo blanco, status bar por defecto
- **🎯 Jubileo**: Verde `#A3BD31` (COM)
- **📅 Calendario**: Celeste `#31AADF` 
- **🎵 Cancionero**: Rojo `#E15C62` (MIC)
- **📸 Fotos**: Morado `#9D1E74` (LC)
- **💬 Comunica**: Azul `#253883` (primario)

### Archivos Implementados

#### 1. Hook Principal: `hooks/useStatusBarTheme.ts`
```typescript
export function useStatusBarTheme(pathname: string)
```
- **Funcionalidad**: Detecta cambios de ruta y actualiza los meta tags en tiempo real
- **Plataforma**: Solo activo en iOS Safari/PWA
- **Meta Tags actualizados**:
  - `theme-color`: Color principal de la página
  - `apple-mobile-web-app-status-bar-style`: Estilo de la barra de estado
  - `msapplication-navbutton-color`: Para compatibilidad con otros navegadores

#### 2. Integración en Layout: `app/_layout.tsx`
```typescript
const pathname = usePathname();
useStatusBarTheme(pathname);
```
- Se ejecuta automáticamente al cambiar de página
- Integrado en el `InnerLayout` para aplicarse globalmente

#### 3. Configuración Base: `app/+html.tsx`
- Meta tags iniciales para PWA
- Configuración base del status bar como `black-translucent`

### Experiencia de Usuario

#### En iOS Safari (PWA):
1. **🎯 Detección Automática**: El sistema detecta que estás en iOS Safari
2. **🔄 Cambio Dinámico**: Al navegar entre páginas, la barra de estado cambia de color instantáneamente
3. **📱 Integración Nativa**: Se ve como una app nativa, con colores coherentes
4. **🎨 Visual Cohesión**: Cada sección tiene su identidad visual completa

#### Comportamiento por Página:

**Página Inicial** → Status bar claro sobre fondo blanco
**Jubileo** → Status bar verde COM sobre header verde  
**Calendario** → Status bar celeste sobre header celeste
**Cancionero** → Status bar rojo MIC sobre header rojo
**Fotos** → Status bar morado LC sobre header morado

### Tecnología

- **React Native Web**: Hook personalizado con `useEffect` y `usePathname`
- **Meta Tags Dinámicos**: Manipulación del DOM para actualizar `<meta>` tags
- **iOS Detection**: Detección específica de iOS Safari
- **PWA Integration**: Compatible con el modo standalone

### Para Probar

1. **🔧 Compilar**: `npx expo export --platform web`
2. **🔧 Iconos**: `./fix-pwa-icons.sh`
3. **🚀 Servidor**: `python3 -m http.server 3000 --directory dist`
4. **📱 iOS**: Ve a `http://[tu-ip]:3000` desde iOS Safari
5. **🏠 Añadir a Inicio**: "Añadir a pantalla de inicio"
6. **✨ Navegar**: Cambia entre páginas y observa cómo se adapta la barra de estado

### Resultado Visual

Similar al ejemplo del Ayuntamiento de Onda que mostrabas, donde:
- La barra de estado superior se integra perfectamente con cada página
- No hay contraste visual molesto entre la barra del sistema y tu app
- Cada sección mantiene su identidad de color de forma cohesiva
- La experiencia se siente completamente nativa

### Logs para Debug

En la consola del navegador verás:
```
🎨 Theme updated for /jubileo: {themeColor: "#A3BD31", statusBarStyle: "black-translucent"}
```

### Extensibilidad

Para añadir nuevas páginas, simplemente edita el objeto `PAGE_THEMES` en `hooks/useStatusBarTheme.ts`:

```typescript
'/nueva-pagina': {
  themeColor: '#COLOR_HEX',
  statusBarStyle: 'black-translucent',
},
```

¡Ahora tu PWA se comporta como una app nativa con temas dinámicos! 🎉
