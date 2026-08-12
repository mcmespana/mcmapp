# Contrato App ↔ Comunica (WebView)

> Qué le manda la app MCM a la web de Comunica cuando la carga embebida, y qué
> tiene que hacer la web (PHP) para responder bien.
>
> Lado app: `mcm-app/app/screens/ComunicaScreen.tsx` (layout) +
> `mcm-app/hooks/useComunicaWebView.ts` (tema, historial, progreso, errores).
> Lado web: repo de `comunica.movimientoconsolacion.com` (PHP). Los formularios
> del CRM (alta de laicos, monitores, participantes) viven en el repo
> `comunicaFormularios`, y su hoja `crm_comunica_estilos.css` ya implementa este
> contrato — sirve de **referencia** de cómo hacerlo en el portal PHP.

## 1. Detectar que se está dentro de la app

La app carga siempre la URL con `?app=1`:

```
https://comunica.movimientoconsolacion.com/aptest/?app=1&theme=dark
```

En PHP:

```php
$enApp = isset($_GET['app']) && $_GET['app'] === '1';
```

Úsalo para ocultar el header/menú/footer propios de la web (la app ya pone su
barra y su tab bar) y para no mostrar enlaces que saquen de la app.

## 2. Tema claro/oscuro

La app tiene su propio selector de tema (**Sistema / Claro / Oscuro**), así que
**`prefers-color-scheme` NO es fiable**: refleja la apariencia del sistema
operativo, no lo que el usuario haya elegido dentro de la app. Por eso el tema
se manda explícitamente por **tres vías** (todas con el mismo valor: `light` o
`dark`):

| Vía | Dónde | Cuándo llega | Para qué |
| --- | ----- | ------------ | -------- |
| `?theme=` | Query string de la URL inicial | Solo en la **primera** petición | Render server-side correcto de entrada, sin parpadeo |
| Cookie `mcm_theme` | Cookie (`path=/`, 1 año, `SameSite=Lax`) | En **todas** las peticiones a partir de la segunda | Que PHP siga acertando cuando el usuario navega por el portal |
| `<html>` | `data-mcm-theme="dark"`, clase `.dark`/`.light`, `style="color-scheme:dark"` | Tras cargar cada página | Webs que resuelven el tema solo con CSS, sin tocar servidor |

### Lo mínimo que hay que implementar en PHP

```php
// El query param manda en la primera carga; luego la cookie.
$theme = $_GET['theme'] ?? $_COOKIE['mcm_theme'] ?? 'light';
$theme = $theme === 'dark' ? 'dark' : 'light';   // nunca confiar en el valor crudo
```

Y volcarlo al HTML:

```php
<html class="<?= $theme ?>" data-mcm-theme="<?= $theme ?>" style="color-scheme: <?= $theme ?>">
```

Con eso, el CSS puede ser tan simple como:

```css
html.dark { --bg: #1c1c1e; --fg: #f2f2f7; }
html.light { --bg: #ffffff; --fg: #1a1a1a; }
```

> **Importante:** el CSS debe colgar de la **clase/atributo**, no solo de
> `@media (prefers-color-scheme: dark)`. Si la web solo usa el media query, el
> modo oscuro elegido a mano en la app no se verá reflejado.

La app actualiza además el `<meta name="theme-color">` de la página con el color
de fondo del tema, y conviene que el `<head>` declare
`<meta name="color-scheme" content="light dark">` para que los controles nativos
(inputs, scrollbars) se pinten acordes.

Receta usada en `comunicaFormularios` (recomendada para el portal): declarar la
paleta en variables CSS con los valores CLAROS por defecto y sobrescribir solo
las variables en los dos escenarios oscuros — así las reglas se escriben una vez
y el tema claro no se toca:

```css
:root { --bg: #ffffff; --fg: #1a1a1a; /* … */ }

/* Oscuro pedido explícitamente por la app */
html.dark, html[data-mcm-theme="dark"] { --bg: #121316; --fg: #edf0f5; }

/* Fuera de la app: preferencia del sistema, salvo que se haya pedido claro */
@media (prefers-color-scheme: dark) {
  html:not(.light):not([data-mcm-theme="light"]) { --bg: #121316; --fg: #edf0f5; }
}
```

Ojo con dos detalles que muerden: las variables CSS **no** funcionan dentro de un
`url()` (para un SVG embebido, como la flecha de los `<select>`, hay que guardar
el `url()` entero en la variable), y los logos azul oscuro sobre transparente
necesitan una tarjeta clara detrás en oscuro para seguir legibles.

### Cambio de tema en caliente

Si el usuario cambia el tema mientras tiene Comunica abierto, la app **no
recarga** la página (perdería lo escrito en formularios): reinyecta el JS que
actualiza la clase de `<html>` y la cookie. Por eso conviene que el CSS reaccione
a la clase — el cambio se ve al instante sin recargar.

Esto aplica tanto si el cambio viene del selector de la app como del sistema
operativo cuando el selector está en **Sistema** (la app escucha `Appearance` y
reinyecta igual).

> **Excepción — versión web de la app.** Ahí Comunica va en un `<iframe>`
> cross-origin: no se le puede inyectar JS, así que un cambio de tema **sí**
> recarga el iframe con el nuevo `?theme=`. No hay alternativa y en web el caso
> es marginal.

### Apariencia nativa de la app

La app llama a `Appearance.setColorScheme()` con el tema elegido, así que todo lo
que pinta el sistema operativo (barra glass del notch, tab bar, teclado, fondo por
defecto del propio WebView) sigue el selector de la app y no el modo del
dispositivo. Antes se quedaba en claro con la app en oscuro. La web no tiene que
hacer nada con esto, pero explica por qué el marco de la pantalla cambia a la vez
que el contenido.

### Quién resuelve «Sistema»

**La app.** El selector tiene tres valores (Sistema / Claro / Oscuro) pero a la
web solo le llega `light` o `dark` ya resueltos; la web nunca ve `system`. Si
algún día se quisiera delegar, bastaría con omitir `theme` y no escribir
`mcm_theme` para que la web cayera en «Automático» (`prefers-color-scheme` +
`matchMedia`) — **hoy no es el caso: la app manda siempre**.

### Color de fondo de página (costura de overscroll)

La app pinta un fondo sólido por detrás del WebView para evitar el flash blanco
al cargar; se ve además en el rebote del scroll. Tiene que ser **el mismo** que
el fondo de página de la web, o aparece una costura de color:

| Tema | Color |
| ---- | ----- |
| Oscuro | `#121316` |
| Claro | `#FFFFFF` |

Si la web cambia su fondo de página, avisad para actualizar `PAGE_BG_DARK` /
`PAGE_BG_LIGHT` en `ComunicaScreen.tsx`.

Ese color se aplica también al propio WebView (`opaque={false}` en iOS): sin eso,
WKWebView pinta las zonas del `contentInset` —la franja del notch y el hueco del
tab bar— con su blanco por defecto, que no cambia nunca de tema.

### Momento de la primera carga

La app no monta la web hasta haber leído de disco el tema guardado. Sin eso, en
un arranque en frío el primer render usaría el tema del sistema operativo y
alguien con la app en Claro y el móvil en oscuro recibiría `?theme=dark` en la
primera petición (parpadeo, corregido acto seguido por la inyección).

## 3. Zona segura (notch y tab bar)

La app dibuja la web **a pantalla completa**, por detrás de la franja superior
del notch y del tab bar flotante inferior. El contenido arranca en zona segura
pero **se desliza por debajo** de ambos al hacer scroll. Cómo se consigue el
hueco depende de la plataforma:

| Plataforma | Mecanismo |
| ---------- | --------- |
| iOS | `contentInset` del WKWebView — lo mueve el contenedor nativo, la web no se entera |
| Android | **La propia página**: el WebView de Android no admite `contentInset`, así que la app le inyecta el padding por CSS |

### Variables CSS que la app publica

En **ambas** plataformas la app escribe estas dos variables en `<html>`, y las
reescribe cuando cambian (rotación de pantalla, cambio de safe area):

```css
--mcm-app-inset-top     /* alto del notch */
--mcm-app-inset-bottom  /* hueco del tab bar flotante + respiro */
```

Vienen ya en **píxeles CSS** (la app convierte de dp usando el ancho real del
viewport), así que se usan tal cual.

### Lo que la app inyecta en Android

Un `<style id="mcm-app-safe-area">` con:

```css
body {
  padding-top: var(--mcm-app-inset-top) !important;
  padding-bottom: var(--mcm-app-inset-bottom) !important;
}
html {
  scroll-padding-top: var(--mcm-app-inset-top);
  scroll-padding-bottom: var(--mcm-app-inset-bottom);
}
```

Es idempotente (reutiliza siempre el mismo `<style>` por id, no acumula) y lleva
`!important` a propósito: si la web pierde ese padding, el principio de la página
queda tapado por la franja del notch de forma permanente.

> ⚠️ **Si la web tiene su propio `padding` en `<body>`, el de arriba y el de
> abajo se pierden en Android.** Si eso molesta, usad el opt-out de abajo.

### Opt-out: que la web reserve el hueco ella misma

Si el portal prefiere gestionarlo (porque tiene un layout propio, una barra fija
o un `padding` en `body` que no quiere perder), basta con declarar en el HTML:

```html
<html data-mcm-insets="self">
```

Con eso la app **deja de tocar el layout** y se limita a publicar las dos
variables. La web las aplica donde le convenga:

```css
.contenido { padding-top: var(--mcm-app-inset-top, 0px); }
.barra-fija-abajo { padding-bottom: var(--mcm-app-inset-bottom, 0px); }
```

### Elementos `position: fixed`

⚠️ **Ni el `contentInset` de iOS ni el padding de `body` mueven un elemento
`position: fixed`** — un botón fijo abajo (tipo «Guardar» pegado al viewport)
queda tapado por el tab bar en las dos plataformas. Para esos, la web **tiene**
que usar las variables:

```css
.barra-fija-abajo {
  padding-bottom: calc(12px + var(--mcm-app-inset-bottom, env(safe-area-inset-bottom)));
}
```

Y conviene que el `<head>` lleve:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

sin el cual `env(safe-area-inset-*)` vale siempre 0.

## 4. Mientras carga

La app tapa la pantalla con una portada de marca propia (onda del logo animada,
barra de progreso alimentada por `onLoadProgress`, esqueleto de formulario) y la
desvanece cuando la web termina de cargar. **La web no tiene que poner ningún
loader propio para la primera carga**; si falla, la app ofrece «Reintentar».

En las navegaciones siguientes dentro del portal no se tapa nada: solo aparece un
hilo de progreso arriba, como en un navegador.

## 5. Navegación

La app pone su propia cápsula flotante **atrás/adelante** (abajo a la izquierda)
sobre el historial del WebView, y en Android el botón atrás del sistema navega
primero por el historial de la web. La web **no** necesita añadir botones de
volver propios; si los tiene y `app=1`, mejor ocultarlos.

## 6. Enlaces de acceso del correo que abren la app

Los correos del área privada («Acceder a mi área privada») **no enlazan al área
directamente**: enlazan a una ruta puente del mismo dominio, que iOS y Android
reconocen como propiedad de la app MCM.

```
https://comunica.movimientoconsolacion.com/app/acceso?acceso_magico=XXXX
https://comunica.movimientoconsolacion.com/app/acceso?token=XXXX
```

Qué pasa al pulsarlo:

| Situación                                              | Qué ocurre                                                                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| App instalada (iOS o Android)                          | El sistema abre la **app** con esa URL. La petición web **no se llega a hacer**                                    |
| Sin app, u ordenador                                   | La petición llega a WordPress, que **redirige (302)** al área privada con el token intacto → login por web de siempre |
| Cliente de correo que envuelve el enlace en un redirector | Se pierde el universal link → cae en el caso anterior (web). Es el motivo de que exista `mcmapp://comunica?…`      |

### Lado app

- `app.json` declara el dominio: `associatedDomains` (iOS) e `intentFilters` con
  `autoVerify` y `pathPrefix: /app/acceso` (Android). Se reclama **solo esa
  ruta**, no el portal entero: así ningún otro enlace de Comunica que alguien
  comparta se abre en la app por sorpresa.
- `app/+native-intent.ts` traduce la URL entrante: guarda el token en
  `utils/pendingComunicaLink.ts` y devuelve `/(tabs)/comunica`.
- `hooks/useComunicaWebView.ts` carga esa URL en lugar de la de arranque, ya con
  `app=1` y el `theme=` que toque. El WebView lleva `sharedCookiesEnabled`, así
  que la cookie de sesión de PHP se conserva entre aperturas.

### Lado web (plugin de WordPress)

Todo en `inc/stic-app-links.php` del repo `mcmespana/comunicaAreaPrivada`:

- Sirve `/.well-known/apple-app-site-association` y
  `/.well-known/assetlinks.json` desde PHP (sin ficheros en el hosting).
- Atiende `/app/acceso` y redirige al área privada conservando **solo**
  `acceso_magico` y `token` — no es un redirector abierto.
- `sticpa_app_link_url()` convierte cualquier enlace del área en su versión
  puente; es lo que usa el correo de acceso.

> ⚠️ **Android no verificará el dominio hasta que se rellene la huella SHA-256**
> del certificado de firma de la app en Ajustes → SinergiaCRM Private Area
> (Play Console → Setup → App integrity → App signing). Hasta entonces esos
> enlaces siguen abriendo el navegador en Android; iOS sí funciona sin nada más.
> Y en iOS hace falta un **build de tienda**: `associatedDomains` es
> configuración nativa, no viaja en una OTA.

## 7. Notas de seguridad

- Sanea siempre `$_GET['theme']` / `$_COOKIE['mcm_theme']` antes de volcarlos al
  HTML (arriba se hace con la comparación a `'dark'`). Son entrada de usuario:
  cualquiera puede abrir la URL con `?theme="><script>`.
- `app=1` **no es autenticación**: es solo una pista de presentación. Cualquiera
  puede añadirlo en un navegador normal. No lo uses para dar acceso a nada.
