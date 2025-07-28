#!/bin/bash

# Script de prebuild que ejecuta el script de Google Services
# Ignora todos los argumentos de línea de comandos que puedan ser pasados por EAS

echo "🔧 Running prebuild script..."
node scripts/write-google-services-json.js

echo "✅ Prebuild completed successfully"
