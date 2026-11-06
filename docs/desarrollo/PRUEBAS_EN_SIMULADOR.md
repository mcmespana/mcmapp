# Probar la app en iPhone y Android desde un Mac (y desde Claude)

> Cómo ver la app **nativa** en el simulador de iPhone y en el emulador de
> Android, sin credenciales reales y sin tocar `.env.local`. Es lo que se usó
> para el rediseño del área nativa de Comunica (noviembre de 2026). Para el
> resto de pruebas (tests, OTA, builds de tienda) ver
> [`OTA.md`](OTA.md) y [`COBERTURA.md`](COBERTURA.md).

## 0. Qué necesitas y qué NO hace falta

- **Mac con Xcode** (simulador de iPhone). Sin Xcode no hay iOS.
- **Android sin Android Studio**: basta Homebrew (§3).
- **Ningún secreto real.** Todo va con valores de marcador, por variables de
  entorno en la línea de comandos. No se crea ni se edita `.env.local`.
- La **web** (`npm run web`) sirve para mirar Comunica, pero fuera de Comunica
  `app/_layout.tsx` pinta la pantalla de error de Firebase si las claves son de
  pega. Para ver el resto de la app, simulador o emulador.

## 1. Variables (todas de marcador)

Se pasan delante del comando; no se guardan en ningún fichero del repo.

```bash
export EXPO_NO_CAPABILITY_SYNC=1
export EXPO_PUBLIC_COMUNICA_API=fake            # área nativa de Comunica con servidor falso
export EXPO_PUBLIC_FIREBASE_FIXTURES=1          # álbumes, canciones y notificaciones inventados (utils/devFirebaseFixtures.ts)
export EXPO_PUBLIC_FIREBASE_API_KEY=demo
export EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-mcm.firebaseapp.com
export EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://demo-mcm-default-rtdb.firebaseio.com   # debe tener esta FORMA
export EXPO_PUBLIC_FIREBASE_PROJECT_ID=demo-mcm
export EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-mcm.appspot.com
export EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=0
export EXPO_PUBLIC_FIREBASE_APP_ID=demo
```

- Sin estas variables (tienda, web publicada) **nada cambia**: el modo falso es
  solo de desarrollo.
- **Notificaciones de prueba** (con `EXPO_PUBLIC_FIREBASE_FIXTURES=1`): 11
  avisos con todos los casos de la bandeja (ver `devNotificationsFixture`).
  Con el perfil «Monitor/a» se ve el aviso «solo monitores» y se oculta el de
  «solo familias» a propósito: es la prueba del filtro de audiencia. En el primer uso la app deja
  **sin leer las 3 más recientes**; para volver a ese estado hay que **reinstalar
  la app** en el simulador (`xcrun simctl uninstall booted com.familiaconsolacion.mcmapp`
  y volver a instalar el `.app`), porque lo leído vive en el almacenamiento de la app.
- Entrar en Comunica con el servidor falso: `familia@ejemplo.org` (familia) o
  `monitor@ejemplo.org` (equipo), código **`123456`**.
- Ruido que **no es de la app** y se puede ignorar: el engranaje de Expo
  (se quita abriendo con `&__expo_disable_fab=1`), el toast
  `[push] registerAndSaveToken…` (clave de Firebase de pega), el LogBox,
  «Preparando la Palabra…» y las pantallas que esperan red (p. ej. «Evalúa la
  app» se queda cargando: no hay fixtures para eso).
- El perfil por defecto **no incluye la pestaña Comunica**: en el onboarding
  elige «Monitor/a».

## 2. iPhone (simulador)

1. **Compilar e instalar** la app de desarrollo (la primera vez, y **cada vez
   que cambie algo nativo**: un paquete nuevo con carpeta `ios/`, como el
   afinador con `react-native-audio-api`):

   ```bash
   cd mcm-app
   LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo run:ios --device "iPhone 17 Pro" --no-bundler
   ```

   - `LANG=en_US.UTF-8` es obligatorio: sin él CocoaPods revienta con
     `Unicode Normalization not appropriate for ASCII-8BIT` y el build falla
     antes de empezar.
   - Con el binario viejo, la app abre y muestra en el LogBox «Failed to
     install react-native-audio-api: The native module could not be found».
     No es un bug del código: es una app de desarrollo sin recompilar.

2. **Servidor de JS** (Metro), con las variables de §1 puestas:

   ```bash
   cd mcm-app
   npx expo start --dev-client --port 8081 --clear
   ```

3. **Abrir la app** apuntando a Metro, sin el engranaje:

   ```
   exp+mcm-app://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081&__expo_disable_fab=1
   ```

   (Claude: `control` → `open_url`.)

### Desde Claude (herramienta del simulador de iOS)

La herramienta `mcp__Claude_Code_iOS_Simulator__control` hace todo:
`attach` (abre el panel en vivo: **antes de compilar**), `launch`,
`screenshot`, `tap`, `swipe`, `text`, `press_key`, `open_url`,
`set_appearance` (claro/oscuro) y `rotate`. Las coordenadas son **puntos del
dispositivo** (el `screenshot` informa de la escala). Pasar de claro a oscuro
con `set_appearance` es la forma más rápida de revisar los dos modos.

## 3. Android (emulador)

### Instalación (una sola vez, sin Android Studio)

```bash
brew install openjdk@17
brew install --cask android-commandlinetools
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH
sdkmanager "platform-tools" "emulator" "platforms;android-35" "system-images;android-35;google_apis;arm64-v8a"
avdmanager create avd -n Pixel_API35 -k "system-images;android-35;google_apis;arm64-v8a" -d pixel
```

Si el emulador no arranca con «Not enough space for userdata», baja
`disk.dataPartition.size` en `~/.android/avd/Pixel_API35.avd/config.ini`
(con 10G no arrancaba en un Mac justo de disco; 2G–6G va bien).

### Arrancar el emulador

```bash
emulator -avd Pixel_API35 -no-audio -no-snapshot-save -gpu host
adb reverse tcp:8081 tcp:8081     # para que la app llegue a Metro
```

### Compilar e instalar la app de desarrollo

Sin `google-services.json` el prebuild revienta y deja `android/` a medias
(paquete `com.mcmapp`, sin color de icono y **sin fuentes de iconos**: los
iconos salen como cuadrados vacíos). El fichero real no se usa: se pasa uno de
marcador **fuera del repo** con `GOOGLE_SERVICES_JSON`
(`app.config.ts` lo lee):

```json
{
  "project_info": {
    "project_number": "0",
    "project_id": "demo-mcm",
    "storage_bucket": "demo-mcm.appspot.com"
  },
  "client": [
    {
      "client_info": {
        "mobilesdk_app_id": "1:0:android:0000000000000000",
        "android_client_info": { "package_name": "com.mcmespana.mcmapp" }
      },
      "oauth_client": [],
      "api_key": [{ "current_key": "demo" }],
      "services": { "appinvite_service": { "other_platform_oauth_client": [] } }
    }
  ],
  "configuration_version": "1"
}
```

```bash
cd mcm-app
export GOOGLE_SERVICES_JSON=/ruta/fuera/del/repo/google-services.demo.json
rm -rf android                                   # si hubo un prebuild a medias o cambió algo nativo
npx expo prebuild --platform android --no-install
npx expo run:android --no-bundler
```

Tras fusionar `main` con un módulo nativo nuevo (afinador) hay que repetir el
`prebuild` + `run:android`; con el APK anterior la app se rompe al cargar.

**Trampa:** si `expo run:android` acaba con «Expo stopped waiting for the ADB
device… boot query» (Mac saturado), **el APK nuevo no se instala** y se queda
el viejo. Comprobar y arreglar a mano:

```bash
adb shell dumpsys package com.mcmespana.mcmapp | grep lastUpdateTime   # debe ser posterior al build
adb install -r mcm-app/android/app/build/outputs/apk/debug/app-debug.apk
```

### Abrir la app y mover el emulador desde la terminal (o desde Claude)

```bash
adb shell am start -a android.intent.action.VIEW \
  -d "exp+mcm-app://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081&__expo_disable_fab=1"
adb exec-out screencap -p > captura.png      # 1080×2400 reales
adb shell input tap X Y                      # coordenadas en píxeles REALES
adb shell input text "familia@ejemplo.org"
adb shell input keyevent KEYCODE_BACK        # ¡cuidado!: desde la raíz SALE de la app
adb shell input keyevent 46 46               # doble R: recargar JS
```

- Claude no tiene una herramienta propia para Android: usa `adb` por Bash y lee
  las capturas con `Read`. **Si la imagen se muestra a 900×2000, multiplica las
  coordenadas por 1,2** para pulsar en la pantalla real (1080×2400).
- Rutas directas: `-d "mcmapp:///ruta"`.
- Tema: si la app está fijada en «Claro» desde Ajustes, `cmd uimode night` no
  cambia nada; usa Ajustes → Tema de la app.

### Limitaciones del emulador

- **Teclado táctil:** con el teclado del Mac conectado el emulador enseña una
  barra flotante y no el teclado de verdad, así que **los bugs de teclado
  (campos tapados en el coro, login…) solo se comprueban en un móvil real**.
- Sin red real: las pantallas que dependen de ella quedan cargando.
- Un móvil Android físico y `fontScale` grande hay que probarlos a mano.

## 4. Web con datos falsos (solo Comunica)

`.claude/launch.json` trae `mcm-web-fake` (puerto 8082) con las mismas
variables. En Claude: `preview_start` con `{name: "mcm-web-fake"}` y se abre en
el panel del navegador; se cierra con `tabs_close` (al cerrar la última pestaña
se cierra el panel).

## 5. Antes de dar un cambio de pantallas por bueno

```bash
cd mcm-app
npx tsc --noEmit && npm run typecheck:tests && npx expo lint
npx jest --maxWorkers=3      # con el Mac justo, 3 workers: hay tests que dan timeout con carga alta y pasan sueltos
```

Y capturas de **claro y oscuro** en iPhone **y** Android
([`AREA_NATIVA_DISENO.md`](AREA_NATIVA_DISENO.md) §3).

## 6. Si algo no arranca

| Síntoma                                                                | Causa                                         | Arreglo                                    |
| ---------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------ |
| `Unicode Normalization not appropriate for ASCII-8BIT` al compilar iOS | locale                                        | `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`      |
| LogBox «native module could not be found»                              | app de desarrollo anterior a un módulo nativo | recompilar (§2.1 / §3)                     |
| Iconos como cuadrados vacíos en Android                                | APK viejo (instalación fallida)               | `adb install -r …app-debug.apk`            |
| Prebuild de Android a medias                                           | falta `google-services.json`                  | `GOOGLE_SERVICES_JSON` + borrar `android/` |
| Emulador sin espacio                                                   | partición de datos grande                     | bajar `disk.dataPartition.size`            |
| La app no llega a Metro en Android                                     | falta el túnel                                | `adb reverse tcp:8081 tcp:8081`            |
| Pantalla de error de Firebase en la web                                | claves de pega fuera de Comunica              | usar simulador                             |
