# Reglas de Firebase — qué falta y cómo desplegarlas

> **Estado: escritas, NO desplegadas.** Y desplegarlas hoy **rompería el MCM
> Panel**. Este documento dice exactamente por qué, qué tiene que cambiar el
> Panel antes, y qué comandos ejecutas tú el día que se pueda.
>
> El fichero es `mcm-app/database.rules.json`. Revisión: 2026-08-04.

---

## 1. El problema en una frase

Las reglas del repo asumen que **el Panel escribe con credencial de servidor**
(Admin SDK, que ignora las reglas). **Hoy no lo hace**: escribe con el SDK de
cliente y sin autenticar, y sus funciones `api/` llaman por REST sin token.

Las reglas que hay **activas en producción ahora mismo están abiertas**. Las del
repo son mucho más estrictas. En cuanto se desplieguen, cada escritura del Panel
que no vaya por Admin SDK empezará a fallar con `PERMISSION_DENIED`.

**Por eso están sin desplegar, y está bien que sigan así hasta el punto 3.**

---

## 2. Qué he cambiado en esta revisión

Una sola cosa: **`/scheduledNotifications` no estaba declarado**.

En Firebase, un nodo que no aparece en las reglas queda **denegado** (la regla 1
del fichero es "denegado por defecto"). O sea que ya estaba bloqueado — pero por
omisión, no por decisión, y al leer el fichero no había forma de distinguir "lo
hemos bloqueado a propósito" de "se nos olvidó".

Ahora está declarado explícitamente como denegado en ambos sentidos, con el
comentario de por qué. **No cambia el comportamiento**, cambia que se entienda.

El resto del fichero lo he repasado entero y está bien: cubre cantoral, álbumes,
Jubileo, actividades, perfiles, calendarios, oración, notificaciones, tokens
push, Wordle, feedback, encuestas, playlists compartidas, sesiones de coro y
datos de usuario autenticado.

### Lo que sigue siendo el punto débil (y no toco)

`/songs/data` tiene **escritura pública**. Cualquiera con la URL de la base de
datos puede reescribir el cantoral entero. Es así porque el panel secreto de la
app escribe ahí con una contraseña (`coco`), no con Auth.

No lo arreglo aquí porque arreglarlo **es** la decisión D2 (abajo): o el panel
pasa a escribir autenticado, o esas escrituras se mueven a una función de
servidor. Cerrarlo antes dejaría el panel secreto sin funcionar.

---

## 3. Qué tiene que cambiar el Panel (repo `mcmpanel`)

Tres cosas, en este orden. Ninguna es de este repo.

### 3.1 Credencial de servidor en las funciones `api/`

`api/_lib/push.ts` llama a la base de datos por REST **sin token**. Hay que
añadirle `?auth=<FIREBASE_DB_SECRET>` (o un token de service account) y meter esa
variable en Vercel.

Es exactamente lo que ya hace el uploader del cantoral, así que hay un ejemplo
funcionando dentro de casa.

### 3.2 🔒 Auth real para las escrituras — **esto lo decides tú**

Dos caminos, y hay que elegir uno:

| | Cómo | A favor | En contra |
|---|---|---|---|
| **A. Firebase Auth en el panel** | Login con Google + nodo `/admins/<uid>`, y reglas del tipo `".write": "auth != null && root.child('admins').child(auth.uid).val() === true"` | Es el modelo estándar; el panel sigue escribiendo directo | Hay que montar el login y mantener la lista de admins |
| **B. Todo por funciones `api/`** | El frontend del panel pasa a **solo lectura**; cada escritura va a una función protegida con 3.1 + sesión | Las reglas quedan mucho más simples: nadie escribe desde el navegador | Hay que escribir una función por cada tipo de escritura |

**Mi recomendación: A.** El panel ya tiene varias secciones que escriben, y B
obliga a escribir y mantener una función por cada una. A es más trabajo de una
vez y menos para siempre.

### 3.3 `CRON_SECRET` en Vercel

Verificar que está configurado en producción para `process-scheduled`. Sin él,
cualquiera puede forzar el procesado de las notificaciones programadas.

---

## 4. Cómo se despliega (cuando el punto 3 esté hecho)

### 4.1 A mano, desde tu máquina

Desde `mcm-app/`:

```bash
# 1. Ver qué cambiaría, SIN aplicar nada
npx firebase-tools@latest database:get / --project mcmapp-39b71 > /dev/null
# (si esto falla por permisos, es que no has hecho login)

npx firebase-tools@latest login

# 2. Desplegar SOLO las reglas de la base de datos
npx firebase-tools@latest deploy --only database --project mcmapp-39b71
```

⚠️ **No hay "deshacer" con un comando.** Antes de lanzarlo, guarda las reglas
actuales para poder volver:

```bash
# Consola de Firebase → Realtime Database → Reglas → copiar y guardar en un .txt
```

### 4.2 Automático (ya está montado, solo falta una cosa)

Existe `.github/workflows/deploy-firebase-rules.yml`, que despliega las reglas
**solo cuando cambia `database.rules.json`** y se mergea a `production`. También
se puede lanzar a mano desde la pestaña Actions.

**Está esperando un secret y por eso no hace nada:**

1. Consola de Google Cloud → IAM → **Cuentas de servicio** → crear una para el
   proyecto `mcmapp-39b71`, con el rol **Firebase Realtime Database Admin**.
2. Crear una clave JSON y descargarla.
3. GitHub → repo `mcmespana/mcmapp` → **Settings → Secrets and variables →
   Actions → New repository secret**:
   - Nombre: `FIREBASE_SERVICE_ACCOUNT_MCMAPP`
   - Valor: el contenido **entero** del JSON.

Mientras el secret no exista, el workflow avisa y termina **sin error** — no
bloquea ningún otro despliegue. Está hecho a propósito así.

> **Ojo con el orden**: en cuanto pongas ese secret, el siguiente merge a
> `production` que toque `database.rules.json` **desplegará las reglas de
> verdad**. No lo pongas hasta que el punto 3 esté cerrado.

---

## 5. Después de desplegar: qué probar

Reglas mal puestas no dan error al desplegar; dan error a los usuarios. Prueba
las dos caras el mismo día:

**App** — cantoral (abrir y buscar), eventos, notificaciones, reflexiones
(escribir una), evaluaciones, login de Contigo, y que se registre el token push
(mira que aparezca en `/pushTokens`).

**Panel** — cada sección que guarde algo, envío de una notificación, y una
notificación programada.

Si algo falla, el error en consola será `PERMISSION_DENIED` y el path te dice
qué regla falta.

---

## 6. Resumen para el que solo lea esto

| | Quién | Estado |
|---|---|---|
| Declarar `/scheduledNotifications` | app | ✅ hecho |
| Credencial de servidor en `api/` | panel | ⏳ pendiente |
| **Decidir modelo de auth (A o B)** | **tú** | 🔒 **bloquea todo lo demás** |
| `CRON_SECRET` en Vercel | panel | ⏳ verificar |
| Secret de GitHub para el despliegue automático | tú | ⏳ **no lo pongas todavía** |
| Desplegar y probar | tú | ⏳ al final |

Contexto largo de cada punto: `docs/planes/PLAN_INTEGRACIONES.md` §"Integración
D". Riesgos y filosofía de las reglas: `docs/SEGURIDAD.md`.
