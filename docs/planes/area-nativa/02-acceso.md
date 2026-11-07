# 02 — Entrar en el área nativa

> **Estado:** 🟢 listo para ejecutar en `nuevoComunicaChulo` · **Depende de:**
> 00, 01 · **Tamaño:** M · Índice y reglas comunes: [`README.md`](README.md).

> ✅ **Cambio del 1/11/2026 (decisión del propietario, 31/10): SE DICE si el correo o el DNI no existe**, igual que la
> web (`comunicaAreaPrivada:docs/ACCESO.md` §2). Sustituye a la regla de abajo «Nunca se dice si un correo existe» y a la
> decisión `dni` («contestar igual»): los textos de este documento que dicen lo contrario están marcados como
> superados. Lo que hace la app está en «Si el correo no existe» (más abajo).

## Para qué y para quién

Para que un monitor entre una vez y no tenga que volver a hacerlo en meses.
Decidido (`login`): **código de 6 cifras por correo o DNI, sin contraseña, y
con el correo de la cuenta de la app ya puesto** si la persona entró en la app
con Google o Apple (idea del propietario): toca «Recibir código», lo escribe y
está dentro.

## Especificación de origen

- `comunicaAreaPrivada/docs/ACCESO.md` (las cuatro puertas y sus límites),
  `inc/stic-otp.php`, `inc/stic-magic-login.php`, handlers de
  `inc/stic-action.php` (≈1077-1316), `inc/stic-family.php` (perfiles).
- En la app: `contexts/AuthContext.tsx` (cuenta Google/Apple con Firebase
  Auth), `app/+native-intent.ts` y `utils/pendingComunicaLink.ts` (enlaces que
  ya abren la app).

Lo que **no** se porta: la contraseña (`stic_pa_password_c`, en claro, SEC-03)
y el token permanente `?token=`. En el área nativa no existen.

## Pantallas y rutas

| Ruta | Qué |
|---|---|
| `comunica/acceso.tsx` | «Entra en tu área»: correo (ya puesto si hay cuenta de la app, editable) o, con un enlace discreto, DNI/NIE. Botón «Recibir código» |
| `comunica/acceso-codigo.tsx` | Seis casillas (`InputOTP` de heroui) con autocompletado del código (`textContentType="oneTimeCode"` / `autoComplete="one-time-code"`: iOS lo coge del correo de Mail). «Te lo hemos mandado a m•••@gmail.com». «Volver a mandar» con su cuenta atrás. «Cambiar el correo» |
| `comunica/acceso-elegir.tsx` | Solo si el correo es de varias fichas del CRM: «¿Quién eres?» con nombre y delegación. Arregla lo de hoy (en el plugin entra la primera) |
| `comunica/yo/index.tsx` (hecho como `yo.tsx`, 24/10) | Tu cuenta: nombre, foto, delegación, papeles (con `RoleChip` solo lo excepcional), «Abrir la versión web», «Salir» |

El enlace del correo también entra: el servidor manda en el mismo correo el
código y un enlace `https://comunica.movimientoconsolacion.com/app/acceso?acceso_app=<token>`.
`+native-intent.ts` reconoce `acceso_app` (distinto del `acceso_magico` de
WordPress, que sigue yendo a la WebView) y lo manda a `acceso-codigo` con el
token, que se canjea sin teclear nada.

## Datos: su trozo del contrato

| Ruta | Envía | Devuelve | Notas |
|---|---|---|---|
| `POST /v1/auth/code` | `{ email }` o `{ dni }` | `202 { sentTo }` (correo tapado; **también por DNI**) | ~~Misma respuesta exista o no~~ (superado el 31/10): `422 validation` `no_match` (correo o DNI sin ficha), `no_email` (DNI con ficha sin correo), `429 rate_limited` `too_many_misses` (8 fallos en 30 min desde esa red, `retryAfter` 1800; ni se mira el CRM). Límites de envío: 5 por correo cada 20 min, 30 por IP y hora → `rate_limited` con `retryAfter` (sin `reason`). `503 crm_unavailable` NO es «no existe» |
| `POST /v1/auth/verify` | `{ email \| dni, code }` o `{ linkToken }`, y `personId` si se eligió | `{ accessToken, refreshToken, expiresIn, me }` o `{ choose: [{ personId, name, delegation }] }` | 10 códigos fallidos bloquean esa vía 1 h (`rate_limited`); código caducado (40 min) → `validation` con motivo |
| `POST /v1/auth/refresh` | `{ refreshToken }` | nuevo par | El de refresco **rota** en cada uso; uno reutilizado revoca la sesión |
| `POST /v1/auth/logout` | — | `204` | Revoca el de refresco de este móvil |
| `GET /v1/me` | — | `Me` (plan 00) | |

- **Token de acceso** (corto, ~15 min) solo en memoria. **Token de refresco**
  (sesión de meses, deslizante) en `expo-secure-store`. Nunca en AsyncStorage.
- El cliente (plan 00) pone la cabecera y, ante un 401, refresca una vez y
  repite; si el refresco falla, lleva a `acceso`.
- **Servidor falso:** cualquier correo de los fixtures recibe el código
  `123456`; un correo de dos fichas lleva a `acceso-elegir`; un correo
  concreto simula `rate_limited`; `linkToken` falso válido y caducado. **Desde el 1/11:** un correo que no esté
  en los fixtures (a propósito, `quien@noexiste.test`) da `no_match`; el DNI `00000000T` tiene ficha pero no correo
  (`no_email`); un DNI desconocido, `no_match`; a los **8 fallos** (correos o DNI que no existen, ventana de 30
  min con el reloj del falso) todo da `too_many_misses` con `retryAfter` 1800, también un correo que sí existe. Los
  aciertos y el `no_email` no cuentan. Con un DNI que existe, `sentTo` enseña su correo tapado.

## Comportamiento y reglas

- ~~Nunca se dice si un correo existe~~ → **desde el 1/11 sí se dice** (ver «Si el correo no existe»).
- El correo de la cuenta de la app se propone, no se impone: muchas familias y
  monitores usan otro correo en el CRM. Si no coincide con ninguna ficha, el
  servidor lo dice (`no_match`) y la pantalla ofrece el DNI. `acceso-codigo` ya no necesita decir «prueba con otro
  correo»: solo «Si no te llega, mira en el correo no deseado o pide otro código.»

### Si el correo no existe (1/11/2026; `AccessScreen`, `AccessNotices`, `codeRequestProblem` en `acceso/copy.ts`)

Igual que la web (`ACCESO.md` §2). Qué se ve según lo que conteste `POST /v1/auth/code`:

| Respuesta | Qué se ve |
|---|---|
| 202 | Pasa a `acceso-codigo` («Te lo hemos mandado a m•••@…», también por DNI) |
| `no_match` por **correo** | Aviso rojo («Ese correo no está en Comunica.») **con el correo tecleado** y «Revisa que esté bien escrito.»; el campo **se queda relleno** (con borde de error) para corregir la errata; debajo, la **tarjeta del DNI abierta**: «¿Te diste de alta con otro correo?» y el botón en contorno «Buscarme por mi DNI», que abre el campo del DNI con el foco puesto. Al volver a «Entrar con el correo», el correo sigue ahí |
| `no_match` por **DNI** | «No encontramos a nadie con ese documento.» (sin tarjeta del DNI) |
| `no_email` (solo DNI) | «Te encontramos, pero no tenemos un correo tuyo: escribe a la oficina técnica.» con el enlace `mailto:comunica@movimientoconsolacion.com` |
| `too_many_misses` | «Hemos recibido demasiados intentos con correos que no están en Comunica desde esta red. Espera unos minutos o escríbenos.» con el mismo enlace; **no** se ofrece el DNI |
| `rate_limited` sin motivo | «Demasiados intentos. Espera N minutos.» (el tope de envíos de siempre) |
| `crm_unavailable` | «Comunica no responde ahora mismo…». **Nunca** «no existe» ni la tarjeta del DNI: una caída del CRM mandaría a todo el mundo al DNI |
| `network` | «Sin conexión. Necesitas conexión para entrar la primera vez.» |

`Entrar como <correo de la cuenta de la app>` no cambia: su `no_match` sigue diciendo «El correo de tu cuenta de la
app no está en Comunica. Entra con el correo que tiene tu delegación o con el DNI.» (no es el correo tecleado). Sin
colores ni radios nuevos: el aviso usa `chip('negative')` y `dangerText` del tema, la tarjeta, `card` y `separator`, y
el botón, el mismo contorno que «Entrar como…». Tests: `accessScreen.test.tsx` (la pantalla con el falso),
`session.test.ts` (el falso, incluido el freno).
- **Salir** borra todo lo del área en el móvil (plan 01 §3) y vuelve a
  `acceso`. No toca la cuenta de la app.
- Si el servidor revoca la sesión (la persona deja de ser monitor, o se
  revoca a mano), el siguiente refresco falla y se vuelve a `acceso` con un
  aviso corto, sin borrar nada en silencio de la cola: si hay escrituras sin
  subir, se avisa antes de borrar.
- Sin conexión y con sesión guardada, se entra igual (con lo guardado). Sin
  sesión y sin conexión: «Necesitas conexión para entrar la primera vez».
- Face ID no entra en esta versión (decisión `extras`); el paquete queda
  instalado por si se quiere luego.

## Estados

- `acceso`: enviando (botón con estado), error de red, `rate_limited` («Espera
  N minutos»).
- `acceso-codigo`: comprobando, código incorrecto (`h.error` de
  `utils/haptics.ts` y borrar las casillas), caducado («Pide otro»),
  bloqueado. Al entrar, `h.formSuccess`.
- `yo`: sin conexión enseña lo guardado; «Salir» pide confirmación si hay
  cola pendiente.

## Traducción del diseño

La pantalla de acceso del plugin (`pages/` + `render-acceso.php`) se traduce
con las reglas del plan 03, pero aquí manda la app: campos `AppTextField` con
`keyboardType="email-address"`, `autoComplete="email"`, un solo botón
principal (`AppPrimaryButton`), sin fondos con cristal ni degradados grandes.
Textos cortos: «Entra en tu área», «Te mandamos un código».

## Tareas

| # | Tarea | Cómo se comprueba |
|---|---|---|
| 1 | Trozo del contrato y servidor falso (rutas de arriba) | Tests del falso: código válido, inválido, caducado, varias fichas, límites |
| 2 | `services/comunica/session.ts`: tokens en memoria y en `expo-secure-store` (adaptador en memoria para web y tests), refresco con rotación, cabecera en el cliente | Tests: 401 → refresca y repite una vez; refresco fallido → sin sesión |
| 3 | `acceso.tsx` con el correo de `AuthContext` ya puesto y la vía DNI | Captura 375 px claro/oscuro; test que precarga el correo |
| 4 | `acceso-codigo.tsx` con `InputOTP`, autocompletado, reenviar y estados | Tests de estados con el falso |
| 5 | `acceso-elegir.tsx` | Test con el correo de dos fichas |
| 6 | Enlace `acceso_app` en `+native-intent.ts` sin romper `acceso_magico` | Tests de `+native-intent` con los dos enlaces |
| 7 | `yo/index.tsx` con «Abrir la versión web» y «Salir» (aviso si hay cola) | Test de que salir borra (guardarraíl del plan 01) |

## Tests

Además de los de cada tarea: un test de que el token de refresco nunca pasa
por AsyncStorage ni por la caché de consultas, y uno de que `acceso_magico`
sigue llegando a la WebView como hoy.

## Preguntas abiertas

- **DNI que no existe** (~~tarjeta `dni`: «contestar igual que con el correo»~~, **superada el 31/10/2026** por la
  decisión del propietario de decir también si el correo no existe, como la web): ahora la app dice «No encontramos a
  nadie con ese documento.» Ver «Si el correo no existe».
- **Rellenar el perfil de la app con el CRM** (papel y delegación, en vez de lo
  que la persona eligió en el onboarding): necesita la tabla de equivalencias
  de delegaciones (`ANALISIS_AREA_PRIVADA_NATIVA.md` §7). Queda fuera de este
  plan hasta que exista.
