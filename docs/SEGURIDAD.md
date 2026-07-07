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

> ### ⚠️ NO DESPLIEGUES ESTAS REGLAS TODAVÍA — romperían mcmpanel
>
> A fecha 2026-07: **mcmpanel NO usa Admin SDK**. El panel escribe con el SDK
> cliente de Firebase **sin autenticación**, y sus funciones serverless
> (`api/_lib/push.ts`) usan la API REST **sin token** (`.json` sin `?auth=`).
> Solo el uploader del cantoral (`mcmapp-cantoral/scripts/update_firebase.py`)
> usa token. Con estas reglas desplegadas, el panel perdería: la lectura de la
> raíz (usa `onValue('/')`), todas las escrituras de secciones
> (`/albums`, `/calendars`, `/profileConfig`, `/activities`, `/surveys`,
> `/users/*/isAdmin`…), la lectura de `/pushTokens` para enviar push y la
> escritura de `/notifications` y `/scheduledNotifications` (este último nodo
> ni siquiera aparece en las reglas). **Prerequisito para desplegar**: dar al
> panel auth real (Firebase Auth + allowlist `/admins`) o mover sus escrituras
> a las funciones de `api/` con credencial de servidor. Ver
> `docs/planes/PLAN_INTEGRACIONES.md` (Integración D).

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
| `/activities/<evento>/*`             | Pública | No (salvo `compartiendo` y `evaluacion`)        | Admin SDK               |
| `/activities/<evento>/compartiendo`  | Pública | Sí (reflexiones)                                | Usuario                 |
| `/activities/<evento>/evaluacion/respuestas/<id>` | Pública | Sí (encuesta del evento)            | Usuario                 |
| `/profileConfig`                     | Pública | No                                              | mcmpanel (Admin SDK)    |
| `/calendars`                         | Pública | No                                              | Admin SDK               |
| `/seccion_oracion`                   | Pública | No                                              | Scraper (Admin SDK)     |
| `/notifications`                     | Pública | **No** (denegada)                               | mcmpanel (Admin SDK)    |
| `/pushTokens/<tokenId>`              | Por token | Sí (registro + heartbeat del dispositivo)     | App                     |
| `/wordle/*`                          | Pública | Sí (stats/users/partida); `daily-words` no      | App / Admin SDK         |
| `/app/feedback`                      |    —    | Sí (reportar bug)                               | Usuario                 |
| `/app/evaluations/<id>`              | Por id  | Sí (encuesta de la app)                         | Usuario                 |
| `/playlistShares/<code>`             | Por código | Sí (compartir playlist)                      | Usuario                 |
| `/choirSessions/<code>`              | Por código | Sí (coro en vivo)                            | Usuario                 |
| `/users/<uid>/**`                    | Solo dueño (auth) | Solo dueño (auth)                     | Usuario autenticado     |

Notas:

- **Raíz no enumerable**: en `pushTokens`, `playlistShares` y `choirSessions` la
  raíz tiene `.read: false`; solo se accede a un nodo concreto si conoces su
  id/código. Así nadie puede listar todos los tokens ni todas las playlists.
- **`notifications` es solo-lectura**: ningún cliente puede crear/borrar
  notificaciones; solo el panel con Admin SDK.

---

## 3. Riesgos conocidos y cómo endurecerlos

### 3.1. ⚠️ El punto más débil: el panel secreto del cantoral

`/songs/data` es **escribible públicamente** porque el "panel secreto"
(`components/SecretPanelModal.tsx`) se desbloquea con una **contraseña en el
código** (`coco`) y **no usa Firebase Auth**. Las reglas de seguridad no pueden
verificar esa contraseña, así que cualquiera con la URL de la base de datos
podría, técnicamente, modificar o borrar el cantoral.

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
