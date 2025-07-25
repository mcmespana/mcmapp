# Configuración PWA para iOS Safari - Modo Pantalla Completa

## ✅ Cambios Realizados

### 1. Actualización de `app.json`
- **display**: Cambiado de "fullscreen" a "standalone" (más compatible)
- **statusBarStyle**: Cambiado a "black-translucent" para mejor integración
- **viewport**: Añadido "viewport-fit=cover" para usar toda la pantalla
- **start_url**: Cambiado de "." a "/" para mejor navegación
- **scope**: Añadido "/" para definir el alcance de la PWA
- **orientation**: Establecido en "portrait"
- **Iconos**: Añadidos tamaños adicionales para iOS

### 2. Creación de `app/+html.tsx`
- **Meta tags específicos para iOS**: apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style
- **Viewport optimizado**: width=device-width, viewport-fit=cover, user-scalable=no
- **Apple touch icons**: Múltiples tamaños para diferentes dispositivos iOS
- **CSS específico**: Safe area handling, prevención de scroll bounce, optimizaciones táctiles
- **Service Worker**: Registro automático para funcionalidad offline

### 3. Service Worker (`public/sw.js`)
- **Cache**: Para funcionamiento offline básico
- **Install prompt**: Manejo mejorado del prompt de instalación

## 📱 Instrucciones para Probar en iOS Safari

### Paso 1: Build y Deploy
```bash
cd mcm-app
npx expo export -p web
```

### Paso 2: Servir localmente para probar
```bash
npx serve dist -p 3000
```

### Paso 3: Probar en iOS Safari
1. Abre Safari en tu iPhone/iPad
2. Ve a `http://[tu-ip]:3000` 
3. Comprueba que la página carga correctamente
4. Toca el botón "Compartir" (icono de caja con flecha hacia arriba)
5. Selecciona "Añadir a pantalla de inicio"
6. Confirma el nombre de la app
7. La app aparecerá en tu pantalla de inicio

### Paso 4: Verificar Modo Pantalla Completa
1. Toca el icono de la app desde la pantalla de inicio
2. La app debería abrir **SIN** la barra de navegación de Safari
3. Debería usar toda la pantalla disponible
4. La barra de estado debería ser translúcida

## 🛠️ Tareas Pendientes

### Iconos Faltantes
Necesitas crear estos iconos adicionales para una mejor experiencia:

1. **icon-192.png** (192x192px) - Para el manifest
2. **Iconos Apple Touch** en diferentes tamaños:
   - 120x120px (iPhone)
   - 152x152px (iPad)
   - 167x167px (iPad Pro)
   - 180x180px (iPhone Plus/Pro)

### Comando para generar iconos (si tienes ImageMagick):
```bash
# Desde el icono principal, generar otros tamaños
convert assets/images/icon.png -resize 192x192 assets/images/icon-192.png
convert assets/images/icon.png -resize 120x120 assets/images/icon-120.png
convert assets/images/icon.png -resize 152x152 assets/images/icon-152.png
convert assets/images/icon.png -resize 167x167 assets/images/icon-167.png
convert assets/images/icon.png -resize 180x180 assets/images/icon-180.png
```

## 🔧 Configuración Adicional Recomendada

### 1. Actualizar manifest después de crear iconos faltantes
Una vez tengas el icon-192.png, actualiza `app.json`:

```json
"icons": [
  {
    "src": "./assets/images/icon-192.png",
    "sizes": "192x192",
    "type": "image/png",
    "purpose": "any maskable"
  },
  {
    "src": "./assets/images/icon-512.png",
    "sizes": "512x512", 
    "type": "image/png",
    "purpose": "any maskable"
  }
]
```

### 2. Deployment en Producción
Para que funcione correctamente en producción:

1. **HTTPS requerido**: Los Service Workers solo funcionan en HTTPS
2. **manifest.json**: Debe estar accesible en la raíz del dominio
3. **Iconos**: Deben estar en las rutas correctas

## 🚀 Comando de Deploy Final

```bash
# 1. Build para web
npx expo export -p web

# 2. Deploy a tu hosting (ejemplo con Netlify)
# Sube la carpeta 'dist' a tu hosting

# 3. Verificar en iOS Safari en producción
```

## ✨ Características Habilitadas

Con esta configuración, tu app tendrá:

- ✅ **Pantalla completa** sin barra de navegación Safari
- ✅ **Icono personalizado** en pantalla de inicio  
- ✅ **Splash screen** al abrir
- ✅ **Funcionalidad offline** básica
- ✅ **Safe area handling** para iPhones con notch
- ✅ **Prevención de zoom** accidental
- ✅ **Orientación bloqueada** en portrait
- ✅ **Barra de estado translúcida**

## 🐛 Troubleshooting

### Si no aparece en pantalla completa:
1. Verifica que `apple-mobile-web-app-capable` esté en "yes"
2. Comprueba que se esté sirviendo desde HTTPS en producción
3. Asegúrate de que el manifest.json se genere correctamente

### Si los iconos no aparecen:
1. Verifica que los archivos de iconos existan en las rutas especificadas
2. Comprueba que los tamaños sean exactos (120x120, 152x152, etc.)
3. Limpia la caché del navegador y vuelve a añadir a pantalla de inicio

¡Con estos cambios tu app debería funcionar como una app nativa cuando se añada a la pantalla de inicio de iOS! 🎉
