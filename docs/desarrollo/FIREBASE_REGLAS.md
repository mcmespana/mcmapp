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

Riesgos y filosofía de las reglas: `docs/SEGURIDAD.md`. Contexto largo:
`docs/planes/PLAN_INTEGRACIONES.md` §"Integración D".
