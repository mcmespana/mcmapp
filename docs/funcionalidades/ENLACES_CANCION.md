# Cantoral — Enlaces de una canción (Spotify · partituras · otras webs)

Además de vídeos y audios, una canción puede traer **enlaces** que no son audio
embebido: la versión en Spotify, la partitura escaneada en Drive, o cualquier
otro recurso en una web externa.

La diferencia entre unos y otros **no es de dónde viene el enlace, sino qué hace
la app al pulsarlo**. Es la única distinción que hay que entender:

| Campo                         | Qué es                                     | Qué hace la app                                                          |
| ----------------------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| `audioLinks`                  | Grabaciones nuestras (normalmente Drive)   | **Suena dentro** de la app, en el reproductor flotante                   |
| `youtubeLinks` / `videoEmbed` | Vídeos                                     | **Se ve dentro**, embebido                                               |
| `spotifyLinks`                | Versión en Spotify                         | **Sale de la app**: abre Spotify (o Spotify Web) y hay que volver a mano |
| `driveLinks`                  | Documento de Drive: partitura, PDF, imagen | **Pantalla completa dentro** de la app, como visor de documento          |
| `otherLinks`                  | Cualquier otro recurso                     | **Pantalla completa dentro** de la app, con la URL tal cual              |

Los tres últimos son los que se pintan en la sección **Enlaces** de la hoja de
multimedia; los dos primeros siguen en **Vídeos** y **Audios**.

## Por qué Spotify no va con los audios

Con Spotify no hay embed posible: no se puede reproducir dentro de la app. Al
pulsarlo se sale del cantoral y el usuario tiene que volver a mano, así que
mezclarlo con los audios (que suenan sin salir de la pantalla, con la letra
delante) prometía algo que no puede cumplir. Por eso va aparte y su fila lo
avisa: «Spotify · abre la app».

Es el **único** de los cinco que sale de la app.

## Por qué `driveLinks` no es lo mismo que un audio de Drive

Un enlace de Drive puede ser un audio (`audioLinks`) o un documento
(`driveLinks`), y la app hace cosas distintas con cada uno: el primero **suena**
en el reproductor flotante, el segundo **se mira** a pantalla completa.

**No hay auto-detección por URL**: el tipo lo decide el campo en el que viene el
enlace, que a su vez lo decide quien edita la canción en el Cantoral Admin
(directivas `{audio:}` vs `{drive:}` del `.cho`). La app se fía del campo y no
intenta adivinar por el dominio.

## Cómo se abre el visor a pantalla completa

`components/song-media/SongLinkViewer.tsx` — un `Modal` a pantalla completa con
un `WebView` (en web, un `<iframe>`), cabecera con el nombre del enlace, cerrar
y «abrir fuera».

- **Drive** se carga por `/preview`, que es el endpoint que Google deja
  embeber; el enlace de compartir (`/view`) se niega a pintarse en un iframe.
  Al abrirlo **fuera** se usa el enlace original, que es el que captura la app
  de Google Drive por universal link.
- Si el embed falla, el visor ofrece abrirlo fuera en vez de dejar una pantalla
  en blanco.
- El visor **no** es el reproductor flotante a propósito: una partitura hay que
  leerla mientras se toca, y el PiP está pensado justo para lo contrario (que la
  letra siga visible detrás).

Como la hoja de multimedia es un `Modal` de verdad en iOS, el visor no se abre
mientras la hoja sigue montada: se apunta el enlace y nace en
`onCloseComplete`, el mismo baile que ya hacían el reproductor flotante y la
navegación a etiquetas.

## De dónde salen los datos

Los rellena quien edita el cantoral (Cantoral Admin, pestaña _Audio / Vídeo_) y
viajan en `songs/data`. Contrato completo, con la sintaxis ChordPro de cada
uno: **`docs/CAMPOS_CANCIONES.md` §3.1** del repo `mcmapp-cantoral`.

Los tres campos son **opcionales** y arrays de `{label, url}`: si una canción no
tiene enlaces de un tipo, la clave no existe. El `label` es el texto del botón;
si viene vacío, la app pone un nombre por defecto («Escuchar en Spotify»,
«Partitura», «Ver enlace»).

## Dónde está el código

| Qué                       | Dónde                                                 |
| ------------------------- | ----------------------------------------------------- |
| Modelo y normalización    | `types/songMedia.ts` (`songExtraLinks`, `mediaKinds`) |
| Sección «Enlaces»         | `components/song-media/SongMediaSheet.tsx`            |
| Visor a pantalla completa | `components/song-media/SongLinkViewer.tsx`            |
| Enganche en el detalle    | `app/screens/SongDetailScreen.tsx`                    |
| Indicador 🔗 en la lista  | `components/SongListItem.tsx`                         |
| Tests                     | `__tests__/songLinks.test.tsx`                        |
