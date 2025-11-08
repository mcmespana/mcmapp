# Guía Completa de Pruebas - Sistema de Notificaciones Push

## 📋 Índice

1. [Preparación Previa](#preparación-previa)
2. [Configuración Inicial](#configuración-inicial)
3. [Pruebas en iOS](#pruebas-en-ios)
4. [Pruebas en Android](#pruebas-en-android)
5. [Pruebas en Web](#pruebas-en-web)
6. [Checklist de Verificación](#checklist-de-verificación)
7. [Solución de Problemas](#solución-de-problemas)

---

## 🔧 Preparación Previa

### 1. Verificar Configuración del Proyecto

**Archivo:** `mcm-app/app.json`

Verifica que tengas:
```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "aa9f2d3a-b74a-4169-bad4-e851015e30c6"
      }
    },
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/images/adaptive-icon.png",
          "color": "#253883",
          "sounds": [],
          "mode": "production"
        }
      ]
    ]
  }
}
```

### 2. Verificar Variables de Entorno

**Archivo:** `.env` o variables de entorno del sistema

Asegúrate de tener configuradas:
```env
EXPO_PUBLIC_FIREBASE_API_KEY=tu_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=tu_auth_domain
EXPO_PUBLIC_FIREBASE_DATABASE_URL=tu_database_url
EXPO_PUBLIC_FIREBASE_PROJECT_ID=tu_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=tu_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=tu_app_id
```

### 3. Instalar Dependencias

```bash
cd mcm-app
npm install
```

### 4. Verificar que Firebase Esté Configurado

**Archivo:** `mcm-app/hooks/firebaseApp.ts` (o donde esté la configuración de Firebase)

Verifica que Firebase Realtime Database esté configurado correctamente.

---

## ⚙️ Configuración Inicial

### Paso 1: Configurar EAS (Expo Application Services)

```bash
# Instalar EAS CLI globalmente
npm install -g eas-cli

# Iniciar sesión en Expo
eas login

# Verificar que estés en el proyecto correcto
eas whoami
```

### Paso 2: Configurar Credenciales iOS (Solo para Dispositivos Reales)

```bash
# Configurar credenciales iOS
eas credentials

# Selecciona:
# - Platform: iOS
# - Project: mcm-app
# - Sigue las instrucciones para configurar certificados APNs
```

**Nota:** Para simuladores de iOS, no se necesitan credenciales APNs, pero las notificaciones pueden no funcionar correctamente.

### Paso 3: Verificar Firebase Realtime Database

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Realtime Database**
4. Verifica que las reglas de seguridad permitan lectura de notificaciones:

```json
{
  "rules": {
    "pushTokens": {
      ".read": false,
      "$deviceId": {
        ".write": true,
        ".read": false
      }
    },
    "notifications": {
      ".read": true,
      ".write": false
    }
  }
}
```

---

## 📱 Pruebas en iOS

### Opción A: Dispositivo Real (Recomendado)

#### 1. Preparar el Dispositivo

```bash
# Conecta tu iPhone/iPad al Mac
# Asegúrate de que esté desbloqueado y confíes en el dispositivo
```

#### 2. Ejecutar en Dispositivo Real

```bash
cd mcm-app

# Iniciar servidor de desarrollo
npm start

# Presiona 'i' para abrir en iOS
# O escanea el código QR con la app Expo Go en tu iPhone
```

#### 3. Verificar Permisos

1. **Primera vez que abres la app:**
   - Debe aparecer un diálogo pidiendo permisos de notificaciones
   - Acepta los permisos
   - Si niegas los permisos, ve a **Configuración > MCM App > Notificaciones** y actívalas manualmente

2. **Verificar en logs:**
   ```
   🥳 Expo Push Token: ExponentPushToken[xxxxxx]
   ✅ Token guardado en Firebase para deviceId: device_xxxxx
   ```

#### 4. Verificar Token en Firebase

1. Ve a Firebase Console > Realtime Database
2. Busca en `/pushTokens/{deviceId}`
3. Verifica que el token esté guardado:
   ```json
   {
     "pushTokens": {
       "device_xxxxx": {
         "token": "ExponentPushToken[xxxxxx]",
         "platform": "ios",
         "registeredAt": "2025-01-15T10:30:00.000Z",
         "lastActive": "2025-01-15T10:30:00.000Z",
         "appVersion": "1.0.1"
       }
     }
   }
   ```

#### 5. Enviar Notificación de Prueba

**Opción 1: Desde el Panel de Administración**

1. Abre el panel de administración (Next.js)
2. Llena el formulario:
   - **Título:** "Prueba iOS"
   - **Mensaje:** "Esta es una notificación de prueba"
   - **Categoría:** "general"
   - **Prioridad:** "normal"
3. Click en "Enviar"
4. Verifica que la notificación llegue al dispositivo

**Opción 2: Desde Expo Push Notification Tool**

1. Ve a [Expo Push Notification Tool](https://expo.dev/notifications)
2. Pega el token que viste en los logs: `ExponentPushToken[xxxxxx]`
3. Llena el formulario:
   - **Title:** "Prueba iOS"
   - **Message:** "Esta es una notificación de prueba"
4. Click en "Send a Notification"
5. Verifica que la notificación llegue al dispositivo

#### 6. Verificar Recepción

**App en Foreground (Abierta):**
- La notificación debe aparecer como banner en la parte superior
- Debe reproducir sonido
- Debe aparecer en los logs: `🔔 Notificación recibida: ...`

**App en Background (Minimizada):**
- La notificación debe aparecer en el centro de notificaciones
- Al tocar la notificación, debe abrir la app

**App Cerrada:**
- La notificación debe aparecer en el centro de notificaciones
- Al tocar la notificación, debe abrir la app

#### 7. Verificar Funcionalidades

1. **Badge del Contador:**
   - Abre la app
   - Verifica que el badge en el icono de notificaciones muestre el número correcto
   - Debe actualizarse cuando llegue una nueva notificación

2. **Pantalla de Notificaciones:**
   - Toca el icono de notificaciones
   - Verifica que aparezcan todas las notificaciones
   - Verifica que las notificaciones sin leer tengan el indicador azul
   - Verifica que puedas marcar como leída deslizando o con el botón

3. **Marcar como Leída:**
   - Desliza una notificación hacia la izquierda
   - Verifica que aparezca el botón "Leída"
   - Toca el botón
   - Verifica que la notificación se marque como leída
   - Verifica que el contador se actualice

4. **Navegación Interna:**
   - Envía una notificación con `internalRoute: "/(tabs)/calendario"`
   - Toca la notificación
   - Verifica que navegue a la pantalla de calendario

---

### Opción B: Simulador de iOS

#### ⚠️ Limitaciones del Simulador

- **Las notificaciones push NO funcionan en simuladores de iOS**
- Solo funcionan las notificaciones locales programadas
- Para probar notificaciones push reales, **DEBES usar un dispositivo real**

#### 1. Ejecutar en Simulador

```bash
cd mcm-app
npm start
# Presiona 'i' para abrir en simulador iOS
```

#### 2. Verificar que No se Obtenga Token

En los logs deberías ver:
```
⚠️ Las notificaciones push solo funcionan en dispositivos reales
```

#### 3. Probar Funcionalidades que NO Requieren Push

- Pantalla de notificaciones (carga desde Firebase)
- Marcar como leída
- Contador de notificaciones
- Navegación interna

---

## 🤖 Pruebas en Android

### Simulador de Android

#### 1. Preparar el Simulador

```bash
# Abre Android Studio
# Crea un AVD (Android Virtual Device) si no tienes uno
# Asegúrate de que el simulador esté ejecutándose
```

#### 2. Ejecutar en Simulador

```bash
cd mcm-app
npm start
# Presiona 'a' para abrir en Android
# O escanea el código QR con Expo Go
```

#### 3. Verificar Permisos

1. **Primera vez que abres la app:**
   - Debe aparecer un diálogo pidiendo permisos de notificaciones
   - Acepta los permisos
   - En Android 13+, también pedirá permisos de notificaciones específicos

2. **Verificar en logs:**
   ```
   🥳 Expo Push Token: ExponentPushToken[xxxxxx]
   ✅ Token guardado en Firebase para deviceId: device_xxxxx
   ```

#### 4. Verificar Token en Firebase

1. Ve a Firebase Console > Realtime Database
2. Busca en `/pushTokens/{deviceId}`
3. Verifica que el token esté guardado con `platform: "android"`

#### 5. Enviar Notificación de Prueba

**Desde el Panel de Administración:**

1. Abre el panel de administración
2. Llena el formulario:
   - **Título:** "Prueba Android"
   - **Mensaje:** "Esta es una notificación de prueba"
   - **Categoría:** "general"
3. Click en "Enviar"
4. Verifica que la notificación llegue al simulador

#### 6. Verificar Recepción

**App en Foreground:**
- La notificación debe aparecer como banner en la parte superior
- Debe reproducir sonido y vibrar
- Debe aparecer en los logs

**App en Background:**
- La notificación debe aparecer en el centro de notificaciones
- Al tocar la notificación, debe abrir la app

**App Cerrada:**
- La notificación debe aparecer en el centro de notificaciones
- Al tocar la notificación, debe abrir la app

#### 7. Verificar Canal de Notificaciones

En Android, las notificaciones usan canales. Verifica que el canal esté configurado:

1. Ve a **Configuración > Apps > MCM App > Notificaciones**
2. Verifica que haya un canal llamado "Notificaciones MCM"
3. Verifica que esté configurado con importancia máxima

#### 8. Verificar Funcionalidades

Igual que en iOS:
- Badge del contador
- Pantalla de notificaciones
- Marcar como leída
- Navegación interna

---

## 🌐 Pruebas en Web

### ⚠️ Limitaciones de Web

- **Las notificaciones push en web requieren HTTPS**
- Solo funcionan en navegadores compatibles (Chrome, Firefox, Safari, Edge)
- Requieren Service Workers (que Expo maneja automáticamente)
- El usuario debe conceder permisos explícitamente

### 1. Ejecutar en Web

```bash
cd mcm-app
npm start
# Presiona 'w' para abrir en navegador
# O abre http://localhost:8081 en tu navegador
```

### 2. Verificar HTTPS (Obligatorio)

**Para desarrollo local:**
- Las notificaciones NO funcionan en `http://localhost`
- Necesitas usar HTTPS o un túnel (ngrok, localtunnel, etc.)

**Opción 1: Usar ngrok**
```bash
# Instalar ngrok
npm install -g ngrok

# Ejecutar la app
npm start -- --web

# En otra terminal, crear túnel HTTPS
ngrok http 8081

# Usar la URL HTTPS que ngrok proporciona
```

**Opción 2: Usar Expo Tunnel**
```bash
npm start -- --tunnel
```

### 3. Verificar Permisos

1. **Primera vez que abres la app:**
   - El navegador pedirá permisos de notificaciones
   - Debes aceptar los permisos
   - Si niegas, ve a **Configuración del Navegador > Sitios > Notificaciones** y actívalas manualmente

2. **Verificar en logs:**
   ```
   🥳 Expo Push Token: ExponentPushToken[xxxxxx]
   ✅ Token guardado en Firebase para deviceId: device_xxxxx
   ```

### 4. Verificar Token en Firebase

Igual que en iOS/Android, verifica que el token esté guardado con `platform: "web"`.

### 5. Enviar Notificación de Prueba

**Desde el Panel de Administración:**

1. Abre el panel de administración
2. Llena el formulario
3. Click en "Enviar"
4. Verifica que la notificación llegue al navegador

### 6. Verificar Recepción

**App en Foreground (Pestaña Activa):**
- La notificación debe aparecer como banner del navegador
- Debe aparecer en los logs

**App en Background (Pestaña Inactiva):**
- La notificación debe aparecer como notificación del sistema
- Al hacer clic, debe enfocar la pestaña

**Navegador Cerrado:**
- Si el Service Worker está activo, la notificación puede aparecer
- Al hacer clic, debe abrir el navegador y la app

### 7. Verificar Service Worker

1. Abre las **Herramientas de Desarrollador** (F12)
2. Ve a **Application > Service Workers**
3. Verifica que haya un Service Worker activo
4. Verifica que esté registrado correctamente

---

## ✅ Checklist de Verificación

### Configuración Inicial

- [ ] EAS CLI instalado y configurado
- [ ] Credenciales iOS configuradas (solo dispositivo real)
- [ ] Firebase Realtime Database configurado
- [ ] Variables de entorno configuradas
- [ ] Dependencias instaladas

### iOS (Dispositivo Real)

- [ ] App se ejecuta en dispositivo
- [ ] Permisos de notificaciones concedidos
- [ ] Token se obtiene y se guarda en Firebase
- [ ] Notificación llega cuando app está en foreground
- [ ] Notificación llega cuando app está en background
- [ ] Notificación llega cuando app está cerrada
- [ ] Badge del contador funciona correctamente
- [ ] Pantalla de notificaciones muestra todas las notificaciones
- [ ] Se puede marcar como leída deslizando
- [ ] Se puede marcar como leída con botón
- [ ] Navegación interna funciona
- [ ] Contador se actualiza correctamente

### Android (Simulador)

- [ ] App se ejecuta en simulador
- [ ] Permisos de notificaciones concedidos
- [ ] Token se obtiene y se guarda en Firebase
- [ ] Canal de notificaciones configurado
- [ ] Notificación llega cuando app está en foreground
- [ ] Notificación llega cuando app está en background
- [ ] Notificación llega cuando app está cerrada
- [ ] Badge del contador funciona correctamente
- [ ] Pantalla de notificaciones muestra todas las notificaciones
- [ ] Se puede marcar como leída
- [ ] Navegación interna funciona

### Web

- [ ] App se ejecuta en navegador con HTTPS
- [ ] Permisos de notificaciones concedidos
- [ ] Service Worker registrado
- [ ] Token se obtiene y se guarda en Firebase
- [ ] Notificación llega cuando pestaña está activa
- [ ] Notificación llega cuando pestaña está inactiva
- [ ] Pantalla de notificaciones funciona
- [ ] Se puede marcar como leída

### Backend

- [ ] Panel de administración funciona
- [ ] Se puede enviar notificación desde el panel
- [ ] Notificación se guarda en Firebase
- [ ] Token se envía correctamente a Expo Push API
- [ ] Tokens inválidos se eliminan automáticamente
- [ ] Estadísticas se muestran correctamente

---

## 🔍 Solución de Problemas

### Problema 1: No se Obtiene Token

**Síntomas:**
- No aparece el log `🥳 Expo Push Token: ...`
- El token no se guarda en Firebase

**Soluciones:**

1. **Verificar permisos:**
   ```bash
   # En iOS: Configuración > MCM App > Notificaciones
   # En Android: Configuración > Apps > MCM App > Notificaciones
   # En Web: Configuración del navegador > Sitios > Notificaciones
   ```

2. **Verificar que estés en dispositivo real (iOS):**
   - Los simuladores de iOS NO obtienen tokens push
   - Debes usar un dispositivo real

3. **Verificar Project ID:**
   - Verifica que `app.json` tenga el `projectId` correcto
   - Verifica que el Project ID coincida con el de EAS

4. **Reinstalar la app:**
   ```bash
   # Desinstala la app
   # Vuelve a instalar
   npm start
   ```

### Problema 2: Notificación No Llega

**Síntomas:**
- El token está en Firebase
- Se envía desde el panel
- Pero la notificación no llega al dispositivo

**Soluciones:**

1. **Verificar credenciales:**
   ```bash
   # Verificar credenciales iOS
   eas credentials
   ```

2. **Verificar que el token sea correcto:**
   - Ve a Firebase Console
   - Verifica que el token en `/pushTokens` sea correcto
   - Verifica que no haya espacios o caracteres extraños

3. **Verificar logs del backend:**
   - Revisa los logs del panel de administración
   - Verifica que Expo Push API devuelva éxito
   - Verifica que no haya errores

4. **Verificar que la app tenga permisos:**
   - Ve a configuración del dispositivo
   - Verifica que las notificaciones estén activadas

5. **Probar desde Expo Push Notification Tool:**
   - Ve a https://expo.dev/notifications
   - Pega el token manualmente
   - Envía una notificación de prueba
   - Si funciona, el problema está en el backend
   - Si no funciona, el problema está en el dispositivo/credenciales

### Problema 3: ID de Notificación No Coincide

**Síntomas:**
- La notificación llega
- Pero no se puede marcar como leída
- El contador no se actualiza correctamente

**Soluciones:**

1. **Verificar que el backend envíe `data.id`:**
   - Revisa el código del backend
   - Verifica que incluya `data.id` con el `notificationId`
   - Verifica que use `identifier` con el `notificationId`

2. **Verificar logs de la app:**
   - Abre los logs de la app
   - Verifica qué ID se está usando cuando se recibe la notificación
   - Compara con el ID en Firebase

3. **Corregir el código:**
   - Modifica `usePushNotifications.ts` para usar `data.id` primero
   - Ver `NOTIS_APP_MEJORAS.md` para la solución exacta

### Problema 4: Badge No Se Actualiza

**Síntomas:**
- El badge siempre muestra el mismo número
- No se actualiza cuando llega una notificación

**Soluciones:**

1. **Verificar que el hook se esté usando:**
   - Verifica que `NotificationsButton` use `useUnreadNotificationsCount`
   - Verifica que el hook se actualice correctamente

2. **Verificar que se actualice en foreground:**
   - El hook se actualiza cuando la app vuelve al foreground
   - Pero puede no actualizarse cuando llega una notificación en foreground
   - Ver `NOTIS_APP_MEJORAS.md` para la solución

3. **Forzar actualización:**
   - Cierra y abre la app
   - Verifica que el contador se actualice

### Problema 5: Notificaciones No Aparecen en el Historial

**Síntomas:**
- La notificación llega
- Pero no aparece en la pantalla de notificaciones

**Soluciones:**

1. **Verificar que se guarden en Firebase:**
   - Ve a Firebase Console
   - Verifica que la notificación esté en `/notifications/{id}`

2. **Verificar que se guarden localmente:**
   - Revisa los logs de la app
   - Verifica que aparezca `📝 Notificación guardada localmente: ...`

3. **Verificar que los IDs coincidan:**
   - Verifica que el ID de Firebase coincida con el ID local
   - Si no coinciden, ver Problema 3

4. **Refrescar la pantalla:**
   - Desliza hacia abajo en la pantalla de notificaciones
   - Verifica que se carguen las notificaciones

### Problema 6: Error al Marcar como Leída

**Síntomas:**
- No se puede marcar como leída
- El botón no funciona
- El gesto de deslizar no funciona

**Soluciones:**

1. **Verificar que el ID sea correcto:**
   - Verifica que el ID de la notificación sea el correcto
   - Compara con el ID en Firebase

2. **Verificar logs:**
   - Revisa los logs de la app
   - Verifica que no haya errores al marcar como leída

3. **Verificar AsyncStorage:**
   - Verifica que AsyncStorage funcione correctamente
   - Verifica que no haya problemas de permisos

### Problema 7: Navegación Interna No Funciona

**Síntomas:**
- La notificación tiene `internalRoute`
- Pero no navega a la pantalla correcta

**Soluciones:**

1. **Verificar que la ruta sea correcta:**
   - Verifica que la ruta sea una ruta válida de Expo Router
   - Verifica que no tenga errores de tipado

2. **Verificar logs:**
   - Revisa los logs de la app
   - Verifica que aparezca `🧭 Navegando a: ...`
   - Verifica que no haya errores

3. **Probar la ruta manualmente:**
   - Abre la app
   - Navega manualmente a la ruta
   - Verifica que funcione

---

## 📊 Métricas a Verificar

### Tiempo de Entrega

- **Foreground:** < 1 segundo
- **Background:** < 5 segundos
- **Cerrado:** < 10 segundos

### Tasa de Éxito

- **iOS:** > 95%
- **Android:** > 95%
- **Web:** > 90%

### Funcionalidades

- **Badge del contador:** Debe actualizarse correctamente
- **Pantalla de notificaciones:** Debe cargar todas las notificaciones
- **Marcar como leída:** Debe funcionar correctamente
- **Navegación interna:** Debe navegar a la pantalla correcta

---

## 🎯 Pruebas Específicas por Escenario

### Escenario 1: Primera Instalación

1. Instala la app por primera vez
2. Abre la app
3. Concede permisos de notificaciones
4. Verifica que el token se obtenga y se guarde
5. Envía una notificación de prueba
6. Verifica que llegue

### Escenario 2: App en Foreground

1. Abre la app
2. Mantén la app abierta
3. Envía una notificación
4. Verifica que aparezca como banner
5. Verifica que se guarde localmente
6. Verifica que el contador se actualice

### Escenario 3: App en Background

1. Abre la app
2. Minimiza la app (no la cierres)
3. Envía una notificación
4. Verifica que aparezca en el centro de notificaciones
5. Toca la notificación
6. Verifica que abra la app
7. Verifica que navegue si tiene `internalRoute`

### Escenario 4: App Cerrada

1. Cierra la app completamente
2. Envía una notificación
3. Verifica que aparezca en el centro de notificaciones
4. Toca la notificación
5. Verifica que abra la app
6. Verifica que navegue si tiene `internalRoute`

### Escenario 5: Múltiples Notificaciones

1. Envía 5 notificaciones seguidas
2. Verifica que todas lleguen
3. Verifica que el contador muestre 5
4. Abre la pantalla de notificaciones
5. Verifica que aparezcan todas
6. Marca una como leída
7. Verifica que el contador se actualice a 4

### Escenario 6: Notificación con Navegación

1. Envía una notificación con `internalRoute: "/(tabs)/calendario"`
2. Toca la notificación
3. Verifica que navegue a la pantalla de calendario
4. Verifica que se marque como leída automáticamente

### Escenario 7: Notificación con Botón de Acción

1. Envía una notificación con `actionButton`
2. Verifica que aparezca el botón en la notificación
3. Toca el botón
4. Verifica que navegue o abra la URL correcta

---

## 🔧 Comandos Útiles

### Limpiar Caché

```bash
# Limpiar caché de Metro
npm start -- --reset-cache

# Limpiar caché de Expo
expo start --clear
```

### Ver Logs

```bash
# Logs de la app
npm start

# Logs de Expo
expo start --dev-client

# Logs de Firebase
# Ve a Firebase Console > Functions > Logs
```

### Reinstalar App

```bash
# Desinstalar app del dispositivo
# Luego reinstalar
npm start
```

### Verificar Tokens en Firebase

```bash
# Ve a Firebase Console
# Realtime Database > pushTokens
# Verifica que los tokens estén ahí
```

---

## 📝 Notas Finales

- **iOS:** Siempre prueba en dispositivo real para notificaciones push
- **Android:** Los simuladores funcionan, pero prueba en dispositivo real si es posible
- **Web:** Requiere HTTPS, usa ngrok o Expo Tunnel para desarrollo
- **Backend:** Asegúrate de que el backend esté funcionando correctamente antes de probar
- **IDs:** Verifica que los IDs coincidan entre Firebase y la app
- **Permisos:** Siempre verifica que los permisos estén concedidos
- **Logs:** Revisa los logs constantemente para debugging

---

## 🆘 Si Nada Funciona

1. **Verifica la configuración básica:**
   - Project ID en `app.json`
   - Variables de entorno
   - Firebase configurado
   - EAS credentials

2. **Revisa los logs:**
   - Logs de la app
   - Logs del backend
   - Logs de Firebase
   - Logs de Expo Push API

3. **Prueba con Expo Push Notification Tool:**
   - Ve a https://expo.dev/notifications
   - Prueba enviar una notificación manualmente
   - Si funciona, el problema está en el backend
   - Si no funciona, el problema está en el dispositivo/credenciales

4. **Contacta al equipo:**
   - Proporciona logs completos
   - Proporciona configuración (sin credenciales sensibles)
   - Describe el problema en detalle

---

## 📚 Referencias

- [Expo Push Notifications Docs](https://docs.expo.dev/push-notifications/overview/)
- [Expo Push API Docs](https://docs.expo.dev/push-notifications/sending-notifications/)
- [Firebase Realtime Database Docs](https://firebase.google.com/docs/database)
- [EAS Build Docs](https://docs.expo.dev/build/introduction/)
- [EAS Credentials Docs](https://docs.expo.dev/app-signing/managed-credentials/)

