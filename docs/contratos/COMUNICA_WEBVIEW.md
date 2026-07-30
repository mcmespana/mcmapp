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

La app dibuja la web **a pantalla completa**, por detrás de la barra superior
translúcida y del tab bar inferior, y compensa con `contentInset`. Eso funciona
para contenido que scrollea normal.

⚠️ **Con elementos `position: fixed` el inset no sirve** — un botón fijo abajo
(tipo «Guardar» pegado al viewport) queda tapado por el tab bar. Si la web usa
elementos fijos, debe reservar el hueco ella misma:

```css
.barra-fija-abajo {
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
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

## 6. Notas de seguridad

- Sanea siempre `$_GET['theme']` / `$_COOKIE['mcm_theme']` antes de volcarlos al
  HTML (arriba se hace con la comparación a `'dark'`). Son entrada de usuario:
  cualquiera puede abrir la URL con `?theme="><script>`.
- `app=1` **no es autenticación**: es solo una pista de presentación. Cualquiera
  puede añadirlo en un navegador normal. No lo uses para dar acceso a nada.
