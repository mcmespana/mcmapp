# mcmapp - Guía del Desarrollador
[![Deploy Web](https://github.com/mcmespana/mcmapp/actions/workflows/deploy-web.yml/badge.svg?branch=main)](https://github.com/mcmespana/mcmapp/actions/workflows/deploy-web.yml)

Bienvenido/a al proyecto MCM App. Esta guía está diseñada para ayudarte a configurar el entorno de desarrollo, entender la estructura del proyecto y comenzar a trabajar con la aplicación.

Expo es un framework de código abierto para construir aplicaciones universales con React Native. Simplifica significativamente el desarrollo para iOS, Android y Web, permitiendo compartir una gran base de código entre plataformas. Los comandos que encontrarás en esta guía te ayudarán a gestionar el ciclo de vida del desarrollo: desde iniciar los servidores de desarrollo hasta construir versiones de producción de la app.

##  Índice
* [Instalación y Configuración Inicial](#instalación-y-configuración-inicial)
* [Librería de Acordes de Canciones (`chordsheetjs`)](#librería-de-acordes-de-canciones-chordsheetjs)
* [Estructura de Carpetas del Proyecto](#estructura-de-carpetas-del-proyecto)
* [Comandos Comunes de Expo](#comandos-comunes-de-expo)
    * [Ver la app en el navegador](#1️⃣-ver-la-app-en-el-navegador-)
    * [Android en Expo Go](#2️⃣-android-en-expo-go-emulador-o-móvil-)
    * [Android nativo (APK / AAB)](#3️⃣-android-nativo-apk--aab-️)
    * [iOS Simulator (Mac)](#4️⃣-ios-simulator-mac-)
    * [iPhone físico (TestFlight)](#5️⃣-iphone-físico-testflight-)
    * [Modo “Development Build”]($6️⃣-modo-development-build-universo-paralelo-)
* [Mini-post-it de comandos](#-mini-post-it-de-comandos)

---

## Instalación y Configuración Inicial

Para poner en marcha el proyecto, sigue estos pasos:

1.  **Node.js LTS:** Asegúrate de tener instalada una versión LTS (Long Term Support) de Node.js. Puedes descargarlo desde [nodejs.org](https://nodejs.org/).
2.  **Expo CLI Global:** Instala Expo CLI globalmente ejecutando el siguiente comando en tu terminal:
    ```bash
    npm install -g expo-cli
    ```
3.  **EAS CLI Global:** Instala EAS CLI globalmente. Esta herramienta es esencial para construir y enviar tu aplicación.
    ```bash
    npm install -g eas-cli
    ```
4.  **Clonar el Repositorio:** Clona este repositorio a tu máquina local. Si tienes la URL del repositorio, úsala aquí:
    ```bash
    git clone <URL_DEL_REPOSITORIO_AQUI>
    ```
    (Reemplaza `<URL_DEL_REPOSITORIO_AQUI>` con la URL real del repositorio).
5.  **Navegar al Directorio del Proyecto:** Cambia al directorio del proyecto (asumiendo que se llama `mcm-app` después de clonar):
    ```bash
    cd mcm-app
    ```
6.  **Instalar dependencias:**
    ```bash
    npm install
    ```

7.  **Configuración Específica de Plataforma:**
    *   **Android:** Necesitarás tener configurado Java y el Android SDK. Sigue la [guía oficial de Expo para configurar el entorno de desarrollo Android](https://docs.expo.dev/workflow/android-studio-emulator/).
    *   **iOS (macOS):** Necesitarás Xcode. Sigue la [guía oficial de Expo para configurar el entorno de desarrollo iOS](https://docs.expo.dev/workflow/ios-simulator/).
    *   **Cuenta de Apple Developer:** Requerida solo para builds de iOS en dispositivos físicos o para subir a TestFlight/App Store (costo anual).

> **Nota sobre problemas:** Si algo explota durante la instalación o al ejecutar la app (distinto al problema de versiones de React ya mencionado), prueba borrando la carpeta `node_modules` y el archivo `package-lock.json` (o `yarn.lock`), y luego ejecuta `npm install` (o `yarn install`) nuevamente. A veces, esto resuelve problemas de dependencias.

---

## Librería de Acordes de Canciones (`chordsheetjs`)

Este proyecto utiliza la librería `chordsheetjs` para procesar y mostrar partituras de canciones con acordes.

*   **Propósito:** `chordsheetjs` toma archivos de texto plano con un formato específico (generalmente `.cho` o similar) que contienen letras y acordes, y los convierte en un formato estructurado que la aplicación puede usar para mostrar las canciones de manera interactiva.
*   **Archivos de Canciones:** Los archivos de canciones en formato `.cho` se encuentran en la carpeta `mcm-app/assets/songs/`.
*   **Instalación:** La librería `chordsheetjs` se instala automáticamente al ejecutar `npm install` dentro de la carpeta `mcm-app`, ya que está listada como una dependencia en el archivo `package.json`. No se requiere ninguna acción adicional para instalarla por separado.

---

## Estructura de Carpetas del Proyecto

Una vez clonado el repositorio y dentro de la carpeta `mcm-app`, encontrarás la siguiente estructura principal:

*   `mcm-app/app/`: Contiene las pantallas (vistas) de la aplicación y la configuración de la navegación. Este proyecto utiliza Expo Router, que implementa una estructura de rutas basada en archivos dentro de este directorio. Cada archivo o carpeta aquí puede representar una ruta en la aplicación.
*   `mcm-app/assets/`: Almacena todos los archivos estáticos que la aplicación necesita.
    *   `mcm-app/assets/songs/`: **Muy importante.** Aquí se guardan las canciones en formato `.cho` que utiliza la librería `chordsheetjs`.
    *   `mcm-app/assets/images/`: Contiene todas las imágenes (e.g., `.png`, `.jpg`) utilizadas en la aplicación.
    *   `mcm-app/assets/fonts/`: Si la aplicación usa fuentes personalizadas, se almacenan aquí.
*   `mcm-app/components/`: Directorio para componentes reutilizables de React Native. Estos son módulos de UI (como botones personalizados, tarjetas, etc.) que se pueden usar en varias pantallas para mantener la consistencia y reducir la duplicación de código.
*   `mcm-app/constants/`: Archivos para definir valores constantes que se utilizan en toda la aplicación. Esto puede incluir paletas de colores, estilos de tipografía, dimensiones estándar, claves de API (aunque estas últimas deberían manejarse de forma segura, posiblemente con variables de entorno), etc.
*   `mcm-app/notifications/`: Contiene la lógica relacionada con la configuración y gestión de notificaciones push, si la aplicación las utiliza.
*   `mcm-app/package.json`: Este es un archivo fundamental en cualquier proyecto de Node.js. Define:
    *   Metadatos del proyecto (nombre, versión, descripción).
    *   Scripts que se pueden ejecutar con `npm` (e.g., `npm start`, `npm run android`, `npm run ios`, `npm test`).
    *   **Dependencias del proyecto:** Lista todas las librerías de terceros que el proyecto necesita para funcionar (como `expo`, `react`, `react-native`, `chordsheetjs`, etc.) y sus versiones.
    *   **Dependencias de desarrollo:** Librerías que solo se usan durante el desarrollo (como herramientas de linting, testing, etc.).
*   `mcm-app/eas.json`: Archivo de configuración para EAS Build (Expo Application Services). Define diferentes perfiles de construcción (por ejemplo, `development`, `preview`, `production`) que especifican cómo se debe construir la aplicación para Android e iOS (por ejemplo, qué credenciales usar, si habilitar optimizaciones, etc.).
*   `mcm-app/babel.config.js`: Archivo de configuración para Babel. Babel es un transpilador de JavaScript que permite usar las últimas características del lenguaje JavaScript (y extensiones como JSX) y las convierte a una versión de JavaScript que los navegadores y motores de React Native puedan entender.
*   `mcm-app/tsconfig.json`: Si el proyecto está configurado para usar TypeScript (un superconjunto de JavaScript que añade tipado estático), este archivo contiene la configuración del compilador de TypeScript.

---

## 🛟 Comandos Comunes de Expo 🙌
Porque incluso los titanes a veces olvidan el hechizo correcto.

### 1️⃣ Ver la app en el navegador 🌐
```bash
npx expo start --web
```
Esto arranca un servidor de desarrollo con Webpack y abre la aplicación en tu navegador web predeterminado. Incluye recarga en caliente (Hot Reloading), lo que significa que los cambios en el código se reflejan casi instantáneamente en el navegador sin perder el estado de la aplicación.

**Para producción (build estático web):**
```bash
npx expo export --platform web
```
Este comando genera una versión estática de tu aplicación web, optimizada para producción, que puedes desplegar en cualquier servicio de hosting de sitios estáticos.

---

### 2️⃣ Android en **Expo Go** (emulador o móvil) 🤖⚡
Para ver tu app en un emulador de Android o en un dispositivo físico usando la app Expo Go:
```bash
npx expo start --android
# o simplemente 'npx expo start' y luego presiona 'a' en la terminal
```
Expo Go es una aplicación cliente que te permite abrir proyectos que usan el SDK de Expo sin necesidad de construir el APK/AAB completo. Expo detectará si tienes un development build; si no, intentará levantar la app en Expo Go.

---

### 3️⃣ Android nativo (APK / AAB) 🏗️
Para crear un archivo `.apk` (para pruebas locales o distribución directa) o un `.aab` (Android App Bundle, para subir a Google Play Store):

**Build local de desarrollo (firmado con keystore temporal):**
```bash
eas build -p android --profile development --local
```
Este comando crea un build de desarrollo en tu máquina local. El perfil `development` se configura en `eas.json`.

**Instalar en el emulador/dispositivo:**
Una vez generado el `.apk`, puedes instalarlo usando Android Debug Bridge (ADB):
```bash
adb install ruta/a/tu_app.apk
```
(Reemplaza `ruta/a/tu_app.apk` con la ruta real al archivo).

Los perfiles (como `development`, `preview`, `production`) se definen en `eas.json` y permiten configurar diferentes tipos de builds (e.g., con o sin optimizaciones, diferentes variables de entorno, etc.).

---

### 4️⃣ iOS Simulator (Mac) 🍎🖥️
Para ejecutar la aplicación en el Simulador de iOS (requiere macOS y Xcode):

**Vía Expo Go o Development Client:**
```bash
npx expo start --ios
# o simplemente 'npx expo start' y luego presiona 'i' en la terminal
```
Similar a Android, esto intentará abrir la app en Expo Go en el simulador, o en un Development Client si está configurado.

**Si ya hiciste un prebuild o tienes un Development Build:**
Si has generado previamente los archivos nativos del proyecto (con `npx expo prebuild` o mediante un `eas build` de desarrollo), puedes ejecutar:
```bash
npx expo run:ios
```
Este comando compila y ejecuta la app nativa directamente en el simulador.

---

### 5️⃣ iPhone físico (TestFlight) 📲
Para probar tu aplicación en un iPhone físico, generalmente se distribuye a través de TestFlight.

**Build en la nube (desarrollo o producción):**
```bash
eas build -p ios --profile development # o --profile production
```
Este comando utiliza EAS Build para construir tu aplicación en la nube. Necesitarás una cuenta de Apple Developer (con costo anual).

**Subir a TestFlight (una vez que el build esté completado y firmado):**
```bash
eas submit -p ios --latest # o especifica un ID/path del build
```
Este comando sube el build completado a App Store Connect para que puedas distribuirlo a tus testers mediante TestFlight.

---

### 6️⃣ Modo “Development Build” (universo paralelo) 🚀
Un "Development Build" es una versión de tu app que incluye el paquete `expo-dev-client`. Esto te permite iterar rápidamente en código nativo y usar librerías que requieren módulos nativos, sin las limitaciones de Expo Go.

**Crear el Development Build (una sola vez, local o en la nube):**
```bash
eas build -p android --profile development --local
# o para iOS:
eas build -p ios --profile development --local # o en la nube quitando --local
```
El perfil `development` en `eas.json` debe estar configurado para incluir `expo-dev-client`.

**Después de instalar el Development Build en tu dispositivo/emulador... ¡adiós Expo Go!**
Ahora, para conectar tu app al servidor de desarrollo:
```bash
npx expo start --dev-client
```
Esto iniciará el servidor de desarrollo, y podrás abrir la app de Development Build en tu dispositivo/emulador para conectarte a él. Un único binario con `expo-dev-client` y tu vida es más fácil, especialmente si trabajas con código nativo personalizado.

---

### Modo pantalla completa para canciones
Desde la vista de detalle puedes pulsar el nuevo icono de *pantalla completa* para abrir la canción en modo presentación. El texto se muestra con una fuente grande y puedes activar o pausar el desplazamiento automático con el botón de reproducción.

---

### 📝 Mini-post-it de comandos
Un resumen rápido de los comandos más usados:

```
Web (desarrollo) .............. npx expo start --web
Web (producción) .............. npx expo export --platform web
Android (Expo Go) ............. npx expo start --android
Android (Build local dev) ..... eas build -p android --profile development --local

iOS Simulator (Expo Go/Dev) ... npx expo start --ios
iOS Simulator (Nativo) ........ npx expo run:ios

iPhone TestFlight (Build) ..... eas build -p ios --profile production
iPhone TestFlight (Subir) ..... eas submit -p ios --latest
Development Client (arrancar) . npx expo start --dev-client

Instalar dependencias ......... npm install
```
## 📝 Comnandos para publicación
```
Update web - paso 1 .................... npx expo export --platform web
Update web - paso 2 .................. npx eas deploy --prod


Compilar para producción en la nube ............ eas build --profile production --platform android
Subir a la playstore ........................... eas submit --profile production --platform android
Post subidas ................................... eas submit -p android  
iOS???

eas credentials

```

## 📝 Actualizaciones Over The Air
```
eas update --branch production --message "Descripción de la actualización"
# revisar bien la rama
```

## Variables de entorno

Puedes definir algunas variables para ajustar ciertas funciones de la app. Expo cargará automáticamente las variables que empiecen por `EXPO_PUBLIC_` desde los archivos `.env`.

- `EXPO_PUBLIC_CORS_PROXY_URL`: URL base de un proxy para evitar problemas de CORS al descargar calendarios `.ics`. Un ejemplo es `https://corsproxy.io/?`. Si no se define, se intentará acceder a las URLs directamente.

### Configuración de Firebase

1. Crea un proyecto en [Firebase](https://console.firebase.google.com/) y habilita **Realtime Database**.
2. Dentro de la base de datos crea estos nodos:
   - `songs`
   - `albums`
   - `jubileo` con las subclaves `horario`, `materiales`, `visitas`, `profundiza`, `grupos` y `contactos`.
   Cada nodo debe contener dos campos: `updatedAt` (timestamp) y `data` (con el contenido del JSON correspondiente).
3. Genera las credenciales web de Firebase y cópialas en un archivo `.env.local` siguiendo el formato de `.env.example` en la carpeta `mcm-app`.
   Asegúrate de que todas las variables empiecen con `EXPO_PUBLIC_`.
4. El archivo `.env.local` se encuentra en `.gitignore`, por lo que tus claves no se subirán al repositorio.
5. Al arrancar la app (`npm start`) Expo cargará automáticamente dichas variables de entorno.
