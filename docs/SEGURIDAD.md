# SEGURIDAD.md — Reglas de seguridad de Firebase

> Documentación de las reglas de seguridad de la **Realtime Database** del
> proyecto `mcmapp-39b71` y de cómo desplegarlas. El fichero de reglas vive en
> [`mcm-app/database.rules.json`](mcm-app/database.rules.json).

La app no tiene otro backend: **todo es Firebase Realtime Database**. No se usa
Firestore ni Storage de forma activa. La autenticación es Google/Apple Sign-In
(opcional: la mayoría de la app funciona sin login).

---

## 1. Filosofía de las reglas

1. **Denegado por defecto.** En la raíz `.read` y `.write` son `false`.
   Cualquier path no listado queda bloqueado.
2. **Lectura pública** solo para el contenido público (cantoral, álbumes,
   eventos, calendarios, lecturas, notificaciones, config de perfiles).
3. **Escritura pública** solo en los nodos concretos donde la app escribe sin
   login (reportes del cantoral, reflexiones, tokens push, evaluaciones, juego,
   playlists/coros compartidos).
4. **Datos personales** (`/users/$uid`) requieren login y ser el dueño.
5. La **intención** es que el backend/panel (mcmpanel) y el scraper de lecturas
   escriban con credencial de servidor (Admin SDK / token), que ignora estas
   reglas. Por eso `notifications`, `seccion_oracion`, `profileConfig`, etc.
   son solo-lectura desde la app.

> ### ⚠️ ANTES DE DESPLEGAR: siembra `/_config`
>
> Los permisos que el MCM Panel necesita **no están repartidos por el fichero**:
> cuelgan de dos banderas que viven en la propia base de datos,
> `/_config/legacyPanelWrites` y `/_config/legacyNotificationsOpen`. Con las dos
> en `true` el panel funciona exactamente igual que hoy; el día que tenga auth
> real se ponen en `false` **desde la consola, sin desplegar reglas**.
>
> **Si `/_config` no existe, las banderas valen `null` y el panel se queda sin
> permisos en el mismo instante del despliegue.** El nodo a importar está en
> `mcm-app/firebase-seed/config.json`. La app no depende de ellas para nada.
>
> `/_config` no lo lee ni lo escribe ningún cliente: las reglas lo consultan con
> `root.child(...)`, que se evalúa en el servidor. Solo se toca desde la consola.
>
> Dos cosas del panel **dejan de funcionar** al desplegar, y no tienen bandera
> porque abrirlas sería una fuga: la sección **Usuarios** (leer `/users` es leer
> el diario de Contigo de todo el mundo — `.read` cascadea y no se puede revocar
> más abajo) y el **contador de destinatarios** del composer (listar
> `/pushTokens` es poder mandar push a todos por tu cuenta). Las dos avisan con
> el modal *ERROR DE REGLAS DE FIREBASE* y las dos se arreglan con auth real en
> el panel (decisión D2).
>
> Guía completa de despliegue: `docs/desarrollo/FIREBASE_REGLAS.md`.

El fichero está **dividido por secciones comentadas**. Para **desactivar** una
sección concreta (por si algo se descontrola), pon su `.read`/`.write` a `false`
o borra el bloque: el resto sigue funcionando.

---

## 2. Mapa de paths y reglas por sección

| Sección (path)                       | Lectura | Escritura desde la app                          | Quién escribe de verdad |
| ------------------------------------ | :-----: | ----------------------------------------------- | ----------------------- |
| `/songs/data`                        | Pública | **Sí** (panel secreto, contraseña `coco`)       | Admin local             |
| `/songs/updatedAt`                   | Pública | Sí (invalidar caché)                            | Admin local             |
| `/songs/ediciones`                   | Pública | Sí (historial de ediciones)                     | Usuario/Admin           |
| `/songs/solicitudes`                 | Pública | Sí (sugerir canción)                            | Usuario                 |
| `/songs/fallitos`                    | Pública | Sí (reportar error)                             | Usuario                 |
| `/albums`                            | Pública | No                                              | Admin SDK               |
| `/jubileo/*`                         | Pública | No (salvo `compartiendo`)                       | Admin SDK               |
| `/jubileo/compartiendo`              | Pública | Sí (reflexiones)                                | Usuario                 |
| `/activities/<evento>/*`             | Pública | No (salvo `compartiendo` y `evaluacion`)        | mcmpanel (bandera)      |
| `/activities/<evento>/compartiendo`  | Pública | Sí (reflexiones)                                | Usuario                 |
| `/activities/<evento>/evaluacion/respuestas/<id>` | **Solo la suya** | Sí (encuesta del evento)   | Usuario                 |
| `/profileConfig`                     | Pública | No                                              | mcmpanel (bandera)      |
| `/calendars`                         | Pública | No                                              | Admin SDK               |
| `/seccion_oracion`                   | Pública | No                                              | Scraper (Admin SDK)     |
| `/notifications`                     | Pública | No                                              | `api/` (bandera)        |
| `/pushTokens/<tokenId>`              | Por token | Sí (registro + heartbeat del dispositivo)     | App                     |
| `/scheduledNotifications`            | Bandera | No                                              | `api/` (bandera)        |
| `/surveys/<id>/data`                 | Pública | No                                              | mcmpanel (bandera)      |
| `/surveys/<id>/respuestas/<id>`      | **Solo la suya** | Sí (una por dispositivo)               | Usuario                 |
| `/_config`                           | **Nadie** | **Nadie** (solo consola / Admin SDK)          | Tú                      |
| `/wordle/*`                          | Pública | Sí (stats/users/partida); `daily-words` no      | App / Admin SDK         |
| `/app/feedback`                      |    —    | Sí (reportar bug)                               | Usuario                 |
| `/app/evaluations/<id>`              | Por id  | Sí (encuesta de la app)                         | Usuario                 |
| `/playlistShares/<code>`             | Por código | Sí (compartir playlist)                      | Usuario                 |
| `/choirSessions/<clave>`             | Por clave  | Sí (coro en vivo; clave = id de coro o código) | Usuario               |
| `/choirs/<choirId>`                  | Pública    | Sí (crear coro y subirle playlists)          | Usuario                 |
| `/users/<uid>/**`                    | Solo dueño (auth) | Solo dueño (auth)                     | Usuario autenticado     |

Notas:

- **Raíz no enumerable**: en `pushTokens`, `playlistShares` y `choirSessions` la
  raíz tiene `.read: false`; solo se accede a un nodo concreto si conoces su
  id/código. Así nadie puede listar todos los tokens ni todas las playlists.
- **`choirs` SÍ es enumerable, a propósito**: la app necesita listar los coros
  para que cada uno elija el suyo. Lo que se publica ahí es el nombre del coro
  y el índice de sus playlists (nombre, fecha, código), nunca el contenido —
  las canciones siguen en `/playlistShares/<code>`, que no es enumerable. La
  escritura es por coro (`$choirId`), nunca en la raíz, así que nadie puede
  borrar el directorio entero de una sentada. Ver
  `docs/funcionalidades/COROS.md`.
- **`notifications` es solo-lectura**: ningún cliente puede crear/borrar
  notificaciones; solo el panel con Admin SDK.

---

## 3. Riesgos conocidos y cómo endurecerlos

### 3.1. ⚠️ El punto más débil: el panel secreto del cantoral

`/songs/data` es **escribible mientras `legacyPanelWrites` esté en `true`**,
porque el "panel secreto" (`components/SecretPanelModal.tsx`) se desbloquea con
una **contraseña en el código** (`coco`) y **no usa Firebase Auth**. Las reglas
no pueden verificar esa contraseña, así que cualquiera con la URL de la base de
datos podría, técnicamente, modificar o borrar el cantoral.

Apagar la bandera lo cierra, y **no afecta al pipeline de verdad**: el repo
`mcmapp-cantoral` sube el cantoral con token (Admin SDK), que ignora las reglas.
Lo único que se pierde es la edición desde el panel secreto de la app y desde el
editor del panel, que ya está marcado como deprecado.

**Mitigaciones recomendadas (en orden de esfuerzo):**

1. **Quitar la contraseña hardcodeada `coco`** del repositorio (está en
   `SecretPanelModal.tsx`). Como mínimo, moverla a una variable y rotarla.
2. **Migrar el panel a Firebase Auth + allowlist de admins.** Cuando los
   editores entren con su cuenta Google, crear un nodo `/admins/<uid>: true`
   (escrito solo con Admin SDK) y cambiar la regla de `songs/data` a:

   ```jsonc
   "data": {
     ".read": true,
     ".write": "auth != null && root.child('admins').child(auth.uid).val() === true"
   }
   ```

   Esto **rompería el panel actual** hasta que los editores usen login, por eso
   se deja abierto por defecto y documentado aquí.
3. Mantener backups/exports periódicos del nodo `songs` por si hay un borrado.

### 3.1.bis. Arreglado: cualquiera podía nombrarse admin

Hasta la revisión de 2026-08-13, `users/$uid` tenía `".write"` para su dueño y
eso **cascadeaba hasta `users/$uid/isAdmin`**: cualquier usuario con sesión
podía ponerse `isAdmin: true` y con ello abrirse el panel secreto del cantoral
(escritura sobre `/songs/data`). Poner `".write": false` debajo no lo arregla —
en RTDB `.read`/`.write` cascadean y un `false` más abajo **no revoca** el `true`
del padre. Lo que sí corta es un `.validate`, que no cascadea y se evalúa en el
path escrito; ahora exige que quien escribe sea ya admin. El primer admin se
pone a mano desde la consola.

### 3.2. Otros nodos de escritura pública

`ediciones`, `solicitudes`, `fallitos`, `compartiendo`, `feedback`,
`evaluations`, `wordle`, `pushTokens`, `playlistShares`, `choirSessions` son
escribibles sin login (es necesario para que la app funcione sin obligar a
registrarse). El riesgo es **spam/basura**, no fuga de datos. Para mitigar:

- Las reglas ya incluyen validaciones básicas (`pushTokens` debe tener hijos;
  `playlistShares`/`choirSessions` exigen `expiresAt` numérico).
- Si en el futuro hay spam, se puede exigir `auth != null` en esos nodos (la app
  tendría que pedir login anónimo o real antes de escribir).

---

## 4. Desplegar las reglas

### 4.1. A mano (primera vez — recomendado)

`firebase.json` ya apunta a `database.rules.json`. Desde `mcm-app/`:

```bash
# Requiere estar logueado: firebase login
firebase deploy --only database --project mcmapp-pro
```

> **Primera vez, ve con cuidado:** estas reglas **sustituyen** por completo las
> que haya ahora mismo en la consola de Firebase (que probablemente estén más
> abiertas). Tras desplegar, abre la app y comprueba que el cantoral, eventos,
> notificaciones, reflexiones y login funcionan. Si algo falla, revierte en la
> consola de Firebase (pestaña Realtime Database → Reglas → historial).

### 4.2. Automatizado (ligado a producción)

Hay un workflow en
[`.github/workflows/deploy-firebase-rules.yml`](.github/workflows/deploy-firebase-rules.yml)
que despliega las reglas **al mergear a `production`**, pero solo si cambió
`database.rules.json` o `firebase.json` (no redespliega en cada merge). También
se puede lanzar a mano desde la pestaña *Actions* (`workflow_dispatch`).

Esto encaja con el flujo actual: `deploy-web.yml` y `ota-production.yml` ya se
disparan con push a `production`; este workflow se suma a ellos.

**Para activarlo (requisito único):**

1. Crea una **cuenta de servicio** en el proyecto `mcmapp-39b71`:
   Consola de Google Cloud → IAM → Cuentas de servicio → Crear. Rol
   **"Firebase Realtime Database Admin"** (o "Editor"). Genera una clave JSON.
2. En GitHub → repo → *Settings* → *Secrets and variables* → *Actions*, crea el
   secret **`FIREBASE_SERVICE_ACCOUNT_MCMAPP`** y pega el JSON completo.
3. Listo. El próximo merge a `production` que toque las reglas las desplegará.

Mientras el secret **no** exista, el workflow no falla: avisa y termina, así que
no bloquea `deploy-web` ni la OTA.

> El workflow usa `GOOGLE_APPLICATION_CREDENTIALS` (cuenta de servicio), no el
> `firebase login:ci --token` (en desuso).

---

## 5. Activar / desactivar una sección rápidamente

En `mcm-app/database.rules.json`, busca el bloque comentado de la sección y:

- **Cortar escrituras** (p.ej. si hay spam en reflexiones): pon
  `"compartiendo": { "data": { ".write": false }, "updatedAt": { ".write": false } }`.
- **Ocultar una sección entera**: pon su `.read` a `false`.
- **Bloqueo total de emergencia**: deja solo la raíz `".read": false, ".write": false`
  y despliega. (Romperá la app, pero corta todo acceso al instante.)

Tras editar, despliega (sección 4). Los cambios son inmediatos.

---

## 6. Qué falta / siguientes pasos (pendientes)

- [ ] **Quitar/rotar la contraseña `coco`** y, idealmente, migrar el panel
      secreto a Firebase Auth + allowlist `/admins` (ver §3.1). Es la mejora de
      seguridad con más impacto.
- [ ] **Storage rules**: si en algún momento se sube contenido a Firebase
      Storage (imágenes, audios), hará falta `storage.rules` (hoy no se usa).
- [ ] **App Check**: para que SOLO la app oficial (no scripts) pueda hablar con
      la base de datos, activar Firebase App Check (DeviceCheck/Play Integrity/
      reCAPTCHA) y exigirlo. Es la defensa más fuerte contra el abuso de los
      nodos de escritura pública, sin obligar a login.
- [ ] **Índices (`.indexOn`)**: si alguna consulta ordena/filtra por hijo (p.ej.
      notificaciones por `createdAt`), añadir `.indexOn` para rendimiento.
- [ ] **Validaciones más estrictas** (tamaño máximo de reflexiones, formato de
      tokens, etc.) si aparece abuso.
- [ ] **Backups automáticos** del nodo `songs` (exportación periódica) como red
      de seguridad ante un borrado del cantoral.
- [ ] Revisar si `pushTokens/<tokenId>` debería tener `.read: false` (hoy es
      legible por token para que la app verifique el suyo; el token es el secreto,
      riesgo bajo, pero se puede cerrar si la app no necesita leerlo).
