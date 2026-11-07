# 10 — Enrutador, enlaces y la web como legado

> **Estado:** 🟢 listo para ejecutar en `nuevoComunicaChulo` · **Depende de:**
> 00, 01, 02 · **Tamaño:** L · Índice y reglas comunes: [`README.md`](README.md).
>
> Sale de lo que pidió el propietario el 22/10/2026: «si pones el modo alpha
> ves la nueva y si dejas el modo normal ves la normal, pero que la WebView sea
> el legado ya»; «lo que sea muy complicado, saltarlo a la WebView sin que se
> note, usando el token de login»; y «cualquier URL de Comunica te lleva a la
> app, a la sección Comunica, e incluso dentro de la pantalla que toca».

## Para qué

Tres piezas que hacen que el área nueva y la vieja convivan sin costuras:

1. **El enrutador**: decide si la pestaña Comunica enseña el área nativa o la
   WebView de siempre (el **legado**).
2. **El salto a la web**: abre una página del plugin dentro de la app, con
   cabecera nativa y **ya con la sesión puesta**, para lo poco que no se haga
   en nativo.
3. **Los enlaces**: cualquier enlace de Comunica (correo, WhatsApp, aviso del
   móvil, página pública de una actividad) abre la app en la pantalla que
   toca, nativa o del legado, y si trae token, entra.

## Especificación de origen

- Plugin: `inc/stic-magic-login.php` (enlace mágico: `acceso_magico` =
  base64url de `Contacts|<id>|<caducidad>|<hmac-sha256>` con el secreto
  `sticpa_magic_secret`; token permanente `?token=` = `ajmcm_pa_token_c`; el
  destino viaja como `internalpage`, `action`, `id`, `from`, con su forma
  exacta en `sticpa_login_destination_shapes()`), `inc/stic-app-links.php`
  (ficheros `/.well-known/`, ruta puente `/app/acceso`), `menu.php` y `pages/`
  (todas las páginas internas).
- App: `app/+native-intent.ts`, `utils/pendingComunicaLink.ts`,
  `app/screens/ComunicaScreen.tsx`, `hooks/useComunicaWebView.ts`,
  `contexts/PreviewChannelContext.tsx` (el modo alpha: `usePreviewChannel().enabled`),
  `app.json` (`associatedDomains`, `intentFilters`).

## 1. El enrutador

La puerta del plan 01 (`app/(tabs)/comunica/index.tsx`) decide con dos
datos:

| `global.comunicaNativa` (en `/profileConfig`) | Modo alpha apagado | Modo alpha encendido |
|---|---|---|
| `off` | Legado | Legado |
| `alpha` (**por defecto**) | Legado | **Nativa** |
| `all` | Nativa | Nativa |

- **Modo alpha** = el interruptor del Laboratorio Alpha
  (`usePreviewChannel().enabled`), el mismo que da el canal preview. No se
  inventa otro.
- `alpha` es el estado de construcción: solo quien lo enciende ve lo nuevo.
  `all` es el lanzamiento («para todos a la vez»). `off` es la vuelta atrás de
  emergencia, que también apaga lo nuevo a quien está en alpha.
- Este interruptor **sustituye** al booleano `global.comunicaNativa` del plan
  01 §1: el tipo pasa a `'off' | 'alpha' | 'all'` (ausente = `alpha`).
- **El legado** es la ruta `web.tsx` del plan 01: la WebView de siempre
  (`ComunicaScreen`), sin cambios de comportamiento.
- En el Laboratorio Alpha, un panel pequeño «Comunica nueva» (como
  `CarismochitoLabPanel`) dice qué se está viendo y deja abrir el legado para
  comparar.
- **Para que los probadores lo vean**, la rama se mergea a `preview` (la OTA
  del canal preview), como se hace con el cantoral. No hace falta tocar `main`
  hasta el lanzamiento; cuándo, lo decide el propietario.

## 2. El salto a la web, sin que se note

`openLegacy({ internalpage, action?, id?, from?, title })` en
`services/comunica/legacy.ts`:

1. Pide a nuestro servidor un **pase a la web**: `POST /v1/web-pass` con el
   destino. El servidor genera un `acceso_magico` del plugin con el mismo
   secreto (`sticpa_magic_secret`, que se le da como variable de entorno) para
   la persona de la sesión, **con caducidad de 2 minutos**, y devuelve la URL
   completa: `https://comunica.movimientoconsolacion.com/ap/?app=1&theme=…&acceso_magico=…&internalpage=…&action=…&id=…`.
2. Abre `web.tsx` en el mismo `Stack`, con **cabecera nativa** (título de la
   pantalla, botón atrás del sistema) y el cargador de la app. El plugin, en
   modo app (`?app=1`), ya esconde su cabecera y su pie, y aterriza en el
   destino tras validar el enlace (`sticpa_login_destination_args`).
3. Si dentro de la web se toca un enlace a una página que ya es nativa, se
   intercepta (`onShouldStartLoadWithRequest`) y se abre la nativa.

Reglas:

- El pase nunca se guarda ni se registra (ni en Sentry): es una llave de 2
  minutos. El enlace mágico del plugin no es de un solo uso; por eso la
  caducidad corta.
- Si la persona que se ve es un hijo (familias, plan 11), el pase es del
  familiar (`profileId` en `POST /v1/web-pass`) y, tras entrar, la WebView
  carga el cambio de perfil del plugin, que es un GET con sesión:
  `admin-post.php?action=single_stic_profile_selection&profile_selected_id=<hijo>&dest=<destino>`
  (validado por `sticpa_allowed_profile`). Así el legado se abre en ese hijo y
  en la página que toca (lo resolvió el plan 11).
- **Servidor falso:** devuelve una URL de una página local de muestra («Esto
  sería la web del plugin: <destino>»), para probar el flujo sin red.
- El **token permanente** (`?token=`) no lo usa la app para saltar: viaja en
  la URL y no caduca. Solo se acepta cuando llega de fuera (§3).

**Qué va a la web** (la lista final, cerrada el 22/10 con los planes 11-16;
cada uno tiene su tabla «Qué va a la web y por qué»):

| Qué | Cómo | Plan |
|---|---|---|
| El **formulario web avanzado** del CRM (el Foro, el Congreso) | `web.tsx` con la URL ya rellena que da nuestro servidor; no es del plugin, así que va **sin** pase. Su vuelta al área se intercepta y abre «Mis inscripciones» | 14 |
| La **pasarela del banco** (Redsys) | Hoja propia con WebView (`pagos/pasarela.tsx`), no `web.tsx` | 15 |
| Las páginas del plugin **sin pantalla nativa** (`custom_html`, `single_stic_relationships`, `list_stic_contacts`, `single_csme_member_organizations`…) | `openLegacy` con su destino | §4 |
| «Abrir la versión web» de «Tu cuenta» | `openLegacy` a la portada del legado | 02 |
| Mientras un plan no esté hecho, sus pantallas | `openLegacy` interino; cada plan lo quita al hacerse | 04-16 |

Todo lo demás, monitores y familias, es nativo. La página pública de una
actividad y los enlaces externos del cuerpo de un evento se abren en el
navegador del sistema dentro de la app (`expo-web-browser`): no son el área.

## 3. Los enlaces que llegan

### Qué abre la app

- **iOS** (fichero `apple-app-site-association`, lo sirve el plugin): pasar de
  «solo `/app/acceso`» a **todo el dominio salvo** WordPress por dentro y
  ficheros: excluir `/wp-admin/*`, `/wp-login.php`, `/wp-json/*`,
  `/wp-content/*`, `/xmlrpc.php`, `/.well-known/*` y `*.pdf`. Es un cambio del
  plugin (`inc/stic-app-links.php`), sin build de la app.
- **Android** (`intentFilters` de `app.json`): no admite excluir, así que va
  una lista de prefijos: `/ap`, `/app`, `/area-privada`, `/actividades` y la
  ruta exacta `/` (por los `?internalpage=` sueltos; la portada del sitio
  también abrirá la app). **Es nativo: entra en la build 2.2** (apuntado en
  `BACKLOG.md` §C-bis). Una sección pública nueva que se quiera abrir en la
  app en Android necesitará añadir su prefijo y otra build.
- Sin la app instalada, todo sigue como hoy en el navegador.
- El comentario de `stic-app-links.php` explica por qué hoy solo se reclama
  `/app/acceso` («ningún otro enlace se abre en la app por sorpresa»). Con el
  área nativa eso cambia **a propósito**, por decisión del propietario: se
  actualiza el comentario con la fecha.

### Qué hace la app con cada enlace

`+native-intent.ts` traduce, `services/comunica/links.ts` decide:

1. **Trae token** (`acceso_magico` o `token`):
   - Legado (alpha apagado u `off`): como hoy, la WebView con el token.
   - Nativa: `POST /v1/auth/exchange { magic | token }`: el servidor valida el
     enlace mágico con el secreto o busca el token en el CRM, y devuelve una
     sesión nativa como `verify` del plan 02. Si ya había sesión de **otra
     persona**: «Este enlace es para Ana. ¿Entrar como Ana?» (Salir y entrar /
     Cancelar).
2. **Trae destino** (`internalpage` y compañía): se busca en el mapa (§4). Con
   pantalla nativa, se abre esa; si no, `openLegacy` con el mismo destino.
3. **Página pública de una actividad** (`/actividades?e=<slug o id>`):
   `actividades/publica/[slug]` del plan 13. Con sesión, busca el evento
   (`…/events/by-slug/:slug`) y abre su ficha nativa; sin sesión, pinta la
   ficha pública (`GET /v1/public/events/:slug`) con «Entra para apuntarte».
4. **Cualquier otra página del dominio** (formularios públicos, páginas de
   WordPress): el legado con esa URL tal cual, que no necesita sesión.
5. **Nada válido** (otro dominio, `javascript:`, parámetros con forma rara):
   la portada del área. Igual que hoy: nunca se carga una URL que no hayamos
   construido o validado (`pendingComunicaLink.ts`).

Los **avisos del móvil** (plan 08) usan el mismo mapa: un aviso lleva un
destino (`internalpage` y compañía), nunca una ruta de la app.

**Esquema propio de la app**: `+native-intent.ts` deja pasar también
`mcmapp://comunica/pagos/vuelta?intento=…&r=ok|ko`, la vuelta del pago con
tarjeta cuando se paga en el navegador del sistema (camino de reserva del
plan 15). Ningún otro `mcmapp://comunica/…` se acepta.

## 4. El mapa de páginas internas

Una tabla en `services/comunica/links.ts`, con un test que la recorre entera.
Las rutas exactas las dan los planes de cada bloque (su tabla «Enlaces que
llegan aquí»); esta es la lista de páginas y su dueño:

| `internalpage` | Plan |
|---|---|
| `single_stic_pasar_lista`, `_grupos`, `_marcar` | 04 |
| `single_stic_mis_grupos`, `single_stic_pasar_lista_ficha` | 05 |
| `single_stic_coordinacion`, `single_stic_pasar_lista_resumen`, `_monitores`, `_monitor`, `_reuniones` | 06 |
| `single_stic_pasar_lista_evento` | 07 |
| `single_stic_comunica_monitor` | 09 |
| `single_stic_home`, `single_stic_profile_selection` | 11 |
| `single_stic_comunica_perfil`, `single_stic_profile`, `single_stic_comunica_laico`, `single_stic_tutor_profile` | 12 |
| `list_stic_events`, `single_stic_events` | 13 |
| `list_stic_registrations`, `single_stic_registrations` | 14 |
| `list_stic_payments`, `single_stic_payments`, `single_stic_payment_form`, `single_stic_payment_error`, `list_stic_payment_commitments`, `single_stic_payment_commitments` | 15 |
| `list_stic_documents`, `single_stic_documents`, `single_stic_activities_calendar`, `single_stic_sessions`, `list_stic_sessions`, `list_stic_attendances` | 16 |
| `single_stic_password_change`, `single_stic_unsubscribe` | Desactivadas o sin sentido en nativo: a «Tu cuenta» (plan 02, `yo/`) |
| Cualquier otra (`custom_html`, `single_stic_relationships`, `list_stic_contacts`, `single_csme_member_organizations`…) | El legado, con el mismo destino |

Las desactivadas del plugin no se construyen, pero su enlace lleva a la
pantalla nativa más cercana, nunca a un error.

**Enlaces a `admin-post.php`** (descargar un documento, el archivo de un
evento con `sticpa_evento_archivo`, el formulario avanzado con
`sticpa_evento_fwa`, las acciones de Pagos que solo redirigen): viven en
`/wp-admin/`, que no abre la app (§3), así que solo llegan **desde dentro del
legado** (`web.tsx` los intercepta). Van al mismo mapa, por su `action`, con
las filas que dan los planes 13, 14, 15 y 16. La vuelta de la pasarela no pasa
por ahí: llega como `msg=pagado` o `single_stic_payment_error` (plan 15).

**Elegir hijo antes**: si el destino es de familia y quien entra es solo
familiar con varios hijos y sin haber elegido, o se ve a sí mismo y el
destino es un evento, `useComunicaLinks` manda primero a `perfiles?destino=…`
(plan 11, FAM-a1) y de ahí al destino. `links.ts` no lo hace: es puro y no sabe
del perfil.

## 5. Datos: su trozo del contrato

| Ruta | Envía | Devuelve |
|---|---|---|
| `POST /v1/web-pass` | `{ internalpage, action?, id?, from?, profileId? }` | `{ url, expiresAt }` (2 min) |
| `POST /v1/auth/exchange` | `{ magic }` o `{ token }` | Como `POST /v1/auth/verify` (plan 02) |

Requisitos para el plan del servidor: el secreto del plugin como variable de
entorno; validar el destino con las mismas formas que el plugin; el `exchange`
con los mismos límites de intentos que el código (plan 02).

## 6. Tareas

| # | Tarea | Cómo se comprueba |
|---|---|---|
| 1 | Interruptor de tres estados en tipo, seed, resolver y `PANEL_PERFILES.md`; la puerta del plan 01 con el modo alpha | Tests de las 6 combinaciones de §1 |
| 2 | `legacy.ts` (`openLegacy`) + `web.tsx` con cabecera nativa, cargador e interceptación de enlaces a pantallas nativas | Test con el falso; captura: nadie distingue la cabecera de una pantalla nativa |
| 3 | `links.ts`: mapa de §4, destino validado con las formas del plugin, `/actividades?e=`, resto al legado | Test que recorre todas las páginas de `pages/` del plugin (lista copiada en el test) y URLs maliciosas |
| 4 | `+native-intent.ts`: cualquier URL del dominio → pestaña Comunica con el destino; token → `exchange` (nativa) o WebView (legado) | Tests con cada tipo de enlace, con y sin sesión, con sesión de otra persona |
| 5 | Panel «Comunica nueva» en el Laboratorio Alpha | Captura |
| 6 | `intentFilters` de Android con los prefijos de §3 (**para la 2.2**, commit con `[skip-ota]`) | `npx expo config --type introspect` enseña los filtros |
| 7 | Cambio en el plugin: `apple-app-site-association` con todo el dominio salvo las exclusiones, y el comentario actualizado (repo `comunicaAreaPrivada`, su propio commit y su despliegue) | `curl` al fichero en producción tras desplegar; un enlace a `/ap/?internalpage=list_stic_payments` abre la app en un iPhone |

## 7. Tests y guardarraíles

- Ninguna pantalla abre la WebView del legado por su cuenta: todo pasa por
  `openLegacy` (test que recorre los imports de `ComunicaScreen`).
- El pase y los tokens no aparecen en ningún log (test sobre `logger` con un
  pase falso).
- El mapa cubre todas las páginas del plugin (test de §6.3).

## 8. Preguntas abiertas

- Ninguna. La que había (abrir el legado en un hijo) la resolvió el plan 11:
  ver §2.
