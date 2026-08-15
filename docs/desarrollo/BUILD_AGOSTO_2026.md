# Build de tienda — agosto de 2026

> **Para el día que te sientes a sacarla.** Paso a paso, en orden, sin dar nada
> por sabido. Lo que hay que configurar UNA vez está en §2; el día de la build
> se hace §3 → §4 → §5 → §6.
>
> Rama: **`main`** · **App v2.1.0** · Expo SDK 57
>
> (La rama `claude/compact-tabs-bar-uxxaoz`, que traía todo esto, se mergeó en
> la [#313](https://github.com/mcmespana/mcmapp/pull/313) el 2026-08-04 y ya no
> existe. Se compila desde `main`.)

---

## 1. Por qué esta build no puede ser una OTA

Una OTA (EAS Update) manda **solo el bundle de JavaScript**. Esta rama cambia
código **nativo**, que vive en el binario y no se puede actualizar así:

- Expo SDK 55 → 57 y React Native 0.83 → 0.86
- `expo-native-compact-tabs` (barra de pestañas flotante) — módulo nativo nuevo
- `react-native-reanimated` 4 + `react-native-worklets`
- `@sentry/react-native` — SDK nativo de crash reporting
- `expo-alternate-app-icons` — icono alternativo de Carismochito
- Notification Service Extension de iOS — un **target nuevo** de Xcode
- `@aptabase/react-native` — analítica de uso
- `modules/highlight-menu` — módulo nativo propio: "Subrayar" en el menú del sistema
- iPad landscape (`UISupportedInterfaceOrientations~ipad`)

Si esto saliera por OTA, la app **crashearía** en los móviles ya instalados: el
binario que tienen no lleva esos módulos. Por eso los commits van con
`[skip-ota]` y el orden es **build primero, `production` después** (§6).

---

## 2. Configuración previa (una sola vez)

### 2.1 Sentry — crear el proyecto

1. Entra en <https://sentry.io> con la cuenta de MCM (o crea una; el plan
   gratuito sobra para el volumen que tenemos).
2. **Create Project** → plataforma **React Native** → nombre `mcm-app`.
3. Apunta dos cosas de la pantalla que sale al terminar:
   - El **DSN**: `https://<algo>@<algo>.ingest.sentry.io/<números>`
   - El **slug de la organización** (sale en la URL: `sentry.io/organizations/<slug>/`)

> El DSN **no es un secreto**. Va horneado dentro de la app, cualquiera puede
> extraerlo; solo sirve para *enviar* eventos, no para leerlos. Se guarda como
> secret igualmente por higiene, pero si se filtra no pasa nada.

### 2.2 Sentry — token para subir los source maps

Sin esto Sentry funciona, pero los errores llegan **minificados**
(`a.b is not a function` en vez del nombre real del fichero y la línea).

1. Sentry → **Settings → Auth Tokens → Create New Token**.
2. Permisos: `project:releases` y `org:read`. Nada más.
3. Copia el token (solo se ve una vez).

### 2.3 Meter las variables donde tocan

Son **cuatro** variables de Sentry y van en **tres sitios distintos** (la de
Aptabase está en §2.4). Es el punto donde más fácil es equivocarse, así que aquí
está la tabla completa:

| Variable | Qué es | EAS (builds) | GitHub (OTAs) | `.env.local` (dev) |
| --- | --- | :---: | :---: | :---: |
| `EXPO_PUBLIC_SENTRY_DSN` | A dónde se mandan los errores | ✅ | ✅ | opcional |
| `SENTRY_ORG` | Slug de la organización | ✅ | ❌ | ❌ |
| `SENTRY_PROJECT` | Slug del proyecto (`mcm-app`) | ✅ | ❌ | ❌ |
| `SENTRY_AUTH_TOKEN` | Token para subir source maps | ✅ | ❌ | ❌ |

**a) EAS** — desde `mcm-app/`, cuatro comandos:

```bash
npx eas-cli secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "https://…"
npx eas-cli secret:create --scope project --name SENTRY_ORG            --value "mi-org"
npx eas-cli secret:create --scope project --name SENTRY_PROJECT        --value "mcm-app"
npx eas-cli secret:create --scope project --name SENTRY_AUTH_TOKEN     --value "sntrys_…"
```

Comprobar: `npx eas-cli secret:list` (deben salir los cuatro).

> No hay que tocar `eas.json`: los secrets del proyecto se inyectan solos como
> variables de entorno en todos los perfiles de build.

**b) GitHub** — repo `mcmespana/mcmapp` → **Settings → Secrets and variables →
Actions → New repository secret**:

- Nombre: `EXPO_PUBLIC_SENTRY_DSN` · Valor: el mismo DSN.

⚠️ **Esto no es opcional.** Los workflows de OTA hornean las `EXPO_PUBLIC_*` en
el bundle. Si el secret no está, **la primera OTA que salga apaga Sentry** en
toda la base instalada, sin ningún aviso. Los workflows ya están preparados
para leerlo (`.github/workflows/ota-production.yml` y `ota-preview.yml`).

**c) `.env.local`** (opcional, solo si quieres probar Sentry en local):

```
EXPO_PUBLIC_SENTRY_DSN=https://…
EXPO_PUBLIC_SENTRY_DEBUG=1
```

### 2.4 Aptabase — analítica de uso

1. Entra en <https://eu.aptabase.com> (servidores europeos) y crea una cuenta.
2. **New App** → nombre `MCM App` → elige React Native.
3. Copia el **App Key**. Empieza por `A-EU-…`; esa `EU` es lo que hace que los
   datos se queden en Europa, no hay que configurar nada más.

Igual que el DSN de Sentry: **no es un secreto** (va dentro del bundle) pero se
guarda como secret para no publicarlo.

| Variable | EAS (builds) | GitHub (OTAs) | `.env.local` (dev) |
| --- | :---: | :---: | :---: |
| `EXPO_PUBLIC_APTABASE_KEY` | ✅ | ✅ | opcional |

```bash
npx eas-cli secret:create --scope project --name EXPO_PUBLIC_APTABASE_KEY --value "A-EU-…"
```

Y en GitHub → Settings → Secrets → Actions, un secret con el **mismo nombre y
valor**. ⚠️ Mismo aviso que con Sentry: si falta ahí, **la primera OTA apaga la
analítica** en toda la base instalada. Los workflows ya lo leen.

> Sin la clave la app no manda **ningún** evento: se puede dejar para más
> adelante y encenderla luego por OTA sin recompilar.

### 2.5 Credenciales de la extensión de notificaciones (iOS)

La NSE es un **bundle id nuevo**: `com.familiaconsolacion.mcmapp.MCMNotificationService`.
Necesita su propio App ID y su propio perfil de aprovisionamiento en Apple.

**El proyecto es managed (CNG): la carpeta `ios/` NO existe cuando EAS resuelve
las credenciales.** Por eso EAS no puede "ver" el target de la extensión por su
cuenta — se entera al hacer prebuild, y para entonces los perfiles ya están
resueltos y solo se generó el de la app principal. El build falla al firmar:

```
No profiles for 'com.familiaconsolacion.mcmapp.MCMNotificationService' were found
```

La extensión se le declara a mano en `app.json`, y **ya está puesto**:

```jsonc
"extra": {
  "eas": {
    "build": {
      "experimental": {
        "ios": {
          "appExtensions": [
            {
              "targetName": "MCMNotificationService",
              "bundleIdentifier": "com.familiaconsolacion.mcmapp.MCMNotificationService"
            }
          ]
        }
      }
    }
  }
}
```

Con eso, el primer build de iOS **pregunta por la terminal** si quieres que EAS
genere las credenciales de la extensión → **Yes**. Así que ese primer build no
lo lances y te vayas: quédate los dos primeros minutos.

Para comprobarlo antes de compilar: `npx eas-cli credentials` → iOS → el perfil
→ tienen que salir **dos** targets, la app y `MCMNotificationService`.

### 2.6 Huellas SHA-1 de Android (para el inicio de sesión con Google)

Esta build es la primera que trae **login con Google en Android**. El código ya
está, pero Google identifica la app por la pareja `com.mcmespana.mcmapp` +
**huella SHA-1 del certificado que firma el binario**, y esa pareja hay que
darla de alta a mano. Si falta, el botón falla con *"El inicio de sesión no
está disponible ahora mismo"* (`DEVELOPER_ERROR`).

Son **dos momentos distintos**:

1. **Antes del build de desarrollo** — huella del keystore de EAS:
   `npx eas-cli credentials -p android` → Keystore → copiar el `SHA1
   Fingerprint`.
2. **Después de subir el AAB a la Play Console** — huella de Play App Signing,
   que es distinta porque Google vuelve a firmar el paquete: Play Console →
   Prueba y lanzamiento → Configuración → **Firma de aplicaciones** → SHA-1 de
   la clave de firma **y** de la clave de carga.

Las dos se pegan en Firebase Console → Configuración del proyecto → Tus apps →
app Android → **Añadir huella digital**. Después, descargar el
`google-services.json` actualizado y volver a subirlo a la variable de entorno
`GOOGLE_SERVICES_JSON` de EAS.

> ⚠️ Registrar solo la primera huella hace que el login funcione en tu móvil de
> pruebas **y falle para todo el que instale desde la tienda**. Las dos.

Paso a paso completo y tabla de diagnóstico:
[`docs/funcionalidades/LOGIN.md`](../funcionalidades/LOGIN.md).

---

## 3. Antes de compilar — comprobaciones en frío

Desde `mcm-app/`, con `main` sacado y al día:

```bash
npm ci                 # instala exactamente lo del package-lock
npm run lint           # 0 errores (los 51 warnings del React Compiler son conocidos: docs/desarrollo/WARNINGS.md)
npx tsc --noEmit       # sin salida = bien
npm test               # todo en verde
```

Y una comprobación específica de esta build: que el proyecto nativo se genera
bien con todos los plugins nuevos.

```bash
npx expo prebuild -p ios --no-install --clean
```

Tiene que terminar en `✔ Finished prebuild` y deben existir:

- `ios/MCMNotificationService/NotificationService.swift`
- `ios/MCMApp/Images.xcassets/Carismochito.appiconset/`
- `ios/sentry.properties`

Y que el módulo local del subrayado se autolinka:

```bash
npx expo-modules-autolinking search -p apple --json | grep highlight-menu
```

> ⚠️ **Ojo: que autolinke AQUÍ no basta.** Lo anterior mira tu carpeta local; lo
> que compila EAS es lo que le SUBE, y eso lo decide `.easignore` — que cuando
> existe **sustituye** a `.gitignore`. Tuvo el mismo agujero que tuvo el
> `.gitignore` (reglas `ios/` y `android/` sin barra inicial, que casan a
> cualquier profundidad) y se llevaba por delante
> `modules/highlight-menu/{ios,android}`: el módulo subía con su
> `expo-module.config.json` y su JS pero SIN Swift ni Kotlin, autolinking lo
> saltaba en silencio y la app salía sin el ítem "Subrayar" del menú del sistema.
> Comprobación de que no ha vuelto (no debe imprimir nada):
>
> ```bash
> git -c core.excludesFile=.easignore check-ignore -v --no-index \
>   modules/highlight-menu/ios/HighlightMenuView.swift \
>   modules/highlight-menu/android/build.gradle
> ```

Lo mismo para Android (**necesita `google-services.json` en `mcm-app/`**, que
está gitignoreado — cógelo de la consola de Firebase si no lo tienes):

```bash
npx expo prebuild -p android --no-install --clean
grep activity-alias android/app/src/main/AndroidManifest.xml   # tiene que salir MainActivityCarismochito
```

**Cuando termines, borra las carpetas generadas**: son temporales y no van al
repo (`rm -rf ios android`). EAS las regenera en cada build.

---

## 4. Los builds

### 4.1 Primero un build de desarrollo, para probar en el móvil

```bash
npm run eas:build:ios -- --profile development
npm run eas:build:android -- --profile development
```

> **Nunca** `npx eas-cli build` a pelo: los scripts de npm limpian antes los
> symlinks de Claude Code (`.agent/`, `.agents/`), y sin eso EAS falla en
> Windows con `EPERM: operation not permitted, symlink`.

Instala el resultado en tu móvil y pasa el checklist de pruebas (§5). **No
sigas hasta que §5 esté entero en verde.**

### 4.2 Luego los de producción

```bash
npm run eas:build:ios -- --profile production
npm run eas:build:android -- --profile production
```

`autoIncrement` sube solo el número de build. La versión visible sigue siendo
la de `app.json` (`2.1.0`) — cámbiala ahí si quieres que salga otra.

### 4.3 Subir a las tiendas

```bash
npx eas-cli submit -p ios --latest
npx eas-cli submit -p android --latest
```

---

## 5. Checklist de pruebas (sobre el build de desarrollo)

### 5.1 Lo nuevo de esta build

**Barra de pestañas flotante** — es lo más tocado y lo más visible:

- [ ] Baja el scroll: la barra se compacta **enseguida**, sin costar.
- [ ] Sigue bajando **hasta el final del todo** y rebota: la barra **NO** se
      pone grande. (Era el bug; probar en Inicio, Cantoral y Fotos.)
- [ ] Sube un poco (un dedo corto): **no** se expande.
- [ ] Sube de verdad: se expande.
- [ ] Llega arriba del todo: se expande siempre.
- [ ] Con la barra pequeña, entra en una canción del cantoral o en un item de
      "Más": **sigue pequeña** al entrar en la pantalla de dentro.
- [ ] Re-tapea la pestaña activa: vuelve a la raíz / sube el scroll.
- [ ] **Pasando por el onboarding**: completa el onboarding y mira la barra al
      llegar a Inicio — las etiquetas tienen que verse enteras, no cortadas.

**Inicio de sesión en Android** (nuevo — antes salía "próximamente"; hace falta
haber registrado la huella SHA-1, §2.6):

- [ ] Más → tu cuenta: se ven **el botón de Google y solo ese** (Apple no
      existe en Android).
- [ ] "Continuar con Google" → sale el selector de cuentas del sistema; al
      elegir una, la tarjeta muestra nombre, correo y "via Google".
- [ ] **Cancela** el selector → **no** aparece ningún mensaje de error.
- [ ] Cierra sesión y vuelve a entrar sin reiniciar la app.
- [ ] Mata la app y ábrela: la sesión **sigue puesta**.
- [ ] Onboarding con perfil monitor o miembro → ahora aparece el paso de login
      (antes se saltaba en Android) y el indicador marca 3 pasos.
- [ ] "Eliminar cuenta" → pide confirmación y la borra.

**Notificaciones — canales de Android** (hace falta un Android **real**, no
emulador, y mandar pushes desde el Panel):

- [ ] Ajustes de Android → MCM App → Notificaciones: salen **7 canales**
      (Avisos generales, Urgente, Eventos y calendario, Celebraciones, Cantoral,
      Fotos, Mantenimiento) y **ninguno de más**.
- [ ] Push con `channelId: "urgente"` → se asoma encima de lo que estés haciendo
      (heads-up) y suena.
- [ ] Push con `channelId: "cantoral"` → suena pero **no** se asoma.
- [ ] Push con `channelId: "mantenimiento"` → silencioso, solo en la bandeja.
- [ ] Push **sin** `channelId` → llega al canal "Avisos generales".
- [ ] Silencia "Cantoral" desde los ajustes del sistema → los de cantoral dejan
      de sonar y los urgentes siguen sonando.

> ⚠️ Los ajustes de un canal que ya has tocado **no se pueden revertir desde la
> app**. Si te lías probando, la única forma de volver al estado limpio es
> desinstalar y reinstalar.

**Notificaciones — imagen en iOS (la extensión nueva):**

- [ ] Manda desde el Panel un push **con imagen** y con `mutableContent: true`.
- [ ] Con la app **cerrada del todo**: llega la notificación y, al mantenerla
      pulsada o desplegarla, **se ve la foto**. (Antes en iOS nunca se veía.)
- [ ] Manda un push **sin** imagen: llega normal, sin retraso raro.
- [ ] Con el móvil en avión: la notificación llega igual (sin foto). Que la
      descarga falle no puede tragarse el aviso.

**Icono de Carismochito:**

- [ ] Agita el móvil hasta activar el modo → el icono del launcher pasa a la
      mascota sobre fondo verde. En iOS sale una alerta del sistema ("Has
      cambiado el icono de MCM App"): **es de Apple y no se puede quitar**.
- [ ] Cierra y abre la app: el modo sigue activo y **NO** vuelve a salir la
      alerta del icono.
- [ ] Desactiva el modo → vuelve el icono normal.
- [ ] Android: mira el icono en el cajón de aplicaciones. Puede tardar un poco
      en refrescarse, es normal. Si tienes un acceso directo en el escritorio,
      comprueba que sigue abriendo la app.

**Sentry:**

- [ ] Pon en `.env.local` el `EXPO_PUBLIC_SENTRY_DSN` y `EXPO_PUBLIC_SENTRY_DEBUG=1`,
      y arranca `npm start`. **No hace falta recompilar**: en un build de
      desarrollo el bundle lo sirve Metro desde tu máquina y lee `.env.local`
      cada vez (sí hay que reiniciar Metro tras editar el fichero).
- [ ] Abre la app en el móvil → en Sentry tiene que aparecer un evento
      **"[sentry] ping de verificación"** en menos de un minuto.
- [ ] Quita `EXPO_PUBLIC_SENTRY_DEBUG` de `.env.local`. En los builds de
      producción no hace falta hacer nada: esa variable no está en los secrets
      de EAS, así que sale apagada de serie (y en producción Sentry reporta
      igualmente, porque `__DEV__` es falso).
- [ ] En el build de **producción**, cuando lleves un par de días, mira que en
      Sentry los stack traces salgan con nombres de fichero y línea de verdad.
      Si salen minificados, faltó `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`.

**Analítica (Aptabase):**

- [ ] Con `EXPO_PUBLIC_APTABASE_KEY` puesta, abre la app y navega un rato.
- [ ] En el panel de Aptabase aparecen `app_abierta` y varios `pantalla_vista`
      con rutas legibles (`/(tabs)/cancionero`, no la ruta de cada canción).
- [ ] Abre una canción → `cancion_abierta` con su categoría y el origen.
- [ ] Todos los eventos llevan `perfil` y `delegacion` **rellenos**, no
      `sin_perfil` (eso indicaría que se están mandando antes de tiempo).
- [ ] Ningún evento lleva títulos, nombres ni texto escrito por nadie.

**"Subrayar" en el menú nativo (Contigo → Evangelio):**

- [ ] Selecciona texto de una lectura **sin** activar el modo lápiz: en el menú
      del sistema sale **"Subrayar"**.
- [ ] Tocarlo abre la barra de colores con esa selección ya cogida, y al elegir
      color se subraya el tramo correcto (ni corrido ni de más).
- [ ] El menú **conserva el resto**: Copiar, Traducir, Buscar y —en iOS—
      Herramientas de escritura. Es lo que podría romper el proxy del delegate.
- [ ] Con el modo lápiz encendido, seleccionar sigue actualizando la barra
      (`onSelectionChange` viaja por el mismo delegate).
- [ ] Android: el ítem sale **tanto leyendo como en modo lápiz**.
- [ ] Pruébalo en las cinco lecturas (evangelio, comentario, primera, salmo,
      segunda) — cada una es un texto distinto.
- [ ] Web (`npm run web`): no hay menú nativo, pero el **modo lápiz de siempre
      tiene que seguir funcionando igual**.

**iPad (landscape, nunca se ha probado en un iPad físico):**

- [ ] Gira el iPad en horizontal en: Inicio, Cantoral (lista y canción),
      Calendario, Fotos, Contigo y Más.
- [ ] Abre modales y bottom sheets en horizontal.
- [ ] Barra de pestañas en horizontal: se ve entera y bien centrada.

**Caché compartida de Firebase (Plan 008) — se estrena en esta build:**

Está en `main` desde el 2026-07-22 pero **nunca ha llegado a un dispositivo**:
se dejó fuera de `production` a propósito porque toca el hook central de datos
(`useFirebaseData`) y cambia comportamiento visible del calendario
(stale-while-revalidate: pinta lo cacheado y refresca por detrás).

- [ ] Calendario: abre, cierra y vuelve a abrir. Los eventos salen **al
      instante** desde caché y se actualizan solos si hay cambios.
- [ ] Con el móvil en avión: sale lo cacheado, sin pantalla de error.
- [ ] Cambia algo en Firebase y reabre: el cambio llega sin reinstalar.
- [ ] Cantoral y Fotos: mismo hook, comprobar que no tardan más que antes.

### 5.2 Lo de siempre (regresión)

- [ ] Cantoral: buscar, abrir canción, acordes, transportar, pantalla completa.
- [ ] Reproductores de YouTube y de audio de las canciones (se recuperaron de
      `production` en esta rama — que vuelvan a funcionar es el objetivo).
- [ ] Comunica: se ve el portal, no hay franjas blancas en modo oscuro y el
      final de la página **no queda tapado** por la barra (Android sobre todo).
- [ ] Calendario, Fotos, Contigo, Más.
- [ ] Login con Google.
- [ ] Onboarding completo desde cero (borrando datos de la app).
- [ ] Modo oscuro en todas las pantallas anteriores.
- [ ] Abrir un archivo `.mcm` compartido por WhatsApp.

---

## 6. Después de que los builds estén bien

**El orden importa.** `production` dispara la OTA automáticamente, así que no
puede tocarse hasta que las tiendas tengan el binario nuevo:

1. ✅ Merge a `main` — hecho en la #313 (2026-08-04).
2. Builds de producción iOS + Android (§4.2) desde `main`.
3. Subir a App Store y Play Store, y **esperar a que estén aprobadas y
   publicadas**.
4. **Solo entonces**: mover `production` a `main`.

Si mueves `production` antes de que la gente tenga el binario nuevo, la OTA les
manda un bundle que su app no puede ejecutar.

### ⚠️ Antes de darle a "publicar" en las tiendas

La analítica obliga a actualizar tres cosas **fuera del código**. Apple y Google
lo preguntan en el formulario de envío, así que esto bloquea la publicación:

- [ ] **Política de privacidad**: decir que se recogen datos de uso anónimos.
      Ayuda que Aptabase no guarde identificadores persistentes de dispositivo
      ni de usuario — la declaración es corta, pero hay que hacerla.
- [ ] **App Store → ficha de privacidad**: declarar "Datos de uso → Datos de
      interacción con el producto", **no vinculados** a la identidad del usuario
      y **no usados para seguimiento**.
- [ ] **Play Console → Data safety**: lo mismo, marcando que los datos van
      cifrados en tránsito y que no se comparten con terceros.

Si prefieres no tocar nada de esto todavía: **no pongas
`EXPO_PUBLIC_APTABASE_KEY`**. Sin la clave la app no manda ningún evento y no
hay nada que declarar; se enciende luego por OTA cuando los textos estén.

### Avisar al Panel

Esta build cambia el contrato de notificaciones. Cuando esté publicada, el MCM
Panel tiene que empezar a mandar **`channelId`** (top-level, mismo valor que
`data.category`, y `default` cuando la categoría sea `general`). Detalle y tabla
cerrada en `docs/contratos/NOTIFICACIONES_CONTRATO.md` §8.

⚠️ Un `channelId` que la app **no** declare hace que Android **no entregue** la
notificación. Mientras el Panel no lo mande, todo sigue cayendo en `default`
como hasta ahora — así que no hay prisa, pero sí cuidado al hacerlo.

---

## 7. Si algo se rompe

| Síntoma | Causa casi seguro | Arreglo |
| --- | --- | --- |
| `No profiles for '…MCMNotificationService' were found` | Falta declarar la extensión en `extra.eas.build.experimental.ios.appExtensions` — en managed, EAS no la ve sola | Ya está en `app.json` (§2.5). Si sigue fallando: `npx eas-cli credentials` y genera el perfil de ese bundle id a mano |
| App Store Connect rechaza el `.ipa` por versiones que no cuadran | La extensión y la app llevan `CFBundleVersion` distinto | Mira `plugins/withNotificationServiceExtension.js`: coge la versión de la misma config que la app, así que suele ser que se editó a mano |
| App Store Connect rechaza el icono por canal alfa | Se regeneró `carismochito.png` sin `removeAlpha()` | `npm run icons:alt` (el script ya lo quita) |
| El prebuild de iOS crea el target **dos veces** | Se lanzó `prebuild` sin `--clean` sobre un `ios/` viejo | `rm -rf ios` y repetir. El plugin ya se protege, pero con un proyecto a medias puede liarse |
| No llega ningún evento a Sentry | Falta `EXPO_PUBLIC_SENTRY_DSN` en el build | `npx eas-cli secret:list` |
| Sentry funcionaba y de repente dejó de reportar | Salió una OTA sin el secret de GitHub | Añade `EXPO_PUBLIC_SENTRY_DSN` en los secrets del repo (§2.3b) y relanza la OTA |
| Los errores de Sentry salen minificados | Faltó el token al compilar | `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` en los secrets de EAS |
| En iOS la notificación con foto llega sin foto | El Panel no mandó `mutableContent: true` | Sin ese flag iOS ni siquiera arranca la extensión |
| No llega ningún evento a Aptabase | Falta `EXPO_PUBLIC_APTABASE_KEY` o la clave no es `A-EU-…` | `npx eas-cli secret:list`; la app avisa por consola si la clave tiene mal formato |
| Se rompió algo del menú de selección de las lecturas | El proxy del delegate de iOS | `modules/highlight-menu/ios/HighlightMenuView.swift`. Quitar `onNativeHighlightRequest` en `evangelio.tsx` desactiva el módulo entero sin tocar el resto |
| El icono de Android no cambia | El launcher tarda en refrescar la caché | Espera, o reinicia el launcher. En launchers con icono redondo antiguo (API < 26) el cambio no se aplica: es una limitación conocida |

---

## 8. Qué queda fuera de esta build

- **Widget de Contigo** — es una build dedicada, no un extra de ésta. Ver
  `docs/planes/PLAN_WIDGET_CONTIGO.md`.

Estado completo de la bolsa nativa: `docs/planes/BACKLOG.md` §C.
