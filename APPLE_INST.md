# Configuración de "Sign in with Apple"

Esta guía explica paso a paso cómo habilitar el inicio de sesión con Apple en la aplicación.

## 0. Instalar dependencias

Dentro de la carpeta `mcm-app` instala los paquetes necesarios ejecutando:

```bash
npx expo install expo-apple-authentication expo-auth-session
```

Después ejecuta `npm install` para asegurarte de que todo está actualizado.

## 1. Crear el identificador de servicio en Apple

1. Accede a [Apple Developer](https://developer.apple.com/account/).
2. En **Certificates, Identifiers & Profiles** crea un **Service ID**.
3. Activa **Sign in with Apple** dentro de las opciones del service ID.
4. Añade como *Return URL* la misma URL que usarás en Firebase (por ejemplo `https://example.com/auth/callback`).

## 2. Generar la clave privada

1. Dentro de **Keys**, crea una nueva clave y marca **Sign in with Apple**.
2. Descarga el archivo `.p8` y toma nota de su **Key ID** y tu **Team ID**.
3. Estos datos se necesitarán en Firebase.

## 3. Configurar Firebase

1. En el proyecto de Firebase abre **Authentication → Sign-in method**.
2. Habilita **Apple** y completa los campos:
   - **Servicios de ID**: el Service ID creado.
   - **Team ID** y **Key ID**: los obtenidos de la clave privada.
   - **Key file**: selecciona el archivo `.p8` que descargaste.
   - **Redirect URI**: la misma URL configurada en Apple.

## 4. Variables de entorno

Copia `.env.example` como `.env.local` (o `.env.production`) y rellena:

```bash
EXPO_PUBLIC_ENABLE_APPLE_SIGNIN=true
EXPO_PUBLIC_APPLE_SERVICE_ID=<tu service id>
EXPO_PUBLIC_APPLE_REDIRECT_URI=<https://example.com/auth/callback>
```

Además de las variables de Firebase y Google descritas en la guía principal.

## 5. Probar la integración

1. Ejecuta la aplicación (`npm start` dentro de `mcm-app`).
2. Abre el panel de ajustes. Deberían mostrarse los botones de Google y Apple centrados.
3. Pulsa **Iniciar sesión con Apple** en un dispositivo iOS y verifica que se completa el proceso.

Con estos pasos el inicio de sesión con Apple quedará listo tanto en desarrollo como en producción.
