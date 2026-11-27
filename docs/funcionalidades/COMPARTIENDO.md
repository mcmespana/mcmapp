# COMPARTIENDO.md — El muro de reflexiones de un evento

> Noviembre de 2026 (Congreso M+C). Solo JS: sale por OTA. Rehecha entera
> el 2026-11-27; antes era una lista de tarjetas con un formulario de cuatro
> campos en una hoja inferior.

**Compartiendo** es el muro de un evento: cada persona escribe lo que se lleva
de esos días y lo lee todo el encuentro. Sin login. Cada evento tiene el suyo
(`<evento>/compartiendo`).

## Dónde se entra

| Desde | Qué hace |
| ----- | -------- |
| **Hub del evento** — tarjeta «Compartiendo», justo debajo del héroe | Toda la tarjeta abre el muro; «Escribir» abre el muro con el compositor ya abierto (`openComposer: '1'`) |
| Icono de bocadillos del grupo flotante de arriba (en Horario, Materiales…) | Abre el muro |
| **«+»** del grupo flotante, ya dentro del muro | Abre el compositor **sin navegar** (ver abajo) |

La tarjeta del hub enseña cuántas hay, cuándo fue la última, las caras de
quien ha escrito y la última frase. Si el panel pone `hidden: true` en el nodo
`compartiendo`, no sale.

## La pantalla

De arriba abajo (`app/screens/ReflexionesScreen.tsx`):

1. **Título** (`ScreenHero`, kicker con el nombre del evento).
2. **Escenario** (`components/reflexiones/ReflexionesStage.tsx`): tarjeta con
   el degradado del color del evento —el mismo que el héroe del hub—. Una
   pastilla con el pulso del muro («Ahora mismo» si la última tiene menos de
   20 min, «Última hace 2 h»…), las últimas 8 reflexiones pasando solas cada
   6,5 s, tres avatares con «N personas» y el botón **Historias**. Pulso y
   rotación solo con la pantalla enfocada; con «reducir movimiento», quietos.
3. **Invitación a escribir** (`ComposerPrompt.tsx`): «¿Qué te llevas de hoy?»
   y los arranques «Me llevo…», «Doy gracias por…», «Hoy he descubierto
   que…», «Una frase que no quiero olvidar:».
4. **El muro**, agrupado por días («HOY · 5», «AYER · 3», «miércoles 25
   nov»). Cada reflexión es (`ReflexionCard.tsx`, `reflexionShape`):
   - **Cartel** — frase de hasta 140 letras sin título: fondo de su color y
     letra grande (`h1` hasta 60 letras, `h2` hasta 140).
   - **Nota** — lo demás: superficie neutra y letra de lectura; el color
     queda en el avatar y en las comillas. Más de 420 letras se corta a 9
     líneas con «Seguir leyendo».

Tocar una tarjeta abre las **historias** desde ella; mantener pulsado (clic
derecho en web) da «Ver a pantalla completa», «Copiar» y «Compartir».

Mientras se mira, la pantalla pregunta a Firebase cada **20 s** si hay algo
nuevo (solo `updatedAt`: si nada cambió, no se descarga nada) y también con
*pull to refresh*. Lo que llega después de abrir entra con un fundido corto
(solo eso; la lista inicial no se anima).

## Escribir

`ReflexionComposer.tsx`: a pantalla completa, **escribes encima de tu
tarjeta**, en su color y con la letra que tendrá en el muro (más pequeña según
se alarga). Abajo, todo opcional y ya relleno:

- **Color**: los seis tonos del logo (`REFLEXION_TONES`: azul MCM, rojo,
  celeste, verde, amarillo, morado). El borrador nuevo empieza en uno al azar.
- **Firma**: sale del perfil (`Nombre · Delegación`) y se puede cambiar o
  dejar vacía (anónimo).
- **Día**: Hoy, Ayer o anteayer (sustituye al selector de fecha, que en web
  no existía).
- Máximo 800 letras; el contador aparece a partir de 600.

El borrador vive en la pantalla: cerrar sin publicar no lo pierde. Si falla
la red, el error sale **dentro** del compositor (un toast quedaría debajo del
modal) y el texto se queda. Al publicar: confeti, el muro sube arriba y el
hub se entera al momento (`revalidateNode`).

## Historias

`ReflexionStories.tsx`: las reflexiones a pantalla completa, cada una sobre
su color, como las historias de Instagram. Sirve para leer el muro en grande
y para **proyectarlo** durante el encuentro.

- Tocar a la derecha → siguiente; a la izquierda → anterior; mantener → pausa.
- Cada una dura entre 5 y 15 s según lo larga que sea (`storyDurationMs`).
- Con el lector de pantalla activo no avanzan solas (en web no se consulta:
  `react-native-web` contesta siempre que sí).
- **Copiar** y **Compartir como imagen**: una historia de 1080×1920 con el
  texto, la firma y «EVENTO · COMPARTIENDO» (`utils/reflexionCard.ts`, el
  mismo motor que las tarjetas de Contigo: `react-native-svg` → PNG, sin
  paquetes nuevos). Si la imagen falla, se comparte el texto.
- Al final, **«¿Y tú?»**: invita a escribir la tuya.

## El fallo del «+» (noviembre de 2026)

El «+» del grupo flotante lo pinta el **layout** del stack, no la pantalla.
Antes navegaba otra vez a la misma ruta con un `openFormNonce` nuevo:
`router.push` apilaba **otra copia** de Compartiendo, que nacía con el nonce
ya puesto y por eso nunca abría el formulario. Cada toque, una pantalla más
encima, idéntica: «le das al más e infinitamente vuelve al mismo sitio».

Ahora el layout llama a `requestReflexionComposer()`
(`utils/reflexionesComposerRequests.ts`) y la pantalla de Compartiendo que
está **enfocada** abre su compositor. Solo escucha la enfocada (se suscribe con
`useFocusEffect`) porque un `Modal` de RN se pinta encima de todo aunque su
pantalla esté en otra pestaña. Lo vigila
`__tests__/reflexionesComposerRequests.test.ts`.

## Datos

`<evento>/compartiendo` → `{ updatedAt, data: { <pushKey>: Reflexion } }`
(los datos más antiguos del Jubileo traen `data` como array).

```ts
{
  id: '1764201234567',   // Date.now() al publicar: da la hora («hace 5 min»)
  contenido: 'Despertar es dejar que otro te despierte.',
  fecha: '2026-11-27',   // el día al que se refiere (Hoy/Ayer/anteayer)
  grupal: false,
  autor?: 'Marta · Valencia',  // sin firma, no se escribe la clave
  tono?: 'primary',      // NUEVO (2026-11-27), clave de REFLEXION_TONES
  titulo?: '…',          // solo en las antiguas; ya no se pide
  grupo?: '…',           // reflexiones grupales antiguas (grupos Conso+)
}
```

- Se publica con **un solo `update()` multi-path** (`data/<key>` +
  `updatedAt`), con reintento: si fuesen dos escrituras y fallase la segunda,
  la reflexión quedaría invisible para el resto (`buildReflexionUpdate`).
- `tono` es opcional y **compatible hacia atrás**: sin él (o con un valor
  desconocido) la tarjeta coge un tono estable derivado del `id`.
- Reglas: `compartiendo/data` y `updatedAt` escribibles por cualquiera, sin
  validación de campos (`database.rules.json`). El panel no lee este nodo.

## Ficheros

| Archivo | Qué es |
| ------- | ------ |
| `utils/reflexiones.ts` | Modelo puro: normalizar, ordenar, tonos, forma, días, tiempos, cifras, payload |
| `utils/reflexionCard.ts` | La imagen de historia para compartir |
| `utils/reflexionesComposerRequests.ts` | El «+» de arriba → compositor, sin navegar |
| `app/screens/ReflexionesScreen.tsx` | La pantalla (datos, borrador, publicar) |
| `components/reflexiones/` | Escenario, invitación, tarjeta, compositor, historias, avatares y la tarjeta del hub |

Tests: `reflexiones.test.ts` (modelo e imagen) y
`reflexionesComposerRequests.test.ts` (el «+»).
