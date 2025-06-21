# Configuración de Firebase para MCM App

Esta guía resume los pasos necesarios para habilitar la autenticación con Google y Apple, Remote Config y la base de datos Realtime.

## 1. Proyecto de Firebase
1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/).
2. En **Authentication**, habilita los métodos de inicio de sesión:
   - **Google**: crea el proyecto de OAuth y copia el **Client ID** para la plataforma web.
   - **Apple**: puedes activarlo más adelante cuando dispongas de la cuenta de Apple.
3. En **Realtime Database** crea una base de datos en modo producción.
4. Añade un nodo `users` para almacenar los perfiles de usuario. Cada entrada tendrá la siguiente estructura:
   ```json
   {
     "email": "usuario@example.com",
     "displayName": "Nombre Apellido",
     "location": "MCM Castellon",
     "admin": false
   }
   ```
5. En **Remote Config** crea un parámetro llamado `locations` con valor por defecto:
   ```json
   ["MCM Castellon","MCM nacional","MCM Villacañas","MCM Madrid"]
   ```
   Esto permite actualizar la lista de localidades sin publicar nuevas versiones.

## 2. Variables de entorno
Copia el archivo `.env.example` como `.env.local` dentro de la carpeta `mcm-app` y rellena:

```
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_DATABASE_URL=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=... # Client ID del inicio de sesión con Google
```

Al arrancar la aplicación (`npm start` desde `mcm-app`) Expo cargará estas variables.

## 3. Comportamiento de la App
- Desde la pantalla principal se puede abrir el panel de ajustes.
- Si no hay sesión iniciada aparecerán los botones para iniciar sesión con Google o Apple (este último aún no funcional).
- Tras iniciar sesión se mostrará el nombre del usuario, sus iniciales y un selector de localidad basado en Remote Config.
- El usuario puede cerrar la sesión desde este mismo panel.

