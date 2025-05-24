# mcmapp
MCM App

# 🛟 Chuleta Express Expo + React Native 🙌  
Porque incluso los titanes a veces olvidan el hechizo correcto.

---

## 0️⃣ Pre‐requisitos ultra‐rápidos
* **Node LTS**  
* **Expo CLI** → `npm i -g expo-cli`  
* **EAS CLI** → `npm i -g eas-cli`  
* Java + Android SDK / Xcode según proceda  
* **Cuenta de Apple dev** (solo para builds iOS en dispositivo)

> Si algo explota, borra `node_modules`, reza un “Padre NPM” y vuelve a instalar.  

---

## 1️⃣ Ver la app en el navegador 🌐
```bash
npx expo start --web
```
Esto arranca un servidor Webpack y abre tu default browser con recarga en caliente.  


# producción (build estático):
```bash
npx expo export --platform web
```
---

## 2️⃣ Android en **Expo Go** (emulador o móvil) 🤖⚡
En emulador (o dispositivo conectado ↯):
```bash
npx expo start --android     # o solo ‘npx expo start’ y pulsa A
```
Expo detecta si tienes un development build; si no, levanta Expo Go.  

---

## 3️⃣ Android nativo (APK / AAB) 🏗️
# build local dev (firme con keystore temporal):

```bash
eas build -p android --profile development --local
```
# instalar en el emulador:
```bash
adb install ./tu_app.apk
```
Perfiles (development, preview, production…) se definen en `eas.json`.  

---

## 4️⃣ iOS Simulator (Mac) 🍎🖥️
# vía Expo Go o development client:
```bash
npx expo start --ios
```
# …o si ya hiciste prebuild:
```bash
npx expo run:ios
```

---

## 5️⃣ iPhone físico (TestFlight) 📲
```bash
# build cloud dev o producción:
eas build -p ios --profile development
# subir a TestFlight (una vez terminado):
eas submit -p ios
```
Necesitas cuenta Apple Developer (99 USD/año).  

---

## 6️⃣ Modo “Development Build” (universo paralelo) 🚀
```bash
# crear una sola vez (local o cloud):
eas build -p android --profile development --local   # idem -p ios
# después… ¡adiós Expo Go!
npx expo start --dev-client
```
Un único binario con **expo-dev-client** y tu vida es más fácil.  

---

### 📝 Mini-post-it de comandos
```
Web ............... npx expo start --web
Android Expo Go ... npx expo start --android
Android build ..... eas build -p android --profile development
iOS Simulator ..... npx expo start --ios
iPhone TestFlight . eas build -p ios --profile development
Dev-client turbo .. npx expo start --dev-client
```

---
