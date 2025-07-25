#!/bin/bash

# Script para corregir las rutas de iconos después del build de Expo
# Uso: ./fix-pwa-icons.sh

echo "🔧 Corrigiendo rutas de iconos PWA..."

cd "$(dirname "$0")"

# Verificar que existe el directorio dist
if [ ! -d "dist" ]; then
    echo "❌ Error: Directorio 'dist' no encontrado. Ejecuta 'npx expo export -p web' primero."
    exit 1
fi

# Encontrar los archivos de iconos generados con hash
ICON_120=$(find dist -name "icon-120.*.png" | head -1)
ICON_152=$(find dist -name "icon-152.*.png" | head -1)
ICON_180=$(find dist -name "icon-180.*.png" | head -1)
ICON_192=$(find dist -name "icon-192.*.png" | head -1)
ICON_512=$(find dist -name "icon-512.*.png" | head -1)
FAVICON=$(find dist -name "favicon.*.png" | head -1)

# Extraer solo los nombres de archivo con hash
ICON_120_NAME=$(basename "$ICON_120")
ICON_152_NAME=$(basename "$ICON_152")
ICON_180_NAME=$(basename "$ICON_180")
ICON_192_NAME=$(basename "$ICON_192")
ICON_512_NAME=$(basename "$ICON_512")
FAVICON_NAME=$(basename "$FAVICON")

echo "📂 Iconos encontrados:"
echo "  - 120x120: $ICON_120_NAME"
echo "  - 152x152: $ICON_152_NAME"
echo "  - 180x180: $ICON_180_NAME"
echo "  - 192x192: $ICON_192_NAME"
echo "  - 512x512: $ICON_512_NAME"
echo "  - Favicon: $FAVICON_NAME"

# Crear manifest.json con las rutas correctas
echo "📄 Generando manifest.json..."
cat > dist/manifest.json << EOF
{
  "name": "MCM App · Web",
  "short_name": "MCM",
  "description": "Aplicación móvil de MCM España para seguimiento de actividades, cantoral y mucho más",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#ffffff",
  "theme_color": "#253883",
  "icons": [
    {
      "src": "/assets/assets/images/$ICON_192_NAME",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/assets/assets/images/$ICON_512_NAME",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
EOF

# Actualizar todos los archivos HTML
echo "🔄 Actualizando rutas en archivos HTML..."
for html_file in dist/*.html; do
    if [ -f "$html_file" ]; then
        echo "  Actualizando: $(basename "$html_file")"
        
        # Crear backup
        cp "$html_file" "$html_file.bak"
        
        # Actualizar rutas de iconos
        sed -i '' "s|href=\"/assets/images/icon-180\.png\"|href=\"/assets/assets/images/$ICON_180_NAME\"|g" "$html_file"
        sed -i '' "s|href=\"/assets/images/icon-152\.png\"|href=\"/assets/assets/images/$ICON_152_NAME\"|g" "$html_file"
        sed -i '' "s|href=\"/assets/images/icon-120\.png\"|href=\"/assets/assets/images/$ICON_120_NAME\"|g" "$html_file"
        sed -i '' "s|href=\"/assets/images/favicon\.png\"|href=\"/assets/assets/images/$FAVICON_NAME\"|g" "$html_file"
    fi
done

echo "✅ ¡Listo! Tu PWA ahora tiene las rutas de iconos corregidas."
echo ""
echo "🚀 Para probar:"
echo "   npx serve dist -p 3000"
echo ""
echo "📱 Luego en iOS Safari:"
echo "   1. Ve a http://[tu-ip]:3000"
echo "   2. Añadir a pantalla de inicio"
echo "   3. ¡Los iconos deberían aparecer correctamente!"
