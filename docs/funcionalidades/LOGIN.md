# Inicio de sesión (Google y Apple)

> Cómo funciona el login en las tres plataformas y **qué hay que configurar
> fuera del código** para que Android funcione. Si vienes buscando "por qué en
> Android sale error al entrar con Google", ve directo a §4.

---

## 1. Qué ofrece cada plataforma

| Plataforma | Google | Apple | Cómo |
| --- | :---: | :---: | --- |
| **iOS** | ✅ | ✅ | `@react-native-google-signin/google-signin` + `expo-apple-authentication`, ambos nativos |
| **Android** | ✅ | ❌ | `@react-native-google-signin/google-signin` (nativo). Apple no existe como proveedor nativo en Android y **no se pinta el botón** |
| **Web** | ✅ | ✅ | `signInWithPopup` de Firebase para los dos |

En todos los casos el resultado es el mismo: una credencial que se canjea en
**Firebase Authentication** con `signInWithCredential`, y de ahí sale la sesión
que usa el resto de la app (`users/{uid}` en RTDB, sync de CONTIGO, etc.).

Apple **no** está disponible en Android a propósito: ofrecerlo obligaría a
montar el flujo web de Apple (Service ID + secreto JWT firmado + callback en un
servidor), y Apple solo lo exige en iOS. Google cubre el 100 % del caso de uso
en Android.

---

## 2. Piezas de código

```
utils/authErrors.ts             ← traduce TODOS los códigos de error a los propios (puro, testeado)
utils/platformAuth.ts           ← implementación web (popups de Firebase)
utils/platformAuth.native.ts    ← implementación iOS + Android
contexts/AuthContext.tsx        ← estado de sesión, signIn/signOut/deleteAccount
components/SocialLoginSection.tsx ← la UI (botones, tarjeta de cuenta, borrar cuenta)
app/onboarding.tsx              ← paso de login del onboarding (perfiles monitor y miembro)
```

Tests: `__tests__/authErrors.test.ts` y `__tests__/platformAuthNative.test.ts`.

### Detalles que importan

- **El módulo nativo se carga en perezoso** (`require` dentro de la función).
  Si el binario no lo incluye —Expo Go, o un dev client sin recompilar—, la app
  arranca igual y el fallo solo aparece, con mensaje, al pulsar el botón.
- **La configuración se garantiza antes del `signIn()`**
  (`ensureGoogleSignInConfigured`). No depende de que el efecto de arranque de
  `AuthContext` haya terminado: si el usuario pulsa rápido, igualmente se
  configura primero.
- **`webClientId` es obligatorio en Android.** Es el que pide el `idToken` que
  luego valida Firebase. Sin él el login fallaría en silencio, así que el
  código lo comprueba y lanza un error explícito.
- **Los errores llegan normalizados** (`AuthError` con `code`), y la UI decide
  el mensaje con `authErrorMessage()`. Una cancelación del usuario no muestra
  ningún toast.

---

## 3. Variables de entorno

| Variable | Para qué | Dónde |
| --- | --- | --- |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Pide el `idToken` que valida Firebase. **Obligatoria en Android e iOS** | `eas.json` (los cuatro perfiles) y `.env.local` |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Client ID de tipo iOS + el `iosUrlScheme` del config plugin | `eas.json` y `.env.local` |
| `GOOGLE_SERVICES_JSON` | `google-services.json` de Android (FCM + Firebase). Variable de tipo **fichero** en EAS | EAS |

Ya están puestas en `eas.json`, no hay que tocarlas.

---

## 4. Lo único que hay que configurar para Android: las huellas SHA-1

Android no usa un "client ID de Android" en el código: Google identifica la app
por la pareja **`nombre de paquete` + `huella SHA-1` del certificado que firma
el APK/AAB**. Si esa pareja no está registrada, `signIn()` falla con
`DEVELOPER_ERROR` (código 10) — que en la app se ve como *"El inicio de sesión
no está disponible ahora mismo"*.

El paquete es `com.mcmespana.mcmapp`. Las huellas hay que darlas de alta a mano.

### 4.1 Sacar las huellas

Hay **tres** certificados distintos y conviene registrar los tres:

```bash
# Desde mcm-app/ — huella del keystore que gestiona EAS
# (firma los builds de development y preview, y es la clave de subida del AAB)
npx eas-cli credentials -p android
```

Elige el perfil, entra en **Keystore** y copia el `SHA1 Fingerprint`.

La tercera —y la más importante para la gente que instala desde la tienda— sale
de la **Play Console**, porque Google Play vuelve a firmar el AAB con su propia
clave:

> Play Console → tu app → **Prueba y lanzamiento → Configuración → Firma de
> aplicaciones** → copia el **SHA-1 del certificado de la clave de firma de la
> app** (y, ya de paso, el del **certificado de la clave de carga**).

### 4.2 Registrarlas en Firebase

> Firebase Console → ⚙️ **Configuración del proyecto** → pestaña **General** →
> sección **Tus apps** → la app Android `com.mcmespana.mcmapp` → **Añadir
> huella digital** → pegar cada SHA-1 (una por una).

Al guardar cada huella, Firebase crea sola la credencial OAuth de tipo Android
en el proyecto de Google Cloud. No hay que entrar en Google Cloud a mano.

### 4.3 Descargar el `google-services.json` actualizado

En esa misma pantalla, botón **`google-services.json`**. Ese fichero se sube a
EAS como variable de entorno de tipo fichero:

> [expo.dev](https://expo.dev) → proyecto `mcm-app` → **Environment variables**
> → `GOOGLE_SERVICES_JSON` → subir el fichero nuevo.

Y se deja también en `mcm-app/google-services.json` para desarrollo local (está
en `.gitignore`, nunca se commitea).

### 4.4 Comprobar que Google está activo como proveedor

> Firebase Console → **Authentication → Sign-in method** → **Google** debe
> estar habilitado.

Ya lo está (es lo que usa iOS), pero si algún día sale
`auth/operation-not-allowed`, es esto.

---

## 5. Probar que funciona

1. Build de desarrollo de Android:
   `npm run eas:build:android -- --profile development`
2. Instalar en el móvil y entrar en **Más → tu cuenta** (o rehacer el
   onboarding eligiendo perfil monitor/miembro).
3. Casos que hay que ver:
   - **Entrar con Google** → aparece el selector de cuentas del sistema, se
     elige una y la tarjeta pasa a mostrar nombre, correo y "via Google".
   - **Cancelar** el selector → no sale ningún mensaje de error (es lo correcto).
   - **Cerrar sesión** y volver a entrar → funciona sin reiniciar la app.
   - **Cerrar y abrir la app** → la sesión sigue puesta (persistencia en
     AsyncStorage).
   - **Eliminar cuenta** → pide confirmación, borra `users/{uid}` y la cuenta.
   - **Sin botón de Apple**: en Android solo debe verse el de Google.

---

## 6. Diagnóstico rápido

| Lo que ve el usuario | Causa casi segura | Arreglo |
| --- | --- | --- |
| *"El inicio de sesión no está disponible ahora mismo"* | `DEVELOPER_ERROR` (10): la huella SHA-1 de ese build no está en Firebase | §4.1 y §4.2. Ojo: la huella del build de la tienda **no** es la del build de desarrollo |
| Funciona en el APK de desarrollo pero no desde Google Play | Falta la huella de **Play App Signing** | §4.1, el SHA-1 de la Play Console |
| *"Necesitas Google Play Services actualizado"* | Dispositivo sin Play Services (Huawei, emulador sin Google APIs) | No tiene arreglo por nuestra parte |
| *"Esta versión de la app no admite el inicio de sesión"* | El binario instalado no trae el módulo nativo (OTA sobre un binario viejo) | Instalar un build nuevo |
| *"Ese correo ya tiene cuenta con otro método"* | La misma dirección se registró antes con Apple | Entrar con el proveedor original |
| Se abre el selector, se elige cuenta y no pasa nada | Falta `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` en el perfil de build | §3 |

Los errores reales quedan en el log (`logger.error('[AuthContext] …')`) y, si
Sentry está configurado, también allí.
