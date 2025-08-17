# Tests de Conectividad de Base de Datos

Este directorio contiene herramientas para probar la conectividad con Firebase y Supabase.

## Archivos de Test

### `test-firebase.js`
Prueba completa de conectividad con Firebase Realtime Database.
- Verifica variables de entorno
- Inicializa cliente Firebase
- Verifica estructura de la base de datos
- Prueba operaciones específicas (Wordle, estadísticas)

### `test-supabase.js`
Prueba completa de conectividad con Supabase.
- Verifica variables de entorno
- Inicializa cliente Supabase
- Prueba conectividad básica
- Verifica estructura de la base de datos
- Prueba operaciones CRUD básicas
- Verifica políticas de seguridad (RLS)

### `test-databases.js`
Comparativa entre Firebase y Supabase.
- Ejecuta tests básicos de ambas bases de datos
- Muestra estado de configuración
- Proporciona resumen comparativo

## Comandos NPM

```bash
# Probar solo Firebase
npm run test:firebase

# Probar solo Supabase
npm run test:supabase

# Comparar ambas bases de datos
npm run test:databases
```

## Configuración

### Firebase
Asegúrate de tener estas variables en tu `.env.local`:
```env
EXPO_PUBLIC_FIREBASE_API_KEY=tu_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_auth_domain
EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://tu-db-url
EXPO_PUBLIC_FIREBASE_PROJECT_ID=tu_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=tu_app_id
```

### Supabase
Asegúrate de tener estas variables en tu `.env.local`:
```env
EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima
```

## Resultados Esperados

### ✅ Conexión exitosa
- Cliente inicializado correctamente
- Acceso a datos confirmado
- Operaciones CRUD funcionando

### ⚠️ Conexión parcial
- Cliente inicializado pero con restricciones
- Posibles problemas de permisos o RLS
- Tabla/datos no encontrados

### ❌ Error de conexión
- Credenciales incorrectas
- Problemas de red
- Configuración incorrecta

## Uso con MCP (Model Context Protocol)

Estos tests son especialmente útiles para verificar la conectividad cuando se usa un MCP configurado para Supabase. El test validará que:

1. Las credenciales de Supabase están correctamente configuradas
2. El cliente puede conectarse al proyecto
3. Las operaciones básicas funcionan correctamente
4. Las políticas de seguridad están configuradas apropiadamente

## Solución de Problemas

Si los tests fallan, revisa:

1. **Variables de entorno**: Asegúrate de que `.env.local` existe y tiene las variables correctas
2. **Credenciales**: Verifica que las claves son válidas en el dashboard correspondiente
3. **Permisos**: Revisa las reglas de seguridad en Firebase o las políticas RLS en Supabase
4. **Red**: Verifica conectividad a internet y que no hay proxies bloqueando las conexiones