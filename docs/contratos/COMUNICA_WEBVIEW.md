# Contrato App ↔ Comunica (WebView)

> Qué le manda la app MCM a la web de Comunica cuando la carga embebida, y qué
> tiene que hacer la web (PHP) para responder bien.
>
> Lado app: `mcm-app/app/screens/ComunicaScreen.tsx`.
> Lado web: repo de `comunica.movimientoconsolacion.com` (PHP).

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

### Cambio de tema en caliente

Si el usuario cambia el tema mientras tiene Comunica abierto, la app **no
recarga** la página (perdería lo escrito en formularios): reinyecta el JS que
actualiza la clase de `<html>` y la cookie. Por eso conviene que el CSS reaccione
a la clase — el cambio se ve al instante sin recargar.

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

## 4. Navegación

La app pone su propia cápsula flotante **atrás/adelante** (abajo a la izquierda)
sobre el historial del WebView, y en Android el botón atrás del sistema navega
primero por el historial de la web. La web **no** necesita añadir botones de
volver propios; si los tiene y `app=1`, mejor ocultarlos.

## 5. Notas de seguridad

- Sanea siempre `$_GET['theme']` / `$_COOKIE['mcm_theme']` antes de volcarlos al
  HTML (arriba se hace con la comparación a `'dark'`). Son entrada de usuario:
  cualquiera puede abrir la URL con `?theme="><script>`.
- `app=1` **no es autenticación**: es solo una pista de presentación. Cualquiera
  puede añadirlo en un navegador normal. No lo uses para dar acceso a nada.
