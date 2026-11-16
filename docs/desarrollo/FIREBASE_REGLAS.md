# Reglas de Firebase — cómo se despliegan sin romper nada

> **Estado: listas para desplegar**, con una condición: hay que **sembrar el
> nodo `/_config` ANTES**. Si se despliegan sin él, el panel se queda sin
> permisos en el mismo instante.
>
> El fichero es `mcm-app/database.rules.json`. Revisión: 2026-08-13.

---

## 1. La idea en tres frases

El panel escribe con el SDK de cliente **sin autenticar**, y sus funciones
`api/` llaman por REST **sin token**. Unas reglas cerradas de verdad lo dejan
inservible, así que sus permisos no están repartidos por el fichero: cuelgan de
**dos banderas que viven en la propia base de datos**, en `/_config`.

Con las banderas en `true` el panel funciona exactamente igual que hoy. Cuando
tenga auth real, se ponen en `false` **desde la consola de Firebase, sin
desplegar reglas**.

Lo que **no** depende de banderas es lo privado de verdad: `/users` (el diario
de Contigo de cada persona) está cerrado y punto.

---

## 2. Las dos banderas

| Bandera | Qué abre | Cómo se apaga |
| --- | --- | --- |
| `_config/legacyPanelWrites` | Lo que el panel lee y escribe de contenido: `albums`, `calendars`, `songs`, `wordle`, `profileConfig`, `activities`, `jubileo`, `surveys`, `app`, `choirs`. También la lectura en bloque de las respuestas de encuestas. | Auth real en el panel (decisión D2) |
| `_config/legacyNotificationsOpen` | `pushTokens` (lectura de la raíz), `notifications` (escritura) y `scheduledNotifications` (ambas). Lo necesitan las funciones `api/` y el contador de destinatarios del composer. | `FIREBASE_DB_SECRET` en Vercel **y** que el panel deje de leer esos nodos desde el navegador |

`/_config` **no es legible ni escribible por ningún cliente**. Las reglas lo
leen con `root.child(...)`, que se evalúa en el servidor y no pasa por `.read`.
Solo se toca desde la consola de Firebase o con Admin SDK — nadie puede abrirse
los permisos a sí mismo.

### Lo que NO cubren las banderas

Estas dos cosas dejan de funcionar en el panel en cuanto se despliegue, y no
hay interruptor para ellas porque abrirlas sería una fuga de datos personales:

- **Sección Usuarios** (`/users`). Leer la lista de usuarios es leer, por
  cascada, `users/<uid>/contigo/{habits,bookmarks,revisions}`: el diario
  espiritual de cada persona. `.read` en RTDB **no se puede revocar más abajo**,
  así que no hay forma de enseñar solo el nombre y el email.
- **Contador de destinatarios del composer** (`/pushTokens` entero). Poder
  listar los tokens es poder mandar push a todo el mundo por tu cuenta con la
  API de Expo.

Las dos avisan con el modal **ERROR DE REGLAS DE FIREBASE** en vez de quedarse
en blanco. Las dos se arreglan con lo mismo: auth real en el panel.

---

## 3. Qué se arregló en esta revisión

**Bugs que habrían roto la app** el día del despliegue:

| Path | Quién | Qué pasaba |
| --- | --- | --- |
| `activities/<ev>/evaluacion/updatedAt` | `EvaluacionScreen.tsx:77` | La app lo escribe al enviar una evaluación; solo había regla para `respuestas/$deviceId`. Sin `updatedAt` ningún dispositivo se entera de que hay respuestas nuevas |
| `jubileo/evaluacion/**` | mismo código con el evento legacy | No existía la regla |
| `__noop__/<slug>` | `EventHomeScreen.tsx` | Path inventado para las secciones sin nodo. Con reglas cerradas es un `PERMISSION_DENIED` por tarjeta renderizada. Se quitó el fetch (`useFirebaseData` ya acepta `null`) |
| `users/$uid/isAdmin` | — | **Escalada de privilegios**: el `.write` de `users/$uid` cascadeaba hasta `isAdmin`, así que cualquiera con sesión podía nombrarse admin (y abrirse el panel secreto del cantoral). Un `".write": false` debajo NO lo arregla — `.read`/`.write` cascadean y no se revocan. Ahora lo corta un `.validate`, que sí se evalúa en el path escrito |
| `playlistShares` / `choirSessions` | — | El `.validate` estaba en el padre (`hasChild('expiresAt')`). Los `update()` parciales no reevalúan el `.validate` de un ancestro, así que no validaba lo que parecía. Movido a la hoja |

**Fugas cerradas** (efectivas al apagar `legacyPanelWrites`):

- `surveys/<id>/respuestas` y `activities/<ev>/evaluacion/respuestas` ya no son
  legibles en bloque. Llevan `userName`, `userDelegation` y `userId`. Cada
  dispositivo lee la suya y nada más.
- La app tampoco se los descargaba por gusto: `useFirebaseData` hacía
  `get()` del nodo entero en la primera carga. Ahora pide siempre
  `updatedAt` / `hidden` / `data` por separado.

**El panel dejó de leer la raíz.** `JSONManager` hacía `onValue('/')`. Mientras
eso siguiera, las reglas no se podían cerrar de ninguna manera, porque conceder
`.read` en `/` es conceder `/users`. Ahora se suscribe a los 8 nodos que
gestiona. De paso deja de bajarse la base entera cada vez que un móvil manda su
heartbeat de `pushTokens`.

---

## 4. Cómo se comprueba que están bien

```bash
cd mcm-app && npx jest __tests__/databaseRules.test.ts
```

`__tests__/databaseRules.test.ts` evalúa el fichero de reglas contra el
inventario real de paths que tocan la app y el panel — cada caso dice de qué
fichero y línea sale. Comprueba tres escenarios: banderas puestas, banderas
apagadas y `/_config` sin sembrar.

El evaluador (`__tests__/helpers/rulesEngine.ts`) reimplementa la semántica de
RTDB que usamos: resolución del path (gana el nombre exacto sobre el `$comodín`),
cascada de `.read`/`.write` y el hecho de que `.validate` **no** cascadea. No
modela los `.validate` de forma (`isString()`, longitudes): para eso hace falta
el emulador con datos de verdad.

Si añades una expresión nueva al fichero de reglas, el evaluador **falla a
propósito** en vez de aprobarla en silencio.

---

## 5. El despliegue, paso a paso

### 5.1 Sembrar `/_config` — PRIMERO, sin excepción

Consola de Firebase → Realtime Database → Datos → importar en la raíz, o crear
a mano el nodo `_config`:

```json
{
  "legacyPanelWrites": true,
  "legacyNotificationsOpen": true
}
```

El JSON está en `mcm-app/firebase-seed/config.json`.

> Si las banderas no existen valen `null`, la comparación da `false` y el panel
> se queda sin permisos **en el mismo segundo del despliegue**. La app aguanta
> entera (no depende de ellas para nada), pero el panel no.

### 5.2 Guardar las reglas actuales

No hay "deshacer" con un comando:

```
Consola → Realtime Database → Reglas → copiar el contenido a un .txt
```

### 5.3 Desplegar

```bash
cd mcm-app
npx firebase-tools@latest login
npx firebase-tools@latest deploy --only database --project mcmapp-39b71
```

O automático: existe `.github/workflows/deploy-firebase-rules.yml`, que
despliega **solo cuando cambia `database.rules.json`** y se mergea a
`production`. Espera el secret `FIREBASE_SERVICE_ACCOUNT_MCMAPP` (Consola de
Google Cloud → IAM → Cuentas de servicio, rol *Firebase Realtime Database
Admin*, clave JSON entera como secret del repo). Mientras el secret no exista el
workflow avisa y termina sin error.

### 5.4 Probar las dos caras el mismo día

**App** — cantoral (abrir y buscar), un evento y sus secciones, notificaciones,
escribir una reflexión, enviar una evaluación, login de Contigo, y que el token
push siga apareciendo en `/pushTokens`.

**Panel** — cada sección que guarde algo, envío de una notificación y una
programada. Usuarios y el contador del composer **van a fallar**: eso es lo
esperado, y sale el modal explicándolo.

Si algo más falla, el modal del panel te da el path exacto y en la app salta un
evento de Sentry marcado `[firebase-rules]` con el path y la operación.

---

## 6. Después: apagar las banderas

### 6.1 `legacyNotificationsOpen`

1. Consola de Firebase → Configuración del proyecto → Cuentas de servicio →
   Secretos de base de datos → copiar el secret.
2. Vercel → proyecto del panel → Settings → Environment Variables →
   `FIREBASE_DB_SECRET` = ese secret. Redesplegar.
3. Comprobar que se envía una notificación de prueba (los helpers REST ya
   mandan `?auth=` en cuanto la variable existe; sin ella se comportan como
   siempre).
4. Quitar del panel la lectura de `/pushTokens` y `/scheduledNotifications`
   desde el navegador (contador del composer y listado de programadas), o
   moverlas a una función `api/`.
5. Poner la bandera a `false` en la consola.

### 6.2 `legacyPanelWrites` — requiere la decisión D2

Es la decisión pendiente: **auth real en el panel**. Dos caminos, sin cambios
desde la última revisión:

| | Cómo | A favor | En contra |
|---|---|---|---|
| **A. Firebase Auth en el panel** | Login con Google + allowlist. Ya existe la pieza: `users/<uid>/isAdmin`, que la app lee en `useAdminStatus`. Las reglas pasarían a `".write": "auth != null && root.child('users').child(auth.uid).child('isAdmin').val() === true"` | Modelo estándar; el panel sigue escribiendo directo; **arregla también Usuarios y el composer** | Hay que montar el login |
| **B. Todo por funciones `api/`** | El frontend pasa a solo lectura; cada escritura va a una función protegida | Reglas más simples: nadie escribe desde el navegador | Una función por cada tipo de escritura |

**Recomendación: A**, y ahora más que antes: es lo único que devuelve la sección
Usuarios y el contador de destinatarios, y la mitad del trabajo (el flag
`isAdmin` con su `.validate`) ya está en las reglas.

---

## 7. Resumen

| | Quién | Estado |
|---|---|---|
| Arreglar los bugs de las reglas | app | ✅ hecho |
| Test de contrato de las reglas | app | ✅ hecho (170 casos) |
| Panel deja de leer la raíz | panel | ✅ hecho |
| Modal de error de reglas | panel | ✅ hecho |
| Sentry al denegar en la app | app | ✅ hecho |
| Soporte `?auth=` en `api/` | panel | ✅ hecho (falta poner la variable) |
| **Sembrar `/_config`** | **tú** | ⏳ **antes de desplegar** |
| Desplegar y probar | tú | ⏳ |
| `FIREBASE_DB_SECRET` en Vercel | tú | ⏳ |
| **Decidir modelo de auth (A o B)** | **tú** | 🔒 desbloquea Usuarios y el composer |
| **Pegar el bloque de `panueloTrades`** (§8) | **tú** | ⏳ antes de probar intercambios en `preview` |

Riesgos y filosofía de las reglas: `docs/SEGURIDAD.md`. Contexto largo:
`docs/planes/PLAN_INTEGRACIONES.md` §"Integración D".

---

## 8. Intercambios del pañuelo: el bloque que hay que pegar a mano

> Decisión del usuario (2026-11-16): **este bloque lo despliega el usuario a
> mano desde la consola**, sin esperar al despliegue completo de §5 (no
> depende de `/_config`). Ningún agente despliega reglas.

Los intercambios del pañuelo (`/panueloTrades/<código>`,
`docs/planes/PLAN_PANUELO_INTERCAMBIOS.md`) necesitan su regla. **Sin ella, la
app no puede intercambiar**: al pulsar «Intercambiar» sale el aviso «Los
intercambios todavía no están activados en el servidor…», no un error raro. El
resto de la app no se entera.

### Qué hace la regla, en cristiano

- Solo quien ha iniciado sesión (Google/Apple) puede leer un intercambio, y
  solo si sabe su código: la lista entera no la puede leer nadie.
- Lo abre quien ofrece su pieza, y nadie puede cambiar después qué pieza
  ofreció ni cuándo caduca.
- Lo contesta otra persona, una sola vez y antes de que caduque (10 min).
- Lo acepta solo quien lo abrió. Cualquiera de los dos puede echarse atrás
  antes de aceptar. Un tercero no puede tocar nada.
- Lo borra quien lo abrió, o cualquiera cuando lleva más de un día caducado.

### Paso a paso (unos 5 minutos)

1. Entra en <https://console.firebase.google.com>, proyecto **mcmapp**
   (`mcmapp-39b71`).
2. Menú de la izquierda → **Realtime Database** → pestaña **Reglas**.
3. **Copia todo lo que hay** y guárdalo en un `.txt` (no hay botón de
   deshacer).
4. Busca la línea que dice `"rules": {` (casi arriba del todo). Pon el cursor
   **justo al final de esa línea**, pulsa Intro y pega el bloque de abajo
   **tal cual** (con la coma del final).
5. Si justo debajo de lo que has pegado no hay nada más que `}` (las reglas
   estaban vacías), **borra la última coma** del bloque.
6. Pulsa **Publicar**. Si la consola marca algo en rojo, no publica: suele ser
   una coma que falta o sobra. Revisa el paso 4/5 o vuelve a pegar lo que
   guardaste en el paso 3.

```json
"panueloTrades": {
  ".read": false,
  ".write": false,
  "$code": {
    ".read": "auth != null",
    ".write": "auth != null && (((!data.exists() || data.child('expiresAt').val() + 86400000 < now) && newData.child('offer/uid').val() === auth.uid && newData.child('status').val() === 'open' && !newData.child('answer').exists() && newData.child('expiresAt').val() <= now + 900000) || (data.exists() && !newData.exists() && (data.child('offer/uid').val() === auth.uid || data.child('expiresAt').val() + 86400000 < now)) || (data.exists() && newData.exists() && newData.child('offer/uid').val() === data.child('offer/uid').val() && newData.child('offer/itemId').val() === data.child('offer/itemId').val() && newData.child('expiresAt').val() === data.child('expiresAt').val() && ((data.child('status').val() === 'open' && newData.child('status').val() === 'proposed' && newData.child('answer/uid').val() === auth.uid && auth.uid !== data.child('offer/uid').val() && now < data.child('expiresAt').val()) || (data.child('status').val() === 'proposed' && newData.child('status').val() === 'accepted' && auth.uid === data.child('offer/uid').val() && newData.child('answer/uid').val() === data.child('answer/uid').val() && newData.child('answer/itemId').val() === data.child('answer/itemId').val()) || (newData.child('status').val() === 'cancelled' && (data.child('status').val() === 'open' || data.child('status').val() === 'proposed') && (auth.uid === data.child('offer/uid').val() || auth.uid === data.child('answer/uid').val())))))",
    ".validate": "$code.length === 6 && $code.matches(/^[A-HJKMNP-Z2-9]+$/) && newData.child('code').val() === $code && newData.hasChildren(['code', 'status', 'createdAt', 'expiresAt', 'offer']) && newData.child('createdAt').isNumber() && newData.child('expiresAt').isNumber()"
  }
},
```

> El mismo bloque está en `mcm-app/database.rules.json` (con un comentario
> que explica cada rama). Si alguien lo cambia allí, hay que volver a pegarlo
> aquí y en la consola: `__tests__/databaseRules.test.ts` vigila que el
> fichero y su copia de pruebas no se separen.

**Si en tus reglas actuales hay un `".read": true` o `".write": true` justo
debajo de `"rules": {`** (reglas abiertas, de prueba), el bloque no cierra
nada: en Firebase un permiso concedido arriba no se puede quitar más abajo.
Los intercambios funcionarán igual, pero sin la protección de arriba. Se
arregla el día que se despliegue el fichero entero (§5).

### Cómo comprobar que ha quedado bien (simulador de la consola)

En la misma pestaña **Reglas**, botón **Simulador de reglas** (Rules
Playground):

1. **Tipo**: `set`. **Ubicación**: `/panueloTrades/K7WQ4M`. Activa
   **Autenticado** con el proveedor que quieras y UID `ana`. **Datos**:

   ```json
   {
     "code": "K7WQ4M",
     "status": "open",
     "createdAt": 1800000000000,
     "expiresAt": 1800000600000,
     "offer": { "uid": "ana", "itemId": "pulsera-amistad" }
   }
   ```

   → **Denegado**, porque `expiresAt` tiene que ser «dentro de 10-15 minutos»
   y esa fecha es de 2027. Cambia los dos números por la hora de ahora en
   milisegundos (<https://currentmillis.com>) y ahora + 600000 → **Permitido**.
2. Lo mismo con UID `luis` (abrir a nombre de Ana) → **Denegado**.
3. Tipo `read`, la misma ubicación, **sin** autenticar → **Denegado**; Tipo
   `read` en `/panueloTrades` (la raíz) con UID `ana` → **Denegado**.

La prueba buena es la de dos móviles del plan (§7 de
`PLAN_PANUELO_INTERCAMBIOS.md`): un tercero intentando reescribir la pieza
ofrecida tiene que fallar.
